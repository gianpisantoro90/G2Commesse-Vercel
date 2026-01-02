-- ========================================
-- 🔥 HOTFIX: Migrazione Manuale oggetto_completo → object
-- ========================================
--
-- ESEGUI QUESTO SQL DIRETTAMENTE SUL DATABASE DI PRODUZIONE
--
-- Come eseguire:
-- 1. Vai su https://console.neon.tech
-- 2. Apri il database di produzione
-- 3. Vai alla sezione SQL Editor
-- 4. Copia e incolla questo codice
-- 5. Esegui
-- ========================================

-- Rinomina la colonna oggetto_completo → object
DO $$
BEGIN
    -- Verifica se esiste oggetto_completo
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'projects'
        AND column_name = 'oggetto_completo'
    ) THEN
        -- Rinomina la colonna
        ALTER TABLE projects RENAME COLUMN oggetto_completo TO object;
        RAISE NOTICE '✅ Colonna rinominata: oggetto_completo → object';
    ELSE
        -- Verifica se object esiste già
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'projects'
            AND column_name = 'object'
        ) THEN
            RAISE NOTICE '✅ La colonna object esiste già - nessuna azione necessaria';
        ELSE
            -- Né oggetto_completo né object esistono - crea object
            ALTER TABLE projects ADD COLUMN object TEXT NOT NULL DEFAULT '';
            RAISE NOTICE '✅ Colonna object creata';
        END IF;
    END IF;
END $$;

-- Verifica il risultato
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('object', 'oggetto_completo')
ORDER BY column_name;

-- Dovrebbe mostrare:
-- column_name | data_type | is_nullable
-- object      | text      | NO
