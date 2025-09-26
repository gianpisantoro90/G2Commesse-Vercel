import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  client: text("client").notNull(),
  city: text("city").notNull(),
  object: text("object").notNull(),
  year: integer("year").notNull(),
  template: text("template").notNull(), // 'LUNGO' or 'BREVE'
  status: text("status").notNull().default("in_corso"), // 'in_corso', 'conclusa', 'sospesa'
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
