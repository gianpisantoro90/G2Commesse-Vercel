import { drizzle } from 'drizzle-orm/neon-serverless';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { projects, oneDriveMappings } from '../shared/schema';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL not found in environment variables');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function importRemainingProjects() {
  console.log('🚀 Importing remaining 13 projects...\n');

  try {
    // Load data from files
    const projectsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'projects.json'), 'utf-8'));
    const mappingsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'onedrive-mappings.json'), 'utf-8'));

    // Use the existing GDF client ID
    const gdfClientId = 'e19c3136-9566-4486-bd10-862a740edb86';

    // Filter projects that need to be imported (Guardia di Finanza without RETLA)
    const remainingProjects = projectsData.filter((p: any) => 
      p.client === 'Guardia di Finanza' && !p.client.includes('RETLA')
    );

    console.log(`📦 Found ${remainingProjects.length} projects to import`);

    let successCount = 0;
    let errorCount = 0;

    for (const project of remainingProjects) {
      try {
        await db.insert(projects).values({
          id: project.id,
          code: project.code,
          client: project.client,
          clientId: gdfClientId, // Use existing GDF client
          city: project.city || '',
          object: project.object || project.description || '',
          year: project.year,
          template: project.template || 'LUNGO',
          status: project.status || 'in_corso',
          tipoRapporto: project.tipoRapporto || 'diretto',
          committenteFinale: project.committenteFinale || null,
          fsRoot: project.fsRoot || null,
          metadata: project.metadata || {},
        }).onConflictDoNothing();

        // Import corresponding OneDrive mapping
        const mapping = mappingsData.find((m: any) => m.projectCode === project.code);
        if (mapping) {
          await db.insert(oneDriveMappings).values({
            id: mapping.id,
            projectCode: mapping.projectCode,
            oneDriveFolderId: mapping.oneDriveFolderId || '',
            oneDriveFolderName: mapping.oneDriveFolderName,
            oneDriveFolderPath: mapping.oneDriveFolderPath,
            updatedAt: mapping.updatedAt ? new Date(mapping.updatedAt) : new Date(),
          }).onConflictDoNothing();
        }

        console.log(`✅ Imported ${project.code}`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Error importing ${project.code}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Import completed!`);
    console.log(`   Success: ${successCount}/${remainingProjects.length}`);
    console.log(`   Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

importRemainingProjects().catch(console.error);
