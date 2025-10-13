import { type Project, type InsertProject, type Client, type InsertClient, type FileRouting, type InsertFileRouting, type SystemConfig, type InsertSystemConfig, type OneDriveMapping, type InsertOneDriveMapping, type FilesIndex, type InsertFilesIndex, type Communication, type InsertCommunication, type Deadline, type InsertProjectDeadline } from "@shared/schema";
import { projects, clients, fileRoutings, systemConfig, oneDriveMappings, filesIndex, communications, projectDeadlines } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
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
  deleteFileRoutingsByProject(projectId: string): Promise<boolean>;
  
  // System Config
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(key: string, value: any): Promise<SystemConfig>;
  
  // OneDrive Mappings
  getOneDriveMapping(projectCode: string): Promise<OneDriveMapping | undefined>;
  getAllOneDriveMappings(): Promise<OneDriveMapping[]>;
  createOneDriveMapping(mapping: InsertOneDriveMapping): Promise<OneDriveMapping>;
  deleteOneDriveMapping(projectCode: string): Promise<boolean>;
  getOrphanedProjects(): Promise<Project[]>;
  
  // Files Index
  createOrUpdateFileIndex(fileIndex: InsertFilesIndex): Promise<FilesIndex>;
  getFilesIndex(filters: { projectCode?: string; path?: string; limit?: number }): Promise<FilesIndex[]>;
  getFileIndexByDriveItemId(driveItemId: string): Promise<FilesIndex | undefined>;
  updateFileIndex(driveItemId: string, updates: Partial<InsertFilesIndex>): Promise<FilesIndex | undefined>;
  deleteFileIndex(driveItemId: string): Promise<boolean>;

  // Communications
  getAllCommunications(): Promise<Communication[]>;
  getCommunicationsByProject(projectId: string): Promise<Communication[]>;
  getCommunication(id: string): Promise<Communication | undefined>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined>;
  deleteCommunication(id: string): Promise<boolean>;

  // Deadlines
  getAllDeadlines(): Promise<Deadline[]>;
  getDeadlinesByProject(projectId: string): Promise<Deadline[]>;
  getDeadline(id: string): Promise<Deadline | undefined>;
  createDeadline(deadline: InsertProjectDeadline): Promise<Deadline>;
  updateDeadline(id: string, updates: Partial<InsertProjectDeadline>): Promise<Deadline | undefined>;
  deleteDeadline(id: string): Promise<boolean>;

  // Bulk operations
  exportAllData(): Promise<{ projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[], filesIndex: FilesIndex[] }>;
  importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[], filesIndex: FilesIndex[] }): Promise<void>;
  clearAllData(): Promise<void>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project> = new Map();
  private clients: Map<string, Client> = new Map();
  private fileRoutings: Map<string, FileRouting> = new Map();
  private systemConfig: Map<string, SystemConfig> = new Map();
  private oneDriveMappings: Map<string, OneDriveMapping> = new Map();
  private filesIndex: Map<string, FilesIndex> = new Map();
  private communications: Map<string, Communication> = new Map();
  private deadlines: Map<string, Deadline> = new Map();

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
      clientId: insertProject.clientId || null,
      status: insertProject.status || "in_corso",
      tipoRapporto: insertProject.tipoRapporto || "diretto",
      committenteFinale: insertProject.committenteFinale || null,
      createdAt: new Date(),
      fsRoot: insertProject.fsRoot || null,
      metadata: insertProject.metadata || {},
      fatturato: insertProject.fatturato || null,
      numeroFattura: insertProject.numeroFattura || null,
      dataFattura: insertProject.dataFattura || null,
      importoFatturato: insertProject.importoFatturato || null,
      pagato: insertProject.pagato || null,
      dataPagamento: insertProject.dataPagamento || null,
      importoPagato: insertProject.importoPagato || null,
      noteFatturazione: insertProject.noteFatturazione || null,
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
    console.log('⚠️  MemStorage.updateProject called for:', id, '- THIS SHOULD NOT BE USED!');
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

  async deleteFileRoutingsByProject(projectId: string): Promise<boolean> {
    const routings = Array.from(this.fileRoutings.entries()).filter(([_, routing]) => routing.projectId === projectId);
    for (const [id, _] of routings) {
      this.fileRoutings.delete(id);
    }
    return routings.length > 0;
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

  async getOrphanedProjects(): Promise<Project[]> {
    // For MemStorage, find projects that don't have corresponding OneDrive mappings
    const allProjects = Array.from(this.projects.values());
    const allMappings = Array.from(this.oneDriveMappings.values());
    const mappedProjectCodes = new Set(allMappings.map(m => m.projectCode));
    
    return allProjects.filter(project => !mappedProjectCodes.has(project.code));
  }

  // Files Index
  async createOrUpdateFileIndex(insertFileIndex: InsertFilesIndex): Promise<FilesIndex> {
    const existing = this.filesIndex.get(insertFileIndex.driveItemId);
    
    if (existing) {
      // Update existing
      const updated: FilesIndex = {
        ...existing,
        ...insertFileIndex,
        updatedAt: new Date(),
      };
      this.filesIndex.set(insertFileIndex.driveItemId, updated);
      return updated;
    } else {
      // Create new
      const id = randomUUID();
      const fileIndex: FilesIndex = {
        ...insertFileIndex,
        id,
        projectCode: insertFileIndex.projectCode || null,
        size: insertFileIndex.size || 0,
        mimeType: insertFileIndex.mimeType || null,
        lastModified: insertFileIndex.lastModified || null,
        parentFolderId: insertFileIndex.parentFolderId || null,
        isFolder: insertFileIndex.isFolder || false,
        webUrl: insertFileIndex.webUrl || null,
        downloadUrl: insertFileIndex.downloadUrl || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.filesIndex.set(insertFileIndex.driveItemId, fileIndex);
      return fileIndex;
    }
  }

  async getFilesIndex(filters: { projectCode?: string; path?: string; limit?: number }): Promise<FilesIndex[]> {
    let results = Array.from(this.filesIndex.values());
    
    if (filters.projectCode) {
      results = results.filter(f => f.projectCode === filters.projectCode);
    }
    
    if (filters.path) {
      results = results.filter(f => f.path?.includes(filters.path!));
    }
    
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  async updateFileIndex(driveItemId: string, updates: Partial<InsertFilesIndex>): Promise<FilesIndex | undefined> {
    const existing = this.filesIndex.get(driveItemId);
    if (!existing) return undefined;
    
    const updated: FilesIndex = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.filesIndex.set(driveItemId, updated);
    return updated;
  }

  async getFileIndexByDriveItemId(driveItemId: string): Promise<FilesIndex | undefined> {
    return this.filesIndex.get(driveItemId);
  }

  async deleteFileIndex(driveItemId: string): Promise<boolean> {
    return this.filesIndex.delete(driveItemId);
  }

  // Bulk operations
  async exportAllData() {
    return {
      projects: Array.from(this.projects.values()),
      clients: Array.from(this.clients.values()),
      fileRoutings: Array.from(this.fileRoutings.values()),
      systemConfig: Array.from(this.systemConfig.values()),
      oneDriveMappings: Array.from(this.oneDriveMappings.values()),
      filesIndex: Array.from(this.filesIndex.values()),
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[], filesIndex: FilesIndex[] }) {
    this.projects.clear();
    this.clients.clear();
    this.fileRoutings.clear();
    this.systemConfig.clear();
    this.oneDriveMappings.clear();
    this.filesIndex.clear();

    data.projects.forEach(p => this.projects.set(p.id, p));
    data.clients.forEach(c => this.clients.set(c.id, c));
    data.fileRoutings.forEach(fr => this.fileRoutings.set(fr.id, fr));
    data.systemConfig.forEach(sc => this.systemConfig.set(sc.id, sc));
    data.oneDriveMappings.forEach(odm => this.oneDriveMappings.set(odm.projectCode, odm));
    if (data.filesIndex) {
      data.filesIndex.forEach(fi => this.filesIndex.set(fi.driveItemId, fi));
    }
  }

  // Communications methods
  async getAllCommunications(): Promise<Communication[]> {
    return Array.from(this.communications.values());
  }

  async getCommunicationsByProject(projectId: string): Promise<Communication[]> {
    return Array.from(this.communications.values()).filter(c => c.projectId === projectId);
  }

  async getCommunication(id: string): Promise<Communication | undefined> {
    return this.communications.get(id);
  }

  async createCommunication(insertCommunication: InsertCommunication): Promise<Communication> {
    const id = randomUUID();
    const communication: Communication = {
      ...insertCommunication,
      id,
      tags: insertCommunication.tags || [],
      attachments: insertCommunication.attachments || [],
      body: insertCommunication.body || null,
      recipient: insertCommunication.recipient || null,
      sender: insertCommunication.sender || null,
      createdBy: insertCommunication.createdBy || null,
      isImportant: insertCommunication.isImportant || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.communications.set(id, communication);
    return communication;
  }

  async updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined> {
    const existing = this.communications.get(id);
    if (!existing) return undefined;

    const updated: Communication = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.communications.set(id, updated);
    return updated;
  }

  async deleteCommunication(id: string): Promise<boolean> {
    return this.communications.delete(id);
  }

  // Deadline methods
  async getAllDeadlines(): Promise<Deadline[]> {
    return Array.from(this.deadlines.values());
  }

  async getDeadlinesByProject(projectId: string): Promise<Deadline[]> {
    return Array.from(this.deadlines.values()).filter(d => d.projectId === projectId);
  }

  async getDeadline(id: string): Promise<Deadline | undefined> {
    return this.deadlines.get(id);
  }

  async createDeadline(insertDeadline: InsertProjectDeadline): Promise<Deadline> {
    const id = randomUUID();
    const deadline: Deadline = {
      ...insertDeadline,
      id,
      type: insertDeadline.type || "general",
      status: insertDeadline.status || "pending",
      description: insertDeadline.description || null,
      priority: insertDeadline.priority || "medium",
      notifyDaysBefore: insertDeadline.notifyDaysBefore || null,
      completedAt: insertDeadline.completedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.deadlines.set(id, deadline);
    return deadline;
  }

  async updateDeadline(id: string, updates: Partial<InsertProjectDeadline>): Promise<Deadline | undefined> {
    const existing = this.deadlines.get(id);
    if (!existing) return undefined;

    const updated: Deadline = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.deadlines.set(id, updated);
    return updated;
  }

  async deleteDeadline(id: string): Promise<boolean> {
    return this.deadlines.delete(id);
  }

  async clearAllData() {
    this.projects.clear();
    this.clients.clear();
    this.fileRoutings.clear();
    this.systemConfig.clear();
    this.oneDriveMappings.clear();
    this.filesIndex.clear();
    this.communications.clear();
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

  async deleteFileRoutingsByProject(projectId: string): Promise<boolean> {
    const result = await db.delete(fileRoutings).where(eq(fileRoutings.projectId, projectId));
    return (result.rowCount || 0) > 0;
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

  async getOrphanedProjects(): Promise<Project[]> {
    // Find projects that don't have corresponding OneDrive mappings
    const orphanedProjects = await db
      .select({ project: projects })
      .from(projects)
      .leftJoin(oneDriveMappings, eq(projects.code, oneDriveMappings.projectCode))
      .where(sql`${oneDriveMappings.projectCode} IS NULL`);
    
    return orphanedProjects.map((row: { project: Project }) => row.project);
  }

  // Files Index
  async createOrUpdateFileIndex(insertFileIndex: InsertFilesIndex): Promise<FilesIndex> {
    // Try to find existing by driveItemId
    const [existing] = await db.select().from(filesIndex).where(eq(filesIndex.driveItemId, insertFileIndex.driveItemId));
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(filesIndex)
        .set({
          ...insertFileIndex,
          updatedAt: new Date(),
        })
        .where(eq(filesIndex.driveItemId, insertFileIndex.driveItemId))
        .returning();
      return updated;
    } else {
      // Create new
      const [fileIndex] = await db
        .insert(filesIndex)
        .values({
          ...insertFileIndex,
          size: insertFileIndex.size || 0,
          mimeType: insertFileIndex.mimeType || null,
          lastModified: insertFileIndex.lastModified || null,
          projectCode: insertFileIndex.projectCode || null,
          parentFolderId: insertFileIndex.parentFolderId || null,
          isFolder: insertFileIndex.isFolder || false,
          webUrl: insertFileIndex.webUrl || null,
          downloadUrl: insertFileIndex.downloadUrl || null,
        })
        .returning();
      return fileIndex;
    }
  }

  async getFilesIndex(filters: { projectCode?: string; path?: string; limit?: number }): Promise<FilesIndex[]> {
    let query = db.select().from(filesIndex);
    
    // Apply filters
    if (filters.projectCode) {
      query = query.where(eq(filesIndex.projectCode, filters.projectCode));
    }
    
    if (filters.path) {
      query = query.where(sql`${filesIndex.path} LIKE ${`%${filters.path}%`}`);
    }
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  async getFileIndexByDriveItemId(driveItemId: string): Promise<FilesIndex | undefined> {
    const [result] = await db.select().from(filesIndex).where(eq(filesIndex.driveItemId, driveItemId)).limit(1);
    return result || undefined;
  }

  async updateFileIndex(driveItemId: string, updates: Partial<InsertFilesIndex>): Promise<FilesIndex | undefined> {
    const [updated] = await db
      .update(filesIndex)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(filesIndex.driveItemId, driveItemId))
      .returning();
    return updated || undefined;
  }

  async deleteFileIndex(driveItemId: string): Promise<boolean> {
    const result = await db.delete(filesIndex).where(eq(filesIndex.driveItemId, driveItemId));
    return (result.rowCount || 0) > 0;
  }

  // Communications methods
  async getAllCommunications(): Promise<Communication[]> {
    return await db.select().from(communications);
  }

  async getCommunicationsByProject(projectId: string): Promise<Communication[]> {
    return await db.select().from(communications).where(eq(communications.projectId, projectId));
  }

  async getCommunication(id: string): Promise<Communication | undefined> {
    const [communication] = await db.select().from(communications).where(eq(communications.id, id));
    return communication || undefined;
  }

  async createCommunication(insertCommunication: InsertCommunication): Promise<Communication> {
    const [communication] = await db.insert(communications).values(insertCommunication).returning();
    return communication;
  }

  async updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined> {
    const [updated] = await db
      .update(communications)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(communications.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCommunication(id: string): Promise<boolean> {
    const result = await db.delete(communications).where(eq(communications.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Deadline methods
  async getAllDeadlines(): Promise<Deadline[]> {
    return await db.select().from(projectDeadlines);
  }

  async getDeadlinesByProject(projectId: string): Promise<Deadline[]> {
    return await db.select().from(projectDeadlines).where(eq(projectDeadlines.projectId, projectId));
  }

  async getDeadline(id: string): Promise<Deadline | undefined> {
    const [deadline] = await db.select().from(projectDeadlines).where(eq(projectDeadlines.id, id));
    return deadline || undefined;
  }

  async createDeadline(insertDeadline: InsertProjectDeadline): Promise<Deadline> {
    const [deadline] = await db.insert(projectDeadlines).values(insertDeadline).returning();
    return deadline;
  }

  async updateDeadline(id: string, updates: Partial<InsertProjectDeadline>): Promise<Deadline | undefined> {
    const [updated] = await db
      .update(projectDeadlines)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(projectDeadlines.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDeadline(id: string): Promise<boolean> {
    const result = await db.delete(projectDeadlines).where(eq(projectDeadlines.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Bulk operations
  async exportAllData() {
    const [projectsData, clientsData, fileRoutingsData, systemConfigData, oneDriveMappingsData, filesIndexData] = await Promise.all([
      this.getAllProjects(),
      this.getAllClients(),
      db.select().from(fileRoutings),
      db.select().from(systemConfig),
      db.select().from(oneDriveMappings),
      db.select().from(filesIndex),
    ]);

    return {
      projects: projectsData,
      clients: clientsData,
      fileRoutings: fileRoutingsData,
      systemConfig: systemConfigData,
      oneDriveMappings: oneDriveMappingsData,
      filesIndex: filesIndexData,
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[], filesIndex: FilesIndex[] }) {
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
    if (data.filesIndex && data.filesIndex.length > 0) {
      await db.insert(filesIndex).values(data.filesIndex);
    }
  }

  async clearAllData() {
    await db.delete(filesIndex);
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
        console.log('💾 Database connection failed, using FileStorage for permanent data persistence');
        try {
          const { storage: fileStorage } = await import('./storage-local.js');
          return fileStorage;
        } catch (fileError) {
          console.error('❌ FileStorage also failed, using MemStorage as last resort:', fileError);
          return new MemStorage();
        }
      }
    } catch (error) {
      console.error('💾 Database connection error, using FileStorage for permanent data persistence:', error);
      try {
        const { storage: fileStorage } = await import('./storage-local.js');
        return fileStorage;
      } catch (fileError) {
        console.error('❌ FileStorage also failed, using MemStorage as last resort:', fileError);
        return new MemStorage();
      }
    }
  }
}

// Create a fallback-aware storage wrapper
class FallbackStorage implements IStorage {
  private currentStorage: IStorage;
  private fallbackStorage: IStorage;

  constructor() {
    this.currentStorage = new MemStorage();
    this.fallbackStorage = new MemStorage();
  }

  setStorage(storage: IStorage) {
    this.currentStorage = storage;
  }

  private async executeWithFallback<T>(operation: (storage: IStorage) => Promise<T>): Promise<T> {
    try {
      return await operation(this.currentStorage);
    } catch (error: any) {
      // Check if it's a database connection error
      if (error?.code === 'XX000' || error?.message?.includes('endpoint has been disabled') || error?.message?.includes('database')) {
        console.warn('⚠️ Database operation failed, falling back to MemStorage:', error.message);
        
        // Switch to fallback storage permanently
        this.currentStorage = this.fallbackStorage;
        
        return await operation(this.fallbackStorage);
      }
      throw error;
    }
  }

  // Forward all methods with fallback support
  async getProject(id: string): Promise<Project | undefined> {
    return this.executeWithFallback(storage => storage.getProject(id));
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    return this.executeWithFallback(storage => storage.getProjectByCode(code));
  }

  async getAllProjects(): Promise<Project[]> {
    return this.executeWithFallback(storage => storage.getAllProjects());
  }

  async createProject(project: InsertProject): Promise<Project> {
    return this.executeWithFallback(storage => storage.createProject(project));
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined> {
    return this.executeWithFallback(storage => storage.updateProject(id, project));
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteProject(id));
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.executeWithFallback(storage => storage.getClient(id));
  }

  async getClientBySigla(sigla: string): Promise<Client | undefined> {
    return this.executeWithFallback(storage => storage.getClientBySigla(sigla));
  }

  async getAllClients(): Promise<Client[]> {
    return this.executeWithFallback(storage => storage.getAllClients());
  }

  async createClient(client: InsertClient): Promise<Client> {
    return this.executeWithFallback(storage => storage.createClient(client));
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    return this.executeWithFallback(storage => storage.updateClient(id, client));
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteClient(id));
  }

  async getFileRouting(id: string): Promise<FileRouting | undefined> {
    return this.executeWithFallback(storage => storage.getFileRouting(id));
  }

  async getFileRoutingsByProject(projectId: string): Promise<FileRouting[]> {
    return this.executeWithFallback(storage => storage.getFileRoutingsByProject(projectId));
  }

  async createFileRouting(routing: InsertFileRouting): Promise<FileRouting> {
    return this.executeWithFallback(storage => storage.createFileRouting(routing));
  }

  async deleteFileRoutingsByProject(projectId: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteFileRoutingsByProject(projectId));
  }

  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    return this.executeWithFallback(storage => storage.getSystemConfig(key));
  }

  async setSystemConfig(key: string, value: any): Promise<SystemConfig> {
    return this.executeWithFallback(storage => storage.setSystemConfig(key, value));
  }

  async getOneDriveMapping(projectCode: string): Promise<OneDriveMapping | undefined> {
    return this.executeWithFallback(storage => storage.getOneDriveMapping(projectCode));
  }

  async getAllOneDriveMappings(): Promise<OneDriveMapping[]> {
    return this.executeWithFallback(storage => storage.getAllOneDriveMappings());
  }

  async createOneDriveMapping(mapping: InsertOneDriveMapping): Promise<OneDriveMapping> {
    return this.executeWithFallback(storage => storage.createOneDriveMapping(mapping));
  }

  async deleteOneDriveMapping(projectCode: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteOneDriveMapping(projectCode));
  }

  async getOrphanedProjects(): Promise<Project[]> {
    return this.executeWithFallback(storage => storage.getOrphanedProjects());
  }

  async createOrUpdateFileIndex(fileIndex: InsertFilesIndex): Promise<FilesIndex> {
    return this.executeWithFallback(storage => storage.createOrUpdateFileIndex(fileIndex));
  }

  async getFilesIndex(filters: { projectCode?: string; path?: string; limit?: number }): Promise<FilesIndex[]> {
    return this.executeWithFallback(storage => storage.getFilesIndex(filters));
  }

  async updateFileIndex(driveItemId: string, updates: Partial<InsertFilesIndex>): Promise<FilesIndex | undefined> {
    return this.executeWithFallback(storage => storage.updateFileIndex(driveItemId, updates));
  }

  async deleteFileIndex(driveItemId: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteFileIndex(driveItemId));
  }

  async getFileIndexByDriveItemId(driveItemId: string): Promise<FilesIndex | undefined> {
    return this.executeWithFallback(storage => storage.getFileIndexByDriveItemId(driveItemId));
  }

  // Communications methods
  async getAllCommunications(): Promise<Communication[]> {
    return this.executeWithFallback(storage => storage.getAllCommunications());
  }

  async getCommunicationsByProject(projectId: string): Promise<Communication[]> {
    return this.executeWithFallback(storage => storage.getCommunicationsByProject(projectId));
  }

  async getCommunication(id: string): Promise<Communication | undefined> {
    return this.executeWithFallback(storage => storage.getCommunication(id));
  }

  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    return this.executeWithFallback(storage => storage.createCommunication(communication));
  }

  async updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined> {
    return this.executeWithFallback(storage => storage.updateCommunication(id, updates));
  }

  async deleteCommunication(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteCommunication(id));
  }

  // Deadline methods
  async getAllDeadlines(): Promise<Deadline[]> {
    return this.executeWithFallback(storage => storage.getAllDeadlines());
  }

  async getDeadlinesByProject(projectId: string): Promise<Deadline[]> {
    return this.executeWithFallback(storage => storage.getDeadlinesByProject(projectId));
  }

  async getDeadline(id: string): Promise<Deadline | undefined> {
    return this.executeWithFallback(storage => storage.getDeadline(id));
  }

  async createDeadline(deadline: InsertProjectDeadline): Promise<Deadline> {
    return this.executeWithFallback(storage => storage.createDeadline(deadline));
  }

  async updateDeadline(id: string, updates: Partial<InsertProjectDeadline>): Promise<Deadline | undefined> {
    return this.executeWithFallback(storage => storage.updateDeadline(id, updates));
  }

  async deleteDeadline(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteDeadline(id));
  }

  async exportAllData(): Promise<{ projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[], filesIndex: FilesIndex[] }> {
    return this.executeWithFallback(storage => storage.exportAllData());
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[], filesIndex: FilesIndex[] }): Promise<void> {
    return this.executeWithFallback(storage => storage.importAllData(data));
  }

  async clearAllData(): Promise<void> {
    return this.executeWithFallback(storage => storage.clearAllData());
  }
}

// Initialize storage synchronously to avoid race conditions
let storage: IStorage;
const storagePromise = initializeStorage().then(initializedStorage => {
  storage = initializedStorage;
  console.log('💾 Storage initialized successfully');
  return initializedStorage;
}).catch(error => {
  console.error('❌ Storage initialization failed, using MemStorage:', error);
  storage = new MemStorage();
  return storage;
});

// Export a proxy that waits for initialization
export { storage, storagePromise };
