import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Cloud, Users, RotateCw, Zap } from "lucide-react";
import oneDriveService from "@/lib/onedrive-service";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";

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

  // Load user info when connected
  useEffect(() => {
    if (isConnected && !userInfo) {
      loadUserInfo();
    }
  }, [isConnected]);

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
        }
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
      <h3 className="text-2xl font-bold text-gray-900 mb-6">☁️ Integrazione OneDrive</h3>
      
      {/* Connection Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
              {isConnected ? <Cloud className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Stato Connessione</h4>
              <p className="text-sm text-gray-600">
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
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Users className="w-4 h-4" />
              <span className="font-medium">{userInfo.name}</span>
              <span className="text-blue-600">• {userInfo.email}</span>
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Impostazioni Sincronizzazione</h4>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Sincronizzazione Automatica</div>
              <div className="text-sm text-gray-600">Sincronizza automaticamente nuovi progetti con OneDrive</div>
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
          >
            {isSyncingAll ? (
              <>
                <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                Sincronizzando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Sincronizza Tutti
              </>
            )}
          </Button>
        </div>

        {/* Sync Statistics */}
        {isConnected && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm font-medium text-blue-900 mb-2">📊 Stato Sincronizzazione</div>
            {(() => {
              const stats = getOverallSyncStats();
              return (
                <div className="text-xs text-blue-700 space-y-1">
                  <div>✅ Sincronizzati: {stats.synced}/{stats.total}</div>
                  {stats.pending > 0 && <div>🔄 In corso: {stats.pending}</div>}
                  {stats.errors > 0 && <div>❌ Errori: {stats.errors}</div>}
                  {stats.notSynced > 0 && <div>⏳ Da sincronizzare: {stats.notSynced}</div>}
                </div>
              );
            })()}
          </div>
        )}
      </div>


      {!isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-800 mb-2">Configura Accesso OneDrive</h4>
              <p className="text-sm text-blue-700 mb-4">
                Per utilizzare l'integrazione OneDrive per gestire i tuoi progetti, devi prima configurare l'accesso al tuo account Microsoft.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleSetupOneDrive}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-setup-onedrive"
                >
                  🔑 Configura OneDrive
                </Button>
                <div className="text-xs text-blue-600">
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