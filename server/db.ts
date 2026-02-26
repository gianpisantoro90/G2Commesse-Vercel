import 'dotenv/config';
import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// For local dev, optionally use @neondatabase/serverless with WebSocket
const isVercel = !!process.env.VERCEL;

// Build DATABASE_URL from components if not available directly
function getDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT } = process.env;

  if (PGHOST && PGDATABASE && PGUSER && PGPASSWORD) {
    const port = PGPORT || '5432';
    const constructedUrl = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${port}/${PGDATABASE}?sslmode=require`;
    return constructedUrl;
  }

  return null;
}

const databaseUrl = getDatabaseUrl();

let pool: pg.Pool | null = null;
let db: any = null;

if (!databaseUrl) {
} else {
  // Use standard pg Pool (TCP) for both Vercel and local dev
  // This avoids the @neondatabase/serverless WebSocket ErrorEvent crash
  // and the Neon HTTP driver tagged-template incompatibility
  const mode = isVercel ? 'Vercel serverless' : 'local dev';

  try {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: isVercel ? 2 : 5,
      idleTimeoutMillis: isVercel ? 10000 : 60000,
      connectionTimeoutMillis: 10000,
      ssl: databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
    });
    db = drizzlePg({ client: pool, schema });
  } catch (error) {
    console.error('❌ Failed to create database connection:', error);
    pool = null;
    db = null;
  }
}

// Auto-migration for project_prestazioni table
async function runMigrations() {
  if (!pool) return;

  try {
    const client = await pool.connect();

    // Check if project_prestazioni table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'project_prestazioni'
      );
    `);

    if (!result.rows[0].exists) {

      await client.query(`
        CREATE TABLE IF NOT EXISTS project_prestazioni (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          tipo TEXT NOT NULL,
          livello_progettazione TEXT,
          descrizione TEXT,
          stato TEXT NOT NULL DEFAULT 'da_iniziare',
          data_inizio TIMESTAMP,
          data_completamento TIMESTAMP,
          data_fatturazione TIMESTAMP,
          data_pagamento TIMESTAMP,
          importo_previsto INTEGER DEFAULT 0,
          importo_fatturato INTEGER DEFAULT 0,
          importo_pagato INTEGER DEFAULT 0,
          note TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_project ON project_prestazioni(project_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_stato ON project_prestazioni(stato)`);

    } else {

      const invoiceIdExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'project_prestazioni' AND column_name = 'invoice_id'
        );
      `);
      if (invoiceIdExists.rows[0].exists) {
        await client.query(`ALTER TABLE project_prestazioni DROP COLUMN IF EXISTS invoice_id`);
        await client.query(`DROP INDEX IF EXISTS idx_prestazioni_invoice`);
      }
    }

    const prestazioneIdExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'project_invoices' AND column_name = 'prestazione_id'
      );
    `);

    if (!prestazioneIdExists.rows[0].exists) {
      await client.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS prestazione_id TEXT`);
      await client.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS tipo_fattura TEXT DEFAULT 'unica'`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_prestazione ON project_invoices(prestazione_id)`);
    }

    const cigExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'cig'
      );
    `);

    if (!cigExists.rows[0].exists) {
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cig TEXT`);
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS numero_contratto TEXT`);
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_inizio_commessa TIMESTAMP`);
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_fine_commessa TIMESTAMP`);
    }

    const creArchiviatoExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'cre_archiviato'
      );
    `);

    if (!creArchiviatoExists.rows[0].exists) {
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cre_archiviato BOOLEAN DEFAULT false`);
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cre_data_archiviazione TIMESTAMP`);
    }

    const oggettoCompletoExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'oggetto_completo'
      );
    `);

    if (oggettoCompletoExists.rows[0].exists) {
      await client.query(`ALTER TABLE projects RENAME COLUMN oggetto_completo TO object`);
    } else {
      const objectExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'object'
        );
      `);

      if (!objectExists.rows[0].exists) {
        await client.query(`ALTER TABLE projects ADD COLUMN object TEXT NOT NULL DEFAULT ''`);
      }
    }

    client.release();
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

export { pool, db, runMigrations };
