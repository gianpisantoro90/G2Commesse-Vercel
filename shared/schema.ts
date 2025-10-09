import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  client: text("client").notNull(),
  clientId: text("client_id").references(() => clients.id), // Relazione con clients table
  city: text("city").notNull(),
  object: text("object").notNull(),
  year: integer("year").notNull(),
  template: text("template").notNull(), // 'LUNGO' or 'BREVE'
  status: text("status").notNull().default("in_corso"), // 'in_corso', 'conclusa', 'sospesa'
  tipoRapporto: text("tipo_rapporto").notNull().default("diretto"), // 'diretto', 'consulenza', 'subappalto', 'ati', 'partnership'
  committenteFinale: text("committente_finale"), // Nome proprietario/ente finale (opzionale)

  // Campi Fatturazione/Pagamento
  fatturato: boolean("fatturato").default(false), // Se è stato emesso documento fiscale
  numeroFattura: text("numero_fattura"), // Numero fattura/nota/parcella
  dataFattura: timestamp("data_fattura"), // Data emissione fattura
  importoFatturato: integer("importo_fatturato").default(0), // In centesimi di euro
  pagato: boolean("pagato").default(false), // Se il compenso è stato incassato
  dataPagamento: timestamp("data_pagamento"), // Data incasso effettivo
  importoPagato: integer("importo_pagato").default(0), // In centesimi di euro
  noteFatturazione: text("note_fatturazione"), // Note su fatturazione/pagamento

  createdAt: timestamp("created_at").defaultNow(),
  fsRoot: text("fs_root"),
  metadata: jsonb("metadata").default({}),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sigla: text("sigla").notNull().unique(),
  name: text("name").notNull(),
  city: text("city"),
  projectsCount: integer("projects_count").default(0),
});

