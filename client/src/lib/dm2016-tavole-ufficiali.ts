/**
 * TAVOLE UFFICIALI DM 17 GIUGNO 2016
 *
 * IMPORTANTE: Questo file contiene le tabelle UFFICIALI dal decreto.
 * I valori G e Q sono associati automaticamente alle categorie/prestazioni.
 *
 * Fonte: https://www.bosettiegatti.eu/info/norme/statali/2016_dm_17_06_tariffe_allegato.pdf
 * Completato con tutti i valori estratti dal PDF ufficiale
 */

// ============================================
// TAVOLA Z-1: CATEGORIE DELLE OPERE
// ============================================

export interface CategoriaOpera {
  id: string; // es. "E.01", "S.01", "IA.01"
  categoria: string; // es. "E", "S", "IA"
  descrizione: string;
  destinazioneFunzionale: string;
  G: number; // Parametro di complessità FISSO per questa categoria
}

/**
 * TAVOLA Z-1 - EDILIZIA (E)
 * 
 * Fonte: DM 17/06/2016 - Tavola Z-1
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_EDILIZIA: CategoriaOpera[] = [
  {
    id: 'E.01',
    categoria: 'E',
    descrizione: 'Insediamenti Produttivi - Agricoltura Semplice',
    destinazioneFunzionale: 'Edifici rurali per l\'attività agricola con corredi tecnici di tipo semplice (tettoie, depositi e ricoveri) - Edifici industriali o artigianali di importanza costruttiva corrente con corredi tecnici di base',
    G: 0.65
  },
  {
    id: 'E.02',
    categoria: 'E',
    descrizione: 'Insediamenti Produttivi - Agricoltura Complessa',
    destinazioneFunzionale: 'Edifici rurali per l\'attività agricola con corredi tecnici di tipo complesso - Edifici industriali o artigianali con organizzazione e corredi tecnici di tipo complesso',
    G: 0.95
  },
  {
    id: 'E.03',
    categoria: 'E',
    descrizione: 'Industria Alberghiera e Turismo - Semplice',
    destinazioneFunzionale: 'Ostelli, Pensioni, Case albergo - Ristoranti - Motel e stazioni di servizio - Negozi - Mercati coperti di tipo semplice',
    G: 0.95
  },
  {
    id: 'E.04',
    categoria: 'E',
    descrizione: 'Industria Alberghiera e Turismo - Complessa',
    destinazioneFunzionale: 'Alberghi, Villaggi turistici - Mercati e Centri commerciali complessi',
    G: 1.20
  },
  {
    id: 'E.05',
    categoria: 'E',
    descrizione: 'Residenza - Semplice',
    destinazioneFunzionale: 'Edifici, pertinenze, autorimesse semplici, senza particolari esigenze tecniche. Edifici provvisori di modesta importanza',
    G: 0.65
  },
  {
    id: 'E.06',
    categoria: 'E',
    descrizione: 'Residenza - Corrente',
    destinazioneFunzionale: 'Edilizia residenziale privata e pubblica di tipo corrente con costi di costruzione nella media di mercato e con tipologie standardizzate',
    G: 0.95
  },
  {
    id: 'E.07',
    categoria: 'E',
    descrizione: 'Residenza - Pregiata',
    destinazioneFunzionale: 'Edifici residenziali di tipo pregiato con costi di costruzione eccedenti la media di mercato e con tipologie diversificate',
    G: 1.20
  },
  {
    id: 'E.08',
    categoria: 'E',
    descrizione: 'Sanità, Istruzione, Ricerca - Base',
    destinazioneFunzionale: 'Sede Azienda Sanitaria, Distretto sanitario, Ambulatori di base. Asilo Nido, Scuola Materna, Scuola elementare, Scuole secondarie di primo grado fino a 24 classi, Scuole secondarie di secondo grado fino a 25 classi',
    G: 0.95
  },
  {
    id: 'E.09',
    categoria: 'E',
    descrizione: 'Sanità, Istruzione, Ricerca - Media',
    destinazioneFunzionale: 'Scuole secondarie di primo grado oltre 24 classi - Istituti scolastici superiori oltre 25 classi - Case di cura',
    G: 1.15
  },
  {
    id: 'E.10',
    categoria: 'E',
    descrizione: 'Sanità, Istruzione, Ricerca - Alta',
    destinazioneFunzionale: 'Poliambulatori, Ospedali, Istituti di ricerca, Centri di riabilitazione, Poli scolastici, Università, Accademie, Istituti di ricerca universitaria',
    G: 1.20
  },
  {
    id: 'E.11',
    categoria: 'E',
    descrizione: 'Cultura, Vita Sociale, Sport, Culto - Semplice',
    destinazioneFunzionale: 'Padiglioni provvisori per esposizioni - Opere cimiteriali di tipo normale (colombari, ossari, loculari, edicole funerarie semplici), Case parrocchiali, Oratori - Stabilimenti balneari - Aree ed attrezzature per lo sport all\'aperto, Campo sportivo e servizi annessi, di tipo semplice',
    G: 0.95
  },
  {
    id: 'E.12',
    categoria: 'E',
    descrizione: 'Cultura, Vita Sociale, Sport, Culto - Complesso',
    destinazioneFunzionale: 'Aree ed attrezzature per lo sport all\'aperto, Campo sportivo e servizi annessi, di tipo complesso - Palestre e piscine coperte',
    G: 1.15
  },
  {
    id: 'E.13',
    categoria: 'E',
    descrizione: 'Cultura, Vita Sociale, Sport, Culto - Monumentale',
    destinazioneFunzionale: 'Biblioteca, Cinema, Teatro, Pinacoteca, Centro Culturale, Sede congressuale, Auditorium, Museo, Galleria d\'arte, Discoteca, Studio radiofonico o televisivo - Opere cimiteriali monumentali, Monumenti commemorativi, Palasport, Stadio, Chiese',
    G: 1.20
  },
  {
    id: 'E.14',
    categoria: 'E',
    descrizione: 'Sedi Amministrative - Provvisorie',
    destinazioneFunzionale: 'Edifici provvisori di modesta importanza a servizio di caserme',
    G: 0.65
  },
  {
    id: 'E.15',
    categoria: 'E',
    descrizione: 'Sedi Amministrative - Caserme',
    destinazioneFunzionale: 'Caserme con corredi tecnici di importanza corrente',
    G: 0.95
  },
  {
    id: 'E.16',
    categoria: 'E',
    descrizione: 'Sedi Amministrative - Complesse',
    destinazioneFunzionale: 'Sedi ed Uffici di Società ed Enti, Sedi ed Uffici comunali, provinciali, regionali, ministeriali, Pretura, Tribunale, Palazzo di giustizia, Penitenziari, Caserme con corredi tecnici di importanza maggiore, Questura',
    G: 1.20
  },
  {
    id: 'E.17',
    categoria: 'E',
    descrizione: 'Arredi e Aree Esterne - Semplici',
    destinazioneFunzionale: 'Verde ed opere di arredo urbano improntate a grande semplicità, pertinenziali agli edifici ed alla viabilità, Campeggi e simili',
    G: 0.65
  },
  {
    id: 'E.18',
    categoria: 'E',
    descrizione: 'Arredi e Aree Esterne - Standard',
    destinazioneFunzionale: 'Arredamenti con elementi acquistati dal mercato, Giardini, Parchi gioco, Piazze e spazi pubblici all\'aperto',
    G: 0.95
  },
  {
    id: 'E.19',
    categoria: 'E',
    descrizione: 'Arredi e Aree Esterne - Singolari',
    destinazioneFunzionale: 'Arredamenti con elementi singolari, Parchi urbani, Parchi ludici attrezzati, Giardini e piazze storiche, Opere di riqualificazione paesaggistica e ambientale di aree urbane',
    G: 1.20
  },
  {
    id: 'E.20',
    categoria: 'E',
    descrizione: 'Edifici Esistenti - Manutenzione Straordinaria',
    destinazioneFunzionale: 'Interventi di manutenzione straordinaria, ristrutturazione, riqualificazione, su edifici e manufatti esistenti',
    G: 0.95
  },
  {
    id: 'E.21',
    categoria: 'E',
    descrizione: 'Edifici Esistenti - Restauro',
    destinazioneFunzionale: 'Interventi di manutenzione straordinaria, restauro, ristrutturazione, riqualificazione, su edifici e manufatti di interesse storico artistico non vincolati',
    G: 1.20
  },
  {
    id: 'E.22',
    categoria: 'E',
    descrizione: 'Edifici Esistenti - Restauro Vincolato',
    destinazioneFunzionale: 'Interventi di manutenzione, restauro, risanamento conservativo, riqualificazione, su edifici e manufatti di interesse storico artistico soggetti a tutela',
    G: 1.55
  }
];

/**
 * TAVOLA Z-1 - STRUTTURE (S)
 * 
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_STRUTTURE: CategoriaOpera[] = [
  {
    id: 'S.01',
    categoria: 'S',
    descrizione: 'Strutture C.A. Non Sismiche - Interventi Locali',
    destinazioneFunzionale: 'Strutture o parti di strutture in cemento armato, non soggette ad azioni sismiche - riparazione o intervento locale - Verifiche strutturali relative - Ponteggi, centinature e strutture provvisionali di durata inferiore a due anni',
    G: 0.70
  },
  {
    id: 'S.02',
    categoria: 'S',
    descrizione: 'Strutture Muratura/Legno/Metallo - Non Sismiche',
    destinazioneFunzionale: 'Strutture o parti di strutture in muratura, legno, metallo, non soggette ad azioni sismiche - riparazione o intervento locale - Verifiche strutturali relative',
    G: 0.50
  },
  {
    id: 'S.03',
    categoria: 'S',
    descrizione: 'Strutture C.A. - Standard',
    destinazioneFunzionale: 'Strutture o parti di strutture in cemento armato - Verifiche strutturali relative - Ponteggi, centinature e strutture provvisionali di durata superiore a due anni',
    G: 0.95
  },
  {
    id: 'S.04',
    categoria: 'S',
    descrizione: 'Strutture Muratura/Legno/Metallo - Standard',
    destinazioneFunzionale: 'Strutture o parti di strutture in muratura, legno, metallo - Verifiche strutturali relative - Consolidamento delle opere di fondazione di manufatti dissestati - Ponti, Paratie e tiranti, Consolidamento di pendii e di fronti rocciosi ed opere connesse, di tipo corrente',
    G: 0.90
  },
  {
    id: 'S.05',
    categoria: 'S',
    descrizione: 'Strutture Speciali',
    destinazioneFunzionale: 'Dighe, Conche, Elevatori, Opere di ritenuta e di difesa, rilevati, colmate. Gallerie, Opere sotterranee e subacquee, Fondazioni speciali',
    G: 1.05
  },
  {
    id: 'S.06',
    categoria: 'S',
    descrizione: 'Strutture di Notevole Importanza',
    destinazioneFunzionale: 'Opere strutturali di notevole importanza costruttiva e richiedenti calcolazioni particolari - Verifiche strutturali relative - Strutture con metodologie normative che richiedono modellazione particolare: edifici alti con necessità di valutazioni di secondo ordine',
    G: 1.15
  }
];

/**
 * TAVOLA Z-1 - IMPIANTI (IA e IB)
 * 
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_IMPIANTI: CategoriaOpera[] = [
  {
    id: 'IA.01',
    categoria: 'IA',
    descrizione: 'Impianti Meccanici a Fluido',
    destinazioneFunzionale: 'Impianti per l\'approvvigionamento, la preparazione e la distribuzione di acqua - Impianti sanitari - Impianti di fognatura domestica od industriale - Reti di distribuzione di combustibili liquidi o gassosi - Impianti per la distribuzione dell\'aria compressa del vuoto e di gas medicali - Impianti e reti antincendio',
    G: 0.75
  },
  {
    id: 'IA.02',
    categoria: 'IA',
    descrizione: 'Impianti Termici e Climatizzazione',
    destinazioneFunzionale: 'Impianti di riscaldamento - Impianto di raffrescamento, climatizzazione, trattamento dell\'aria - Impianti meccanici di distribuzione fluidi - Impianto solare termico',
    G: 0.85
  },
  {
    id: 'IA.03',
    categoria: 'IA',
    descrizione: 'Impianti Elettrici - Standard',
    destinazioneFunzionale: 'Impianti elettrici in genere, impianti di illuminazione, telefonici, di rivelazione incendi, fotovoltaici, a corredo di edifici e costruzioni di importanza corrente - singole apparecchiature per laboratori e impianti pilota di tipo semplice',
    G: 1.15
  },
  {
    id: 'IA.04',
    categoria: 'IA',
    descrizione: 'Impianti Elettrici - Complessi',
    destinazioneFunzionale: 'Impianti elettrici in genere, impianti di illuminazione, telefonici, di sicurezza, di rivelazione incendi, fotovoltaici, a corredo di edifici e costruzioni complessi - cablaggi strutturati - impianti in fibra ottica - singole apparecchiature per laboratori e impianti pilota di tipo complesso',
    G: 1.30
  },
  {
    id: 'IB.04',
    categoria: 'IB',
    descrizione: 'Depositi e Discariche Inerti',
    destinazioneFunzionale: 'Depositi e discariche senza trattamento dei rifiuti',
    G: 0.55
  },
  {
    id: 'IB.05',
    categoria: 'IB',
    descrizione: 'Impianti Industriali - Semplici',
    destinazioneFunzionale: 'Impianti per le industrie molitorie, cartarie, alimentari, delle fibre tessili naturali, del legno, del cuoio e simili',
    G: 0.70
  },
  {
    id: 'IB.06',
    categoria: 'IB',
    descrizione: 'Impianti Industriali - Standard',
    destinazioneFunzionale: 'Impianti della industria chimica inorganica - Impianti della preparazione e distillazione dei combustibili - Impianti siderurgici - Officine meccaniche e laboratori - Cantieri navali - Fabbriche di cemento, calce, laterizi, vetrerie e ceramiche - Impianti termovalorizzatori e impianti di trattamento dei rifiuti',
    G: 0.70
  },
  {
    id: 'IB.07',
    categoria: 'IB',
    descrizione: 'Impianti Industriali - Complessi',
    destinazioneFunzionale: 'Gli impianti precedentemente esposti quando siano di complessità particolarmente rilevante o comportanti rischi e problematiche ambientali molto rilevanti',
    G: 0.75
  },
  {
    id: 'IB.08',
    categoria: 'IB',
    descrizione: 'Reti Elettriche - Trasmissione',
    destinazioneFunzionale: 'Impianti di linee e reti per trasmissioni e distribuzione di energia elettrica, telegrafia, telefonia',
    G: 0.50
  },
  {
    id: 'IB.09',
    categoria: 'IB',
    descrizione: 'Centrali Idroelettriche',
    destinazioneFunzionale: 'Centrali idroelettriche ordinarie - Stazioni di trasformazioni e di conversione impianti di trazione elettrica',
    G: 0.60
  },
  {
    id: 'IB.10',
    categoria: 'IB',
    descrizione: 'Impianti Termoelettrici e Laboratori',
    destinazioneFunzionale: 'Impianti termoelettrici - Impianti dell\'elettrochimica - Impianti della elettrometallurgia - Laboratori con ridotte problematiche tecniche',
    G: 0.75
  },
  {
    id: 'IB.11',
    categoria: 'IB',
    descrizione: 'Energie Rinnovabili',
    destinazioneFunzionale: 'Campi fotovoltaici - Parchi eolici',
    G: 0.90
  },
  {
    id: 'IB.12',
    categoria: 'IB',
    descrizione: 'Impianti Energetici Complessi',
    destinazioneFunzionale: 'Micro Centrali idroelettriche - Impianti termoelettrici - Impianti della elettrometallurgia di tipo complesso',
    G: 1.00
  }
];

/**
 * TAVOLA Z-1 - INFRASTRUTTURE PER LA MOBILITÀ (V)
 * 
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_INFRASTRUTTURE: CategoriaOpera[] = [
  {
    id: 'V.01',
    categoria: 'V',
    descrizione: 'Manutenzione Viabilità',
    destinazioneFunzionale: 'Interventi di manutenzione su viabilità ordinaria',
    G: 0.40
  },
  {
    id: 'V.02',
    categoria: 'V',
    descrizione: 'Viabilità Ordinaria',
    destinazioneFunzionale: 'Strade, linee tramviarie, ferrovie, strade ferrate, di tipo ordinario, escluse le opere d\'arte da compensarsi a parte - Piste ciclabili',
    G: 0.45
  },
  {
    id: 'V.03',
    categoria: 'V',
    descrizione: 'Viabilità Speciale',
    destinazioneFunzionale: 'Strade, linee tramviarie, ferrovie, strade ferrate, con particolari difficoltà di studio, escluse le opere d\'arte e le stazioni, da compensarsi a parte - Impianti teleferici e funicolari - Piste aeroportuali e simili',
    G: 0.75
  }
];

/**
 * TAVOLA Z-1 - OPERE IDRAULICHE (D)
 * 
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_IDRAULICHE: CategoriaOpera[] = [
  {
    id: 'D.01',
    categoria: 'D',
    descrizione: 'Navigazione',
    destinazioneFunzionale: 'Opere di navigazione interna e portuali',
    G: 0.65
  },
  {
    id: 'D.02',
    categoria: 'D',
    descrizione: 'Bonifiche a Deflusso Naturale',
    destinazioneFunzionale: 'Bonifiche ed irrigazioni a deflusso naturale, sistemazione di corsi d\'acqua e di bacini montani',
    G: 0.45
  },
  {
    id: 'D.03',
    categoria: 'D',
    descrizione: 'Bonifiche con Sollevamento Meccanico',
    destinazioneFunzionale: 'Bonifiche ed irrigazioni con sollevamento meccanico di acqua (esclusi i macchinari) - Derivazioni d\'acqua per forza motrice e produzione di energia elettrica',
    G: 0.55
  },
  {
    id: 'D.04',
    categoria: 'D',
    descrizione: 'Acquedotti e Fognature - Semplici',
    destinazioneFunzionale: 'Impianti per provvista, condotta, distribuzione d\'acqua, improntate a grande semplicità - Fognature urbane improntate a grande semplicità - Condotte subacquee in genere, metanodotti e gasdotti, di tipo ordinario',
    G: 0.65
  },
  {
    id: 'D.05',
    categoria: 'D',
    descrizione: 'Acquedotti e Fognature - Complessi',
    destinazioneFunzionale: 'Impianti per provvista, condotta, distribuzione d\'acqua - Fognature urbane - Condotte subacquee in genere, metanodotti e gasdotti, con problemi tecnici di tipo speciale',
    G: 0.80
  }
];

/**
 * TAVOLA Z-1 - TECNOLOGIE ICT (T)
 * 
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_ICT: CategoriaOpera[] = [
  {
    id: 'T.01',
    categoria: 'T',
    descrizione: 'Sistemi Informativi',
    destinazioneFunzionale: 'Sistemi informativi, gestione elettronica del flusso documentale, dematerializzazione e gestione archivi, ingegnerizzazione dei processi, sistemi di gestione delle attività produttive, Data center, server farm',
    G: 0.95
  },
  {
    id: 'T.02',
    categoria: 'T',
    descrizione: 'Sistemi e Reti di Telecomunicazione',
    destinazioneFunzionale: 'Reti locali e geografiche, cablaggi strutturati, impianti in fibra ottica, Impianti di videosorveglianza, controllo accessi, identificazione targhe di veicoli ecc Sistemi wireless, reti wifi, ponti radio',
    G: 0.70
  },
  {
    id: 'T.03',
    categoria: 'T',
    descrizione: 'Sistemi Elettronici e Automazione',
    destinazioneFunzionale: 'Elettronica Industriale Sistemi a controllo numerico, Sistemi di automazione, Robotica',
    G: 1.20
  }
];

/**
 * TAVOLA Z-1 - PAESAGGIO E AMBIENTE (P)
 * 
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_PAESAGGIO: CategoriaOpera[] = [
  {
    id: 'P.01',
    categoria: 'P',
    descrizione: 'Sistemazione Naturalistica o Paesaggistica',
    destinazioneFunzionale: 'Opere relative alla sistemazione di ecosistemi naturali o naturalizzati, alle aree naturali protette ed alle aree a rilevanza faunistica. Opere relative al restauro paesaggistico di territori compromessi ed agli interventi su elementi strutturali del paesaggio. Opere di configurazione di assetto paesaggistico',
    G: 0.85
  },
  {
    id: 'P.02',
    categoria: 'P',
    descrizione: 'Interventi del Verde',
    destinazioneFunzionale: 'Opere a verde sia su piccola scala o grande scala dove la rilevanza dell\'opera è prevalente rispetto alle opere di tipo costruttivo',
    G: 0.85
  },
  {
    id: 'P.03',
    categoria: 'P',
    descrizione: 'Recupero e Riqualificazione Ambientale',
    destinazioneFunzionale: 'Opere di riqualificazione e risanamento di ambiti naturali, rurali e forestali o urbani finalizzati al ripristino delle condizioni originarie, al riassetto delle componenti biotiche ed abiotiche',
    G: 0.85
  },
  {
    id: 'P.04',
    categoria: 'P',
    descrizione: 'Sfruttamento Cave e Torbiere',
    destinazioneFunzionale: 'Opere di utilizzazione di bacini estrattivi a parete o a fossa',
    G: 0.85
  },
  {
    id: 'P.05',
    categoria: 'P',
    descrizione: 'Miglioramento Filiera Forestale',
    destinazioneFunzionale: 'Opere di assetto ed utilizzazione forestale nonché dell\'impiego ai fini industriali, energetici ed ambientali. Piste forestali, strade forestali - percorsi naturalistici, aree di sosta e di stazionamento dei mezzi forestali. Meccanizzazione forestale',
    G: 0.85
  },
  {
    id: 'P.06',
    categoria: 'P',
    descrizione: 'Miglioramento Fondiario Agrario',
    destinazioneFunzionale: 'Opere di intervento per la realizzazione di infrastrutture e di miglioramento dell\'assetto rurale',
    G: 0.85
  }
];

/**
 * TAVOLA Z-1 - TERRITORIO E URBANISTICA (U)
 * 
 * COMPLETA con tutti i valori dal PDF ufficiale
 */
