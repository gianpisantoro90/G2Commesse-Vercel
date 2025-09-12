import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOneDriveSync } from "./use-onedrive-sync";

// OneDrive root folder configuration type
export interface OneDriveRootConfig {
  folderPath: string;
  folderId: string;
  folderName: string;
  lastUpdated: string;
}

// Query key for OneDrive root folder configuration
const ONEDRIVE_ROOT_CONFIG_KEY = ['onedrive-root-folder'] as const;

// localStorage key for OneDrive root config backup
const LOCALSTORAGE_ROOT_CONFIG_KEY = 'g2-onedrive-root-config';

// Helper functions for localStorage persistence
function saveConfigToLocalStorage(config: OneDriveRootConfig | null) {
  try {
    if (config) {
      localStorage.setItem(LOCALSTORAGE_ROOT_CONFIG_KEY, JSON.stringify(config));
      console.log('💾 OneDrive root config saved to localStorage:', config.folderPath);
    } else {
      localStorage.removeItem(LOCALSTORAGE_ROOT_CONFIG_KEY);
      console.log('🗑️ OneDrive root config removed from localStorage');
    }
  } catch (error) {
    console.warn('⚠️ Failed to save OneDrive config to localStorage:', error);
  }
}

function loadConfigFromLocalStorage(): OneDriveRootConfig | null {
  try {
    const saved = localStorage.getItem(LOCALSTORAGE_ROOT_CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved) as OneDriveRootConfig;
      console.log('📱 OneDrive root config loaded from localStorage:', config.folderPath);
      return config;
    }
  } catch (error) {
    console.warn('⚠️ Failed to load OneDrive config from localStorage:', error);
  }
  return null;
}

/**
 * Custom hook for managing OneDrive root folder configuration
 * Provides consistent data access, cache management, and invalidation across all components
 */
export function useOneDriveRootConfig() {
  const { isConnected } = useOneDriveSync();
  const queryClient = useQueryClient();

  // Query for getting current OneDrive root folder configuration
  const {
    data: rootConfig,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ONEDRIVE_ROOT_CONFIG_KEY,
    queryFn: async () => {
      try {
        const response = await fetch('/api/onedrive/root-folder');
        if (response.ok) {
          const data = await response.json();
          const config = data.config as OneDriveRootConfig | null;
          
          // Save to localStorage when successfully fetched from backend
          saveConfigToLocalStorage(config);
          
          return config;
        }
        if (response.status === 404) {
          // No backend config, try localStorage
          const localConfig = loadConfigFromLocalStorage();
          return localConfig;
        }
        throw new Error(`Failed to fetch root config: ${response.statusText}`);
      } catch (fetchError) {
        // Network or backend error, fallback to localStorage
        console.warn('🔄 Backend unavailable, using localStorage fallback');
        const localConfig = loadConfigFromLocalStorage();
        return localConfig;
      }
    },
    enabled: isConnected,
    initialData: null, // Fix "Query data cannot be undefined" warning
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (no config found) or network errors (use localStorage instead)
      if (error?.message?.includes('404') || error?.message?.includes('Failed to fetch')) return false;
      return failureCount < 2;
    },
  });

  // Mutation for setting OneDrive root folder
  const setRootFolderMutation = useMutation({
    mutationFn: async ({ folderId, folderPath }: { folderId: string; folderPath: string }) => {
      const response = await fetch('/api/onedrive/set-root-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, folderPath }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to set root folder');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Save successful configuration to localStorage immediately
      if (data && data.config) {
        saveConfigToLocalStorage(data.config);
      }
      
      // Invalidate and refetch all OneDrive root config queries
      queryClient.invalidateQueries({ queryKey: ONEDRIVE_ROOT_CONFIG_KEY });
      
      // Also invalidate any related OneDrive queries that might depend on root config
      queryClient.invalidateQueries({ queryKey: ['onedrive-files'] });
      queryClient.invalidateQueries({ queryKey: ['onedrive-browse'] });
      
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ONEDRIVE_ROOT_CONFIG_KEY });
    },
  });

  // Mutation for resetting OneDrive root folder configuration
  const resetRootFolderMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/onedrive/root-folder', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to reset root folder configuration');
      }
      return response.json();
    },
    onSuccess: () => {
      // Remove configuration from localStorage when reset
      saveConfigToLocalStorage(null);
      
      // Invalidate and refetch all OneDrive root config queries
      queryClient.invalidateQueries({ queryKey: ONEDRIVE_ROOT_CONFIG_KEY });
      
      // Also invalidate any related OneDrive queries
      queryClient.invalidateQueries({ queryKey: ['onedrive-files'] });
      queryClient.invalidateQueries({ queryKey: ['onedrive-browse'] });
      
      // Force immediate refetch to get null state
      queryClient.refetchQueries({ queryKey: ONEDRIVE_ROOT_CONFIG_KEY });
    },
  });

  // Derived state
  const isConfigured = Boolean(rootConfig && rootConfig.folderPath);
  const isConfiguring = setRootFolderMutation.isPending;
  const isResetting = resetRootFolderMutation.isPending;

  // Helper function to force cache invalidation (useful for debugging)
  const forceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ONEDRIVE_ROOT_CONFIG_KEY });
    queryClient.refetchQueries({ queryKey: ONEDRIVE_ROOT_CONFIG_KEY });
  };

  return {
    // Data
    rootConfig,
    isConfigured,
    
    // Loading states
    isLoading,
    isConfiguring,
    isResetting,
    
    // Error states
    error,
    
    // Actions
    setRootFolder: setRootFolderMutation.mutate,
    resetRootFolder: resetRootFolderMutation.mutate,
    refetch,
    forceRefresh,
    
    // Mutation objects (for more granular control)
    setRootFolderMutation,
    resetRootFolderMutation,
  };
}

// Export the query key for external use if needed
export { ONEDRIVE_ROOT_CONFIG_KEY };