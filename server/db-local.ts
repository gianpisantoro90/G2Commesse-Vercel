// Simple database configuration for local development without WebSocket dependencies
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

console.log('🔧 Local database configuration loading...');

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('🗄️ Connecting to PostgreSQL database (local mode)...');
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });

// Test connection
pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL connection established');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
  });