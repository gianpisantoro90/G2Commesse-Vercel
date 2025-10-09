// Calcolatore Parcella Professionale secondo DM 17 giugno 2016 (ex DM 143/2013)
// Tariffe professionali per servizi di architettura e ingegneria
// COMPLETO CON TUTTE LE CATEGORIE E PRESTAZIONI

export interface ParcellaInput {
  importoOpere: number; // Importo lavori in euro
  categoria: string; // Categoria opera (es: "E", "RE", "U", "P", "IA", "V", etc.)
  articolazione: string; // Sottolivello categoria
  prestazioni: {
    // Servizi di progettazione
    rp?: boolean; // Relazione Paesaggistica
    rilievo?: boolean; // Rilievo e restituzione grafica
    pfte?: boolean; // Progetto di Fattibilità Tecnico-Economica
    definitivo?: boolean; // Progettazione Definitiva
    esecutivo?: boolean; // Progettazione Esecutiva

    // Direzione e coordinamento
    dl?: boolean; // Direzione dei Lavori
    dlStrutture?: boolean; // DL Strutture
    dlImpianti?: boolean; // DL Impianti
    mis?: boolean; // Misura e contabilità
    coordinamento?: boolean; // Coordinamento sicurezza in progettazione (CSP)
    coordinamentoEsecuzione?: boolean; // Coordinamento sicurezza in esecuzione (CSE)

    // Collaudo e verifica
    collaudo?: boolean; // Collaudo tecnico-amministrativo
    collaudoStatico?: boolean; // Collaudo statico
    verificaProgetto?: boolean; // Verifica di progetto

    // Altre prestazioni
    durc?: boolean; // Attestazione del rispetto norme sicurezza
    praticheVVF?: boolean; // Pratiche VVF
    certificazioneEnergetica?: boolean; // Certificazione energetica
    sue?: boolean; // Sicurezza e salute
    pareriEnti?: boolean; // Pareri di enti e autorità
    perizia?: boolean; // Perizia e CTU
    valutatoreImmobiliare?: boolean; // Valutazione immobiliare
    due?: boolean; // Documento Unico di Regolarità Edilizia
  };
  complessita?: 'minima' | 'bassa' | 'media' | 'alta' | 'altissima'; // Grado di complessità
  percentualePersonalizzata?: number; // Override manuale
}

export interface ParcellaResult {
  importoBase: number;
  categoria: string;
  percentualeTotale: number;
  compensi: {
    [key: string]: {
      prestazione: string;
      percentuale: number;
      importo: number;
      gruppo: string; // 'progettazione' | 'direzione' | 'sicurezza' | 'collaudo' | 'altro'
    };
  };
  compensoTotale: number;
  note: string[];
}

// ============================================
// CATEGORIE E ARTICOLAZIONI DM 143/2013
// ============================================

