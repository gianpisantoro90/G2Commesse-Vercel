import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { isFileSystemAccessSupported } from "@/lib/file-system";
import { FolderOpen, Check, AlertCircle, Settings } from "lucide-react";

interface FolderConfigState {
  rootPath: string;
  rootHandle: FileSystemDirectoryHandle | null;
  isConfigured: boolean;
  lastVerified: string;
}

export default function FolderConfigPanel() {
  const [folderConfig, setFolderConfig] = useLocalStorage<FolderConfigState>("folder_config", {
    rootPath: "",
    rootHandle: null,
    isConfigured: false,
    lastVerified: "",
  });

  const [isSelecting, setIsSelecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"success" | "warning" | "error" | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const { toast } = useToast();

  // Non possiamo serializzare FileSystemDirectoryHandle nel localStorage,
  // quindi gestiamo lo stato separatamente
  const [currentHandle, setCurrentHandle] = useState<FileSystemDirectoryHandle | null>(null);

  useEffect(() => {
    // Verifica se c'è una configurazione esistente all'avvio
    if (folderConfig.isConfigured && folderConfig.rootPath) {
      setValidationStatus("warning");
      setValidationMessage("Cartella configurata. Clicca 'Verifica' per controllare l'accesso.");
    }
  }, [folderConfig]);

  const handleSelectRootFolder = async () => {
    if (!isFileSystemAccessSupported()) {
      toast({
        title: "Browser non supportato",
        description: "Il tuo browser non supporta l'accesso diretto alle cartelle. Usa Chrome, Edge o un browser compatibile.",
        variant: "destructive",
      });
      return;
    }

    setIsSelecting(true);
    try {
      // Usa l'API File System Access per selezionare la cartella radice
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // Salva la configurazione
      const newConfig = {
        rootPath: dirHandle.name,
        rootHandle: null, // Non possiamo serializzare questo
        isConfigured: true,
        lastVerified: new Date().toLocaleString("it-IT"),
      };

      setFolderConfig(newConfig);
      setCurrentHandle(dirHandle);
      setValidationStatus("success");
      setValidationMessage("Cartella radice configurata con successo!");

      toast({
        title: "Cartella configurata",
        description: `Cartella radice impostata: ${dirHandle.name}`,
      });

    } catch (error: any) {
      console.error('Error selecting folder:', error);
      if (error?.name !== 'AbortError') {
        toast({
          title: "Errore selezione cartella",
          description: "Non è stato possibile selezionare la cartella. Riprova.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSelecting(false);
    }
  };

  const handleVerifyFolder = async () => {
    if (!currentHandle && !folderConfig.isConfigured) {
      toast({
        title: "Nessuna cartella configurata",
        description: "Seleziona prima una cartella radice.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      let handle = currentHandle;
      
      // Se non abbiamo l'handle corrente, prova a richiedere l'accesso
      if (!handle) {
        handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents'
        });
        setCurrentHandle(handle);
      }

      // Verifica l'accesso leggendo il contenuto della cartella
      const entries = [];
      if (handle) {
        for await (const entry of (handle as any).values()) {
          entries.push(entry);
          if (entries.length > 10) break; // Limita per performance
        }
      }

      // Aggiorna la configurazione con la verifica
      const updatedConfig = {
        ...folderConfig,
        rootPath: handle?.name || '',
        lastVerified: new Date().toLocaleString("it-IT"),
        isConfigured: true,
      };

      setFolderConfig(updatedConfig);
      setValidationStatus("success");
      setValidationMessage(`Accesso verificato. Trovate ${entries.length} cartelle/file.`);

      toast({
        title: "Verifica completata",
        description: `Accesso alla cartella "${handle?.name}" verificato con successo.`,
      });

    } catch (error) {
      console.error('Error verifying folder:', error);
      setValidationStatus("error");
      setValidationMessage("Errore nell'accesso alla cartella. Seleziona nuovamente la cartella.");
      
      toast({
        title: "Errore verifica",
        description: "Non è possibile accedere alla cartella. Potrebbe essere necessario riselezionarla.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetConfig = () => {
    if (confirm("Sei sicuro di voler resettare la configurazione della cartella radice?")) {
      setFolderConfig({
        rootPath: "",
        rootHandle: null,
        isConfigured: false,
        lastVerified: "",
      });
      setCurrentHandle(null);
      setValidationStatus(null);
      setValidationMessage("");

      toast({
        title: "Configurazione resettata",
        description: "La configurazione della cartella radice è stata rimossa.",
      });
    }
  };

  const getStatusIcon = () => {
    switch (validationStatus) {
      case "success":
        return <Check className="w-5 h-5 text-green-600" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Settings className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (validationStatus) {
      case "success":
        return "border-green-200 bg-green-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      case "error":
        return "border-red-200 bg-red-50";
      default:
        return "border-gray-200 bg-gray-50";
    }
  };

  return (
    <div className="max-w-4xl" data-testid="folder-config-panel">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">📁</span>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Configurazione Cartelle</h3>
          <p className="text-gray-600">Configura la cartella radice dove sono contenute tutte le commesse</p>
        </div>
      </div>

      {!isFileSystemAccessSupported() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              <strong>Browser non supportato:</strong> Questa funzionalità richiede un browser moderno come Chrome, Edge o Firefox.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configurazione Cartella Radice */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Cartella Radice Commesse
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Cartella Selezionata
              </Label>
              <div className={`p-3 border-2 rounded-lg ${getStatusColor()}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="font-medium" data-testid="selected-folder">
                    {folderConfig.rootPath || "Nessuna cartella selezionata"}
                  </span>
                </div>
                {validationMessage && (
                  <p className="text-sm mt-1 text-gray-600" data-testid="validation-message">
                    {validationMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleSelectRootFolder}
                disabled={isSelecting || !isFileSystemAccessSupported()}
                className="w-full"
                data-testid="select-folder-button"
              >
                {isSelecting ? "Selezione in corso..." : "Seleziona Cartella Radice"}
              </Button>
              
              {folderConfig.isConfigured && (
                <Button
                  onClick={handleVerifyFolder}
                  disabled={isVerifying}
                  variant="outline"
                  className="w-full"
                  data-testid="verify-folder-button"
                >
                  {isVerifying ? "Verifica in corso..." : "Verifica Accesso"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Informazioni e Stato */}
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">ℹ️ Come Funziona</h4>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <strong>1. Seleziona la cartella radice</strong> dove sono contenute tutte le tue commesse.
              </p>
              <p>
                <strong>2. Il sistema automaticamente</strong> riconoscerà le sottocartelle come commesse esistenti.
              </p>
              <p>
                <strong>3. Nell'auto-routing</strong> non dovrai più selezionare manualmente la cartella della commessa.
              </p>
              <p>
                <strong>4. I file verranno instradati</strong> direttamente nella cartella corretta basandosi sul codice progetto.
              </p>
            </div>
          </div>

          {folderConfig.isConfigured && (
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">📊 Stato Configurazione</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Stato:</span>
                  <span className="font-medium text-green-600" data-testid="config-status">Configurata</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ultima verifica:</span>
                  <span className="font-medium" data-testid="last-verified">
                    {folderConfig.lastVerified || "Mai"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cartella:</span>
                  <span className="font-medium" data-testid="configured-path">
                    {folderConfig.rootPath}
                  </span>
                </div>
              </div>
              
              <Button
                onClick={handleResetConfig}
                variant="destructive"
                size="sm"
                className="w-full mt-4"
                data-testid="reset-config-button"
              >
                Reset Configurazione
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}