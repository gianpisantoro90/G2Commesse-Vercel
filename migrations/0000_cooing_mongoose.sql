CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sigla" text NOT NULL,
	"name" text NOT NULL,
	"partita_iva" text,
	"codice_fiscale" text,
	"forma_giuridica" text,
	"indirizzo" text,
	"cap" text,
	"city" text,
	"provincia" text,
	"email" text,
	"telefono" text,
	"pec" text,
	"codice_destinatario" text,
	"nome_referente" text,
	"ruolo_referente" text,
	"email_referente" text,
	"telefono_referente" text,
	"note" text,
	"projects_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "clients_sigla_unique" UNIQUE("sigla")
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text,
	"type" text NOT NULL,
	"direction" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"recipient" text,
	"sender" text,
	"is_important" boolean DEFAULT false,
	"communication_date" timestamp NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_routings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text,
	"file_name" text NOT NULL,
	"file_type" text,
	"suggested_path" text NOT NULL,
	"actual_path" text,
	"confidence" integer DEFAULT 0,
	"method" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "files_index" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_item_id" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"size" integer DEFAULT 0,
	"mime_type" text,
	"last_modified" timestamp,
	"project_code" text,
	"parent_folder_id" text,
	"is_folder" boolean DEFAULT false,
	"web_url" text,
	"download_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "files_index_drive_item_id_unique" UNIQUE("drive_item_id")
);
--> statement-breakpoint
CREATE TABLE "onedrive_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" text NOT NULL,
	"onedrive_folder_id" text NOT NULL,
	"onedrive_folder_name" text NOT NULL,
	"onedrive_folder_path" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_budget" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"budget_ore_totale" integer DEFAULT 0,
	"ore_consuntivate" integer DEFAULT 0,
	"costi_consulenze" integer DEFAULT 0,
	"costi_rilievi" integer DEFAULT 0,
	"altri_costi" integer DEFAULT 0,
	"costi_totali" integer DEFAULT 0,
	"ricavi_previsti" integer DEFAULT 0,
	"ricavi_effettivi" integer DEFAULT 0,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "project_budget_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#10B981' NOT NULL,
	"icon" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_category_relation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_category_relation_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_changelog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"action" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"description" text,
	"user_id" text,
	"user_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"direction" text DEFAULT 'outgoing' NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"recipient" text,
	"sender" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_important" boolean DEFAULT false,
	"communication_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"created_by" text,
	"email_message_id" text,
	"email_headers" jsonb,
	"email_raw" text,
	"email_html" text,
	"email_text" text,
	"auto_imported" boolean DEFAULT false,
	"ai_suggestions" jsonb,
	"ai_suggestions_status" jsonb,
	"imported_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "project_deadlines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" timestamp NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"notify_days_before" integer DEFAULT 7,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"sal_id" text,
	"numero_fattura" text NOT NULL,
	"data_emissione" timestamp NOT NULL,
	"importo_netto" integer NOT NULL,
	"importo_iva" integer NOT NULL,
	"importo_totale" integer NOT NULL,
	"aliquota_iva" integer DEFAULT 22,
	"ritenuta" integer DEFAULT 0,
	"stato" text DEFAULT 'emessa' NOT NULL,
	"scadenza_pagamento" timestamp,
	"data_pagamento" timestamp,
	"note" text,
	"attachment_path" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_resources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text,
	"role" text NOT NULL,
	"ore_assegnate" integer DEFAULT 0,
	"ore_lavorate" integer DEFAULT 0,
	"costo_orario" integer DEFAULT 0,
	"is_responsabile" boolean DEFAULT false,
	"data_inizio" timestamp,
	"data_fine" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_sal" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"numero" integer NOT NULL,
	"descrizione" text,
	"percentuale_avanzamento" integer NOT NULL,
	"importo_lavori" integer DEFAULT 0,
	"importo_contabilizzato" integer DEFAULT 0,
	"data_emissione" timestamp NOT NULL,
	"data_approvazione" timestamp,
	"stato" text DEFAULT 'bozza' NOT NULL,
	"note" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3B82F6' NOT NULL,
	"icon" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_tags_relation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"client" text NOT NULL,
	"client_id" text,
	"city" text NOT NULL,
	"object" text NOT NULL,
	"year" integer NOT NULL,
	"template" text NOT NULL,
	"status" text DEFAULT 'in_corso' NOT NULL,
	"tipo_rapporto" text DEFAULT 'diretto' NOT NULL,
	"committente_finale" text,
	"fatturato" boolean DEFAULT false,
	"numero_fattura" text,
	"data_fattura" timestamp,
	"importo_fatturato" integer DEFAULT 0,
	"pagato" boolean DEFAULT false,
	"data_pagamento" timestamp,
	"importo_pagato" integer DEFAULT 0,
	"note_fatturazione" text,
	"created_at" timestamp DEFAULT now(),
	"fs_root" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "saved_filters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filter_config" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"notes" text,
	"project_id" text,
	"assigned_to_id" text,
	"created_by_id" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_routings" ADD CONSTRAINT "file_routings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files_index" ADD CONSTRAINT "files_index_project_code_projects_code_fk" FOREIGN KEY ("project_code") REFERENCES "public"."projects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onedrive_mappings" ADD CONSTRAINT "onedrive_mappings_project_code_projects_code_fk" FOREIGN KEY ("project_code") REFERENCES "public"."projects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget" ADD CONSTRAINT "project_budget_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_category_relation" ADD CONSTRAINT "project_category_relation_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_category_relation" ADD CONSTRAINT "project_category_relation_category_id_project_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."project_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_changelog" ADD CONSTRAINT "project_changelog_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_communications" ADD CONSTRAINT "project_communications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deadlines" ADD CONSTRAINT "project_deadlines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_sal_id_project_sal_id_fk" FOREIGN KEY ("sal_id") REFERENCES "public"."project_sal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sal" ADD CONSTRAINT "project_sal_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tags_relation" ADD CONSTRAINT "project_tags_relation_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tags_relation" ADD CONSTRAINT "project_tags_relation_tag_id_project_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."project_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;