import { drizzle } from 'drizzle-orm/neon-serverless';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { projects, clients, oneDriveMappings, fileRoutings } from '../shared/schema';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL not found in environment variables');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

interface FileStorageData {
  projects?: any[];
  clients?: any[];
  onedriveMappings?: any[];
  fileRoutings?: any[];
}

async function loadFileStorageData(): Promise<FileStorageData> {
  const dataDir = path.join(process.cwd(), 'data');
  const data: FileStorageData = {};

  const files = [
    'projects.json',
    'clients.json',
    'onedrive-mappings.json',
    'file-routings.json'
  ];

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const key = file.replace('.json', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        data[key as keyof FileStorageData] = Array.isArray(parsed) ? parsed : [];
        console.log(`✅ Loaded ${data[key as keyof FileStorageData]?.length || 0} records from ${file}`);
      } catch (error) {
        console.warn(`⚠️  Could not load ${file}:`, error);
        const key = file.replace('.json', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        data[key as keyof FileStorageData] = [];
      }
    }
  }

  return data;
}

async function migrateData() {
  console.log('🚀 Starting data migration from FileStorage to PostgreSQL...\n');

  try {
    const data = await loadFileStorageData();

    // Migrate clients first (projects reference clients)
    if (data.clients && data.clients.length > 0) {
      console.log(`\n📦 Migrating ${data.clients.length} clients...`);
      for (const client of data.clients) {
        try {
          await db.insert(clients).values({
            id: client.id,
            sigla: client.sigla,
            name: client.name,
            projectCount: client.projectCount || 0,
            createdAt: client.createdAt ? new Date(client.createdAt) : new Date(),
          }).onConflictDoNothing();
        } catch (error: any) {
          console.warn(`  ⚠️  Error migrating client ${client.sigla}:`, error.message);
        }
      }
      console.log(`✅ Clients migration complete`);
    }

    // Migrate projects
    if (data.projects && data.projects.length > 0) {
      console.log(`\n📦 Migrating ${data.projects.length} projects...`);
      for (const project of data.projects) {
        try {
          // Find clientId from sigla if possible
          const clientRecord = data.clients?.find(c => c.name === project.client || c.sigla === project.client);
          
          await db.insert(projects).values({
            id: project.id,
            code: project.code,
            client: project.client,
            clientId: clientRecord?.id || null,
            city: project.city || '',
            object: project.object || project.description || '',
            year: project.year,
            template: project.template || 'LUNGO',
            status: project.status || 'in_corso',
            tipoRapporto: project.tipoRapporto || 'diretto',
            committenteFinale: project.committenteFinale || null,
            fsRoot: project.fsRoot || null,
            metadata: project.metadata || {},
            createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
          }).onConflictDoNothing();
        } catch (error: any) {
          console.warn(`  ⚠️  Error migrating project ${project.code}:`, error.message);
        }
      }
      console.log(`✅ Projects migration complete`);
    }

    // Migrate OneDrive mappings
    if (data.onedriveMappings && data.onedriveMappings.length > 0) {
      console.log(`\n📦 Migrating ${data.onedriveMappings.length} OneDrive mappings...`);
      for (const mapping of data.onedriveMappings) {
        try {
          await db.insert(oneDriveMappings).values({
            id: mapping.id,
            projectCode: mapping.projectCode,
            oneDriveFolderId: mapping.oneDriveFolderId || mapping.onedriveFolderId || '',
            oneDriveFolderName: mapping.oneDriveFolderName || mapping.onedriveFolderName,
            oneDriveFolderPath: mapping.oneDriveFolderPath || mapping.onedriveFolderPath,
            createdAt: mapping.createdAt ? new Date(mapping.createdAt) : new Date(),
            updatedAt: mapping.updatedAt ? new Date(mapping.updatedAt) : new Date(),
          }).onConflictDoNothing();
        } catch (error: any) {
          console.warn(`  ⚠️  Error migrating OneDrive mapping ${mapping.projectCode}:`, error.message);
        }
      }
      console.log(`✅ OneDrive mappings migration complete`);
    }

    // Migrate file routings
    if (data.fileRoutings && data.fileRoutings.length > 0) {
      console.log(`\n📦 Migrating ${data.fileRoutings.length} file routings...`);
      for (const routing of data.fileRoutings) {
        try {
          await db.insert(fileRoutings).values({
            id: routing.id,
            projectId: routing.projectId,
            fileName: routing.fileName,
            fileType: routing.fileType || null,
            fileSize: routing.fileSize || null,
            suggestedFolder: routing.suggestedFolder,
            confidence: routing.confidence,
            reasoning: routing.reasoning || null,
            method: routing.method,
            accepted: routing.accepted || false,
            createdAt: routing.createdAt ? new Date(routing.createdAt) : new Date(),
          }).onConflictDoNothing();
        } catch (error: any) {
          console.warn(`  ⚠️  Error migrating file routing:`, error.message);
        }
      }
      console.log(`✅ File routings migration complete`);
    }


    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Clients: ${data.clients?.length || 0}`);
    console.log(`   Projects: ${data.projects?.length || 0}`);
    console.log(`   OneDrive Mappings: ${data.onedriveMappings?.length || 0}`);
    console.log(`   File Routings: ${data.fileRoutings?.length || 0}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateData().catch(console.error);