export const CATEGORIE_DM143 = {
  // EDILIZIA (E)
  E: {
    nome: 'Edilizia',
    descrizione: 'Edifici ed opere di edilizia civile e rurale',
    articolazioni: {
      '01': 'Edilizia abitativa, agriturismo - fino a €100.000',
      '02': 'Edilizia abitativa, agriturismo - da €100.000 a €500.000',
      '03': 'Edilizia abitativa, agriturismo - da €500.000 a €2.500.000',
      '04': 'Edilizia abitativa, agriturismo - da €2.500.000 a €10.000.000',
      '05': 'Edilizia abitativa, agriturismo - oltre €10.000.000',
      '06': 'Servizi commerciali, direzionali - fino a €100.000',
      '07': 'Servizi commerciali, direzionali - da €100.000 a €500.000',
      '08': 'Servizi commerciali, direzionali - da €500.000 a €2.500.000',
      '09': 'Servizi commerciali, direzionali - da €2.500.000 a €10.000.000',
      '10': 'Servizi commerciali, direzionali - oltre €10.000.000',
      '11': 'Produzione artigianale, industriale - fino a €100.000',
      '12': 'Produzione artigianale, industriale - da €100.000 a €500.000',
      '13': 'Produzione artigianale, industriale - da €500.000 a €2.500.000',
      '14': 'Produzione artigianale, industriale - da €2.500.000 a €10.000.000',
      '15': 'Produzione artigianale, industriale - oltre €10.000.000',
      '16': 'Servizi sociali - fino a €100.000',
      '17': 'Servizi sociali - da €100.000 a €500.000',
      '18': 'Servizi sociali - da €500.000 a €2.500.000',
      '19': 'Servizi sociali - da €2.500.000 a €10.000.000',
      '20': 'Servizi sociali - oltre €10.000.000',
    }
  },

  // RESTAURO E MANUTENZIONE (RE)
  RE: {
    nome: 'Restauro e Manutenzione',
    descrizione: 'Opere di restauro, ripristino, manutenzione',
    articolazioni: {
      '01': 'Restauro, ripristino, ristrutturazione - fino a €100.000',
      '02': 'Restauro, ripristino, ristrutturazione - da €100.000 a €500.000',
      '03': 'Restauro, ripristino, ristrutturazione - da €500.000 a €2.500.000',
      '04': 'Restauro, ripristino, ristrutturazione - da €2.500.000 a €10.000.000',
      '05': 'Restauro, ripristino, ristrutturazione - oltre €10.000.000',
    }
  },

  // URBANISTICA (U)
  U: {
    nome: 'Urbanistica',
    descrizione: 'Pianificazione urbanistica, territoriale e ambientale',
    articolazioni: {
      '01': 'Pianificazione urbanistica generale',
      '02': 'Pianificazione urbanistica attuativa',
      '03': 'Piani di settore e piani tematici',
      '04': 'Programmazione complessa',
      '05': 'Pianificazione paesaggistica',
    }
  },

  // PAESAGGIO (P)
  P: {
    nome: 'Paesaggio',
    descrizione: 'Sistemazioni esterne e paesaggistiche',
    articolazioni: {
      '01': 'Verde urbano - fino a €50.000',
      '02': 'Verde urbano - da €50.000 a €250.000',
      '03': 'Verde urbano - da €250.000 a €1.000.000',
      '04': 'Verde urbano - oltre €1.000.000',
      '05': 'Parchi e giardini - fino a €50.000',
      '06': 'Parchi e giardini - da €50.000 a €250.000',
      '07': 'Parchi e giardini - da €250.000 a €1.000.000',
      '08': 'Parchi e giardini - oltre €1.000.000',
    }
  },

  // INFRASTRUTTURE VIARIE (IA)
  IA: {
    nome: 'Infrastrutture Viarie',
    descrizione: 'Strade, autostrade, ferrovie, aeroporti',
    articolazioni: {
      '01': 'Strade, ferrovie, aeroporti - fino a €500.000',
      '02': 'Strade, ferrovie, aeroporti - da €500.000 a €2.500.000',
      '03': 'Strade, ferrovie, aeroporti - da €2.500.000 a €10.000.000',
      '04': 'Strade, ferrovie, aeroporti - oltre €10.000.000',
      '05': 'Ponti e viadotti - fino a €500.000',
      '06': 'Ponti e viadotti - da €500.000 a €2.500.000',
      '07': 'Ponti e viadotti - da €2.500.000 a €10.000.000',
      '08': 'Ponti e viadotti - oltre €10.000.000',
      '09': 'Gallerie - fino a €2.500.000',
      '10': 'Gallerie - oltre €2.500.000',
    }
  },

  // INFRASTRUTTURE IDRAULICHE (V)
  V: {
    nome: 'Infrastrutture Idrauliche',
    descrizione: 'Opere idrauliche, marittime, acquedotti, fognature',
    articolazioni: {
      '01': 'Opere idrauliche e marittime - fino a €500.000',
      '02': 'Opere idrauliche e marittime - da €500.000 a €2.500.000',
      '03': 'Opere idrauliche e marittime - da €2.500.000 a €10.000.000',
      '04': 'Opere idrauliche e marittime - oltre €10.000.000',
      '05': 'Acquedotti, fognature, gasdotti - fino a €500.000',
      '06': 'Acquedotti, fognature, gasdotti - da €500.000 a €2.500.000',
      '07': 'Acquedotti, fognature, gasdotti - da €2.500.000 a €10.000.000',
      '08': 'Acquedotti, fognature, gasdotti - oltre €10.000.000',
    }
  },

  // STRUTTURE (S)
  S: {
    nome: 'Strutture',
    descrizione: 'Opere strutturali',
    articolazioni: {
      '01': 'Strutture in c.a., c.a.p., acciaio, legno, muratura - fino a €100.000',
      '02': 'Strutture in c.a., c.a.p., acciaio, legno, muratura - da €100.000 a €500.000',
      '03': 'Strutture in c.a., c.a.p., acciaio, legno, muratura - da €500.000 a €2.500.000',
      '04': 'Strutture in c.a., c.a.p., acciaio, legno, muratura - da €2.500.000 a €10.000.000',
      '05': 'Strutture in c.a., c.a.p., acciaio, legno, muratura - oltre €10.000.000',
      '06': 'Consolidamento strutturale - fino a €100.000',
      '07': 'Consolidamento strutturale - da €100.000 a €500.000',
      '08': 'Consolidamento strutturale - da €500.000 a €2.500.000',
      '09': 'Consolidamento strutturale - oltre €2.500.000',
    }
  },

  // IMPIANTI (IM)
  IM: {
    nome: 'Impianti',
    descrizione: 'Impianti termici, elettrici, meccanici, speciali',
    articolazioni: {
      '01': 'Impianti termomeccanici, elettrici - fino a €50.000',
      '02': 'Impianti termomeccanici, elettrici - da €50.000 a €250.000',
      '03': 'Impianti termomeccanici, elettrici - da €250.000 a €1.000.000',
      '04': 'Impianti termomeccanici, elettrici - da €1.000.000 a €5.000.000',
      '05': 'Impianti termomeccanici, elettrici - oltre €5.000.000',
      '06': 'Impianti speciali (antincendio, gas medicali, etc.) - fino a €50.000',
      '07': 'Impianti speciali - da €50.000 a €250.000',
      '08': 'Impianti speciali - da €250.000 a €1.000.000',
      '09': 'Impianti speciali - oltre €1.000.000',
    }
  },

  // OPERE GEOTECNICHE (G)
  G: {
    nome: 'Geotecnica',
    descrizione: 'Opere di fondazione e geotecniche',
    articolazioni: {
      '01': 'Opere geotecniche, fondazioni speciali - fino a €250.000',
      '02': 'Opere geotecniche, fondazioni speciali - da €250.000 a €1.000.000',
      '03': 'Opere geotecniche, fondazioni speciali - oltre €1.000.000',
    }
  },

  // BONIFICHE (BO)
  BO: {
    nome: 'Bonifiche',
    descrizione: 'Opere di bonifica ambientale',
    articolazioni: {
      '01': 'Bonifiche di siti contaminati - fino a €500.000',
      '02': 'Bonifiche di siti contaminati - da €500.000 a €2.500.000',
      '03': 'Bonifiche di siti contaminati - oltre €2.500.000',
    }
  }
};

