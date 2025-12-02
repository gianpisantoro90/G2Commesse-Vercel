/**
 * Create admin user on Turso database
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';
import bcrypt from 'bcrypt';

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function createAdmin() {
  const username = 'g.santoro';
  const email = 'gianpi.santoro@me.com';
  const password = '!Gg22019?';
  const fullName = 'G. Santoro';

  console.log('🔧 Initializing Turso database...');

  // Create users table if not exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  console.log('✅ Users table ready');

  // Check if user already exists
  const existing = await client.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [username]
  });

  if (existing.rows.length > 0) {
    console.log('⚠️ User already exists, updating password...');
    const passwordHash = await bcrypt.hash(password, 10);
    await client.execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?',
      args: [passwordHash, Date.now(), username]
    });
    console.log('✅ Password updated!');
  } else {
    // Create new user
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = Date.now();

    await client.execute({
      sql: `INSERT INTO users (id, username, email, full_name, password_hash, role, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)`,
      args: [id, username, email, fullName, passwordHash, now, now]
    });

    console.log('✅ Admin user created!');
  }

  console.log('\n📋 Login credentials:');
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  console.log(`   Email: ${email}`);
}

createAdmin().catch(console.error);
