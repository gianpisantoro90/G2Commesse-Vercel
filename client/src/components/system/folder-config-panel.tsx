import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { useOneDriveRootConfig } from "@/hooks/use-onedrive-root-config";
import { FolderOpen, Check, AlertCircle, Settings, Folder, ChevronRight, RefreshCw, Home, Cloud } from "lucide-react";
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
    enabled: isConnected && showBrowser
  });


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
      return "border-green-200 bg-green-50";
    }
    return "border-gray-200 bg-gray-50";
  };

  // Show OneDrive connection requirement first
  if (!isConnected) {
    return (
      <div className="max-w-4xl" data-testid="folder-config-panel">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">☁️</span>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Configurazione Cartelle OneDrive</h3>
            <p className="text-gray-600">Configura la cartella radice OneDrive dove sono contenute tutte le commesse</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <Cloud className="w-12 h-12 mx-auto mb-3 text-yellow-600" />
          <h4 className="text-lg font-semibold text-yellow-800 mb-2">OneDrive Non Connesso</h4>
          <p className="text-yellow-700 mb-4">
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
          <h3 className="text-xl font-bold text-gray-900">Configurazione Cartelle OneDrive</h3>
          <p className="text-gray-600">Configura la cartella radice OneDrive dove sono contenute tutte le commesse G2</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Configuration */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Cartella Radice OneDrive
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Cartella Configurata
              </Label>
              <div className={`p-3 border-2 rounded-lg ${getStatusColor()}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="font-medium" data-testid="selected-folder">
                    {isLoadingConfig ? "Caricamento..." : (rootConfig?.folderName || "Nessuna cartella configurata")}
                  </span>
                </div>
                {rootConfig && (
                  <div className="text-sm mt-1 space-y-1">
                    <p className="text-gray-600" data-testid="folder-path">
                      📁 Percorso: {rootConfig.folderPath}
                    </p>
                    <p className="text-gray-500" data-testid="last-updated">
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

        {/* Information Panel */}
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">ℹ️ Come Funziona</h4>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <strong>1. Connetti OneDrive</strong> nelle impostazioni di sistema per accedere ai tuoi file cloud.
              </p>
              <p>
                <strong>2. Sfoglia e seleziona</strong> la cartella OneDrive dove vuoi organizzare le tue commesse G2.
              </p>
              <p>
                <strong>3. Il sistema creerà automaticamente</strong> la struttura delle cartelle per ogni nuovo progetto.
              </p>
              <p>
                <strong>4. L'AI instradamento</strong> sposterà i file direttamente nelle cartelle corrette su OneDrive.
              </p>
            </div>
          </div>

          {rootConfig && (
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">📊 Stato Configurazione</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Stato:</span>
                  <span className="font-medium text-green-600" data-testid="config-status">Configurata</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cartella:</span>
                  <span className="font-medium" data-testid="configured-folder">
                    {rootConfig.folderName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ID OneDrive:</span>
                  <span className="font-medium text-xs" data-testid="folder-id">
                    {rootConfig.folderId.substring(0, 12)}...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OneDrive Browser Modal */}
      {showBrowser && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">☁️ Browser OneDrive</h4>
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
          <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto" data-testid="onedrive-browser">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-500">Caricamento...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {currentFiles?.filter(file => file.folder).map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedFolder?.id === folder.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-white'
                    }`}
                    onClick={() => handleFolderSelect(folder)}
                    onDoubleClick={() => handleFolderNavigate(folder)}
                    data-testid={`folder-item-${folder.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(folder)}
                      <div>
                        <div className="font-medium text-sm">{folder.name}</div>
                        <div className="text-xs text-gray-500">
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
                  <div className="text-center py-6 text-gray-500">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>Nessuna cartella trovata in questa posizione</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selection Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              {selectedFolder && (
                <span className="text-sm text-gray-600" data-testid="selected-folder-info">
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
    </div>
  );
}