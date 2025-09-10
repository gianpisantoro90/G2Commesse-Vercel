import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import oneDriveService from '@/lib/onedrive-service';
import { useToast } from '@/hooks/use-toast';
import { type Project } from '@shared/schema';

interface SyncStatus {
  projectId: string;
  status: 'synced' | 'pending' | 'error' | 'not_synced';
  lastSync?: string;
  error?: string;
}

export function useOneDriveSync() {
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, SyncStatus>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check OneDrive connection status (fixed state sync issue)
  const { data: connectionStatus, isSuccess } = useQuery({
    queryKey: ['onedrive-connection'],
    queryFn: async () => {
      const connected = await oneDriveService.testConnection();
      return connected;
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: false,
    staleTime: 10000 // Consider data fresh for 10 seconds
  });

  // Get connection status from query result instead of local state
  const isConnected = isSuccess && connectionStatus === true;

  // Get all projects for syncing
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    enabled: isConnected
  }) as { data: Project[] | undefined };

  // Load sync settings
  useEffect(() => {
    const savedAutoSync = localStorage.getItem('onedrive_auto_sync');
    if (savedAutoSync !== null) {
      setAutoSyncEnabled(JSON.parse(savedAutoSync));
    }
    
    const savedStatuses = localStorage.getItem('onedrive_sync_statuses');
    if (savedStatuses) {
      setSyncStatuses(JSON.parse(savedStatuses));
    }
  }, []);

  // Save sync statuses to localStorage
  useEffect(() => {
    localStorage.setItem('onedrive_sync_statuses', JSON.stringify(syncStatuses));
  }, [syncStatuses]);

  // Auto-sync logic moved after function definitions to avoid circular dependency

  // Sync single project mutation
  const syncProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const project = projects && Array.isArray(projects) ? projects.find((p: Project) => p.id === projectId) : undefined;
      if (!project) throw new Error('Project not found');

      // Update status to pending
      setSyncStatuses(prev => ({
        ...prev,
        [projectId]: { projectId, status: 'pending' }
      }));

      // Create project folder in OneDrive
      const success = await oneDriveService.syncProjectFolder(project.code, project.object);
      
      if (success) {
        setSyncStatuses(prev => ({
          ...prev,
          [projectId]: { 
            projectId, 
            status: 'synced', 
            lastSync: new Date().toISOString() 
          }
        }));
        return true;
      } else {
        throw new Error('Sync failed');
      }
    },
    onSuccess: (_, projectId) => {
      const project = projects && Array.isArray(projects) ? projects.find((p: Project) => p.id === projectId) : undefined;
      toast({
        title: "Progetto sincronizzato",
        description: `Il progetto ${project?.code} è stato sincronizzato con OneDrive`,
      });
    },
    onError: (error, projectId) => {
      setSyncStatuses(prev => ({
        ...prev,
        [projectId]: { 
          projectId, 
          status: 'error', 
          error: error.message 
        }
      }));
      toast({
        title: "Errore sincronizzazione",
        description: `Impossibile sincronizzare il progetto: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Bulk sync all projects
  const syncAllProjectsMutation = useMutation({
    mutationFn: async () => {
      if (!projects || !Array.isArray(projects)) return { total: 0, success: 0 };
      
      const results = await Promise.allSettled(
        projects.map((project: Project) => 
          oneDriveService.syncProjectFolder(project.code, project.object)
            .then(success => ({ projectId: project.id, success }))
        )
      );

      // Update statuses based on results
      results.forEach((result: any, index: number) => {
        const project = projects[index];
        if (result.status === 'fulfilled' && result.value.success) {
          setSyncStatuses(prev => ({
            ...prev,
            [project.id]: { 
              projectId: project.id, 
              status: 'synced', 
              lastSync: new Date().toISOString() 
            }
          }));
        } else {
          setSyncStatuses(prev => ({
            ...prev,
            [project.id]: { 
              projectId: project.id, 
              status: 'error', 
              error: 'Sync failed' 
            }
          }));
        }
      });

      const successCount = results.filter((r: any) => 
        r.status === 'fulfilled' && r.value.success
      ).length;

      return { total: results.length, success: successCount };
    },
    onSuccess: (results) => {
      toast({
        title: "Sincronizzazione completata",
        description: `${results?.success}/${results?.total} progetti sincronizzati con successo`,
      });
    },
    onError: (error) => {
      toast({
        title: "Errore sincronizzazione",
        description: `Errore durante la sincronizzazione: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Upload file to project folder
  const uploadFileMutation = useMutation({
    mutationFn: async ({ 
      file, 
      projectCode, 
      targetFolder 
    }: { 
      file: File; 
      projectCode: string; 
      targetFolder?: string; 
    }) => {
      const result = await oneDriveService.uploadFile(file, projectCode, targetFolder);
      if (!result) throw new Error('Upload failed');
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: "File caricato",
        description: `File ${result.name} caricato con successo in OneDrive`,
      });
      // Invalidate OneDrive files query
      queryClient.invalidateQueries({ queryKey: ['onedrive-files'] });
    },
    onError: (error) => {
      toast({
        title: "Errore upload",
        description: `Impossibile caricare il file: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const syncProject = (projectId: string) => {
    syncProjectMutation.mutate(projectId);
  };

  const syncAllProjects = () => {
    syncAllProjectsMutation.mutate();
  };

  const uploadFile = (file: File, projectCode: string, targetFolder?: string) => {
    uploadFileMutation.mutate({ file, projectCode, targetFolder });
  };

  const toggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('onedrive_auto_sync', JSON.stringify(enabled));
  };

  const getSyncStatus = (projectId: string): SyncStatus => {
    return syncStatuses[projectId] || { projectId, status: 'not_synced' };
  };

  const getOverallSyncStats = () => {
    const statuses = Object.values(syncStatuses);
    const totalProjects = projects && Array.isArray(projects) ? projects.length : 0;
    return {
      total: totalProjects,
      synced: statuses.filter(s => s.status === 'synced').length,
      pending: statuses.filter(s => s.status === 'pending').length,
      errors: statuses.filter(s => s.status === 'error').length,
      notSynced: totalProjects - statuses.length
    };
  };

  // Auto-sync new projects (fixed circular dependency by placing after function definitions)
  useEffect(() => {
    if (!isConnected || !autoSyncEnabled || !projects || !Array.isArray(projects)) return;

    const autoSyncProjects = async () => {
      for (const project of projects) {
        const currentStatus = syncStatuses[project.id];
        if (!currentStatus || currentStatus.status === 'not_synced') {
          syncProject(project.id);
          // Add small delay between auto-syncs to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    };

    autoSyncProjects();
  }, [projects, isConnected, autoSyncEnabled, syncStatuses]); // Added missing dependencies

  return {
    // State
    isConnected,
    autoSyncEnabled,
    syncStatuses,
    
    // Actions
    syncProject,
    syncAllProjects,
    uploadFile,
    toggleAutoSync,
    
    // Utilities
    getSyncStatus,
    getOverallSyncStats,
    
    // Loading states
    isSyncing: syncProjectMutation.isPending,
    isSyncingAll: syncAllProjectsMutation.isPending,
    isUploading: uploadFileMutation.isPending
  };
}