import { useEffect, useState } from "react";

export default function SystemInfoCard() {
  const [hasFileSystemApi, setHasFileSystemApi] = useState(false);
  const [hasIndexedDb, setHasIndexedDb] = useState(false);

  useEffect(() => {
    // Check for File System Access API
    setHasFileSystemApi('showDirectoryPicker' in window);
    
    // Check for IndexedDB
    setHasIndexedDb('indexedDB' in window);
  }, []);

  return (
    <div className="card-g2" data-testid="system-info-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Informazioni Sistema</h3>
      <div className="space-y-4">
        <div className={`flex items-center gap-3 p-3 rounded-lg ${hasFileSystemApi ? 'bg-green-50 dark:bg-green-950/30' : 'bg-yellow-50 dark:bg-yellow-950/30'}`}>
          <span className={`w-2 h-2 rounded-full ${hasFileSystemApi ? 'bg-g2-success' : 'bg-g2-warning'}`}></span>
          <span className="text-sm font-medium text-foreground">
            {hasFileSystemApi ? 'File System API Supportata' : 'File System API Non Disponibile'}
          </span>
        </div>
        <div className={`flex items-center gap-3 p-3 rounded-lg ${hasIndexedDb ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
          <span className={`w-2 h-2 rounded-full ${hasIndexedDb ? 'bg-blue-500' : 'bg-red-500'}`}></span>
          <span className="text-sm font-medium text-foreground">
            {hasIndexedDb ? 'IndexedDB Attivo' : 'IndexedDB Non Disponibile'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          ⚠️ Richiede Chrome/Edge 86+ o HTTPS per funzionalità complete
        </div>
      </div>
    </div>
  );
}
