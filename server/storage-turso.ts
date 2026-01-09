/**
 * Turso Storage Implementation
 * SQLite-based storage for zero-cost Vercel deployment
 */

import { eq, sql, like } from "drizzle-orm";
import { db, client, initializeDatabase, isDatabaseAvailable } from "./db-turso";
import {
  projects, clients, fileRoutings, systemConfig, oneDriveMappings,
  filesIndex, communications, projectDeadlines, users, tasks, projectInvoices,
  projectPrestazioni, projectSAL, projectChangelog, projectBudget, projectResources, savedFilters, generateId
} from "@shared/schema-sqlite";
import type {
  Project, InsertProject, Client, InsertClient, FileRouting, InsertFileRouting,
  SystemConfig, InsertSystemConfig, OneDriveMapping, InsertOneDriveMapping,
  FilesIndex, InsertFilesIndex, Communication, InsertCommunication,
  Deadline, InsertProjectDeadline, User, InsertUser, Task, InsertTask,
  ProjectInvoice, InsertProjectInvoice, ProjectPrestazione, InsertProjectPrestazione,
  ProjectSAL, InsertProjectSAL, ProjectChangelog, InsertProjectChangelog,
  ProjectBudget, InsertProjectBudget, ProjectResource, InsertProjectResource,
  SavedFilter, InsertSavedFilter
} from "@shared/schema-sqlite";
import type { IStorage } from "./storage";

