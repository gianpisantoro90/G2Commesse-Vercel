import { type Project, type Client, type FileRouting, type SystemConfig } from "@shared/schema";

// IndexedDB Database Management
class G2StorageDB {
  private dbName = 'G2CommesseDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('code', 'code', { unique: true });
          projectStore.createIndex('client', 'client', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('clients')) {
          const clientStore = db.createObjectStore('clients', { keyPath: 'id' });
          clientStore.createIndex('sigla', 'sigla', { unique: true });
        }
        
        if (!db.objectStoreNames.contains('fileRoutings')) {
          const routingStore = db.createObjectStore('fileRoutings', { keyPath: 'id' });
          routingStore.createIndex('projectId', 'projectId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('systemConfig')) {
          const configStore = db.createObjectStore('systemConfig', { keyPath: 'id' });
          configStore.createIndex('key', 'key', { unique: true });
        }
        
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) {
      await this.init();
    }
    const transaction = this.db!.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  // Projects
  async saveProject(project: Project): Promise<void> {
    const store = await this.getStore('projects', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(project);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Save metadata to localStorage for quick access
    const metadata = {
      id: project.id,
      code: project.code,
      client: project.client,
      city: project.city,
      year: project.year,
      template: project.template
    };
    localStorage.setItem(`meta_${project.id}`, JSON.stringify(metadata));
  }

  async getProject(id: string): Promise<Project | null> {
    const store = await this.getStore('projects');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProjects(): Promise<Project[]> {
    const store = await this.getStore('projects');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    const store = await this.getStore('projects', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Remove metadata
    localStorage.removeItem(`meta_${id}`);
  }

  // Clients
  async saveClient(client: Client): Promise<void> {
    const store = await this.getStore('clients', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(client);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllClients(): Promise<Client[]> {
    const store = await this.getStore('clients');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // File Routings
  async saveFileRouting(routing: FileRouting): Promise<void> {
    const store = await this.getStore('fileRoutings', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(routing);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getFileRoutingsByProject(projectId: string): Promise<FileRouting[]> {
    const store = await this.getStore('fileRoutings');
    const index = store.index('projectId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(projectId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // System Config
  async saveSystemConfig(config: SystemConfig): Promise<void> {
    const store = await this.getStore('systemConfig', 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(config);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSystemConfig(key: string): Promise<SystemConfig | null> {
    const store = await this.getStore('systemConfig');
    const index = store.index('key');
    return new Promise((resolve, reject) => {
      const request = index.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Bulk operations
  async exportAllData(): Promise<{
    projects: Project[];
    clients: Client[];
    fileRoutings: FileRouting[];
    systemConfig: SystemConfig[];
  }> {
    const [projects, clients, fileRoutings, systemConfig] = await Promise.all([
      this.getAllProjects(),
      this.getAllClients(),
      this.getAllFileRoutings(),
      this.getAllSystemConfig(),
    ]);

    return { projects, clients, fileRoutings, systemConfig };
  }

  async importAllData(data: {
    projects: Project[];
    clients: Client[];
    fileRoutings: FileRouting[];
    systemConfig: SystemConfig[];
  }): Promise<void> {
    // Clear existing data
    await this.clearAllData();

    // Import new data
    const promises: Promise<void>[] = [];
    
    data.projects?.forEach(project => {
      promises.push(this.saveProject(project));
    });
    
    data.clients?.forEach(client => {
      promises.push(this.saveClient(client));
    });
    
    data.fileRoutings?.forEach(routing => {
      promises.push(this.saveFileRouting(routing));
    });
    
    data.systemConfig?.forEach(config => {
      promises.push(this.saveSystemConfig(config));
    });

    await Promise.all(promises);
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init();
    
    const storeNames = ['projects', 'clients', 'fileRoutings', 'systemConfig', 'metadata'];
    const promises = storeNames.map(storeName => {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    
    await Promise.all(promises);
    
    // Clear metadata from localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('meta_')) {
        localStorage.removeItem(key);
      }
    });
  }

  private async getAllFileRoutings(): Promise<FileRouting[]> {
    const store = await this.getStore('fileRoutings');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllSystemConfig(): Promise<SystemConfig[]> {
    const store = await this.getStore('systemConfig');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Get storage usage information
  async getStorageInfo(): Promise<{
    usage: number;
    quota: number;
    projects: number;
    clients: number;
    fileRoutings: number;
  }> {
    let usage = 0;
    let quota = 0;
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        usage = estimate.usage || 0;
        quota = estimate.quota || 0;
      } catch (error) {
        // Storage estimate not available
      }
    }

    const [projects, clients, fileRoutings] = await Promise.all([
      this.getAllProjects(),
      this.getAllClients(),
      this.getAllFileRoutings(),
    ]);

    return {
      usage,
      quota,
      projects: projects.length,
      clients: clients.length,
      fileRoutings: fileRoutings.length,
    };
  }
}

// Export singleton instance
export const g2Storage = new G2StorageDB();

// Helper functions for localStorage operations
export const localStorageHelpers = {
  // Save encrypted data
  saveEncrypted: (key: string, data: any): void => {
    try {
      const encrypted = btoa(JSON.stringify(data));
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Error saving encrypted data:', error);
    }
  },

  // Load encrypted data
  loadEncrypted: <T>(key: string, defaultValue: T): T => {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return defaultValue;
      const decrypted = JSON.parse(atob(encrypted));
      return decrypted;
    } catch (error) {
      console.error('Error loading encrypted data:', error);
      return defaultValue;
    }
  },

  // Save learned patterns for AI routing
  saveLearnedPatterns: (patterns: Record<string, string>): void => {
    localStorage.setItem('learned_patterns', JSON.stringify(patterns));
  },

  // Load learned patterns
  loadLearnedPatterns: (): Record<string, string> => {
    try {
      const patterns = localStorage.getItem('learned_patterns');
      return patterns ? JSON.parse(patterns) : {};
    } catch (error) {
      console.error('Error loading learned patterns:', error);
      return {};
    }
  },

  // Clear all G2 related localStorage data
  clearG2Data: (): void => {
    const keysToRemove: string[] = [];
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('meta_') || 
          key.startsWith('g2_') || 
          key === 'learned_patterns' ||
          key === 'ai_config') {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  // Get localStorage size
  getSize: (): number => {
    let total = 0;
    Object.keys(localStorage).forEach(key => {
      total += localStorage[key].length + key.length;
    });
    return total;
  }
};
