import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Folder, CheckCircle, AlertCircle, Cloud, Users, RotateCw, Zap } from "lucide-react";
import oneDriveService, { OneDriveFile } from "@/lib/onedrive-service";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";

export default function OneDrivePanel() {
  const [userInfo, setUserInfo] = useState<{name: string; email: string} | null>(null);
  const [files, setFiles] = useState<OneDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const { toast } = useToast();
  
  // Use the sync hook
  const { 
    isConnected, 
    autoSyncEnabled, 
    toggleAutoSync,
    syncAllProjects,
    isSyncingAll,
    getOverallSyncStats
  } = useOneDriveSync();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const connected = await oneDriveService.testConnection();
      
      if (connected) {
        const user = await oneDriveService.getUserInfo();
        setUserInfo(user);
        await loadFiles();
      }
    } catch (error) {
      console.error('Connection check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const fileList = await oneDriveService.listFiles();
      setFiles(fileList);
    } catch (error) {
      console.error('Failed to load files:', error);
      toast({
        title: "Errore caricamento file",
        description: "Impossibile caricare i file da OneDrive",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = () => {
    toast({
      title: "Impostazioni salvate",
      description: "Le impostazioni OneDrive sono state salvate",
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProject) {
      toast({
        title: "Selezione mancante",
        description: "Selezionare un file e un progetto",
        variant: "destructive",
      });
      return;
    }

    setUploadingFile(file.name);
    try {
      const result = await oneDriveService.uploadFile(file, selectedProject);
      if (result) {
        toast({
          title: "File caricato",
          description: `File ${file.name} caricato con successo in OneDrive`,
        });
        await loadFiles();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Errore upload",
        description: "Impossibile caricare il file su OneDrive",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(null);
      event.target.value = '';
    }
  };

  const handleDownload = async (file: OneDriveFile) => {
    try {
      const blob = await oneDriveService.downloadFile(file.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download completato",
          description: `File ${file.name} scaricato con successo`,
        });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Errore download",
        description: "Impossibile scaricare il file da OneDrive",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            Testa Connessione
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

      {/* File Upload */}
      {isConnected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">📤 Upload Manuale</h4>
          
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Codice Progetto
              </Label>
              <Input
                type="text"
                placeholder="es. 25PARBAC01"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="input-g2"
                data-testid="input-project-code"
              />
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Seleziona File
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={!selectedProject || !!uploadingFile}
                  className="input-g2"
                  data-testid="input-file-upload"
                />
                {uploadingFile && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Caricando {uploadingFile}...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {isConnected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">📁 File in OneDrive</h4>
            <Button onClick={loadFiles} variant="outline" size="sm">
              <RotateCw className="w-4 h-4 mr-2" />
              Aggiorna
            </Button>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nessun file trovato nella cartella G2_Progetti</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {file.folder ? (
                      <Folder className="w-5 h-5 text-blue-500" />
                    ) : (
                      <div className="w-5 h-5 bg-gray-200 rounded"></div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{file.name}</div>
                      <div className="text-sm text-gray-500">
                        {!file.folder && `${formatFileSize(file.size)} • `}
                        {formatDate(file.lastModified)}
                      </div>
                    </div>
                  </div>
                  
                  {!file.folder && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleDownload(file)}
                        variant="outline"
                        size="sm"
                        data-testid={`button-download-${file.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => window.open(file.webUrl, '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        👁️
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 mb-1">OneDrive non configurato</h4>
              <p className="text-sm text-yellow-700">
                Per utilizzare l'integrazione OneDrive, assicurati che la connessione sia configurata correttamente nelle impostazioni del progetto.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}