export class TursoStorage implements IStorage {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    await initializeDatabase();
    this.initialized = true;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!db) return false;
      await db.select().from(projects).limit(1);
      return true;
    } catch (error) {
      console.error('🔥 Turso connection test failed:', error);
      return false;
    }
  }

  // ============================================
  // PROJECTS
  // ============================================

  async getProject(id: string): Promise<Project | undefined> {
    if (!db) throw new Error('Database not available');
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    if (!db) throw new Error('Database not available');
    const [project] = await db.select().from(projects).where(eq(projects.code, code));
    return project || undefined;
  }

  async getAllProjects(): Promise<Project[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(projects);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    if (!db) throw new Error('Database not available');

    // Prima trova o crea il client per ottenere clientId
    const clientSigla = this.generateSafeAcronym(insertProject.client);
    let clientId = insertProject.clientId;

    if (!clientId) {
      const existingClient = await this.getClientBySigla(clientSigla);

      if (existingClient) {
        clientId = existingClient.id;
        await db.update(clients)
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
        await db.update(clients)
          .set({ projectsCount: (existingClient.projectsCount || 0) + 1 })
          .where(eq(clients.id, existingClient.id));
      }
    }

    const id = generateId();
    const now = new Date();

    const [project] = await db.insert(projects).values({
      id,
      ...insertProject,
      clientId: clientId,
      status: insertProject.status || "in corso",
      tipoRapporto: insertProject.tipoRapporto || "diretto",
      metadata: insertProject.metadata || {},
      createdAt: now,
    }).returning();

    return project;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    if (!db) throw new Error('Database not available');
    const [updated] = await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');

    const project = await this.getProject(id);
    if (!project) return false;

    await db.delete(projects).where(eq(projects.id, id));

    // Update client projects count
    const clientSigla = this.generateSafeAcronym(project.client);
    const clientRecord = await this.getClientBySigla(clientSigla);
    if (clientRecord && (clientRecord.projectsCount || 0) > 0) {
      await db.update(clients)
        .set({ projectsCount: (clientRecord.projectsCount || 0) - 1 })
        .where(eq(clients.id, clientRecord.id));
    }

    return true;
  }

  // ============================================
  // CLIENTS
  // ============================================

  async getClient(id: string): Promise<Client | undefined> {
    if (!db) throw new Error('Database not available');
    const [clientRecord] = await db.select().from(clients).where(eq(clients.id, id));
    return clientRecord || undefined;
  }

  async getClientBySigla(sigla: string): Promise<Client | undefined> {
    if (!db) throw new Error('Database not available');
    const [clientRecord] = await db.select().from(clients).where(eq(clients.sigla, sigla));
    return clientRecord || undefined;
  }

  async getAllClients(): Promise<Client[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(clients);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [clientRecord] = await db.insert(clients).values({
      id,
      ...insertClient,
      projectsCount: insertClient.projectsCount || 0,
      createdAt: now,
    }).returning();

    return clientRecord;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    if (!db) throw new Error('Database not available');
    const [updated] = await db.update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();

    // Se il nome del cliente è cambiato, sincronizza tutti i progetti collegati
    if (updated && updateData.name) {
      await db.update(projects)
        .set({ client: updateData.name })
        .where(eq(projects.clientId, id));
    }

    return updated || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    const result = await db.delete(clients).where(eq(clients.id, id));
    return true;
  }

  async recalculateClientsProjectsCount(): Promise<void> {
    if (!db) throw new Error('Database not available');

    const allProjects = await this.getAllProjects();
    const allClients = await this.getAllClients();

    const projectCounts = new Map<string, number>();
    for (const project of allProjects) {
      const count = projectCounts.get(project.client) || 0;
      projectCounts.set(project.client, count + 1);
    }

    for (const clientRecord of allClients) {
      const count = projectCounts.get(clientRecord.name) || 0;
      if (clientRecord.projectsCount !== count) {
        await db.update(clients)
          .set({ projectsCount: count })
          .where(eq(clients.id, clientRecord.id));
      }
    }

    console.log('✅ Recalculated projects count for all clients (TursoStorage)');
  }

  // ============================================
  // FILE ROUTINGS
  // ============================================

  async getFileRouting(id: string): Promise<FileRouting | undefined> {
    if (!db) throw new Error('Database not available');
    const [routing] = await db.select().from(fileRoutings).where(eq(fileRoutings.id, id));
    return routing || undefined;
  }

  async getFileRoutingsByProject(projectId: string): Promise<FileRouting[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(fileRoutings).where(eq(fileRoutings.projectId, projectId));
  }

  async createFileRouting(insertRouting: InsertFileRouting): Promise<FileRouting> {
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [routing] = await db.insert(fileRoutings).values({
      id,
      ...insertRouting,
      confidence: insertRouting.confidence || 0,
      createdAt: now,
    }).returning();

    return routing;
  }

  async deleteFileRoutingsByProject(projectId: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    await db.delete(fileRoutings).where(eq(fileRoutings.projectId, projectId));
    return true;
  }

  // ============================================
  // SYSTEM CONFIG
  // ============================================

  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    if (!db) throw new Error('Database not available');
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return config || undefined;
  }

  async setSystemConfig(key: string, value: any): Promise<SystemConfig> {
    if (!db) throw new Error('Database not available');

    const existing = await this.getSystemConfig(key);
    const now = new Date();

    if (existing) {
      const [updated] = await db.update(systemConfig)
        .set({ value, updatedAt: now })
        .where(eq(systemConfig.key, key))
        .returning();
      return updated;
    } else {
      const id = generateId();
      const [created] = await db.insert(systemConfig).values({
        id,
        key,
        value,
        updatedAt: now,
      }).returning();
      return created;
    }
  }

  // ============================================
  // ONEDRIVE MAPPINGS
  // ============================================

  async getOneDriveMapping(projectCode: string): Promise<OneDriveMapping | undefined> {
    if (!db) throw new Error('Database not available');
    const [mapping] = await db.select().from(oneDriveMappings).where(eq(oneDriveMappings.projectCode, projectCode));
    return mapping || undefined;
  }

  async getAllOneDriveMappings(): Promise<OneDriveMapping[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(oneDriveMappings);
  }

  async createOneDriveMapping(insertMapping: InsertOneDriveMapping): Promise<OneDriveMapping> {
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [mapping] = await db.insert(oneDriveMappings).values({
      id,
      ...insertMapping,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return mapping;
  }

  async updateOneDriveMapping(projectCode: string, updates: Partial<OneDriveMapping>): Promise<OneDriveMapping | undefined> {
    if (!db) throw new Error('Database not available');
    const now = new Date();
    const [updated] = await db.update(oneDriveMappings)
      .set({ ...updates, updatedAt: now })
      .where(eq(oneDriveMappings.projectCode, projectCode))
      .returning();
    return updated || undefined;
  }

  async deleteOneDriveMapping(projectCode: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    await db.delete(oneDriveMappings).where(eq(oneDriveMappings.projectCode, projectCode));
    return true;
  }

  async getOrphanedProjects(): Promise<Project[]> {
    if (!db) throw new Error('Database not available');

    const allProjects = await this.getAllProjects();
    const allMappings = await this.getAllOneDriveMappings();
    const mappedCodes = new Set(allMappings.map(m => m.projectCode));

    return allProjects.filter(p => !mappedCodes.has(p.code));
  }

  // ============================================
  // FILES INDEX
  // ============================================

  async createOrUpdateFileIndex(insertFileIndex: InsertFilesIndex): Promise<FilesIndex> {
    if (!db) throw new Error('Database not available');

    const existing = await this.getFileIndexByDriveItemId(insertFileIndex.driveItemId);
    const now = new Date();

    if (existing) {
      const [updated] = await db.update(filesIndex)
        .set({ ...insertFileIndex, updatedAt: now })
        .where(eq(filesIndex.driveItemId, insertFileIndex.driveItemId))
        .returning();
      return updated;
    } else {
      const id = generateId();
      const [created] = await db.insert(filesIndex).values({
        id,
        ...insertFileIndex,
        size: insertFileIndex.size || 0,
        isFolder: insertFileIndex.isFolder || false,
        createdAt: now,
        updatedAt: now,
      }).returning();
      return created;
    }
  }

  async getFilesIndex(filters: { projectCode?: string; path?: string; limit?: number }): Promise<FilesIndex[]> {
    if (!db) throw new Error('Database not available');

    let query = db.select().from(filesIndex);

    if (filters.projectCode) {
      query = query.where(eq(filesIndex.projectCode, filters.projectCode)) as any;
    }

    if (filters.path) {
      query = query.where(like(filesIndex.path, `%${filters.path}%`)) as any;
    }

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    return await query;
  }

  async getFileIndexByDriveItemId(driveItemId: string): Promise<FilesIndex | undefined> {
    if (!db) throw new Error('Database not available');
    const [result] = await db.select().from(filesIndex).where(eq(filesIndex.driveItemId, driveItemId)).limit(1);
    return result || undefined;
  }

  async updateFileIndex(driveItemId: string, updates: Partial<InsertFilesIndex>): Promise<FilesIndex | undefined> {
    if (!db) throw new Error('Database not available');
    const now = new Date();
    const [updated] = await db.update(filesIndex)
      .set({ ...updates, updatedAt: now })
      .where(eq(filesIndex.driveItemId, driveItemId))
      .returning();
    return updated || undefined;
  }

  async deleteFileIndex(driveItemId: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    await db.delete(filesIndex).where(eq(filesIndex.driveItemId, driveItemId));
    return true;
  }

  // ============================================
  // COMMUNICATIONS
  // ============================================

  async getAllCommunications(): Promise<Communication[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(communications);
  }

  async getCommunicationsByProject(projectId: string): Promise<Communication[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(communications).where(eq(communications.projectId, projectId));
  }

  async getCommunication(id: string): Promise<Communication | undefined> {
    if (!db) throw new Error('Database not available');
    const [comm] = await db.select().from(communications).where(eq(communications.id, id));
    return comm || undefined;
  }

  async createCommunication(insertComm: InsertCommunication): Promise<Communication> {
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [comm] = await db.insert(communications).values({
      id,
      ...insertComm,
      communicationDate: insertComm.communicationDate instanceof Date
        ? insertComm.communicationDate
        : new Date(insertComm.communicationDate),
      tags: insertComm.tags || [],
      attachments: insertComm.attachments || [],
      createdAt: now,
      updatedAt: now,
    }).returning();

    return comm;
  }

  async updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined> {
    if (!db) throw new Error('Database not available');
    const now = new Date();
    const [updated] = await db.update(communications)
      .set({ ...updates, updatedAt: now })
      .where(eq(communications.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCommunication(id: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    await db.delete(communications).where(eq(communications.id, id));
    return true;
  }

  // ============================================
  // DEADLINES
  // ============================================

  async getAllDeadlines(): Promise<Deadline[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(projectDeadlines);
  }

  async getDeadlinesByProject(projectId: string): Promise<Deadline[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(projectDeadlines).where(eq(projectDeadlines.projectId, projectId));
  }

  async getDeadline(id: string): Promise<Deadline | undefined> {
    if (!db) throw new Error('Database not available');
    const [deadline] = await db.select().from(projectDeadlines).where(eq(projectDeadlines.id, id));
    return deadline || undefined;
  }

  async createDeadline(insertDeadline: InsertProjectDeadline): Promise<Deadline> {
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [deadline] = await db.insert(projectDeadlines).values({
      id,
      ...insertDeadline,
      dueDate: insertDeadline.dueDate instanceof Date
        ? insertDeadline.dueDate
        : new Date(insertDeadline.dueDate as any),
      priority: insertDeadline.priority || 'medium',
      status: insertDeadline.status || 'pending',
      type: insertDeadline.type || 'general',
      createdAt: now,
      updatedAt: now,
    }).returning();

    return deadline;
  }

  async updateDeadline(id: string, updates: Partial<InsertProjectDeadline>): Promise<Deadline | undefined> {
    if (!db) throw new Error('Database not available');
    const now = new Date();
    const [updated] = await db.update(projectDeadlines)
      .set({ ...updates, updatedAt: now })
      .where(eq(projectDeadlines.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDeadline(id: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    await db.delete(projectDeadlines).where(eq(projectDeadlines.id, id));
    return true;
  }

  // ============================================
  // USERS
  // ============================================

  async getAllUsers(): Promise<User[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(users);
  }

  async getUserById(id: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not available');
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not available');
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not available');
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser & { passwordHash: string }): Promise<User> {
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [user] = await db.insert(users).values({
      id,
      ...insertUser,
      role: insertUser.role || 'user',
      active: insertUser.active !== undefined ? insertUser.active : true,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    if (!db) throw new Error('Database not available');
    const now = new Date();
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: now })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  // ============================================
  // TASKS
  // ============================================

  async getAllTasks(): Promise<Task[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(tasks);
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    if (!db) throw new Error('Database not available');
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(tasks).where(eq(tasks.assignedToId, userId));
  }

  async getTasksByCreator(userId: string): Promise<Task[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(tasks).where(eq(tasks.createdById, userId));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [task] = await db.insert(tasks).values({
      id,
      ...insertTask,
      priority: insertTask.priority || 'medium',
      status: insertTask.status || 'pending',
      dueDate: insertTask.dueDate ? new Date(insertTask.dueDate as any) : null,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    if (!db) throw new Error('Database not available');

    const now = new Date();
    const updateData: any = { ...updates, updatedAt: now };

    // Handle dueDate conversion
    if (updateData.dueDate && typeof updateData.dueDate === 'string') {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    // Handle completedAt based on status
    if (updates.status === 'completed') {
      updateData.completedAt = now;
    } else if (updates.status && updates.status !== 'completed') {
      updateData.completedAt = null;
    }

    const [updated] = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    return updated || undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');
    await db.delete(tasks).where(eq(tasks.id, id));
    return true;
  }

  // ============================================
  // INVOICES
  // ============================================

  async getAllInvoices(): Promise<ProjectInvoice[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(projectInvoices);
  }

  async getInvoicesByProject(projectId: string): Promise<ProjectInvoice[]> {
    if (!db) throw new Error('Database not available');
    return await db.select().from(projectInvoices).where(eq(projectInvoices.projectId, projectId));
  }

  async getInvoice(id: string): Promise<ProjectInvoice | undefined> {
    if (!db) throw new Error('Database not available');
    const [invoice] = await db.select().from(projectInvoices).where(eq(projectInvoices.id, id));
    return invoice || undefined;
  }

  // Helper: sincronizza i campi fatturazione del progetto basandosi sulle fatture
  private async syncProjectInvoiceFields(projectId: string): Promise<void> {
    if (!db) return;

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
    if (!db) throw new Error('Database not available');

    const id = generateId();
    const now = new Date();

    const [invoice] = await db.insert(projectInvoices).values({
      id,
      ...insertInvoice,
      dataEmissione: insertInvoice.dataEmissione instanceof Date
        ? insertInvoice.dataEmissione
        : new Date(insertInvoice.dataEmissione as any),
      createdAt: now,
      updatedAt: now,
    }).returning();

    // Sincronizza i campi fatturazione del progetto
    await this.syncProjectInvoiceFields(insertInvoice.projectId);

    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<InsertProjectInvoice>): Promise<ProjectInvoice | undefined> {
    if (!db) throw new Error('Database not available');

    // Prima ottieni la fattura esistente per avere il projectId
    const existing = await this.getInvoice(id);
    if (!existing) return undefined;

    const now = new Date();
    const [updated] = await db.update(projectInvoices)
      .set({ ...updates, updatedAt: now })
      .where(eq(projectInvoices.id, id))
      .returning();

    // Sincronizza i campi fatturazione del progetto
    if (updated) {
      await this.syncProjectInvoiceFields(existing.projectId);
    }

    return updated || undefined;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    if (!db) throw new Error('Database not available');

    // Prima ottieni la fattura per avere il projectId
    const invoice = await this.getInvoice(id);
    const projectId = invoice?.projectId;

    await db.delete(projectInvoices).where(eq(projectInvoices.id, id));

    // Sincronizza i campi fatturazione del progetto
    if (projectId) {
      await this.syncProjectInvoiceFields(projectId);
    }

    return true;
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async exportAllData() {
    if (!db) throw new Error('Database not available');

    const [projectsData, clientsData, fileRoutingsData, systemConfigData,
           oneDriveMappingsData, filesIndexData, usersData, tasksData,
           communicationsData, deadlinesData, invoicesData, prestazioniData,
           salData, changelogData, budgetData, resourcesData, filtersData] = await Promise.all([
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
    if (!db) throw new Error('Database not available');

    if (mode === 'overwrite') {
      await this.clearAllData();
    }

    // Import in order respecting foreign keys
    if (data.users?.length) {
      for (const user of data.users) {
        await db.insert(users).values(user).onConflictDoNothing();
      }
    }

    if (data.clients?.length) {
      for (const clientRecord of data.clients) {
        await db.insert(clients).values(clientRecord).onConflictDoNothing();
      }
    }

    if (data.systemConfig?.length) {
      for (const config of data.systemConfig) {
        await db.insert(systemConfig).values(config).onConflictDoNothing();
      }
    }

    if (data.projects?.length) {
      for (const project of data.projects) {
        await db.insert(projects).values(project).onConflictDoNothing();
      }
    }

    if (data.oneDriveMappings?.length) {
      for (const mapping of data.oneDriveMappings) {
        await db.insert(oneDriveMappings).values(mapping).onConflictDoNothing();
      }
    }

    if (data.filesIndex?.length) {
      for (const file of data.filesIndex) {
        await db.insert(filesIndex).values(file).onConflictDoNothing();
      }
    }

    if (data.fileRoutings?.length) {
      for (const routing of data.fileRoutings) {
        await db.insert(fileRoutings).values(routing).onConflictDoNothing();
      }
    }

    if (data.tasks?.length) {
      for (const task of data.tasks) {
        await db.insert(tasks).values(task).onConflictDoNothing();
      }
    }

    if (data.communications?.length) {
      for (const comm of data.communications) {
        await db.insert(communications).values(comm).onConflictDoNothing();
      }
    }

    if (data.deadlines?.length) {
      for (const deadline of data.deadlines) {
        await db.insert(projectDeadlines).values(deadline).onConflictDoNothing();
      }
    }

    if (data.invoices?.length) {
      for (const invoice of data.invoices) {
        await db.insert(projectInvoices).values(invoice).onConflictDoNothing();
      }
    }

    if (data.prestazioni?.length) {
      for (const prestazione of data.prestazioni) {
        await db.insert(projectPrestazioni).values(prestazione).onConflictDoNothing();
      }
    }

    if (data.sal?.length) {
      for (const sal of data.sal) {
        await db.insert(projectSAL).values(sal).onConflictDoNothing();
      }
    }

    if (data.changelog?.length) {
      for (const entry of data.changelog) {
        await db.insert(projectChangelog).values(entry).onConflictDoNothing();
      }
    }

    if (data.budget?.length) {
      for (const budget of data.budget) {
        await db.insert(projectBudget).values(budget).onConflictDoNothing();
      }
    }

    if (data.resources?.length) {
      for (const resource of data.resources) {
        await db.insert(projectResources).values(resource).onConflictDoNothing();
      }
    }

    if (data.filters?.length) {
      for (const filter of data.filters) {
        await db.insert(savedFilters).values(filter).onConflictDoNothing();
      }
    }

    console.log('✅ All data imported to Turso');
  }

  async clearAllData() {
    if (!db) throw new Error('Database not available');

    // Delete in reverse order of dependencies
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
    // Don't delete users
  }

  private generateSafeAcronym(text: string): string {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }
}

// Export singleton instance
export const tursoStorage = new TursoStorage();
