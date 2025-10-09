import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  Search,
  Download
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
  driveItemId?: string;
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
  const [mode, setMode] = useState<"onedrive" | "upload">("onedrive"); // New mode toggle
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [scanPath, setScanPath] = useState<string>("");
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<ScannedFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]); // New state for uploaded files
  const [routingResults, setRoutingResults] = useState<RoutingResultWithFile[]>([]);
  const [activeTab, setActiveTab] = useState("scan");
  
  // Loading states
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state for upload loading
  
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

  // Auto-set scan path when project is selected
  useEffect(() => {
    if (selectedProject && projects.length > 0) {
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        const mapping = getOneDriveMapping(project.code);
        if (mapping) {
          // Use the OneDrive folder path from the mapping
          setScanPath(mapping.oneDriveFolderPath);
          console.log(`🎯 Auto-selected OneDrive path for ${project.code}: ${mapping.oneDriveFolderPath}`);
        } else {
          // No mapping found, use root path + project code as fallback
          const fallbackPath = `${rootConfig?.folderPath || '/LAVORO_CORRENTE'}/${project.code}`;
          setScanPath(fallbackPath);
          console.log(`⚠️ No OneDrive mapping found for ${project.code}, using fallback: ${fallbackPath}`);
        }
      }
    } else {
      // No project selected, clear scan path
      setScanPath("");
    }
  }, [selectedProject, projects, oneDriveMappings, rootConfig]);

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
    // Validate inputs
    if (!selectedProject) {
      toast({
        title: "Errore",
        description: "Selezionare un progetto per la scansione",
        variant: "destructive",
      });
      return;
    }

    if (!scanPath.trim()) {
      toast({
        title: "Errore",
        description: "Percorso cartella OneDrive non disponibile",
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

    setIsScanning(true);
    try {
      // Check if project has OneDrive mapping
      const oneDriveMapping = getOneDriveMapping(project.code);
      
      if (oneDriveMapping) {
        // Project has mapping - use backend mapping logic
        console.log('🔍 Scanning using OneDrive mapping for project:', project.code);
        await scanFilesMutation.mutateAsync({
          folderPath: '', // Empty to signal backend to use mapping
          projectCode: project.code,
          includeSubfolders
        });
      } else {
        // Project has no mapping - use fallback folder path
        console.log('🔍 Scanning using fallback path for project:', project.code, '→', scanPath);
        await scanFilesMutation.mutateAsync({
          folderPath: scanPath, // Use the fallback path calculated by frontend
          projectCode: project.code,
          includeSubfolders
        });
      }
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

  // Handle file upload (for upload mode)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploadedFiles(files);
      
      // Convert uploaded files to ScannedFile format for unified handling
      const convertedFiles: ScannedFile[] = files.map((file, index) => ({
        id: `uploaded-${index}-${Date.now()}`,
        name: file.name,
        size: file.size,
        webUrl: '',
        downloadUrl: '', // Not applicable for uploaded files
        driveItemId: `temp-${index}`,
        parentPath: '',
        folder: false,
        mimeType: file.type,
        lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
        originalFile: file // Store original File object for analysis
      } as ScannedFile & { originalFile: File }));
      
      setScannedFiles(convertedFiles);
      setSelectedFiles([]);
      setRoutingResults([]);
      setActiveTab("select");
      
      toast({
        title: "File caricati",
        description: `${files.length} file pronti per l'analisi`,
      });
    }
  };

  // Handle mode change
  const handleModeChange = (newMode: "onedrive" | "upload") => {
    setMode(newMode);
    // Reset state when changing modes
    setScannedFiles([]);
    setSelectedFiles([]);
    setUploadedFiles([]);
    setRoutingResults([]);
    setActiveTab("scan");
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

      for (const selectedFile of selectedFiles) {
        try {
          let fileForAnalysis: File;
          
          if (mode === "upload" && (selectedFile as any).originalFile) {
            // Use original uploaded file for analysis
            fileForAnalysis = (selectedFile as any).originalFile;
          } else {
            // Create fake File object for OneDrive files (AI only needs filename and metadata)
            fileForAnalysis = new File([''], selectedFile.name, { 
              type: selectedFile.mimeType || 'application/octet-stream' 
            });
          }

          // Analyze with AI router
          const routingResult = await aiRouter.routeFile(fileForAnalysis, project.template, project.id);

          results.push({
            file: selectedFile,
            suggestedPath: routingResult.suggestedPath,
            confidence: routingResult.confidence,
            reasoning: routingResult.reasoning,
            alternatives: routingResult.alternatives
          });

          console.log(`✅ Analyzed ${selectedFile.name}: ${routingResult.suggestedPath} (${Math.round(routingResult.confidence * 100)}%)`);
        } catch (error) {
          console.error(`❌ Failed to analyze ${selectedFile.name}:`, error);
          results.push({
            file: selectedFile,
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

  // Helper function to create filename with project code prefix
  const createFileNameWithPrefix = (originalFileName: string, projectCode: string): string => {
    // Check if file already has the project code prefix
    if (originalFileName.startsWith(`${projectCode}_`)) {
      return originalFileName; // Already has prefix, don't duplicate
    }
    
    // Add project code prefix to filename
    return `${projectCode}_${originalFileName}`;
  };

  // Helper function to create filename with project code and suggested path
  const createFileNameWithSuggestedPath = (originalFileName: string, projectCode: string, suggestedPath: string): string => {
    // Clean the suggested path by removing slashes and making it safe for filename
    const cleanPath = suggestedPath.replace(/\//g, '__').replace(/\\/g, '__').trim();
    
    // Get file name and extension
    const lastDotIndex = originalFileName.lastIndexOf('.');
    const fileName = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
    const extension = lastDotIndex > 0 ? originalFileName.substring(lastDotIndex) : '';
    
    // Check if file already has the project code prefix
    if (fileName.startsWith(`${projectCode}_`)) {
      // If it already has prefix, just add the suggested path
      return `${fileName}__${cleanPath}${extension}`;
    }
    
    // Create new filename: PROJECTCODE__ORIGINALNAME__SUGGESTEDPATH.ext
    return `${projectCode}__${fileName}__${cleanPath}${extension}`;
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
          
          // Create new filename with project code prefix
          const newFileName = createFileNameWithPrefix(result.file.name, project.code);

          await moveFileMutation.mutateAsync({
            fileId: result.file.driveItemId || result.file.id,
            targetPath: targetPath,
            fileName: newFileName
          });
          
          successCount++;
          console.log(`✅ Moved and renamed: ${result.file.name} → ${newFileName} to ${targetPath}`);
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

  // Handle uploading files directly to OneDrive with AI suggestions
  const handleUploadToOneDrive = async () => {
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

    // Check OneDrive requirements
    if (!isConnected || !rootConfig) {
      toast({
        title: "Errore OneDrive",
        description: "OneDrive deve essere connesso e configurato per caricare i file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Get OneDrive mapping for the project to construct target path
      const mapping = getOneDriveMapping(project.code);
      const basePath = mapping ? mapping.oneDriveFolderPath : `${rootConfig.folderPath}/${project.code}`;

      for (const result of routingResults) {
        try {
          // Find the original uploaded file
          const originalFile = uploadedFiles.find(f => f.name === result.file.name);
          if (!originalFile) {
            throw new Error('File originale non trovato');
          }

          // Construct full target path: basePath + suggestedPath
          const targetPath = `${basePath}/${result.suggestedPath}`.replace(/\/+/g, '/');
          
          console.log(`📤 Uploading ${originalFile.name} to OneDrive: ${targetPath}`);

          // Upload file to OneDrive with project code prefix
          const uploadResult = await oneDriveService.uploadFile(originalFile, project.code, targetPath);
          
          if (uploadResult) {
            successCount++;
            console.log(`✅ Uploaded to OneDrive: ${uploadResult.name} → ${targetPath}`);
          } else {
            throw new Error('Upload failed - no result returned');
          }
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to upload ${result.file.name}:`, error);
        }
      }

      // Show results toast
      if (successCount > 0) {
        toast({
          title: "Upload completato",
          description: `${successCount} file caricati su OneDrive${errorCount > 0 ? `, ${errorCount} errori` : ''}`,
        });

        // Clear state and refresh OneDrive data
        setScannedFiles([]);
        setSelectedFiles([]);
        setUploadedFiles([]);
        setRoutingResults([]);
        setActiveTab("scan");
        queryClient.invalidateQueries({ queryKey: ['onedrive-files'] });
      }

      if (errorCount > 0 && successCount === 0) {
        toast({
          title: "Errore upload",
          description: `Impossibile caricare ${errorCount} file su OneDrive`,
          variant: "destructive",
        });
      }

    } finally {
      setIsUploading(false);
    }
  };

  // Get confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (percentage >= 80) return "bg-green-100 text-green-800";
    if (percentage >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  // Check if OneDrive is ready (required for both modes now)
  const isOneDriveReady = isConnected && rootConfig;

  return (
    <div className="card-g2" data-testid="onedrive-auto-routing">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{mode === "onedrive" ? "☁️" : "📁"}</span>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">🤖 Auto-Routing AI Unificato</h2>
          <p className="text-gray-600">Sistema intelligente per classificazione automatica file da qualsiasi sorgente</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => handleModeChange("onedrive")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "onedrive"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
            data-testid="mode-toggle-onedrive"
          >
            <Cloud className="w-4 h-4 mr-2 inline" />
            Da OneDrive
          </button>
          <button
            onClick={() => handleModeChange("upload")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "upload"
                ? "bg-white text-green-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
            data-testid="mode-toggle-upload"
          >
            <Upload className="w-4 h-4 mr-2 inline" />
            Upload Locale
          </button>
        </div>
      </div>

      {/* OneDrive Status Warning */}
      {!isOneDriveReady && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-800">OneDrive Richiesto</h3>
              <p className="text-sm text-yellow-700">
                {!isConnected 
                  ? "Connetti OneDrive nelle impostazioni per utilizzare il routing AI" 
                  : "Configura la cartella radice in Sistema → Cartelle per proseguire"
                }
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                {mode === "onedrive" 
                  ? "OneDrive è necessario per scansionare e spostare file esistenti"
                  : "OneDrive è necessario per caricare i file direttamente nei percorsi suggeriti"
                }
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scan" className="flex items-center gap-2" data-testid="tab-scan">
            <FolderSearch className="w-4 h-4" />
            1. {mode === "onedrive" ? "Scansiona Cartella" : "Carica File"}
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

        {/* Step 1: Scan Folder / Upload Files */}
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

              {mode === "upload" ? (
                // Upload Mode: File Upload Section
                <div>
                  <Label className="block text-sm font-semibold text-gray-700 mb-2">
                    Seleziona File dal Computer
                  </Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600 mb-2">Trascina i file qui o clicca per selezionare</p>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      data-testid="input-file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Sfoglia File
                    </label>
                    {uploadedFiles.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">
                        {uploadedFiles.length} file selezionati
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                // OneDrive Mode: Original OneDrive scanning section
                <>
                  <div>
                    <Label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cartella OneDrive del Progetto
                    </Label>
                    {selectedProject ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-blue-600" />
                          <span className="font-mono text-sm text-blue-800" data-testid="text-scan-path">{scanPath}</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          📂 Cartella automaticamente selezionata dal mapping OneDrive
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Seleziona prima un progetto</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          La cartella OneDrive verrà selezionata automaticamente
                        </p>
                      </div>
                    )}
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
                </>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Come Funziona</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <p>1. <strong>Seleziona un progetto</strong> per contestualizzare l'analisi AI</p>
                {mode === "onedrive" ? (
                  <>
                    <p>2. <strong>La cartella OneDrive</strong> viene automaticamente selezionata dal mapping del progetto</p>
                    <p>3. <strong>Avvia la scansione</strong> per trovare tutti i file nella cartella del progetto</p>
                    <p>4. <strong>L'AI analizzerà</strong> i file e li sposterà con rinomina automatica (prefisso codice commessa)</p>
                  </>
                ) : (
                  <>
                    <p>2. <strong>Carica i file</strong> dal tuo computer tramite l'interfaccia di upload</p>
                    <p>3. <strong>Seleziona i file</strong> da analizzare per la classificazione AI</p>
                    <p>4. <strong>L'AI analizzerà</strong> i file e li caricherà direttamente su OneDrive nei percorsi suggeriti con rinomina automatica</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={mode === "onedrive" ? handleScanFolder : () => {
                if (uploadedFiles.length > 0) {
                  setActiveTab("select");
                }
              }}
              disabled={mode === "onedrive" ? (!scanPath.trim() || isScanning || !isOneDriveReady) : (uploadedFiles.length === 0 || !isOneDriveReady)}
              className="button-g2-primary"
              data-testid="button-scan-folder"
            >
              {mode === "onedrive" ? (
                isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Scansionando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Scansiona Cartella
                  </>
                )
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Procedi con File Caricati
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
            {routingResults.length > 0 && mode === "onedrive" && (
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
            {routingResults.length > 0 && mode === "upload" && (
              <div className="flex items-center gap-4">
                <div className="flex-1 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Carica su OneDrive:</span>
                    <span>I file verranno caricati direttamente nei percorsi suggeriti con codice progetto</span>
                  </div>
                </div>
                <Button
                  onClick={handleUploadToOneDrive}
                  disabled={isUploading || !isOneDriveReady}
                  className="button-g2-primary"
                  data-testid="button-upload-to-onedrive"
                >
                  {isUploading ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-pulse" />
                      Caricando...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4 mr-2" />
                      Carica su OneDrive
                    </>
                  )}
                </Button>
              </div>
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