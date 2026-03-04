/**
 * Script diagnostico: verifica consistenza valori monetari
 * Esegui con: npx tsx scripts/monetary-audit.ts
 */
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function audit() {
  const client = await pool.connect();
  try {
    console.log("=== AUDIT MONETARIO G2 ===\n");

    // 1. Check prestazione_classificazioni
    const classRes = await client.query(`
      SELECT pc.id, pc.prestazione_id, pc.codice_dm, pc.importo_opere, pc.importo_servizio,
             pp.tipo, pp.importo_previsto, p.code, p.client
      FROM prestazione_classificazioni pc
      JOIN project_prestazioni pp ON pc.prestazione_id = pp.id
      JOIN projects p ON pp.project_id = p.id
      ORDER BY p.code, pp.tipo
    `);

    console.log(`\n--- CLASSIFICAZIONI DB (${classRes.rows.length} righe) ---`);
    console.log("(Dovrebbero essere in CENTESIMI, es: €5000 → 500000)\n");

    if (classRes.rows.length === 0) {
      console.log("  Tabella VUOTA - nessuna classificazione nel DB\n");
    } else {
      for (const row of classRes.rows) {
        const opereFlag = row.importo_opere > 0 && row.importo_opere < 10000 ? " ⚠️ SOSPETTO (troppo piccolo per centesimi)" : "";
        const servizioFlag = row.importo_servizio > 0 && row.importo_servizio < 10000 ? " ⚠️ SOSPETTO" : "";
        console.log(`  ${row.code} | ${row.tipo} | ${row.codice_dm} | opere=${row.importo_opere} (€${(row.importo_opere/100).toFixed(2)})${opereFlag} | servizio=${row.importo_servizio} (€${(row.importo_servizio/100).toFixed(2)})${servizioFlag}`);
      }
    }

    // 2. Check prestazioni importoPrevisto
    const prestRes = await client.query(`
      SELECT pp.id, pp.tipo, pp.stato, pp.importo_previsto, pp.importo_fatturato, pp.importo_pagato,
             p.code, p.client
      FROM project_prestazioni pp
      JOIN projects p ON pp.project_id = p.id
      WHERE pp.importo_previsto > 0 OR pp.importo_fatturato > 0
      ORDER BY p.code, pp.tipo
    `);

    console.log(`\n--- PRESTAZIONI CON IMPORTI (${prestRes.rows.length} righe) ---`);
    console.log("(Dovrebbero essere in CENTESIMI)\n");

    for (const row of prestRes.rows) {
      const flag = row.importo_previsto > 0 && row.importo_previsto < 10000 ? " ⚠️ SOSPETTO" : "";
      console.log(`  ${row.code} | ${row.tipo} | stato=${row.stato} | previsto=${row.importo_previsto} (€${(row.importo_previsto/100).toFixed(2)})${flag} | fatturato=${row.importo_fatturato} (€${(row.importo_fatturato/100).toFixed(2)}) | pagato=${row.importo_pagato} (€${(row.importo_pagato/100).toFixed(2)})`);
    }

    // 3. Check project metadata
    const projRes = await client.query(`
      SELECT id, code, client, metadata
      FROM projects
      WHERE metadata IS NOT NULL
      ORDER BY code DESC
      LIMIT 30
    `);

    console.log(`\n--- METADATA PROGETTI (primi 30 con metadata) ---`);
    console.log("(Dovrebbero essere in EURO)\n");

    let metaIssues = 0;
    for (const row of projRes.rows) {
      const m = row.metadata;
      if (!m) continue;

      const importoOpere = m.importoOpere || 0;
      const importoServizio = m.importoServizio || 0;
      const classCount = m.classificazioniDM2016?.length || 0;

      if (importoOpere === 0 && importoServizio === 0 && classCount === 0) continue;

      let flag = "";
      // Check if values look like centesimi (too large for euro)
      if (importoOpere > 50000000) { flag += " ⚠️ importoOpere sembra centesimi!"; metaIssues++; }
      if (importoServizio > 50000000) { flag += " ⚠️ importoServizio sembra centesimi!"; metaIssues++; }

      console.log(`  ${row.code} | ${row.client}`);
      console.log(`    importoOpere=${importoOpere} | importoServizio=${importoServizio} | classificazioni=${classCount}${flag}`);

      if (m.classificazioniDM2016 && m.classificazioniDM2016.length > 0) {
        for (const c of m.classificazioniDM2016) {
          const ci = c.importo || c.importoOpere || 0;
          const cs = c.importoServizio || 0;
          let cflag = "";
          if (ci > 50000000) { cflag += " ⚠️ sembra centesimi"; metaIssues++; }
          console.log(`      ${c.codice}: importo=${ci} servizio=${cs}${cflag}`);
        }
      }
    }

    // 4. Check invoices
    const invRes = await client.query(`
      SELECT pi.id, pi.numero_fattura, pi.importo_netto, pi.importo_totale, pi.importo_iva,
             pi.cassa_previdenziale, pi.ritenuta, pi.stato,
             p.code
      FROM project_invoices pi
      JOIN projects p ON pi.project_id = p.id
      ORDER BY pi.created_at DESC
      LIMIT 20
    `);

    console.log(`\n--- FATTURE RECENTI (${invRes.rows.length}) ---`);
    console.log("(Dovrebbero essere in CENTESIMI)\n");

    for (const row of invRes.rows) {
      const flag = row.importo_netto > 0 && row.importo_netto < 1000 ? " ⚠️ SOSPETTO (forse euro)" : "";
      console.log(`  ${row.code} | ${row.numero_fattura} | netto=${row.importo_netto} (€${(row.importo_netto/100).toFixed(2)}) | totale=${row.importo_totale} (€${(row.importo_totale/100).toFixed(2)}) | stato=${row.stato}${flag}`);
    }

    // 5. Cross-check: per progetti con sia metadata che prestazioni, confronta i valori
    console.log("\n--- CROSS-CHECK: metadata vs prestazioni ---\n");

    const crossRes = await client.query(`
      SELECT p.code, p.client, p.metadata,
             COALESCE(SUM(pp.importo_previsto), 0) as total_previsto_centesimi,
             COALESCE(SUM(pp.importo_fatturato), 0) as total_fatturato_centesimi,
             COUNT(pp.id) as num_prestazioni
      FROM projects p
      LEFT JOIN project_prestazioni pp ON pp.project_id = p.id
      WHERE p.metadata IS NOT NULL
      GROUP BY p.id, p.code, p.client, p.metadata
      HAVING COALESCE(SUM(pp.importo_previsto), 0) > 0
      ORDER BY p.code DESC
      LIMIT 20
    `);

    for (const row of crossRes.rows) {
      const m = row.metadata;
      const metaServizio = m?.importoServizio || 0;
      const metaOpere = m?.importoOpere || 0;
      const dbPrevisto = row.total_previsto_centesimi;
      const dbPrevistoEuro = dbPrevisto / 100;

      let status = "✅";
      // If metadata servizio ≈ db previsto/100, they're consistent
      if (metaServizio > 0 && dbPrevisto > 0) {
        const ratio = metaServizio / dbPrevistoEuro;
        if (ratio > 50 || ratio < 0.02) {
          status = `❌ MISMATCH x${ratio.toFixed(0)}`;
        } else if (ratio > 5 || ratio < 0.2) {
          status = `⚠️ MISMATCH x${ratio.toFixed(1)}`;
        }
      }

      console.log(`  ${row.code} | ${row.client}`);
      console.log(`    metadata: opere=€${metaServizio > 0 ? metaOpere : '-'} servizio=€${metaServizio || '-'}`);
      console.log(`    DB prest: previsto=${dbPrevisto} (€${dbPrevistoEuro.toFixed(2)}) [${row.num_prestazioni} prestazioni]`);
      console.log(`    ${status}`);
    }

    // 6. Summary
    console.log("\n=== RIEPILOGO ===");
    console.log(`Classificazioni DB: ${classRes.rows.length}`);
    console.log(`Prestazioni con importi: ${prestRes.rows.length}`);
    console.log(`Problemi metadata sospetti: ${metaIssues}`);

  } finally {
    client.release();
    await pool.end();
  }
}

audit().catch(err => {
  console.error("Errore audit:", err);
  process.exit(1);
});
