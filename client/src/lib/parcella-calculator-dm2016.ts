/**
 * Calcolatore Parcella Professionale secondo DM 17 giugno 2016
 * Aggiornato con modifiche D.Lgs. 36/2023 (Nuovo Codice Appalti)
 *
 * FORMULA PARAMETRICA: CP = ∑(V × G × Q × P)
 *
 * Dove:
 * - V = Costo categorie componenti l'opera (importo lavori in €)
 * - G = Grado di complessità (Tavola Z-1)
 * - Q = Specificità della prestazione (Tavola Z-2)
 * - P = Parametro base = 0,03 + 10/V^0,4
 *
 * IMPORTANTE: I valori di G e Q forniti sono indicativi. Consultare sempre
 * le Tavole Z-1 e Z-2 ufficiali allegate al DM 17/06/2016 per i valori esatti.
 */

import { getCategoriaById, getPrestazioneByCode } from './dm2016-tavole-ufficiali';

// ============================================
// TIPI E INTERFACCE
// ============================================

export interface ParcellaInputDM2016 {
  importoOpere: number; // V - Importo lavori in euro
  categoriaId: string; // ID completo dalla Tavola Z-1 (es: 'E.01', 'E.09', 'S.01')
  prestazioni: {
    [key: string]: boolean; // Chiave = codice prestazione dalla Tavola Z-2
  };
  opzioni?: {
    bimObbligatorio?: boolean; // D.Lgs. 36/2023: incremento per BIM
    incrementoBIM?: number; // Percentuale incremento (default: 10%)
    speseAccessorie?: boolean; // Calcola spese accessorie
  };
}

export interface PrestazioneCalcolata {
  codice: string;
  descrizione: string;
  Q: number; // Parametro specificità
  compenso: number; // V × G × Q × P
  percentualeEffettiva: number; // (compenso / V) × 100
}

export interface ParcellaResultDM2016 {
  importoBase: number; // V
  parametroP: number; // P calcolato
  parametroG: number; // G applicato
  categoria: string;
  prestazioni: PrestazioneCalcolata[];
  compensoBase: number; // Somma compensi prestazioni
  incrementoBIM?: number; // Eventuale incremento BIM
  speseAccessorie?: number; // 10-25% del compenso
  compensoTotale: number; // Totale con incrementi e spese
  dettagliCalcolo: {
    formula: string;
    passaggi: string[];
  };
  note: string[];
}

// ============================================
// PARAMETRI G E Q - ORA DALLE TAVOLE UFFICIALI
// ============================================

/**
 * @deprecated Usa TAVOLA_Z1_COMPLETA da dm2016-tavole-ufficiali.ts
 * Parametri G ora associati automaticamente alle categorie nella Tavola Z-1
 */

/**
 * @deprecated Usa TAVOLA_Z2_COMPLETA da dm2016-tavole-ufficiali.ts
 * Parametri Q ora nella Tavola Z-2 ufficiale
 */

// ============================================
// FUNZIONI DI CALCOLO
// ============================================

/**
 * Calcola il parametro base P secondo la formula:
 * P = 0,03 + 10 / V^0,4
 *
 * Con limitazione: per V < €25.000, P è calcolato con V = €25.000
 */
export function calcolaParametroP(importoOpere: number): number {
  const SOGLIA_MINIMA = 25000;
  const V = Math.max(importoOpere, SOGLIA_MINIMA);

  const P = 0.03 + 10 / Math.pow(V, 0.4);

  return P;
}

/**
 * @deprecated Usa getCategoriaById() da dm2016-tavole-ufficiali.ts
 * Il parametro G è ora associato direttamente alla categoria nella Tavola Z-1
 */

/**
 * Calcola il compenso per una singola prestazione:
 * Compenso = V × G × Q × P
 */
export function calcolaCompensoPrestazione(
  V: number,
  G: number,
  Q: number,
  P: number
): number {
  return V * G * Q * P;
}

/**
 * Calcola le spese accessorie secondo il DM 17/06/2016:
 * - Fino a €1.000.000: max 25%
 * - Da €25.000.000: max 10%
 * - Valori intermedi: interpolazione lineare
 */
export function calcolaSpeseAccessorie(compensoBase: number, importoOpere: number): number {
  let percentualeMax: number;

  if (importoOpere <= 1000000) {
    percentualeMax = 25;
  } else if (importoOpere >= 25000000) {
    percentualeMax = 10;
  } else {
    // Interpolazione lineare tra 25% e 10%
    const range = 25000000 - 1000000; // 24M
    const posizione = importoOpere - 1000000;
    const fattore = posizione / range;
    percentualeMax = 25 - (15 * fattore); // Da 25% a 10%
  }

  return (compensoBase * percentualeMax) / 100;
}

/**
 * Calcola l'incremento BIM secondo D.Lgs. 36/2023
 * Default: 10% del compenso base quando BIM è obbligatorio
 * (Come da indicazioni DM 17/06/2016 per metodologie avanzate)
 */
export function calcolaIncrementoBIM(
  compensoBase: number,
  percentualeIncremento: number = 10
): number {
  return (compensoBase * percentualeIncremento) / 100;
}

/**
 * Funzione principale di calcolo parcella secondo DM 17/06/2016
 */
