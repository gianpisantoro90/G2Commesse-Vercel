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
      const response = await fetch('/api/onedrive/root-folder');
      if (response.ok) {
        const data = await response.json();
        return data.config as OneDriveRootConfig | null;
      }
      if (response.status === 404) {
        return null; // No configuration found
      }
      throw new Error(`Failed to fetch root config: ${response.statusText}`);
    },
    enabled: isConnected,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (no config found)
      if (error?.message?.includes('404')) return false;
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
    onSuccess: () => {
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