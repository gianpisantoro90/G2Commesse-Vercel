import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Folder, FolderOpen, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { type Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { oneDriveService, type OneDriveFile } from "@/lib/onedrive-service";

interface BulkRenameFormProps {
  onRenameComplete: (results: Array<{original: string, renamed: string}>) => void;
}

export default function BulkRenameForm({ onRenameComplete }: BulkRenameFormProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [customFolderPath, setCustomFolderPath] = useState("");
  const [folderFiles, setFolderFiles] = useState<OneDriveFile[]>([]);
  const [renamePreview, setRenamePreview] = useState<Array<{original: string, renamed: string, fileId: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [browseCurrentPath, setBrowseCurrentPath] = useState("/");
  const [browseFiles, setBrowseFiles] = useState<OneDriveFile[]>([]);
  const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Check OneDrive connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      const status = await oneDriveService.getStatus();
      setOneDriveConnected(status.connected);
    };
    checkConnection();
  }, []);

  const generateNewFileName = (originalFileName: string, projectCode: string): string => {
    const lastDotIndex = originalFileName.lastIndexOf('.');
    
    if (lastDotIndex === -1) {
      // No extension - check if already has prefix
      if (originalFileName.startsWith(projectCode + '_')) {
        return originalFileName; // Already has prefix
      }
      return `${projectCode}_${originalFileName}`;
    }
    
    const nameWithoutExt = originalFileName.substring(0, lastDotIndex);
    const extension = originalFileName.substring(lastDotIndex);
    
    // Check if already has project code prefix (exact match)
    if (nameWithoutExt.startsWith(projectCode + '_')) {
      return originalFileName; // Already has correct prefix
    }
    
    // Check if has any other project code prefix pattern (numbers/letters followed by underscore)
    const hasAnyPrefix = /^[A-Z0-9]+_/.test(nameWithoutExt);
    if (hasAnyPrefix) {
      // Replace existing prefix with correct one
      const withoutOldPrefix = nameWithoutExt.replace(/^[A-Z0-9]+_/, '');
      return `${projectCode}_${withoutOldPrefix}${extension}`;
    }
    
    return `${projectCode}_${nameWithoutExt}${extension}`;
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setRenamePreview([]);
    setFolderFiles([]);
    setSelectedFolderPath("");
    setCustomFolderPath("");
    
    // Auto-populate with project folder if it exists
    const project = projects.find(p => p.id === projectId);
    if (project) {
      // Look for project mapping to suggest default folder
      fetch(`/api/onedrive/mappings/${project.code}`)
        .then(res => res.ok ? res.json() : null)
        .then(mapping => {
          if (mapping?.oneDriveFolderPath) {
            setSelectedFolderPath(mapping.oneDriveFolderPath);
          }
        })
        .catch(() => {
          // Ignore errors, just don't auto-populate
        });
    }
  };

  // OneDrive folder browser functions
  const loadBrowseFolder = async (path: string) => {
    setIsLoadingBrowse(true);
    try {
      console.log(`📁 Loading OneDrive folder: ${path}`);
      const files = await oneDriveService.browseFolder(path);
      setBrowseFiles(files);
      setBrowseCurrentPath(path);
    } catch (error) {
      console.error('Error loading OneDrive folder:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare la cartella OneDrive",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBrowse(false);
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolderPath(folderPath);
    setCustomFolderPath("");
    setShowFolderPicker(false);
    toast({
      title: "Cartella selezionata",
      description: `Cartella OneDrive: ${folderPath}`,
    });
  };

  const getBreadcrumbItems = () => {
    if (browseCurrentPath === '/') return [{ name: 'Root', path: '/' }];
    
    const parts = browseCurrentPath.split('/').filter(Boolean);
    const items = [{ name: 'Root', path: '/' }];
    
    let currentBreadcrumbPath = '';
    parts.forEach(part => {
      currentBreadcrumbPath += `/${part}`;
      items.push({ name: part, path: currentBreadcrumbPath });
    });
    
    return items;
  };

  // Initialize folder browser when dialog opens
  useEffect(() => {
    if (showFolderPicker && browseFiles.length === 0) {
      loadBrowseFolder("/");
    }
  }, [showFolderPicker]);

  const handleScanFolder = async () => {
    if (!selectedProject) {
      toast({
        title: "Errore",
        description: "Seleziona prima una commessa",
        variant: "destructive",
      });
      return;
    }

    if (!oneDriveConnected) {
      toast({
        title: "OneDrive non connesso",
        description: "Configura OneDrive nelle impostazioni di sistema per utilizzare questa funzionalità",
        variant: "destructive",
      });
      return;
    }

    const folderPath = selectedFolderPath || customFolderPath;
    if (!folderPath) {
      toast({
        title: "Errore",
        description: "Seleziona o inserisci un percorso cartella OneDrive",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingFiles(true);
    try {
      console.log(`🔍 Scanning OneDrive folder: ${folderPath}`);
      
      // Scan OneDrive folder recursively
      const files = await oneDriveService.scanFolderRecursive(folderPath, true);
      
      // Filter out folders, keep only files
      const fileItems = files.filter(item => !item.folder);
      
      setFolderFiles(fileItems);
      
      // Generate preview
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        const preview = fileItems.map(file => ({
          original: file.name,
          renamed: generateNewFileName(file.name, project.code),
          fileId: file.id
        }));
        setRenamePreview(preview);
      }
      
      toast({
        title: "Cartella scansionata",
        description: `Trovati ${fileItems.length} file in "${folderPath}"`,
      });
      
    } catch (error: any) {
      console.error('Error scanning OneDrive folder:', error);
      toast({
        title: "Errore nella scansione",
        description: "Impossibile accedere alla cartella OneDrive selezionata",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleBulkRename = async () => {
    if (!selectedProject || folderFiles.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona una commessa e scansiona una cartella con file da rinominare",
        variant: "destructive",
      });
      return;
    }

    const project = projects.find(p => p.id === selectedProject);
    if (!project) {
      toast({
        title: "Errore", 
        description: "Commessa non trovata",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    // Step 1: Refresh file scanning to get current valid IDs
    const folderPath = selectedFolderPath || customFolderPath;
    if (!folderPath) {
      toast({
        title: "Errore",
        description: "Percorso cartella non trovato - riseleziona la cartella",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    let currentFiles: OneDriveFile[];
    try {
      console.log(`🔄 Refreshing file scan before rename: ${folderPath}`);
      
      // Fresh scan to get current file IDs
      const scannedFiles = await oneDriveService.scanFolderRecursive(folderPath, true);
      currentFiles = scannedFiles.filter(item => !item.folder);
      
      toast({
        title: "File aggiornati",
        description: `Trovati ${currentFiles.length} file attuali nella cartella`,
      });
      
    } catch (error: any) {
      console.error('Error refreshing file scan:', error);
      toast({
        title: "Errore aggiornamento",
        description: "Impossibile aggiornare la lista dei file - controlla la connessione OneDrive",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    // Step 2: Generate fresh rename preview with current IDs
    const freshPreview = currentFiles.map(file => ({
      original: file.name,
      renamed: generateNewFileName(file.name, project.code),
      fileId: file.id
    }));

    // Update state with fresh data
    setFolderFiles(currentFiles);
    setRenamePreview(freshPreview);

    // Step 3: Prepare operations for files that need renaming
    const operations = freshPreview
      .filter(item => item.original !== item.renamed)
      .map(item => {
        const file = currentFiles.find(f => f.id === item.fileId);
        return {
          fileId: item.fileId,
          driveId: file?.driveId || '',
          originalName: item.original,
          newName: item.renamed
        };
      });
    
    if (operations.length === 0) {
      toast({
        title: "Nessuna rinominazione necessaria",
        description: "Tutti i file hanno già il prefisso corretto",
      });
      setIsProcessing(false);
      return;
    }

    try {
      console.log(`🔄 Starting bulk rename for ${operations.length} files`);
      
      // Call bulk rename API
      const result = await oneDriveService.bulkRenameFiles(operations);
      
      if (result.success) {
        // Convert results to expected format for callback
        const renameResults = result.results.map(r => ({
          original: r.original,
          renamed: r.renamed
        }));

        // Add files that were already correct (for complete results)
        const alreadyCorrect = freshPreview.filter(item => item.original === item.renamed);
        alreadyCorrect.forEach(item => {
          renameResults.push({
            original: item.original,
            renamed: item.renamed
          });
        });

        onRenameComplete(renameResults);
        
        const successCount = result.results.filter(r => r.success).length;
        const failureCount = result.results.filter(r => !r.success).length;
        const alreadyCorrectCount = alreadyCorrect.length;
        
        if (failureCount === 0) {
          toast({
            title: "Rinominazione completata",
            description: `${successCount} file rinominati con successo su OneDrive, ${alreadyCorrectCount} già corretti`,
          });
        } else {
          toast({
            title: "Rinominazione parzialmente completata",
            description: `${successCount} file rinominati, ${failureCount} falliti, ${alreadyCorrectCount} già corretti`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Errore nella rinominazione",
          description: "Impossibile completare l'operazione di rinominazione su OneDrive",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Bulk rename error:', error);
      toast({
        title: "Errore nella rinominazione",
        description: "Si è verificato un errore durante il processo di rinominazione",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50" data-testid="bulk-rename-form">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <span className="text-xl">📁</span>
          Rinomina File Esistenti
        </CardTitle>
        <p className="text-sm text-blue-700">
          Seleziona una cartella OneDrive per rinominare automaticamente tutti i file contenuti aggiungendo il prefisso della commessa
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Project Selection */}
        <div className="space-y-2">
          <Label htmlFor="project-select" className="text-sm font-medium">
            Commessa
          </Label>
          <Select value={selectedProject} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-full" data-testid="project-select">
              <SelectValue placeholder="Seleziona una commessa..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  [{project.code}] {project.client} - {project.object}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProjectData && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">
              <strong>Codice commessa:</strong> {selectedProjectData.code}<br/>
              <strong>Prefisso file:</strong> {selectedProjectData.code}_
            </AlertDescription>
          </Alert>
        )}

        {/* OneDrive Connection Status */}
        {!oneDriveConnected && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              <strong>⚠️ OneDrive non connesso:</strong> Configura OneDrive nelle impostazioni di sistema per utilizzare questa funzionalità.
            </AlertDescription>
          </Alert>
        )}

        {/* OneDrive Folder Selection */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">
            Cartella OneDrive da scansionare
          </Label>
          
          {/* Pre-filled project folder path */}
          {selectedFolderPath && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">Cartella commessa mappata:</Label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">📁</span>
                  <span className="text-blue-800 font-medium">{selectedFolderPath}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* OneDrive folder browser */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Oppure sfoglia OneDrive:</Label>
            <Dialog open={showFolderPicker} onOpenChange={setShowFolderPicker}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!oneDriveConnected}
                  data-testid="browse-onedrive-button"
                >
                  <Folder className="w-4 h-4 mr-2" />
                  Sfoglia cartelle OneDrive
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Seleziona cartella OneDrive</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Breadcrumb */}
                  <Breadcrumb>
                    <BreadcrumbList>
                      {getBreadcrumbItems().map((item, index, array) => (
                        <div key={item.path} className="flex items-center">
                          <BreadcrumbItem>
                            {index === array.length - 1 ? (
                              <BreadcrumbPage>{item.name}</BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink
                                onClick={() => loadBrowseFolder(item.path)}
                                className="cursor-pointer"
                              >
                                {item.name}
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {index < array.length - 1 && <BreadcrumbSeparator />}
                        </div>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>

                  {/* Folder list */}
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {isLoadingBrowse ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                        <span className="text-gray-500">Caricamento...</span>
                      </div>
                    ) : (
                      <div className="space-y-1 p-2">
                        {browseFiles
                          .filter(file => file.folder)
                          .map((folder) => {
                            const folderPath = browseCurrentPath === '/' 
                              ? `/${folder.name}` 
                              : `${browseCurrentPath}/${folder.name}`;
                            
                            return (
                              <div
                                key={folder.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                data-testid={`folder-item-${folder.id}`}
                              >
                                <div 
                                  className="flex items-center gap-3 min-w-0 flex-1"
                                  onClick={() => loadBrowseFolder(folderPath)}
                                >
                                  <FolderOpen className="w-5 h-5 text-blue-500" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm truncate">{folder.name}</div>
                                    <div className="text-xs text-gray-500">
                                      {folderPath}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleFolderSelect(folderPath)}
                                  size="sm"
                                  className="ml-2"
                                  data-testid={`select-folder-${folder.id}`}
                                >
                                  Seleziona
                                </Button>
                              </div>
                            );
                          })}
                        {browseFiles.filter(file => file.folder).length === 0 && !isLoadingBrowse && (
                          <div className="text-center py-8 text-gray-500">
                            Nessuna cartella trovata
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Current folder selection */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-800 font-medium">{browseCurrentPath}</span>
                    </div>
                    <Button
                      onClick={() => handleFolderSelect(browseCurrentPath)}
                      size="sm"
                      data-testid="select-current-folder"
                    >
                      Seleziona questa cartella
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Custom folder path input */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Oppure inserisci percorso personalizzato:</Label>
            <Input
              placeholder="/percorso/cartella/onedrive"
              value={customFolderPath}
              onChange={(e) => setCustomFolderPath(e.target.value)}
              disabled={!oneDriveConnected}
              data-testid="custom-folder-input"
            />
          </div>

          {/* Scan button */}
          <Button
            onClick={handleScanFolder}
            disabled={!selectedProject || !oneDriveConnected || isLoadingFiles || (!selectedFolderPath && !customFolderPath)}
            variant="outline"
            className="w-full p-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="scan-folder-button"
          >
            {isLoadingFiles ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Scansionando OneDrive...
              </>
            ) : folderFiles.length > 0 ? (
              <>🔍 OneDrive scansionato ({folderFiles.length} file)</>
            ) : (
              <>🔍 Scansiona cartella OneDrive</>
            )}
          </Button>
          
          <p className="text-xs text-gray-600">
            Il sistema scansionerà ricorsivamente la cartella OneDrive e i file verranno rinominati direttamente nel cloud
          </p>
        </div>

        {/* Preview */}
        {renamePreview.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Anteprima rinominazione:</h4>
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold mb-2">
              <div className="text-green-600">✓ Già corretti: {renamePreview.filter(r => r.original === r.renamed).length}</div>
              <div className="text-blue-600">🔄 Da rinominare: {renamePreview.filter(r => r.original !== r.renamed).length}</div>
              <div className="text-gray-600">📁 Totale: {renamePreview.length}</div>
            </div>
            <div className="max-h-64 overflow-y-auto bg-white border rounded-lg p-3">
              {renamePreview.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="text-sm flex-1">
                    {item.original === item.renamed ? (
                      <div className="text-green-600 font-medium">✓ {item.original}</div>
                    ) : (
                      <>
                        <div className="text-red-600 line-through">{item.original}</div>
                        <div className="text-green-600 font-medium">→ {item.renamed}</div>
                      </>
                    )}
                  </div>
                  <div className="ml-2">
                    {item.original === item.renamed ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        ✓ Già corretto
                      </span>
                    ) : (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        🔄 Da rinominare
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleBulkRename}
            disabled={!selectedProject || folderFiles.length === 0 || isProcessing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="bulk-rename-button"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Rinominando...
              </>
            ) : (
              <>
                📝 Rinomina File ({renamePreview.filter(r => r.original !== r.renamed).length} da elaborare)
              </>
            )}
          </Button>
        </div>

        {renamePreview.length > 0 && (
          <>
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                <strong>✅ Rinominazione OneDrive:</strong> I file verranno rinominati direttamente su OneDrive in modo sicuro e sincronizzato.
              </AlertDescription>
            </Alert>
            
            {renamePreview.some(r => r.original !== r.renamed && /^[A-Z0-9]+_/.test(r.original)) && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  <strong>⚠️ Attenzione:</strong> Alcuni file hanno già prefissi di altre commesse che verranno sostituiti con il codice della commessa selezionata.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}