/**
 * SQLite Schema for Turso Database
 * Converted from PostgreSQL schema for zero-cost deployment on Vercel + Turso
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Helper for UUID generation (used in application code, not DB)
export const generateId = () => crypto.randomUUID();

export const aiConfigSchema = z.object({
  provider: z.enum(['anthropic', 'deepseek']).default('anthropic'),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  autoRouting: z.boolean().optional().default(true),
  contentAnalysis: z.boolean().optional().default(true),
  learningMode: z.boolean().optional().default(true),
});

export type AIConfig = z.infer<typeof aiConfigSchema>;

export const aiConfigResponseSchema = aiConfigSchema.omit({ apiKey: true });
export type AIConfigResponse = z.infer<typeof aiConfigResponseSchema>;

// ============================================
// CLIENTS TABLE
// ============================================
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  sigla: text("sigla").notNull().unique(),
  name: text("name").notNull(),
  partitaIva: text("partita_iva"),
  codiceFiscale: text("codice_fiscale"),
  formaGiuridica: text("forma_giuridica"),
  indirizzo: text("indirizzo"),
  cap: text("cap"),
  city: text("city"),
  provincia: text("provincia"),
  email: text("email"),
  telefono: text("telefono"),
  pec: text("pec"),
  codiceDestinatario: text("codice_destinatario"),
  nomeReferente: text("nome_referente"),
  ruoloReferente: text("ruolo_referente"),
  emailReferente: text("email_referente"),
  telefonoReferente: text("telefono_referente"),
  note: text("note"),
  projectsCount: integer("projects_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECTS TABLE
// ============================================
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  code: text("code").notNull().unique(),
  client: text("client").notNull(),
  clientId: text("client_id").references(() => clients.id),
  city: text("city").notNull(),
  object: text("object").notNull(),
  year: integer("year").notNull(),
  template: text("template").notNull(),
  status: text("status").notNull().default("in_corso"),
  tipoRapporto: text("tipo_rapporto").notNull().default("diretto"),
  committenteFinale: text("committente_finale"),

  // Campi CRE (Certificazione di Buona Esecuzione)
  cig: text("cig"), // Codice Identificativo Gara
  numeroContratto: text("numero_contratto"), // Numero Contratto/Accordo Quadro
  dataInizioCommessa: integer("data_inizio_commessa", { mode: "timestamp" }), // Data inizio esecuzione
  dataFineCommessa: integer("data_fine_commessa", { mode: "timestamp" }), // Data fine esecuzione

  fatturato: integer("fatturato", { mode: "boolean" }).default(false),
  numeroFattura: text("numero_fattura"),
  dataFattura: integer("data_fattura", { mode: "timestamp" }),
  importoFatturato: integer("importo_fatturato").default(0),
  pagato: integer("pagato", { mode: "boolean" }).default(false),
  dataPagamento: integer("data_pagamento", { mode: "timestamp" }),
  importoPagato: integer("importo_pagato").default(0),
  noteFatturazione: text("note_fatturazione"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  fsRoot: text("fs_root"),
  metadata: text("metadata", { mode: "json" }).default("{}"),
});

// ============================================
// FILE ROUTINGS TABLE
// ============================================
export const fileRoutings = sqliteTable("file_routings", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").references(() => projects.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  suggestedPath: text("suggested_path").notNull(),
  actualPath: text("actual_path"),
  confidence: integer("confidence").default(0),
  method: text("method"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// SYSTEM CONFIG TABLE
// ============================================
export const systemConfig = sqliteTable("system_config", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// ONEDRIVE MAPPINGS TABLE
// ============================================
export const oneDriveMappings = sqliteTable("onedrive_mappings", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectCode: text("project_code").notNull().references(() => projects.code),
  oneDriveFolderId: text("onedrive_folder_id").notNull(),
  oneDriveFolderName: text("onedrive_folder_name").notNull(),
  oneDriveFolderPath: text("onedrive_folder_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// FILES INDEX TABLE
// ============================================
export const filesIndex = sqliteTable("files_index", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  driveItemId: text("drive_item_id").notNull().unique(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  size: integer("size").default(0),
  mimeType: text("mime_type"),
  lastModified: integer("last_modified", { mode: "timestamp" }),
  projectCode: text("project_code").references(() => projects.code),
  parentFolderId: text("parent_folder_id"),
  isFolder: integer("is_folder", { mode: "boolean" }).default(false),
  webUrl: text("web_url"),
  downloadUrl: text("download_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// COMMUNICATIONS TABLE
// ============================================
export const communications = sqliteTable("communications", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").references(() => projects.id),
  type: text("type").notNull(),
  direction: text("direction").notNull(),
  subject: text("subject").notNull(),
  body: text("body"),
  recipient: text("recipient"),
  sender: text("sender"),
  isImportant: integer("is_important", { mode: "boolean" }).default(false),
  communicationDate: integer("communication_date", { mode: "timestamp" }).notNull(),
  tags: text("tags", { mode: "json" }).default("[]"),
  attachments: text("attachments", { mode: "json" }).default("[]"),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  emailMessageId: text("email_message_id"),
  emailHeaders: text("email_headers", { mode: "json" }),
  emailHtml: text("email_html"),
  emailText: text("email_text"),
  autoImported: integer("auto_imported", { mode: "boolean" }).default(false),
  aiSuggestions: text("ai_suggestions", { mode: "json" }),
  aiSuggestionsStatus: text("ai_suggestions_status", { mode: "json" }),
  aiTasksStatus: text("ai_tasks_status", { mode: "json" }),
  aiDeadlinesStatus: text("ai_deadlines_status", { mode: "json" }),
  importedAt: integer("imported_at", { mode: "timestamp" }),
});

// ============================================
// USERS TABLE
// ============================================
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT TAGS TABLE
// ============================================
export const projectTags = sqliteTable("project_tags", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#3B82F6"),
  icon: text("icon"),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT TAGS RELATION TABLE
// ============================================
export const projectTagsRelation = sqliteTable("project_tags_relation", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id),
  tagId: text("tag_id").notNull().references(() => projectTags.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT CATEGORIES TABLE
// ============================================
export const projectCategories = sqliteTable("project_categories", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#10B981"),
  icon: text("icon"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT CATEGORY RELATION TABLE
// ============================================
export const projectCategoryRelation = sqliteTable("project_category_relation", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id).unique(),
  categoryId: text("category_id").notNull().references(() => projectCategories.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT DEADLINES TABLE
// ============================================
export const projectDeadlines = sqliteTable("project_deadlines", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  type: text("type").notNull().default("general"),
  notifyDaysBefore: integer("notify_days_before").default(7),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT SAL TABLE
// ============================================
export const projectSAL = sqliteTable("project_sal", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id),
  numero: integer("numero").notNull(),
  descrizione: text("descrizione"),
  percentualeAvanzamento: integer("percentuale_avanzamento").notNull(),
  importoLavori: integer("importo_lavori").default(0),
  importoContabilizzato: integer("importo_contabilizzato").default(0),
  dataEmissione: integer("data_emissione", { mode: "timestamp" }).notNull(),
  dataApprovazione: integer("data_approvazione", { mode: "timestamp" }),
  stato: text("stato").notNull().default("bozza"),
  note: text("note"),
  attachments: text("attachments", { mode: "json" }).default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT INVOICES TABLE
// ============================================
export const projectInvoices = sqliteTable("project_invoices", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id),
  salId: text("sal_id").references(() => projectSAL.id),
  numeroFattura: text("numero_fattura").notNull(),
  dataEmissione: integer("data_emissione", { mode: "timestamp" }).notNull(),
  importoNetto: integer("importo_netto").notNull(),
  cassaPrevidenziale: integer("cassa_previdenziale").default(0),
  importoIVA: integer("importo_iva").notNull(),
  importoTotale: integer("importo_totale").notNull(),
  importoParcella: integer("importo_parcella").default(0),
  aliquotaIVA: integer("aliquota_iva").default(22),
  ritenuta: integer("ritenuta").default(0),
  stato: text("stato").notNull().default("emessa"),
  scadenzaPagamento: integer("scadenza_pagamento", { mode: "timestamp" }),
  dataPagamento: integer("data_pagamento", { mode: "timestamp" }),
  note: text("note"),
  attachmentPath: text("attachment_path"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PRESTAZIONI PROFESSIONALI - TRACKING DETTAGLIATO
// ============================================

// Tipi e stati esportati da schema.ts principale
export const PRESTAZIONE_TIPI = ['progettazione', 'dl', 'csp', 'cse', 'contabilita', 'collaudo', 'perizia', 'pratiche'] as const;
export type PrestazioneTipo = typeof PRESTAZIONE_TIPI[number];

export const PRESTAZIONE_STATI = ['da_iniziare', 'in_corso', 'completata', 'fatturata', 'pagata'] as const;
export type PrestazioneStato = typeof PRESTAZIONE_STATI[number];

export const LIVELLI_PROGETTAZIONE = ['pfte', 'definitivo', 'esecutivo', 'variante'] as const;
export type LivelloProgettazione = typeof LIVELLI_PROGETTAZIONE[number];

export const projectPrestazioni = sqliteTable("project_prestazioni", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id),

  // Tipo e dettagli prestazione
  tipo: text("tipo").notNull(), // 'progettazione', 'dl', 'csp', 'cse', 'contabilita', 'collaudo', 'perizia', 'pratiche'
  livelloProgettazione: text("livello_progettazione"), // Solo per 'progettazione'
  descrizione: text("descrizione"),

  // Stato e ciclo di vita
  stato: text("stato").notNull().default("da_iniziare"), // 'da_iniziare', 'in_corso', 'completata', 'fatturata', 'pagata'
  dataInizio: integer("data_inizio", { mode: "timestamp" }),
  dataCompletamento: integer("data_completamento", { mode: "timestamp" }),
  dataFatturazione: integer("data_fatturazione", { mode: "timestamp" }),
  dataPagamento: integer("data_pagamento", { mode: "timestamp" }),

  // Importi (in centesimi di euro)
  importoPrevisto: integer("importo_previsto").default(0),
  importoFatturato: integer("importo_fatturato").default(0),
  importoPagato: integer("importo_pagato").default(0),

  // Collegamento a fattura specifica
  invoiceId: text("invoice_id").references(() => projectInvoices.id),

  // Note
  note: text("note"),

  // Audit
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT CHANGELOG TABLE
// ============================================
export const projectChangelog = sqliteTable("project_changelog", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id),
  action: text("action").notNull(),
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  description: text("description"),
  userId: text("user_id"),
  userName: text("user_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT BUDGET TABLE
// ============================================
export const projectBudget = sqliteTable("project_budget", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id).unique(),
  budgetOreTotale: integer("budget_ore_totale").default(0),
  oreConsuntivate: integer("ore_consuntivate").default(0),
  costiConsulenze: integer("costi_consulenze").default(0),
  costiRilievi: integer("costi_rilievi").default(0),
  altriCosti: integer("altri_costi").default(0),
  costiTotali: integer("costi_totali").default(0),
  ricaviPrevisti: integer("ricavi_previsti").default(0),
  ricaviEffettivi: integer("ricavi_effettivi").default(0),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// PROJECT RESOURCES TABLE
// ============================================
export const projectResources = sqliteTable("project_resources", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  projectId: text("project_id").notNull().references(() => projects.id),
  userName: text("user_name").notNull(),
  userEmail: text("user_email"),
  role: text("role").notNull(),
  oreAssegnate: integer("ore_assegnate").default(0),
  oreLavorate: integer("ore_lavorate").default(0),
  costoOrario: integer("costo_orario").default(0),
  isResponsabile: integer("is_responsabile", { mode: "boolean" }).default(false),
  dataInizio: integer("data_inizio", { mode: "timestamp" }),
  dataFine: integer("data_fine", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// SAVED FILTERS TABLE
// ============================================
export const savedFilters = sqliteTable("saved_filters", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  name: text("name").notNull(),
  description: text("description"),
  filterConfig: text("filter_config", { mode: "json" }).notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// TASKS TABLE
// ============================================
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  title: text("title").notNull(),
  description: text("description"),
  notes: text("notes"),
  projectId: text("project_id").references(() => projects.id),
  assignedToId: text("assigned_to_id").references(() => users.id),
  createdById: text("created_by_id").notNull().references(() => users.id),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ============================================
// INSERT SCHEMAS
// ============================================

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
}).extend({
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  pec: z.string().email("PEC non valida").optional().or(z.literal("")),
  emailReferente: z.string().email("Email referente non valida").optional().or(z.literal("")),
  partitaIva: z.string().max(16, "Partita IVA troppo lunga").optional().or(z.literal("")),
  codiceFiscale: z.string().max(16, "Codice Fiscale troppo lungo").optional().or(z.literal("")),
  codiceDestinatario: z.string().max(7, "Codice Destinatario deve essere di 7 caratteri").optional().or(z.literal("")),
  cap: z.string().max(5, "CAP non valido").optional().or(z.literal("")),
  provincia: z.string().max(2, "Provincia deve essere di 2 caratteri").optional().or(z.literal("")),
});

export const insertFileRoutingSchema = createInsertSchema(fileRoutings).omit({
  id: true,
  createdAt: true,
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertOneDriveMappingSchema = createInsertSchema(oneDriveMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFilesIndexSchema = createInsertSchema(filesIndex).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunicationSchema = createInsertSchema(communications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createUserSchema = insertUserSchema.omit({
  passwordHash: true,
}).extend({
  password: z.string().min(8, "La password deve essere di almeno 8 caratteri"),
});

export const insertProjectTagSchema = createInsertSchema(projectTags).omit({
  id: true,
  createdAt: true,
});

export const insertProjectTagsRelationSchema = createInsertSchema(projectTagsRelation).omit({
  id: true,
  createdAt: true,
});

export const insertProjectCategorySchema = createInsertSchema(projectCategories).omit({
  id: true,
  createdAt: true,
});

export const insertProjectCategoryRelationSchema = createInsertSchema(projectCategoryRelation).omit({
  id: true,
  createdAt: true,
});

export const insertProjectDeadlineSchema = createInsertSchema(projectDeadlines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSALSchema = createInsertSchema(projectSAL).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectInvoiceSchema = createInsertSchema(projectInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema inserimento prestazioni con validazione
export const insertProjectPrestazioneSchema = createInsertSchema(projectPrestazioni).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  tipo: z.enum(PRESTAZIONE_TIPI),
  stato: z.enum(PRESTAZIONE_STATI).optional().default('da_iniziare'),
  livelloProgettazione: z.enum(LIVELLI_PROGETTAZIONE).optional().nullable(),
  dataInizio: z.coerce.date().optional().nullable(),
  dataCompletamento: z.coerce.date().optional().nullable(),
  dataFatturazione: z.coerce.date().optional().nullable(),
  dataPagamento: z.coerce.date().optional().nullable(),
});

// Schema per aggiornamento stato prestazione
export const updatePrestazioneStatoSchema = z.object({
  stato: z.enum(PRESTAZIONE_STATI),
  dataCompletamento: z.coerce.date().optional().nullable(),
  dataFatturazione: z.coerce.date().optional().nullable(),
  dataPagamento: z.coerce.date().optional().nullable(),
  importoFatturato: z.number().min(0).optional(),
  importoPagato: z.number().min(0).optional(),
  invoiceId: z.string().optional().nullable(),
  note: z.string().optional(),
});

export const insertProjectChangelogSchema = createInsertSchema(projectChangelog).omit({
  id: true,
  createdAt: true,
});

export const insertProjectBudgetSchema = createInsertSchema(projectBudget).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectResourceSchema = createInsertSchema(projectResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedFilterSchema = createInsertSchema(savedFilters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  dueDate: z.coerce.date().nullable().optional(),
});

// ============================================
// TYPES
// ============================================

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertFileRouting = z.infer<typeof insertFileRoutingSchema>;
export type FileRouting = typeof fileRoutings.$inferSelect;

export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

export type InsertOneDriveMapping = z.infer<typeof insertOneDriveMappingSchema>;
export type OneDriveMapping = typeof oneDriveMappings.$inferSelect;

export type InsertFilesIndex = z.infer<typeof insertFilesIndexSchema>;
export type FilesIndex = typeof filesIndex.$inferSelect;

export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type Communication = typeof communications.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProjectTag = z.infer<typeof insertProjectTagSchema>;
export type ProjectTag = typeof projectTags.$inferSelect;

export type InsertProjectTagsRelation = z.infer<typeof insertProjectTagsRelationSchema>;
export type ProjectTagsRelation = typeof projectTagsRelation.$inferSelect;

export type InsertProjectCategory = z.infer<typeof insertProjectCategorySchema>;
export type ProjectCategory = typeof projectCategories.$inferSelect;

export type InsertProjectCategoryRelation = z.infer<typeof insertProjectCategoryRelationSchema>;
export type ProjectCategoryRelation = typeof projectCategoryRelation.$inferSelect;

export type InsertProjectDeadline = z.infer<typeof insertProjectDeadlineSchema>;
export type ProjectDeadline = typeof projectDeadlines.$inferSelect;
export type Deadline = ProjectDeadline;

export type InsertProjectSAL = z.infer<typeof insertProjectSALSchema>;
export type ProjectSAL = typeof projectSAL.$inferSelect;

export type InsertProjectInvoice = z.infer<typeof insertProjectInvoiceSchema>;
export type ProjectInvoice = typeof projectInvoices.$inferSelect;

// Prestazioni professionali types
export type InsertProjectPrestazione = z.infer<typeof insertProjectPrestazioneSchema>;
export type ProjectPrestazione = typeof projectPrestazioni.$inferSelect;
export type UpdatePrestazioneStato = z.infer<typeof updatePrestazioneStatoSchema>;

// Helper type per prestazione con info progetto (per dashboard)
export interface PrestazioneWithProject extends ProjectPrestazione {
  project?: {
    id: string;
    code: string;
    client: string;
    object: string;
  };
  invoice?: {
    id: string;
    numeroFattura: string;
    stato: string;
  };
}

// Statistiche prestazioni per dashboard
export interface PrestazioniStats {
  totale: number;
  daIniziare: number;
  inCorso: number;
  completate: number;
  fatturate: number;
  pagate: number;
  completateNonFatturate: number;
  fatturateNonPagate: number;
  importoTotalePrevisto: number;
  importoTotaleFatturato: number;
  importoTotalePagato: number;
  importoDaFatturare: number;
  importoDaIncassare: number;
}

export type InsertProjectChangelog = z.infer<typeof insertProjectChangelogSchema>;
export type ProjectChangelog = typeof projectChangelog.$inferSelect;

export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;
export type ProjectBudget = typeof projectBudget.$inferSelect;

export type InsertProjectResource = z.infer<typeof insertProjectResourceSchema>;
export type ProjectResource = typeof projectResources.$inferSelect;

export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedFilter = typeof savedFilters.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// ============================================
// PRESTAZIONI METADATA INTERFACES
// ============================================

// Singola classificazione DM 143/2013 con importo associato
export interface ClassificazioneDM143 {
  codice: string; // Es: "E.22", "IA.03", "S.05" (TAVOLA Z-1)
  importo: number; // Importo opere per questa categoria
}

export interface ProjectPrestazioni {
  prestazioni?: Array<'progettazione' | 'dl' | 'csp' | 'cse' | 'contabilita' | 'collaudo' | 'perizia' | 'pratiche'>;
  livelloProgettazione?: Array<'pfte' | 'definitivo' | 'esecutivo' | 'variante'>;

  // Nuova struttura: supporto per multiple classificazioni con importi individuali
  classificazioniDM143?: ClassificazioneDM143[]; // Array di classificazioni con importi

  // Retrocompatibilità: campi singoli (deprecati in favore di classificazioniDM143)
  classeDM143?: string; // Es: "E.22", "IA.03", "S.05" (TAVOLA Z-1) - DEPRECATED
  importoOpere?: number; // Importo lavori base calcolo parcella - DEPRECATED (ora calcolato come somma classificazioni)

  importoServizio?: number;
  percentualeParcella?: number;
}

export interface ProjectMetadata extends ProjectPrestazioni {
  [key: string]: any;
}

// Zod schema per singola classificazione DM 143/2013
export const classificazioneDM143Schema = z.object({
  codice: z.string().regex(/^[A-Z]{1,2}\.?[0-9]{1,2}$/, 'Formato classe DM 143/2013 non valido (es: E.22, IA.03, S.05)'),
  importo: z.number().min(0, 'L\'importo deve essere maggiore o uguale a 0'),
});

export const prestazioniSchema = z.object({
  prestazioni: z.array(z.enum(['progettazione', 'dl', 'csp', 'cse', 'contabilita', 'collaudo', 'perizia', 'pratiche'])).optional(),
  livelloProgettazione: z.array(z.enum(['pfte', 'definitivo', 'esecutivo', 'variante'])).optional(),

  // Nuova struttura: supporto per multiple classificazioni
  classificazioniDM143: z.array(classificazioneDM143Schema).optional(),

  // Retrocompatibilità: campi singoli (deprecati)
  classeDM143: z.string().optional(),
  importoOpere: z.number().min(0).optional(),

  importoServizio: z.number().min(0).optional(),
  percentualeParcella: z.number().min(0).max(100).optional(),
}).refine((data) => {
  if (data.prestazioni?.includes('progettazione') && (!data.livelloProgettazione || data.livelloProgettazione.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Se la progettazione è selezionata, è necessario specificare il livello"
});
