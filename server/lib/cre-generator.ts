/**
 * CRE Generator - Certificazione di Buona Esecuzione
 *
 * Genera documenti Word per le Certificazioni di Buona Esecuzione
 * secondo il template standard per servizi di ingegneria e architettura.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  AlignmentType,
  WidthType,
  HeadingLevel,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import { Project, Client, ClassificazioneDM2016 } from "../../shared/schema";

// Import tavola Z-1 per gradi di complessità
// Nota: usiamo una mappa statica per il server-side
const GRADI_COMPLESSITA: Record<string, number> = {
  // Edilizia (E)
  "E.01": 0.65, "E.02": 0.95, "E.03": 0.95, "E.04": 1.20, "E.05": 0.65,
  "E.06": 0.95, "E.07": 1.20, "E.08": 0.95, "E.09": 1.15, "E.10": 1.20,
  "E.11": 0.95, "E.12": 1.15, "E.13": 1.20, "E.14": 0.65, "E.15": 0.95,
  "E.16": 1.20, "E.17": 0.65, "E.18": 0.95, "E.19": 1.20, "E.20": 0.95,
  "E.21": 1.20, "E.22": 1.55,
  // Strutture (S)
  "S.01": 0.70, "S.02": 0.50, "S.03": 0.95, "S.04": 0.90, "S.05": 1.05, "S.06": 1.15,
  // Impianti (IA/IB)
  "IA.01": 0.75, "IA.02": 0.85, "IA.03": 1.15, "IA.04": 1.30,
  "IB.04": 0.55, "IB.05": 0.70, "IB.06": 0.70, "IB.07": 0.75, "IB.08": 0.50,
  "IB.09": 0.60, "IB.10": 0.75, "IB.11": 0.90, "IB.12": 1.00,
  // Infrastrutture (V)
  "V.01": 0.40, "V.02": 0.45, "V.03": 0.75,
  // Idrauliche (D)
  "D.01": 0.65, "D.02": 0.45, "D.03": 0.55, "D.04": 0.65, "D.05": 0.80,
  // ICT (T)
  "T.01": 0.95, "T.02": 0.70, "T.03": 1.20,
  // Paesaggio (P)
  "P.01": 0.85, "P.02": 0.85, "P.03": 0.85, "P.04": 0.85, "P.05": 0.85, "P.06": 0.85,
  // Territorio (U)
  "U.01": 0.90, "U.02": 0.95, "U.03": 1.00,
};

// Mappa prestazioni per label italiana
const PRESTAZIONI_LABELS: Record<string, string> = {
  progettazione: "Progettazione",
  dl: "Direzione Lavori",
  csp: "Coordinamento sicurezza in fase di progettazione",
  cse: "Coordinamento sicurezza in fase di esecuzione",
  contabilita: "Contabilità",
  collaudo: "Collaudo",
  perizia: "Perizia",
  pratiche: "Pratiche edilizie",
};

const LIVELLI_PROGETTAZIONE_LABELS: Record<string, string> = {
  pfte: "Progetto di Fattibilità Tecnico Economica",
  definitivo: "Progetto Definitivo",
  esecutivo: "Progetto Esecutivo",
  variante: "Variante",
};

export interface CREData {
  project: Project;
  client: Client;
  metadata: {
    prestazioni?: string[];
    livelloProgettazione?: string[];
    classificazioniDM2016?: ClassificazioneDM2016[];
    importoServizio?: number;
  };
}

/**
 * Formatta un numero come valuta italiana
 */
function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "€ 0,00";
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatta una data in formato italiano
 */
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "[GG/MM/AAAA]";
  const d = new Date(date);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Normalizza codice categoria (aggiunge punto se mancante)
 */
function normalizeCode(code: string): string {
  if (code.includes('.')) return code;
  // Aggiungi il punto dopo le lettere
  const match = code.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return `${match[1]}.${match[2].padStart(2, '0')}`;
  }
  return code;
}

/**
 * Ottiene il grado di complessità G per una categoria
 */
function getGradoComplessita(codice: string): string {
  const normalizedCode = normalizeCode(codice);
  const g = GRADI_COMPLESSITA[normalizedCode];
  return g ? g.toFixed(2) : "N/D";
}

/**
 * Calcola il totale importo opere dalle classificazioni
 */