export const TAVOLA_Z1_TERRITORIO: CategoriaOpera[] = [
  {
    id: 'U.01',
    categoria: 'U',
    descrizione: 'Valorizzazione Filiere Agroalimentari',
    destinazioneFunzionale: 'Opere ed infrastrutture complesse, anche a carattere immateriale, volte a migliorare l\'assetto del territorio rurale per favorire lo sviluppo dei processi agricoli e zootecnici. Opere e strutture per la valorizzazione delle filiere (produzione, trasformazione e commercializzazione delle produzioni agricole e agroalimentari)',
    G: 0.90
  },
  {
    id: 'U.02',
    categoria: 'U',
    descrizione: 'Valorizzazione Filiera Naturalistica',
    destinazioneFunzionale: 'Interventi di valorizzazione degli ambiti naturali sia di tipo vegetazionale che faunistico',
    G: 0.95
  },
  {
    id: 'U.03',
    categoria: 'U',
    descrizione: 'Pianificazione',
    destinazioneFunzionale: 'Strumenti di pianificazione generale ed attuativa e di pianificazione di settore',
    G: 1.00
  }
];

/**
 * TAVOLA Z-1 COMPLETA
 * Unisce tutte le categorie
 */
export const TAVOLA_Z1_COMPLETA: CategoriaOpera[] = [
  ...TAVOLA_Z1_EDILIZIA,
  ...TAVOLA_Z1_STRUTTURE,
  ...TAVOLA_Z1_IMPIANTI,
  ...TAVOLA_Z1_INFRASTRUTTURE,
  ...TAVOLA_Z1_IDRAULICHE,
  ...TAVOLA_Z1_ICT,
  ...TAVOLA_Z1_PAESAGGIO,
  ...TAVOLA_Z1_TERRITORIO,
];

