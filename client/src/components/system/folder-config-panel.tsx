import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { useOneDriveRootConfig } from "@/hooks/use-onedrive-root-config";
import { useOneDriveArchiveConfig } from "@/hooks/use-onedrive-archive-config";
import { FolderOpen, Check, AlertCircle, Settings, Folder, ChevronRight, RefreshCw, Home, Cloud, Archive } from "lucide-react";
import oneDriveService, { OneDriveFile } from "@/lib/onedrive-service";

interface OneDriveRootConfig {
  folderPath: string;
  folderId: string;
  folderName: string;
  lastUpdated: string;
}

export default function FolderConfigPanel() {
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedFolder, setSelectedFolder] = useState<OneDriveFile | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [showArchiveBrowser, setShowArchiveBrowser] = useState(false);
  const [selectedArchiveFolder, setSelectedArchiveFolder] = useState<OneDriveFile | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected } = useOneDriveSync();

  // Use shared OneDrive root folder configuration hook
  const {
    rootConfig,
    isConfigured,
    isLoading: isLoadingConfig,
    setRootFolder,
    resetRootFolder,
    isConfiguring,
    isResetting,
    refetch: refetchConfig,
  } = useOneDriveRootConfig();

  // Use archive folder configuration hook
  const {
    archiveConfig,
    isConfigured: isArchiveConfigured,
    setArchiveFolder,
    resetArchiveFolder,
    isConfiguring: isConfiguringArchive,
    isResetting: isResettingArchive,
  } = useOneDriveArchiveConfig();

  // Get current folder files for browsing
  const { data: currentFiles, isLoading: isLoadingFiles, refetch: refetchFiles } = useQuery({
    queryKey: ['onedrive-browse', currentPath],
    queryFn: async () => {
      const response = await fetch(`/api/onedrive/browse?path=${encodeURIComponent(currentPath)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
      return response.json() as Promise<OneDriveFile[]>;
    },
    enabled: isConnected && (showBrowser || showArchiveBrowser)
  });

  // Handle archive folder selection
  const handleConfirmArchiveSelection = async () => {
    if (!selectedArchiveFolder) {
      toast({
        title: "Nessuna cartella selezionata",
        description: "Seleziona una cartella dalla lista",
        variant: "destructive",
      });
      return;
    }

    const folderPath = selectedArchiveFolder.parentPath === '/' 
      ? `/${selectedArchiveFolder.name}` 
      : `${selectedArchiveFolder.parentPath}/${selectedArchiveFolder.name}`;

    try {
      await setArchiveFolder({
        folderId: selectedArchiveFolder.id,
        folderPath: folderPath
      });
      
      toast({
        title: "Cartella archivio configurata",
        description: "La cartella OneDrive è stata impostata per l'archivio automatico",
      });
      setShowArchiveBrowser(false);
      setSelectedArchiveFolder(null);
    } catch (error: any) {
      console.error('Set archive folder error:', error);
      const errorMessage = error?.message || 'Errore sconosciuto';
      toast({
        title: "Errore configurazione",
        description: `Impossibile configurare la cartella archivio: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  // Handle reset archive folder
  const handleResetArchiveConfig = async () => {
    if (window.confirm('Sei sicuro di voler rimuovere la configurazione della cartella archivio?')) {
      try {
        await resetArchiveFolder();
        toast({
          title: "Configurazione archivio resettata",
          description: "La configurazione della cartella archivio OneDrive è stata rimossa.",
        });
      } catch (error: any) {
        console.error('Reset archive folder error:', error);
        toast({
          title: "Errore reset",
          description: "Impossibile resettare la configurazione archivio",
          variant: "destructive",
        });
      }
    }
  };


  // Navigate to folder
  const navigateToFolder = (folderPath: string) => {
    setCurrentPath(folderPath);
  };

  // Handle folder selection
  const handleFolderSelect = (folder: OneDriveFile) => {
    if (folder.folder) {
      setSelectedFolder(folder);
    }
  };

  // Handle folder double-click (navigate into)
  const handleFolderNavigate = (folder: OneDriveFile) => {
    if (folder.folder) {
      const newPath = folder.parentPath === '/' ? `/${folder.name}` : `${folder.parentPath}/${folder.name}`;
      navigateToFolder(newPath);
    }
  };

  // Confirm root folder selection
  const handleConfirmSelection = async () => {
    if (!selectedFolder) {
      toast({
        title: "Nessuna cartella selezionata",
        description: "Seleziona una cartella dalla lista",
        variant: "destructive",
      });
      return;
    }

    const folderPath = selectedFolder.parentPath === '/' 
      ? `/${selectedFolder.name}` 
      : `${selectedFolder.parentPath}/${selectedFolder.name}`;

    try {
      await setRootFolder({
        folderId: selectedFolder.id,
        folderPath: folderPath
      });
      
      toast({
        title: "Cartella radice configurata",
        description: "La cartella OneDrive è stata impostata come radice per i progetti G2",
      });
      setShowBrowser(false);
      setSelectedFolder(null);
    } catch (error: any) {
      console.error('Set root folder error:', error);
      const errorMessage = error?.message || 'Errore sconosciuto';
      toast({
        title: "Errore configurazione",
        description: `Impossibile configurare la cartella radice: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  // Confirm archive folder selection
  const handleConfirmArchiveSelection = async () => {
    if (!selectedArchiveFolder) {
      toast({
        title: "Nessuna cartella selezionata",
        description: "Seleziona una cartella dalla lista",
        variant: "destructive",
      });
      return;
    }

    const folderPath = selectedArchiveFolder.parentPath === '/' 
      ? `/${selectedArchiveFolder.name}` 
      : `${selectedArchiveFolder.parentPath}/${selectedArchiveFolder.name}`;

    try {
      await setArchiveFolder({
        folderId: selectedArchiveFolder.id,
        folderPath: folderPath
      });
      
      toast({
        title: "Cartella archivio configurata",
        description: "La cartella OneDrive è stata impostata per l'archivio automatico",
      });
      setShowArchiveBrowser(false);
      setSelectedArchiveFolder(null);
    } catch (error: any) {
      console.error('Set archive folder error:', error);
      const errorMessage = error?.message || 'Errore sconosciuto';
      toast({
        title: "Errore configurazione",
        description: `Impossibile configurare la cartella archivio: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  // Generate breadcrumb items
  const getBreadcrumbItems = () => {
    if (currentPath === '/') return [{ name: 'OneDrive Root', path: '/' }];
    
    const parts = currentPath.split('/').filter(Boolean);
    const items = [{ name: 'OneDrive Root', path: '/' }];
    
    let currentBreadcrumbPath = '';
    parts.forEach(part => {
      currentBreadcrumbPath += `/${part}`;
      items.push({ name: part, path: currentBreadcrumbPath });
    });
    
    return items;
  };

  // Reset OneDrive root folder configuration
  const handleResetConfig = async () => {
    if (confirm("Sei sicuro di voler resettare la configurazione della cartella radice OneDrive?")) {
      try {
        await resetRootFolder();
        
        toast({
          title: "Configurazione resettata",
          description: "La configurazione della cartella radice OneDrive è stata rimossa.",
        });
      } catch (error: any) {
        console.error('Reset root folder error:', error);
        toast({
          title: "Errore reset",
          description: "Impossibile resettare la configurazione",
          variant: "destructive",
        });
      }
    }
  };

  // Reset archive folder configuration
  const handleResetArchiveConfig = async () => {
    if (confirm("Sei sicuro di voler resettare la configurazione della cartella archivio OneDrive?")) {
      try {
        await resetArchiveFolder();
        
        toast({
          title: "Configurazione archivio resettata",
          description: "La configurazione della cartella archivio OneDrive è stata rimossa.",
        });
      } catch (error: any) {
        console.error('Reset archive folder error:', error);
        toast({
          title: "Errore reset",
          description: "Impossibile resettare la configurazione archivio",
          variant: "destructive",
        });
      }
    }
  };

  // File icon helper
  const getFileIcon = (file: OneDriveFile) => {
    return file.folder ? 
      <Folder className="w-4 h-4 text-blue-500" /> : 
      <FolderOpen className="w-4 h-4 text-gray-500" />;
  };

  const getStatusIcon = () => {
    if (rootConfig) {
      return <Check className="w-5 h-5 text-green-600" />;
    }
    return <Settings className="w-5 h-5 text-gray-400" />;
  };

  const getStatusColor = () => {
    if (rootConfig) {
      return "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20";
    }
    return "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800";
  };

  // Show OneDrive connection requirement first
  if (!isConnected) {
    return (
      <div className="max-w-4xl" data-testid="folder-config-panel">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">☁️</span>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configurazione Cartelle OneDrive</h3>
            <p className="text-gray-600 dark:text-gray-400">Configura la cartella radice OneDrive dove sono contenute tutte le commesse</p>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6 text-center">
          <Cloud className="w-12 h-12 mx-auto mb-3 text-yellow-600 dark:text-yellow-500" />
          <h4 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">OneDrive Non Connesso</h4>
          <p className="text-yellow-700 dark:text-yellow-400 mb-4">
            Per configurare la cartella radice, è necessario prima configurare e connettere OneDrive nelle impostazioni di sistema.
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/#sistema'}
            data-testid="button-goto-settings"
          >
            Vai alle Impostazioni
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6" data-testid="folder-config-panel">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">☁️</span>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configurazione Cartelle OneDrive</h3>
          <p className="text-gray-600 dark:text-gray-400">Configura la cartella radice OneDrive dove sono contenute tutte le commesse G2</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Root Folder Configuration */}
        <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Cartella Radice OneDrive
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cartella Configurata
              </Label>
              <div className={`p-3 border-2 rounded-lg ${getStatusColor()}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="font-medium dark:text-white" data-testid="selected-folder">
                    {isLoadingConfig ? "Caricamento..." : (rootConfig?.folderName || "Nessuna cartella configurata")}
                  </span>
                </div>
                {rootConfig && (
                  <div className="text-sm mt-1 space-y-1">
                    <p className="text-gray-600 dark:text-gray-400" data-testid="folder-path">
                      📁 Percorso: {rootConfig.folderPath}
                    </p>
                    <p className="text-gray-500 dark:text-gray-500" data-testid="last-updated">
                      🕒 Configurata: {new Date(rootConfig.lastUpdated).toLocaleString('it-IT')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => setShowBrowser(!showBrowser)}
                disabled={isSelecting}
                className="w-full"
                data-testid="button-browse-onedrive"
              >
                {showBrowser ? "Chiudi Browser" : "Sfoglia OneDrive"}
              </Button>
              
              {rootConfig && (
                <Button
                  onClick={handleResetConfig}
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  data-testid="button-reset-config"
                >
                  Reset Configurazione
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Archive Folder Configuration */}
        <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Cartella Archivio
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cartella per Archivio Automatico
              </Label>
              <div className={`p-3 border-2 rounded-lg ${archiveConfig ? "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"}`}>
                <div className="flex items-center gap-2">
                  {archiveConfig ? <Check className="w-5 h-5 text-green-600" /> : <Settings className="w-5 h-5 text-gray-400" />}
                  <span className="font-medium dark:text-white">
                    {archiveConfig?.folderName || "Non configurata"}
                  </span>
                </div>
                {archiveConfig && (
                  <div className="text-sm mt-1 space-y-1">
                    <p className="text-gray-600 dark:text-gray-400">
                      📁 Percorso: {archiveConfig.folderPath}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => setShowArchiveBrowser(!showArchiveBrowser)}
                disabled={false}
                className="w-full"
                data-testid="button-browse-archive"
              >
                {showArchiveBrowser ? "Chiudi Browser" : "Sfoglia OneDrive"}
              </Button>
              
              {archiveConfig && (
                <Button
                  onClick={handleResetArchiveConfig}
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  data-testid="button-reset-archive"
                >
                  Reset Archivio
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Information Panel */}
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">ℹ️ Come Funziona</h4>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <p>
                <strong>1. Cartella Radice:</strong> Dove sono organizzate tutte le commesse attive (In Corso).
              </p>
              <p>
                <strong>2. Cartella Archivio:</strong> Dove vengono spostate automaticamente le commesse marcate come Conclusa o Sospesa.
              </p>
              <p>
                <strong>3. Spostamento Automatico:</strong> Quando cambi lo stato di una commessa, la sua cartella OneDrive si sposta automaticamente.
              </p>
            </div>
          </div>

          {rootConfig && (
            <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📊 Stato Configurazione</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Stato:</span>
                  <span className="font-medium text-green-600 dark:text-green-400" data-testid="config-status">Configurata</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Cartella:</span>
                  <span className="font-medium dark:text-white" data-testid="configured-folder">
                    {rootConfig.folderName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ID OneDrive:</span>
                  <span className="font-medium dark:text-white text-xs" data-testid="folder-id">
                    {rootConfig.folderId.substring(0, 12)}...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OneDrive Browser - Root Folder */}
      {showBrowser && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">☁️ Browser OneDrive - Cartella Radice</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchFiles();
              }}
              data-testid="button-refresh-browser"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Aggiorna
            </Button>
          </div>

          {/* Breadcrumb navigation */}
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              {getBreadcrumbItems().map((item, index, array) => (
                <div key={item.path} className="flex items-center">
                  <BreadcrumbItem>
                    {index === array.length - 1 ? (
                      <BreadcrumbPage data-testid={`text-breadcrumb-current-${item.name}`}>
                        {item.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        onClick={() => navigateToFolder(item.path)}
                        className="cursor-pointer"
                        data-testid={`link-breadcrumb-${item.name}`}
                      >
                        {item.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < array.length - 1 && <BreadcrumbSeparator />}
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* File/Folder List */}
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 max-h-96 overflow-y-auto" data-testid="onedrive-browser">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-500 dark:text-gray-400">Caricamento...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {currentFiles?.filter(file => file.folder).map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedFolder?.id === folder.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700'
                    }`}
                    onClick={() => handleFolderSelect(folder)}
                    onDoubleClick={() => handleFolderNavigate(folder)}
                    data-testid={`folder-item-${folder.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(folder)}
                      <div>
                        <div className="font-medium text-sm dark:text-white">{folder.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Cartella • {new Date(folder.lastModified).toLocaleDateString('it-IT')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedFolder?.id === folder.id && (
                        <Check className="w-4 h-4 text-blue-500" />
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
                {currentFiles?.filter(file => file.folder).length === 0 && (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p>Nessuna cartella trovata in questa posizione</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selection Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-2">
              {selectedFolder && (
                <span className="text-sm text-gray-600 dark:text-gray-400" data-testid="selected-folder-info">
                  📁 Selezionata: {selectedFolder.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBrowser(false);
                  setSelectedFolder(null);
                }}
                data-testid="button-cancel-selection"
              >
                Annulla
              </Button>
              <Button
                onClick={handleConfirmSelection}
                disabled={!selectedFolder || isConfiguring}
                data-testid="button-confirm-selection"
              >
                {isConfiguring ? "Configurando..." : "Conferma Selezione"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OneDrive Browser - Archive Folder */}
      {showArchiveBrowser && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">☁️ Browser OneDrive - Cartella Archivio</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchFiles();
              }}
              data-testid="button-refresh-archive-browser"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Aggiorna
            </Button>
          </div>

          {/* Breadcrumb navigation */}
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              {getBreadcrumbItems().map((item, index, array) => (
                <div key={item.path} className="flex items-center">
                  <BreadcrumbItem>
                    {index === array.length - 1 ? (
                      <BreadcrumbPage data-testid={`text-archive-breadcrumb-current-${item.name}`}>
                        {item.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        onClick={() => navigateToFolder(item.path)}
                        className="cursor-pointer"
                        data-testid={`link-archive-breadcrumb-${item.name}`}
                      >
                        {item.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < array.length - 1 && <BreadcrumbSeparator />}
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* File/Folder List */}
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 max-h-96 overflow-y-auto" data-testid="archive-onedrive-browser">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-500 dark:text-gray-400">Caricamento...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {currentFiles?.filter(file => file.folder).map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedArchiveFolder?.id === folder.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedArchiveFolder(folder)}
                    onDoubleClick={() => {
                      if (folder.folder) {
                        const newPath = folder.parentPath === '/' ? `/${folder.name}` : `${folder.parentPath}/${folder.name}`;
                        navigateToFolder(newPath);
                      }
                    }}
                    data-testid={`archive-folder-item-${folder.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(folder)}
                      <div>
                        <div className="font-medium text-sm dark:text-white">{folder.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Cartella • {new Date(folder.lastModified).toLocaleDateString('it-IT')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedArchiveFolder?.id === folder.id && (
                        <Check className="w-4 h-4 text-blue-500" />
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
                {currentFiles?.filter(file => file.folder).length === 0 && (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p>Nessuna cartella trovata in questa posizione</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selection Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-2">
              {selectedArchiveFolder && (
                <span className="text-sm text-gray-600 dark:text-gray-400" data-testid="selected-archive-folder-info">
                  📁 Selezionata: {selectedArchiveFolder.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowArchiveBrowser(false);
                  setSelectedArchiveFolder(null);
                }}
                data-testid="button-cancel-archive-selection"
              >
                Annulla
              </Button>
              <Button
                onClick={handleConfirmArchiveSelection}
                disabled={!selectedArchiveFolder}
                data-testid="button-confirm-archive-selection"
              >
                {isConfiguringArchive ? "Configurando..." : "Conferma Selezione"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}