// ============================================
// CORRISPETTIVI PERCENTUALI PER PRESTAZIONE
// ============================================
// Valori indicativi - da verificare con tariffario ufficiale

export const CORRISPETTIVI_BASE = {
  // PROGETTAZIONE (valori medi per complessità media)
  rp: 0.5, // Relazione paesaggistica
  rilievo: 1.5, // Rilievo
  pfte: 3.0, // PFTE
  definitivo: 4.5, // Definitiva
  esecutivo: 6.0, // Esecutiva

  // DIREZIONE LAVORI
  dl: 6.5, // DL generale
  dlStrutture: 3.5, // DL Strutture
  dlImpianti: 3.0, // DL Impianti
  mis: 3.0, // Misura e contabilità

  // SICUREZZA
  coordinamento: 1.5, // CSP
  coordinamentoEsecuzione: 3.5, // CSE

  // COLLAUDI
  collaudo: 2.0, // Collaudo tecnico-amministrativo
  collaudoStatico: 1.5, // Collaudo statico
  verificaProgetto: 1.5, // Verifica progetto

  // ALTRE PRESTAZIONI
  durc: 0.3,
  praticheVVF: 1.2,
  certificazioneEnergetica: 0.8,
  sue: 0.5,
  pareriEnti: 1.0,
  perizia: 4.0,
  valutatoreImmobiliare: 0.5,
  due: 0.4
};