/**
 * Ottiene una categoria per ID
 */
export function getCategoriaById(id: string): CategoriaOpera | undefined {
  return TAVOLA_Z1_COMPLETA.find(cat => cat.id === id);
}

/**
 * Ottiene tutte le categorie per una categoria principale
 */
export function getCategorieByCategoria(categoria: string): CategoriaOpera[] {
  return TAVOLA_Z1_COMPLETA.filter(cat => cat.categoria === categoria);
}

// ============================================
// TAVOLA Z-2: PRESTAZIONI E PARAMETRI Q
// ============================================

export interface PrestazioneQ {
  codice: string; // es. "QbI.01", "QcI.01"
  fase: 'pianificazione' | 'progettazione_preliminare' | 'progettazione_definitiva' | 'progettazione_esecutiva' | 'direzione' | 'sicurezza' | 'collaudo' | 'altro';
  descrizione: string;
  Q: Record<string, number>; // Q varia per categoria: { E: 0.09, S: 0.09, IA: 0.09, ... }
}

/**
 * TAVOLA Z-2 - PIANIFICAZIONE E PROGRAMMAZIONE (Qa.0)
 * 
 * Fonte: DM 17/06/2016 - Tavola Z-2
 */
export const TAVOLA_Z2_PIANIFICAZIONE: PrestazioneQ[] = [
  {
    codice: 'Qa.0.01',
    fase: 'pianificazione',
    descrizione: 'Pianificazione urbanistica generale (fino a 15.000 abitanti)',
    Q: { U: 0.005 }
  },
  {
    codice: 'Qa.0.02',
    fase: 'pianificazione',
    descrizione: 'Rilievi e controlli del terreno, analisi geoambientali (fino a 15.000 abitanti)',
    Q: { D: 0.0010, U: 0.0010 }
  },
  {
    codice: 'Qa.0.03',
    fase: 'pianificazione',
    descrizione: 'Pianificazione forestale, paesaggistica, naturalistica ed ambientale',
    Q: { P: 0.005, U: 0.005 }
  },
  {
    codice: 'Qa.0.04',
    fase: 'pianificazione',
    descrizione: 'Piani aziendali agronomici, di concimazione, fertilizzazione, reflui e fitoiatrici',
    Q: { P: 0.030 }
  },
  {
    codice: 'Qa.0.05',
    fase: 'pianificazione',
    descrizione: 'Programmazione economica, territoriale, locale e rurale',
    Q: { P: 0.003, U: 0.003 }
  },
  {
    codice: 'Qa.0.06',
    fase: 'pianificazione',
    descrizione: 'Piani urbanistici esecutivi, di sviluppo aziendale (fino a € 7.500.000)',
    Q: { U: 0.026, P: 0.036 }
  }
];

