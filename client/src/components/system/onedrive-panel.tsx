import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Cloud, Users, RotateCw, Zap } from "lucide-react";
import oneDriveService from "@/lib/onedrive-service";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { useOneDriveRootConfig } from "@/hooks/use-onedrive-root-config";

export default function OneDrivePanel() {
  const [userInfo, setUserInfo] = useState<{name: string; email: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Use the sync hook (fixed: removed duplicate connection testing)
  const {
    isConnected,
    autoSyncEnabled,
    toggleAutoSync,
    syncAllProjects,
    isSyncingAll,
    getOverallSyncStats
  } = useOneDriveSync();

  // Get OneDrive root folder configuration
  const { rootConfig, isConfigured } = useOneDriveRootConfig();

  // Load user info when connected
  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      if (isConnected && !userInfo && mounted) {
        try {
          const user = await oneDriveService.getUserInfo();
          if (mounted) {
            setUserInfo(user);
          }
        } catch (error) {
          console.error('Failed to load user info:', error);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [isConnected, userInfo]);

  const loadUserInfo = async () => {
    try {
      const user = await oneDriveService.getUserInfo();
      setUserInfo(user);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const connected = await oneDriveService.testConnection();
      
      if (connected) {
        await loadUserInfo();
      }
    } catch (error) {
      console.error('Connection check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = () => {
    toast({
      title: "Impostazioni salvate",
      description: "Le impostazioni OneDrive sono state salvate",
    });
  };

  const handleSetupOneDrive = async () => {
    try {
      // Trigger OneDrive integration setup through API
      const response = await fetch('/api/integration/setup-onedrive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.alreadyConfigured) {
          toast({
            title: "OneDrive già configurato",
            description: "OneDrive è già connesso e funzionante!",
          });
          await checkConnection();
        } else if (data.instructions) {
          // Show setup instructions
          const instructions = data.instructions;
          const instructionsText = instructions.steps.join('\n');
          
          toast({
            title: instructions.title,
            description: `${instructions.note}\n\nPassaggi:\n${instructionsText}`,
            duration: 10000, // Show for longer
          });

          // Open settings page if URL is available
          if (instructions.setupUrl) {
            const openSettings = confirm(
              `Per configurare OneDrive:\n\n${instructions.steps.join('\n')}\n\nVuoi aprire le impostazioni del progetto ora?`
            );
            
            if (openSettings) {
              window.open(instructions.setupUrl, '_blank');
            }
          }
        }
      } else {
        throw new Error('Setup failed');
      }
    } catch (error) {
      console.error('OneDrive setup failed:', error);
      toast({
        title: "Errore configurazione",
        description: "Impossibile avviare la configurazione OneDrive. Riprova più tardi.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl" data-testid="onedrive-panel">
      <h3 className="text-2xl font-bold text-foreground mb-6">☁️ Integrazione OneDrive</h3>
      
      {/* Connection Status */}
      <div className="bg-background rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {isConnected ? <Cloud className="w-5 h-5 text-green-600 dark:text-green-400" /> : <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-foreground">Stato Connessione</h4>
              <p className="text-sm text-muted-foreground">
                {isConnected ? (
                  <>✅ Connesso a OneDrive</>
                ) : (
                  <>❌ Non connesso a OneDrive</>
                )}
              </p>
            </div>
          </div>
          <Button
            onClick={checkConnection}
            disabled={isLoading}
            variant="outline"
            data-testid="button-test-connection"
          >
            {isLoading ? <RotateCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Ricarica Dati
          </Button>
        </div>

        {userInfo && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <Users className="w-4 h-4" />
              <span className="font-medium">{userInfo.name}</span>
              <span className="text-blue-600 dark:text-blue-400">• {userInfo.email}</span>
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-background rounded-xl border border-border p-6 mb-6">
        <h4 className="text-lg font-semibold text-foreground mb-4">⚙️ Mappatura Cartelle OneDrive</h4>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 La funzione "Mappa Tutti i Progetti" cerca cartelle OneDrive esistenti che corrispondono ai codici progetto
              {isConfigured && rootConfig && (
                <> nella cartella radice <strong>{rootConfig.folderPath}</strong></>
              )}.
              <strong> Non vengono create nuove cartelle</strong>. Per creare cartelle, utilizza il pulsante "Crea Commessa OneDrive" nella vista progetti.
            </p>
            {!isConfigured && (
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
                ⚠️ Attenzione: configura prima la cartella radice OneDrive nelle impostazioni cartelle.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">Sincronizzazione Automatica</div>
              <div className="text-sm text-muted-foreground">Mappa automaticamente progetti a cartelle OneDrive esistenti</div>
            </div>
            <Switch
              checked={autoSyncEnabled}
              onCheckedChange={toggleAutoSync}
              data-testid="switch-auto-sync"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button onClick={handleSaveSettings} className="button-g2-primary">
            💾 Salva Impostazioni
          </Button>
          <Button
            onClick={syncAllProjects}
            disabled={!isConnected || isSyncingAll}
            variant="outline"
            title="Cerca e mappa cartelle OneDrive esistenti ai progetti (non crea nuove cartelle)"
          >
            {isSyncingAll ? (
              <>
                <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                Mappando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Mappa Tutti i Progetti
              </>
            )}
          </Button>
        </div>

        {/* Sync Statistics */}
        {isConnected && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">📊 Stato Mappatura</div>
            {(() => {
              const stats = getOverallSyncStats();
              return (
                <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <div>✅ Mappati: {stats.synced}/{stats.total}</div>
                  {stats.pending > 0 && <div>🔄 In corso: {stats.pending}</div>}
                  {stats.errors > 0 && <div>❌ Errori: {stats.errors}</div>}
                  {stats.notSynced > 0 && <div>📁 Nessuna cartella trovata: {stats.notSynced}</div>}
                </div>
              );
            })()}
          </div>
        )}
      </div>


      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Configura Accesso OneDrive</h4>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                Per utilizzare l'integrazione OneDrive per gestire i tuoi progetti, devi prima configurare l'accesso al tuo account Microsoft.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleSetupOneDrive}
                  className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
                  data-testid="button-setup-onedrive"
                >
                  🔑 Configura OneDrive
                </Button>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  ✨ La configurazione è semplice e sicura: ti verrà richiesto di autorizzare l'accesso al tuo account Microsoft OneDrive.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}