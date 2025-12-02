/**
 * Verify Turso Database Content
 * Run this to check if users were migrated correctly
 */

import 'dotenv/config';

async function verify() {
  console.log('🔍 Verifying Turso database content...\n');

  if (!process.env.TURSO_DATABASE_URL) {
    console.error('❌ TURSO_DATABASE_URL not set');
    process.exit(1);
  }

  try {
    const { TursoStorage } = await import('../server/storage-turso.js');
    const storage = new TursoStorage();
    await storage.initialize();

    const connected = await storage.testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to Turso');
      process.exit(1);
    }
    console.log('✅ Connected to Turso\n');

    // Check users
    const users = await storage.getAllUsers();
    console.log(`👤 Users found: ${users.length}`);

    if (users.length > 0) {
      console.log('\nUser details:');
      for (const user of users) {
        console.log(`  - ${user.username} (${user.email})`);
        console.log(`    Role: ${user.role}, Active: ${user.active}`);
        console.log(`    Password hash exists: ${!!user.passwordHash}`);
        console.log(`    Hash length: ${user.passwordHash?.length || 0}`);
      }
    } else {
      console.log('\n⚠️  No users in database! Migration may have failed.');
    }

    // Check other data
    const projects = await storage.getAllProjects();
    const clients = await storage.getAllClients();

    console.log(`\n📊 Other data:`);
    console.log(`  Projects: ${projects.length}`);
    console.log(`  Clients: ${clients.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verify();
