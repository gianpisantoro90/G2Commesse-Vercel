// Calcolatore Parcella Professionale secondo DM 143/2013
// Tariffe professionali per servizi di architettura e ingegneria

export interface ParcellaInput {
  importoOpere: number; // Importo lavori in euro
  classeDM143?: string; // Classe DM 143 (es: "E22", "IA03")
  prestazioni: string[]; // Array prestazioni selezionate
  livelloProgettazione?: string[]; // Livelli progettazione se applicabile
  complessita?: 'bassa' | 'media' | 'alta'; // Complessità opera
  percentualePersonalizzata?: number; // Percentuale custom se necessario
}

export interface ParcellaResult {
  importoBase: number;
  percentualeApplicata: number;
  compensoProgettazione?: number;
  compensoDL?: number;
  compensoCSP?: number;
  compensoCSE?: number;
  compensoContabilita?: number;
  compensoCollaudo?: number;
  compensoPerizia?: number;
  compensoPratiche?: number;
  compensoTotale: number;
  dettagli: {
    prestazione: string;
    percentuale: number;
    importo: number;
  }[];
  note: string[];
}

// Tabelle percentuali DM 143/2013 semplificate
// Note: Queste sono percentuali indicative - adattare ai valori reali del DM 143

const PERCENTUALI_PROGETTAZIONE = {
  pfte: {
    bassa: 2.5,
    media: 3.0,
    alta: 3.5
  },
  definitivo: {
    bassa: 3.5,
    media: 4.0,
    alta: 4.5
  },
  esecutivo: {
    bassa: 4.5,
    media: 5.5,
    alta: 6.5
  },
  completo: { // PFTE + Definitivo + Esecutivo
    bassa: 10.5,
    media: 12.5,
    alta: 14.5
  }
};

const PERCENTUALI_ALTRE_PRESTAZIONI = {
  dl: {
    bassa: 5.0,
    media: 6.0,
    alta: 7.0
  },
  csp: {
    bassa: 1.5,
    media: 2.0,
    alta: 2.5
  },
  cse: {
    bassa: 3.0,
    media: 3.5,
    alta: 4.0
  },
  contabilita: {
    bassa: 2.5,
    media: 3.0,
    alta: 3.5
  },
  collaudo: {
    bassa: 1.5,
    media: 2.0,
    alta: 2.5
  },
  perizia: {
    bassa: 3.0,
    media: 4.0,
    alta: 5.0
  },
  pratiche: {
    bassa: 1.0,
    media: 1.5,
    alta: 2.0
  }
};

// Classi DM 143/2013 con range importi indicativi
export const CLASSI_DM143 = {
  // Edilizia
  'E01': { descrizione: 'Edilizia residenziale < 100k', rangeMin: 0, rangeMax: 100000 },
  'E11': { descrizione: 'Edilizia residenziale 100k-250k', rangeMin: 100000, rangeMax: 250000 },
  'E21': { descrizione: 'Edilizia residenziale 250k-500k', rangeMin: 250000, rangeMax: 500000 },
  'E22': { descrizione: 'Edilizia residenziale 500k-1M', rangeMin: 500000, rangeMax: 1000000 },
  'E23': { descrizione: 'Edilizia residenziale > 1M', rangeMin: 1000000, rangeMax: 10000000 },

  // Infrastrutture
  'IA01': { descrizione: 'Infrastrutture stradali < 500k', rangeMin: 0, rangeMax: 500000 },
  'IA02': { descrizione: 'Infrastrutture stradali 500k-2M', rangeMin: 500000, rangeMax: 2000000 },
  'IA03': { descrizione: 'Infrastrutture stradali > 2M', rangeMin: 2000000, rangeMax: 20000000 },

  // Strutture
  'S01': { descrizione: 'Strutture semplici < 100k', rangeMin: 0, rangeMax: 100000 },
  'S02': { descrizione: 'Strutture medie 100k-500k', rangeMin: 100000, rangeMax: 500000 },
  'S03': { descrizione: 'Strutture complesse 500k-2M', rangeMin: 500000, rangeMax: 2000000 },
  'S04': { descrizione: 'Strutture complesse > 2M', rangeMin: 2000000, rangeMax: 20000000 },

  // Impianti
  'I01': { descrizione: 'Impianti semplici < 50k', rangeMin: 0, rangeMax: 50000 },
  'I02': { descrizione: 'Impianti medi 50k-200k', rangeMin: 50000, rangeMax: 200000 },
  'I03': { descrizione: 'Impianti complessi > 200k', rangeMin: 200000, rangeMax: 5000000 },
};

