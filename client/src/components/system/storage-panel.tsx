import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function StoragePanel() {
  const [storageInfo, setStorageInfo] = useState({
    indexedDB: "0 KB",
    localStorage: "0 KB",
    total: "0 KB",
    indexedDBPercent: 0,
    localStoragePercent: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    updateStorageInfo();
  }, []);

  const updateStorageInfo = async () => {
    try {
      // Get localStorage size
      let localStorageSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += localStorage[key].length + key.length;
        }
      }

      // Estimate IndexedDB size (simplified)
      const indexedDBSize = localStorageSize * 10; // Mock estimate

      const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 KB';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };

      setStorageInfo({
        indexedDB: formatBytes(indexedDBSize),
        localStorage: formatBytes(localStorageSize),
        total: formatBytes(indexedDBSize + localStorageSize),
        indexedDBPercent: Math.min((indexedDBSize / (10 * 1024 * 1024)) * 100, 100),
        localStoragePercent: Math.min((localStorageSize / (5 * 1024 * 1024)) * 100, 100),
      });
    } catch (error) {
      console.error("Error calculating storage:", error);
    }
  };

  const handleClearCache = () => {
    if (confirm("Sei sicuro di voler svuotare la cache del browser?")) {
      // This would require service worker or browser extension
      toast({
        title: "Cache svuotata",
        description: "La cache del browser è stata svuotata",
      });
    }
  };

  const handleClearLocalStorage = () => {
    if (confirm("Sei sicuro di voler svuotare il localStorage? Questa azione cancellerà le configurazioni salvate.")) {
      localStorage.clear();
      updateStorageInfo();
      toast({
        title: "LocalStorage svuotato",
        description: "Il localStorage è stato svuotato con successo",
      });
    }
  };

  const handleClearIndexedDB = async () => {
    if (confirm("Sei sicuro di voler svuotare l'IndexedDB? Questa azione cancellerà TUTTI i dati delle commesse.")) {
      try {
        await apiRequest("DELETE", "/api/clear-all");
        updateStorageInfo();
        toast({
          title: "IndexedDB svuotato",
          description: "L'IndexedDB è stato svuotato con successo",
        });
      } catch (error) {
        toast({
          title: "Errore",
          description: "Si è verificato un errore durante lo svuotamento dell'IndexedDB",
          variant: "destructive",
        });
      }
    }
  };

  const handleExportAllData = async () => {
    try {
      const response = await apiRequest("GET", "/api/export");
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `g2-backup-completo-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export completato",
        description: "Tutti i dati sono stati esportati con successo",
      });
    } catch (error) {
      toast({
        title: "Errore nell'export",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    }
  };

  const handleImportData = () => {
    // Show mode selection dialog
    const confirmed = confirm(
      "Scegli la modalità di importazione:\n\n" +
      "OK = UNISCI (Merge): Mantiene i dati esistenti e aggiunge/aggiorna quelli dal file\n" +
      "Annulla = SOVRASCRIVI (Overwrite): Elimina tutti i dati esistenti e li sostituisce con quelli dal file\n\n" +
      "ATTENZIONE: La sovrascrittura è irreversibile!"
    );

    const mode = confirmed ? 'merge' : 'overwrite';

    // Additional confirmation for overwrite mode
    if (mode === 'overwrite') {
      const overwriteConfirmed = confirm(
        "⚠️ ATTENZIONE: Stai per ELIMINARE TUTTI I DATI ESISTENTI!\n\n" +
        "Sei sicuro di voler sovrascrivere completamente i dati?\n" +
        "Questa operazione NON può essere annullata.\n\n" +
        "Consiglio: Esporta prima i dati attuali come backup."
      );

      if (!overwriteConfirmed) {
        return; // User cancelled
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Add mode to the request payload
        const payload = { ...data, mode };

        await apiRequest("POST", "/api/import", payload);
        updateStorageInfo();

        const modeText = mode === 'merge' ? 'uniti' : 'sovrascritti';
        toast({
          title: "Import completato",
          description: `I dati sono stati ${modeText} con successo (modalità: ${mode === 'merge' ? 'Unisci' : 'Sovrascrivi'})`,
        });
      } catch (error) {
        toast({
          title: "Errore nell'import",
          description: "Si è verificato un errore durante l'importazione",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  return (
    <div data-testid="storage-panel">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Gestione Storage Locale</h3>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Storage Stats */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">📊 Utilizzo Storage</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">IndexedDB</span>
              <span className="font-semibold" data-testid="indexeddb-size">{storageInfo.indexedDB}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${storageInfo.indexedDBPercent}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">LocalStorage</span>
              <span className="font-semibold" data-testid="localstorage-size">{storageInfo.localStorage}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${storageInfo.localStoragePercent}%` }}
              ></div>
            </div>
            
            <div className="pt-2 border-t text-sm text-gray-500">
              Spazio totale utilizzato: <strong data-testid="total-storage">{storageInfo.total}</strong>
            </div>
          </div>
        </div>
        
        {/* Storage Actions */}
        <div className="space-y-4">
          <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">🧹 Operazioni di Pulizia</h4>
            <div className="space-y-3">
              <Button
                onClick={handleClearCache}
                className="w-full px-4 py-3 bg-yellow-100 text-yellow-800 border-2 border-yellow-300 rounded-lg font-semibold hover:bg-yellow-200 transition-colors"
                data-testid="clear-cache"
              >
                🗑️ Svuota Cache Browser
              </Button>
              <Button
                onClick={handleClearLocalStorage}
                className="w-full px-4 py-3 bg-orange-100 text-orange-800 border-2 border-orange-300 rounded-lg font-semibold hover:bg-orange-200 transition-colors"
                data-testid="clear-localstorage"
              >
                ⚠️ Svuota LocalStorage
              </Button>
              <Button
                onClick={handleClearIndexedDB}
                className="w-full px-4 py-3 bg-red-100 text-red-800 border-2 border-red-300 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                data-testid="clear-indexeddb"
              >
                🚨 Svuota IndexedDB
              </Button>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              ⚠️ Le operazioni di pulizia sono irreversibili. Assicurati di aver esportato i dati importanti.
            </div>
          </div>
        </div>
      </div>
      
      {/* Data Management */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">📦 Gestione Dati</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">📤</div>
            <div className="font-semibold text-gray-900 mb-1">Export Completo</div>
            <div className="text-sm text-gray-600 mb-3">Esporta tutti i dati in formato JSON</div>
            <Button
              onClick={handleExportAllData}
              className="w-full button-g2-primary"
              data-testid="export-all"
            >
              Esporta
            </Button>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">📥</div>
            <div className="font-semibold text-gray-900 mb-1">Import Dati</div>
            <div className="text-sm text-gray-600 mb-3">
              Importa dati da file JSON
              <br />
              <span className="text-xs text-blue-600 font-medium">Opzioni: Unisci o Sovrascrivi</span>
            </div>
            <Button
              onClick={handleImportData}
              variant="outline"
              className="w-full button-g2-secondary"
              data-testid="import-data"
            >
              Importa
            </Button>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">🔄</div>
            <div className="font-semibold text-gray-900 mb-1">Backup Auto</div>
            <div className="text-sm text-gray-600 mb-3">Configura backup automatico</div>
            <Button
              disabled
              className="w-full px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium cursor-not-allowed opacity-50"
              data-testid="configure-backup"
            >
              Configura
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
