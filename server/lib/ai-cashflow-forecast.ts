/**
 * Cash Flow Forecast Service
 *
 * Generates monthly cash flow projections based on:
 * - Prestazioni in corso (expected future invoicing)
 * - Fatture emesse non pagate (expected collections)
 * - Historical payment patterns (average collection delay)
 * - Planned costs from project budgets
 *
 * Pure data analysis - no AI API calls needed for basic forecasting.
 */

import { logger } from "./logger";
import type { IStorage } from "../storage";

export interface CashFlowMonth {
  month: string; // YYYY-MM
  label: string; // "Gen 2026"
  entriPrevisti: number;  // Expected income (cents)
  uscitePreviste: number; // Expected outgoings (cents)
  saldoPrevisto: number;  // Net (cents)
  fattureDaIncassare: number; // Invoices expected to be paid
  prestazioniDaFatturare: number; // Prestazioni expected to be invoiced
  confidence: number; // 0-1 confidence level
}

export interface CashFlowForecast {
  months: CashFlowMonth[];
  summary: {
    totalEntriPrevisti: number;
    totalUscitePreviste: number;
    saldoPeriodo: number;
    avgMonthlyEntri: number;
    avgMonthlyUscite: number;
    collectionDelayDays: number; // Average collection delay
    collectionRate: number; // Historical collection rate (0-1)
  };
  historicalMonths: CashFlowMonth[]; // Last 6 months actuals
  generatedAt: string;
}

