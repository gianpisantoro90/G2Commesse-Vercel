import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
// AI FEATURE CONFIGURATION - Per-feature provider/model routing
// ============================================

export const AI_FEATURES = [
  'email_analysis',
  'chat_assistant',
  'project_health',
  'proactive_alerts',
  'financial_forecast',
  'report_generation',
] as const;
export type AIFeature = typeof AI_FEATURES[number];

export const aiFeatureConfigSchema = z.object({
  feature: z.enum(AI_FEATURES),
  provider: z.enum(['anthropic', 'deepseek']),
  model: z.string().min(1),
  enabled: z.boolean().default(true),
});
export type AIFeatureConfig = z.infer<typeof aiFeatureConfigSchema>;

// Auto-approval configuration
export const aiAutoApprovalSchema = z.object({
  enabled: z.boolean().default(false),
  emailAssignmentThreshold: z.number().min(0).max(1).default(0.95),
  taskCreationThreshold: z.number().min(0).max(1).default(0.90),
  deadlineCreationThreshold: z.number().min(0).max(1).default(0.90),
});
export type AIAutoApproval = z.infer<typeof aiAutoApprovalSchema>;

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  client: text("client").notNull(),
  clientId: text("client_id").references(() => clients.id), // Relazione con clients table
  city: text("city").notNull(),
  object: text("object").notNull(), // Oggetto abbreviato (per cartelle e tabella)
  oggettoCompleto: text("oggetto_completo"), // Oggetto completo esteso (per CRE)
  year: integer("year").notNull(),
  template: text("template").notNull(), // 'LUNGO' or 'BREVE'
  status: text("status").notNull().default("in corso"), // 'in corso', 'conclusa', 'sospesa'
  tipoRapporto: text("tipo_rapporto").notNull().default("diretto"), // 'diretto', 'consulenza', 'subappalto', 'ati', 'partnership'
  committenteFinale: text("committente_finale"), // Nome proprietario/ente finale (opzionale)

  // Campi CRE (Certificazione di Buona Esecuzione)
  cig: text("cig"), // Codice Identificativo Gara
  numeroContratto: text("numero_contratto"), // Numero Contratto/Accordo Quadro
  dataInizioCommessa: timestamp("data_inizio_commessa"), // Data inizio esecuzione
  dataFineCommessa: timestamp("data_fine_commessa"), // Data fine esecuzione
  creArchiviato: boolean("cre_archiviato").default(false), // CRE firmato ricevuto e archiviato
  creDataArchiviazione: timestamp("cre_data_archiviazione"), // Data ricezione CRE firmato

  // Campi Fatturazione/Pagamento
  fatturato: boolean("fatturato").default(false), // Se è stato emesso documento fiscale
  numeroFattura: text("numero_fattura"), // Numero fattura/nota/parcella
  dataFattura: timestamp("data_fattura"), // Data emissione fattura
  importoFatturato: integer("importo_fatturato").default(0), // In centesimi di euro
  pagato: boolean("pagato").default(false), // Se il compenso è stato incassato
  dataPagamento: timestamp("data_pagamento"), // Data incasso effettivo
  importoPagato: integer("importo_pagato").default(0), // In centesimi di euro
  noteFatturazione: text("note_fatturazione"), // Note su fatturazione/pagamento

  // Nuovo: Stato di fatturazione unificato (calcolato automaticamente)
  billingStatus: text("billing_status").default("da_fatturare"), // 'da_fatturare', 'parzialmente_fatturato', 'fatturato', 'parzialmente_pagato', 'pagato'

  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata").default({}),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sigla: text("sigla").notNull().unique(),
  name: text("name").notNull(), // Ragione sociale

  // Dati Anagrafici
  partitaIva: text("partita_iva"),
  codiceFiscale: text("codice_fiscale"),
  formaGiuridica: text("forma_giuridica"), // SRL, SPA, Ditta individuale, Ente pubblico, Privato, etc.

  // Indirizzo completo
  indirizzo: text("indirizzo"),
  cap: text("cap"),
  city: text("city"), // Città
  provincia: text("provincia"),

  // Contatti
  email: text("email"),
  telefono: text("telefono"),
  pec: text("pec"),

  // Dati Amministrativi/Fatturazione
  codiceDestinatario: text("codice_destinatario"), // SDI per fatturazione elettronica

  // Referente principale
  nomeReferente: text("nome_referente"),
  ruoloReferente: text("ruolo_referente"),
  emailReferente: text("email_referente"),
  telefonoReferente: text("telefono_referente"),

  // Altro
  note: text("note"),
  projectsCount: integer("projects_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
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
  projectCode: text("project_code").notNull().references(() => projects.code, { onUpdate: "cascade", onDelete: "cascade" }),
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
  projectCode: text("project_code").references(() => projects.code, { onUpdate: "cascade", onDelete: "set null" }),
  parentFolderId: text("parent_folder_id"), // OneDrive parent folder ID
  isFolder: boolean("is_folder").default(false),
  webUrl: text("web_url"), // OneDrive web URL for direct access
  downloadUrl: text("download_url"), // OneDrive download URL
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").references(() => projects.id), // Nullable to allow unassigned communications
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

  // Email-specific fields for email integration
  emailMessageId: text("email_message_id"),
  emailHeaders: jsonb("email_headers"),
  emailHtml: text("email_html"),
  emailText: text("email_text"),
  autoImported: boolean("auto_imported").default(false),
  aiSuggestions: jsonb("ai_suggestions"), // AI analysis with projectMatches array and suggestedTasks
  aiSuggestionsStatus: jsonb("ai_suggestions_status"),
  aiTasksStatus: jsonb("ai_tasks_status"), // Status for each suggested task (approved/dismissed with taskId)
  aiDeadlinesStatus: jsonb("ai_deadlines_status"), // Status for each suggested deadline (approved/dismissed with deadlineId)
  importedAt: timestamp("imported_at"),
});

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  dataInizioCommessa: true, // Derivato automaticamente dalle prestazioni
  dataFineCommessa: true, // Derivato automaticamente dalle prestazioni
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
}).extend({
  // Validazioni personalizzate
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

// Singola classificazione DM 17/06/2016 con importi associati
export interface ClassificazioneDM2016 {
  codice: string; // Es: "E.22", "IA.03", "S.05" (TAVOLA Z-1)
  importo: number; // Importo opere per questa categoria (retrocompatibilità)
  importoOpere?: number; // Importo opere per questa categoria (alias di importo)
  importoServizio?: number; // Importo servizio professionale per questa categoria
}

// Prestazioni professionali metadata interfaces
export interface ProjectPrestazioni {
  prestazioni?: Array<'progettazione' | 'dl' | 'csp' | 'cse' | 'contabilita' | 'collaudo' | 'perizia' | 'pratiche'>;
  livelloProgettazione?: Array<'pfte' | 'definitivo' | 'esecutivo' | 'variante'>;

  // Nuova struttura: supporto per multiple classificazioni con importi individuali
  classificazioniDM2016?: ClassificazioneDM2016[]; // Array di classificazioni con importi

  // Retrocompatibilità: campi singoli (deprecati in favore di classificazioniDM2016)
  classeDM2016?: string; // Es: "E.22", "IA.03", "S.05" (TAVOLA Z-1) - DEPRECATED
  importoOpere?: number; // Importo lavori base calcolo parcella - DEPRECATED (ora calcolato come somma classificazioni)

  importoServizio?: number; // Importo servizio professionale al netto
  percentualeParcella?: number; // % parcella applicata
}

export interface ProjectMetadata extends ProjectPrestazioni {
  [key: string]: any; // Mantieni flessibilità per altri metadata futuri
}

// Zod schema per singola classificazione DM 17/06/2016
export const classificazioneDM2016Schema = z.object({
  codice: z.string().regex(/^[A-Z]{1,2}\.?[0-9]{1,2}$/, 'Formato classe DM 17/06/2016 non valido (es: E.22, IA.03, S.05)'),
  importo: z.number().min(0, 'L\'importo deve essere maggiore o uguale a 0'),
  importoOpere: z.number().min(0).optional(), // Alias di importo per retrocompatibilità
  importoServizio: z.number().min(0).optional(), // Importo servizio per questa categoria
});

// Zod schemas per validazione prestazioni
export const prestazioniSchema = z.object({
  prestazioni: z.array(z.enum(['progettazione', 'dl', 'csp', 'cse', 'contabilita', 'collaudo', 'perizia', 'pratiche'])).optional(),
  livelloProgettazione: z.array(z.enum(['pfte', 'definitivo', 'esecutivo', 'variante'])).optional(),

  // Nuova struttura: supporto per multiple classificazioni
  classificazioniDM2016: z.array(classificazioneDM2016Schema).optional(),

  // Retrocompatibilità: campi singoli (deprecati)
  classeDM2016: z.string().optional(),
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
// USERS & AUTHENTICATION
// ============================================

// Users table for multi-user authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(), // Nome completo visibile nell'UI
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User insert schema and types
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for creating a new user (accepts password instead of passwordHash)
export const createUserSchema = insertUserSchema.omit({
  passwordHash: true,
}).extend({
  password: z.string().min(8, "La password deve essere di almeno 8 caratteri"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================
// NUOVE TABELLE PER FUNZIONALITÀ AVANZATE
// ============================================

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

// Tipi di fattura per prestazione
export const TIPO_FATTURA = ['acconto', 'sal', 'saldo', 'unica'] as const;
export type TipoFattura = typeof TIPO_FATTURA[number];

// Fatturazione
export const projectInvoices = pgTable("project_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prestazioneId: text("prestazione_id").references(() => projectPrestazioni.id, { onDelete: "cascade" }), // Collegamento a prestazione - cascade delete
  tipoFattura: text("tipo_fattura").default("unica"), // 'acconto', 'sal', 'saldo', 'unica'
  numeroFattura: text("numero_fattura").notNull(),
  dataEmissione: timestamp("data_emissione").notNull(),
  importoNetto: integer("importo_netto").notNull(), // In centesimi
  cassaPrevidenziale: integer("cassa_previdenziale").default(0), // Inarcassa 4% calcolata su netto - in centesimi
  importoIVA: integer("importo_iva").notNull(),
  importoTotale: integer("importo_totale").notNull(),
  importoParcella: integer("importo_parcella").default(0), // Importo pattuito (parcella)
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

// ============================================
// PRESTAZIONI PROFESSIONALI - TRACKING DETTAGLIATO
// ============================================

// Tipi di prestazione
export const PRESTAZIONE_TIPI = ['progettazione', 'dl', 'csp', 'cse', 'contabilita', 'collaudo', 'perizia', 'pratiche'] as const;
export type PrestazioneTipo = typeof PRESTAZIONE_TIPI[number];

// Stati della prestazione nel ciclo di vita
export const PRESTAZIONE_STATI = ['da_iniziare', 'in_corso', 'completata', 'fatturata', 'pagata'] as const;
export type PrestazioneStato = typeof PRESTAZIONE_STATI[number];

// Livelli di progettazione (usati solo se tipo = 'progettazione')
export const LIVELLI_PROGETTAZIONE = ['pfte', 'definitivo', 'esecutivo', 'variante'] as const;
export type LivelloProgettazione = typeof LIVELLI_PROGETTAZIONE[number];

// Tabella prestazioni professionali con tracking completo
export const projectPrestazioni = pgTable("project_prestazioni", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),

  // Tipo e dettagli prestazione
  tipo: text("tipo").notNull(), // 'progettazione', 'dl', 'csp', 'cse', 'contabilita', 'collaudo', 'perizia', 'pratiche'
  livelloProgettazione: text("livello_progettazione"), // Solo per 'progettazione': 'pfte', 'definitivo', 'esecutivo', 'variante'
  descrizione: text("descrizione"), // Descrizione aggiuntiva opzionale

  // Stato e ciclo di vita
  stato: text("stato").notNull().default("da_iniziare"), // 'da_iniziare', 'in_corso', 'completata', 'fatturata', 'pagata'
  dataInizio: timestamp("data_inizio"),
  dataCompletamento: timestamp("data_completamento"),
  dataFatturazione: timestamp("data_fatturazione"),
  dataPagamento: timestamp("data_pagamento"),

  // Importi (in centesimi di euro)
  importoPrevisto: integer("importo_previsto").default(0), // Importo stimato/preventivato
  importoFatturato: integer("importo_fatturato").default(0), // Importo effettivamente fatturato (calcolato come somma fatture collegate)
  importoPagato: integer("importo_pagato").default(0), // Importo effettivamente incassato

  // Note e metadata
  note: text("note"),

  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Classificazioni DM 17/06/2016 per singola prestazione
export const prestazioneClassificazioni = pgTable("prestazione_classificazioni", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  prestazioneId: text("prestazione_id").notNull().references(() => projectPrestazioni.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  codiceDM: text("codice_dm").notNull(), // Es. "E.22", "S.05", "IA.03"
  importoOpere: integer("importo_opere").notNull().default(0), // Centesimi di euro
  importoServizio: integer("importo_servizio").notNull().default(0), // Centesimi di euro
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uq_prestazione_codice").on(table.prestazioneId, table.codiceDM),
]);

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

// Costi generici (consulenze, benzina, nolo, materiali, ecc.)
export const projectCosts = pgTable("project_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(), // 'consulenza', 'benzina', 'nolo', 'materiali', 'rilievo', 'altro'
  descrizione: text("descrizione"),
  importo: integer("importo").default(0), // In centesimi
  data: timestamp("data"), // Data del costo (opzionale)
  fornitore: text("fornitore"), // Nome fornitore/azienda (opzionale)
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

// Tasks - Sistema gestione To Do
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  notes: text("notes"), // Sezione note compilabile dagli utenti
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }), // Collegamento commessa (opzionale)
  assignedToId: text("assigned_to_id").references(() => users.id), // Utente assegnato
  createdById: text("created_by_id").notNull().references(() => users.id), // Utente creatore
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high'
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'cancelled'
  dueDate: timestamp("due_date"), // Scadenza (opzionale)
  completedAt: timestamp("completed_at"), // Data completamento
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// INSERT SCHEMAS PER NUOVE TABELLE
// ============================================

export const insertProjectDeadlineSchema = createInsertSchema(projectDeadlines).omit({
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
}).refine((data) => {
  // Se tipo è 'progettazione', livelloProgettazione dovrebbe essere specificato
  if (data.tipo === 'progettazione' && !data.livelloProgettazione) {
    return true; // Non blocchiamo, ma potrebbe essere warning
  }
  return true;
});

// Schema inserimento classificazione DM per prestazione
export const insertPrestazioneClassificazioneSchema = createInsertSchema(prestazioneClassificazioni).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  codiceDM: z.string().regex(/^[A-Z]{1,2}\.?[0-9]{1,2}$/, 'Formato codice DM non valido (es: E.22, IA.03)'),
  importoOpere: z.number().int().min(0).default(0),
  importoServizio: z.number().int().min(0).default(0),
});

// Schema per aggiornamento stato prestazione
export const updatePrestazioneStatoSchema = z.object({
  stato: z.enum(PRESTAZIONE_STATI),
  dataCompletamento: z.coerce.date().optional().nullable(),
  dataFatturazione: z.coerce.date().optional().nullable(),
  dataPagamento: z.coerce.date().optional().nullable(),
  importoFatturato: z.number().min(0).optional(),
  importoPagato: z.number().min(0).optional(),
  note: z.string().optional(),
});

export const insertProjectBudgetSchema = createInsertSchema(projectBudget).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectCostSchema = createInsertSchema(projectCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectResourceSchema = createInsertSchema(projectResources).omit({
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
// TYPES PER NUOVE TABELLE
// ============================================

export type InsertProjectDeadline = z.infer<typeof insertProjectDeadlineSchema>;
export type ProjectDeadline = typeof projectDeadlines.$inferSelect;
export type Deadline = ProjectDeadline; // Alias for convenience

export type InsertProjectInvoice = z.infer<typeof insertProjectInvoiceSchema>;
export type ProjectInvoice = typeof projectInvoices.$inferSelect;

export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;
export type ProjectBudget = typeof projectBudget.$inferSelect;

export type InsertProjectCost = z.infer<typeof insertProjectCostSchema>;
export type ProjectCost = typeof projectCosts.$inferSelect;

export type InsertProjectResource = z.infer<typeof insertProjectResourceSchema>;
export type ProjectResource = typeof projectResources.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Prestazioni professionali types
export type InsertProjectPrestazione = z.infer<typeof insertProjectPrestazioneSchema>;
export type ProjectPrestazione = typeof projectPrestazioni.$inferSelect;
export type UpdatePrestazioneStato = z.infer<typeof updatePrestazioneStatoSchema>;

// Classificazioni DM per prestazione types
export type InsertPrestazioneClassificazione = z.infer<typeof insertPrestazioneClassificazioneSchema>;
export type PrestazioneClassificazione = typeof prestazioneClassificazioni.$inferSelect;

// ============================================
// BILLING AUTOMATION - ALERT E CONFIGURAZIONE
// ============================================

// Stati di fatturazione del progetto
export const BILLING_STATUS = ['da_fatturare', 'parzialmente_fatturato', 'fatturato', 'parzialmente_pagato', 'pagato'] as const;
export type BillingStatus = typeof BILLING_STATUS[number];

// Tipi di alert di fatturazione
export const BILLING_ALERT_TYPES = ['completata_non_fatturata', 'fattura_scaduta', 'pagamento_ritardo'] as const;
export type BillingAlertType = typeof BILLING_ALERT_TYPES[number];

// Tabella Alert di Fatturazione
export const billingAlerts = pgTable("billing_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prestazioneId: text("prestazione_id").references(() => projectPrestazioni.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id").references(() => projectInvoices.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(), // 'completata_non_fatturata', 'fattura_scaduta', 'pagamento_ritardo'
  daysOverdue: integer("days_overdue").default(0), // Giorni di ritardo
  priority: text("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  message: text("message"), // Messaggio descrittivo
  dismissedAt: timestamp("dismissed_at"), // Se l'utente ignora l'alert
  dismissedBy: text("dismissed_by"), // ID utente che ha ignorato
  resolvedAt: timestamp("resolved_at"), // Quando viene risolto automaticamente
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabella Configurazione Fatturazione
export const billingConfig = pgTable("billing_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: integer("setting_value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas per billing
export const insertBillingAlertSchema = createInsertSchema(billingAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBillingConfigSchema = createInsertSchema(billingConfig).omit({
  id: true,
  updatedAt: true,
});

// Types per billing
export type InsertBillingAlert = z.infer<typeof insertBillingAlertSchema>;
export type BillingAlert = typeof billingAlerts.$inferSelect;

export type InsertBillingConfig = z.infer<typeof insertBillingConfigSchema>;
export type BillingConfig = typeof billingConfig.$inferSelect;

// Helper interface per alert con info progetto
export interface BillingAlertWithDetails extends BillingAlert {
  project?: {
    id: string;
    code: string;
    client: string;
    object: string;
  };
  prestazione?: {
    id: string;
    tipo: string;
    livelloProgettazione?: string;
    stato: string;
  };
  invoice?: {
    id: string;
    numeroFattura: string;
    importoTotale: number;
    stato: string;
  };
}

// Helper type per prestazione con info progetto (per dashboard)
export interface PrestazioneWithProject extends ProjectPrestazione {
  project?: {
    id: string;
    code: string;
    client: string;
    object: string;
  };
  // Array di fatture collegate alla prestazione (1:N)
  invoices?: Array<{
    id: string;
    numeroFattura: string;
    tipoFattura: string;
    importoNetto: number;
    stato: string;
    dataEmissione: Date | null;
  }>;
}

// Statistiche prestazioni per dashboard
export interface PrestazioniStats {
  totale: number;
  daIniziare: number;
  inCorso: number;
  completate: number;
  fatturate: number;
  pagate: number;
  completateNonFatturate: number; // Alert
  fatturateNonPagate: number; // Alert
  importoTotalePrevisto: number;
  importoTotaleFatturato: number;
  importoTotalePagato: number;
  importoDaFatturare: number;
  importoDaIncassare: number;
}

// ============================================
// AI CHAT MESSAGE STRUCTURE
// ============================================

// AI Chat message structure (used by ai-assistant.ts)
export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ============================================
// IMPORT REPORT
// ============================================

export interface ImportEntityReport {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ImportReport {
  mode: 'merge' | 'overwrite';
  entities: Record<string, ImportEntityReport>;
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  success: boolean;
}