function calcolaTotaleOpere(classificazioni: ClassificazioneDM2016[] | undefined): number {
  if (!classificazioni || classificazioni.length === 0) return 0;
  // I valori nel metadata JSON sono già in euro (convertiti dal server durante il sync)
  return classificazioni.reduce((sum, c) => sum + (c.importoOpere || c.importo || 0), 0);
}

/**
 * Calcola il totale importo servizio dalle classificazioni
 */
function calcolaTotaleServizio(classificazioni: ClassificazioneDM2016[] | undefined): number {
  if (!classificazioni || classificazioni.length === 0) return 0;
  // I valori nel metadata JSON sono già in euro
  return classificazioni.reduce((sum, c) => sum + (c.importoServizio || 0), 0);
}

/**
 * Genera la tipologia del servizio come lista puntata
 */
function getTipologiaServizio(metadata: CREData['metadata']): string[] {
  const items: string[] = [];

  if (metadata.prestazioni?.includes('progettazione')) {
    const livelli = metadata.livelloProgettazione || [];
    const livelliStr = livelli.map(l => LIVELLI_PROGETTAZIONE_LABELS[l] || l).join(', ');
    items.push(`Progettazione ${livelliStr ? `(${livelliStr})` : 'definitiva ed esecutiva'}`);
  }

  if (metadata.prestazioni?.includes('dl')) {
    items.push('Direzione Lavori');
  }

  if (metadata.prestazioni?.includes('csp')) {
    items.push('Coordinamento sicurezza in fase di progettazione');
  }

  if (metadata.prestazioni?.includes('cse')) {
    items.push('Coordinamento sicurezza in fase di esecuzione');
  }

  if (metadata.prestazioni?.includes('contabilita')) {
    items.push('Contabilità dei lavori');
  }

  if (metadata.prestazioni?.includes('collaudo')) {
    items.push('Collaudo');
  }

  if (metadata.prestazioni?.includes('perizia')) {
    items.push('Perizia');
  }

  if (metadata.prestazioni?.includes('pratiche')) {
    items.push('Pratiche edilizie');
  }

  return items;
}

/**
 * Calcola l'importo CSE separato (se presente)
 */
function getImportoCSE(classificazioni: ClassificazioneDM2016[] | undefined, metadata: CREData['metadata']): number {
  // Se CSE è tra le prestazioni, usa una stima del 10% dell'importo servizio totale
  // oppure usa un valore specifico se disponibile
  if (metadata.prestazioni?.includes('cse') || metadata.prestazioni?.includes('csp')) {
    const totaleServizio = calcolaTotaleServizio(classificazioni);
    // Stima approssimativa: 10-15% per coordinamento sicurezza
    return Math.round(totaleServizio * 0.15);
  }
  return 0;
}

/**
 * Genera il documento CRE in formato Word
 */