export function suggestClasseDM143(importoOpere: number): string[] {
  const suggestions: string[] = [];

  for (const [classe, data] of Object.entries(CLASSI_DM143)) {
    if (importoOpere >= data.rangeMin && importoOpere <= data.rangeMax) {
      suggestions.push(classe);
    }
  }

  return suggestions.length > 0 ? suggestions : ['E22']; // Default
}

export function calcolaPercentialeProgettazione(
  livelli: string[],
  complessita: 'bassa' | 'media' | 'alta'
): number {
  if (!livelli || livelli.length === 0) return 0;

  // Se tutti i livelli sono selezionati, usa tariffa completa
  if (livelli.includes('pfte') && livelli.includes('definitivo') && livelli.includes('esecutivo')) {
    return PERCENTUALI_PROGETTAZIONE.completo[complessita];
  }

  // Altrimenti somma i singoli livelli
  let totale = 0;
  if (livelli.includes('pfte')) {
    totale += PERCENTUALI_PROGETTAZIONE.pfte[complessita];
  }
  if (livelli.includes('definitivo')) {
    totale += PERCENTUALI_PROGETTAZIONE.definitivo[complessita];
  }
  if (livelli.includes('esecutivo')) {
    totale += PERCENTUALI_PROGETTAZIONE.esecutivo[complessita];
  }
  if (livelli.includes('variante')) {
    // Variante: 50% del livello corrispondente
    totale += PERCENTUALI_PROGETTAZIONE.esecutivo[complessita] * 0.5;
  }

  return totale;
}

