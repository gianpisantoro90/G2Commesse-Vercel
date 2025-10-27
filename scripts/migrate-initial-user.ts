/**
 * Migration script to create initial admin user from environment variables
 *
 * This script reads AUTH_USERNAME and AUTH_PASSWORD from environment variables
 * and creates an admin user in the database.
 *
 * Usage: tsx scripts/migrate-initial-user.ts
 */

import { config } from 'dotenv';
import bcrypt from 'bcrypt';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config();

async function migrateInitialUser() {
  try {
    console.log('🔄 Starting user migration...');

    // Get credentials from environment variables
    const username = process.env.AUTH_USERNAME;
    const password = process.env.AUTH_PASSWORD;

    if (!username || !password) {
      console.error('❌ ERROR: AUTH_USERNAME and AUTH_PASSWORD must be set in environment variables');
      process.exit(1);
    }

    console.log(`📋 Found credentials for user: ${username}`);

    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.username, username));

    if (existingUser) {
      console.log(`⚠️  User "${username}" already exists in database`);
      console.log('   Skipping migration.');
      return;
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    console.log('👤 Creating admin user...');
    const [newUser] = await db.insert(users).values({
      username,
      email: `${username}@g2ingegneria.local`,
      fullName: username.charAt(0).toUpperCase() + username.slice(1),
      passwordHash,
      role: 'admin',
      active: true,
    }).returning();

    console.log('✅ SUCCESS! Admin user created:');
    console.log(`   - Username: ${newUser.username}`);
    console.log(`   - Email: ${newUser.email}`);
    console.log(`   - Full Name: ${newUser.fullName}`);
    console.log(`   - Role: ${newUser.role}`);
    console.log(`   - Active: ${newUser.active}`);
    console.log('');
    console.log('🎉 You can now login with your existing credentials!');
    console.log('');
    console.log('📝 NEXT STEPS:');
    console.log('   1. Login to the application');
    console.log('   2. Go to Sistema → Utenti');
    console.log('   3. Create additional users as needed');
    console.log('   4. (Optional) Remove AUTH_USERNAME and AUTH_PASSWORD from .env');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration
migrateInitialUser();