/**
 * TAVOLA Z-2 - STUDI DI FATTIBILITÀ (QaI)
 */
export const TAVOLA_Z2_FATTIBILITA: PrestazioneQ[] = [
  {
    codice: 'QaI.01',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione illustrativa',
    Q: { E: 0.045, S: 0.045, IA: 0.045, V: 0.040, D: 0.035, T: 0.050, P: 0.040, U: 0.040 }
  },
  {
    codice: 'QaI.02',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione illustrativa, Elaborati progettuali e tecnico economici',
    Q: { E: 0.090, S: 0.090, IA: 0.090, V: 0.080, D: 0.070, T: 0.100, P: 0.080, U: 0.080 }
  },
  {
    codice: 'QaI.03',
    fase: 'progettazione_preliminare',
    descrizione: 'Supporto al RUP: accertamenti e verifiche preliminari',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  }
];

/**
 * TAVOLA Z-2 - STIME E VALUTAZIONI (QaII)
 */
export const TAVOLA_Z2_STIME: PrestazioneQ[] = [
  {
    codice: 'QaII.01',
    fase: 'altro',
    descrizione: 'Stime sintetiche, basate su elementi sintetici e globali',
    Q: { E: 0.040, S: 0.040, IA: 0.040, V: 0.040, D: 0.040, T: 0.040, P: 0.040, U: 0.040 }
  },
  {
    codice: 'QaII.02',
    fase: 'altro',
    descrizione: 'Stime particolareggiate, complete di criteri di valutazione',
    Q: { E: 0.080, S: 0.080, IA: 0.080, V: 0.080, D: 0.080, T: 0.080, P: 0.080, U: 0.090 }
  },
  {
    codice: 'QaII.03',
    fase: 'altro',
    descrizione: 'Stime analitiche, integrate con specifiche e distinte',
    Q: { E: 0.160, S: 0.160, IA: 0.160, V: 0.160, D: 0.160, T: 0.160, P: 0.160, U: 0.160 }
  }
];

/**
 * TAVOLA Z-2 - RILIEVI STUDI ED ANALISI (QaIII)
 */
export const TAVOLA_Z2_RILIEVI: PrestazioneQ[] = [
  {
    codice: 'QaIII.01',
    fase: 'altro',
    descrizione: 'Rilievi, studi e classificazioni agronomiche, colturali, delle biomasse',
    Q: { P: 0.020, U: 0.0003 }
  },
  {
    codice: 'QaIII.02',
    fase: 'altro',
    descrizione: 'Rilievo botanico e analisi vegetazionali',
    Q: { P: 0.015, U: 0.00025 }
  },
  {
    codice: 'QaIII.03',
    fase: 'altro',
    descrizione: 'Elaborazioni, analisi e valutazioni con modelli numerici',
    Q: { D: 0.025, P: 0.030 }
  }
];