export const fileRoutings = pgTable("file_routings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").references(() => projects.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  suggestedPath: text("suggested_path").notNull(),
  actualPath: text("actual_path"),
  confidence: integer("confidence").default(0), // 0-100
  method: text("method"), // 'ai', 'rules', 'learned'
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const oneDriveMappings = pgTable("onedrive_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectCode: text("project_code").notNull().references(() => projects.code),
  oneDriveFolderId: text("onedrive_folder_id").notNull(),
  oneDriveFolderName: text("onedrive_folder_name").notNull(),
  oneDriveFolderPath: text("onedrive_folder_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const filesIndex = pgTable("files_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driveItemId: text("drive_item_id").notNull().unique(), // OneDrive unique ID
  name: text("name").notNull(),
  path: text("path").notNull(), // Full OneDrive path
  size: integer("size").default(0),
  mimeType: text("mime_type"),
  lastModified: timestamp("last_modified"),
  projectCode: text("project_code").references(() => projects.code),
  parentFolderId: text("parent_folder_id"), // OneDrive parent folder ID
  isFolder: boolean("is_folder").default(false),
  webUrl: text("web_url"), // OneDrive web URL for direct access
  downloadUrl: text("download_url"), // OneDrive download URL
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id),
  type: text("type").notNull(), // 'email', 'pec', 'raccomandata', 'telefono', 'meeting', 'nota_interna'
  direction: text("direction").notNull(), // 'incoming', 'outgoing', 'internal'
  subject: text("subject").notNull(),
  body: text("body"),
  recipient: text("recipient"),
  sender: text("sender"),
  isImportant: boolean("is_important").default(false),
  communicationDate: timestamp("communication_date").notNull(),
  tags: jsonb("tags").default([]),
  attachments: jsonb("attachments").default([]), // Array of {name: string, size: number}
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
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

// Prestazioni professionali metadata interfaces
export interface ProjectPrestazioni {
  prestazioni?: Array<'progettazione' | 'dl' | 'csp' | 'cse' | 'contabilita' | 'collaudo' | 'perizia' | 'pratiche'>;
  livelloProgettazione?: Array<'pfte' | 'definitivo' | 'esecutivo' | 'variante'>;
  classeDM143?: string; // Es: "E22", "IA03", "S05"
  importoOpere?: number; // Importo lavori base calcolo parcella
  importoServizio?: number; // Importo servizio professionale al netto
  percentualeParcella?: number; // % parcella applicata
}

export interface ProjectMetadata extends ProjectPrestazioni {
  [key: string]: any; // Mantieni flessibilità per altri metadata futuri
}

// Zod schemas per validazione prestazioni
export const prestazioniSchema = z.object({
  prestazioni: z.array(z.enum(['progettazione', 'dl', 'csp', 'cse', 'contabilita', 'collaudo', 'perizia', 'pratiche'])).optional(),
  livelloProgettazione: z.array(z.enum(['pfte', 'definitivo', 'esecutivo', 'variante'])).optional(),
  classeDM143: z.string().optional(),
  importoOpere: z.number().min(0).optional(),
  importoServizio: z.number().min(0).optional(),
  percentualeParcella: z.number().min(0).max(100).optional(),
}).refine((data) => {
  // Se progettazione è selezionata, richiedere livello
  if (data.prestazioni?.includes('progettazione') && (!data.livelloProgettazione || data.livelloProgettazione.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Se la progettazione è selezionata, è necessario specificare il livello"
});

// Types
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

// ============================================
// NUOVE TABELLE PER FUNZIONALITÀ AVANZATE
// ============================================

// Tags personalizzabili per commesse
export const projectTags = pgTable("project_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#3B82F6"), // Hex color
  icon: text("icon"), // Emoji or icon name
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relazione molti-a-molti tra progetti e tags
export const projectTagsRelation = pgTable("project_tags_relation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => projectTags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Categorie tematiche per commesse
export const projectCategories = pgTable("project_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#10B981"),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relazione progetto-categoria (una categoria per progetto)
export const projectCategoryRelation = pgTable("project_category_relation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  categoryId: text("category_id").notNull().references(() => projectCategories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scadenze e milestone per commesse
export const projectDeadlines = pgTable("project_deadlines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date").notNull(),
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'overdue', 'cancelled'
  type: text("type").notNull().default("general"), // 'general', 'deposito', 'collaudo', 'scadenza_assicurazione', 'milestone'
  notifyDaysBefore: integer("notify_days_before").default(7),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Registro comunicazioni per commessa
export const projectCommunications = pgTable("project_communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'email', 'pec', 'raccomandata', 'telefono', 'meeting', 'nota_interna'
  direction: text("direction").notNull().default("outgoing"), // 'incoming', 'outgoing', 'internal'
  subject: text("subject").notNull(),
  body: text("body"),
  recipient: text("recipient"), // Destinatario/Mittente
  sender: text("sender"),
  attachments: jsonb("attachments").default([]), // Array di {name, path, size}
  tags: jsonb("tags").default([]), // Array di string per categorizzazione
  isImportant: boolean("is_important").default(false),
  communicationDate: timestamp("communication_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"), // Username dell'utente
});

// Gestione SAL (Stati Avanzamento Lavori)
export const projectSAL = pgTable("project_sal", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  numero: integer("numero").notNull(), // Numero progressivo SAL
  descrizione: text("descrizione"),
  percentualeAvanzamento: integer("percentuale_avanzamento").notNull(), // 0-100
  importoLavori: integer("importo_lavori").default(0), // In centesimi di euro
  importoContabilizzato: integer("importo_contabilizzato").default(0),
  dataEmissione: timestamp("data_emissione").notNull(),
  dataApprovazione: timestamp("data_approvazione"),
  stato: text("stato").notNull().default("bozza"), // 'bozza', 'emesso', 'approvato', 'fatturato'
  note: text("note"),
  attachments: jsonb("attachments").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fatturazione
export const projectInvoices = pgTable("project_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  salId: text("sal_id").references(() => projectSAL.id), // Opzionale: collegamento a SAL
  numeroFattura: text("numero_fattura").notNull(),
  dataEmissione: timestamp("data_emissione").notNull(),
  importoNetto: integer("importo_netto").notNull(), // In centesimi
  importoIVA: integer("importo_iva").notNull(),
  importoTotale: integer("importo_totale").notNull(),
  aliquotaIVA: integer("aliquota_iva").default(22), // Percentuale
  ritenuta: integer("ritenuta").default(0), // In centesimi
  stato: text("stato").notNull().default("emessa"), // 'emessa', 'pagata', 'parzialmente_pagata', 'scaduta'
  scadenzaPagamento: timestamp("scadenza_pagamento"),
  dataPagamento: timestamp("data_pagamento"),
  note: text("note"),
  attachmentPath: text("attachment_path"), // Path OneDrive della fattura
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Changelog - Storico modifiche progetti
export const projectChangelog = pgTable("project_changelog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'created', 'updated', 'deleted', 'status_changed'
  field: text("field"), // Campo modificato (es: 'status', 'client', 'metadata.prestazioni')
  oldValue: text("old_value"), // Valore precedente (JSON stringificato se complesso)
  newValue: text("new_value"), // Nuovo valore
  description: text("description"), // Descrizione human-readable della modifica
  userId: text("user_id"), // ID utente che ha fatto la modifica
  userName: text("user_name"), // Nome utente
  createdAt: timestamp("created_at").defaultNow(),
});

// Budget e costi per commessa
export const projectBudget = pgTable("project_budget", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  budgetOreTotale: integer("budget_ore_totale").default(0), // Ore stimate totali
  oreConsuntivate: integer("ore_consuntivate").default(0), // Ore effettivamente lavorate
  costiConsulenze: integer("costi_consulenze").default(0), // In centesimi
  costiRilievi: integer("costi_rilievi").default(0),
  altriCosti: integer("altri_costi").default(0),
  costiTotali: integer("costi_totali").default(0),
  ricaviPrevisti: integer("ricavi_previsti").default(0),
  ricaviEffettivi: integer("ricavi_effettivi").default(0),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Assegnazione risorse/personale a commesse
export const projectResources = pgTable("project_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  userEmail: text("user_email"),
  role: text("role").notNull(), // 'progettista', 'dl', 'csp', 'cse', 'collaudatore', 'tecnico'
  oreAssegnate: integer("ore_assegnate").default(0),
  oreLavorate: integer("ore_lavorate").default(0),
  costoOrario: integer("costo_orario").default(0), // In centesimi
  isResponsabile: boolean("is_responsabile").default(false),
  dataInizio: timestamp("data_inizio"),
  dataFine: timestamp("data_fine"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Filtri salvati per ricerca
export const savedFilters = pgTable("saved_filters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  filterConfig: jsonb("filter_config").notNull(), // Configurazione filtri salvata
  isDefault: boolean("is_default").default(false),
  userId: text("user_id"), // Per supporto multi-utente futuro
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// INSERT SCHEMAS PER NUOVE TABELLE
// ============================================

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

export const insertProjectCommunicationSchema = createInsertSchema(projectCommunications).omit({
  id: true,
  createdAt: true,
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

// ============================================
// TYPES PER NUOVE TABELLE
// ============================================

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
export type Deadline = ProjectDeadline; // Alias for convenience

export type InsertProjectCommunication = z.infer<typeof insertProjectCommunicationSchema>;
export type ProjectCommunication = typeof projectCommunications.$inferSelect;

export type InsertProjectSAL = z.infer<typeof insertProjectSALSchema>;
export type ProjectSAL = typeof projectSAL.$inferSelect;

export type InsertProjectInvoice = z.infer<typeof insertProjectInvoiceSchema>;
export type ProjectInvoice = typeof projectInvoices.$inferSelect;

export type InsertProjectChangelog = z.infer<typeof insertProjectChangelogSchema>;
export type ProjectChangelog = typeof projectChangelog.$inferSelect;

export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;
export type ProjectBudget = typeof projectBudget.$inferSelect;

export type InsertProjectResource = z.infer<typeof insertProjectResourceSchema>;
export type ProjectResource = typeof projectResources.$inferSelect;

export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedFilter = typeof savedFilters.$inferSelect;
