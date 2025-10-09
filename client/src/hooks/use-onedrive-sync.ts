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

  // Get all projects for syncing (always enabled)
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects']
    // Remove enabled condition - we need projects for sync stats calculation
  }) as { data: Project[] | undefined, isLoading: boolean };

  // Get OneDrive mappings to include in sync stats
  const { data: oneDriveMappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['/api/onedrive/mappings'],
    enabled: isConnected
  }) as { data: any[] | undefined, isLoading: boolean };

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
      // Invalidate OneDrive mappings to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/onedrive/mappings"] });
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
      // Invalidate OneDrive mappings to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/onedrive/mappings"] });
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
      const result = await oneDriveService.uploadFile(file, projectCode, targetFolder || '');
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

  // Function to manually reset a project's sync status (for debugging/cleanup)
  const resetProjectSyncStatus = (projectId: string) => {
    const newStatuses = { ...syncStatuses };
    delete newStatuses[projectId];
    setSyncStatuses(newStatuses);
    localStorage.setItem('onedrive_sync_statuses', JSON.stringify(newStatuses));
    console.log(`🧹 Reset sync status for project: ${projectId}`);
  };

  const getOverallSyncStats = () => {
    const statuses = Object.values(syncStatuses);
    const totalProjects = projects && Array.isArray(projects) ? projects.length : 0;
    
    // Get projects with existing OneDrive mappings
    const mappedProjectCodes = oneDriveMappings && Array.isArray(oneDriveMappings) 
      ? oneDriveMappings.map(m => m.projectCode) 
      : [];
    
    // Find projects that have mappings but no status tracked locally
    const projectsWithMappings = projects && Array.isArray(projects) 
      ? projects.filter(p => mappedProjectCodes.includes(p.code) && !syncStatuses[p.id])
      : [];
    
    const syncedFromStatus = statuses.filter(s => s.status === 'synced').length;
    const syncedFromMappings = projectsWithMappings.length;
    const totalSynced = syncedFromStatus + syncedFromMappings;
    
    return {
      total: totalProjects,
      synced: totalSynced,
      pending: statuses.filter(s => s.status === 'pending').length,
      errors: statuses.filter(s => s.status === 'error').length,
      notSynced: totalProjects - totalSynced - statuses.filter(s => s.status === 'pending' || s.status === 'error').length
    };
  };

  // DISABLED: Auto-sync removed - OneDrive folders should only be created 
  // when user explicitly clicks "Crea Commessa OneDrive" button
  // This prevents empty folders from being created automatically

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
    resetProjectSyncStatus,
    
    // Utilities
    getSyncStatus,
    getOverallSyncStats,
    
    // Loading states
    isSyncing: syncProjectMutation.isPending,
    isSyncingAll: syncAllProjectsMutation.isPending,
    isUploading: uploadFileMutation.isPending
  };
}