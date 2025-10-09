import { type Project, type InsertProject, type Client, type InsertClient, type FileRouting, type InsertFileRouting, type SystemConfig, type InsertSystemConfig, type OneDriveMapping, type InsertOneDriveMapping, type FilesIndex, type InsertFilesIndex, type Communication, type InsertCommunication, type Deadline, type InsertProjectDeadline } from "@shared/schema";
import { projects, clients, fileRoutings, systemConfig, oneDriveMappings, filesIndex, communications, projectDeadlines } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

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

// File-based storage for local persistence
export class FileStorage implements IStorage {
  private dataDir = path.join(process.cwd(), 'data');
  private projectsFile = path.join(this.dataDir, 'projects.json');
  private clientsFile = path.join(this.dataDir, 'clients.json');
  private fileRoutingsFile = path.join(this.dataDir, 'file-routings.json');
  private systemConfigFile = path.join(this.dataDir, 'system-config.json');
  private oneDriveMappingsFile = path.join(this.dataDir, 'onedrive-mappings.json');
  private filesIndexFile = path.join(this.dataDir, 'files-index.json');
  private communicationsFile = path.join(this.dataDir, 'communications.json');
  private deadlinesFile = path.join(this.dataDir, 'deadlines.json');

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('📁 Created data directory for local storage');
    }
  }

  private readJsonFile<T>(filePath: string, defaultValue: T[]): T[] {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
      return defaultValue;
    } catch (error) {
      console.warn(`Warning: Could not read ${filePath}, using default value`);
      return defaultValue;
    }
  }

  private writeJsonFile<T>(filePath: string, data: T[]) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error writing to ${filePath}:`, error);
      throw error;
    }
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const projects = this.readJsonFile<Project>(this.projectsFile, []);
    return projects.find(p => p.id === id);
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    const projects = this.readJsonFile<Project>(this.projectsFile, []);
    return projects.find(p => p.code === code);
  }

  async getAllProjects(): Promise<Project[]> {
    return this.readJsonFile<Project>(this.projectsFile, []);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const projects = this.readJsonFile<Project>(this.projectsFile, []);
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      status: insertProject.status || "in_corso",
      tipoRapporto: insertProject.tipoRapporto || "diretto",
      committenteFinale: insertProject.committenteFinale || null,
      createdAt: new Date(),
      fsRoot: insertProject.fsRoot || null,
      metadata: insertProject.metadata || {},
    };
    
    projects.push(project);
    this.writeJsonFile(this.projectsFile, projects);
    
    // Update client projects count
    const clientSigla = this.generateSafeAcronym(insertProject.client);
    const existingClient = await this.getClientBySigla(clientSigla);
    if (existingClient) {
      await this.updateClient(existingClient.id, {
        projectsCount: (existingClient.projectsCount || 0) + 1
      });
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
    console.log('🔧 FileStorage.updateProject called for:', id);
    console.log('🔧 Update data:', updateData);
    const projects = this.readJsonFile<Project>(this.projectsFile, []);
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) {
      console.log('❌ Project not found in FileStorage');
      return undefined;
    }

    projects[index] = { ...projects[index], ...updateData };
    this.writeJsonFile(this.projectsFile, projects);
    console.log('✅ FileStorage.updateProject completed, saved to:', this.projectsFile);
    return projects[index];
  }

  async deleteProject(id: string): Promise<boolean> {
    const projects = this.readJsonFile<Project>(this.projectsFile, []);
    const project = projects.find(p => p.id === id);
    if (!project) return false;
    
    const filteredProjects = projects.filter(p => p.id !== id);
    this.writeJsonFile(this.projectsFile, filteredProjects);
    
    // Update client projects count
    const clientSigla = this.generateSafeAcronym(project.client);
    const client = await this.getClientBySigla(clientSigla);
    if (client && (client.projectsCount || 0) > 0) {
      await this.updateClient(client.id, {
        projectsCount: (client.projectsCount || 0) - 1
      });
    }
    
    return true;
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const clients = this.readJsonFile<Client>(this.clientsFile, []);
    return clients.find(c => c.id === id);
  }

  async getClientBySigla(sigla: string): Promise<Client | undefined> {
    const clients = this.readJsonFile<Client>(this.clientsFile, []);
    return clients.find(c => c.sigla === sigla);
  }

  async getAllClients(): Promise<Client[]> {
    return this.readJsonFile<Client>(this.clientsFile, []);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const clients = this.readJsonFile<Client>(this.clientsFile, []);
    const id = randomUUID();
    const client: Client = {
      ...insertClient,
      id,
      city: insertClient.city || null,
      projectsCount: insertClient.projectsCount || 0,
    };
    
    clients.push(client);
    this.writeJsonFile(this.clientsFile, clients);
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const clients = this.readJsonFile<Client>(this.clientsFile, []);
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return undefined;
    
    clients[index] = { ...clients[index], ...updateData };
    this.writeJsonFile(this.clientsFile, clients);
    return clients[index];
  }

  async deleteClient(id: string): Promise<boolean> {
    const clients = this.readJsonFile<Client>(this.clientsFile, []);
    const filteredClients = clients.filter(c => c.id !== id);
    if (filteredClients.length === clients.length) return false;
    
    this.writeJsonFile(this.clientsFile, filteredClients);
    return true;
  }

  // File Routings
  async getFileRouting(id: string): Promise<FileRouting | undefined> {
    const routings = this.readJsonFile<FileRouting>(this.fileRoutingsFile, []);
    return routings.find(r => r.id === id);
  }

  async getFileRoutingsByProject(projectId: string): Promise<FileRouting[]> {
    const routings = this.readJsonFile<FileRouting>(this.fileRoutingsFile, []);
    return routings.filter(r => r.projectId === projectId);
  }

  async createFileRouting(insertRouting: InsertFileRouting): Promise<FileRouting> {
    const routings = this.readJsonFile<FileRouting>(this.fileRoutingsFile, []);
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

    routings.push(routing);
    this.writeJsonFile(this.fileRoutingsFile, routings);
    return routing;
  }

  async deleteFileRoutingsByProject(projectId: string): Promise<boolean> {
    const routings = this.readJsonFile<FileRouting>(this.fileRoutingsFile, []);
    const filtered = routings.filter(r => r.projectId !== projectId);
    if (filtered.length < routings.length) {
      this.writeJsonFile(this.fileRoutingsFile, filtered);
      return true;
    }
    return false;
  }

  // System Config
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const configs = this.readJsonFile<SystemConfig>(this.systemConfigFile, []);
    return configs.find(c => c.key === key);
  }

  async setSystemConfig(key: string, value: any): Promise<SystemConfig> {
    const configs = this.readJsonFile<SystemConfig>(this.systemConfigFile, []);
    const existing = configs.find(c => c.key === key);
    
    if (existing) {
      existing.value = value;
      existing.updatedAt = new Date();
      this.writeJsonFile(this.systemConfigFile, configs);
      return existing;
    } else {
      const id = randomUUID();
      const config: SystemConfig = {
        id,
        key,
        value,
        updatedAt: new Date(),
      };
      configs.push(config);
      this.writeJsonFile(this.systemConfigFile, configs);
      return config;
    }
  }

  // OneDrive Mappings
  async getOneDriveMapping(projectCode: string): Promise<OneDriveMapping | undefined> {
    const mappings = this.readJsonFile<OneDriveMapping>(this.oneDriveMappingsFile, []);
    return mappings.find(m => m.projectCode === projectCode);
  }

  async getAllOneDriveMappings(): Promise<OneDriveMapping[]> {
    return this.readJsonFile<OneDriveMapping>(this.oneDriveMappingsFile, []);
  }

  async createOneDriveMapping(insertMapping: InsertOneDriveMapping): Promise<OneDriveMapping> {
    const mappings = this.readJsonFile<OneDriveMapping>(this.oneDriveMappingsFile, []);
    const id = randomUUID();
    const mapping: OneDriveMapping = {
      ...insertMapping,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mappings.push(mapping);
    this.writeJsonFile(this.oneDriveMappingsFile, mappings);
    return mapping;
  }

  async deleteOneDriveMapping(projectCode: string): Promise<boolean> {
    const mappings = this.readJsonFile<OneDriveMapping>(this.oneDriveMappingsFile, []);
    const initialLength = mappings.length;
    const filtered = mappings.filter(m => m.projectCode !== projectCode);
    if (filtered.length < initialLength) {
      this.writeJsonFile(this.oneDriveMappingsFile, filtered);
      return true;
    }
    return false;
  }

  async getOrphanedProjects(): Promise<Project[]> {
    const projects = await this.getAllProjects();
    const mappings = await this.getAllOneDriveMappings();
    const mappedCodes = new Set(mappings.map(m => m.projectCode));
    return projects.filter(p => !mappedCodes.has(p.code));
  }

  // Files Index
  async createOrUpdateFileIndex(insertFileIndex: InsertFilesIndex): Promise<FilesIndex> {
    const filesIndex = this.readJsonFile<FilesIndex>(this.filesIndexFile, []);
    const existingIndex = filesIndex.findIndex(f => f.driveItemId === insertFileIndex.driveItemId);
    
    if (existingIndex >= 0) {
      // Update existing
      const updated: FilesIndex = {
        ...filesIndex[existingIndex],
        ...insertFileIndex,
        projectCode: insertFileIndex.projectCode || null,
        size: insertFileIndex.size || 0,
        mimeType: insertFileIndex.mimeType || null,
        lastModified: insertFileIndex.lastModified || null,
        parentFolderId: insertFileIndex.parentFolderId || null,
        isFolder: insertFileIndex.isFolder || false,
        webUrl: insertFileIndex.webUrl || null,
        downloadUrl: insertFileIndex.downloadUrl || null,
        updatedAt: new Date(),
      };
      filesIndex[existingIndex] = updated;
      this.writeJsonFile(this.filesIndexFile, filesIndex);
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
      filesIndex.push(fileIndex);
      this.writeJsonFile(this.filesIndexFile, filesIndex);
      return fileIndex;
    }
  }

  async getFilesIndex(filters: { projectCode?: string; path?: string; limit?: number }): Promise<FilesIndex[]> {
    let results = this.readJsonFile<FilesIndex>(this.filesIndexFile, []);
    
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

  async getFileIndexByDriveItemId(driveItemId: string): Promise<FilesIndex | undefined> {
    const filesIndex = this.readJsonFile<FilesIndex>(this.filesIndexFile, []);
    return filesIndex.find(f => f.driveItemId === driveItemId);
  }

  async updateFileIndex(driveItemId: string, updates: Partial<InsertFilesIndex>): Promise<FilesIndex | undefined> {
    const filesIndex = this.readJsonFile<FilesIndex>(this.filesIndexFile, []);
    const index = filesIndex.findIndex(f => f.driveItemId === driveItemId);
    if (index === -1) return undefined;
    
    const updated: FilesIndex = {
      ...filesIndex[index],
      ...updates,
      updatedAt: new Date(),
    };
    filesIndex[index] = updated;
    this.writeJsonFile(this.filesIndexFile, filesIndex);
    return updated;
  }

  async deleteFileIndex(driveItemId: string): Promise<boolean> {
    const filesIndex = this.readJsonFile<FilesIndex>(this.filesIndexFile, []);
    const initialLength = filesIndex.length;
    const filtered = filesIndex.filter(f => f.driveItemId !== driveItemId);
    if (filtered.length < initialLength) {
      this.writeJsonFile(this.filesIndexFile, filtered);
      return true;
    }
    return false;
  }

  // Communications
  async getAllCommunications(): Promise<Communication[]> {
    return this.readJsonFile<Communication>(this.communicationsFile, []);
  }

  async getCommunicationsByProject(projectId: string): Promise<Communication[]> {
    const communications = this.readJsonFile<Communication>(this.communicationsFile, []);
    return communications.filter(c => c.projectId === projectId);
  }

  async getCommunication(id: string): Promise<Communication | undefined> {
    const communications = this.readJsonFile<Communication>(this.communicationsFile, []);
    return communications.find(c => c.id === id);
  }

  async createCommunication(insertCommunication: InsertCommunication): Promise<Communication> {
    const communications = this.readJsonFile<Communication>(this.communicationsFile, []);
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    communications.push(communication);
    this.writeJsonFile(this.communicationsFile, communications);
    return communication;
  }

  async updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined> {
    const communications = this.readJsonFile<Communication>(this.communicationsFile, []);
    const index = communications.findIndex(c => c.id === id);
    if (index === -1) return undefined;

    const updated: Communication = {
      ...communications[index],
      ...updates,
      updatedAt: new Date(),
    };
    communications[index] = updated;
    this.writeJsonFile(this.communicationsFile, communications);
    return updated;
  }

  async deleteCommunication(id: string): Promise<boolean> {
    const communications = this.readJsonFile<Communication>(this.communicationsFile, []);
    const initialLength = communications.length;
    const filtered = communications.filter(c => c.id !== id);
    if (filtered.length < initialLength) {
      this.writeJsonFile(this.communicationsFile, filtered);
      return true;
    }
    return false;
  }

  // Deadlines
  async getAllDeadlines(): Promise<Deadline[]> {
    return this.readJsonFile<Deadline>(this.deadlinesFile, []);
  }

  async getDeadlinesByProject(projectId: string): Promise<Deadline[]> {
    const deadlines = this.readJsonFile<Deadline>(this.deadlinesFile, []);
    return deadlines.filter(d => d.projectId === projectId);
  }

  async getDeadline(id: string): Promise<Deadline | undefined> {
    const deadlines = this.readJsonFile<Deadline>(this.deadlinesFile, []);
    return deadlines.find(d => d.id === id);
  }

  async createDeadline(insertDeadline: InsertProjectDeadline): Promise<Deadline> {
    const deadlines = this.readJsonFile<Deadline>(this.deadlinesFile, []);
    const id = randomUUID();
    const deadline: Deadline = {
      ...insertDeadline,
      id,
      status: insertDeadline.status || "pending",
      completedAt: insertDeadline.completedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    deadlines.push(deadline);
    this.writeJsonFile(this.deadlinesFile, deadlines);
    return deadline;
  }

  async updateDeadline(id: string, updates: Partial<InsertProjectDeadline>): Promise<Deadline | undefined> {
    const deadlines = this.readJsonFile<Deadline>(this.deadlinesFile, []);
    const index = deadlines.findIndex(d => d.id === id);
    if (index === -1) return undefined;

    const updated: Deadline = {
      ...deadlines[index],
      ...updates,
      updatedAt: new Date(),
    };
    deadlines[index] = updated;
    this.writeJsonFile(this.deadlinesFile, deadlines);
    return updated;
  }

  async deleteDeadline(id: string): Promise<boolean> {
    const deadlines = this.readJsonFile<Deadline>(this.deadlinesFile, []);
    const initialLength = deadlines.length;
    const filtered = deadlines.filter(d => d.id !== id);
    if (filtered.length < initialLength) {
      this.writeJsonFile(this.deadlinesFile, filtered);
      return true;
    }
    return false;
  }

  // Bulk operations
  async exportAllData() {
    return {
      projects: await this.getAllProjects(),
      clients: await this.getAllClients(),
      fileRoutings: this.readJsonFile<FileRouting>(this.fileRoutingsFile, []),
      systemConfig: this.readJsonFile<SystemConfig>(this.systemConfigFile, []),
      oneDriveMappings: this.readJsonFile<OneDriveMapping>(this.oneDriveMappingsFile, []),
      filesIndex: this.readJsonFile<FilesIndex>(this.filesIndexFile, []),
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[], filesIndex: FilesIndex[] }) {
    this.writeJsonFile(this.projectsFile, data.projects);
    this.writeJsonFile(this.clientsFile, data.clients);
    this.writeJsonFile(this.fileRoutingsFile, data.fileRoutings);
    this.writeJsonFile(this.systemConfigFile, data.systemConfig);
    this.writeJsonFile(this.oneDriveMappingsFile, data.oneDriveMappings || []);
    this.writeJsonFile(this.filesIndexFile, data.filesIndex || []);
  }

  async clearAllData() {
    this.writeJsonFile(this.projectsFile, []);
    this.writeJsonFile(this.clientsFile, []);
    this.writeJsonFile(this.fileRoutingsFile, []);
    this.writeJsonFile(this.systemConfigFile, []);
    this.writeJsonFile(this.oneDriveMappingsFile, []);
    this.writeJsonFile(this.filesIndexFile, []);
  }
}

// Export the storage instance
console.log('📁 FileStorage module loaded - local persistence active');
console.log('📁 Data directory:', path.join(process.cwd(), 'data'));
export const storage: IStorage = new FileStorage();