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
  "1_CONSEGNA": {},
  "2_PERMIT": {},
  "3_PROGETTO": {
    "ARC": {},
    "CME": {},
    "CRONO_CAPITOLATI_MANUT": {},
    "IE": {},
    "IM": {},
    "IS": {},
    "REL": {},
    "SIC": {},
    "STR": {},
    "X_RIF": {},
  },
  "4_MATERIALE_RICEVUTO": {},
  "5_CANTIERE": {
    "0_PSC_FE": {},
    "IMPRESA": {
      "CONTRATTO": {},
      "CONTROLLI": {},
      "DOCUMENTI": {},
    },
  },
  "6_VERBALI_NOTIFICHE_COMUNICAZIONI": {
    "COMUNICAZIONI": {},
    "NP": {},
    "ODS": {},
    "VERBALI": {},
  },
  "7_SOPRALLUOGHI": {},
  "8_VARIANTI": {},
  "9_PARCELLA": {},
  "10_INCARICO": {},
};

// Template BREVE aggiornato da file ZIP di riferimento
const TEMPLATE_BREVE: FolderStructure = {
  "CONSEGNA": {},
  "ELABORAZIONI": {},
  "MATERIALE_RICEVUTO": {},
  "SOPRALLUOGHI": {},
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
  
  console.log('createFolderStructure called with:', { structure, basePath });
  
  if (!structure || typeof structure !== 'object') {
    console.error('Invalid structure provided:', structure);
    throw new Error('Invalid folder structure provided');
  }
  
  try {
    for (const [folderName, subStructure] of Object.entries(structure)) {
      const sanitizedName = sanitizeFileName(folderName);
      const fullPath = basePath ? `${basePath}/${sanitizedName}` : sanitizedName;
      
      console.log(`Creating folder: ${fullPath} (original: ${folderName})`);
      
      try {
        const folderHandle = await rootHandle.getDirectoryHandle(sanitizedName, { 
          create: true 
        });
        createdFolders.push(fullPath);
        console.log(`✓ Created folder: ${fullPath}`);
        
        // Recursively create subfolders
        if (subStructure && typeof subStructure === 'object' && Object.keys(subStructure).length > 0) {
          console.log(`Creating subfolders for: ${fullPath}`);
          await createFolderStructure(folderHandle, subStructure, fullPath);
        }
      } catch (error: any) {
        console.error(`❌ Error creating folder ${fullPath}:`, {
          error,
          message: error.message,
          name: error.name,
          code: error.code
        });
        throw new Error(`Impossibile creare la cartella: ${fullPath} - ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error during folder structure creation:", error);
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
