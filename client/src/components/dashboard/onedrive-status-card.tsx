import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { useOneDriveRootConfig } from "@/hooks/use-onedrive-root-config";
import { useToast } from "@/hooks/use-toast";
import oneDriveService from "@/lib/onedrive-service";
import { useState } from "react";
import { Cloud, CloudOff, RefreshCw, Settings, User, AlertTriangle, CheckCircle, Clock, FolderOpen } from "lucide-react";

export default function OneDriveStatusCard() {
  const [isSyncingManually, setIsSyncingManually] = useState(false);
  const { toast } = useToast();
  const { 
    isConnected, 
    syncAllProjects, 
    isSyncingAll, 
    autoSyncEnabled, 
    getOverallSyncStats 
  } = useOneDriveSync();

  // Get user info when connected
  const { data: userInfo } = useQuery({
    queryKey: ['onedrive-user'],
    queryFn: () => oneDriveService.getUserInfo(),
    enabled: isConnected,
    refetchInterval: false // No polling - minimize compute units
  });

  // Get root folder configuration using the dedicated hook
  const { rootConfig } = useOneDriveRootConfig();

  // Get sync statistics
  const syncStats = getOverallSyncStats();

  const handleManualSync = async () => {
    setIsSyncingManually(true);
    try {
      await syncAllProjects();
      toast({
        title: "Sincronizzazione avviata",
        description: "La sincronizzazione di tutti i progetti è stata avviata",
      });
    } catch (error) {
      toast({
        title: "Errore sincronizzazione",
        description: "Impossibile avviare la sincronizzazione",
        variant: "destructive",
      });
    } finally {
      setIsSyncingManually(false);
    }
  };

  const getConnectionStatusIcon = () => {
    if (isSyncingAll || isSyncingManually) {
      return <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />;
    }
    if (isConnected) {
      return <Cloud className="h-5 w-5 text-green-600" />;
    }
    return <CloudOff className="h-5 w-5 text-red-600" />;
  };

  const getConnectionStatusBadge = () => {
    if (isSyncingAll || isSyncingManually) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          Sincronizzazione
        </Badge>
      );
    }
    if (isConnected) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Connesso
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-800">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Disconnesso
      </Badge>
    );
  };

  const getHealthIndicator = () => {
    if (!isConnected) return "Disconnesso";
    if (syncStats.errors > 0) return "Attenzione richiesta";
    if (syncStats.pending > 0) return "Sincronizzazione in corso";
    if (syncStats.synced === syncStats.total) return "Tutto sincronizzato";
    return "Configurazione incompleta";
  };

  const getHealthColor = () => {
    if (!isConnected) return "text-red-600";
    if (syncStats.errors > 0) return "text-yellow-600";
    if (syncStats.pending > 0) return "text-blue-600";
    if (syncStats.synced === syncStats.total && syncStats.total > 0) return "text-green-600";
    return "text-muted-foreground";
  };

  return (
    <div className="card-g2" data-testid="onedrive-status-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getConnectionStatusIcon()}
          <h3 className="text-lg font-semibold text-foreground">OneDrive Status</h3>
        </div>
        {getConnectionStatusBadge()}
      </div>

      {/* Connection Status and User Info */}
      <div className="space-y-4">
        {isConnected && userInfo ? (
          <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <User className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <div className="font-medium text-green-900 dark:text-green-100">{userInfo.name}</div>
              <div className="text-sm text-green-700 dark:text-green-300">{userInfo.email}</div>
            </div>
          </div>
        ) : !isConnected ? (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="flex items-center space-x-2 text-red-800 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">OneDrive non connesso</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              Configura la connessione OneDrive nelle impostazioni sistema
            </p>
          </div>
        ) : (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-2 text-foreground">
              <Clock className="h-4 w-4" />
              <span>Caricamento informazioni utente...</span>
            </div>
          </div>
        )}

        {/* Root Folder Configuration */}
        {isConnected && (
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            rootConfig?.folderPath 
              ? 'bg-blue-50 dark:bg-blue-950/30' 
              : 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400 dark:border-amber-600'
          }`}>
            <div className="flex items-center space-x-3">
              <FolderOpen className={`h-5 w-5 ${
                rootConfig?.folderPath ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
              }`} />
              <div className="flex-1">
                <div className={`font-medium ${
                  rootConfig?.folderPath ? 'text-blue-900 dark:text-blue-100' : 'text-amber-900 dark:text-amber-100'
                }`}>
                  Cartella Progetti
                </div>
                <div className={`text-sm font-mono ${
                  rootConfig?.folderPath ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {rootConfig?.folderPath || 'Non configurata'}
                </div>
              </div>
              {!rootConfig?.folderPath && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-100"
                  onClick={() => {
                    // Navigate to OneDrive configuration
                    const systemTab = document.querySelector('[data-testid="tab-sistema"]') as HTMLElement;
                    const oneDriveTab = document.querySelector('[data-testid="tab-onedrive"]') as HTMLElement;
                    
                    if (systemTab) {
                      systemTab.click();
                      setTimeout(() => {
                        if (oneDriveTab) {
                          oneDriveTab.click();
                        }
                      }, 100);
                    }
                  }}
                  data-testid="button-configure-root"
                >
                  Configura
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Sync Statistics */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary" data-testid="sync-stats-total">
                {syncStats.total}
              </div>
              <div className="text-sm text-muted-foreground">Progetti Totali</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="sync-stats-synced">
                {syncStats.synced}
              </div>
              <div className="text-sm text-muted-foreground">Sincronizzati</div>
            </div>
          </div>
        )}

        {/* Health Indicator */}
        <div className="p-3 border-l-4 border-border bg-muted">
          <div className={`font-medium ${getHealthColor()}`}>
            {getHealthIndicator()}
          </div>
          {syncStats.errors > 0 && (
            <div className="text-sm text-red-600 mt-1">
              {syncStats.errors} progett{syncStats.errors === 1 ? 'o' : 'i'} con errori
            </div>
          )}
          {syncStats.pending > 0 && (
            <div className="text-sm text-blue-600 mt-1">
              {syncStats.pending} progett{syncStats.pending === 1 ? 'o' : 'i'} in sincronizzazione
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleManualSync}
                disabled={isSyncingAll || isSyncingManually}
                data-testid="button-sync-now"
              >
                {(isSyncingAll || isSyncingManually) ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizzazione in corso...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizza Ora
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  // Navigate to OneDrive settings
                  const systemTab = document.querySelector('[data-testid="tab-sistema"]') as HTMLElement;
                  const oneDriveTab = document.querySelector('[data-testid="tab-onedrive"]') as HTMLElement;
                  
                  if (systemTab) {
                    systemTab.click();
                    setTimeout(() => {
                      if (oneDriveTab) {
                        oneDriveTab.click();
                      }
                    }, 100);
                  }
                }}
                data-testid="button-onedrive-settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                Impostazioni OneDrive
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Navigate to OneDrive configuration
                const systemTab = document.querySelector('[data-testid="tab-sistema"]') as HTMLElement;
                const oneDriveTab = document.querySelector('[data-testid="tab-onedrive"]') as HTMLElement;
                
                if (systemTab) {
                  systemTab.click();
                  setTimeout(() => {
                    if (oneDriveTab) {
                      oneDriveTab.click();
                    }
                  }, 100);
                }
              }}
              data-testid="button-setup-onedrive"
            >
              <Cloud className="h-4 w-4 mr-2" />
              Configura OneDrive
            </Button>
          )}
        </div>

        {/* Auto-sync status */}
        {isConnected && (
          <div className="text-xs text-muted-foreground text-center">
            Auto-sync: {autoSyncEnabled ? '✅ Attivo' : '❌ Disattivo'}
          </div>
        )}
      </div>
    </div>
  );
}