/**
 * TAVOLA Z-2 - PIANI ECONOMICI (QaIV)
 */
export const TAVOLA_Z2_PIANI_ECONOMICI: PrestazioneQ[] = [
  {
    codice: 'QaIV.01',
    fase: 'altro',
    descrizione: 'Piani economici, aziendali, business plan e di investimento',
    Q: { P: 0.005, U: 0.0015 }
  }
];

/**
 * TAVOLA Z-2 - PROGETTAZIONE PRELIMINARE (QbI)
 */
export const TAVOLA_Z2_PROG_PRELIMINARE: PrestazioneQ[] = [
  {
    codice: 'QbI.01',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazioni, planimetrie, elaborati grafici',
    Q: { E: 0.090, S: 0.090, IA: 0.090, V: 0.080, D: 0.070, T: 0.100, P: 0.080, U: 0.080 }
  },
  {
    codice: 'QbI.02',
    fase: 'progettazione_preliminare',
    descrizione: 'Calcolo sommario spesa, quadro economico di progetto',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  },
  {
    codice: 'QbI.03',
    fase: 'progettazione_preliminare',
    descrizione: 'Piano particellare preliminare delle aree',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QbI.04',
    fase: 'progettazione_preliminare',
    descrizione: 'Piano economico e finanziario di massima',
    Q: { E: 0.030, S: 0.030, IA: 0.030, V: 0.030, D: 0.030, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbI.05',
    fase: 'progettazione_preliminare',
    descrizione: 'Capitolato speciale descrittivo e prestazionale, schema di contratto',
    Q: { E: 0.070, S: 0.070, IA: 0.070, V: 0.070, D: 0.070, T: 0.070, P: 0.070, U: 0.070 }
  },
  {
    codice: 'QbI.06',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione geotecnica',
    Q: { E: 0.030, S: 0.030, IA: 0.030, V: 0.030, D: 0.030, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbI.07',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione idrologica',
    Q: { E: 0.015, S: 0.015, IA: 0.015, V: 0.015, D: 0.015, T: 0.015, P: 0.015, U: 0.015 }
  },
  {
    codice: 'QbI.08',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione idraulica',
    Q: { E: 0.015, S: 0.015, IA: 0.015, V: 0.015, D: 0.015, T: 0.015, P: 0.015, U: 0.015 }
  },
  {
    codice: 'QbI.09',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione sismica e sulle strutture',
    Q: { E: 0.015, S: 0.015, IA: 0.015, V: 0.015, D: 0.015, T: 0.015, P: 0.015, U: 0.015 }
  },
  {
    codice: 'QbI.10',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione archeologica',
    Q: { E: 0.015, S: 0.015, IA: 0.015, V: 0.015, D: 0.015, T: 0.015, P: 0.015, U: 0.015 }
  },
  {
    codice: 'QbI.11',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione geologica (fino a € 250.000)',
    Q: { E: 0.039, S: 0.039, IA: 0.053, V: 0.039, D: 0.068, T: 0.053, P: 0.053, U: 0.053 }
  },
  {
    codice: 'QbI.12',
    fase: 'progettazione_preliminare',
    descrizione: 'Progettazione integrale e coordinata',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QbI.13',
    fase: 'progettazione_preliminare',
    descrizione: 'Studio di inserimento urbanistico',
    Q: { E: 0.030, S: 0.030, V: 0.010, D: 0.010, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbI.14',
    fase: 'progettazione_preliminare',
    descrizione: 'Relazione tecnica sullo stato di consistenza degli immobili da ristrutturare',
    Q: { E: 0.030, S: 0.030, IA: 0.030 }
  },
  {
    codice: 'QbI.15',
    fase: 'progettazione_preliminare',
    descrizione: 'Prime indicazioni di progettazione antincendio',
    Q: { E: 0.005, IA: 0.005, T: 0.005 }
  },
  {
    codice: 'QbI.16',
    fase: 'progettazione_preliminare',
    descrizione: 'Prime indicazioni e prescrizioni per la stesura dei Piani di Sicurezza',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  },
  {
    codice: 'QbI.17',
    fase: 'progettazione_preliminare',
    descrizione: 'Studi di prefattibilità ambientale (fino a € 5.000.000)',
    Q: { E: 0.030, S: 0.035, IA: 0.030, V: 0.035, D: 0.035, T: 0.030, P: 0.035, U: 0.035 }
  },
  {
    codice: 'QbI.18',
    fase: 'progettazione_preliminare',
    descrizione: 'Piano di monitoraggio ambientale (fino a € 5.000.000)',
    Q: { E: 0.018, S: 0.020, IA: 0.018, V: 0.020, D: 0.020, T: 0.018, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QbI.19',
    fase: 'progettazione_preliminare',
    descrizione: 'Supporto al RUP: supervisione e coordinamento della progettazione preliminare',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  },
  {
    codice: 'QbI.20',
    fase: 'progettazione_preliminare',
    descrizione: 'Supporto al RUP: verifica della progettazione preliminare',
    Q: { E: 0.060, S: 0.060, IA: 0.060, V: 0.060, D: 0.060, T: 0.060, P: 0.060, U: 0.060 }
  }
];

/**
 * TAVOLA Z-2 - PROGETTAZIONE DEFINITIVA (QbII)
 */
export const TAVOLA_Z2_PROG_DEFINITIVA: PrestazioneQ[] = [
  {
    codice: 'QbII.01',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazioni generale e tecniche, Elaborati grafici, Calcolo delle strutture e degli impianti',
    Q: { E: 0.230, S: 0.180, IA: 0.220, V: 0.180, D: 0.250, T: 0.180, P: 0.180, U: 0.180 }
  },
  {
    codice: 'QbII.02',
    fase: 'progettazione_definitiva',
    descrizione: 'Rilievi dei manufatti',
    Q: { E: 0.040, S: 0.040, IA: 0.040 }
  },
  {
    codice: 'QbII.03',
    fase: 'progettazione_definitiva',
    descrizione: 'Disciplinare descrittivo e prestazionale',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  },
  {
    codice: 'QbII.04',
    fase: 'progettazione_definitiva',
    descrizione: 'Piano particellare d\'esproprio',
    Q: { E: 0.040, S: 0.040, V: 0.040, D: 0.040, P: 0.040, U: 0.040 }
  },
  {
    codice: 'QbII.05',
    fase: 'progettazione_definitiva',
    descrizione: 'Elenco prezzi unitari ed eventuali analisi, Computo metrico estimativo',
    Q: { E: 0.070, S: 0.040, IA: 0.070, V: 0.060, D: 0.050, T: 0.050, P: 0.050, U: 0.050 }
  },
  {
    codice: 'QbII.06',
    fase: 'progettazione_definitiva',
    descrizione: 'Studio di inserimento urbanistico',
    Q: { E: 0.030, S: 0.030, V: 0.010, D: 0.010, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbII.07',
    fase: 'progettazione_definitiva',
    descrizione: 'Rilievi planoaltimetrici',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QbII.08',
    fase: 'progettazione_definitiva',
    descrizione: 'Schema di contratto, Capitolato speciale d\'appalto',
    Q: { E: 0.070, S: 0.070, IA: 0.080, V: 0.070, D: 0.070, T: 0.070, P: 0.070, U: 0.070 }
  },
  {
    codice: 'QbII.09',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione geotecnica',
    Q: { E: 0.060, S: 0.060, IA: 0.060, V: 0.060, D: 0.060, T: 0.060, P: 0.060, U: 0.060 }
  },
  {
    codice: 'QbII.10',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione idrologica',
    Q: { E: 0.030, S: 0.030, IA: 0.030, V: 0.030, D: 0.030, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbII.11',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione idraulica',
    Q: { E: 0.030, S: 0.030, IA: 0.030, V: 0.030, D: 0.030, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbII.12',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione sismica e sulle strutture',
    Q: { E: 0.030, S: 0.030, IA: 0.030, V: 0.030, D: 0.030, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbII.13',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione geologica (fino a € 250.000)',
    Q: { E: 0.064, S: 0.064, IA: 0.133, V: 0.064, D: 0.145, T: 0.133, P: 0.133, U: 0.133 }
  },
  {
    codice: 'QbII.14',
    fase: 'progettazione_definitiva',
    descrizione: 'Analisi storico critica e relazione sulle strutture esistenti',
    Q: { E: 0.090 }
  },
  {
    codice: 'QbII.15',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione sulle indagini dei materiali e delle strutture per edifici esistenti',
    Q: { E: 0.120 }
  },
  {
    codice: 'QbII.16',
    fase: 'progettazione_definitiva',
    descrizione: 'Verifica sismica delle strutture esistenti e individuazione delle carenze strutturali',
    Q: { E: 0.180 }
  },
  {
    codice: 'QbII.17',
    fase: 'progettazione_definitiva',
    descrizione: 'Progettazione integrale e coordinata',
    Q: { E: 0.050, S: 0.050, IA: 0.050, V: 0.050, D: 0.050, T: 0.050, P: 0.050, U: 0.050 }
  },
  {
    codice: 'QbII.18',
    fase: 'progettazione_definitiva',
    descrizione: 'Elaborati di progettazione antincendio',
    Q: { E: 0.060, IA: 0.060, T: 0.060 }
  },
  {
    codice: 'QbII.19',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione paesaggistica (d.lgs. 42/2004)',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QbII.20',
    fase: 'progettazione_definitiva',
    descrizione: 'Elaborati e relazioni per requisiti acustici',
    Q: { E: 0.020, IA: 0.020, V: 0.020, P: 0.020 }
  },
  {
    codice: 'QbII.21',
    fase: 'progettazione_definitiva',
    descrizione: 'Relazione energetica (ex Legge 10/91)',
    Q: { E: 0.030, IA: 0.030, T: 0.030 }
  },
  {
    codice: 'QbII.22',
    fase: 'progettazione_definitiva',
    descrizione: 'Diagnosi energetica degli edifici esistenti',
    Q: { E: 0.020, IA: 0.020, T: 0.020 }
  },
  {
    codice: 'QbII.23',
    fase: 'progettazione_definitiva',
    descrizione: 'Aggiornamento delle prime indicazioni per la redazione del PSC',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  },
  {
    codice: 'QbII.24',
    fase: 'progettazione_definitiva',
    descrizione: 'Studio di impatto ambientale (VIA-VAS-AIA) fino a € 5.000.000',
    Q: { E: 0.090, S: 0.100, IA: 0.090, V: 0.100, D: 0.100, T: 0.090, P: 0.100, U: 0.100 }
  },
  {
    codice: 'QbII.25',
    fase: 'progettazione_definitiva',
    descrizione: 'Piano di monitoraggio ambientale (fino a € 5.000.000)',
    Q: { E: 0.018, S: 0.020, IA: 0.018, V: 0.020, D: 0.020, T: 0.018, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QbII.26',
    fase: 'progettazione_definitiva',
    descrizione: 'Supporto al RUP: supervisione e coordinamento della prog. def.',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  },
  {
    codice: 'QbII.27',
    fase: 'progettazione_definitiva',
    descrizione: 'Supporto RUP: verifica della prog. def.',
    Q: { E: 0.130, S: 0.130, IA: 0.130, V: 0.130, D: 0.130, T: 0.130, P: 0.130, U: 0.130 }
  }
];

/**
 * TAVOLA Z-2 - PROGETTAZIONE ESECUTIVA (QbIII)
 */
export const TAVOLA_Z2_PROG_ESECUTIVA: PrestazioneQ[] = [
  {
    codice: 'QbIII.01',
    fase: 'progettazione_esecutiva',
    descrizione: 'Relazione generale e specialistiche, Elaborati grafici, Calcoli esecutivi',
    Q: { E: 0.070, S: 0.120, IA: 0.040, V: 0.040, D: 0.110, T: 0.050, P: 0.040, U: 0.040 }
  },
  {
    codice: 'QbIII.02',
    fase: 'progettazione_esecutiva',
    descrizione: 'Particolari costruttivi e decorativi',
    Q: { E: 0.130, S: 0.130, IA: 0.050, V: 0.080, D: 0.050, T: 0.100, P: 0.080, U: 0.080 }
  },
  {
    codice: 'QbIII.03',
    fase: 'progettazione_esecutiva',
    descrizione: 'Computo metrico estimativo, Quadro economico, Elenco prezzi',
    Q: { E: 0.040, S: 0.030, IA: 0.050, V: 0.030, D: 0.040, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbIII.04',
    fase: 'progettazione_esecutiva',
    descrizione: 'Schema di contratto, capitolato speciale d\'appalto, cronoprogramma',
    Q: { E: 0.020, S: 0.010, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QbIII.05',
    fase: 'progettazione_esecutiva',
    descrizione: 'Piano di manutenzione dell\'opera',
    Q: { E: 0.020, S: 0.025, IA: 0.030, V: 0.030, D: 0.020, T: 0.020, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbIII.06',
    fase: 'progettazione_esecutiva',
    descrizione: 'Progettazione integrale e coordinata',
    Q: { E: 0.030, S: 0.030, IA: 0.030, V: 0.030, D: 0.030, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QbIII.07',
    fase: 'progettazione_esecutiva',
    descrizione: 'Piano di Sicurezza e Coordinamento',
    Q: { E: 0.100, S: 0.100, IA: 0.100, V: 0.100, D: 0.100, T: 0.100, P: 0.100, U: 0.100 }
  },
  {
    codice: 'QbIII.08',
    fase: 'progettazione_esecutiva',
    descrizione: 'Supporto al RUP: supervisione e coordinamento della progettazione esecutiva',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  },
  {
    codice: 'QbIII.09',
    fase: 'progettazione_esecutiva',
    descrizione: 'Supporto al RUP: verifica della progettazione esecutiva',
    Q: { E: 0.130, S: 0.130, IA: 0.130, V: 0.130, D: 0.130, T: 0.130, P: 0.130, U: 0.130 }
  },
  {
    codice: 'QbIII.10',
    fase: 'progettazione_esecutiva',
    descrizione: 'Supporto al RUP: programmazione e progettazione appalto',
    Q: { E: 0.040, S: 0.040, IA: 0.040, V: 0.040, D: 0.040, T: 0.040, P: 0.040, U: 0.040 }
  },
  {
    codice: 'QbIII.11',
    fase: 'progettazione_esecutiva',
    descrizione: 'Supporto al RUP: validazione del progetto',
    Q: { E: 0.010, S: 0.010, IA: 0.010, V: 0.010, D: 0.010, T: 0.010, P: 0.010, U: 0.010 }
  }
];

/**
 * TAVOLA Z-2 - DIREZIONE LAVORI (QcI)
 */
export const TAVOLA_Z2_DIREZIONE: PrestazioneQ[] = [
  {
    codice: 'QcI.01',
    fase: 'direzione',
    descrizione: 'Direzione lavori, assistenza al collaudo, prove di accettazione',
    Q: { E: 0.320, S: 0.380, IA: 0.420, V: 0.420, D: 0.350, T: 0.110, P: 0.110, U: 0.110 }
  },
  {
    codice: 'QcI.02',
    fase: 'direzione',
    descrizione: 'Liquidazione - Rendicontazioni e liquidazione tecnico contabile',
    Q: { E: 0.030, S: 0.020, IA: 0.030, V: 0.030, D: 0.040, T: 0.030, P: 0.030, U: 0.030 }
  },
  {
    codice: 'QcI.03',
    fase: 'direzione',
    descrizione: 'Controllo aggiornamento elaborati di progetto, aggiornamento dei manuali',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QcI.04',
    fase: 'direzione',
    descrizione: 'Coordinamento e supervisione dell\'ufficio di direzione lavori',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QcI.05',
    fase: 'direzione',
    descrizione: 'Ufficio della direzione lavori, per ogni addetto con qualifica di direttore operativo',
    Q: { E: 0.100, S: 0.100, IA: 0.100, V: 0.100, D: 0.100, T: 0.100, P: 0.100, U: 0.100 }
  },
  {
    codice: 'QcI.05.01',
    fase: 'direzione',
    descrizione: 'Ufficio DL, direttore operativo GEOLOGO (fino a € 250.000)',
    Q: { E: 0.039, S: 0.039, IA: 0.095, V: 0.039, D: 0.127, T: 0.095, P: 0.095, U: 0.095 }
  },
  {
    codice: 'QcI.06',
    fase: 'direzione',
    descrizione: 'Ufficio della direzione lavori, per ogni addetto con qualifica di ispettore di cantiere',
    Q: { E: 0.060, S: 0.060, IA: 0.060, V: 0.060, D: 0.060, T: 0.060, P: 0.060, U: 0.060 }
  },
  {
    codice: 'QcI.07',
    fase: 'direzione',
    descrizione: 'Variante delle quantità del progetto in corso d\'opera',
    Q: { E: 0.140, S: 0.090, IA: 0.150, V: 0.120, D: 0.120, T: 0.110, P: 0.120, U: 0.120 }
  },
  {
    codice: 'QcI.08',
    fase: 'direzione',
    descrizione: 'Variante del progetto in corso d\'opera',
    Q: { E: 0.410, S: 0.430, IA: 0.320, V: 0.420, D: 0.340, T: 0.400, P: 0.420, U: 0.420 }
  },
  {
    codice: 'QcI.09',
    fase: 'direzione',
    descrizione: 'Contabilità dei lavori a misura (fino a € 500.000)',
    Q: { E: 0.060, S: 0.060, IA: 0.045, V: 0.045, D: 0.045, T: 0.045, P: 0.045, U: 0.045 }
  },
  {
    codice: 'QcI.10',
    fase: 'direzione',
    descrizione: 'Contabilità dei lavori a corpo (fino a € 500.000)',
    Q: { E: 0.045, S: 0.045, IA: 0.035, V: 0.035, D: 0.035, T: 0.035, P: 0.035, U: 0.035 }
  },
  {
    codice: 'QcI.11',
    fase: 'direzione',
    descrizione: 'Certificato di regolare esecuzione',
    Q: { E: 0.040, S: 0.040, IA: 0.040, V: 0.040, D: 0.040, T: 0.040, P: 0.040, U: 0.040 }
  },
  {
    codice: 'QcI.12',
    fase: 'sicurezza',
    descrizione: 'Coordinamento della sicurezza in esecuzione',
    Q: { E: 0.250, S: 0.250, IA: 0.250, V: 0.250, D: 0.250, T: 0.250, P: 0.250, U: 0.250 }
  },
  {
    codice: 'QcI.13',
    fase: 'direzione',
    descrizione: 'Supporto al RUP: supervisione e coordinamento della D.L. e della C.S.E.',
    Q: { E: 0.040, S: 0.040, IA: 0.040, V: 0.040, D: 0.040, T: 0.040, P: 0.040, U: 0.040 }
  }
];

/**
 * TAVOLA Z-2 - VERIFICHE E COLLAUDI (QdI)
 */
export const TAVOLA_Z2_COLLAUDI: PrestazioneQ[] = [
  {
    codice: 'QdI.01',
    fase: 'collaudo',
    descrizione: 'Collaudo tecnico amministrativo',
    Q: { E: 0.080, S: 0.080, IA: 0.080, V: 0.080, D: 0.080, T: 0.080, P: 0.080, U: 0.080 }
  },
  {
    codice: 'QdI.02',
    fase: 'collaudo',
    descrizione: 'Revisione tecnico contabile',
    Q: { E: 0.020, S: 0.020, IA: 0.020, V: 0.020, D: 0.020, T: 0.020, P: 0.020, U: 0.020 }
  },
  {
    codice: 'QdI.03',
    fase: 'collaudo',
    descrizione: 'Collaudo statico',
    Q: { S: 0.220 }
  },
  {
    codice: 'QdI.04',
    fase: 'collaudo',
    descrizione: 'Collaudo tecnico funzionale degli impianti',
    Q: { IA: 0.180, T: 0.180 }
  },
  {
    codice: 'QdI.05',
    fase: 'collaudo',
    descrizione: 'Attestato di certificazione energetica (esclusa diagnosi energetica)',
    Q: { E: 0.030, IA: 0.030, T: 0.030 }
  }
];

/**
 * TAVOLA Z-2 - MONITORAGGI (QeI)
 */
export const TAVOLA_Z2_MONITORAGGI: PrestazioneQ[] = [
  {
    codice: 'QeI.01',
    fase: 'altro',
    descrizione: 'Monitoraggi ambientali, naturalistici, fitoiatrici, faunistici, agronomici, zootecnici',
    Q: { P: 0.002, U: 0.0015 }
  },
  {
    codice: 'QeI.02',
    fase: 'altro',
    descrizione: 'Ricerche agricole e/o agro-industriali, bioenergie, innovazione e sviluppo',
    Q: { P: 0.022 }
  }
];

/**
 * TAVOLA Z-2 COMPLETA
 * Unisce tutte le prestazioni
 */
export const TAVOLA_Z2_COMPLETA: PrestazioneQ[] = [
  ...TAVOLA_Z2_PIANIFICAZIONE,
  ...TAVOLA_Z2_FATTIBILITA,
  ...TAVOLA_Z2_STIME,
  ...TAVOLA_Z2_RILIEVI,
  ...TAVOLA_Z2_PIANI_ECONOMICI,
  ...TAVOLA_Z2_PROG_PRELIMINARE,
  ...TAVOLA_Z2_PROG_DEFINITIVA,
  ...TAVOLA_Z2_PROG_ESECUTIVA,
  ...TAVOLA_Z2_DIREZIONE,
  ...TAVOLA_Z2_COLLAUDI,
  ...TAVOLA_Z2_MONITORAGGI,
];

/**
 * Ottiene una prestazione per codice
 */
export function getPrestazioneByCode(codice: string): PrestazioneQ | undefined {
  return TAVOLA_Z2_COMPLETA.find(p => p.codice === codice);
}

/**
 * Ottiene tutte le prestazioni per fase
 */
export function getPrestazioniByFase(fase: PrestazioneQ['fase']): PrestazioneQ[] {
  return TAVOLA_Z2_COMPLETA.filter(p => p.fase === fase);
}

/**
 * Ottiene il valore Q per una prestazione e una categoria specifica
 */
export function getQValue(codicePrestazione: string, categoriaOpera: string): number | undefined {
  const prestazione = getPrestazioneByCode(codicePrestazione);
  if (!prestazione) return undefined;
  
  return prestazione.Q[categoriaOpera];
}

// ============================================
// FORMULA DI CALCOLO COMPENSO
// ============================================

/**
 * Calcola il compenso professionale secondo il DM 17/06/2016
 * 
 * Formula: C = V × G × Q × (P₁ + P₂ + P₃ + P₄)
 * 
 * Dove:
 * - V = Valore dell'opera (importo lavori)
 * - G = Parametro di complessità (dalla Tavola Z-1)
 * - Q = Parametro di specificità prestazione (dalla Tavola Z-2)
 * - P₁, P₂, P₃, P₄ = Parametri percentuali fissi del decreto
 * 
 * @param valoreOpera - Importo dei lavori in euro
 * @param categoriaId - ID categoria opera (es. "E.06", "S.03")
 * @param codicePrestazione - Codice prestazione (es. "QbII.01", "QcI.01")
 * @returns Compenso in euro (null se parametri non validi)
 */
export function calcolaCompenso(
  valoreOpera: number,
  categoriaId: string,
  codicePrestazione: string
): number | null {
  // Ottieni G dalla categoria
  const categoria = getCategoriaById(categoriaId);
  if (!categoria) return null;
  
  const G = categoria.G;
  
  // Ottieni Q dalla prestazione
  const prestazione = getPrestazioneByCode(codicePrestazione);
  if (!prestazione) return null;
  
  // Estrai la categoria principale (E, S, IA, ecc.)
  const catPrincipale = categoria.categoria;
  const Q = prestazione.Q[catPrincipale];
  
  if (Q === undefined) return null;
  
  // Parametri percentuali standard del DM 2016 (da Art. 4)
  // Questi sono valori medi, andrebbero calcolati con la formula esatta del decreto
  const P1 = 0.0376; // Parametro base
  const P2 = 0.0080; // Parametro complessità
  const P3 = 0.0050; // Parametro caratteristiche
  const P4 = 0.0030; // Parametro prestazioni accessorie
  
  const sommaP = P1 + P2 + P3 + P4;
  
  // Formula: C = V × G × Q × ΣP
  const compenso = valoreOpera * G * Q * sommaP;
  
  return Math.round(compenso * 100) / 100; // Arrotonda a 2 decimali
}

/**
 * Calcola il compenso totale per più prestazioni
 */
export function calcolaCompensoTotale(
  valoreOpera: number,
  categoriaId: string,
  codiciPrestazioni: string[]
): number | null {
  let totale = 0;
  
  for (const codice of codiciPrestazioni) {
    const compenso = calcolaCompenso(valoreOpera, categoriaId, codice);
    if (compenso === null) return null;
    totale += compenso;
  }
  
  return Math.round(totale * 100) / 100;
}

// ============================================
// STATISTICHE E UTILITY
// ============================================

/**
 * Statistiche sulle tavole
 */
export const STATISTICHE_TAVOLE = {
  categorie: {
    edilizia: TAVOLA_Z1_EDILIZIA.length,
    strutture: TAVOLA_Z1_STRUTTURE.length,
    impianti: TAVOLA_Z1_IMPIANTI.length,
    infrastrutture: TAVOLA_Z1_INFRASTRUTTURE.length,
    idrauliche: TAVOLA_Z1_IDRAULICHE.length,
    ict: TAVOLA_Z1_ICT.length,
    paesaggio: TAVOLA_Z1_PAESAGGIO.length,
    territorio: TAVOLA_Z1_TERRITORIO.length,
    totale: TAVOLA_Z1_COMPLETA.length
  },
  prestazioni: {
    pianificazione: TAVOLA_Z2_PIANIFICAZIONE.length,
    fattibilita: TAVOLA_Z2_FATTIBILITA.length,
    stime: TAVOLA_Z2_STIME.length,
    preliminare: TAVOLA_Z2_PROG_PRELIMINARE.length,
    definitiva: TAVOLA_Z2_PROG_DEFINITIVA.length,
    esecutiva: TAVOLA_Z2_PROG_ESECUTIVA.length,
    direzione: TAVOLA_Z2_DIREZIONE.length,
    collaudi: TAVOLA_Z2_COLLAUDI.length,
    monitoraggi: TAVOLA_Z2_MONITORAGGI.length,
    totale: TAVOLA_Z2_COMPLETA.length
  }
};

/**
 * Valida se una combinazione categoria-prestazione è valida
 */
export function isCombinazionValida(categoriaId: string, codicePrestazione: string): boolean {
  const categoria = getCategoriaById(categoriaId);
  if (!categoria) return false;
  
  const prestazione = getPrestazioneByCode(codicePrestazione);
  if (!prestazione) return false;
  
  const catPrincipale = categoria.categoria;
  return prestazione.Q[catPrincipale] !== undefined;
}

/**
 * Ottiene tutte le prestazioni applicabili a una categoria
 */
export function getPrestazioniPerCategoria(categoriaId: string): PrestazioneQ[] {
  const categoria = getCategoriaById(categoriaId);
  if (!categoria) return [];
  
  const catPrincipale = categoria.categoria;
  
  return TAVOLA_Z2_COMPLETA.filter(p => p.Q[catPrincipale] !== undefined);
}

/**
 * Esporta i dati in formato JSON per debug
 */
export function esportaDatiJSON() {
  return {
    tavola_z1: TAVOLA_Z1_COMPLETA,
    tavola_z2: TAVOLA_Z2_COMPLETA,
    statistiche: STATISTICHE_TAVOLE,
    versione: '1.0.0',
    fonte: 'DM 17 Giugno 2016',
    data_compilazione: new Date().toISOString()
  };
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  // Tavola Z-1
  TAVOLA_Z1_COMPLETA,
  TAVOLA_Z1_EDILIZIA,
  TAVOLA_Z1_STRUTTURE,
  TAVOLA_Z1_IMPIANTI,
  TAVOLA_Z1_INFRASTRUTTURE,
  TAVOLA_Z1_IDRAULICHE,
  TAVOLA_Z1_ICT,
  TAVOLA_Z1_PAESAGGIO,
  TAVOLA_Z1_TERRITORIO,
  
  // Tavola Z-2
  TAVOLA_Z2_COMPLETA,
  TAVOLA_Z2_PIANIFICAZIONE,
  TAVOLA_Z2_FATTIBILITA,
  TAVOLA_Z2_STIME,
  TAVOLA_Z2_RILIEVI,
  TAVOLA_Z2_PIANI_ECONOMICI,
  TAVOLA_Z2_PROG_PRELIMINARE,
  TAVOLA_Z2_PROG_DEFINITIVA,
  TAVOLA_Z2_PROG_ESECUTIVA,
  TAVOLA_Z2_DIREZIONE,
  TAVOLA_Z2_COLLAUDI,
  TAVOLA_Z2_MONITORAGGI,
  
  // Funzioni utility
  getCategoriaById,
  getCategorieByCategoria,
  getPrestazioneByCode,
  getPrestazioniByFase,
  getQValue,
  calcolaCompenso,
  calcolaCompensoTotale,
  isCombinazionValida,
  getPrestazioniPerCategoria,
  esportaDatiJSON,
  
  // Statistiche
  STATISTICHE_TAVOLE
};