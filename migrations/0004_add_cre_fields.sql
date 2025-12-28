-- Add CRE (Certificazione di Buona Esecuzione) fields to projects table
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cig" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "numero_contratto" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "data_inizio_commessa" timestamp;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "data_fine_commessa" timestamp;
