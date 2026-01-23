-- Migration: Billing Automation System
-- Descrizione: Aggiunge sistema di fatturazione automatizzato con alert e sincronizzazione

-- 1. Aggiungi campo billing_status alla tabella projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'da_fatturare';

-- 2. Crea tabella billing_alerts per tracciare gli alert di fatturazione
CREATE TABLE IF NOT EXISTS billing_alerts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prestazione_id TEXT REFERENCES project_prestazioni(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES project_invoices(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'completata_non_fatturata', 'fattura_scaduta', 'pagamento_ritardo'
  days_overdue INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  message TEXT,
  dismissed_at TIMESTAMP,
  dismissed_by TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crea tabella billing_config per configurazione soglie alert
CREATE TABLE IF NOT EXISTS billing_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value INTEGER NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Inserisci configurazioni default per alert
INSERT INTO billing_config (id, setting_key, setting_value, description) VALUES
  (gen_random_uuid(), 'alert_completata_giorni', 15, 'Giorni dopo completamento prestazione per generare alert fatturazione'),
  (gen_random_uuid(), 'alert_scadenza_fattura_giorni', 30, 'Giorni default scadenza fattura dopo emissione'),
  (gen_random_uuid(), 'alert_pagamento_giorni', 60, 'Giorni dopo emissione per generare alert pagamento in ritardo'),
  (gen_random_uuid(), 'auto_sync_prestazioni', 1, 'Abilita sincronizzazione automatica prestazioni da metadata (1=si, 0=no)'),
  (gen_random_uuid(), 'auto_data_inizio', 1, 'Imposta automaticamente data inizio commessa alla creazione (1=si, 0=no)')
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_billing_alerts_project ON billing_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_type ON billing_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_resolved ON billing_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_billing_alerts_dismissed ON billing_alerts(dismissed_at) WHERE dismissed_at IS NULL;

-- 6. Aggiorna billing_status esistenti basandosi sui dati attuali
UPDATE projects p
SET billing_status = CASE
  WHEN p.pagato = true THEN 'pagato'
  WHEN p.fatturato = true THEN 'fatturato'
  ELSE 'da_fatturare'
END
WHERE billing_status IS NULL OR billing_status = 'da_fatturare';

-- 7. Imposta data_inizio_commessa per commesse esistenti senza data
UPDATE projects
SET data_inizio_commessa = created_at
WHERE data_inizio_commessa IS NULL;
