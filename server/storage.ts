import { type Project, type InsertProject, type Client, type InsertClient, type FileRouting, type InsertFileRouting, type SystemConfig, type InsertSystemConfig, type OneDriveMapping, type InsertOneDriveMapping } from "@shared/schema";
import { projects, clients, fileRoutings, systemConfig, oneDriveMappings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Use serverless database for now (local fix will be in exported version)
import { db } from "./db";

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
  
  // OneDrive Mappings
  getOneDriveMapping(projectCode: string): Promise<OneDriveMapping | undefined>;
  getAllOneDriveMappings(): Promise<OneDriveMapping[]>;
  createOneDriveMapping(mapping: InsertOneDriveMapping): Promise<OneDriveMapping>;
  deleteOneDriveMapping(projectCode: string): Promise<boolean>;
  
  // Bulk operations
  exportAllData(): Promise<{ projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[] }>;
  importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[] }): Promise<void>;
  clearAllData(): Promise<void>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project> = new Map();
  private clients: Map<string, Client> = new Map();
  private fileRoutings: Map<string, FileRouting> = new Map();
  private systemConfig: Map<string, SystemConfig> = new Map();
  private oneDriveMappings: Map<string, OneDriveMapping> = new Map();

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
      status: insertProject.status || "in_corso",
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
    const project = this.projects.get(id);
    if (!project) return false;
    
    this.projects.delete(id);
    
    // Update client projects count
    const clientSigla = this.generateSafeAcronym(project.client);
    const client = Array.from(this.clients.values()).find(c => c.sigla === clientSigla);
    if (client && (client.projectsCount || 0) > 0) {
      client.projectsCount = (client.projectsCount || 0) - 1;
    }
    
    return true;
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

  // OneDrive Mappings
  async getOneDriveMapping(projectCode: string): Promise<OneDriveMapping | undefined> {
    return this.oneDriveMappings.get(projectCode);
  }

  async getAllOneDriveMappings(): Promise<OneDriveMapping[]> {
    return Array.from(this.oneDriveMappings.values());
  }

  async createOneDriveMapping(insertMapping: InsertOneDriveMapping): Promise<OneDriveMapping> {
    const id = randomUUID();
    const mapping: OneDriveMapping = {
      ...insertMapping,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.oneDriveMappings.set(insertMapping.projectCode, mapping);
    return mapping;
  }

  async deleteOneDriveMapping(projectCode: string): Promise<boolean> {
    return this.oneDriveMappings.delete(projectCode);
  }

  // Bulk operations
  async exportAllData() {
    return {
      projects: Array.from(this.projects.values()),
      clients: Array.from(this.clients.values()),
      fileRoutings: Array.from(this.fileRoutings.values()),
      systemConfig: Array.from(this.systemConfig.values()),
      oneDriveMappings: Array.from(this.oneDriveMappings.values()),
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[] }) {
    this.projects.clear();
    this.clients.clear();
    this.fileRoutings.clear();
    this.systemConfig.clear();
    this.oneDriveMappings.clear();

    data.projects.forEach(p => this.projects.set(p.id, p));
    data.clients.forEach(c => this.clients.set(c.id, c));
    data.fileRoutings.forEach(fr => this.fileRoutings.set(fr.id, fr));
    data.systemConfig.forEach(sc => this.systemConfig.set(sc.id, sc));
    data.oneDriveMappings.forEach(odm => this.oneDriveMappings.set(odm.projectCode, odm));
  }

  async clearAllData() {
    this.projects.clear();
    this.clients.clear();
    this.fileRoutings.clear();
    this.systemConfig.clear();
    this.oneDriveMappings.clear();
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }
}

// DatabaseStorage implementation
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
    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const project = await this.getProject(id);
    if (!project) return false;
    
    await db.delete(projects).where(eq(projects.id, id));
    
    // Update client projects count
    const clientSigla = this.generateSafeAcronym(project.client);
    const client = await this.getClientBySigla(clientSigla);
    if (client && (client.projectsCount || 0) > 0) {
      await db
        .update(clients)
        .set({ projectsCount: (client.projectsCount || 0) - 1 })
        .where(eq(clients.id, client.id));
    }
    
    return true;
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
    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return (result.rowCount || 0) > 0;
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

  // OneDrive Mappings
  async getOneDriveMapping(projectCode: string): Promise<OneDriveMapping | undefined> {
    const [mapping] = await db.select().from(oneDriveMappings).where(eq(oneDriveMappings.projectCode, projectCode));
    return mapping || undefined;
  }

  async getAllOneDriveMappings(): Promise<OneDriveMapping[]> {
    return await db.select().from(oneDriveMappings);
  }

  async createOneDriveMapping(insertMapping: InsertOneDriveMapping): Promise<OneDriveMapping> {
    const [mapping] = await db.insert(oneDriveMappings).values(insertMapping).returning();
    return mapping;
  }

  async deleteOneDriveMapping(projectCode: string): Promise<boolean> {
    const result = await db.delete(oneDriveMappings).where(eq(oneDriveMappings.projectCode, projectCode));
    return result.rowCount > 0;
  }

  // Bulk operations
  async exportAllData() {
    const [projectsData, clientsData, fileRoutingsData, systemConfigData, oneDriveMappingsData] = await Promise.all([
      this.getAllProjects(),
      this.getAllClients(),
      db.select().from(fileRoutings),
      db.select().from(systemConfig),
      db.select().from(oneDriveMappings),
    ]);

    return {
      projects: projectsData,
      clients: clientsData,
      fileRoutings: fileRoutingsData,
      systemConfig: systemConfigData,
      oneDriveMappings: oneDriveMappingsData,
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[] }) {
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
    if (data.oneDriveMappings && data.oneDriveMappings.length > 0) {
      await db.insert(oneDriveMappings).values(data.oneDriveMappings);
    }
  }

  async clearAllData() {
    await db.delete(fileRoutings);
    await db.delete(oneDriveMappings);
    await db.delete(projects);
    await db.delete(clients);
    await db.delete(systemConfig);
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }
}

// Use database storage in production, file storage for local development
console.log('🔍 Storage initialization - DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('🔍 Environment NODE_ENV:', process.env.NODE_ENV);

let storage: IStorage;

async function initializeStorage(): Promise<IStorage> {
  // Check if running locally - PRIORITIZE NODE_ENV=local
  const isLocal = process.env.NODE_ENV === 'local' || (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production');
  
  if (isLocal) {
    console.log('📁 Using FileStorage for local development with persistence');
    console.log('📁 Data will be saved in:', process.cwd() + '/data');
    // Import FileStorage for local development
    try {
      const { storage: fileStorage } = await import('./storage-local.js');
      return fileStorage;
    } catch (error) {
      console.error('❌ Failed to load FileStorage, falling back to MemStorage:', error);
      return new MemStorage();
    }
  } else {
    // Use database storage for production
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
  }
}

// Initialize storage with proper fallback
storage = new MemStorage();

// Test connection asynchronously and replace if needed
initializeStorage().then(initializedStorage => {
  storage = initializedStorage;
  console.log('💾 Storage initialized successfully');
}).catch(error => {
  console.error('❌ Storage initialization failed, using MemStorage:', error);
  storage = new MemStorage();
});

export { storage };