const MONTH_NAMES_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function monthLabel(date: Date): string {
  return `${MONTH_NAMES_IT[date.getMonth()]} ${date.getFullYear()}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calculate cash flow forecast for the next N months.
 */
export async function generateCashFlowForecast(
  storage: IStorage,
  forecastMonths: number = 6,
): Promise<CashFlowForecast> {
  const [projects, prestazioni, invoices, costs] = await Promise.all([
    storage.getAllProjects(),
    storage.getAllPrestazioni(),
    storage.getAllInvoices(),
    storage.getAllProjectCosts(),
  ]);

  const now = new Date();
  const activeProjects = projects.filter(p => p.status === 'in corso');

  // ===== HISTORICAL ANALYSIS =====
  // Calculate average collection delay from paid invoices
  const paidInvoices = invoices.filter(i => i.stato === 'pagata' && i.dataPagamento && i.dataEmissione);
  let totalDelayDays = 0;
  let delayCount = 0;
  for (const inv of paidInvoices) {
    const emissione = new Date(inv.dataEmissione);
    const pagamento = new Date(inv.dataPagamento!);
    const days = Math.ceil((pagamento.getTime() - emissione.getTime()) / 86400000);
    if (days > 0 && days < 365) { // Exclude outliers
      totalDelayDays += days;
      delayCount++;
    }
  }
  const avgCollectionDelay = delayCount > 0 ? Math.round(totalDelayDays / delayCount) : 60; // Default 60 days

  // Historical collection rate
  const totalInvoiced = invoices.reduce((s, i) => s + (i.importoTotale || 0), 0);
  const totalCollected = paidInvoices.reduce((s, i) => s + (i.importoTotale || 0), 0);
  const collectionRate = totalInvoiced > 0 ? totalCollected / totalInvoiced : 0.85; // Default 85%

  // ===== HISTORICAL MONTHS (last 6) =====
  const historicalMonths: CashFlowMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = monthKey(mDate);
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0);

    // Actual income: invoices paid in this month
    const monthPaid = invoices.filter(inv => {
      if (inv.stato !== 'pagata' || !inv.dataPagamento) return false;
      const d = new Date(inv.dataPagamento);
      return d >= mDate && d <= mEnd;
    });
    const entri = monthPaid.reduce((s, i) => s + (i.importoTotale || 0), 0);

    // Actual costs in this month
    const monthCosts = costs.filter(c => {
      if (!c.data) return false;
      const d = new Date(c.data);
      return d >= mDate && d <= mEnd;
    });
    const uscite = monthCosts.reduce((s, c) => s + (c.importo || 0), 0);

    historicalMonths.push({
      month: mKey,
      label: monthLabel(mDate),
      entriPrevisti: entri,
      uscitePreviste: uscite,
      saldoPrevisto: entri - uscite,
      fattureDaIncassare: 0,
      prestazioniDaFatturare: 0,
      confidence: 1.0, // Historical = certain
    });
  }

  // ===== FORECAST MONTHS =====
  const forecastData: CashFlowMonth[] = [];

  // Pending invoices (emesse, not paid) -> expected payment based on avg delay
  const pendingInvoices = invoices.filter(i =>
    (i.stato === 'emessa' || i.stato === 'scaduta' || i.stato === 'parzialmente_pagata')
  );

  // Prestazioni completate non fatturate -> expected invoicing soon
  const readyToInvoice = prestazioni.filter(p => p.stato === 'completata');

  // Prestazioni in corso -> expected to complete and invoice in future months
  const inProgress = prestazioni.filter(p => p.stato === 'in_corso');

  // Average monthly costs from last 6 months (for cost projection)
  const totalHistoricalCosts = historicalMonths.reduce((s, m) => s + m.uscitePreviste, 0);
  const avgMonthlyCost = historicalMonths.length > 0 ? Math.round(totalHistoricalCosts / historicalMonths.length) : 0;

  for (let i = 1; i <= forecastMonths; i++) {
    const mDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mKey = monthKey(mDate);
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0);
    const daysFromNow = Math.ceil((mDate.getTime() - now.getTime()) / 86400000);

    let entri = 0;
    let fattureCount = 0;
    let prestazioniCount = 0;

    // 1. Pending invoices expected to be paid (based on avg collection delay)
    for (const inv of pendingInvoices) {
      const emissione = new Date(inv.dataEmissione);
      const expectedPayment = new Date(emissione.getTime() + avgCollectionDelay * 86400000);
      if (expectedPayment >= mDate && expectedPayment <= mEnd) {
        entri += Math.round(inv.importoTotale * collectionRate);
        fattureCount++;
      }
    }

    // 2. Prestazioni completate -> expected invoice + payment
    // Assume invoicing within 1 month, payment after avg delay
    for (const prest of readyToInvoice) {
      const expectedInvoice = new Date(now.getTime() + 30 * 86400000); // Invoice in ~1 month
      const expectedPayment = new Date(expectedInvoice.getTime() + avgCollectionDelay * 86400000);
      if (expectedPayment >= mDate && expectedPayment <= mEnd) {
        entri += Math.round((prest.importoPrevisto || 0) * collectionRate);
        prestazioniCount++;
      }
    }

    // 3. In-progress prestazioni -> spread over future months
    // Distribute evenly across remaining forecast months (decreasing confidence)
    const inProgressPerMonth = inProgress.length > 0
      ? Math.round(inProgress.reduce((s, p) => s + (p.importoPrevisto || 0), 0) / (forecastMonths * 1.5))
      : 0;
    if (i >= 3) { // Start expecting in-progress income from month 3+
      entri += Math.round(inProgressPerMonth * collectionRate);
      prestazioniCount += Math.round(inProgress.length / forecastMonths);
    }

    // Confidence decreases with distance
    const confidence = Math.max(0.3, 1 - (i * 0.1));

    // Cost projection (use historical average with slight decrease in confidence)
    const uscite = avgMonthlyCost;

    forecastData.push({
      month: mKey,
      label: monthLabel(mDate),
      entriPrevisti: entri,
      uscitePreviste: uscite,
      saldoPrevisto: entri - uscite,
      fattureDaIncassare: fattureCount,
      prestazioniDaFatturare: prestazioniCount,
      confidence,
    });
  }

  // Summary
  const totalEntriPrevisti = forecastData.reduce((s, m) => s + m.entriPrevisti, 0);
  const totalUscitePreviste = forecastData.reduce((s, m) => s + m.uscitePreviste, 0);

  logger.info(`Cash flow forecast generated: ${forecastMonths} months, ${totalEntriPrevisti / 100}€ expected income`);

  return {
    months: forecastData,
    summary: {
      totalEntriPrevisti,
      totalUscitePreviste,
      saldoPeriodo: totalEntriPrevisti - totalUscitePreviste,
      avgMonthlyEntri: forecastData.length > 0 ? Math.round(totalEntriPrevisti / forecastData.length) : 0,
      avgMonthlyUscite: avgMonthlyCost,
      collectionDelayDays: avgCollectionDelay,
      collectionRate: Math.round(collectionRate * 100) / 100,
    },
    historicalMonths,
    generatedAt: new Date().toISOString(),
  };
}