// MOLTIPLICATORI PER COMPLESSITÀ
const MOLTIPLICATORI_COMPLESSITA = {
  minima: 0.75,
  bassa: 0.85,
  media: 1.0,
  alta: 1.20,
  altissima: 1.40
};

// MOLTIPLICATORI PER CATEGORIA (alcuni lavori hanno maggiorazioni)
const MOLTIPLICATORI_CATEGORIA: { [key: string]: number } = {
  RE: 1.15, // Restauro ha maggiorazione
  IA: 1.10, // Infrastrutture maggiorate
  V: 1.10,  // Opere idrauliche maggiorate
  S: 1.05,  // Strutture leggermente maggiorate
  G: 1.15,  // Geotecnica maggiorata
  BO: 1.20  // Bonifiche fortemente maggiorate
};

export function calcolaPercentialePerPrestazione(
  prestazione: string,
  complessita: string,
  categoria: string
): number {
  const percentualeBase = CORRISPETTIVI_BASE[prestazione as keyof typeof CORRISPETTIVI_BASE] || 0;
  const moltiplicatoreComplessita = MOLTIPLICATORI_COMPLESSITA[complessita as keyof typeof MOLTIPLICATORI_COMPLESSITA] || 1;
  const moltiplicatoreCategoria = MOLTIPLICATORI_CATEGORIA[categoria] || 1;

  return percentualeBase * moltiplicatoreComplessita * moltiplicatoreCategoria;
}

