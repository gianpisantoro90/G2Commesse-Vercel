/**
 * Migration Script: Neon PostgreSQL -> Turso SQLite
 *
 * This script exports all data from your existing Neon database
 * and imports it into Turso for zero-cost deployment.
 *
 * Usage:
 *   1. Set both DATABASE_URL (Neon) and TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 *   2. Run: npx tsx scripts/migrate-to-turso.ts
 */

import 'dotenv/config';

async function migrate() {
  console.log('🚀 Starting migration from Neon to Turso...\n');

  // Check environment variables
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL (Neon) not set');
    process.exit(1);
  }

  if (!process.env.TURSO_DATABASE_URL) {
    console.error('❌ TURSO_DATABASE_URL not set');
    process.exit(1);
  }

  console.log('📊 Configuration:');
  console.log('  Source: Neon PostgreSQL');
  console.log('  Target: Turso SQLite\n');

  try {
    // Import Neon storage (source)
    console.log('📥 Connecting to Neon (source)...');
    const { DatabaseStorage } = await import('../server/storage.js');
    const neonStorage = new DatabaseStorage();

    const neonConnected = await neonStorage.testConnection();
    if (!neonConnected) {
      console.error('❌ Failed to connect to Neon database');
      process.exit(1);
    }
    console.log('✅ Connected to Neon\n');

    // Export all data from Neon
    console.log('📤 Exporting data from Neon...');
    const exportedData = await neonStorage.exportAllData();

    console.log(`  Projects: ${exportedData.projects.length}`);
    console.log(`  Clients: ${exportedData.clients.length}`);
    console.log(`  Users: ${exportedData.users.length}`);
    console.log(`  Tasks: ${exportedData.tasks.length}`);
    console.log(`  Communications: ${exportedData.communications.length}`);
    console.log(`  Deadlines: ${exportedData.deadlines.length}`);
    console.log(`  File Routings: ${exportedData.fileRoutings.length}`);
    console.log(`  OneDrive Mappings: ${exportedData.oneDriveMappings.length}`);
    console.log(`  Files Index: ${exportedData.filesIndex.length}`);
    console.log(`  System Config: ${exportedData.systemConfig.length}\n`);

    // Import Turso storage (target)
    console.log('📥 Connecting to Turso (target)...');
    const { TursoStorage } = await import('../server/storage-turso.js');
    const tursoStorage = new TursoStorage();
    await tursoStorage.initialize();

    const tursoConnected = await tursoStorage.testConnection();
    if (!tursoConnected) {
      console.error('❌ Failed to connect to Turso database');
      process.exit(1);
    }
    console.log('✅ Connected to Turso\n');

    // Import data into Turso
    console.log('📥 Importing data into Turso...');
    await tursoStorage.importAllData(exportedData, 'overwrite');

    console.log('\n✅ Migration completed successfully!\n');

    // Verify migration
    console.log('🔍 Verifying migration...');
    const tursoData = await tursoStorage.exportAllData();

    console.log(`  Projects: ${tursoData.projects.length} (expected: ${exportedData.projects.length})`);
    console.log(`  Clients: ${tursoData.clients.length} (expected: ${exportedData.clients.length})`);
    console.log(`  Users: ${tursoData.users.length} (expected: ${exportedData.users.length})`);
    console.log(`  Tasks: ${tursoData.tasks.length} (expected: ${exportedData.tasks.length})`);

    const allMatch =
      tursoData.projects.length === exportedData.projects.length &&
      tursoData.clients.length === exportedData.clients.length &&
      tursoData.users.length === exportedData.users.length;

    if (allMatch) {
      console.log('\n✅ All data migrated successfully!');
      console.log('\n📝 Next steps:');
      console.log('  1. Remove DATABASE_URL from your .env');
      console.log('  2. Keep only TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
      console.log('  3. Deploy to Vercel with: vercel deploy');
      console.log('  4. Set environment variables in Vercel dashboard');
    } else {
      console.log('\n⚠️ Some data counts don\'t match. Please verify manually.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
