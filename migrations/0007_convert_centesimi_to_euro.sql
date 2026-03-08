-- Migration: Convert all monetary fields from integer centesimi to double precision euro
-- This migration:
-- 1. Changes column types from integer to double precision
-- 2. Converts existing data by dividing by 100 (centesimi → euro)

-- ============================================
-- projects table
-- ============================================
ALTER TABLE projects
  ALTER COLUMN importo_fatturato TYPE double precision USING importo_fatturato / 100.0,
  ALTER COLUMN importo_pagato TYPE double precision USING importo_pagato / 100.0;

-- ============================================
-- project_invoices table
-- ============================================
ALTER TABLE project_invoices
  ALTER COLUMN importo_netto TYPE double precision USING importo_netto / 100.0,
  ALTER COLUMN cassa_previdenziale TYPE double precision USING cassa_previdenziale / 100.0,
  ALTER COLUMN importo_iva TYPE double precision USING importo_iva / 100.0,
  ALTER COLUMN importo_totale TYPE double precision USING importo_totale / 100.0,
  ALTER COLUMN importo_parcella TYPE double precision USING importo_parcella / 100.0,
  ALTER COLUMN ritenuta TYPE double precision USING ritenuta / 100.0;
-- aliquota_iva resta integer (è una percentuale, non un importo)

-- ============================================
-- project_prestazioni table
-- ============================================
ALTER TABLE project_prestazioni
  ALTER COLUMN importo_previsto TYPE double precision USING importo_previsto / 100.0,
  ALTER COLUMN importo_fatturato TYPE double precision USING importo_fatturato / 100.0,
  ALTER COLUMN importo_pagato TYPE double precision USING importo_pagato / 100.0;

-- ============================================
-- prestazione_classificazioni table
-- ============================================
ALTER TABLE prestazione_classificazioni
  ALTER COLUMN importo_opere TYPE double precision USING importo_opere / 100.0,
  ALTER COLUMN importo_servizio TYPE double precision USING importo_servizio / 100.0;

-- ============================================
-- project_budget table
-- ============================================
ALTER TABLE project_budget
  ALTER COLUMN costi_consulenze TYPE double precision USING costi_consulenze / 100.0,
  ALTER COLUMN costi_rilievi TYPE double precision USING costi_rilievi / 100.0,
  ALTER COLUMN altri_costi TYPE double precision USING altri_costi / 100.0,
  ALTER COLUMN costi_totali TYPE double precision USING costi_totali / 100.0,
  ALTER COLUMN ricavi_previsti TYPE double precision USING ricavi_previsti / 100.0,
  ALTER COLUMN ricavi_effettivi TYPE double precision USING ricavi_effettivi / 100.0;
-- budget_ore_totale e ore_consuntivate restano integer (sono ore, non importi)

-- ============================================
-- project_costs table
-- ============================================
ALTER TABLE project_costs
  ALTER COLUMN importo TYPE double precision USING importo / 100.0;

-- ============================================
-- project_resources table
-- ============================================
ALTER TABLE project_resources
  ALTER COLUMN costo_orario TYPE double precision USING costo_orario / 100.0;
-- ore_assegnate e ore_lavorate restano integer (sono ore, non importi)
