// Gestione cartella radice e auto-rilevamento commesse

import { type Project } from "@shared/schema";

export interface RootFolderConfig {
  rootPath: string;
  rootHandle: FileSystemDirectoryHandle | null;
  isConfigured: boolean;
  lastVerified: string;
}

export interface ProjectFolderInfo {
  name: string;
  handle: FileSystemDirectoryHandle;
  projectCode?: string;
  matchedProject?: Project;
}

/**
 * Classe per gestire la cartella radice e l'auto-rilevamento delle commesse
 */
export class FolderManager {
  private static instance: FolderManager;
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private config: RootFolderConfig | null = null;

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): FolderManager {
    if (!FolderManager.instance) {
      FolderManager.instance = new FolderManager();
    }
    return FolderManager.instance;
  }

  /**
   * Carica la configurazione dal localStorage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('folder_config');
      if (stored) {
        this.config = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading folder config:', error);
    }
  }

  /**
   * Salva la configurazione nel localStorage
   */
  private saveConfig(): void {
    if (this.config) {
      try {
        // Non possiamo salvare FileSystemDirectoryHandle nel localStorage
        const configToSave = {
          ...this.config,
          rootHandle: null,
        };
        localStorage.setItem('folder_config', JSON.stringify(configToSave));
      } catch (error) {
        console.error('Error saving folder config:', error);
      }
    }
  }

  /**
   * Imposta la cartella radice
   */
  setRootFolder(handle: FileSystemDirectoryHandle): void {
    this.rootHandle = handle;
    this.config = {
      rootPath: handle.name,
      rootHandle: null, // Non serializzabile
      isConfigured: true,
      lastVerified: new Date().toLocaleString("it-IT"),
    };
    this.saveConfig();
  }

  /**
   * Ottiene la configurazione corrente
   */
  getConfig(): RootFolderConfig | null {
    return this.config;
  }

  /**
   * Verifica se la cartella radice è configurata
   */
  isConfigured(): boolean {
    return this.config?.isConfigured || false;
  }

  /**
   * Imposta l'handle della cartella radice (per sessione corrente)
   */
  setRootHandle(handle: FileSystemDirectoryHandle): void {
    this.rootHandle = handle;
  }

  /**
   * Ottiene l'handle della cartella radice
   */
  getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle;
  }

  /**
   * Scansiona la cartella radice per trovare le cartelle delle commesse
   */
  async scanProjectFolders(): Promise<ProjectFolderInfo[]> {
    if (!this.rootHandle) {
      throw new Error('Cartella radice non configurata');
    }

    const projectFolders: ProjectFolderInfo[] = [];
    
    try {
      for await (const entry of (this.rootHandle as any).values()) {
        if (entry.kind === 'directory') {
          const folderInfo: ProjectFolderInfo = {
            name: entry.name,
            handle: entry,
          };

          // Prova a estrarre il codice progetto dal nome cartella
          const projectCode = this.extractProjectCode(entry.name);
          if (projectCode) {
            folderInfo.projectCode = projectCode;
          }

          projectFolders.push(folderInfo);
        }
      }
    } catch (error) {
      console.error('Error scanning project folders:', error);
      throw new Error('Errore nella scansione delle cartelle commesse');
    }

    return projectFolders;
  }

  /**
   * Estrae il codice progetto dal nome cartella
   * Formato atteso: CODICE_DESCRIZIONE o simili
   */
  private extractProjectCode(folderName: string): string | null {
    // Pattern per codici progetto (esempio: 25ABC123_01, 25DEFGHIL02, ecc.)
    const patterns = [
      /^(\d{2}[A-Z]{3,}[A-Z0-9]{2,})_/, // Pattern principale: anno + cliente + città + numero
      /^([A-Z0-9]{8,})_/, // Pattern generale per codici lunghi
      /^(\d{2}[A-Z]{6,})/, // Pattern senza underscore
    ];

    for (const pattern of patterns) {
      const match = folderName.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Associa le cartelle trovate con i progetti nel database
   */
  async matchProjectsWithFolders(
    projectFolders: ProjectFolderInfo[],
    projects: Project[]
  ): Promise<ProjectFolderInfo[]> {
    const matchedFolders = projectFolders.map(folder => {
      if (folder.projectCode) {
        const matchedProject = projects.find(p => p.code === folder.projectCode);
        if (matchedProject) {
          return {
            ...folder,
            matchedProject,
          };
        }
      }
      return folder;
    });

    return matchedFolders;
  }

  /**
   * Trova la cartella di una specifica commessa
   */
  async findProjectFolder(projectCode: string): Promise<FileSystemDirectoryHandle | null> {
    if (!this.rootHandle) {
      return null;
    }

    try {
      const projectFolders = await this.scanProjectFolders();
      const targetFolder = projectFolders.find(folder => 
        folder.projectCode === projectCode || 
        folder.name.startsWith(projectCode)
      );

      return targetFolder?.handle || null;
    } catch (error) {
      console.error('Error finding project folder:', error);
      return null;
    }
  }

  /**
   * Crea una nuova cartella progetto nella cartella radice
   */
  async createProjectFolder(projectCode: string, projectName: string): Promise<FileSystemDirectoryHandle | null> {
    if (!this.rootHandle) {
      throw new Error('Cartella radice non configurata');
    }

    try {
      // Sanitizza il nome progetto preservando la maggior parte dei caratteri
      const sanitizedName = projectName
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50); // Limita lunghezza ma non troppo
      const folderName = `${projectCode}_${sanitizedName}`;

      const projectHandle = await this.rootHandle.getDirectoryHandle(folderName, { 
        create: true 
      });

      console.log(`✅ Cartella progetto creata: ${folderName}`);
      return projectHandle;
    } catch (error) {
      console.error('Error creating project folder:', error);
      throw new Error('Errore nella creazione della cartella progetto');
    }
  }

  /**
   * Reset della configurazione
   */
  resetConfig(): void {
    this.rootHandle = null;
    this.config = null;
    localStorage.removeItem('folder_config');
  }

  /**
   * Valida l'accesso alla cartella radice
   */
  async validateRootAccess(): Promise<boolean> {
    if (!this.rootHandle) {
      return false;
    }

    try {
      // Prova a leggere il contenuto della cartella
      let count = 0;
      for await (const entry of (this.rootHandle as any).values()) {
        count++;
        if (count > 5) break; // Limita per performance
      }
      return true;
    } catch (error) {
      console.error('Root folder access validation failed:', error);
      return false;
    }
  }
}

/**
 * Helper function per ottenere l'istanza del FolderManager
 */
export const folderManager = FolderManager.getInstance();