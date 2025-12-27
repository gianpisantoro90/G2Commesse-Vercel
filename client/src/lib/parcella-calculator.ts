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

// Classi DM 143/2013 - TAVOLA Z-1 (aggiornata con DM 17/06/2016)
export const CLASSI_DM143 = {
  // EDILIZIA
  'E.01': { descrizione: 'Insediamenti produttivi agricoltura-industria-artigianato semplici', grado: 0.65, categoria: 'Edilizia' },
  'E.02': { descrizione: 'Edifici industriali con corredi tecnici complessi', grado: 0.95, categoria: 'Edilizia' },
  'E.03': { descrizione: 'Ostelli, Pensioni, Ristoranti, Motel, negozi, mercati semplici', grado: 0.95, categoria: 'Edilizia' },
  'E.04': { descrizione: 'Alberghi, Villaggi turistici, Centri commerciali complessi', grado: 1.20, categoria: 'Edilizia' },
  'E.05': { descrizione: 'Edifici, pertinenze, autorimesse semplici', grado: 0.65, categoria: 'Edilizia' },
  'E.06': { descrizione: 'Edilizia residenziale privata e pubblica di tipo corrente', grado: 0.95, categoria: 'Edilizia' },
  'E.07': { descrizione: 'Edifici residenziali di tipo pregiato', grado: 1.20, categoria: 'Edilizia' },
  'E.08': { descrizione: 'Sedi ASL, Ambulatori, Asili, Scuole', grado: 0.95, categoria: 'Edilizia' },
  'E.09': { descrizione: 'Scuole secondarie grandi, Case di cura', grado: 1.15, categoria: 'Edilizia' },
  'E.10': { descrizione: 'Poliambulatori, Ospedali, Università, Istituti ricerca', grado: 1.20, categoria: 'Edilizia' },
  'E.11': { descrizione: 'Padiglioni esposizioni, opere cimiteriali, oratori, campi sportivi semplici', grado: 0.95, categoria: 'Edilizia' },
  'E.12': { descrizione: 'Campi sportivi complessi, Palestre, piscine coperte', grado: 1.15, categoria: 'Edilizia' },
  'E.13': { descrizione: 'Biblioteca, Cinema, Teatro, Museo, Chiese, Palasport, Stadio', grado: 1.20, categoria: 'Edilizia' },
  'E.14': { descrizione: 'Edifici provvisori a servizio di caserme', grado: 0.65, categoria: 'Edilizia' },
  'E.15': { descrizione: 'Caserme con corredi tecnici correnti', grado: 0.95, categoria: 'Edilizia' },
  'E.16': { descrizione: 'Sedi Uffici, Tribunali, Penitenziari, Caserme complesse', grado: 1.20, categoria: 'Edilizia' },
  'E.17': { descrizione: 'Verde ed opere di arredo urbano semplici, Campeggi', grado: 0.65, categoria: 'Edilizia' },
  'E.18': { descrizione: 'Arredamenti standard, Giardini, Parchi gioco, Piazze', grado: 0.95, categoria: 'Edilizia' },
  'E.19': { descrizione: 'Arredamenti singolari, Parchi urbani, Riqualificazione paesaggistica', grado: 1.20, categoria: 'Edilizia' },
  'E.20': { descrizione: 'Manutenzione straordinaria, ristrutturazione edifici esistenti', grado: 0.95, categoria: 'Edilizia' },
  'E.21': { descrizione: 'Restauro edifici di interesse storico artistico', grado: 1.20, categoria: 'Edilizia' },
  'E.22': { descrizione: 'Restauro conservativo edifici storici vincolati', grado: 1.55, categoria: 'Edilizia' },

  // STRUTTURE
  'S.01': { descrizione: 'Strutture c.a. non soggette ad azioni sismiche', grado: 0.70, categoria: 'Strutture' },
  'S.02': { descrizione: 'Strutture muratura/legno/metallo non soggette ad azioni sismiche', grado: 0.50, categoria: 'Strutture' },
  'S.03': { descrizione: 'Strutture in cemento armato con verifiche strutturali', grado: 0.95, categoria: 'Strutture' },
  'S.04': { descrizione: 'Strutture muratura, legno, metallo con verifiche strutturali', grado: 0.90, categoria: 'Strutture' },
  'S.05': { descrizione: 'Strutture speciali (dighe, gallerie, opere sotterranee)', grado: 1.05, categoria: 'Strutture' },
  'S.06': { descrizione: 'Opere strutturali di notevole importanza costruttiva', grado: 1.15, categoria: 'Strutture' },

  // IMPIANTI MECCANICI E ELETTRICI
  'IA.01': { descrizione: 'Impianti idrici, sanitari, fognature domestiche', grado: 0.75, categoria: 'Impianti' },
  'IA.02': { descrizione: 'Impianti riscaldamento, climatizzazione', grado: 0.85, categoria: 'Impianti' },
  'IA.03': { descrizione: 'Impianti elettrici standard, illuminazione, antincendio', grado: 1.15, categoria: 'Impianti' },
  'IA.04': { descrizione: 'Impianti elettrici complessi, cablaggi strutturati, fibra ottica', grado: 1.30, categoria: 'Impianti' },

  // IMPIANTI INDUSTRIALI
  'IB.04': { descrizione: 'Depositi e discariche senza trattamento', grado: 0.55, categoria: 'Impianti' },
  'IB.05': { descrizione: 'Impianti industrie molitorie, alimentari, legno', grado: 0.70, categoria: 'Impianti' },
  'IB.06': { descrizione: 'Impianti industria chimica, siderurgici, termovalorizzatori', grado: 0.70, categoria: 'Impianti' },
  'IB.07': { descrizione: 'Impianti complessi con rischi rilevanti', grado: 0.75, categoria: 'Impianti' },
  'IB.08': { descrizione: 'Linee elettriche, reti trasmissione', grado: 0.50, categoria: 'Impianti' },
  'IB.09': { descrizione: 'Centrali idroelettriche ordinarie', grado: 0.60, categoria: 'Impianti' },
  'IB.10': { descrizione: 'Impianti termoelettrici, elettrometallurgia', grado: 0.75, categoria: 'Impianti' },
  'IB.11': { descrizione: 'Campi fotovoltaici, Parchi eolici', grado: 0.90, categoria: 'Impianti' },
  'IB.12': { descrizione: 'Micro centrali, Impianti termoelettrici complessi', grado: 1.00, categoria: 'Impianti' },

  // INFRASTRUTTURE PER LA MOBILITÀ
  'V.01': { descrizione: 'Manutenzione viabilità ordinaria', grado: 0.40, categoria: 'Infrastrutture Mobilità' },
  'V.02': { descrizione: 'Strade, ferrovie ordinarie, piste ciclabili', grado: 0.45, categoria: 'Infrastrutture Mobilità' },
  'V.03': { descrizione: 'Viabilità speciale, impianti teleferici, piste aeroportuali', grado: 0.75, categoria: 'Infrastrutture Mobilità' },

  // IDRAULICA
  'D.01': { descrizione: 'Opere navigazione interna e portuali', grado: 0.65, categoria: 'Idraulica' },
  'D.02': { descrizione: 'Bonifiche e irrigazioni a deflusso naturale', grado: 0.45, categoria: 'Idraulica' },
  'D.03': { descrizione: 'Bonifiche con sollevamento meccanico', grado: 0.55, categoria: 'Idraulica' },
  'D.04': { descrizione: 'Acquedotti e fognature semplici', grado: 0.65, categoria: 'Idraulica' },
  'D.05': { descrizione: 'Acquedotti e fognature complessi', grado: 0.80, categoria: 'Idraulica' },

  // TECNOLOGIE ICT
  'T.01': { descrizione: 'Sistemi informativi, data center', grado: 0.95, categoria: 'Tecnologie ICT' },
  'T.02': { descrizione: 'Reti telecomunicazione, videosorveglianza', grado: 0.70, categoria: 'Tecnologie ICT' },
  'T.03': { descrizione: 'Sistemi elettronici, automazione, robotica', grado: 1.20, categoria: 'Tecnologie ICT' },

  // PAESAGGIO E AMBIENTE
  'P.01': { descrizione: 'Sistemazione naturalistica o paesaggistica', grado: 0.85, categoria: 'Paesaggio e Ambiente' },
  'P.02': { descrizione: 'Interventi del verde', grado: 0.85, categoria: 'Paesaggio e Ambiente' },
  'P.03': { descrizione: 'Recupero e riqualificazione ambientale', grado: 0.85, categoria: 'Paesaggio e Ambiente' },
  'P.04': { descrizione: 'Sfruttamento cave e torbiere', grado: 0.85, categoria: 'Paesaggio e Ambiente' },
  'P.05': { descrizione: 'Miglioramento filiera forestale', grado: 0.85, categoria: 'Paesaggio e Ambiente' },
  'P.06': { descrizione: 'Miglioramento fondiario agrario', grado: 0.85, categoria: 'Paesaggio e Ambiente' },

  // TERRITORIO E URBANISTICA
  'U.01': { descrizione: 'Valorizzazione filiere agroalimentari', grado: 0.90, categoria: 'Territorio e Urbanistica' },
  'U.02': { descrizione: 'Valorizzazione filiera naturalistica', grado: 0.95, categoria: 'Territorio e Urbanistica' },
  'U.03': { descrizione: 'Pianificazione', grado: 1.00, categoria: 'Territorio e Urbanistica' },
};

export function suggestClasseDM143(importoOpere: number): string[] {
  // Suggerimenti basati sull'importo opere per le categorie più comuni
  const suggestions: string[] = [];

  if (importoOpere < 100000) {
    suggestions.push('E.05', 'E.06');
  } else if (importoOpere < 500000) {
    suggestions.push('E.06', 'E.08');
  } else if (importoOpere < 2000000) {
    suggestions.push('E.06', 'E.07', 'E.10');
  } else {
    suggestions.push('E.07', 'E.10', 'E.13');
  }

  return suggestions;
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
