/**
 * Migration script to create the project_prestazioni table
 * Run with: npx tsx scripts/migrate-prestazioni.ts
 */

import { neon } from "@neondatabase/serverless";

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Creating project_prestazioni table...");

  try {
    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS project_prestazioni (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

        -- Tipo e dettagli prestazione
        tipo TEXT NOT NULL,
        livello_progettazione TEXT,
        descrizione TEXT,

        -- Stato e ciclo di vita
        stato TEXT NOT NULL DEFAULT 'da_iniziare',
        data_inizio TIMESTAMP,
        data_completamento TIMESTAMP,
        data_fatturazione TIMESTAMP,
        data_pagamento TIMESTAMP,

        -- Importi (in centesimi di euro)
        importo_previsto INTEGER DEFAULT 0,
        importo_fatturato INTEGER DEFAULT 0,
        importo_pagato INTEGER DEFAULT 0,

        -- Collegamento a fattura
        invoice_id TEXT REFERENCES project_invoices(id) ON DELETE SET NULL,

        -- Note
        note TEXT,

        -- Audit
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log("✅ Table project_prestazioni created successfully!");

    // Create indexes for better performance
    await sql`CREATE INDEX IF NOT EXISTS idx_prestazioni_project ON project_prestazioni(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prestazioni_stato ON project_prestazioni(stato)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prestazioni_invoice ON project_prestazioni(invoice_id)`;

    console.log("✅ Indexes created successfully!");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  console.log("🎉 Migration completed!");
}

migrate();
