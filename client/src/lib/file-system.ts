// File System Access API utilities for G2 Commesse

export interface FolderStructure {
  [folderName: string]: FolderStructure | {};
}

export interface ProjectTemplate {
  name: string;
  structure: FolderStructure;
}

// Template aggiornato da file ZIP di riferimento
const TEMPLATE_LUNGO: FolderStructure = {
  "01_CORRISPONDENZA": {
    "01_ENTRATA": {},
    "02_USCITA": {},
    "03_INTERNA": {},
    "04_VERBALI": {},
  },
  "02_PROGETTAZIONE": {
    "01_ARCHITETTURA": {
      "01_PIANTE": {},
      "02_PROSPETTI": {},
      "03_SEZIONI": {},
      "04_DETTAGLI_COSTRUTTIVI": {},
      "05_RENDER_3D": {},
    },
    "02_STRUTTURE": {
      "01_CALCOLI_STRUTTURALI": {},
      "02_RELAZIONI_TECNICHE": {},
      "03_ELABORATI_GRAFICI": {},
      "04_VERIFICHE": {},
    },
    "03_IMPIANTI": {
      "01_IMPIANTI_MECCANICI": {
        "01_RISCALDAMENTO": {},
        "02_CONDIZIONAMENTO": {},
        "03_VENTILAZIONE": {},
        "04_GAS": {},
      },
      "02_IMPIANTI_ELETTRICI": {
        "01_FORZA_MOTRICE": {},
        "02_ILLUMINAZIONE": {},
        "03_DOMOTICA": {},
        "04_TELECOMUNICAZIONI": {},
      },
      "03_IMPIANTI_SPECIALI": {
        "01_ANTINCENDIO": {},
        "02_VIDEOSORVEGLIANZA": {},
        "03_CONTROLLO_ACCESSI": {},
        "04_ASCENSORI": {},
      },
      "04_IMPIANTI_IDRAULICI": {
        "01_ACQUA_FREDDA": {},
        "02_ACQUA_CALDA": {},
        "03_SCARICHI": {},
        "04_PLUVIALI": {},
      },
    },
    "04_SOSTENIBILITA": {
      "01_APE": {},
      "02_CERTIFICAZIONI": {},
      "03_ANALISI_ENERGETICHE": {},
    },
  },
  "03_PRATICHE_EDILIZIE": {
    "01_SCIA": {},
    "02_PERMESSO_COSTRUIRE": {},
    "03_DIA": {},
    "04_AGIBILITA": {},
    "05_VARIANTI": {},
    "06_FINE_LAVORI": {},
  },
  "04_DIREZIONE_LAVORI": {
    "01_VERBALI_CANTIERE": {},
    "02_STATI_AVANZAMENTO": {},
    "03_CONTABILITA": {},
    "04_VARIANTI_IN_CORSO_OPERA": {},
    "05_COLLAUDI": {},
  },
  "05_COORDINAMENTO_SICUREZZA": {
    "01_PSC": {},
    "02_POS": {},
    "03_NOTIFICA_PRELIMINARE": {},
    "04_FASCICOLO_OPERA": {},
    "05_VERBALI_SICUREZZA": {},
  },
  "06_AMMINISTRATIVO": {
    "01_CONTRATTO": {},
    "02_INCARICO": {},
    "03_PARCELLE": {},
    "04_FATTURE": {},
    "05_PAGAMENTI": {},
    "06_ASSICURAZIONI": {},
  },
  "07_RILIEVI_SOPRALLUOGHI": {
    "01_RILIEVI_METRICI": {},
    "02_FOTO_ANTE_OPERAM": {},
    "03_FOTO_POST_OPERAM": {},
    "04_VERBALI_SOPRALLUOGO": {},
    "05_DRONE": {},
  },
  "08_CONSULENZE_ESTERNE": {
    "01_GEOLOGICHE": {},
    "02_AMBIENTALI": {},
    "03_ARCHEOLOGICHE": {},
    "04_ACUSTICHE": {},
    "05_SPECIALISTICHE": {},
  },
  "09_AUTORIZZAZIONI": {
    "01_ENTI_LOCALI": {},
    "02_VIGILI_FUOCO": {},
    "03_ASL": {},
    "04_SOPRINTENDENZA": {},
    "05_ENTI_GESTORI": {},
  },
  "10_ARCHIVIO_STORICO": {
    "01_VERSIONI_PRECEDENTI": {},
    "02_DOCUMENTI_SCADUTI": {},
    "03_BACKUP": {},
  },
};

const TEMPLATE_BREVE: FolderStructure = {
  "CONSEGNA": {
    "01_RICHIESTA": {},
    "02_DOCUMENTI": {},
  },
  "ELABORAZIONI": {
    "01_CALCOLI": {},
    "02_DISEGNI": {},
    "03_RELAZIONI": {},
  },
  "MATERIALE_RICEVUTO": {
    "01_DOCUMENTI": {},
    "02_PLANIMETRIE": {},
    "03_FOTO": {},
  },
  "SOPRALLUOGHI": {
    "01_VERBALI": {},
    "02_FOTO": {},
    "03_RILIEVI": {},
  },
};

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  LUNGO: {
    name: "LUNGO - Progetti complessi",
    structure: TEMPLATE_LUNGO,
  },
  BREVE: {
    name: "BREVE - Progetti semplici", 
    structure: TEMPLATE_BREVE,
  },
};

// File System Access API support check
export const isFileSystemAccessSupported = (): boolean => {
  return 'showDirectoryPicker' in window;
};