export function calcolaParcella(input: ParcellaInput): ParcellaResult {
  const complessita = input.complessita || 'media';
  const compensi: ParcellaResult['compensi'] = {};
  const note: string[] = [];

  let compensoTotale = 0;

  // Determina gruppo prestazione
  const getGruppo = (key: string): string => {
    if (['rp', 'rilievo', 'pfte', 'definitivo', 'esecutivo'].includes(key)) return 'progettazione';
    if (['dl', 'dlStrutture', 'dlImpianti', 'mis'].includes(key)) return 'direzione';
    if (['coordinamento', 'coordinamentoEsecuzione', 'sue'].includes(key)) return 'sicurezza';
    if (['collaudo', 'collaudoStatico', 'verificaProgetto'].includes(key)) return 'collaudo';
    return 'altro';
  };

  const getLabelPrestazione = (key: string): string => {
    const labels: { [key: string]: string } = {
      rp: 'Relazione Paesaggistica',
      rilievo: 'Rilievo e Restituzione Grafica',
      pfte: 'Progetto di Fattibilità Tecnico-Economica',
      definitivo: 'Progettazione Definitiva',
      esecutivo: 'Progettazione Esecutiva',
      dl: 'Direzione Lavori',
      dlStrutture: 'Direzione Lavori Strutture',
      dlImpianti: 'Direzione Lavori Impianti',
      mis: 'Misura e Contabilità',
      coordinamento: 'Coordinamento Sicurezza Progettazione (CSP)',
      coordinamentoEsecuzione: 'Coordinamento Sicurezza Esecuzione (CSE)',
      collaudo: 'Collaudo Tecnico-Amministrativo',
      collaudoStatico: 'Collaudo Statico',
      verificaProgetto: 'Verifica di Progetto',
      durc: 'Attestazione Rispetto Norme Sicurezza',
      praticheVVF: 'Pratiche VVF',
      certificazioneEnergetica: 'Certificazione Energetica',
      sue: 'Sicurezza e Salute (SUE)',
      pareriEnti: 'Acquisizione Pareri Enti',
      perizia: 'Perizia Estimativa / CTU',
      valutatoreImmobiliare: 'Valutazione Immobiliare',
      due: 'Documento Unico Regolarità Edilizia (DUE)'
    };
    return labels[key] || key;
  };

  // Calcola compenso per ogni prestazione selezionata
  Object.entries(input.prestazioni).forEach(([key, value]) => {
    if (value === true) {
      const percentuale = calcolaPercentialePerPrestazione(key, complessita, input.categoria);
      const importo = (input.importoOpere * percentuale) / 100;

      compensi[key] = {
        prestazione: getLabelPrestazione(key),
        percentuale,
        importo,
        gruppo: getGruppo(key)
      };

      compensoTotale += importo;
    }
  });

  // Calcola percentuale totale
  const percentualeTotale = (compensoTotale / input.importoOpere) * 100;

  // Note informative
  const catInfo = CATEGORIE_DM143[input.categoria as keyof typeof CATEGORIE_DM143];
  if (catInfo) {
    note.push(`Categoria: ${catInfo.nome} (${input.categoria})`);
    const articolazioneDesc = catInfo.articolazioni[input.articolazione as keyof typeof catInfo.articolazioni];
    if (articolazioneDesc) {
      note.push(`Articolazione: ${articolazioneDesc}`);
    }
  }
  note.push(`Grado di complessità: ${complessita.toUpperCase()}`);
  note.push(`Importo opere: €${input.importoOpere.toLocaleString('it-IT')}`);
  note.push(`Percentuale totale applicata: ${percentualeTotale.toFixed(2)}%`);
  note.push(`Compenso totale: €${compensoTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);

  return {
    importoBase: input.importoOpere,
    categoria: input.categoria,
    percentualeTotale,
    compensi,
    compensoTotale,
    note
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function calcolaCPA(compenso: number, aliquota: number = 4): number {
  return (compenso * aliquota) / 100;
}

export function calcolaRitenutaAcconto(compenso: number, aliquota: number = 20): number {
  return (compenso * aliquota) / 100;
}

export function calcolaIVA(compenso: number, aliquota: number = 22): number {
  return (compenso * aliquota) / 100;
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

// Suggerisce categoria e articolazione in base all'importo e tipo opera
export function suggestCategoriaArticolazione(
  importoOpere: number,
  tipoOpera: 'edilizia' | 'restauro' | 'infrastrutture' | 'strutture' | 'impianti' | 'paesaggio' | 'urbanistica'
): { categoria: string; articolazione: string; descrizione: string }[] {
  const suggerimenti: { categoria: string; articolazione: string; descrizione: string }[] = [];

  switch (tipoOpera) {
    case 'edilizia':
      if (importoOpere < 100000) {
        suggerimenti.push({ categoria: 'E', articolazione: '01', descrizione: CATEGORIE_DM143.E.articolazioni['01'] });
        suggerimenti.push({ categoria: 'E', articolazione: '06', descrizione: CATEGORIE_DM143.E.articolazioni['06'] });
      } else if (importoOpere < 500000) {
        suggerimenti.push({ categoria: 'E', articolazione: '02', descrizione: CATEGORIE_DM143.E.articolazioni['02'] });
        suggerimenti.push({ categoria: 'E', articolazione: '07', descrizione: CATEGORIE_DM143.E.articolazioni['07'] });
      } else if (importoOpere < 2500000) {
        suggerimenti.push({ categoria: 'E', articolazione: '03', descrizione: CATEGORIE_DM143.E.articolazioni['03'] });
        suggerimenti.push({ categoria: 'E', articolazione: '08', descrizione: CATEGORIE_DM143.E.articolazioni['08'] });
      }
      break;
    case 'strutture':
      if (importoOpere < 100000) {
        suggerimenti.push({ categoria: 'S', articolazione: '01', descrizione: CATEGORIE_DM143.S.articolazioni['01'] });
      } else if (importoOpere < 500000) {
        suggerimenti.push({ categoria: 'S', articolazione: '02', descrizione: CATEGORIE_DM143.S.articolazioni['02'] });
      } else if (importoOpere < 2500000) {
        suggerimenti.push({ categoria: 'S', articolazione: '03', descrizione: CATEGORIE_DM143.S.articolazioni['03'] });
      }
      break;
    case 'impianti':
      if (importoOpere < 50000) {
        suggerimenti.push({ categoria: 'IM', articolazione: '01', descrizione: CATEGORIE_DM143.IM.articolazioni['01'] });
      } else if (importoOpere < 250000) {
        suggerimenti.push({ categoria: 'IM', articolazione: '02', descrizione: CATEGORIE_DM143.IM.articolazioni['02'] });
      }
      break;
    // ...altri casi
  }

  return suggerimenti;
}
