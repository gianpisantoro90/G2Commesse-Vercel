import { type Project, type InsertProject, type Client, type InsertClient, type FileRouting, type InsertFileRouting, type SystemConfig, type InsertSystemConfig, type OneDriveMapping, type InsertOneDriveMapping } from "@shared/schema";
import { projects, clients, fileRoutings, systemConfig, oneDriveMappings } from "@shared/schema";
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

// File-based storage for local persistence
export class FileStorage implements IStorage {
  private dataDir = path.join(process.cwd(), 'data');
  private projectsFile = path.join(this.dataDir, 'projects.json');
  private clientsFile = path.join(this.dataDir, 'clients.json');
  private fileRoutingsFile = path.join(this.dataDir, 'file-routings.json');
  private systemConfigFile = path.join(this.dataDir, 'system-config.json');
  private oneDriveMappingsFile = path.join(this.dataDir, 'onedrive-mappings.json');

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
    const projects = this.readJsonFile<Project>(this.projectsFile, []);
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return undefined;
    
    projects[index] = { ...projects[index], ...updateData };
    this.writeJsonFile(this.projectsFile, projects);
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

  // Bulk operations
  async exportAllData() {
    return {
      projects: await this.getAllProjects(),
      clients: await this.getAllClients(),
      fileRoutings: this.readJsonFile<FileRouting>(this.fileRoutingsFile, []),
      systemConfig: this.readJsonFile<SystemConfig>(this.systemConfigFile, []),
      oneDriveMappings: this.readJsonFile<OneDriveMapping>(this.oneDriveMappingsFile, []),
    };
  }

  async importAllData(data: { projects: Project[], clients: Client[], fileRoutings: FileRouting[], systemConfig: SystemConfig[], oneDriveMappings: OneDriveMapping[] }) {
    this.writeJsonFile(this.projectsFile, data.projects);
    this.writeJsonFile(this.clientsFile, data.clients);
    this.writeJsonFile(this.fileRoutingsFile, data.fileRoutings);
    this.writeJsonFile(this.systemConfigFile, data.systemConfig);
    this.writeJsonFile(this.oneDriveMappingsFile, data.oneDriveMappings || []);
  }

  async clearAllData() {
    this.writeJsonFile(this.projectsFile, []);
    this.writeJsonFile(this.clientsFile, []);
    this.writeJsonFile(this.fileRoutingsFile, []);
    this.writeJsonFile(this.systemConfigFile, []);
    this.writeJsonFile(this.oneDriveMappingsFile, []);
  }
}

// Export the storage instance
console.log('📁 FileStorage module loaded - local persistence active');
console.log('📁 Data directory:', path.join(process.cwd(), 'data'));
export const storage: IStorage = new FileStorage();