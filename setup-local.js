// Setup script for local development - fixes database connection issues
const fs = require('fs');
const path = require('path');

console.log('🔧 Configurazione ambiente locale...');

// Create local storage.ts that doesn't use WebSocket
const localStorageContent = `import { type Project, type InsertProject, type Client, type InsertClient, type FileRouting, type InsertFileRouting, type SystemConfig, type InsertSystemConfig } from "@shared/schema";
import { projects, clients, fileRoutings, systemConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

// Local PostgreSQL configuration (no WebSocket)
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

export interface IStorage {
  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjectByCode(code: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Clients
  getClient(id: string): Promise<Client | undefined>;
  getClientBySigla(sigla: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // File Routings
  getFileRouting(id: string): Promise<FileRouting | undefined>;
  getFileRoutingsByProject(projectId: string): Promise<FileRouting[]>;
  createFileRouting(routing: InsertFileRouting): Promise<FileRouting>;
  
  // System Config
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(key: string, value: any): Promise<SystemConfig>;
  
  // Bulk operations
  exportAllData(): Promise<{ projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[] }>;
  importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[] }): Promise<void>;
  clearAllData(): Promise<void>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project> = new Map();
  private clients: Map<string, Client> = new Map();
  private fileRoutings: Map<string, FileRouting> = new Map();
  private systemConfig: Map<string, SystemConfig> = new Map();

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    return Array.from(this.projects.values()).find(p => p.code === code);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      createdAt: new Date(),
      fsRoot: insertProject.fsRoot || null,
      metadata: insertProject.metadata || {},
    };
    this.projects.set(id, project);
    
    // Update client projects count
    const clientSigla = this.generateSafeAcronym(insertProject.client);
    const existingClient = Array.from(this.clients.values()).find(c => c.sigla === clientSigla);
    if (existingClient) {
      existingClient.projectsCount = (existingClient.projectsCount || 0) + 1;
    } else {
      // Create new client
      await this.createClient({
        sigla: clientSigla,
        name: insertProject.client,
        city: insertProject.city,
        projectsCount: 1,
      });
    }
    
    return project;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated: Project = { ...existing, ...updateData };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientBySigla(sigla: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(c => c.sigla === sigla);
  }

  async getAllClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = {
      ...insertClient,
      id,
      city: insertClient.city || null,
      projectsCount: insertClient.projectsCount || 0,
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing) return undefined;
    
    const updated: Client = { ...existing, ...updateData };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // File Routings
  async getFileRouting(id: string): Promise<FileRouting | undefined> {
    return this.fileRoutings.get(id);
  }

  async getFileRoutingsByProject(projectId: string): Promise<FileRouting[]> {
    return Array.from(this.fileRoutings.values()).filter(fr => fr.projectId === projectId);
  }

  async createFileRouting(insertRouting: InsertFileRouting): Promise<FileRouting> {
    const id = randomUUID();
    const routing: FileRouting = {
      ...insertRouting,
      id,
      createdAt: new Date(),
      projectId: insertRouting.projectId || null,
      fileType: insertRouting.fileType || null,
      actualPath: insertRouting.actualPath || null,
      confidence: insertRouting.confidence || 0,
      method: insertRouting.method || null,
    };
    this.fileRoutings.set(id, routing);
    return routing;
  }

  // System Config
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    return Array.from(this.systemConfig.values()).find(sc => sc.key === key);
  }

  async setSystemConfig(key: string, value: any): Promise<SystemConfig> {
    const existing = Array.from(this.systemConfig.values()).find(sc => sc.key === key);
    
    if (existing) {
      existing.value = value;
      existing.updatedAt = new Date();
      return existing;
    } else {
      const id = randomUUID();
      const config: SystemConfig = {
        id,
        key,
        value,
        updatedAt: new Date(),
      };
      this.systemConfig.set(id, config);
      return config;
    }
  }

  // Bulk operations
  async exportAllData() {
    return {
      projects: Array.from(this.projects.values()),
      clients: Array.from(this.clients.values()),
      fileRoutings: Array.from(this.fileRoutings.values()),
      systemConfig: Array.from(this.systemConfig.values()),
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[] }) {
    this.projects.clear();
    this.clients.clear();
    this.fileRoutings.clear();
    this.systemConfig.clear();

    data.projects.forEach(p => this.projects.set(p.id, p));
    data.clients.forEach(c => this.clients.set(c.id, c));
    data.fileRoutings.forEach(fr => this.fileRoutings.set(fr.id, fr));
    data.systemConfig.forEach(sc => this.systemConfig.set(sc.id, sc));
  }

  async clearAllData() {
    this.projects.clear();
    this.clients.clear();
    this.fileRoutings.clear();
    this.systemConfig.clear();
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }
}

// DatabaseStorage implementation with local PostgreSQL
export class DatabaseStorage implements IStorage {
  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      await db.select().from(projects).limit(1);
      return true;
    } catch (error) {
      console.error('🔥 Database connection test failed:', error);
      return false;
    }
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      return project || undefined;
    } catch (error) {
      console.error('❌ Error getting project:', error);
      throw error;
    }
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.code, code));
    return project || undefined;
  }

  async getAllProjects(): Promise<Project[]> {
    try {
      return await db.select().from(projects);
    } catch (error) {
      console.error('❌ Error getting all projects:', error);
      throw error;
    }
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({
        ...insertProject,
        fsRoot: insertProject.fsRoot || null,
        metadata: insertProject.metadata || {},
      })
      .returning();
    
    // Update client projects count
    const clientSigla = this.generateSafeAcronym(insertProject.client);
    const existingClient = await this.getClientBySigla(clientSigla);
    
    if (existingClient) {
      await db
        .update(clients)
        .set({ projectsCount: (existingClient.projectsCount || 0) + 1 })
        .where(eq(clients.id, existingClient.id));
    } else {
      // Create new client
      await this.createClient({
        sigla: clientSigla,
        name: insertProject.client,
        city: insertProject.city,
        projectsCount: 1,
      });
    }
    
    return project;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientBySigla(sigla: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.sigla, sigla));
    return client || undefined;
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values({
        ...insertClient,
        city: insertClient.city || null,
        projectsCount: insertClient.projectsCount || 0,
      })
      .returning();
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return result.rowCount > 0;
  }

  // File Routings
  async getFileRouting(id: string): Promise<FileRouting | undefined> {
    const [routing] = await db.select().from(fileRoutings).where(eq(fileRoutings.id, id));
    return routing || undefined;
  }

  async getFileRoutingsByProject(projectId: string): Promise<FileRouting[]> {
    return await db.select().from(fileRoutings).where(eq(fileRoutings.projectId, projectId));
  }

  async createFileRouting(insertRouting: InsertFileRouting): Promise<FileRouting> {
    const [routing] = await db
      .insert(fileRoutings)
      .values({
        ...insertRouting,
        projectId: insertRouting.projectId || null,
        fileType: insertRouting.fileType || null,
        actualPath: insertRouting.actualPath || null,
        confidence: insertRouting.confidence || 0,
        method: insertRouting.method || null,
      })
      .returning();
    return routing;
  }

  // System Config
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return config || undefined;
  }

  async setSystemConfig(key: string, value: any): Promise<SystemConfig> {
    const existing = await this.getSystemConfig(key);
    
    if (existing) {
      const [updated] = await db
        .update(systemConfig)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemConfig.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(systemConfig)
        .values({ key, value })
        .returning();
      return created;
    }
  }

  // Bulk operations
  async exportAllData() {
    const [projectsData, clientsData, fileRoutingsData, systemConfigData] = await Promise.all([
      this.getAllProjects(),
      this.getAllClients(),
      db.select().from(fileRoutings),
      db.select().from(systemConfig),
    ]);

    return {
      projects: projectsData,
      clients: clientsData,
      fileRoutings: fileRoutingsData,
      systemConfig: systemConfigData,
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[] }) {
    await this.clearAllData();

    if (data.clients.length > 0) {
      await db.insert(clients).values(data.clients);
    }
    if (data.projects.length > 0) {
      await db.insert(projects).values(data.projects);
    }
    if (data.fileRoutings.length > 0) {
      await db.insert(fileRoutings).values(data.fileRoutings);
    }
    if (data.systemConfig.length > 0) {
      await db.insert(systemConfig).values(data.systemConfig);
    }
  }

  async clearAllData() {
    await db.delete(fileRoutings);
    await db.delete(projects);
    await db.delete(clients);
    await db.delete(systemConfig);
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }
}

// Use database storage with fallback
console.log('🔍 Storage initialization - DATABASE_URL exists:', !!process.env.DATABASE_URL);

let storage: IStorage;

async function initializeStorage(): Promise<IStorage> {
  if (process.env.DATABASE_URL) {
    const dbStorage = new DatabaseStorage();
    try {
      const isConnected = await dbStorage.testConnection();
      if (isConnected) {
        console.log('✅ Using DatabaseStorage - connection verified');
        return dbStorage;
      } else {
        console.log('❌ Database connection failed, falling back to MemStorage');
        return new MemStorage();
      }
    } catch (error) {
      console.error('❌ Database connection error, falling back to MemStorage:', error);
      return new MemStorage();
    }
  } else {
    console.log('⚠️ Using MemStorage (no DATABASE_URL found)');
    return new MemStorage();
  }
}

// Initialize storage synchronously for immediate use
if (process.env.DATABASE_URL) {
  storage = new DatabaseStorage();
} else {
  storage = new MemStorage();
}

// Test connection asynchronously and replace if needed
initializeStorage().then(initializedStorage => {
  storage = initializedStorage;
}).catch(error => {
  console.error('Storage initialization failed:', error);
  storage = new MemStorage();
});

export { storage };
`;

// Write the local storage file
fs.writeFileSync(path.join(__dirname, 'server', 'storage-local.ts'), localStorageContent);

console.log('✅ File storage-local.ts creato');
console.log('🔧 Setup locale completato!');
console.log('');
console.log('Per usare la versione locale:');
console.log('1. Sostituisci server/storage.ts con server/storage-local.ts');
console.log('2. Installa: npm install pg @types/pg');
console.log('3. Avvia: npm run dev');