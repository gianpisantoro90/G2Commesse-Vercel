import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { Cloud, RefreshCw, Settings } from "lucide-react";

interface QuickActionsCardProps {
  onNewProject: () => void;
}

export default function QuickActionsCard({ onNewProject }: QuickActionsCardProps) {
  const { toast } = useToast();
  const { isConnected, syncAllProjects, isSyncingAll } = useOneDriveSync();

  const handleExportData = async () => {
    try {
      const response = await apiRequest("GET", "/api/export");
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `g2-commesse-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Esportazione completata",
        description: "I dati sono stati esportati con successo",
      });
    } catch (error) {
      toast({
        title: "Errore nell'esportazione",
        description: "Si è verificato un errore durante l'esportazione dei dati",
        variant: "destructive",
      });
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        await apiRequest("POST", "/api/import", data);
        
        toast({
          title: "Importazione completata",
          description: "I dati sono stati importati con successo",
        });
        
        // Refresh the page to show updated data
        window.location.reload();
      } catch (error) {
        toast({
          title: "Errore nell'importazione",
          description: "Si è verificato un errore durante l'importazione dei dati",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const handleOneDriveSync = async () => {
    if (!isConnected) {
      toast({
        title: "OneDrive non connesso",
        description: "Configura prima la connessione OneDrive",
        variant: "destructive",
      });
      return;
    }

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
    }
  };

  const navigateToOneDriveSettings = () => {
    // Navigate to OneDrive settings tab
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
  };

  return (
    <div className="card-g2" data-testid="quick-actions-card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Azioni Rapide</h3>
      <div className="space-y-3">
        <Button 
          className="button-g2-primary w-full"
          onClick={onNewProject}
          data-testid="button-new-project"
        >
          Nuova Commessa
        </Button>
        <Button 
          variant="outline"
          className="button-g2-secondary w-full"
          onClick={handleExportData}
          data-testid="button-export-data"
        >
          Esporta Dati (.json)
        </Button>
        <Button 
          variant="outline"
          className="w-full border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-colors duration-200"
          onClick={handleImportData}
          data-testid="button-import-data"
        >
          Importa Dati (.json)
        </Button>
        
        {/* OneDrive Actions */}
        <div className="border-t pt-3 mt-3">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            🌟 OneDrive
          </div>
          {isConnected ? (
            <Button
              variant="outline"
              className="w-full border-2 border-blue-300 text-blue-700 py-3 px-4 rounded-xl font-semibold hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200"
              onClick={handleOneDriveSync}
              disabled={isSyncingAll}
              data-testid="button-onedrive-sync"
            >
              {isSyncingAll ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizzazione...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizza Progetti
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full border-2 border-orange-300 text-orange-700 py-3 px-4 rounded-xl font-semibold hover:border-orange-400 hover:bg-orange-50 transition-colors duration-200"
              onClick={navigateToOneDriveSettings}
              data-testid="button-setup-onedrive"
            >
              <Cloud className="h-4 w-4 mr-2" />
              Configura OneDrive
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full text-sm text-gray-600 hover:text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200 mt-1"
            onClick={navigateToOneDriveSettings}
            data-testid="button-onedrive-settings"
          >
            <Settings className="h-3 w-3 mr-2" />
            Impostazioni OneDrive
          </Button>
        </div>
      </div>
    </div>
  );
}
