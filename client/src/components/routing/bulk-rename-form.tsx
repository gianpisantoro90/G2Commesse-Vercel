import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface BulkRenameFormProps {
  onRenameComplete: (results: Array<{original: string, renamed: string}>) => void;
}

export default function BulkRenameForm({ onRenameComplete }: BulkRenameFormProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [renamePreview, setRenamePreview] = useState<Array<{original: string, renamed: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [folderName, setFolderName] = useState("");
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const generateNewFileName = (originalFile: File, projectCode: string): string => {
    const fileName = originalFile.name;
    const lastDotIndex = fileName.lastIndexOf('.');
    
    if (lastDotIndex === -1) {
      // No extension - check if already has prefix
      if (fileName.startsWith(projectCode + '_')) {
        return fileName; // Already has prefix
      }
      return `${projectCode}_${fileName}`;
    }
    
    const nameWithoutExt = fileName.substring(0, lastDotIndex);
    const extension = fileName.substring(lastDotIndex);
    
    // Check if already has project code prefix (exact match)
    if (nameWithoutExt.startsWith(projectCode + '_')) {
      return fileName; // Already has correct prefix
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
    setDirectoryHandle(null);
    setFolderName("");
  };

  const handleSelectFolder = async () => {
    if (!selectedProject) {
      toast({
        title: "Errore",
        description: "Seleziona prima una commessa",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if browser supports File System Access API
      if (!('showDirectoryPicker' in window)) {
        toast({
          title: "Browser non supportato",
          description: "Il tuo browser non supporta la selezione di cartelle. Usa Chrome/Edge aggiornato.",
          variant: "destructive",
        });
        return;
      }

      // Open directory picker
      const dirHandle = await (window as any).showDirectoryPicker();
      setDirectoryHandle(dirHandle);
      setFolderName(dirHandle.name);
      
      // Read all files from directory and ALL subdirectories recursively
      const files: File[] = [];
      const readDirectoryRecursive = async (dirHandle: any, path: string = '') => {
        for await (const [name, handle] of dirHandle.entries()) {
          if (handle.kind === 'file') {
            const file = await handle.getFile();
            // Add path information to help identify file location
            Object.defineProperty(file, 'relativePath', {
              value: path ? `${path}/${name}` : name,
              writable: false
            });
            files.push(file);
          } else if (handle.kind === 'directory') {
            // Recursively scan subdirectory
            await readDirectoryRecursive(handle, path ? `${path}/${name}` : name);
          }
        }
      };
      
      await readDirectoryRecursive(dirHandle);
      
      setFolderFiles(files);
      
      // Generate preview
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        const preview = files.map(file => ({
          original: (file as any).relativePath || file.name,
          renamed: generateNewFileName(file, project.code)
        }));
        setRenamePreview(preview);
      }
      
      const subdirCount = files.filter(f => (f as any).relativePath && (f as any).relativePath.includes('/')).length;
      toast({
        title: "Cartella selezionata",
        description: `Trovati ${files.length} file in "${dirHandle.name}" (${subdirCount} nelle sottocartelle)`,
      });
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
        toast({
          title: "Errore nella selezione",
          description: "Impossibile accedere alla cartella selezionata",
          variant: "destructive",
        });
      }
    }
  };

  const handleBulkRename = async () => {
    if (!selectedProject || !directoryHandle || folderFiles.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona una commessa e una cartella con file da rinominare",
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

    try {
      // Process only files that need renaming
      const renameResults: Array<{original: string, renamed: string}> = [];
      const filesToRename = folderFiles.filter(file => {
        const newName = generateNewFileName(file, project.code);
        return file.name !== newName;
      });
      
      if (filesToRename.length === 0) {
        toast({
          title: "Nessuna rinominazione necessaria",
          description: "Tutti i file hanno già il prefisso corretto",
        });
        setIsProcessing(false);
        return;
      }
      
      // Navigate to correct subdirectory and rename files
      let renamedInPlace = 0;
      const failedRenames: File[] = [];
      
      // Helper function to navigate to file's directory
      const getFileDirectory = async (relativePath: string): Promise<any> => {
        const pathParts = relativePath.split('/');
        const fileName = pathParts.pop(); // Remove file name, keep directory path
        
        if (pathParts.length === 0) {
          return directoryHandle; // File is in root directory
        }
        
        let currentHandle = directoryHandle;
        for (const part of pathParts) {
          currentHandle = await currentHandle.getDirectoryHandle(part);
        }
        return currentHandle;
      };
      
      for (const file of filesToRename) {
        const relativePath = (file as any).relativePath || file.name;
        const fileName = relativePath.split('/').pop() || file.name;
        const newName = generateNewFileName(file, project.code);
        
        try {
          // Get the correct directory handle for this file
          const fileDirectory = await getFileDirectory(relativePath);
          
          // Get file handle from the correct directory
          const fileHandle = await fileDirectory.getFileHandle(fileName);
          const originalFile = await fileHandle.getFile();
          
          // Create new file with new name in the same directory
          const newFileHandle = await fileDirectory.getFileHandle(newName, { create: true });
          const writable = await newFileHandle.createWritable();
          await writable.write(originalFile);
          await writable.close();
          
          // Remove original file
          await fileDirectory.removeEntry(fileName);
          
          renameResults.push({
            original: relativePath,
            renamed: relativePath.replace(fileName, newName)
          });
          renamedInPlace++;
          
        } catch (error) {
          console.warn(`Failed to rename ${relativePath} in place, will download instead:`, error);
          failedRenames.push(file);
        }
      }
      
      // For files that couldn't be renamed in place, download them
      for (const file of failedRenames) {
        const relativePath = (file as any).relativePath || file.name;
        const fileName = relativePath.split('/').pop() || file.name;
        const newName = generateNewFileName(file, project.code);
        
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = newName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        renameResults.push({
          original: relativePath,
          renamed: relativePath.replace(fileName, newName)
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Add files that were already correct (for complete results)
      const alreadyCorrect = folderFiles.filter(file => {
        const newName = generateNewFileName(file, project.code);
        return file.name === newName;
      });
      
      alreadyCorrect.forEach(file => {
        renameResults.push({
          original: file.name,
          renamed: file.name
        });
      });

      onRenameComplete(renameResults);
      
      const alreadyCorrectCount = renameResults.length - filesToRename.length;
      
      if (renamedInPlace > 0) {
        toast({
          title: "Rinominazione completata nella cartella",
          description: `${renamedInPlace} file rinominati direttamente, ${failedRenames.length} scaricati, ${alreadyCorrectCount} già corretti`,
        });
      } else {
        toast({
          title: "File scaricati per rinominazione",
          description: `${failedRenames.length} file scaricati, ${alreadyCorrectCount} già corretti. Sostituisci manualmente i file originali.`,
        });
      }

    } catch (error) {
      console.error('Bulk rename error:', error);
      toast({
        title: "Errore nella rinominazione",
        description: "Si è verificato un errore durante il processo",
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
          Seleziona una cartella dal file system per rinominare automaticamente tutti i file contenuti aggiungendo il prefisso della commessa
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

        {/* Folder Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Seleziona cartella commessa
          </Label>
          <div className="flex gap-3">
            <Button
              onClick={handleSelectFolder}
              disabled={!selectedProject}
              variant="outline"
              className="flex-1 p-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="folder-select-button"
            >
              {folderName ? (
                <>📁 {folderName} ({folderFiles.length} file)</>
              ) : (
                <>📁 Scegli cartella...</>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-600">
            Il sistema accederà alla cartella e rinominerà tutti i file (non le sottocartelle) aggiungendo il prefisso della commessa
          </p>
          {!('showDirectoryPicker' in window) && (
            <Alert className="border-red-200 bg-red-50 mt-2">
              <AlertDescription className="text-red-800">
                <strong>⚠️ Browser non compatibile:</strong> Questa funzionalità richiede Chrome/Edge aggiornato per accedere alle cartelle del file system.
              </AlertDescription>
            </Alert>
          )}
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
                <strong>✅ Funzionalità avanzata:</strong> Il sistema tenterà di rinominare i file direttamente nella cartella selezionata. 
                Se non è possibile, i file rinominati verranno scaricati automaticamente.
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