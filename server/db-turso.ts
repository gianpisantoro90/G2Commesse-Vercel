/**
 * Turso Database Connection
 * Zero-cost SQLite edge database for Vercel deployment
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from "@shared/schema-sqlite";

// Get Turso connection details from environment
function getTursoConfig() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.warn('⚠️ TURSO_DATABASE_URL not set');
    return null;
  }

  // For local development, use file-based SQLite
  if (url.startsWith('file:') || url.startsWith('sqlite:')) {
    console.log('📁 Using local SQLite database:', url);
    return { url };
  }

  // For production Turso, require auth token
  if (!authToken) {
    console.warn('⚠️ TURSO_AUTH_TOKEN not set for remote Turso database');
    return null;
  }

  return { url, authToken };
}

const config = getTursoConfig();

let client: ReturnType<typeof createClient> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (config) {
  try {
    client = createClient(config);
    db = drizzle(client, { schema });
    console.log('✅ Turso database connection established');
  } catch (error) {
    console.error('❌ Failed to connect to Turso:', error);
    client = null;
    db = null;
  }
} else {
  console.warn('⚠️ No Turso configuration available, database features disabled');
}

export { client, db };

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return db !== null;
}

// Initialize database schema (create tables if not exist)
export async function initializeDatabase() {
  if (!client) {
    throw new Error('Database client not available');
  }

  console.log('🔧 Initializing Turso database schema...');

  // Create tables in order (respecting foreign key constraints)
  const createTableStatements = [
    // Clients first (no dependencies)
    `CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      sigla TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      partita_iva TEXT,
      codice_fiscale TEXT,
      forma_giuridica TEXT,
      indirizzo TEXT,
      cap TEXT,
      city TEXT,
      provincia TEXT,
      email TEXT,
      telefono TEXT,
      pec TEXT,
      codice_destinatario TEXT,
      nome_referente TEXT,
      ruolo_referente TEXT,
      email_referente TEXT,
      telefono_referente TEXT,
      note TEXT,
      projects_count INTEGER DEFAULT 0,
      created_at INTEGER
    )`,

    // Users (no dependencies)
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // System config (no dependencies)
    `CREATE TABLE IF NOT EXISTS system_config (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at INTEGER
    )`,

    // Projects (depends on clients)
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      client TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id),
      city TEXT NOT NULL,
      object TEXT NOT NULL,
      year INTEGER NOT NULL,
      template TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in corso',
      tipo_rapporto TEXT NOT NULL DEFAULT 'diretto',
      committente_finale TEXT,
      fatturato INTEGER DEFAULT 0,
      numero_fattura TEXT,
      data_fattura INTEGER,
      importo_fatturato INTEGER DEFAULT 0,
      pagato INTEGER DEFAULT 0,
      data_pagamento INTEGER,
      importo_pagato INTEGER DEFAULT 0,
      note_fatturazione TEXT,
      created_at INTEGER,
      fs_root TEXT,
      metadata TEXT DEFAULT '{}'
    )`,

    // OneDrive mappings (depends on projects)
    `CREATE TABLE IF NOT EXISTS onedrive_mappings (
      id TEXT PRIMARY KEY,
      project_code TEXT NOT NULL REFERENCES projects(code),
      onedrive_folder_id TEXT NOT NULL,
      onedrive_folder_name TEXT NOT NULL,
      onedrive_folder_path TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Files index (depends on projects)
    `CREATE TABLE IF NOT EXISTS files_index (
      id TEXT PRIMARY KEY,
      drive_item_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      mime_type TEXT,
      last_modified INTEGER,
      project_code TEXT REFERENCES projects(code),
      parent_folder_id TEXT,
      is_folder INTEGER DEFAULT 0,
      web_url TEXT,
      download_url TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // File routings (depends on projects)
    `CREATE TABLE IF NOT EXISTS file_routings (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      file_name TEXT NOT NULL,
      file_type TEXT,
      suggested_path TEXT NOT NULL,
      actual_path TEXT,
      confidence INTEGER DEFAULT 0,
      method TEXT,
      created_at INTEGER
    )`,

    // Communications (depends on projects)
    `CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      type TEXT NOT NULL,
      direction TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT,
      recipient TEXT,
      sender TEXT,
      is_important INTEGER DEFAULT 0,
      communication_date INTEGER NOT NULL,
      tags TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      created_by TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      email_message_id TEXT,
      email_headers TEXT,
      email_html TEXT,
      email_text TEXT,
      auto_imported INTEGER DEFAULT 0,
      ai_suggestions TEXT,
      ai_suggestions_status TEXT,
      ai_tasks_status TEXT,
      ai_deadlines_status TEXT,
      imported_at INTEGER
    )`,

    // Project deadlines (depends on projects)
    `CREATE TABLE IF NOT EXISTS project_deadlines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      due_date INTEGER NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      type TEXT NOT NULL DEFAULT 'general',
      notify_days_before INTEGER DEFAULT 7,
      completed_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Tasks (depends on projects and users)
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      notes TEXT,
      project_id TEXT REFERENCES projects(id),
      assigned_to_id TEXT REFERENCES users(id),
      created_by_id TEXT NOT NULL REFERENCES users(id),
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      due_date INTEGER,
      completed_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Project SAL (depends on projects)
    `CREATE TABLE IF NOT EXISTS project_sal (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      numero INTEGER NOT NULL,
      descrizione TEXT,
      percentuale_avanzamento INTEGER NOT NULL,
      importo_lavori INTEGER DEFAULT 0,
      importo_contabilizzato INTEGER DEFAULT 0,
      data_emissione INTEGER NOT NULL,
      data_approvazione INTEGER,
      stato TEXT NOT NULL DEFAULT 'bozza',
      note TEXT,
      attachments TEXT DEFAULT '[]',
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Project invoices (depends on projects and project_sal)
    `CREATE TABLE IF NOT EXISTS project_invoices (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      sal_id TEXT REFERENCES project_sal(id),
      numero_fattura TEXT NOT NULL,
      data_emissione INTEGER NOT NULL,
      importo_netto INTEGER NOT NULL,
      cassa_previdenziale INTEGER DEFAULT 0,
      importo_iva INTEGER NOT NULL,
      importo_totale INTEGER NOT NULL,
      importo_parcella INTEGER DEFAULT 0,
      aliquota_iva INTEGER DEFAULT 22,
      ritenuta INTEGER DEFAULT 0,
      stato TEXT NOT NULL DEFAULT 'emessa',
      scadenza_pagamento INTEGER,
      data_pagamento INTEGER,
      note TEXT,
      attachment_path TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Project tags
    `CREATE TABLE IF NOT EXISTS project_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      icon TEXT,
      description TEXT,
      created_at INTEGER
    )`,

    // Project tags relation
    `CREATE TABLE IF NOT EXISTS project_tags_relation (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      tag_id TEXT NOT NULL REFERENCES project_tags(id),
      created_at INTEGER
    )`,

    // Project categories
    `CREATE TABLE IF NOT EXISTS project_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#10B981',
      icon TEXT,
      created_at INTEGER
    )`,

    // Project category relation
    `CREATE TABLE IF NOT EXISTS project_category_relation (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
      category_id TEXT NOT NULL REFERENCES project_categories(id),
      created_at INTEGER
    )`,

    // Saved filters
    `CREATE TABLE IF NOT EXISTS saved_filters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      filter_config TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      user_id TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Project budget
    `CREATE TABLE IF NOT EXISTS project_budget (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
      budget_ore_totale INTEGER DEFAULT 0,
      ore_consuntivate INTEGER DEFAULT 0,
      costi_consulenze INTEGER DEFAULT 0,
      costi_rilievi INTEGER DEFAULT 0,
      altri_costi INTEGER DEFAULT 0,
      costi_totali INTEGER DEFAULT 0,
      ricavi_previsti INTEGER DEFAULT 0,
      ricavi_effettivi INTEGER DEFAULT 0,
      note TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Project resources
    `CREATE TABLE IF NOT EXISTS project_resources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_name TEXT NOT NULL,
      user_email TEXT,
      role TEXT NOT NULL,
      ore_assegnate INTEGER DEFAULT 0,
      ore_lavorate INTEGER DEFAULT 0,
      costo_orario INTEGER DEFAULT 0,
      is_responsabile INTEGER DEFAULT 0,
      data_inizio INTEGER,
      data_fine INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )`,

    // Project changelog
    `CREATE TABLE IF NOT EXISTS project_changelog (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      action TEXT NOT NULL,
      field TEXT,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      user_id TEXT,
      user_name TEXT,
      created_at INTEGER
    )`,
  ];

  for (const statement of createTableStatements) {
    try {
      await client.execute(statement);
    } catch (error: any) {
      // Ignore "table already exists" errors
      if (!error.message?.includes('already exists')) {
        console.error('Error creating table:', error.message);
        throw error;
      }
    }
  }

  console.log('✅ Turso database schema initialized');
}
