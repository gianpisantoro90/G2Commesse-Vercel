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

// ============================================
// TIPI E INTERFACCE
// ============================================

export interface ParcellaInputDM2016 {
  importoOpere: number; // V - Importo lavori in euro
  categoria: string; // Es: 'E', 'S', 'IM', etc.
  articolazione: string; // Es: '01', '02', etc.
  destinazioneFunzionale?: string; // Tipologia specifica opera
  gradoComplessita: 'bassa' | 'media' | 'alta'; // Per determinare G
  prestazioni: {
    [key: string]: boolean; // Chiave = codice prestazione
  };
  opzioni?: {
    bimObbligatorio?: boolean; // D.Lgs. 36/2023: incremento per BIM
    incrementoBIM?: number; // Percentuale incremento (default: 25%)
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
// PARAMETRI GRADO DI COMPLESSITÀ (G)
// Tavola Z-1 - Valori indicativi
// ============================================

export const PARAMETRI_COMPLESSITA_G: {
  [categoria: string]: {
    [gradoComplessita: string]: number;
  };
} = {
  // EDILIZIA (E)
  E: {
    bassa: 0.90, // Opere semplici
    media: 1.00, // Complessità standard
    alta: 1.15, // Opere complesse (es. scuole, ospedali)
  },
  // RESTAURO E MANUTENZIONE (RE)
  RE: {
    bassa: 1.00,
    media: 1.15,
    alta: 1.25, // Restauro beni vincolati
  },
  // URBANISTICA (U)
  U: {
    bassa: 0.85,
    media: 1.00,
    alta: 1.10,
  },
  // PAESAGGIO (P)
  P: {
    bassa: 0.90,
    media: 1.00,
    alta: 1.10,
  },
  // INFRASTRUTTURE VIARIE (IA)
  IA: {
    bassa: 1.00,
    media: 1.10,
    alta: 1.20, // Ponti, gallerie
  },
  // INFRASTRUTTURE IDRAULICHE (V)
  V: {
    bassa: 1.00,
    media: 1.10,
    alta: 1.20,
  },
  // STRUTTURE (S)
  S: {
    bassa: 0.95,
    media: 1.05,
    alta: 1.15, // Strutture complesse
  },
  // IMPIANTI (IM)
  IM: {
    bassa: 0.90,
    media: 1.00,
    alta: 1.10, // Impianti speciali
  },
  // GEOTECNICA (G)
  G: {
    bassa: 1.05,
    media: 1.15,
    alta: 1.25,
  },
  // BONIFICHE (BO)
  BO: {
    bassa: 1.10,
    media: 1.20,
    alta: 1.30,
  },
};

// ============================================
// PARAMETRI SPECIFICITÀ PRESTAZIONE (Q)
// Tavola Z-2 - Valori indicativi
// ============================================

export const PARAMETRI_PRESTAZIONI_Q: {
  [codice: string]: {
    descrizione: string;
    Q: number;
    gruppo: 'progettazione' | 'direzione' | 'sicurezza' | 'collaudo' | 'altro';
  };
} = {
  // PROGETTAZIONE
  'QbI.01': {
    descrizione: 'Relazioni, planimetrie, elaborati grafici',
    Q: 0.09,
    gruppo: 'progettazione',
  },
  'QbI.02': {
    descrizione: 'Progetto di Fattibilità Tecnico-Economica (PFTE)',
    Q: 0.12,
    gruppo: 'progettazione',
  },
  'QbI.03': {
    descrizione: 'Progettazione Definitiva',
    Q: 0.18,
    gruppo: 'progettazione',
  },
  'QbI.04': {
    descrizione: 'Progettazione Esecutiva',
    Q: 0.24,
    gruppo: 'progettazione',
  },
  'QbI.05': {
    descrizione: 'Progettazione completa (PFTE + Def. + Esec.)',
    Q: 0.54, // 0.12 + 0.18 + 0.24
    gruppo: 'progettazione',
  },
  'QbI.09': {
    descrizione: 'Relazione sismica e geotecnica',
    Q: 0.015,
    gruppo: 'progettazione',
  },
  'QbI.10': {
    descrizione: 'Relazione paesaggistica',
    Q: 0.02,
    gruppo: 'progettazione',
  },
  'QbI.11': {
    descrizione: 'Rilievo e restituzione grafica',
    Q: 0.06,
    gruppo: 'progettazione',
  },

  // DIREZIONE LAVORI
  'QcI.01': {
    descrizione: 'Direzione Lavori e assistenza collaudo',
    Q: 0.32,
    gruppo: 'direzione',
  },
  'QcI.02': {
    descrizione: 'Direzione Lavori Strutture',
    Q: 0.18,
    gruppo: 'direzione',
  },
  'QcI.03': {
    descrizione: 'Direzione Lavori Impianti',
    Q: 0.15,
    gruppo: 'direzione',
  },
  'QcI.04': {
    descrizione: 'Misura e contabilità lavori',
    Q: 0.12,
    gruppo: 'direzione',
  },

  // COORDINAMENTO SICUREZZA
  'QcI.10': {
    descrizione: 'Coordinamento Sicurezza in Progettazione (CSP)',
    Q: 0.08,
    gruppo: 'sicurezza',
  },
  'QcI.11': {
    descrizione: 'Coordinamento Sicurezza in Esecuzione (CSE)',
    Q: 0.18,
    gruppo: 'sicurezza',
  },

  // COLLAUDI E VERIFICHE
  'QdI.01': {
    descrizione: 'Collaudo tecnico-amministrativo',
    Q: 0.10,
    gruppo: 'collaudo',
  },
  'QdI.02': {
    descrizione: 'Collaudo statico',
    Q: 0.08,
    gruppo: 'collaudo',
  },
  'QdI.03': {
    descrizione: 'Verifica di progetto',
    Q: 0.08,
    gruppo: 'collaudo',
  },

  // ALTRE PRESTAZIONI
  'QeI.01': {
    descrizione: 'Pratiche autorizzative (VVF, SUAP, etc.)',
    Q: 0.05,
    gruppo: 'altro',
  },
  'QeI.02': {
    descrizione: 'Certificazione energetica (APE)',
    Q: 0.03,
    gruppo: 'altro',
  },
  'QeI.03': {
    descrizione: 'Attestazione rispetto norme sicurezza (DURC)',
    Q: 0.015,
    gruppo: 'altro',
  },
  'QeI.04': {
    descrizione: 'Perizia estimativa / CTU',
    Q: 0.20,
    gruppo: 'altro',
  },
  'QeI.05': {
    descrizione: 'Valutazione immobiliare',
    Q: 0.025,
    gruppo: 'altro',
  },
  'QeI.06': {
    descrizione: 'Documento Unico Regolarità Edilizia (DUE)',
    Q: 0.02,
    gruppo: 'altro',
  },
};

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
 * Ottiene il parametro G (grado di complessità) per categoria e grado
 */
export function getParametroG(
  categoria: string,
  gradoComplessita: 'bassa' | 'media' | 'alta'
): number {
  const parametri = PARAMETRI_COMPLESSITA_G[categoria];
  if (!parametri) {
    console.warn(`Categoria ${categoria} non trovata, uso valori standard`);
    return 1.00; // Default
  }

  return parametri[gradoComplessita] || 1.00;
}

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
 * Default: 25% del compenso base quando BIM è obbligatorio
 */
export function calcolaIncrementoBIM(
  compensoBase: number,
  percentualeIncremento: number = 25
): number {
  return (compensoBase * percentualeIncremento) / 100;
}

/**
 * Funzione principale di calcolo parcella secondo DM 17/06/2016
 */
export function calcolaParcelDM2016(input: ParcellaInputDM2016): ParcellaResultDM2016 {
  const { importoOpere, categoria, gradoComplessita, prestazioni, opzioni } = input;

  // Calcola parametri base
  const P = calcolaParametroP(importoOpere);
  const G = getParametroG(categoria, gradoComplessita);

  const prestazioniCalcolate: PrestazioneCalcolata[] = [];
  let compensoBase = 0;

  const passaggi: string[] = [];
  passaggi.push(`Importo opere (V): €${importoOpere.toLocaleString('it-IT')}`);
  passaggi.push(`Parametro P = 0,03 + 10/V^0,4 = ${P.toFixed(6)}`);
  passaggi.push(`Parametro G (${gradoComplessita}): ${G.toFixed(2)}`);
  passaggi.push('');
  passaggi.push('Calcolo compensi per prestazione (V × G × Q × P):');

  // Calcola compenso per ogni prestazione selezionata
  Object.entries(prestazioni).forEach(([codice, selezionata]) => {
    if (selezionata && PARAMETRI_PRESTAZIONI_Q[codice]) {
      const prestazione = PARAMETRI_PRESTAZIONI_Q[codice];
      const Q = prestazione.Q;
      const compenso = calcolaCompensoPrestazione(importoOpere, G, Q, P);
      const percentualeEffettiva = (compenso / importoOpere) * 100;

      prestazioniCalcolate.push({
        codice,
        descrizione: prestazione.descrizione,
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
  note.push(`Categoria opera: ${categoria} - Complessità ${gradoComplessita}`);
  note.push(`Prestazioni calcolate: ${prestazioniCalcolate.length}`);
  if (opzioni?.bimObbligatorio) {
    note.push(`✓ Incluso incremento BIM ${opzioni.incrementoBIM || 25}% (D.Lgs. 36/2023)`);
  }
  note.push('ATTENZIONE: I parametri G e Q utilizzati sono indicativi. Verificare sempre con Tavole Z-1 e Z-2 ufficiali.');

  return {
    importoBase: importoOpere,
    parametroP: P,
    parametroG: G,
    categoria,
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

export { CATEGORIE_DM143 } from './parcella-calculator-complete';
