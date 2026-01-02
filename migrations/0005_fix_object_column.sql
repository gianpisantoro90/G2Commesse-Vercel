-- Migration: Fix object column name compatibility
-- Date: 2026-01-02
-- Description: Ensures the 'object' column exists for compatibility with code

-- Check if oggetto_completo exists and rename it to object
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'projects'
        AND column_name = 'oggetto_completo'
    ) THEN
        ALTER TABLE projects RENAME COLUMN oggetto_completo TO object;
    END IF;
END $$;

-- Ensure object column exists if neither oggetto_completo nor object exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'projects'
        AND column_name = 'object'
    ) THEN
        ALTER TABLE projects ADD COLUMN object TEXT NOT NULL DEFAULT '';
    END IF;
END $$;
