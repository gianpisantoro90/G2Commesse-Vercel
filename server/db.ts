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
          invoice_id TEXT REFERENCES project_invoices(id) ON DELETE SET NULL,
          note TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_project ON project_prestazioni(project_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_stato ON project_prestazioni(stato)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_invoice ON project_prestazioni(invoice_id)`);

      console.log('✅ project_prestazioni table created successfully!');
    } else {
      console.log('✅ project_prestazioni table already exists');
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