// Create folder structure recursively
export const createFolderStructure = async (
  rootHandle: FileSystemDirectoryHandle,
  structure: FolderStructure,
  basePath: string = ""
): Promise<void> => {
  const createdFolders: string[] = [];
  
  try {
    for (const [folderName, subStructure] of Object.entries(structure)) {
      const sanitizedName = sanitizeFileName(folderName);
      const fullPath = basePath ? `${basePath}/${sanitizedName}` : sanitizedName;
      
      try {
        const folderHandle = await rootHandle.getDirectoryHandle(sanitizedName, { 
          create: true 
        });
        createdFolders.push(fullPath);
        
        // Recursively create subfolders
        if (subStructure && Object.keys(subStructure).length > 0) {
          await createFolderStructure(folderHandle, subStructure, fullPath);
        }
      } catch (error) {
        console.error(`Errore creazione cartella ${fullPath}:`, error);
        throw new Error(`Impossibile creare la cartella: ${fullPath}`);
      }
    }
  } catch (error) {
    console.error("Errore durante la creazione della struttura:", error);
    throw error;
  }
};

// Create complete project structure
export const createProjectStructure = async (
  rootHandle: FileSystemDirectoryHandle,
  projectCode: string,
  projectObject: string,
  template: string
): Promise<{ projectHandle: FileSystemDirectoryHandle; createdFolders: string[] }> => {
  const templateData = PROJECT_TEMPLATES[template];
  if (!templateData) {
    throw new Error(`Template non trovato: ${template}`);
  }

  // Create main project folder
  const projectFolderName = `${projectCode}_${sanitizeFileName(projectObject)}`;
  const projectHandle = await rootHandle.getDirectoryHandle(projectFolderName, { 
    create: true 
  });

  // Create structure inside project folder
  await createFolderStructure(projectHandle, templateData.structure);

  // Get list of created folders for reporting
  const createdFolders = getFolderList(templateData.structure, projectFolderName);

  return { projectHandle, createdFolders };
};

// Generate script commands for fallback
export const generateScriptCommands = (
  structure: FolderStructure,
  basePath: string = ""
): { batch: string[]; shell: string[] } => {
  const batchCommands: string[] = [];
  const shellCommands: string[] = [];

  const generateCommands = (struct: FolderStructure, currentPath: string = "") => {
    for (const [folderName, subStructure] of Object.entries(struct)) {
      const sanitizedName = sanitizeFileName(folderName);
      const fullPath = currentPath ? `${currentPath}/${sanitizedName}` : sanitizedName;
      const winPath = fullPath.replace(/\//g, "\\");
      
      batchCommands.push(`mkdir "${basePath ? `${basePath}\\${winPath}` : winPath}"`);
      shellCommands.push(`mkdir -p "${basePath ? `${basePath}/${fullPath}` : fullPath}"`);
      
      if (subStructure && Object.keys(subStructure).length > 0) {
        generateCommands(subStructure, fullPath);
      }
    }
  };

  generateCommands(structure);
  
  return { batch: batchCommands, shell: shellCommands };
};

// Create and download script files
export const downloadScriptFiles = (
  projectCode: string,
  projectObject: string,
  template: string
): void => {
  const templateData = PROJECT_TEMPLATES[template];
  if (!templateData) {
    throw new Error(`Template non trovato: ${template}`);
  }

  const projectFolderName = `${projectCode}_${sanitizeFileName(projectObject)}`;
  const { batch, shell } = generateScriptCommands(templateData.structure, projectFolderName);

  // Create batch file content
  const batchContent = [
    `@echo off`,
    `echo Creazione struttura cartelle per progetto ${projectCode}`,
    `echo.`,
    ...batch,
    `echo.`,
    `echo Struttura cartelle creata con successo!`,
    `pause`
  ].join('\r\n');

  // Create shell script content
  const shellContent = [
    `#!/bin/bash`,
    `echo "Creazione struttura cartelle per progetto ${projectCode}"`,
    `echo`,
    ...shell,
    `echo`,
    `echo "Struttura cartelle creata con successo!"`
  ].join('\n');

  // Download batch file
  downloadFile(`${projectCode}_create_structure.bat`, batchContent);
  
  // Download shell script
  downloadFile(`${projectCode}_create_structure.sh`, shellContent);
};

// Utility functions
export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 255);
};

const getFolderList = (structure: FolderStructure, basePath: string = ""): string[] => {
  const folders: string[] = [];
  
  const addFolders = (struct: FolderStructure, currentPath: string = "") => {
    for (const [folderName, subStructure] of Object.entries(struct)) {
      const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      folders.push(fullPath);
      
      if (subStructure && Object.keys(subStructure).length > 0) {
        addFolders(subStructure, fullPath);
      }
    }
  };

  addFolders(structure, basePath);
  return folders;
};

const downloadFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Check if we can write to a directory
export const checkDirectoryWritePermission = async (
  dirHandle: FileSystemDirectoryHandle
): Promise<boolean> => {
  try {
    // Try to create a temporary file to test write permission
    const testFileName = `.g2_write_test_${Date.now()}`;
    const testFileHandle = await dirHandle.getFileHandle(testFileName, { 
      create: true 
    });
    
    // Clean up test file
    await dirHandle.removeEntry(testFileName);
    return true;
  } catch (error) {
    console.error('Write permission check failed:', error);
    return false;
  }
};

// Get directory info
export const getDirectoryInfo = async (
  dirHandle: FileSystemDirectoryHandle
): Promise<{
  name: string;
  path?: string;
  canWrite: boolean;
}> => {
  const canWrite = await checkDirectoryWritePermission(dirHandle);
  
  return {
    name: dirHandle.name,
    canWrite,
  };
};
