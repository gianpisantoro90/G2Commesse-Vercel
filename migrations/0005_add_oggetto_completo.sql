-- Migration: Add oggetto_completo field to projects table
-- This field stores the full/extended object description for CRE generation
-- while the existing 'object' field remains as abbreviated version for folders and tables

ALTER TABLE "projects" ADD COLUMN "oggetto_completo" TEXT;

-- Optionally: Copy existing object values to oggetto_completo for existing projects
-- This ensures backward compatibility - CRE will fallback to 'object' if 'oggetto_completo' is null
UPDATE "projects" SET "oggetto_completo" = "object" WHERE "oggetto_completo" IS NULL;