export function calcolaParcella(input: ParcellaInput): ParcellaResult {
  const complessita = input.complessita || 'media';
  const dettagli: ParcellaResult['dettagli'] = [];
  const note: string[] = [];

  let compensoTotale = 0;
  let compensoProgettazione = 0;
  let compensoDL = 0;
  let compensoCSP = 0;
  let compensoCSE = 0;
  let compensoContabilita = 0;
  let compensoCollaudo = 0;
  let compensoPerizia = 0;
  let compensoPratiche = 0;

  // Calcolo Progettazione
  if (input.prestazioni.includes('progettazione') && input.livelloProgettazione) {
    const percentuale = calcolaPercentialeProgettazione(input.livelloProgettazione, complessita);
    compensoProgettazione = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoProgettazione;

    dettagli.push({
      prestazione: `Progettazione (${input.livelloProgettazione.join(' + ')})`,
      percentuale,
      importo: compensoProgettazione
    });

    note.push(`Progettazione: ${percentuale}% su €${input.importoOpere.toLocaleString()}`);
  }

  // Calcolo Direzione Lavori
  if (input.prestazioni.includes('dl')) {
    const percentuale = PERCENTUALI_ALTRE_PRESTAZIONI.dl[complessita];
    compensoDL = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoDL;

    dettagli.push({
      prestazione: 'Direzione Lavori',
      percentuale,
      importo: compensoDL
    });

    note.push(`Direzione Lavori: ${percentuale}%`);
  }

  // Calcolo CSP
  if (input.prestazioni.includes('csp')) {
    const percentuale = PERCENTUALI_ALTRE_PRESTAZIONI.csp[complessita];
    compensoCSP = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoCSP;

    dettagli.push({
      prestazione: 'CSP - Coord. Sicurezza Progettazione',
      percentuale,
      importo: compensoCSP
    });
  }

  // Calcolo CSE
  if (input.prestazioni.includes('cse')) {
    const percentuale = PERCENTUALI_ALTRE_PRESTAZIONI.cse[complessita];
    compensoCSE = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoCSE;

    dettagli.push({
      prestazione: 'CSE - Coord. Sicurezza Esecuzione',
      percentuale,
      importo: compensoCSE
    });
  }

  // Calcolo Contabilità
  if (input.prestazioni.includes('contabilita')) {
    const percentuale = PERCENTUALI_ALTRE_PRESTAZIONI.contabilita[complessita];
    compensoContabilita = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoContabilita;

    dettagli.push({
      prestazione: 'Contabilità Lavori',
      percentuale,
      importo: compensoContabilita
    });
  }

  // Calcolo Collaudo
  if (input.prestazioni.includes('collaudo')) {
    const percentuale = PERCENTUALI_ALTRE_PRESTAZIONI.collaudo[complessita];
    compensoCollaudo = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoCollaudo;

    dettagli.push({
      prestazione: 'Collaudo',
      percentuale,
      importo: compensoCollaudo
    });
  }

  // Calcolo Perizia
  if (input.prestazioni.includes('perizia')) {
    const percentuale = PERCENTUALI_ALTRE_PRESTAZIONI.perizia[complessita];
    compensoPerizia = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoPerizia;

    dettagli.push({
      prestazione: 'Perizia/CTU',
      percentuale,
      importo: compensoPerizia
    });
  }

  // Calcolo Pratiche
  if (input.prestazioni.includes('pratiche')) {
    const percentuale = PERCENTUALI_ALTRE_PRESTAZIONI.pratiche[complessita];
    compensoPratiche = (input.importoOpere * percentuale) / 100;
    compensoTotale += compensoPratiche;

    dettagli.push({
      prestazione: 'Pratiche Strutturali/Edilizie',
      percentuale,
      importo: compensoPratiche
    });
  }

  // Calcola percentuale totale applicata
  const percentualeTotale = (compensoTotale / input.importoOpere) * 100;

  // Note aggiuntive
  note.push(`Complessità opera: ${complessita.toUpperCase()}`);
  if (input.classeDM143) {
    const classeInfo = CLASSI_DM143[input.classeDM143 as keyof typeof CLASSI_DM143];
    if (classeInfo) {
      note.push(`Classe DM 143: ${input.classeDM143} - ${classeInfo.descrizione}`);
    }
  }
  note.push(`Percentuale totale applicata: ${percentualeTotale.toFixed(2)}%`);

  return {
    importoBase: input.importoOpere,
    percentualeApplicata: percentualeTotale,
    compensoProgettazione: compensoProgettazione > 0 ? compensoProgettazione : undefined,
    compensoDL: compensoDL > 0 ? compensoDL : undefined,
    compensoCSP: compensoCSP > 0 ? compensoCSP : undefined,
    compensoCSE: compensoCSE > 0 ? compensoCSE : undefined,
    compensoContabilita: compensoContabilita > 0 ? compensoContabilita : undefined,
    compensoCollaudo: compensoCollaudo > 0 ? compensoCollaudo : undefined,
    compensoPerizia: compensoPerizia > 0 ? compensoPerizia : undefined,
    compensoPratiche: compensoPratiche > 0 ? compensoPratiche : undefined,
    compensoTotale,
    dettagli,
    note
  };
}

// Utility per formattare euro
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Calcola CPA (Cassa Previdenziale Architetti/Ingegneri)
export function calcolaCPA(compenso: number, aliquota: number = 4): number {
  return (compenso * aliquota) / 100;
}

// Calcola ritenuta d'acconto
export function calcolaRitenutaAcconto(compenso: number, aliquota: number = 20): number {
  return (compenso * aliquota) / 100;
}

// Calcola IVA
export function calcolaIVA(compenso: number, aliquota: number = 22): number {
  return (compenso * aliquota) / 100;
}

// Calcolo totale fattura
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
  const cpa = calcolaCPA(compensoNetto, aliquotaCPA);
  const imponibile = compensoNetto + cpa;
  const iva = calcolaIVA(imponibile, aliquotaIVA);
  const totaleConIVA = imponibile + iva;
  const ritenutaAcconto = calcolaRitenutaAcconto(compensoNetto, aliquotaRitenuta);
  const nettoAPagare = totaleConIVA - ritenutaAcconto;

  return {
    compensoNetto,
    cpa,
    imponibile,
    iva,
    totaleConIVA,
    ritenutaAcconto,
    nettoAPagare
  };
}
