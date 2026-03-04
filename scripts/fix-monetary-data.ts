/**
 * Script di fix: normalizzazione valori monetari
 *
 * Root cause: la funzione syncProjectMetadataFromClassificazioni NON divideva
 * per 100 prima del commit 669e460. Quindi il metadata ha centesimi dove
 * dovrebbe avere euro.
 *
 * Fix:
 * 1. Re-sync metadata per tutti i progetti con classificazioni DB
 *    (divide DB centesimi / 100 → euro nel metadata)
 * 2. Ricalcola importoPrevisto prestazioni dalla somma classificazioni
 *
 * Esegui con: npx tsx scripts/fix-monetary-data.ts
 */
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  const client = await pool.connect();

  try {
    console.log("=== FIX MONETARIO G2 ===\n");

    // ========== STEP 1: Re-sync metadata per tutti i progetti ==========
    console.log("--- STEP 1: Re-sync metadata (DB centesimi / 100 → euro) ---\n");

    const syncRes = await client.query(`
      SELECT DISTINCT p.id, p.code, p.metadata
      FROM projects p
      JOIN project_prestazioni pp ON pp.project_id = p.id
      JOIN prestazione_classificazioni pc ON pc.prestazione_id = pp.id
      ORDER BY p.code
    `);

    let metaFixed = 0;

    for (const proj of syncRes.rows) {
      const classRes = await client.query(`
        SELECT pc.codice_dm, pc.importo_opere, pc.importo_servizio
        FROM prestazione_classificazioni pc
        JOIN project_prestazioni pp ON pc.prestazione_id = pp.id
        WHERE pp.project_id = $1
      `, [proj.id]);

      // Aggregate by codice_dm
      const byCode = new Map<string, { importo: number; importoOpere: number; importoServizio: number }>();
      for (const c of classRes.rows) {
        const existing = byCode.get(c.codice_dm);
        if (existing) {
          existing.importo += c.importo_opere ?? 0;
          existing.importoOpere += c.importo_opere ?? 0;
          existing.importoServizio += c.importo_servizio ?? 0;
        } else {
          byCode.set(c.codice_dm, {
            importo: c.importo_opere ?? 0,
            importoOpere: c.importo_opere ?? 0,
            importoServizio: c.importo_servizio ?? 0,
          });
        }
      }

      // Convert centesimi → euro for metadata
      const classificazioniDM2016 = Array.from(byCode.entries()).map(([codice, v]) => ({
        codice,
        importo: v.importo / 100,
        importoOpere: v.importoOpere / 100,
        importoServizio: v.importoServizio / 100,
      }));

      const metadata = (proj.metadata as any) || {};
      const oldImportoOpere = metadata.importoOpere;
      const oldImportoServizio = metadata.importoServizio;

      metadata.classificazioniDM2016 = classificazioniDM2016;
      metadata.importoServizio = classificazioniDM2016.reduce((sum: number, c: any) => sum + (c.importoServizio || 0), 0);
      if (classificazioniDM2016.length > 0) {
        metadata.classeDM2016 = classificazioniDM2016[0].codice;
        metadata.importoOpere = classificazioniDM2016.reduce((sum: number, c: any) => sum + (c.importo || 0), 0);
      }

      const newImportoOpere = metadata.importoOpere;
      const newImportoServizio = metadata.importoServizio;

      console.log(`  ${proj.code}: importoOpere ${oldImportoOpere} → ${newImportoOpere}, importoServizio ${oldImportoServizio} → ${newImportoServizio}`);

      await client.query(
        `UPDATE projects SET metadata = $1 WHERE id = $2`,
        [JSON.stringify(metadata), proj.id]
      );
      metaFixed++;
    }

    console.log(`\n  Metadata aggiornati: ${metaFixed}\n`);

    // ========== STEP 2: Ricalcola importoPrevisto prestazioni ==========
    console.log("--- STEP 2: Ricalcolo importoPrevisto prestazioni ---\n");

    const prestRes = await client.query(`
      SELECT pp.id, pp.tipo, pp.importo_previsto, p.code,
             COALESCE(SUM(pc.importo_servizio), 0) as calc_importo_previsto
      FROM project_prestazioni pp
      JOIN projects p ON pp.project_id = p.id
      LEFT JOIN prestazione_classificazioni pc ON pc.prestazione_id = pp.id
      GROUP BY pp.id, pp.tipo, pp.importo_previsto, p.code
      HAVING COALESCE(SUM(pc.importo_servizio), 0) > 0
         AND COALESCE(SUM(pc.importo_servizio), 0) != pp.importo_previsto
      ORDER BY p.code
    `);

    let prestFixed = 0;

    for (const prest of prestRes.rows) {
      const calcPrevisto = prest.calc_importo_previsto;
      const currentPrevisto = prest.importo_previsto || 0;

      console.log(`  ${prest.code} | ${prest.tipo}: importoPrevisto ${currentPrevisto} (€${(currentPrevisto/100).toFixed(2)}) → ${calcPrevisto} (€${(calcPrevisto/100).toFixed(2)})`);

      await client.query(
        `UPDATE project_prestazioni SET importo_previsto = $1, updated_at = NOW() WHERE id = $2`,
        [calcPrevisto, prest.id]
      );
      prestFixed++;
    }

    console.log(`\n  Prestazioni aggiornate: ${prestFixed}\n`);

    // ========== STEP 3: Verifica ==========
    console.log("--- STEP 3: Verifica ---\n");

    // Sample check
    const sampleRes = await client.query(`
      SELECT p.code, p.metadata,
             COALESCE(SUM(pp.importo_previsto), 0) as total_previsto
      FROM projects p
      LEFT JOIN project_prestazioni pp ON pp.project_id = p.id
      JOIN prestazione_classificazioni pc ON pc.prestazione_id = pp.id
      GROUP BY p.id, p.code, p.metadata
      ORDER BY p.code
    `);

    for (const row of sampleRes.rows) {
      const m = row.metadata;
      const metaOpere = m?.importoOpere || 0;
      const metaServizio = m?.importoServizio || 0;

      console.log(`  ${row.code}: meta.opere=€${metaOpere.toFixed ? metaOpere.toFixed(2) : metaOpere} meta.servizio=€${metaServizio.toFixed ? metaServizio.toFixed(2) : metaServizio} | prestazioni.previsto=${row.total_previsto} (€${(row.total_previsto/100).toFixed(2)})`);
    }

    console.log(`\n=== RIEPILOGO ===`);
    console.log(`Metadata aggiornati: ${metaFixed}`);
    console.log(`Prestazioni ricalcolate: ${prestFixed}`);

  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(err => {
  console.error("Errore fix:", err);
  process.exit(1);
});
