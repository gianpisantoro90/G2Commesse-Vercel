import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { useOneDriveRootConfig } from "@/hooks/use-onedrive-root-config";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Cloud, CloudOff, RefreshCw, Settings, AlertTriangle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function OneDriveStatusCard() {
  const [isSyncingManually, setIsSyncingManually] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const {
    isConnected,
    syncAllProjects,
    isSyncingAll,
    autoSyncEnabled,
    getOverallSyncStats
  } = useOneDriveSync();

  const { rootConfig } = useOneDriveRootConfig();
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

  const isSyncing = isSyncingAll || isSyncingManually;

  return (
    <div className="card-g2" data-testid="onedrive-status-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: status info */}
        <div className="flex items-center gap-3 min-w-0">
          {isSyncing ? (
            <RefreshCw className="h-5 w-5 animate-spin text-teal-600 shrink-0" />
          ) : isConnected ? (
            <Cloud className="h-5 w-5 text-green-600 shrink-0" />
          ) : (
            <CloudOff className="h-5 w-5 text-red-600 shrink-0" />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">OneDrive</h3>
              {isSyncing ? (
                <Badge variant="secondary" className="bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200 text-[10px] px-1.5 py-0">
                  Sincronizzazione...
                </Badge>
              ) : isConnected ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 text-[10px] px-1.5 py-0">
                  <CheckCircle className="h-2.5 w-2.5 mr-1" />
                  Connesso
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                  Disconnesso
                </Badge>
              )}
            </div>

            {isConnected && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{syncStats.synced}/{syncStats.total} sincronizzati</span>
                {syncStats.errors > 0 && (
                  <span className="text-red-600">{syncStats.errors} errori</span>
                )}
                {rootConfig?.folderPath && (
                  <span className="font-mono truncate max-w-[200px]">{rootConfig.folderPath}</span>
                )}
                {autoSyncEnabled && <span className="text-green-600">Auto-sync attivo</span>}
              </div>
            )}

            {!isConnected && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Configura la connessione per sincronizzare i progetti
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing}
                data-testid="button-sync-now"
                className="h-8 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizza
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/sistema/onedrive-config")}
                data-testid="button-onedrive-settings"
                className="h-8 text-xs"
              >
                <Settings className="h-3 w-3 mr-1.5" />
                Impostazioni
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sistema/onedrive-config")}
              data-testid="button-setup-onedrive"
              className="h-8 text-xs"
            >
              <Cloud className="h-3 w-3 mr-1.5" />
              Configura
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