export function calcolaParcelDM2016(input: ParcellaInputDM2016): ParcellaResultDM2016 {
  const { importoOpere, categoriaId, prestazioni, opzioni } = input;

  // Ottieni categoria dalla Tavola Z-1
  const categoriaOpera = getCategoriaById(categoriaId);
  if (!categoriaOpera) {
    throw new Error(`Categoria ${categoriaId} non trovata nella Tavola Z-1`);
  }

  // Calcola parametri base
  const P = calcolaParametroP(importoOpere);
  const G = categoriaOpera.G; // G viene dalla categoria, NON è selezionabile!

  const prestazioniCalcolate: PrestazioneCalcolata[] = [];
  let compensoBase = 0;

  const passaggi: string[] = [];
  passaggi.push(`Categoria: ${categoriaOpera.id} - ${categoriaOpera.descrizione}`);
  passaggi.push(`Destinazione funzionale: ${categoriaOpera.destinazioneFunzionale}`);
  passaggi.push('');
  passaggi.push(`Importo opere (V): €${importoOpere.toLocaleString('it-IT')}`);
  passaggi.push(`Parametro P = 0,03 + 10/V^0,4 = ${P.toFixed(6)}`);
  passaggi.push(`Parametro G (da Tavola Z-1): ${G.toFixed(2)}`);
  passaggi.push('');
  passaggi.push('Calcolo compensi per prestazione (V × G × Q × P):');

  // Calcola compenso per ogni prestazione selezionata
  Object.entries(prestazioni).forEach(([codice, selezionata]) => {
    if (selezionata) {
      const prestazioneInfo = getPrestazioneByCode(codice);
      if (!prestazioneInfo) {
        return;
      }

      // Ottieni Q specifico per questa categoria
      const Q = prestazioneInfo.Q[categoriaOpera.categoria];
      if (Q === undefined) {
        return;
      }

      const compenso = calcolaCompensoPrestazione(importoOpere, G, Q, P);
      const percentualeEffettiva = (compenso / importoOpere) * 100;

      prestazioniCalcolate.push({
        codice,
        descrizione: prestazioneInfo.descrizione,
        Q,
        compenso,
        percentualeEffettiva,
      });

      compensoBase += compenso;

      passaggi.push(
        `  ${codice} (Q=${Q.toFixed(3)}): €${compenso.toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} (${percentualeEffettiva.toFixed(2)}%)`
      );
    }
  });

  passaggi.push('');
  passaggi.push(`Compenso base totale: €${compensoBase.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);

  // Calcola eventuali incrementi e spese
  let compensoTotale = compensoBase;
  let incrementoBIM: number | undefined;
  let speseAccessorie: number | undefined;

  // Incremento BIM (D.Lgs. 36/2023)
  if (opzioni?.bimObbligatorio) {
    incrementoBIM = calcolaIncrementoBIM(compensoBase, opzioni.incrementoBIM);
    compensoTotale += incrementoBIM;
    passaggi.push(`Incremento BIM (+${opzioni.incrementoBIM || 25}%): €${incrementoBIM.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);
  }

  // Spese accessorie
  if (opzioni?.speseAccessorie) {
    speseAccessorie = calcolaSpeseAccessorie(compensoBase, importoOpere);
    compensoTotale += speseAccessorie;
    const percSpese = (speseAccessorie / compensoBase) * 100;
    passaggi.push(`Spese accessorie (${percSpese.toFixed(1)}%): €${speseAccessorie.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);
  }

  passaggi.push('');
  passaggi.push(`COMPENSO TOTALE: €${compensoTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);

  // Note informative
  const note: string[] = [];
  note.push(`Normativa: DM 17 giugno 2016 + D.Lgs. 36/2023`);
  note.push(`Categoria opera: ${categoriaOpera.id} - ${categoriaOpera.descrizione}`);
  note.push(`Parametro G (Tavola Z-1): ${G.toFixed(2)}`);
  note.push(`Prestazioni calcolate: ${prestazioniCalcolate.length}`);
  if (opzioni?.bimObbligatorio) {
    note.push(`✓ Incluso incremento BIM ${opzioni.incrementoBIM || 10}% (D.Lgs. 36/2023)`);
  }
  note.push('✓ Parametri G e Q ufficiali da Tavole Z-1 e Z-2 del DM 17/06/2016');

  return {
    importoBase: importoOpere,
    parametroP: P,
    parametroG: G,
    categoria: categoriaOpera.id,
    prestazioni: prestazioniCalcolate,
    compensoBase,
    incrementoBIM,
    speseAccessorie,
    compensoTotale,
    dettagliCalcolo: {
      formula: 'CP = ∑(V × G × Q × P)',
      passaggi,
    },
    note,
  };
}

// ============================================
// FUNZIONI UTILITY (riutilizzate da parcella-calculator-complete.ts)
// ============================================

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface FatturaCalculation {
  compensoNetto: number;
  cpa: number;
  imponibile: number;
  iva: number;
  totaleConIVA: number;
  ritenutaAcconto: number;
  nettoAPagare: number;
}

export function calcolaFattura(
  compensoNetto: number,
  aliquotaCPA: number = 4,
  aliquotaIVA: number = 22,
  aliquotaRitenuta: number = 20
): FatturaCalculation {
  const cpa = (compensoNetto * aliquotaCPA) / 100;
  const imponibile = compensoNetto + cpa;
  const iva = (imponibile * aliquotaIVA) / 100;
  const totaleConIVA = imponibile + iva;
  const ritenutaAcconto = (compensoNetto * aliquotaRitenuta) / 100;
  const nettoAPagare = totaleConIVA - ritenutaAcconto;

  return {
    compensoNetto,
    cpa,
    imponibile,
    iva,
    totaleConIVA,
    ritenutaAcconto,
    nettoAPagare,
  };
}

// ============================================
// CATEGORIE OPERE (da parcella-calculator-complete.ts)
// ============================================

export { CATEGORIE_DM2016 } from './parcella-calculator-complete';
