import { type Project, type InsertProject, type Client, type InsertClient, type FileRouting, type InsertFileRouting, type SystemConfig, type InsertSystemConfig, type OneDriveMapping, type InsertOneDriveMapping, type FilesIndex, type InsertFilesIndex, type Communication, type InsertCommunication, type Deadline, type InsertProjectDeadline, type User, type InsertUser, type Task, type InsertTask, type ProjectInvoice, type InsertProjectInvoice, type ProjectPrestazione, type InsertProjectPrestazione, type PrestazioniStats, type ProjectSAL, type InsertProjectSAL, type ProjectChangelog, type InsertProjectChangelog, type ProjectBudget, type InsertProjectBudget, type ProjectResource, type InsertProjectResource, type SavedFilter, type InsertSavedFilter } from "@shared/schema";
import { projects, clients, fileRoutings, systemConfig, oneDriveMappings, filesIndex, communications, projectDeadlines, users, tasks, projectInvoices, projectPrestazioni, projectSAL, projectChangelog, projectBudget, projectResources, savedFilters } from "@shared/schema";
import { eq, sql, or } from "drizzle-orm";
import { randomUUID } from "crypto";

// Use serverless database for now (local fix will be in exported version)
import { db, pool } from "./db";

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
  recalculateClientsProjectsCount(): Promise<void>;
  
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
  updateOneDriveMapping(projectCode: string, updates: Partial<OneDriveMapping>): Promise<OneDriveMapping | undefined>;
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

  // Users
  getAllUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { passwordHash: string }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Tasks
  getAllTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | undefined>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTasksByAssignee(userId: string): Promise<Task[]>;
  getTasksByCreator(userId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Project Invoices
  getAllInvoices(): Promise<ProjectInvoice[]>;
  getInvoicesByProject(projectId: string): Promise<ProjectInvoice[]>;
  getInvoice(id: string): Promise<ProjectInvoice | undefined>;
  createInvoice(invoice: InsertProjectInvoice): Promise<ProjectInvoice>;
  updateInvoice(id: string, updates: Partial<InsertProjectInvoice>): Promise<ProjectInvoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  // Project Prestazioni
  getAllPrestazioni(): Promise<ProjectPrestazione[]>;
  getPrestazioniByProject(projectId: string): Promise<ProjectPrestazione[]>;
  getPrestazione(id: string): Promise<ProjectPrestazione | undefined>;
  createPrestazione(prestazione: InsertProjectPrestazione): Promise<ProjectPrestazione>;
  updatePrestazione(id: string, updates: Partial<InsertProjectPrestazione>): Promise<ProjectPrestazione | undefined>;
  deletePrestazione(id: string): Promise<boolean>;
  getPrestazioniStats(): Promise<PrestazioniStats>;
  getPrestazioniByStato(stato: string): Promise<ProjectPrestazione[]>;
  getInvoicesByPrestazione(prestazioneId: string): Promise<ProjectInvoice[]>;
  recalculatePrestazioneImporti(prestazioneId: string): Promise<ProjectPrestazione | undefined>;
  fixPrestazioniAmounts(): Promise<{ fixed: number; errors: number }>;

  // Bulk operations
  exportAllData(): Promise<{
    projects: Project[],
    clients: Client[],
    fileRoutings: FileRouting[],
    systemConfig: SystemConfig[],
    oneDriveMappings: OneDriveMapping[],
    filesIndex: FilesIndex[],
    users: User[],
    tasks: Task[],
    communications: Communication[],
    deadlines: Deadline[],
    invoices: ProjectInvoice[],
    prestazioni: ProjectPrestazione[],
    sal: ProjectSAL[],
    changelog: ProjectChangelog[],
    budget: ProjectBudget[],
    resources: ProjectResource[],
    filters: SavedFilter[]
  }>;
  importAllData(data: {
    projects?: Project[],
    clients?: Client[],
    fileRoutings?: FileRouting[],
    systemConfig?: SystemConfig[],
    oneDriveMappings?: OneDriveMapping[],
    filesIndex?: FilesIndex[],
    users?: User[],
    tasks?: Task[],
    communications?: Communication[],
    deadlines?: Deadline[],
    invoices?: ProjectInvoice[],
    prestazioni?: ProjectPrestazione[],
    sal?: ProjectSAL[],
    changelog?: ProjectChangelog[],
    budget?: ProjectBudget[],
    resources?: ProjectResource[],
    filters?: SavedFilter[]
  }, mode?: 'merge' | 'overwrite'): Promise<void>;
  clearAllData(): Promise<void>;

  // Connection and migrations (optional - only implemented by database storages)
  testConnection?(): Promise<boolean>;
  runMigrations?(): Promise<void>;
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
  private users: Map<string, User> = new Map();
  private tasks: Map<string, Task> = new Map();
  private invoices: Map<string, ProjectInvoice> = new Map();
  private prestazioni: Map<string, ProjectPrestazione> = new Map();
  private sal: Map<string, ProjectSAL> = new Map();
  private changelog: Map<string, ProjectChangelog> = new Map();
  private budget: Map<string, ProjectBudget> = new Map();
  private resources: Map<string, ProjectResource> = new Map();
  private filters: Map<string, SavedFilter> = new Map();

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
    // Prima trova o crea il client per ottenere clientId
    const clientSigla = this.generateSafeAcronym(insertProject.client);
    let clientId = insertProject.clientId;

    if (!clientId) {
      const existingClient = Array.from(this.clients.values()).find(c => c.sigla === clientSigla);
      if (existingClient) {
        clientId = existingClient.id;
        existingClient.projectsCount = (existingClient.projectsCount || 0) + 1;
      } else {
        // Crea nuovo client e ottieni l'ID
        const newClient = await this.createClient({
          sigla: clientSigla,
          name: insertProject.client,
          city: insertProject.city,
          projectsCount: 1,
        });
        clientId = newClient.id;
      }
    } else {
      // clientId già fornito, aggiorna solo il contatore
      const existingClient = this.clients.get(clientId);
      if (existingClient) {
        existingClient.projectsCount = (existingClient.projectsCount || 0) + 1;
      }
    }

    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      clientId: clientId,
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
      // CRE archival fields
      creArchiviato: insertProject.creArchiviato || false,
      creDataArchiviazione: insertProject.creDataArchiviazione || null,
    };
    this.projects.set(id, project);

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

    // Se il nome del cliente è cambiato, sincronizza tutti i progetti collegati
    if (updateData.name) {
      for (const project of this.projects.values()) {
        if (project.clientId === id) {
          project.client = updateData.name;
        }
      }
    }

    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  async recalculateClientsProjectsCount(): Promise<void> {
    const allProjects = await this.getAllProjects();
    const allClients = await this.getAllClients();

    // Count projects for each client by matching client name
    const projectCounts = new Map<string, number>();

    for (const project of allProjects) {
      const count = projectCounts.get(project.client) || 0;
      projectCounts.set(project.client, count + 1);
    }

    // Update each client's projectsCount
    for (const client of allClients) {
      const count = projectCounts.get(client.name) || 0;
      client.projectsCount = count;
    }

    console.log('✅ Recalculated projects count for all clients (MemStorage)');
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

  async updateOneDriveMapping(projectCode: string, updates: Partial<OneDriveMapping>): Promise<OneDriveMapping | undefined> {
    const existing = this.oneDriveMappings.get(projectCode);
    if (!existing) {
      return undefined;
    }
    
    const updated: OneDriveMapping = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.oneDriveMappings.set(projectCode, updated);
    return updated;
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
      users: Array.from(this.users.values()),
      tasks: Array.from(this.tasks.values()),
      communications: Array.from(this.communications.values()),
      deadlines: Array.from(this.deadlines.values()),
      invoices: Array.from(this.invoices.values()),
      prestazioni: Array.from(this.prestazioni.values()),
      sal: Array.from(this.sal.values()),
      changelog: Array.from(this.changelog.values()),
      budget: Array.from(this.budget.values()),
      resources: Array.from(this.resources.values()),
      filters: Array.from(this.filters.values()),
    };
  }

  async importAllData(data: {
    projects?: Project[],
    clients?: Client[],
    fileRoutings?: FileRouting[],
    systemConfig?: SystemConfig[],
    oneDriveMappings?: OneDriveMapping[],
    filesIndex?: FilesIndex[],
    users?: User[],
    tasks?: Task[],
    communications?: Communication[],
    deadlines?: Deadline[],
    invoices?: ProjectInvoice[],
    prestazioni?: ProjectPrestazione[],
    sal?: ProjectSAL[],
    changelog?: ProjectChangelog[],
    budget?: ProjectBudget[],
    resources?: ProjectResource[],
    filters?: SavedFilter[]
  }, mode: 'merge' | 'overwrite' = 'overwrite') {
    if (mode === 'overwrite') {
      // Clear all existing data
      this.projects.clear();
      this.clients.clear();
      this.fileRoutings.clear();
      this.systemConfig.clear();
      this.oneDriveMappings.clear();
      this.filesIndex.clear();
      this.users.clear();
      this.tasks.clear();
      this.communications.clear();
      this.deadlines.clear();
      this.invoices.clear();
      this.prestazioni.clear();
      this.sal.clear();
      this.changelog.clear();
      this.budget.clear();
      this.resources.clear();
      this.filters.clear();
    }
    // For merge mode, we don't clear - we just add/update

    // Import data - will add new items or update existing ones (based on ID)
    data.projects?.forEach(p => this.projects.set(p.id, p));
    data.clients?.forEach(c => this.clients.set(c.id, c));
    data.fileRoutings?.forEach(fr => this.fileRoutings.set(fr.id, fr));
    data.systemConfig?.forEach(sc => this.systemConfig.set(sc.id, sc));
    data.oneDriveMappings?.forEach(odm => this.oneDriveMappings.set(odm.projectCode, odm));
    data.filesIndex?.forEach(fi => this.filesIndex.set(fi.driveItemId, fi));
    data.users?.forEach(u => this.users.set(u.id, u));
    data.tasks?.forEach(t => this.tasks.set(t.id, t));
    data.communications?.forEach(c => this.communications.set(c.id, c));
    data.deadlines?.forEach(d => this.deadlines.set(d.id, d));
    data.invoices?.forEach(inv => this.invoices.set(inv.id, inv));
    data.prestazioni?.forEach(prest => this.prestazioni.set(prest.id, prest));
    data.sal?.forEach(s => this.sal.set(s.id, s));
    data.changelog?.forEach(cl => this.changelog.set(cl.id, cl));
    data.budget?.forEach(b => this.budget.set(b.id, b));
    data.resources?.forEach(r => this.resources.set(r.id, r));
    data.filters?.forEach(f => this.filters.set(f.id, f));
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

  // Users
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(insertUser: InsertUser & { passwordHash: string }): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || 'user',
      active: insertUser.active !== undefined ? insertUser.active : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;

    const updated: User = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Tasks
  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.projectId === projectId);
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.assignedToId === userId);
  }

  async getTasksByCreator(userId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.createdById === userId);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      ...insertTask,
      id,
      description: insertTask.description || null,
      notes: insertTask.notes || null,
      projectId: insertTask.projectId || null,
      assignedToId: insertTask.assignedToId || null,
      priority: insertTask.priority || 'medium',
      status: insertTask.status || 'pending',
      dueDate: insertTask.dueDate || null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;

    // Remove readonly fields that should not be updated
    const { id: _, createdAt: __, completedAt: ___, updatedAt: ____, ...safeUpdates } = updates as any;

    // Convert dueDate to Date if it's a string
    const processedUpdates = { ...safeUpdates };
    if (processedUpdates.dueDate && typeof processedUpdates.dueDate === 'string') {
      processedUpdates.dueDate = new Date(processedUpdates.dueDate);
    }

    const updated: Task = {
      ...existing,
      ...processedUpdates,
      updatedAt: new Date(),
      // Se status diventa completed, setta completedAt
      completedAt: updates.status === 'completed' ? new Date() : (updates.status && updates.status !== 'completed' ? null : existing.completedAt),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  // Invoice methods
  async getAllInvoices(): Promise<ProjectInvoice[]> {
    return Array.from(this.invoices.values());
  }

  async getInvoicesByProject(projectId: string): Promise<ProjectInvoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.projectId === projectId);
  }

  async getInvoice(id: string): Promise<ProjectInvoice | undefined> {
    return this.invoices.get(id);
  }

  // Helper: sincronizza i campi fatturazione del progetto basandosi sulle fatture
  private async syncProjectInvoiceFields(projectId: string): Promise<void> {
    const invoices = await this.getInvoicesByProject(projectId);
    const project = this.projects.get(projectId);
    if (!project) return;

    if (invoices.length === 0) {
      // Nessuna fattura: reset campi
      project.fatturato = false;
      project.numeroFattura = null;
      project.dataFattura = null;
      project.importoFatturato = 0;
      project.pagato = false;
      project.dataPagamento = null;
      project.importoPagato = 0;
    } else {
      // Calcola totali dalle fatture
      const importoTotaleFatturato = invoices.reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);
      const fatturePagate = invoices.filter(inv => inv.stato === 'pagata');
      const importoTotalePagato = fatturePagate.reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);
      const tuttePagate = invoices.length > 0 && invoices.every(inv => inv.stato === 'pagata');

      // Prima fattura per riferimento
      const primaFattura = invoices.sort((a, b) =>
        new Date(a.dataEmissione).getTime() - new Date(b.dataEmissione).getTime()
      )[0];

      project.fatturato = true;
      project.numeroFattura = invoices.length === 1
        ? primaFattura.numeroFattura
        : `${primaFattura.numeroFattura} (+${invoices.length - 1})`;
      project.dataFattura = primaFattura.dataEmissione;
      project.importoFatturato = importoTotaleFatturato;
      project.pagato = tuttePagate;
      project.dataPagamento = tuttePagate && fatturePagate.length > 0
        ? fatturePagate[fatturePagate.length - 1].dataPagamento
        : null;
      project.importoPagato = importoTotalePagato;
    }
  }

  async createInvoice(insertInvoice: InsertProjectInvoice): Promise<ProjectInvoice> {
    const id = randomUUID();
    const invoice: ProjectInvoice = {
      ...insertInvoice,
      id,
      salId: insertInvoice.salId || null,
      importoParcella: insertInvoice.importoParcella || 0,
      ritenuta: insertInvoice.ritenuta || 0,
      scadenzaPagamento: insertInvoice.scadenzaPagamento || null,
      dataPagamento: insertInvoice.dataPagamento || null,
      note: insertInvoice.note || null,
      attachmentPath: insertInvoice.attachmentPath || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.invoices.set(id, invoice);

    // Sincronizza i campi fatturazione del progetto
    await this.syncProjectInvoiceFields(insertInvoice.projectId);

    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<InsertProjectInvoice>): Promise<ProjectInvoice | undefined> {
    const existing = this.invoices.get(id);
    if (!existing) return undefined;

    const updated: ProjectInvoice = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.invoices.set(id, updated);

    // Sincronizza i campi fatturazione del progetto
    await this.syncProjectInvoiceFields(existing.projectId);

    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const invoice = this.invoices.get(id);
    const projectId = invoice?.projectId;
    const deleted = this.invoices.delete(id);

    // Sincronizza i campi fatturazione del progetto
    if (deleted && projectId) {
      await this.syncProjectInvoiceFields(projectId);
    }

    return deleted;
  }

  // Prestazioni methods
  async getAllPrestazioni(): Promise<ProjectPrestazione[]> {
    return Array.from(this.prestazioni.values());
  }

  async getPrestazioniByProject(projectId: string): Promise<ProjectPrestazione[]> {
    return Array.from(this.prestazioni.values()).filter(p => p.projectId === projectId);
  }

  async getPrestazione(id: string): Promise<ProjectPrestazione | undefined> {
    return this.prestazioni.get(id);
  }

  // Sincronizza metadata.prestazioni e metadata.livelloProgettazione dalla tabella projectPrestazioni
  private async syncMetadataFromPrestazioni(projectId: string): Promise<void> {
    const prestazioniList = await this.getPrestazioniByProject(projectId);
    const project = await this.getProject(projectId);
    if (!project) return;

    // Estrai tipi unici di prestazione
    const tipiUnici = [...new Set(prestazioniList.map(p => p.tipo))];

    // Estrai livelli progettazione unici (solo da prestazioni di tipo 'progettazione')
    const livelliUnici = [...new Set(
      prestazioniList
        .filter(p => p.tipo === 'progettazione' && p.livelloProgettazione)
        .map(p => p.livelloProgettazione!)
    )];

    // Aggiorna il metadata del progetto
    const currentMetadata = (project.metadata || {}) as Record<string, any>;
    const updatedMetadata = {
      ...currentMetadata,
      prestazioni: tipiUnici,
      livelloProgettazione: livelliUnici,
    };

    await this.updateProject(projectId, { metadata: updatedMetadata });
  }

  async createPrestazione(insertPrestazione: InsertProjectPrestazione): Promise<ProjectPrestazione> {
    const id = randomUUID();
    const prestazione: ProjectPrestazione = {
      ...insertPrestazione,
      id,
      livelloProgettazione: insertPrestazione.livelloProgettazione || null,
      descrizione: insertPrestazione.descrizione || null,
      stato: insertPrestazione.stato || 'da_iniziare',
      dataInizio: insertPrestazione.dataInizio || null,
      dataCompletamento: insertPrestazione.dataCompletamento || null,
      dataFatturazione: insertPrestazione.dataFatturazione || null,
      dataPagamento: insertPrestazione.dataPagamento || null,
      importoPrevisto: insertPrestazione.importoPrevisto || 0,
      importoFatturato: insertPrestazione.importoFatturato || 0,
      importoPagato: insertPrestazione.importoPagato || 0,
      note: insertPrestazione.note || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.prestazioni.set(id, prestazione);

    // Sincronizza metadata del progetto con le prestazioni dalla tabella
    await this.syncMetadataFromPrestazioni(insertPrestazione.projectId);

    return prestazione;
  }

  async updatePrestazione(id: string, updates: Partial<InsertProjectPrestazione>): Promise<ProjectPrestazione | undefined> {
    const existing = this.prestazioni.get(id);
    if (!existing) return undefined;

    const updated: ProjectPrestazione = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    // Auto-copy logic for stato transitions
    if (updates.stato === 'fatturata' && !updates.importoFatturato) {
      updated.importoFatturato = existing.importoPrevisto || 0;
    }
    if (updates.stato === 'pagata' && !updates.importoPagato) {
      updated.importoPagato = existing.importoFatturato || existing.importoPrevisto || 0;
    }

    this.prestazioni.set(id, updated);
    return updated;
  }

  async deletePrestazione(id: string): Promise<boolean> {
    const prestazione = this.prestazioni.get(id);
    const projectId = prestazione?.projectId;
    const deleted = this.prestazioni.delete(id);

    // Sincronizza metadata del progetto dopo l'eliminazione
    if (deleted && projectId) {
      await this.syncMetadataFromPrestazioni(projectId);
    }

    return deleted;
  }

  async getPrestazioniStats(): Promise<PrestazioniStats> {
    const all = Array.from(this.prestazioni.values());

    const stats: PrestazioniStats = {
      totale: all.length,
      daIniziare: all.filter(p => p.stato === 'da_iniziare').length,
      inCorso: all.filter(p => p.stato === 'in_corso').length,
      completate: all.filter(p => p.stato === 'completata').length,
      fatturate: all.filter(p => p.stato === 'fatturata').length,
      pagate: all.filter(p => p.stato === 'pagata').length,
      completateNonFatturate: all.filter(p => p.stato === 'completata').length,
      fatturateNonPagate: all.filter(p => p.stato === 'fatturata').length,
      importoTotalePrevisto: all.reduce((sum, p) => sum + (p.importoPrevisto || 0), 0),
      importoTotaleFatturato: all.reduce((sum, p) => sum + (p.importoFatturato || 0), 0),
      importoTotalePagato: all.reduce((sum, p) => sum + (p.importoPagato || 0), 0),
      importoDaFatturare: all.filter(p => p.stato === 'completata').reduce((sum, p) => sum + (p.importoPrevisto || 0), 0),
      importoDaIncassare: all.filter(p => p.stato === 'fatturata').reduce((sum, p) => sum + (p.importoFatturato || 0), 0),
    };

    return stats;
  }

  async getPrestazioniByStato(stato: string): Promise<ProjectPrestazione[]> {
    return Array.from(this.prestazioni.values()).filter(p => p.stato === stato);
  }

  async getInvoicesByPrestazione(prestazioneId: string): Promise<ProjectInvoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.prestazioneId === prestazioneId);
  }

  async recalculatePrestazioneImporti(prestazioneId: string): Promise<ProjectPrestazione | undefined> {
    const existing = this.prestazioni.get(prestazioneId);
    if (!existing) return undefined;

    // Get all invoices linked to this prestazione
    const invoices = await this.getInvoicesByPrestazione(prestazioneId);

    // Calculate totals from invoices
    const importoFatturato = invoices.reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);
    const importoPagato = invoices
      .filter(inv => inv.stato === 'pagata')
      .reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);

    // Determine state based on amounts
    let stato = existing.stato;
    let dataFatturazione = existing.dataFatturazione;
    let dataPagamento = existing.dataPagamento;

    if (importoFatturato > 0 && importoFatturato >= (existing.importoPrevisto || 0)) {
      stato = importoPagato >= importoFatturato ? 'pagata' : 'fatturata';
      if (!dataFatturazione) dataFatturazione = new Date();
      if (stato === 'pagata' && !dataPagamento) dataPagamento = new Date();
    }

    const updated: ProjectPrestazione = {
      ...existing,
      importoFatturato,
      importoPagato,
      stato,
      dataFatturazione,
      dataPagamento,
      updatedAt: new Date(),
    };
    this.prestazioni.set(prestazioneId, updated);
    return updated;
  }

  async clearAllData() {
    this.projects.clear();
    this.clients.clear();
    this.fileRoutings.clear();
    this.systemConfig.clear();
    this.oneDriveMappings.clear();
    this.filesIndex.clear();
    this.communications.clear();
    this.deadlines.clear();
    this.tasks.clear();
    this.invoices.clear();
    this.prestazioni.clear();
    // Don't clear users - keep them for authentication
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  // Test database connection - uses raw SQL to avoid schema dependency issues
  async testConnection(): Promise<boolean> {
    try {
      // Use raw SQL query to test connection without depending on schema columns
      // This prevents failures when new columns are added to schema but not yet migrated
      if (pool) {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
      } else {
        // Fallback: use db.execute with raw SQL
        await db.execute(sql`SELECT 1`);
      }
      return true;
    } catch (error) {
      console.error('🔥 Database connection test failed:', error);
      return false;
    }
  }

  // Run database migrations to ensure schema is up to date
  async runMigrations(): Promise<void> {
    if (!pool) {
      console.warn('⚠️ No pool available for migrations');
      return;
    }

    try {
      const client = await pool.connect();

      // Migration: Add CRE fields to projects table
      const cigExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'cig'
        );
      `);

      if (!cigExists.rows[0].exists) {
        console.log('🔄 Adding CRE fields to projects table...');
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cig TEXT`);
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS numero_contratto TEXT`);
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_inizio_commessa TIMESTAMP`);
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_fine_commessa TIMESTAMP`);
        console.log('✅ CRE fields added to projects table');
      }

      // Migration: Add CRE archival tracking fields
      const creArchiviatoExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'cre_archiviato'
        );
      `);

      if (!creArchiviatoExists.rows[0].exists) {
        console.log('🔄 Adding CRE archival fields to projects table...');
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cre_archiviato BOOLEAN DEFAULT FALSE`);
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cre_data_archiviazione TIMESTAMP`);
        console.log('✅ CRE archival fields added to projects table');
      }

      // Migration: Ensure project_prestazioni table exists
      const prestazioniExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'project_prestazioni'
        );
      `);

      if (!prestazioniExists.rows[0].exists) {
        console.log('🔄 Creating project_prestazioni table...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS project_prestazioni (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL,
            livello_progettazione TEXT,
            descrizione TEXT,
            stato TEXT NOT NULL DEFAULT 'da_iniziare',
            data_inizio TIMESTAMP,
            data_completamento TIMESTAMP,
            data_fatturazione TIMESTAMP,
            data_pagamento TIMESTAMP,
            importo_previsto INTEGER DEFAULT 0,
            importo_fatturato INTEGER DEFAULT 0,
            importo_pagato INTEGER DEFAULT 0,
            note TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_project ON project_prestazioni(project_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_prestazioni_stato ON project_prestazioni(stato)`);
        console.log('✅ project_prestazioni table created');
      }

      // Migration: Add prestazione_id and tipo_fattura to project_invoices
      const prestazioneIdExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'project_invoices' AND column_name = 'prestazione_id'
        );
      `);

      if (!prestazioneIdExists.rows[0].exists) {
        console.log('🔄 Adding prestazione_id and tipo_fattura to project_invoices...');
        await client.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS prestazione_id TEXT`);
        await client.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS tipo_fattura TEXT DEFAULT 'unica'`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_prestazione ON project_invoices(prestazione_id)`);
        console.log('✅ prestazione_id and tipo_fattura columns added');
      }

      // CRITICAL Migration: Fix object column naming (oggetto_completo → object)
      // This fixes production database compatibility issue
      const oggettoCompletoExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'oggetto_completo'
        );
      `);

      if (oggettoCompletoExists.rows[0].exists) {
        console.log('🔄 CRITICAL: Renaming oggetto_completo column to object...');
        await client.query(`ALTER TABLE projects RENAME COLUMN oggetto_completo TO object`);
        console.log('✅ Column renamed: oggetto_completo → object');
      } else {
        // Ensure object column exists
        const objectExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'projects' AND column_name = 'object'
          );
        `);

        if (!objectExists.rows[0].exists) {
          console.log('🔄 Adding missing object column to projects table...');
          await client.query(`ALTER TABLE projects ADD COLUMN object TEXT NOT NULL DEFAULT ''`);
          console.log('✅ Object column added to projects table');
        }
      }

      client.release();
      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration error:', error);
      throw error;
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
    // Prima trova o crea il client per ottenere clientId
    const clientSigla = this.generateSafeAcronym(insertProject.client);
    let clientId = insertProject.clientId;

    if (!clientId) {
      const existingClient = await this.getClientBySigla(clientSigla);

      if (existingClient) {
        clientId = existingClient.id;
        // Aggiorna contatore progetti del client esistente
        await db
          .update(clients)
          .set({ projectsCount: (existingClient.projectsCount || 0) + 1 })
          .where(eq(clients.id, existingClient.id));
      } else {
        // Crea nuovo client e ottieni l'ID
        const newClient = await this.createClient({
          sigla: clientSigla,
          name: insertProject.client,
          city: insertProject.city,
          projectsCount: 1,
        });
        clientId = newClient.id;
      }
    } else {
      // clientId già fornito, aggiorna solo il contatore
      const existingClient = await this.getClient(clientId);
      if (existingClient) {
        await db
          .update(clients)
          .set({ projectsCount: (existingClient.projectsCount || 0) + 1 })
          .where(eq(clients.id, existingClient.id));
      }
    }

    // Ora crea il progetto con clientId sempre valorizzato
    const [project] = await db
      .insert(projects)
      .values({
        ...insertProject,
        clientId: clientId,
        fsRoot: insertProject.fsRoot || null,
        metadata: insertProject.metadata || {},
      })
      .returning();

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

    // Se il nome del cliente è cambiato, sincronizza tutti i progetti collegati
    if (updated && updateData.name) {
      await db
        .update(projects)
        .set({ client: updateData.name })
        .where(eq(projects.clientId, id));
    }

    return updated || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return (result.rowCount || 0) > 0;
  }

  async recalculateClientsProjectsCount(): Promise<void> {
    const allProjects = await this.getAllProjects();
    const allClients = await this.getAllClients();

    // Count projects for each client by matching client name
    const projectCounts = new Map<string, number>();

    for (const project of allProjects) {
      const count = projectCounts.get(project.client) || 0;
      projectCounts.set(project.client, count + 1);
    }

    // Update each client's projectsCount in database
    for (const client of allClients) {
      const count = projectCounts.get(client.name) || 0;
      if (client.projectsCount !== count) {
        await db
          .update(clients)
          .set({ projectsCount: count })
          .where(eq(clients.id, client.id));
      }
    }

    console.log('✅ Recalculated projects count for all clients (DatabaseStorage)');
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

  async updateOneDriveMapping(projectCode: string, updates: Partial<OneDriveMapping>): Promise<OneDriveMapping | undefined> {
    const [updated] = await db
      .update(oneDriveMappings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(oneDriveMappings.projectCode, projectCode))
      .returning();
    return updated || undefined;
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
    // CRITICAL FIX: Drizzle/Neon doesn't serialize JavaScript objects to JSONB correctly
    // We need to explicitly serialize object-type JSONB fields (arrays work fine)
    const dataToInsert = {
      ...insertCommunication,
      // Convert date strings to Date objects for timestamp columns
      communicationDate: typeof insertCommunication.communicationDate === 'string'
        ? new Date(insertCommunication.communicationDate)
        : insertCommunication.communicationDate,
      // Force serialization of object-type JSONB fields by round-tripping through JSON
      emailHeaders: insertCommunication.emailHeaders
        ? JSON.parse(JSON.stringify(insertCommunication.emailHeaders))
        : insertCommunication.emailHeaders,
      aiSuggestions: insertCommunication.aiSuggestions
        ? JSON.parse(JSON.stringify(insertCommunication.aiSuggestions))
        : insertCommunication.aiSuggestions,
      aiSuggestionsStatus: insertCommunication.aiSuggestionsStatus
        ? JSON.parse(JSON.stringify(insertCommunication.aiSuggestionsStatus))
        : insertCommunication.aiSuggestionsStatus,
    };

    const [communication] = await db.insert(communications).values(dataToInsert).returning();
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
    // Convert date strings to Date objects for timestamp columns
    const dataToInsert = {
      ...insertDeadline,
      dueDate: typeof insertDeadline.dueDate === 'string'
        ? new Date(insertDeadline.dueDate)
        : insertDeadline.dueDate,
      completedAt: insertDeadline.completedAt && typeof insertDeadline.completedAt === 'string'
        ? new Date(insertDeadline.completedAt)
        : insertDeadline.completedAt,
    };

    const [deadline] = await db.insert(projectDeadlines).values(dataToInsert).returning();
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

  // Users
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser & { passwordHash: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role || 'user',
      active: insertUser.active !== undefined ? insertUser.active : true,
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // First, delete all tasks created by this user (createdById is NOT NULL)
      await db.delete(tasks).where(eq(tasks.createdById, id));
      
      // Then, nullify assignedToId for tasks assigned to this user
      await db.update(tasks).set({ assignedToId: null }).where(eq(tasks.assignedToId, id));
      
      // Then delete the user
      const result = await db.delete(users).where(eq(users.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // Tasks
  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.assignedToId, userId));
  }

  async getTasksByCreator(userId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.createdById, userId));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    // Remove readonly fields that should not be updated
    const { id: _, createdAt: __, completedAt: ___, updatedAt: ____, ...safeUpdates } = updates as any;

    const updateData: any = {
      ...safeUpdates,
      updatedAt: new Date(),
    };

    // Convert dueDate to Date if it's a string
    if (updateData.dueDate && typeof updateData.dueDate === 'string') {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    // Se status diventa completed, setta completedAt
    if (updates.status === 'completed') {
      updateData.completedAt = new Date();
    } else if (updates.status && updates.status !== 'completed') {
      // Se status cambia a qualcosa che non è completed, resetta completedAt
      updateData.completedAt = null;
    }

    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Invoice methods
  async getAllInvoices(): Promise<ProjectInvoice[]> {
    try {
      return await db.select().from(projectInvoices);
    } catch (error) {
      console.error('Error getting all invoices:', error);
      return [];
    }
  }

  async getInvoicesByProject(projectId: string): Promise<ProjectInvoice[]> {
    try {
      return await db.select().from(projectInvoices).where(eq(projectInvoices.projectId, projectId));
    } catch (error) {
      console.error('Error getting invoices:', error);
      return [];
    }
  }

  async getInvoice(id: string): Promise<ProjectInvoice | undefined> {
    try {
      const [invoice] = await db.select().from(projectInvoices).where(eq(projectInvoices.id, id));
      return invoice || undefined;
    } catch (error) {
      console.error('Error getting invoice:', error);
      return undefined;
    }
  }

  // Helper: sincronizza i campi fatturazione del progetto basandosi sulle fatture
  private async syncProjectInvoiceFields(projectId: string): Promise<void> {
    try {
      const invoicesList = await this.getInvoicesByProject(projectId);

      if (invoicesList.length === 0) {
        // Nessuna fattura: reset campi
        await db.update(projects).set({
          fatturato: false,
          numeroFattura: null,
          dataFattura: null,
          importoFatturato: 0,
          pagato: false,
          dataPagamento: null,
          importoPagato: 0,
        }).where(eq(projects.id, projectId));
      } else {
        // Calcola totali dalle fatture
        const importoTotaleFatturato = invoicesList.reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);
        const fatturePagate = invoicesList.filter(inv => inv.stato === 'pagata');
        const importoTotalePagato = fatturePagate.reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);
        const tuttePagate = invoicesList.length > 0 && invoicesList.every(inv => inv.stato === 'pagata');

        // Prima fattura per riferimento
        const primaFattura = invoicesList.sort((a, b) =>
          new Date(a.dataEmissione).getTime() - new Date(b.dataEmissione).getTime()
        )[0];

        await db.update(projects).set({
          fatturato: true,
          numeroFattura: invoicesList.length === 1
            ? primaFattura.numeroFattura
            : `${primaFattura.numeroFattura} (+${invoicesList.length - 1})`,
          dataFattura: primaFattura.dataEmissione,
          importoFatturato: importoTotaleFatturato,
          pagato: tuttePagate,
          dataPagamento: tuttePagate && fatturePagate.length > 0
            ? fatturePagate[fatturePagate.length - 1].dataPagamento
            : null,
          importoPagato: importoTotalePagato,
        }).where(eq(projects.id, projectId));
      }
    } catch (error) {
      console.error('Error syncing project invoice fields:', error);
    }
  }

  async createInvoice(insertInvoice: InsertProjectInvoice): Promise<ProjectInvoice> {
    try {
      const [invoice] = await db.insert(projectInvoices).values(insertInvoice).returning();

      // Sincronizza i campi fatturazione del progetto
      await this.syncProjectInvoiceFields(insertInvoice.projectId);

      return invoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  async updateInvoice(id: string, updates: Partial<InsertProjectInvoice>): Promise<ProjectInvoice | undefined> {
    try {
      // Prima ottieni la fattura esistente per avere il projectId
      const existing = await this.getInvoice(id);
      if (!existing) return undefined;

      const [updated] = await db.update(projectInvoices).set(updates).where(eq(projectInvoices.id, id)).returning();

      // Sincronizza i campi fatturazione del progetto
      if (updated) {
        await this.syncProjectInvoiceFields(existing.projectId);
      }

      return updated || undefined;
    } catch (error) {
      console.error('Error updating invoice:', error);
      return undefined;
    }
  }

  async deleteInvoice(id: string): Promise<boolean> {
    try {
      // Prima ottieni la fattura per avere il projectId
      const invoice = await this.getInvoice(id);
      const projectId = invoice?.projectId;

      const result = await db.delete(projectInvoices).where(eq(projectInvoices.id, id));
      const deleted = (result.rowCount || 0) > 0;

      // Sincronizza i campi fatturazione del progetto
      if (deleted && projectId) {
        await this.syncProjectInvoiceFields(projectId);
      }

      return deleted;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      return false;
    }
  }

  // Prestazioni methods
  async getAllPrestazioni(): Promise<ProjectPrestazione[]> {
    try {
      return await db.select().from(projectPrestazioni);
    } catch (error) {
      console.error('Error getting all prestazioni:', error);
      return [];
    }
  }

  async fixPrestazioniAmounts(): Promise<{ fixed: number; errors: number }> {
    try {
      const all = await this.getAllPrestazioni();
      let fixed = 0;
      let errors = 0;

      for (const prestazione of all) {
        try {
          // Fix fatturate senza importoFatturato
          if (prestazione.stato === 'fatturata' && (!prestazione.importoFatturato || prestazione.importoFatturato === 0)) {
            if (prestazione.importoPrevisto && prestazione.importoPrevisto > 0) {
              await db.update(projectPrestazioni)
                .set({
                  importoFatturato: prestazione.importoPrevisto,
                  updatedAt: new Date()
                })
                .where(eq(projectPrestazioni.id, prestazione.id));
              fixed++;
            }
          }

          // Fix pagate senza importoPagato
          if (prestazione.stato === 'pagata' && (!prestazione.importoPagato || prestazione.importoPagato === 0)) {
            const importo = prestazione.importoFatturato || prestazione.importoPrevisto || 0;
            if (importo > 0) {
              await db.update(projectPrestazioni)
                .set({
                  importoPagato: importo,
                  importoFatturato: prestazione.importoFatturato || prestazione.importoPrevisto || 0,
                  updatedAt: new Date()
                })
                .where(eq(projectPrestazioni.id, prestazione.id));
              fixed++;
            }
          }
        } catch (err) {
          console.error(`Error fixing prestazione ${prestazione.id}:`, err);
          errors++;
        }
      }

      return { fixed, errors };
    } catch (error) {
      console.error('Error fixing prestazioni amounts:', error);
      return { fixed: 0, errors: 1 };
    }
  }

  async getPrestazioniByProject(projectId: string): Promise<ProjectPrestazione[]> {
    try {
      return await db.select().from(projectPrestazioni).where(eq(projectPrestazioni.projectId, projectId));
    } catch (error) {
      console.error('Error getting prestazioni by project:', error);
      return [];
    }
  }

  async getPrestazione(id: string): Promise<ProjectPrestazione | undefined> {
    try {
      const [prestazione] = await db.select().from(projectPrestazioni).where(eq(projectPrestazioni.id, id));
      return prestazione || undefined;
    } catch (error) {
      console.error('Error getting prestazione:', error);
      return undefined;
    }
  }

  // Sincronizza metadata.prestazioni e metadata.livelloProgettazione dalla tabella projectPrestazioni
  private async syncMetadataFromPrestazioni(projectId: string): Promise<void> {
    try {
      const prestazioniList = await this.getPrestazioniByProject(projectId);
      const project = await this.getProject(projectId);
      if (!project) return;

      // Estrai tipi unici di prestazione
      const tipiUnici = [...new Set(prestazioniList.map(p => p.tipo))];

      // Estrai livelli progettazione unici (solo da prestazioni di tipo 'progettazione')
      const livelliUnici = [...new Set(
        prestazioniList
          .filter(p => p.tipo === 'progettazione' && p.livelloProgettazione)
          .map(p => p.livelloProgettazione!)
      )];

      // Aggiorna il metadata del progetto
      const currentMetadata = (project.metadata || {}) as Record<string, any>;
      const updatedMetadata = {
        ...currentMetadata,
        prestazioni: tipiUnici,
        livelloProgettazione: livelliUnici,
      };

      await this.updateProject(projectId, { metadata: updatedMetadata });
    } catch (error) {
      console.error('Error syncing metadata from prestazioni:', error);
    }
  }

  async createPrestazione(insertPrestazione: InsertProjectPrestazione): Promise<ProjectPrestazione> {
    try {
      const [prestazione] = await db.insert(projectPrestazioni).values(insertPrestazione).returning();

      // Sincronizza metadata del progetto con le prestazioni dalla tabella
      await this.syncMetadataFromPrestazioni(insertPrestazione.projectId);

      return prestazione;
    } catch (error) {
      console.error('Error creating prestazione:', error);
      throw error;
    }
  }

  async updatePrestazione(id: string, updates: Partial<InsertProjectPrestazione>): Promise<ProjectPrestazione | undefined> {
    try {
      // Get existing prestazione for auto-copy logic
      const existing = await this.getPrestazione(id);
      if (!existing) return undefined;

      // Auto-copy logic for stato transitions
      const finalUpdates = { ...updates };
      if (updates.stato === 'fatturata' && !updates.importoFatturato) {
        finalUpdates.importoFatturato = existing.importoPrevisto || 0;
      }
      if (updates.stato === 'pagata' && !updates.importoPagato) {
        finalUpdates.importoPagato = existing.importoFatturato || existing.importoPrevisto || 0;
      }

      const [updated] = await db
        .update(projectPrestazioni)
        .set({ ...finalUpdates, updatedAt: new Date() })
        .where(eq(projectPrestazioni.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error('Error updating prestazione:', error);
      return undefined;
    }
  }

  async deletePrestazione(id: string): Promise<boolean> {
    try {
      // Salva il projectId prima dell'eliminazione per la sincronizzazione
      const prestazione = await this.getPrestazione(id);
      const projectId = prestazione?.projectId;

      const result = await db.delete(projectPrestazioni).where(eq(projectPrestazioni.id, id));
      const deleted = (result.rowCount || 0) > 0;

      // Sincronizza metadata del progetto dopo l'eliminazione
      if (deleted && projectId) {
        await this.syncMetadataFromPrestazioni(projectId);
      }

      return deleted;
    } catch (error) {
      console.error('Error deleting prestazione:', error);
      return false;
    }
  }

  async getPrestazioniStats(): Promise<PrestazioniStats> {
    try {
      const all = await this.getAllPrestazioni();

      return {
        totale: all.length,
        daIniziare: all.filter(p => p.stato === 'da_iniziare').length,
        inCorso: all.filter(p => p.stato === 'in_corso').length,
        completate: all.filter(p => p.stato === 'completata').length,
        fatturate: all.filter(p => p.stato === 'fatturata').length,
        pagate: all.filter(p => p.stato === 'pagata').length,
        completateNonFatturate: all.filter(p => p.stato === 'completata').length,
        fatturateNonPagate: all.filter(p => p.stato === 'fatturata').length,
        importoTotalePrevisto: all.reduce((sum, p) => sum + (p.importoPrevisto || 0), 0),
        importoTotaleFatturato: all.reduce((sum, p) => sum + (p.importoFatturato || 0), 0),
        importoTotalePagato: all.reduce((sum, p) => sum + (p.importoPagato || 0), 0),
        importoDaFatturare: all.filter(p => p.stato === 'completata').reduce((sum, p) => sum + (p.importoPrevisto || 0), 0),
        importoDaIncassare: all.filter(p => p.stato === 'fatturata').reduce((sum, p) => sum + (p.importoFatturato || 0), 0),
      };
    } catch (error) {
      console.error('Error getting prestazioni stats:', error);
      return {
        totale: 0, daIniziare: 0, inCorso: 0, completate: 0, fatturate: 0, pagate: 0,
        completateNonFatturate: 0, fatturateNonPagate: 0,
        importoTotalePrevisto: 0, importoTotaleFatturato: 0, importoTotalePagato: 0,
        importoDaFatturare: 0, importoDaIncassare: 0,
      };
    }
  }

  async getPrestazioniByStato(stato: string): Promise<ProjectPrestazione[]> {
    try {
      return await db.select().from(projectPrestazioni).where(eq(projectPrestazioni.stato, stato));
    } catch (error) {
      console.error('Error getting prestazioni by stato:', error);
      return [];
    }
  }

  async getInvoicesByPrestazione(prestazioneId: string): Promise<ProjectInvoice[]> {
    try {
      return await db.select().from(projectInvoices).where(eq(projectInvoices.prestazioneId, prestazioneId));
    } catch (error) {
      console.error('Error getting invoices by prestazione:', error);
      return [];
    }
  }

  async recalculatePrestazioneImporti(prestazioneId: string): Promise<ProjectPrestazione | undefined> {
    try {
      const existing = await this.getPrestazione(prestazioneId);
      if (!existing) return undefined;

      // Get all invoices linked to this prestazione
      const invoices = await this.getInvoicesByPrestazione(prestazioneId);

      // Calculate totals from invoices
      const importoFatturato = invoices.reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);
      const importoPagato = invoices
        .filter(inv => inv.stato === 'pagata')
        .reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);

      // Determine state based on amounts
      let stato = existing.stato;
      let dataFatturazione = existing.dataFatturazione;
      let dataPagamento = existing.dataPagamento;

      if (importoFatturato > 0 && importoFatturato >= (existing.importoPrevisto || 0)) {
        stato = importoPagato >= importoFatturato ? 'pagata' : 'fatturata';
        if (!dataFatturazione) dataFatturazione = new Date();
        if (stato === 'pagata' && !dataPagamento) dataPagamento = new Date();
      }

      const [updated] = await db
        .update(projectPrestazioni)
        .set({
          importoFatturato,
          importoPagato,
          stato,
          dataFatturazione,
          dataPagamento,
          updatedAt: new Date(),
        })
        .where(eq(projectPrestazioni.id, prestazioneId))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error('Error recalculating prestazione importi:', error);
      return undefined;
    }
  }

  // Bulk operations
  async exportAllData() {
    const [projectsData, clientsData, fileRoutingsData, systemConfigData, oneDriveMappingsData, filesIndexData, usersData, tasksData, communicationsData, deadlinesData, invoicesData, prestazioniData, salData, changelogData, budgetData, resourcesData, filtersData] = await Promise.all([
      this.getAllProjects(),
      this.getAllClients(),
      db.select().from(fileRoutings),
      db.select().from(systemConfig),
      db.select().from(oneDriveMappings),
      db.select().from(filesIndex),
      this.getAllUsers(),
      this.getAllTasks(),
      this.getAllCommunications(),
      this.getAllDeadlines(),
      this.getAllInvoices(),
      this.getAllPrestazioni(),
      db.select().from(projectSAL),
      db.select().from(projectChangelog),
      db.select().from(projectBudget),
      db.select().from(projectResources),
      db.select().from(savedFilters),
    ]);

    return {
      projects: projectsData,
      clients: clientsData,
      fileRoutings: fileRoutingsData,
      systemConfig: systemConfigData,
      oneDriveMappings: oneDriveMappingsData,
      filesIndex: filesIndexData,
      users: usersData,
      tasks: tasksData,
      communications: communicationsData,
      deadlines: deadlinesData,
      invoices: invoicesData,
      prestazioni: prestazioniData,
      sal: salData,
      changelog: changelogData,
      budget: budgetData,
      resources: resourcesData,
      filters: filtersData,
    };
  }

  // Helper function to convert date strings to Date objects
  private convertTimestampsToDate<T extends Record<string, any>>(
    records: T[], 
    timestampFields: string[]
  ): T[] {
    return records.map(record => {
      const converted = { ...record };
      for (const field of timestampFields) {
        if (converted[field] && typeof converted[field] === 'string') {
          converted[field] = new Date(converted[field]);
        }
      }
      return converted;
    });
  }

  async importAllData(data: {
    projects?: Project[],
    clients?: Client[],
    fileRoutings?: FileRouting[],
    systemConfig?: SystemConfig[],
    oneDriveMappings?: OneDriveMapping[],
    filesIndex?: FilesIndex[],
    users?: User[],
    tasks?: Task[],
    communications?: Communication[],
    deadlines?: Deadline[],
    invoices?: ProjectInvoice[],
    prestazioni?: ProjectPrestazione[],
    sal?: ProjectSAL[],
    changelog?: ProjectChangelog[],
    budget?: ProjectBudget[],
    resources?: ProjectResource[],
    filters?: SavedFilter[]
  }, mode: 'merge' | 'overwrite' = 'overwrite') {
    if (mode === 'overwrite') {
      // Clear all existing data
      await this.clearAllData();
    }

    // CRITICAL: Import in correct order to respect foreign key constraints
    // Order: users, clients, projects, everything else

    try {
      // 1. Users first (no dependencies)
      if (data.users && data.users.length > 0) {
        console.log(`📥 Importing ${data.users.length} users...`);
        const usersWithDates = this.convertTimestampsToDate(data.users, ['createdAt', 'updatedAt']);
        if (mode === 'merge') {
          for (const user of usersWithDates) {
            await db.insert(users).values(user).onConflictDoNothing();
          }
        } else {
          await db.insert(users).values(usersWithDates);
        }
      }

      // 2. Clients second (no dependencies)
      if (data.clients && data.clients.length > 0) {
        console.log(`📥 Importing ${data.clients.length} clients...`);
        if (mode === 'merge') {
          for (const client of data.clients) {
            await db.insert(clients).values(client).onConflictDoNothing();
          }
        } else {
          await db.insert(clients).values(data.clients);
        }
      }

      // 3. System config (no dependencies)
      if (data.systemConfig && data.systemConfig.length > 0) {
        console.log(`📥 Importing ${data.systemConfig.length} system configs...`);
        const configWithDates = this.convertTimestampsToDate(data.systemConfig, ['updatedAt']);
        if (mode === 'merge') {
          for (const config of configWithDates) {
            await db.insert(systemConfig).values(config).onConflictDoNothing();
          }
        } else {
          await db.insert(systemConfig).values(configWithDates);
        }
      }

      // 4. Projects (depends on clients)
      if (data.projects && data.projects.length > 0) {
        console.log(`📥 Importing ${data.projects.length} projects...`);
        const projectsWithDates = this.convertTimestampsToDate(data.projects, ['createdAt', 'dataFattura', 'dataPagamento']);
        if (mode === 'merge') {
          for (const project of projectsWithDates) {
            await db.insert(projects).values(project).onConflictDoNothing();
          }
        } else {
          await db.insert(projects).values(projectsWithDates);
        }
      }

      // 5. OneDrive mappings (depends on projects)
      if (data.oneDriveMappings && data.oneDriveMappings.length > 0) {
        console.log(`📥 Importing ${data.oneDriveMappings.length} OneDrive mappings...`);
        const mappingsWithDates = this.convertTimestampsToDate(data.oneDriveMappings, ['createdAt', 'updatedAt']);
        if (mode === 'merge') {
          for (const mapping of mappingsWithDates) {
            await db.insert(oneDriveMappings).values(mapping).onConflictDoNothing();
          }
        } else {
          await db.insert(oneDriveMappings).values(mappingsWithDates);
        }
      }

      // 6. Files index (depends on projects)
      if (data.filesIndex && data.filesIndex.length > 0) {
        console.log(`📥 Importing ${data.filesIndex.length} files...`);
        const filesWithDates = this.convertTimestampsToDate(data.filesIndex, ['createdAt', 'updatedAt', 'lastModified']);
        if (mode === 'merge') {
          for (const fileIndex of filesWithDates) {
            await db.insert(filesIndex).values(fileIndex).onConflictDoNothing();
          }
        } else {
          await db.insert(filesIndex).values(filesWithDates);
        }
      }

      // 7. File routings (depends on projects)
      if (data.fileRoutings && data.fileRoutings.length > 0) {
        console.log(`📥 Importing ${data.fileRoutings.length} file routings...`);
        const routingsWithDates = this.convertTimestampsToDate(data.fileRoutings, ['createdAt']);
        if (mode === 'merge') {
          for (const routing of routingsWithDates) {
            await db.insert(fileRoutings).values(routing).onConflictDoNothing();
          }
        } else {
          await db.insert(fileRoutings).values(routingsWithDates);
        }
      }

      // 8. Tasks (depends on projects)
      if (data.tasks && data.tasks.length > 0) {
        console.log(`📥 Importing ${data.tasks.length} tasks...`);
        const tasksWithDates = this.convertTimestampsToDate(data.tasks, ['createdAt', 'updatedAt', 'dueDate']);
        if (mode === 'merge') {
          for (const task of tasksWithDates) {
            await db.insert(tasks).values(task).onConflictDoNothing();
          }
        } else {
          await db.insert(tasks).values(tasksWithDates);
        }
      }

      // 9. Communications (depends on projects)
      if (data.communications && data.communications.length > 0) {
        console.log(`📥 Importing ${data.communications.length} communications...`);
        const communicationsWithDates = this.convertTimestampsToDate(data.communications, ['createdAt', 'updatedAt', 'communicationDate']);
        if (mode === 'merge') {
          for (const communication of communicationsWithDates) {
            await db.insert(communications).values(communication).onConflictDoNothing();
          }
        } else {
          await db.insert(communications).values(communicationsWithDates);
        }
      }

      // 10. Deadlines (depends on projects)
      if (data.deadlines && data.deadlines.length > 0) {
        console.log(`📥 Importing ${data.deadlines.length} deadlines...`);
        const deadlinesWithDates = this.convertTimestampsToDate(data.deadlines, ['createdAt', 'updatedAt', 'dueDate', 'completedAt']);
        if (mode === 'merge') {
          for (const deadline of deadlinesWithDates) {
            await db.insert(projectDeadlines).values(deadline).onConflictDoNothing();
          }
        } else {
          await db.insert(projectDeadlines).values(deadlinesWithDates);
        }
      }

      // 11. Invoices (depends on projects)
      if (data.invoices && data.invoices.length > 0) {
        console.log(`📥 Importing ${data.invoices.length} invoices...`);
        const invoicesWithDates = this.convertTimestampsToDate(data.invoices, ['createdAt', 'updatedAt', 'dataEmissione', 'dataPagamento']);
        if (mode === 'merge') {
          for (const invoice of invoicesWithDates) {
            await db.insert(projectInvoices).values(invoice).onConflictDoNothing();
          }
        } else {
          await db.insert(projectInvoices).values(invoicesWithDates);
        }
      }

      // 12. Prestazioni (depends on projects)
      if (data.prestazioni && data.prestazioni.length > 0) {
        console.log(`📥 Importing ${data.prestazioni.length} prestazioni...`);
        const prestazioniWithDates = this.convertTimestampsToDate(data.prestazioni, ['createdAt', 'updatedAt', 'dataFatturazione', 'dataPagamento']);
        if (mode === 'merge') {
          for (const prestazione of prestazioniWithDates) {
            await db.insert(projectPrestazioni).values(prestazione).onConflictDoNothing();
          }
        } else {
          await db.insert(projectPrestazioni).values(prestazioniWithDates);
        }
      }

      // 13. SAL (depends on projects)
      if (data.sal && data.sal.length > 0) {
        console.log(`📥 Importing ${data.sal.length} SAL...`);
        const salWithDates = this.convertTimestampsToDate(data.sal, ['createdAt', 'updatedAt', 'dataApprovazione']);
        if (mode === 'merge') {
          for (const sal of salWithDates) {
            await db.insert(projectSAL).values(sal).onConflictDoNothing();
          }
        } else {
          await db.insert(projectSAL).values(salWithDates);
        }
      }

      // 14. Changelog (depends on projects)
      if (data.changelog && data.changelog.length > 0) {
        console.log(`📥 Importing ${data.changelog.length} changelog entries...`);
        const changelogWithDates = this.convertTimestampsToDate(data.changelog, ['timestamp']);
        if (mode === 'merge') {
          for (const entry of changelogWithDates) {
            await db.insert(projectChangelog).values(entry).onConflictDoNothing();
          }
        } else {
          await db.insert(projectChangelog).values(changelogWithDates);
        }
      }

      // 15. Budget (depends on projects)
      if (data.budget && data.budget.length > 0) {
        console.log(`📥 Importing ${data.budget.length} budget entries...`);
        const budgetWithDates = this.convertTimestampsToDate(data.budget, ['createdAt', 'updatedAt']);
        if (mode === 'merge') {
          for (const budget of budgetWithDates) {
            await db.insert(projectBudget).values(budget).onConflictDoNothing();
          }
        } else {
          await db.insert(projectBudget).values(budgetWithDates);
        }
      }

      // 16. Resources (depends on projects)
      if (data.resources && data.resources.length > 0) {
        console.log(`📥 Importing ${data.resources.length} resources...`);
        const resourcesWithDates = this.convertTimestampsToDate(data.resources, ['createdAt', 'updatedAt']);
        if (mode === 'merge') {
          for (const resource of resourcesWithDates) {
            await db.insert(projectResources).values(resource).onConflictDoNothing();
          }
        } else {
          await db.insert(projectResources).values(resourcesWithDates);
        }
      }

      // 17. Saved Filters (no dependencies)
      if (data.filters && data.filters.length > 0) {
        console.log(`📥 Importing ${data.filters.length} saved filters...`);
        const filtersWithDates = this.convertTimestampsToDate(data.filters, ['createdAt', 'updatedAt']);
        if (mode === 'merge') {
          for (const filter of filtersWithDates) {
            await db.insert(savedFilters).values(filter).onConflictDoNothing();
          }
        } else {
          await db.insert(savedFilters).values(filtersWithDates);
        }
      }

      console.log('✅ All data imported successfully');
    } catch (error) {
      console.error('❌ Error during import:', error);
      throw error;
    }
  }

  async clearAllData() {
    await db.delete(tasks);
    await db.delete(projectDeadlines);
    await db.delete(communications);
    await db.delete(filesIndex);
    await db.delete(fileRoutings);
    await db.delete(oneDriveMappings);
    await db.delete(projectInvoices);
    await db.delete(projectPrestazioni);
    await db.delete(projectSAL);
    await db.delete(projectChangelog);
    await db.delete(projectBudget);
    await db.delete(projectResources);
    await db.delete(savedFilters);
    await db.delete(projects);
    await db.delete(clients);
    await db.delete(systemConfig);
    // Don't delete users - keep them for authentication
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }
}

// Use database storage in production, file storage for local development
console.log('🔍 Storage initialization');
console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('🔍 TURSO_DATABASE_URL exists:', !!process.env.TURSO_DATABASE_URL);
console.log('🔍 Environment NODE_ENV:', process.env.NODE_ENV);

async function initializeStorage(): Promise<IStorage> {
  // Priority: Turso > Neon/PostgreSQL > FileStorage > MemStorage

  // 1. Try Turso first (zero-cost deployment)
  if (process.env.TURSO_DATABASE_URL) {
    console.log('🔷 Turso configuration detected, attempting connection...');
    try {
      const { TursoStorage } = await import('./storage-turso.js');
      const tursoStorage = new TursoStorage();
      await tursoStorage.initialize();
      const isConnected = await tursoStorage.testConnection();
      if (isConnected) {
        console.log('✅ Using TursoStorage - connection verified');
        return tursoStorage;
      } else {
        console.log('⚠️ Turso connection failed, trying other options...');
      }
    } catch (error) {
      console.error('❌ Failed to initialize TursoStorage:', error);
    }
  }

  // 2. Try Neon/PostgreSQL if DATABASE_URL is set
  if (process.env.DATABASE_URL) {
    console.log('🔷 PostgreSQL configuration detected, attempting connection...');
    const dbStorage = new DatabaseStorage();
    try {
      const isConnected = await dbStorage.testConnection();
      if (isConnected) {
        // Run migrations BEFORE returning storage to ensure schema is up to date
        console.log('🔄 Running database migrations...');
        await dbStorage.runMigrations();
        console.log('✅ Using DatabaseStorage (PostgreSQL) - connection verified');
        return dbStorage;
      } else {
        console.log('⚠️ PostgreSQL connection failed, trying other options...');
      }
    } catch (error) {
      console.error('❌ PostgreSQL connection error:', error);
    }
  }

  // 3. For local development or if databases fail, use FileStorage
  const isLocal = process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development';
  if (isLocal || !process.env.DATABASE_URL && !process.env.TURSO_DATABASE_URL) {
    console.log('📁 Using FileStorage for local development with persistence');
    console.log('📁 Data will be saved in:', process.cwd() + '/data');
    try {
      const { storage: fileStorage } = await import('./storage-local.js');
      return fileStorage;
    } catch (error) {
      console.error('❌ Failed to load FileStorage:', error);
    }
  }

  // 4. Last resort: MemStorage (data not persisted!)
  console.warn('⚠️ Using MemStorage - data will NOT be persisted!');
  return new MemStorage();
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

  async recalculateClientsProjectsCount(): Promise<void> {
    return this.executeWithFallback(storage => storage.recalculateClientsProjectsCount());
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

  async updateOneDriveMapping(projectCode: string, updates: Partial<OneDriveMapping>): Promise<OneDriveMapping | undefined> {
    return this.executeWithFallback(storage => storage.updateOneDriveMapping(projectCode, updates));
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

  // User methods
  async getAllUsers(): Promise<User[]> {
    return this.executeWithFallback(storage => storage.getAllUsers());
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.executeWithFallback(storage => storage.getUserById(id));
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.executeWithFallback(storage => storage.getUserByUsername(username));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.executeWithFallback(storage => storage.getUserByEmail(email));
  }

  async createUser(user: InsertUser & { passwordHash: string }): Promise<User> {
    return this.executeWithFallback(storage => storage.createUser(user));
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    return this.executeWithFallback(storage => storage.updateUser(id, updates));
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteUser(id));
  }

  // Task methods
  async getAllTasks(): Promise<Task[]> {
    return this.executeWithFallback(storage => storage.getAllTasks());
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    return this.executeWithFallback(storage => storage.getTaskById(id));
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return this.executeWithFallback(storage => storage.getTasksByProject(projectId));
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    return this.executeWithFallback(storage => storage.getTasksByAssignee(userId));
  }

  async getTasksByCreator(userId: string): Promise<Task[]> {
    return this.executeWithFallback(storage => storage.getTasksByCreator(userId));
  }

  async createTask(task: InsertTask): Promise<Task> {
    return this.executeWithFallback(storage => storage.createTask(task));
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    return this.executeWithFallback(storage => storage.updateTask(id, updates));
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteTask(id));
  }

  // Invoice methods
  async getInvoicesByProject(projectId: string): Promise<ProjectInvoice[]> {
    return this.executeWithFallback(storage => storage.getInvoicesByProject(projectId));
  }

  async getInvoice(id: string): Promise<ProjectInvoice | undefined> {
    return this.executeWithFallback(storage => storage.getInvoice(id));
  }

  async createInvoice(invoice: InsertProjectInvoice): Promise<ProjectInvoice> {
    return this.executeWithFallback(storage => storage.createInvoice(invoice));
  }

  async updateInvoice(id: string, updates: Partial<InsertProjectInvoice>): Promise<ProjectInvoice | undefined> {
    return this.executeWithFallback(storage => storage.updateInvoice(id, updates));
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deleteInvoice(id));
  }

  // Prestazioni methods
  async getAllPrestazioni(): Promise<ProjectPrestazione[]> {
    return this.executeWithFallback(storage => storage.getAllPrestazioni());
  }

  async getPrestazioniByProject(projectId: string): Promise<ProjectPrestazione[]> {
    return this.executeWithFallback(storage => storage.getPrestazioniByProject(projectId));
  }

  async getPrestazione(id: string): Promise<ProjectPrestazione | undefined> {
    return this.executeWithFallback(storage => storage.getPrestazione(id));
  }

  async createPrestazione(prestazione: InsertProjectPrestazione): Promise<ProjectPrestazione> {
    return this.executeWithFallback(storage => storage.createPrestazione(prestazione));
  }

  async updatePrestazione(id: string, updates: Partial<InsertProjectPrestazione>): Promise<ProjectPrestazione | undefined> {
    return this.executeWithFallback(storage => storage.updatePrestazione(id, updates));
  }

  async deletePrestazione(id: string): Promise<boolean> {
    return this.executeWithFallback(storage => storage.deletePrestazione(id));
  }

  async getPrestazioniStats(): Promise<PrestazioniStats> {
    return this.executeWithFallback(storage => storage.getPrestazioniStats());
  }

  async getPrestazioniByStato(stato: string): Promise<ProjectPrestazione[]> {
    return this.executeWithFallback(storage => storage.getPrestazioniByStato(stato));
  }

  async getInvoicesByPrestazione(prestazioneId: string): Promise<ProjectInvoice[]> {
    return this.executeWithFallback(storage => storage.getInvoicesByPrestazione(prestazioneId));
  }

  async recalculatePrestazioneImporti(prestazioneId: string): Promise<ProjectPrestazione | undefined> {
    return this.executeWithFallback(storage => storage.recalculatePrestazioneImporti(prestazioneId));
  }

  async exportAllData(): Promise<{
    projects: Project[],
    clients: Client[],
    fileRoutings: FileRouting[],
    systemConfig: SystemConfig[],
    oneDriveMappings: OneDriveMapping[],
    filesIndex: FilesIndex[],
    users: User[],
    tasks: Task[],
    communications: Communication[],
    deadlines: Deadline[]
  }> {
    return this.executeWithFallback(storage => storage.exportAllData());
  }

  async importAllData(data: { 
    projects?: Project[], 
    clients?: Client[], 
    fileRoutings?: FileRouting[], 
    systemConfig?: SystemConfig[], 
    oneDriveMappings?: OneDriveMapping[], 
    filesIndex?: FilesIndex[],
    users?: User[],
    tasks?: Task[],
    communications?: Communication[],
    deadlines?: Deadline[]
  }, mode?: 'merge' | 'overwrite'): Promise<void> {
    return this.executeWithFallback(storage => storage.importAllData(data, mode));
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
