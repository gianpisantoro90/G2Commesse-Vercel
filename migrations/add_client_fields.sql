-- Migration: Add extended client fields
-- Date: 2025-11-04
-- Description: Adds comprehensive client information fields to the clients table

-- Add Dati Anagrafici
ALTER TABLE clients ADD COLUMN IF NOT EXISTS partita_iva TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS codice_fiscale TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS forma_giuridica TEXT;

-- Add Indirizzo completo
ALTER TABLE clients ADD COLUMN IF NOT EXISTS indirizzo TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cap TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS provincia TEXT;

-- Add Contatti
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pec TEXT;

-- Add Dati Amministrativi/Fatturazione
ALTER TABLE clients ADD COLUMN IF NOT EXISTS codice_destinatario TEXT;

-- Add Referente principale
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nome_referente TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ruolo_referente TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_referente TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telefono_referente TEXT;

-- Add Altro
ALTER TABLE clients ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Update existing clients to have created_at
UPDATE clients SET created_at = NOW() WHERE created_at IS NULL;

-- Add comments to document the fields
COMMENT ON COLUMN clients.partita_iva IS 'Partita IVA del cliente';
COMMENT ON COLUMN clients.codice_fiscale IS 'Codice Fiscale del cliente';
COMMENT ON COLUMN clients.forma_giuridica IS 'Forma giuridica (SRL, SPA, Ditta individuale, Ente pubblico, Privato, etc.)';
COMMENT ON COLUMN clients.indirizzo IS 'Indirizzo completo (via e numero civico)';
COMMENT ON COLUMN clients.cap IS 'Codice Avviamento Postale';
COMMENT ON COLUMN clients.provincia IS 'Sigla provincia (2 caratteri)';
COMMENT ON COLUMN clients.email IS 'Email principale del cliente';
COMMENT ON COLUMN clients.telefono IS 'Numero di telefono principale';
COMMENT ON COLUMN clients.pec IS 'Posta Elettronica Certificata';
COMMENT ON COLUMN clients.codice_destinatario IS 'Codice SDI per fatturazione elettronica';
COMMENT ON COLUMN clients.nome_referente IS 'Nome e cognome del referente principale';
COMMENT ON COLUMN clients.ruolo_referente IS 'Ruolo/funzione del referente';
COMMENT ON COLUMN clients.email_referente IS 'Email del referente (se diversa da quella principale)';
COMMENT ON COLUMN clients.telefono_referente IS 'Telefono del referente (se diverso da quello principale)';
COMMENT ON COLUMN clients.note IS 'Note generali sul cliente';
