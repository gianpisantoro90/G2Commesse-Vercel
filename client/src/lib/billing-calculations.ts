import { type ProjectInvoice, type ProjectPrestazione } from "@shared/schema";

/**
 * Centralized billing calculation utilities.
 * Single source of truth for all billing totals used across:
 * - billing-flow.tsx
 * - fatturazione.tsx
 * - billing-alerts.tsx
 * - projects-table.tsx
 */

// ============================================
// CONFIG TYPE
// ============================================

export interface BillingConfigData {
  alert_completata_giorni: number;
  alert_pagamento_giorni: number;
}

// ============================================
// INVOICE TOTALS
// ============================================

export interface InvoiceStats {
  count: number;
  emesse: number;
  pagate: number;
  scadute: number;
  importoTotale: number;
  importoPagato: number;
  importoDaPagare: number;
}

/**
 * Calculate aggregate invoice statistics from a list of invoices.
 * All amounts are in centesimi.
 */
export function calcInvoiceStats(invoices: Pick<ProjectInvoice, 'importoTotale' | 'stato'>[]): InvoiceStats {
  let importoTotale = 0;
  let importoPagato = 0;
  let emesse = 0;
  let pagate = 0;
  let scadute = 0;

  for (const inv of invoices) {
    importoTotale += inv.importoTotale;
    if (inv.stato === "pagata") {
      importoPagato += inv.importoTotale;
      pagate++;
    } else if (inv.stato === "scaduta") {
      scadute++;
    } else if (inv.stato === "emessa") {
      emesse++;
    }
  }

  return {
    count: invoices.length,
    emesse,
    pagate,
    scadute,
    importoTotale,
    importoPagato,
    importoDaPagare: importoTotale - importoPagato,
  };
}

// ============================================
// PROJECT BILLING TOTALS
// ============================================

export interface ProjectBillingTotals {
  budget: number;
  fatturato: number;
  incassato: number;
  daIncassare: number;
  percentualeFatturato: number;
  percentualeIncassato: number;
}

/**
 * Calculate billing totals for a single project.
 * Budget comes from prestazioni importoPrevisto, fatturato/incassato from invoices.
 */
export function calcProjectBillingTotals(
  prestazioni: ProjectPrestazione[],
  invoices: ProjectInvoice[]
): ProjectBillingTotals {
  const budget = prestazioni.reduce((sum, p) => sum + (p.importoPrevisto || 0), 0);
  const fatturato = invoices.reduce((sum, i) => sum + i.importoTotale, 0);
  const incassato = invoices
    .filter((i) => i.stato === "pagata")
    .reduce((sum, i) => sum + i.importoTotale, 0);
  const daIncassare = fatturato - incassato;

  return {
    budget,
    fatturato,
    incassato,
    daIncassare,
    percentualeFatturato: budget > 0 ? Math.round((fatturato / budget) * 100) : 0,
    percentualeIncassato: fatturato > 0 ? Math.round((incassato / fatturato) * 100) : 0,
  };
}

// ============================================
// BILLING ALERTS
// ============================================

export interface BillingAlertCounts {
  prestazioniDaFatturare: number;
  fattureScadute: number;
  pagamentiInRitardo: number;
}

/**
 * Count billing alerts for a set of prestazioni and invoices.
 * Uses configurable thresholds from billing-config.
 */
export function calcBillingAlerts(
  prestazioni: ProjectPrestazione[],
  invoices: ProjectInvoice[],
  sogliaCompletataGiorni: number,
  sogliaPagamentoGiorni: number
): BillingAlertCounts {
  const now = Date.now();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const prestazioniDaFatturare = prestazioni.filter((p) => {
    if (p.stato !== "completata" || !p.dataCompletamento) return false;
    const days = Math.floor((now - new Date(p.dataCompletamento).getTime()) / MS_PER_DAY);
    return days >= sogliaCompletataGiorni;
  }).length;

  const fattureScadute = invoices.filter((i) => i.stato === "scaduta").length;

  const pagamentiInRitardo = invoices.filter((i) => {
    if (i.stato === "pagata") return false;
    const days = Math.floor((now - new Date(i.dataEmissione).getTime()) / MS_PER_DAY);
    return days >= sogliaPagamentoGiorni;
  }).length;

  return { prestazioniDaFatturare, fattureScadute, pagamentiInRitardo };
}

// ============================================
// INVOICE FORM CALCULATIONS
// ============================================

export interface InvoiceFormInput {
  imponibile: number; // in euro (will be converted to centesimi)
  cassaPercentuale: number;
  ivaPercentuale: number;
  ritenuta: number; // in euro
}

export interface InvoiceCalculated {
  imponibile: number; // centesimi
  cassaPrevidenziale: number; // centesimi
  importoIVA: number; // centesimi
  importoTotale: number; // centesimi
  ritenuta: number; // centesimi
  nettoPagare: number; // centesimi
}

/**
 * Calculate invoice amounts from form input.
 * IVA is calculated on (imponibile + cassa previdenziale).
 */
export function calcInvoiceAmounts(input: InvoiceFormInput): InvoiceCalculated {
  const imponibile = Math.round(input.imponibile * 100);
  const cassaPrevidenziale = Math.round(imponibile * (input.cassaPercentuale / 100));
  const baseIva = imponibile + cassaPrevidenziale;
  const importoIVA = Math.round(baseIva * (input.ivaPercentuale / 100));
  const importoTotale = baseIva + importoIVA;
  const ritenuta = Math.round(input.ritenuta * 100);

  return {
    imponibile,
    cassaPrevidenziale,
    importoIVA,
    importoTotale,
    ritenuta,
    nettoPagare: importoTotale - ritenuta,
  };
}

// ============================================
// FORMATTING
// ============================================

/**
 * Format centesimi to EUR string.
 */
export function formatCentesimi(cents: number): string {
  return (cents / 100).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format centesimi to compact EUR (e.g. "12k", "1.5M").
 */
export function formatCentesimiCompact(cents: number): string {
  const euros = cents / 100;
  if (Math.abs(euros) >= 1_000_000) return `${(euros / 1_000_000).toFixed(1)}M`;
  if (Math.abs(euros) >= 1_000) return `${(euros / 1_000).toFixed(0)}k`;
  return euros.toFixed(0);
}
