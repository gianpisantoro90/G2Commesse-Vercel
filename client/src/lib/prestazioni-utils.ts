import type { ProjectPrestazioni } from "@shared/schema";

// Configurazione prestazioni professionali
export const PRESTAZIONI_CONFIG = {
  progettazione: {
    id: 'progettazione',
    icon: '📐',
    label: 'Progettazione',
    shortLabel: 'Prog.',
    className: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Progettazione architettonica e/o strutturale'
  },
  dl: {
    id: 'dl',
    icon: '👷',
    label: 'Direzione Lavori',
    shortLabel: 'DL',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Direzione lavori e supervisione cantiere'
  },
  csp: {
    id: 'csp',
    icon: '🛡️',
    label: 'CSP',
    shortLabel: 'CSP',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'Coordinamento Sicurezza in fase di Progettazione'
  },
  cse: {
    id: 'cse',
    icon: '🛡️',
    label: 'CSE',
    shortLabel: 'CSE',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'Coordinamento Sicurezza in fase di Esecuzione'
  },
  contabilita: {
    id: 'contabilita',
    icon: '📊',
    label: 'Contabilità Lavori',
    shortLabel: 'Cont.',
    className: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Contabilità lavori e gestione economica'
  },
  collaudo: {
    id: 'collaudo',
    icon: '✅',
    label: 'Collaudo',
    shortLabel: 'Coll.',
    className: 'bg-green-100 text-green-800 border-green-200',
    description: 'Collaudo statico e/o funzionale'
  },
  perizia: {
    id: 'perizia',
    icon: '⚖️',
    label: 'Perizia',
    shortLabel: 'Per.',
    className: 'bg-pink-100 text-pink-800 border-pink-200',
    description: 'Perizie, CTU, CTP'
  },
  pratiche: {
    id: 'pratiche',
    icon: '📋',
    label: 'Pratiche',
    shortLabel: 'Prat.',
    className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Pratiche strutturali ed edilizie'
  }
} as const;

// Configurazione livelli progettazione
export const LIVELLO_PROGETTAZIONE_CONFIG = {
  pfte: {
    id: 'pfte',
    label: 'PFTE',
    fullLabel: 'Progetto di Fattibilità Tecnico-Economica',
    description: 'Progetto di Fattibilità Tecnico-Economica',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: '📋'
  },
  definitivo: {
    id: 'definitivo',
    label: 'Definitivo',
    fullLabel: 'Progetto Definitivo',
    description: 'Progetto definitivo',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: '📐'
  },
  esecutivo: {
    id: 'esecutivo',
    label: 'Esecutivo',
    fullLabel: 'Progetto Esecutivo',
    description: 'Progetto esecutivo',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: '🏗️'
  },
  variante: {
    id: 'variante',
    label: 'Variante',
    fullLabel: 'Variante in corso d\'opera',
    description: 'Variante in corso d\'opera',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: '🔄'
  }
} as const;

// Tipi per autocomplete e type safety
export type PrestazioneType = keyof typeof PRESTAZIONI_CONFIG;
export type LivelloProgettazioneType = keyof typeof LIVELLO_PROGETTAZIONE_CONFIG;

