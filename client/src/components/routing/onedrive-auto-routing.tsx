import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FolderOpen, 
  RefreshCw, 
  Brain, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Upload, 
  FolderSearch,
  Cloud,
  ArrowRight,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { type Project } from "@shared/schema";
import { aiRouter, type RoutingResult } from "@/lib/ai-router";
import oneDriveService, { type OneDriveFile } from "@/lib/onedrive-service";

interface ScannedFile extends OneDriveFile {
  mimeType?: string;
  parentFolderId?: string;
  path?: string;
}

interface RoutingResultWithFile {
  file: ScannedFile;
  suggestedPath: string;
  confidence: number;
  reasoning?: string;
  alternatives?: string[];
}

interface OneDriveAutoRoutingProps {
  onRoutingComplete?: (results: RoutingResultWithFile[]) => void;
}

export default function OneDriveAutoRouting({ onRoutingComplete }: OneDriveAutoRoutingProps) {
  // State management
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [scanPath, setScanPath] = useState<string>("");
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<ScannedFile[]>([]);
  const [routingResults, setRoutingResults] = useState<RoutingResultWithFile[]>([]);
  const [activeTab, setActiveTab] = useState("scan");
  
  // Loading states
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected } = useOneDriveSync();

  // Helper function to get OneDrive mapping for a project
  const getOneDriveMapping = (projectCode: string) => {
    return oneDriveMappings.find((mapping: any) => mapping.projectCode === projectCode);
  };

  // Get projects for selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Get OneDrive mappings
  const { data: oneDriveMappings = [] } = useQuery({
    queryKey: ["/api/onedrive/mappings"],
    queryFn: async () => {
      const response = await fetch('/api/onedrive/mappings');
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
  });

  // Get OneDrive root folder configuration
  const { data: rootConfig } = useQuery({
    queryKey: ['onedrive-root-folder'],
    queryFn: async () => {
      const response = await fetch('/api/onedrive/root-folder');
      if (response.ok) {
        const data = await response.json();
        return data.config || data;
      }
      return null;
    },
    enabled: isConnected
  });

  // Mutation for scanning files
  const scanFilesMutation = useMutation({
    mutationFn: async ({ folderPath, projectCode, includeSubfolders }: {
      folderPath: string;
      projectCode?: string;
      includeSubfolders: boolean;
    }) => {
      const response = await fetch('/api/onedrive/scan-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, projectCode, includeSubfolders })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to scan OneDrive files');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const files = data.files || [];
      const fileList = files.filter((file: ScannedFile) => !file.folder);
      setScannedFiles(fileList);
      setSelectedFiles([]);
      setRoutingResults([]);
      setActiveTab("select");
      
      toast({
        title: "Scansione completata",
        description: `Trovati ${fileList.length} file in ${scanPath}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore scansione",
        description: error.message || "Impossibile scansionare la cartella OneDrive",
        variant: "destructive",
      });
    }
  });

  // Mutation for moving files
  const moveFileMutation = useMutation({
    mutationFn: async ({ fileId, targetPath, fileName }: {
      fileId: string;
      targetPath: string;
      fileName: string;
    }) => {
      const response = await fetch('/api/onedrive/move-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId, 
          targetPath: targetPath,
          fileName 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to move ${fileName}`);
      }
      return response.json();
    }
  });

  // Handle folder scanning
  const handleScanFolder = async () => {
    // Check if we should use root path or project mapping
    const useRootPath = scanPath === (rootConfig?.folderPath || '/G2_Progetti');
    
    if (useRootPath) {
      // Using root folder - require folder path
      if (!scanPath.trim()) {
        toast({
          title: "Errore",
          description: "Inserire un percorso di cartella OneDrive",
          variant: "destructive",
        });
        return;
      }
      console.log('🔍 Scanning using root path:', scanPath);
    } else {
      // Using project mapping - require selected project
      if (!selectedProject) {
        toast({
          title: "Errore",
          description: "Selezionare un progetto o usare la cartella radice",
          variant: "destructive",
        });
        return;
      }
      console.log('🔍 Scanning using project mapping for:', selectedProject);
    }

    setIsScanning(true);
    try {
      // Get project code for backend (backend expects project.code, not project.id)
      const projectCode = useRootPath ? undefined : projects.find(p => p.id === selectedProject)?.code;
      
      await scanFilesMutation.mutateAsync({
        folderPath: useRootPath ? scanPath : '',
        projectCode: projectCode || '',
        includeSubfolders
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (file: ScannedFile, selected: boolean) => {
    if (selected) {
      setSelectedFiles(prev => [...prev, file]);
    } else {
      setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
    }
  };

  // Handle select all files
  const handleSelectAll = () => {
    setSelectedFiles(scannedFiles);
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedFiles([]);
  };

  // Handle AI analysis
  const handleAnalyzeFiles = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un file per l'analisi",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProject) {
      toast({
        title: "Errore",
        description: "Seleziona un progetto per l'analisi AI",
        variant: "destructive",
      });
      return;
    }

    const project = projects.find(p => p.id === selectedProject);
    if (!project) {
      toast({
        title: "Errore",
        description: "Progetto non trovato",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    const results: RoutingResultWithFile[] = [];

    try {
      toast({
        title: "Analisi AI in corso",
        description: `Analizzando ${selectedFiles.length} file con AI...`,
      });

      for (const oneDriveFile of selectedFiles) {
        try {
          // Create fake File object for AI analysis (no need to download the actual content)
          const fakeFile = new File([''], oneDriveFile.name, { 
            type: oneDriveFile.mimeType || 'application/octet-stream' 
          });

          // Analyze with AI router (AI only needs filename and metadata, not file content)
          const routingResult = await aiRouter.routeFile(fakeFile, project.template, project.id);

          results.push({
            file: oneDriveFile,
            suggestedPath: routingResult.suggestedPath,
            confidence: routingResult.confidence,
            reasoning: routingResult.reasoning,
            alternatives: routingResult.alternatives
          });

          console.log(`✅ Analyzed ${oneDriveFile.name}: ${routingResult.suggestedPath} (${Math.round(routingResult.confidence * 100)}%)`);
        } catch (error) {
          console.error(`❌ Failed to analyze ${oneDriveFile.name}:`, error);
          results.push({
            file: oneDriveFile,
            suggestedPath: 'MATERIALE_RICEVUTO/',
            confidence: 0.5,
            reasoning: `Errore nell'analisi: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      setRoutingResults(results);
      setActiveTab("results");
      onRoutingComplete?.(results);

      toast({
        title: "Analisi completata",
        description: `${results.length} file analizzati con AI`,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Errore analisi",
        description: "Impossibile completare l'analisi AI",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle moving files to suggested paths
  const handleMoveFiles = async () => {
    if (routingResults.length === 0) return;

    const project = projects.find(p => p.id === selectedProject);
    if (!project) {
      toast({
        title: "Errore",
        description: "Progetto non trovato",
        variant: "destructive",
      });
      return;
    }

    setIsMoving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const result of routingResults) {
        try {
          // Get the OneDrive mapping for the project to get the complete folder path
          const oneDriveMapping = getOneDriveMapping(project.code);
          if (!oneDriveMapping) {
            throw new Error(`Mapping OneDrive non trovato per il progetto ${project.code}`);
          }
          
          // Build target path using the complete project folder path: {projectFolderPath}/{suggestedPath}
          const targetPath = `${oneDriveMapping.oneDriveFolderPath}/${result.suggestedPath}`;
          
          await moveFileMutation.mutateAsync({
            fileId: result.file.driveItemId,
            targetPath: targetPath,
            fileName: result.file.name
          });
          
          successCount++;
          console.log(`✅ Moved ${result.file.name} to ${targetPath}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to move ${result.file.name}:`, error);
        }
      }

      if (successCount > 0) {
        toast({
          title: "File spostati",
          description: `${successCount} file spostati con successo${errorCount > 0 ? `, ${errorCount} errori` : ''}`,
        });
      }

      if (errorCount > 0 && successCount === 0) {
        toast({
          title: "Errore spostamento",
          description: `Impossibile spostare ${errorCount} file`,
          variant: "destructive",
        });
      }

      // Refresh and reset
      if (successCount > 0) {
        setScannedFiles([]);
        setSelectedFiles([]);
        setRoutingResults([]);
        setActiveTab("scan");
        queryClient.invalidateQueries({ queryKey: ['onedrive-files'] });
      }
    } finally {
      setIsMoving(false);
    }
  };

  // Get confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (percentage >= 80) return "bg-green-100 text-green-800";
    if (percentage >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  // Check if system is ready
  const isReady = isConnected && rootConfig;

  if (!isConnected) {
    return (
      <div className="card-g2" data-testid="onedrive-auto-routing">
        <div className="text-center py-8 text-gray-500">
          <Cloud className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">OneDrive Non Connesso</h3>
          <p>Configura OneDrive nelle impostazioni per utilizzare l'auto-routing AI</p>
        </div>
      </div>
    );
  }

  if (!rootConfig) {
    return (
      <div className="card-g2" data-testid="onedrive-auto-routing">
        <div className="text-center py-8 text-gray-500">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Cartella Radice Non Configurata</h3>
          <p>Configura la cartella radice OneDrive in Sistema → Cartelle</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-g2" data-testid="onedrive-auto-routing">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">☁️</span>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Auto-Routing OneDrive AI</h2>
          <p className="text-gray-600">Sistema intelligente per classificazione automatica file OneDrive</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scan" className="flex items-center gap-2" data-testid="tab-scan">
            <FolderSearch className="w-4 h-4" />
            1. Scansiona Cartella
          </TabsTrigger>
          <TabsTrigger value="select" className="flex items-center gap-2" data-testid="tab-select">
            <CheckCircle className="w-4 h-4" />
            2. Seleziona File
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2" data-testid="tab-results">
            <Brain className="w-4 h-4" />
            3. Routing AI
          </TabsTrigger>
        </TabsList>

        {/* Step 1: Scan Folder */}
        <TabsContent value="scan" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-semibold text-gray-700 mb-2">
                  Progetto di Riferimento
                </Label>
                <Select value={selectedProject} onValueChange={setSelectedProject} data-testid="select-project">
                  <SelectTrigger className="input-g2">
                    <SelectValue placeholder="Seleziona progetto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.object}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="block text-sm font-semibold text-gray-700 mb-2">
                  Percorso Cartella OneDrive
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={scanPath}
                    onChange={(e) => setScanPath(e.target.value)}
                    placeholder="/G2_Progetti/25ABC123"
                    className="input-g2"
                    data-testid="input-scan-path"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setScanPath(rootConfig?.folderPath || '/G2_Progetti')}
                    data-testid="button-use-root"
                  >
                    Usa Radice
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Cartella radice: {rootConfig?.folderPath || 'Non configurata'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeSubfolders"
                  checked={includeSubfolders}
                  onChange={(e) => setIncludeSubfolders(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-subfolders"
                />
                <Label htmlFor="includeSubfolders" className="text-sm">
                  Includi sottocartelle
                </Label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Come Funziona</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <p>1. <strong>Seleziona un progetto</strong> per contestualizzare l'analisi AI</p>
                <p>2. <strong>Inserisci il percorso</strong> della cartella OneDrive da scansionare</p>
                <p>3. <strong>Avvia la scansione</strong> per trovare tutti i file nella cartella</p>
                <p>4. <strong>L'AI analizzerà</strong> i file e suggerirà dove spostarli</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleScanFolder}
              disabled={!scanPath.trim() || isScanning}
              className="button-g2-primary"
              data-testid="button-scan-folder"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Scansionando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Scansiona Cartella
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Step 2: Select Files */}
        <TabsContent value="select" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              File Trovati ({scannedFiles.length})
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={scannedFiles.length === 0}
                data-testid="button-select-all"
              >
                Seleziona Tutti
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedFiles.length === 0}
                data-testid="button-clear-selection"
              >
                Deseleziona
              </Button>
            </div>
          </div>

          {scannedFiles.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scannedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFiles.some(f => f.id === file.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFileSelect(file, !selectedFiles.some(f => f.id === file.id))}
                  data-testid={`file-item-${file.id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="font-medium text-gray-900">{file.name}</div>
                      <div className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB • {new Date(file.lastModified).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                  </div>
                  {selectedFiles.some(f => f.id === file.id) && (
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nessun file trovato. Esegui prima una scansione.</p>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="flex justify-center">
              <Button
                onClick={handleAnalyzeFiles}
                disabled={isAnalyzing || !selectedProject}
                className="button-g2-primary"
                data-testid="button-analyze-files"
              >
                {isAnalyzing ? (
                  <>
                    <Brain className="w-4 h-4 mr-2 animate-pulse" />
                    Analizzando {selectedFiles.length} file...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Analizza {selectedFiles.length} File con AI
                  </>
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Step 3: Routing Results */}
        <TabsContent value="results" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Risultati Routing AI ({routingResults.length})
            </h3>
            {routingResults.length > 0 && (
              <Button
                onClick={handleMoveFiles}
                disabled={isMoving}
                className="button-g2-primary"
                data-testid="button-move-files"
              >
                {isMoving ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-pulse" />
                    Spostando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Sposta Tutti i File
                  </>
                )}
              </Button>
            )}
          </div>

          {routingResults.length > 0 ? (
            <div className="space-y-4">
              {routingResults.map((result, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-gray-900">{result.file.name}</div>
                    <Badge className={getConfidenceBadge(result.confidence)}>
                      {Math.round(result.confidence * 100)}% confidenza
                    </Badge>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <span>{result.file.path || result.file.parentPath}</span>
                    <ArrowRight className="w-4 h-4 mx-2" />
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                      {result.suggestedPath}
                    </span>
                  </div>
                  
                  {result.reasoning && (
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
                      {result.reasoning}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nessun risultato. Esegui prima l'analisi AI.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}