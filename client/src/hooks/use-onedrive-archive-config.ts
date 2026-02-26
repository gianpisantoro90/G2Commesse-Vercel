import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOneDriveSync } from "./use-onedrive-sync";

export interface OneDriveArchiveConfig {
  folderPath: string;
  folderId?: string;
  folderName: string;
  lastUpdated?: string;
  isDefault?: boolean; // true se è il valore predefinito, non configurato dall'utente
}

const ONEDRIVE_ARCHIVE_CONFIG_KEY = ['onedrive-archive-folder'] as const;

export function useOneDriveArchiveConfig() {
  const { isConnected } = useOneDriveSync();
  const queryClient = useQueryClient();

  const {
    data: archiveConfig,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ONEDRIVE_ARCHIVE_CONFIG_KEY,
    queryFn: async () => {
      const response = await fetch('/api/onedrive/archive-folder', { credentials: "include" });
      if (response.ok) {
        return response.json().then((data: any) => data.config as OneDriveArchiveConfig | null);
      }
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch archive config: ${response.statusText}`);
    },
    enabled: isConnected,
    initialData: null,
    staleTime: 1000 * 60 * 5,
  });

  const setArchiveFolderMutation = useMutation({
    mutationFn: async ({ folderId, folderPath }: { folderId: string; folderPath: string }) => {
      const response = await fetch('/api/onedrive/set-archive-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ folderId, folderPath }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to set archive folder');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONEDRIVE_ARCHIVE_CONFIG_KEY });
      queryClient.refetchQueries({ queryKey: ONEDRIVE_ARCHIVE_CONFIG_KEY });
    },
  });

  const resetArchiveFolderMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/onedrive/archive-folder', {
        method: 'DELETE',
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error('Failed to reset archive folder configuration');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONEDRIVE_ARCHIVE_CONFIG_KEY });
      queryClient.refetchQueries({ queryKey: ONEDRIVE_ARCHIVE_CONFIG_KEY });
    },
  });

  const isConfigured = Boolean(archiveConfig && archiveConfig.folderPath);
  const isDefaultConfig = Boolean(archiveConfig?.isDefault); // true se sta usando il valore predefinito
  const isConfiguring = setArchiveFolderMutation.isPending;
  const isResetting = resetArchiveFolderMutation.isPending;

  return {
    archiveConfig,
    isConfigured,
    isDefaultConfig, // true se sta usando il valore predefinito
    isLoading,
    isConfiguring,
    isResetting,
    error,
    setArchiveFolder: setArchiveFolderMutation.mutate,
    resetArchiveFolder: resetArchiveFolderMutation.mutate,
    refetch,
  };
}
