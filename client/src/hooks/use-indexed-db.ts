import { useState, useEffect, useCallback } from "react";
import { g2Storage } from "@/lib/storage";
import { type Project, type Client, type FileRouting, type SystemConfig } from "@shared/schema";

// Hook for managing IndexedDB operations
export function useIndexedDB() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initDB = async () => {
      try {
        await g2Storage.init();
        setIsInitialized(true);
      } catch (err) {
        setError(`Errore inizializzazione database: ${err}`);
      }
    };

    initDB();
  }, []);

  return { isInitialized, error };
}

// Hook for projects management
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await g2Storage.getAllProjects();
      setProjects(data);
    } catch (err) {
      setError(`Errore caricamento progetti: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProject = useCallback(async (project: Project) => {
    try {
      await g2Storage.saveProject(project);
      await loadProjects(); // Refresh list
      return true;
    } catch (err) {
      setError(`Errore salvataggio progetto: ${err}`);
      return false;
    }
  }, [loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await g2Storage.deleteProject(id);
      await loadProjects(); // Refresh list
      return true;
    } catch (err) {
      setError(`Errore eliminazione progetto: ${err}`);
      return false;
    }
  }, [loadProjects]);

  const getProject = useCallback(async (id: string): Promise<Project | null> => {
    try {
      return await g2Storage.getProject(id);
    } catch (err) {
      setError(`Errore recupero progetto: ${err}`);
      return null;
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    error,
    loadProjects,
    saveProject,
    deleteProject,
    getProject,
  };
}

// Hook for clients management
export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await g2Storage.getAllClients();
      setClients(data);
    } catch (err) {
      setError(`Errore caricamento clienti: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveClient = useCallback(async (client: Client) => {
    try {
      await g2Storage.saveClient(client);
      await loadClients(); // Refresh list
      return true;
    } catch (err) {
      setError(`Errore salvataggio cliente: ${err}`);
      return false;
    }
  }, [loadClients]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  return {
    clients,
    loading,
    error,
    loadClients,
    saveClient,
  };
}

// Hook for file routings management
export function useFileRoutings(projectId?: string) {
  const [routings, setRoutings] = useState<FileRouting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoutings = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await g2Storage.getFileRoutingsByProject(projectId);
      setRoutings(data);
    } catch (err) {
      setError(`Errore caricamento routing: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const saveRouting = useCallback(async (routing: FileRouting) => {
    try {
      await g2Storage.saveFileRouting(routing);
      await loadRoutings(); // Refresh list
      return true;
    } catch (err) {
      setError(`Errore salvataggio routing: ${err}`);
      return false;
    }
  }, [loadRoutings]);

  useEffect(() => {
    if (projectId) {
      loadRoutings();
    }
  }, [projectId, loadRoutings]);

  return {
    routings,
    loading,
    error,
    loadRoutings,
    saveRouting,
  };
}

// Hook for system configuration
export function useSystemConfig() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConfig = useCallback(async (key: string) => {
    try {
      const config = await g2Storage.getSystemConfig(key);
      return config?.value;
    } catch (err) {
      setError(`Errore recupero configurazione: ${err}`);
      return null;
    }
  }, []);

  const setConfig = useCallback(async (key: string, value: any) => {
    try {
      const config: SystemConfig = {
        id: crypto.randomUUID(),
        key,
        value,
        updatedAt: new Date(),
      };
      await g2Storage.saveSystemConfig(config);
      setConfigs(prev => ({ ...prev, [key]: value }));
      return true;
    } catch (err) {
      setError(`Errore salvataggio configurazione: ${err}`);
      return false;
    }
  }, []);

  return {
    configs,
    loading,
    error,
    getConfig,
    setConfig,
  };
}

// Hook for database storage information
export function useStorageInfo() {
  const [storageInfo, setStorageInfo] = useState({
    usage: 0,
    quota: 0,
    projects: 0,
    clients: 0,
    fileRoutings: 0,
  });
  const [loading, setLoading] = useState(false);

  const updateStorageInfo = useCallback(async () => {
    setLoading(true);
    try {
      const info = await g2Storage.getStorageInfo();
      setStorageInfo(info);
    } catch (err) {
      console.error('Error getting storage info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    updateStorageInfo();
  }, [updateStorageInfo]);

  return {
    storageInfo,
    loading,
    updateStorageInfo,
  };
}

// Hook for bulk data operations
export function useBulkOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await g2Storage.exportAllData();
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `g2-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (err) {
      setError(`Errore esportazione: ${err}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const importAllData = useCallback(async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      await g2Storage.importAllData(data);
      return true;
    } catch (err) {
      setError(`Errore importazione: ${err}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await g2Storage.clearAllData();
      return true;
    } catch (err) {
      setError(`Errore pulizia database: ${err}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    exportAllData,
    importAllData,
    clearAllData,
  };
}

// Hook for monitoring IndexedDB health
export function useDBHealth() {
  const [isHealthy, setIsHealthy] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      // Simple health check: try to perform a basic operation
      await g2Storage.getAllProjects();
      setIsHealthy(true);
      setLastCheck(new Date());
    } catch (err) {
      console.error('DB health check failed:', err);
      setIsHealthy(false);
      setLastCheck(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    
    // Check health every 15 minutes
    const interval = setInterval(checkHealth, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    isHealthy,
    lastCheck,
    checkHealth,
  };
}

// Hook for IndexedDB quota management
export function useQuotaManagement() {
  const [quotaInfo, setQuotaInfo] = useState({
    usage: 0,
    quota: 0,
    usagePercentage: 0,
  });

  const checkQuota = useCallback(async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;
        
        setQuotaInfo({ usage, quota, usagePercentage });
      } catch (err) {
        console.error('Quota check failed:', err);
      }
    }
  }, []);

  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  return {
    quotaInfo,
    checkQuota,
    formatBytes,
    isNearLimit: quotaInfo.usagePercentage > 80,
    isAtLimit: quotaInfo.usagePercentage > 95,
  };
}
