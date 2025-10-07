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
} else {
  console.log('🗄️ Connecting to database...' );
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