export async function generateCREDocument(data: CREData): Promise<Buffer> {
  const { project, client, metadata } = data;

  const totaleOpere = calcolaTotaleOpere(metadata.classificazioniDM2016);
  const totaleServizio = metadata.importoServizio || calcolaTotaleServizio(metadata.classificazioniDM2016);
  const importoCSE = getImportoCSE(metadata.classificazioniDM2016, metadata);
  const tipologiaServizio = getTipologiaServizio(metadata);

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134, // ~2cm
            right: 1134,
            bottom: 1134,
            left: 1134,
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "[LOGO COMMITTENTE]", italics: true, color: "888888", size: 18 }),
                          ],
                        }),
                      ],
                      width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({ text: client.name || "[Denominazione Ente/Società Committente]", bold: true, size: 22 }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `${client.indirizzo || "[Indirizzo]"}, ${client.cap || ""} ${client.city || "[Città]"} (${client.provincia || ""})`,
                              size: 18,
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `C.F.: ${client.codiceFiscale || "[XXXXXXXXXXX]"} - P.IVA: ${client.partitaIva || "[XXXXXXXXXXX]"}`,
                              size: 18,
                            }),
                          ],
                        }),
                      ],
                      width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Pag. ", size: 18 }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 18,
                }),
                new TextRun({ text: " di ", size: 18 }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  size: 18,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Spazio dopo header
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),

        // TITOLO PRINCIPALE
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [
            new TextRun({
              text: "CERTIFICAZIONE DI BUONA ESECUZIONE",
              bold: true,
              size: 32,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: "RELATIVA ALL'ESPLETAMENTO DI SERVIZI DI INGEGNERIA E ARCHITETTURA",
              bold: true,
              italics: true,
              size: 22,
            }),
          ],
        }),

        // Spazio
        new Paragraph({ children: [] }),

        // SOTTOSCRITTO
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: "Il/La sottoscritto/a ", size: 22 }),
            new TextRun({ text: client.nomeReferente || "[Nome e Cognome Committente]", bold: true, size: 22 }),
            new TextRun({ text: ", domiciliato/a per la carica in ", size: 22 }),
            new TextRun({ text: `${client.indirizzo || "[Indirizzo]"}, ${client.cap || ""} ${client.city || "[Città]"}`, bold: true, size: 22 }),
            new TextRun({ text: ", in qualità di ", size: 22 }),
            new TextRun({ text: client.ruoloReferente || "[Qualifica - es. Responsabile Unico del Procedimento / Direttore Tecnico]", bold: true, size: 22 }),
            new TextRun({ text: " della/dell' ", size: 22 }),
            new TextRun({ text: client.name || "[Denominazione Ente/Società Committente]", bold: true, size: 22 }),
            new TextRun({ text: ",", size: 22 }),
          ],
        }),

        // ATTESTA
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [
            new TextRun({
              text: "ATTESTA",
              bold: true,
              size: 28,
            }),
          ],
        }),

        // Testo attestazione
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 300 },
          children: [
            new TextRun({ text: "L'avvenuta esecuzione delle prestazioni professionali eseguite relativamente al/all' ", size: 22 }),
            new TextRun({ text: (project as any).oggettoCompleto || project.object || "[Denominazione Opera/Intervento]", bold: true, size: 22 }),
            new TextRun({ text: " nel contesto del/dell' ", size: 22 }),
            new TextRun({ text: `${project.numeroContratto ? `Contratto/Accordo Quadro n. ${project.numeroContratto}` : "[Contratto/Accordo Quadro n. XXXX]"} - CIG n. ${project.cig || "XXXXXXXXXX"}`, bold: true, size: 22 }),
            new TextRun({ text: " di seguito indicate:", size: 22 }),
          ],
        }),

        // Spazio
        new Paragraph({ children: [] }),

        // TABELLA INFORMAZIONI GENERALI
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          shading: { fill: "E8E8E8" },
          children: [
            new TextRun({
              text: "INFORMAZIONI GENERALI DEL SERVIZIO",
              bold: true,
              size: 22,
            }),
          ],
        }),

        // Tabella informazioni generali
        createInfoTable(project, client, metadata, totaleOpere, totaleServizio, importoCSE, tipologiaServizio),

        // Spazio
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),

        // TABELLA CLASSIFICAZIONI DM
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          shading: { fill: "E8E8E8" },
          children: [
            new TextRun({
              text: "CLASSI E CATEGORIE DI PRESTAZIONE PROFESSIONALE (DM 17/06/2016)",
              bold: true,
              size: 22,
            }),
          ],
        }),

        // Tabella classificazioni
        createClassificazioniTable(metadata.classificazioniDM2016 || []),

        // Spazio
        new Paragraph({ children: [] }),

        // E DICHIARA CHE
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 300 },
          children: [
            new TextRun({
              text: "E DICHIARA CHE:",
              bold: true,
              color: "C00000",
              size: 26,
            }),
          ],
        }),

        // Lista dichiarazioni
        ...createDichiarazioni(project, client),

        // Spazio prima firma
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),

        // Sezione firma
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Luogo e data", size: 22 }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "_______________________", size: 22 }),
                      ],
                    }),
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: "IL COMMITTENTE", bold: true, size: 22 }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: "(Timbro e Firma)", italics: true, size: 20 }),
                      ],
                    }),
                    new Paragraph({ children: [] }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: "_________________________________", size: 22 }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: client.nomeReferente || "[Nome Cognome]", size: 20 }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: client.ruoloReferente || "[Qualifica]", size: 20 }),
                      ],
                    }),
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
          ],
        }),

        // Spazio
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),

        // Informativa GDPR
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: "Informativa ai sensi del Reg. UE 2016/679 (GDPR): i dati riportati sono prescritti dalle disposizioni vigenti ai fini del procedimento per il quale sono richiesti e verranno utilizzati esclusivamente per tale scopo.",
              italics: true,
              size: 18,
              color: "666666",
            }),
          ],
        }),
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Crea la tabella delle informazioni generali del servizio
 */
