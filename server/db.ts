import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon serverless
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')) {
  neonConfig.webSocketConstructor = ws;
  console.log('📡 Configured Neon WebSocket for serverless environment');
}

let pool: Pool | null = null;
let db: any = null;

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL not set, application will use memory storage');
  console.warn('🔍 Environment variables available:', Object.keys(process.env).filter(k => k.includes('PG') || k.includes('DATABASE')));
} else {
  console.log('🗄️ Connecting to database...');
  console.log('🔍 DATABASE_URL is set (length:', process.env.DATABASE_URL.length, 'chars)');
  console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔍 REPLIT_DEPLOYMENT:', process.env.REPLIT_DEPLOYMENT || 'not set');
  
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
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

export { pool, db };