import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Build DATABASE_URL from components if not available directly
// This solves the issue where DATABASE_URL disconnects after deployment but individual components remain synced
function getDatabaseUrl(): string | null {
  // First try the direct DATABASE_URL
  if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL from environment (length:', process.env.DATABASE_URL.length, 'chars)');
    return process.env.DATABASE_URL;
  }
  
  // If DATABASE_URL is not available, try to build it from components
  const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT } = process.env;
  
  if (PGHOST && PGDATABASE && PGUSER && PGPASSWORD) {
    const port = PGPORT || '5432';
    const constructedUrl = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${port}/${PGDATABASE}?sslmode=require`;
    console.log('🔧 Constructed DATABASE_URL from components (PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT)');
    console.log('🔍 PGHOST:', PGHOST);
    console.log('🔍 PGDATABASE:', PGDATABASE);
    console.log('🔍 PGPORT:', port);
    return constructedUrl;
  }
  
  console.warn('⚠️ No database connection available');
  console.warn('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'NOT SET');
  console.warn('🔍 PGHOST:', PGHOST || 'NOT SET');
  console.warn('🔍 PGDATABASE:', PGDATABASE || 'NOT SET');
  console.warn('🔍 PGUSER:', PGUSER || 'NOT SET');
  console.warn('🔍 PGPASSWORD:', PGPASSWORD ? 'SET' : 'NOT SET');
  
  return null;
}

const databaseUrl = getDatabaseUrl();

// Configure WebSocket for Neon serverless
if (databaseUrl && databaseUrl.includes('neon.tech')) {
  neonConfig.webSocketConstructor = ws;
  console.log('📡 Configured Neon WebSocket for serverless environment');
}

let pool: Pool | null = null;
let db: any = null;

if (!databaseUrl) {
  console.warn('⚠️ No database URL available, application will use memory storage');
  console.warn('🔍 Environment variables available:', Object.keys(process.env).filter(k => k.includes('PG') || k.includes('DATABASE')));
} else {
  console.log('🗄️ Connecting to database...');
  console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔍 REPLIT_DEPLOYMENT:', process.env.REPLIT_DEPLOYMENT || 'not set');
  
  try {
    // OPTIMIZED: Reduced pool size for Replit (5 connections instead of 10, with longer idle timeout)
    pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
    });
    db = drizzle({ client: pool, schema });
    console.log('✅ Neon database connection established');
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
      console.log('🔄 Creating project_prestazioni table...');

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

      // Create indexes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_project ON project_prestazioni(project_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_stato ON project_prestazioni(stato)`);

      console.log('✅ project_prestazioni table created successfully!');
    } else {
      console.log('✅ project_prestazioni table already exists');

      // Migration: Remove invoice_id column if it exists (no longer used)
      const invoiceIdExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'project_prestazioni' AND column_name = 'invoice_id'
        );
      `);
      if (invoiceIdExists.rows[0].exists) {
        console.log('🔄 Removing deprecated invoice_id column from project_prestazioni...');
        await client.query(`ALTER TABLE project_prestazioni DROP COLUMN IF EXISTS invoice_id`);
        await client.query(`DROP INDEX IF EXISTS idx_prestazioni_invoice`);
        console.log('✅ invoice_id column removed');
      }
    }

    // Migration: Add prestazione_id and tipo_fattura to project_invoices
    const prestazioneIdExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'project_invoices' AND column_name = 'prestazione_id'
      );
    `);

    if (!prestazioneIdExists.rows[0].exists) {
      console.log('🔄 Adding prestazione_id and tipo_fattura to project_invoices...');
      await client.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS prestazione_id TEXT`);
      await client.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS tipo_fattura TEXT DEFAULT 'unica'`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_prestazione ON project_invoices(prestazione_id)`);
      console.log('✅ prestazione_id and tipo_fattura columns added to project_invoices');
    }

    // Migration: Add CRE (Certificazione di Buona Esecuzione) fields to projects table
    const cigExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'cig'
      );
    `);

    if (!cigExists.rows[0].exists) {
      console.log('🔄 Adding CRE fields to projects table...');
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cig TEXT`);
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS numero_contratto TEXT`);
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_inizio_commessa TIMESTAMP`);
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_fine_commessa TIMESTAMP`);
      console.log('✅ CRE fields added to projects table');
    }

    client.release();
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Run migrations on startup
if (pool) {
  runMigrations();
}

export { pool, db };