function createInfoTable(
  project: Project,
  client: Client,
  metadata: CREData['metadata'],
  totaleOpere: number,
  totaleServizio: number,
  importoCSE: number,
  tipologiaServizio: string[]
): Table {
  const rows: TableRow[] = [];

  // Helper per creare righe
  const addRow = (label: string, value: string | Paragraph[], valueIsBold = false) => {
    const valueChildren = Array.isArray(value)
      ? value
      : [new Paragraph({
          children: [new TextRun({ text: value, bold: valueIsBold, size: 20 })],
        })];

    rows.push(new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 20 })],
            }),
          ],
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: "F5F5F5" },
        }),
        new TableCell({
          children: valueChildren,
          width: { size: 70, type: WidthType.PERCENTAGE },
        }),
      ],
    }));
  };

  // Soggetto incaricato
  addRow("SOGGETTO INCARICATO", "G2 Ingegneria S.r.l.");

  // Committente
  addRow("COMMITTENTE", [
    new Paragraph({
      children: [new TextRun({ text: client.name || "[Denominazione Committente]", bold: true, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `- Responsabile del Procedimento: ${client.nomeReferente || "[Nome]"}`, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `- Direttore dell'Esecuzione: ${client.nomeReferente || "[Nome]"}`, size: 20 })],
    }),
  ]);

  // Oggetto dell'opera
  addRow("OGGETTO DELL'OPERA", [
    new Paragraph({
      children: [
        new TextRun({
          text: `${(project as any).oggettoCompleto || project.object || "[Descrizione completa dell'opera/intervento]"} - CIG n. ${project.cig || "XXXXXXXXXX"}`,
          size: 20
        }),
      ],
    }),
  ]);

  // Tipologia del servizio
  const tipologiaParagraphs = [
    new Paragraph({
      children: [new TextRun({ text: "Affidamento incarico di:", size: 20 })],
    }),
    ...tipologiaServizio.map(t => new Paragraph({
      children: [new TextRun({ text: `• ${t}`, size: 20 })],
    })),
  ];
  addRow("TIPOLOGIA DEL SERVIZIO", tipologiaParagraphs);

  // Periodo di esecuzione
  addRow("PERIODO DI ESECUZIONE", [
    new Paragraph({
      children: [
        new TextRun({ text: `Data inizio: ${formatDate(project.dataInizioCommessa)}`, size: 20 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Data fine: ${formatDate(project.dataFineCommessa)}`, size: 20 }),
      ],
    }),
  ]);

  // Importo totale opere
  addRow("IMPORTO TOTALE OPERE", formatCurrency(totaleOpere), true);

  // Importo totale servizio
  const servizioText = importoCSE > 0
    ? `${formatCurrency(totaleServizio)}\ndi cui Coord. Sicurezza: ${formatCurrency(importoCSE)}`
    : formatCurrency(totaleServizio);
  addRow("IMPORTO TOTALE SERVIZIO", [
    new Paragraph({
      children: [new TextRun({ text: formatCurrency(totaleServizio), bold: true, size: 20 })],
    }),
    ...(importoCSE > 0 ? [
      new Paragraph({
        children: [new TextRun({ text: `di cui Coord. Sicurezza: ${formatCurrency(importoCSE)}`, size: 18, italics: true })],
      }),
    ] : []),
  ]);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
    },
    rows,
  });
}

/**
 * Crea la tabella delle classificazioni DM
 */
function createClassificazioniTable(classificazioni: ClassificazioneDM2016[]): Table {
  // Header
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ID. Opere", bold: true, size: 20 })] })],
        shading: { fill: "E0E0E0" },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Grado compl. G", bold: true, size: 20 })] })],
        shading: { fill: "E0E0E0" },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Importo opere €", bold: true, size: 20 })] })],
        shading: { fill: "E0E0E0" },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Importo servizio €", bold: true, size: 20 })] })],
        shading: { fill: "E0E0E0" },
      }),
    ],
  });

  // Data rows
  const dataRows = classificazioni.map(c => {
    const normalizedCode = normalizeCode(c.codice);
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: normalizedCode, size: 20 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: getGradoComplessita(c.codice), size: 20 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(c.importoOpere || c.importo || 0), size: 20 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(c.importoServizio || 0), size: 20 })] })],
        }),
      ],
    });
  });

  // Se non ci sono classificazioni, aggiungi righe placeholder
  if (classificazioni.length === 0) {
    for (let i = 0; i < 3; i++) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "[X.XX]", color: "888888", size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "[X.XX]", color: "888888", size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "[XXX.XXX,XX]", color: "888888", size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "[XX.XXX,XX]", color: "888888", size: 20 })] })] }),
        ],
      }));
    }
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
    },
    rows: [headerRow, ...dataRows],
  });
}

/**
 * Crea i paragrafi delle dichiarazioni
 */
function createDichiarazioni(project: Project, client: Client): Paragraph[] {
  const dichiarazioni = [
    `la società G2 Ingegneria S.r.l. con sede legale in [Indirizzo], C.F./P.IVA [XXXXXXXXXXX], ha regolarmente svolto, su incarico di ${client.name || "[Committente]"}, i suddetti servizi di architettura/ingegneria;`,
    "i servizi indicati sono stati eseguiti in conformità con le prescrizioni contrattuali e le relative norme in materia;",
    "i servizi svolti non hanno dato luogo a contenzioso relativo alle mansioni eseguite dal tecnico incaricato;",
    "le prestazioni richieste sono state eseguite entro i termini contrattuali fissati;",
    "tutti i servizi e relativi prodotti sono stati recepiti e approvati.",
  ];

  return dichiarazioni.map((d, index) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 150 },
      indent: { left: 360 },
      children: [
        new TextRun({ text: `${index + 1})  `, bold: true, size: 22 }),
        new TextRun({ text: d, size: 22 }),
      ],
    })
  );
}

/**
 * Genera un'anteprima dei dati CRE (senza documento)
 */
export function generateCREPreview(data: CREData): object {
  const { project, client, metadata } = data;

  // I valori nel metadata sono già in euro (convertiti dal server durante il sync)
  const classificazioniWithG = (metadata.classificazioniDM2016 || []).map(c => ({
    ...c,
    gradoComplessita: getGradoComplessita(c.codice),
  }));

  return {
    committente: {
      denominazione: client.name,
      indirizzo: `${client.indirizzo || ""}, ${client.cap || ""} ${client.city || ""} (${client.provincia || ""})`,
      codiceFiscale: client.codiceFiscale,
      partitaIva: client.partitaIva,
      responsabileProcedimento: client.nomeReferente,
      qualifica: client.ruoloReferente,
    },
    opera: {
      oggetto: (project as any).oggettoCompleto || project.object,
      cig: project.cig,
      numeroContratto: project.numeroContratto,
      dataInizio: formatDate(project.dataInizioCommessa),
      dataFine: formatDate(project.dataFineCommessa),
    },
    servizio: {
      tipologie: getTipologiaServizio(metadata),
      importoTotaleOpere: calcolaTotaleOpere(metadata.classificazioniDM2016),
      importoTotaleServizio: metadata.importoServizio || calcolaTotaleServizio(metadata.classificazioniDM2016),
    },
    classificazioni: classificazioniWithG,
    isComplete: checkCRECompleteness(data),
  };
}

/**
 * Verifica se tutti i dati necessari per la CRE sono completi
 */
export function checkCRECompleteness(data: CREData): {
  complete: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const { project, client, metadata } = data;

  // Dati committente
  if (!client.name) missing.push("Denominazione committente");
  if (!client.indirizzo) missing.push("Indirizzo committente");
  if (!client.codiceFiscale && !client.partitaIva) missing.push("CF o P.IVA committente");
  if (!client.nomeReferente) missing.push("Nome referente committente");
  if (!client.ruoloReferente) missing.push("Qualifica referente committente");

  // Dati progetto
  if (!project.object) missing.push("Oggetto dell'opera");
  if (!project.cig) missing.push("CIG");
  if (!project.numeroContratto) missing.push("Numero contratto");
  if (!project.dataInizioCommessa) missing.push("Data inizio commessa");
  if (!project.dataFineCommessa) missing.push("Data fine commessa");

  // Dati servizio
  if (!metadata.prestazioni || metadata.prestazioni.length === 0) {
    missing.push("Tipologia prestazioni");
  }
  if (!metadata.classificazioniDM2016 || metadata.classificazioniDM2016.length === 0) {
    missing.push("Classificazioni DM 17/06/2016");
  } else {
    // Verifica che ogni classificazione abbia importoServizio
    const missingServizio = metadata.classificazioniDM2016.some(c => !c.importoServizio && c.importoServizio !== 0);
    if (missingServizio) {
      missing.push("Importo servizio per alcune classificazioni");
    }
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}

export default {
  generateCREDocument,
  generateCREPreview,
  checkCRECompleteness,
};