// Funzione per formattare importi in euro
export function formatImporto(amount?: number | null): string {
  if (amount === null || amount === undefined) return 'Forfait';
  
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Funzione per formattare percentuale
export function formatPercentuale(percentage?: number | null): string {
  if (!percentage) return '-';
  return `${percentage.toFixed(2)}%`;
}

// Funzione per validare classe DM 17/06/2016
export function validateClasseDM2016(classe?: string): boolean {
  if (!classe) return true; // Opzionale

  // Esempi di classi valide: E.22, IA.03, S.05 (formato ufficiale TAVOLA Z-1)
  // Accetta anche vecchio formato senza punto per retrocompatibilità: E22, IA03, S05
  const pattern = /^[A-Z]{1,2}\.?[0-9]{1,2}$/;
  return pattern.test(classe);
}

// Funzione per renderizzare badge prestazioni
export function renderPrestazioneBadge(
  prestazione: PrestazioneType, 
  size: 'sm' | 'md' = 'sm'
): {
  icon: string;
  label: string;
  className: string;
  fullLabel: string;
} {
  const config = PRESTAZIONI_CONFIG[prestazione];
  
  // Fallback se la prestazione non è riconosciuta  
  if (!config) {
    const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
    return {
      icon: '❓',
      label: String(prestazione).substring(0, 10),
      className: `inline-flex items-center gap-1 rounded-full font-medium border bg-gray-100 text-gray-800 border-gray-200 ${sizeClass}`,
      fullLabel: `Non riconosciuta: ${prestazione}`
    };
  }
  
  const sizeClass = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm';
    
  return {
    icon: config.icon,
    label: config.shortLabel,
    className: `inline-flex items-center gap-1 rounded-full font-medium border ${config.className} ${sizeClass}`,
    fullLabel: config.label
  };
}

// Funzione per ottenere configurazione prestazione
export function getPrestazioneConfig(prestazione: PrestazioneType) {
  return PRESTAZIONI_CONFIG[prestazione];
}

// Funzione per ottenere tutte le prestazioni disponibili
export function getAllPrestazioni(): Array<{ id: PrestazioneType; config: typeof PRESTAZIONI_CONFIG[PrestazioneType] }> {
  return Object.entries(PRESTAZIONI_CONFIG).map(([id, config]) => ({
    id: id as PrestazioneType,
    config
  }));
}

// Funzione per ottenere tutti i livelli progettazione
export function getAllLivelliProgettazione(): Array<{ id: LivelloProgettazioneType; config: typeof LIVELLO_PROGETTAZIONE_CONFIG[LivelloProgettazioneType] }> {
  return Object.entries(LIVELLO_PROGETTAZIONE_CONFIG).map(([id, config]) => ({
    id: id as LivelloProgettazioneType,
    config
  }));
}

// Funzione helper per verificare se progettazione è selezionata
export function hasProgettazione(prestazioni?: string[]): boolean {
  return prestazioni?.includes('progettazione') ?? false;
}

// Funzione per calcolare importo totale (opere + servizio)
export function calcolaImportoTotale(importoOpere?: number, importoServizio?: number): number {
  return (importoOpere || 0) + (importoServizio || 0);
}

/**
 * Calcola l'importo opere da classificazioniDM2016 (preferito) o fallback a importoOpere (deprecato)
 * Questa funzione garantisce retrocompatibilità con dati vecchi mentre supporta la nuova struttura
 */
export function getImportoOpere(metadata?: ProjectPrestazioni | null): number {
  if (!metadata) return 0;

  // Preferisci la nuova struttura classificazioniDM2016
  // I valori nel metadata JSON sono in centesimi (copiati dalla tabella DB), quindi dividiamo per 100
  if (metadata.classificazioniDM2016 && metadata.classificazioniDM2016.length > 0) {
    return metadata.classificazioniDM2016.reduce((sum, c) => sum + (c.importo || 0), 0) / 100;
  }

  // Fallback al campo deprecato per retrocompatibilità (anch'esso in centesimi)
  return (metadata.importoOpere || 0) / 100;
}

// Funzione per validare i dati prestazioni
export function validatePrestazioniData(data: ProjectPrestazioni): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Almeno una prestazione deve essere selezionata
  if (!data.prestazioni || data.prestazioni.length === 0) {
    errors.push('Almeno una prestazione deve essere selezionata');
  }

  // Se progettazione è selezionata, richiedere livello
  if (hasProgettazione(data.prestazioni) && (!data.livelloProgettazione || data.livelloProgettazione.length === 0)) {
    errors.push('Se la progettazione è selezionata, è necessario specificare il livello');
  }

  // Validare importi (retrocompatibilità)
  if (data.importoOpere && data.importoOpere < 0) {
    errors.push('L\'importo opere deve essere maggiore o uguale a 0');
  }

  if (data.importoServizio && data.importoServizio < 0) {
    errors.push('L\'importo servizio deve essere maggiore o uguale a 0');
  }

  if (data.percentualeParcella && (data.percentualeParcella < 0 || data.percentualeParcella > 100)) {
    errors.push('La percentuale parcella deve essere tra 0 e 100');
  }

  // Validare classe DM 2016 (retrocompatibilità)
  if (data.classeDM2016 && !validateClasseDM2016(data.classeDM2016)) {
    errors.push('Formato classe DM 17/06/2016 non valido (es: E.22, IA.03, S.05)');
  }

  // Validare classificazioni DM 17/06/2016 (nuova struttura)
  if (data.classificazioniDM2016 && data.classificazioniDM2016.length > 0) {
    data.classificazioniDM2016.forEach((classificazione, index) => {
      // Validare codice
      if (!classificazione.codice || classificazione.codice.trim() === '') {
        errors.push(`Classificazione ${index + 1}: codice categoria mancante`);
      } else if (!validateClasseDM2016(classificazione.codice)) {
        errors.push(`Classificazione ${index + 1}: formato codice non valido (${classificazione.codice})`);
      }

      // Validare importo
      if (classificazione.importo < 0) {
        errors.push(`Classificazione ${index + 1}: importo deve essere maggiore o uguale a 0`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Funzioni helper per il rendering delle colonne
export function renderPrestazioniColumn(prestazioni?: string[]): string[] {
  if (!prestazioni || prestazioni.length === 0) return [];
  
  return prestazioni.map(p => {
    const config = PRESTAZIONI_CONFIG[p as PrestazioneType];
    return config ? `${config.icon} ${config.shortLabel}` : p;
  });
}

export function renderClasseDMColumn(classe?: string, importoOpere?: number): {
  classe: string;
  importo: string;
  isFormatted: boolean;
} {
  return {
    classe: classe || '-',
    importo: formatImporto(importoOpere),
    isFormatted: !!classe
  };
}

// Funzione per renderizzare badge livelli progettazione
export function renderLivelloProgettazioneBadge(
  livello: LivelloProgettazioneType, 
  size: 'sm' | 'md' = 'sm'
): {
  icon: string;
  label: string;
  className: string;
  fullLabel: string;
} {
  const config = LIVELLO_PROGETTAZIONE_CONFIG[livello];
  
  // Fallback se il livello non è riconosciuto
  if (!config) {
    const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
    return {
      icon: '❓',
      label: String(livello),
      className: `inline-flex items-center gap-1 rounded-full font-medium border bg-gray-100 text-gray-800 border-gray-200 ${sizeClass}`,
      fullLabel: String(livello)
    };
  }
  
  const sizeClass = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm';
    
  return {
    icon: config.icon,
    label: config.label,
    className: `inline-flex items-center gap-1 rounded-full font-medium border ${config.className} ${sizeClass}`,
    fullLabel: config.fullLabel
  };
}

// Funzione per renderizzare colonna livelli progettazione
export function renderLivelliProgettazioneColumn(
  prestazioni?: string[], 
  livelloProgettazione?: string[]
): Array<{
  icon: string;
  label: string;
  className: string;
  fullLabel: string;
}> {
  // Mostra livelli solo se progettazione è selezionata
  if (!hasProgettazione(prestazioni) || !livelloProgettazione || livelloProgettazione.length === 0) {
    return [];
  }
  
  return livelloProgettazione.map(livello => 
    renderLivelloProgettazioneBadge(livello as LivelloProgettazioneType)
  );
}

// Configurazione tipi rapporto committenza
export const TIPO_RAPPORTO_CONFIG = {
  diretto: {
    id: 'diretto',
    label: 'Diretto',
    description: 'Incarico diretto con il committente',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: '🤝'
  },
  consulenza: {
    id: 'consulenza',
    label: 'Consulenza',
    description: 'Consulenza per altro professionista',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: '👥'
  },
  subappalto: {
    id: 'subappalto',
    label: 'Subappalto',
    description: 'Subappalto da altro professionista',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: '⚙️'
  },
  ati: {
    id: 'ati',
    label: 'ATI',
    description: 'Associazione Temporanea di Imprese',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: '🤝'
  },
  partnership: {
    id: 'partnership',
    label: 'Partnership',
    description: 'Partnership con altro professionista',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: '🔗'
  }
} as const;

export type TipoRapportoType = keyof typeof TIPO_RAPPORTO_CONFIG;

// Funzione per renderizzare badge tipo rapporto
export function renderTipoRapportoBadge(
  tipo: TipoRapportoType, 
  size: 'sm' | 'md' = 'sm'
): {
  icon: string;
  label: string;
  className: string;
  description: string;
} {
  const config = TIPO_RAPPORTO_CONFIG[tipo];
  
  // Fallback se il tipo non è riconosciuto
  if (!config) {
    const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
    return {
      icon: '❓',
      label: String(tipo),
      className: `inline-flex items-center gap-1 rounded-full font-medium border bg-gray-100 text-gray-800 border-gray-200 ${sizeClass}`,
      description: String(tipo)
    };
  }
  
  const sizeClass = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm';
    
  return {
    icon: config.icon,
    label: config.label,
    className: `inline-flex items-center gap-1 rounded-full font-medium border ${config.className} ${sizeClass}`,
    description: config.description
  };
}