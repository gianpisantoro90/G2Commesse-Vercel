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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [renamePreview, setRenamePreview] = useState<Array<{original: string, renamed: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const generateNewFileName = (originalFile: File, projectCode: string): string => {
    const fileName = originalFile.name;
    const lastDotIndex = fileName.lastIndexOf('.');
    
    if (lastDotIndex === -1) {
      // No extension
      return `${projectCode}_${fileName}`;
    }
    
    const nameWithoutExt = fileName.substring(0, lastDotIndex);
    const extension = fileName.substring(lastDotIndex);
    
    // Check if already has project code prefix
    if (nameWithoutExt.startsWith(projectCode + '_')) {
      return fileName; // Already has prefix
    }
    
    return `${projectCode}_${nameWithoutExt}${extension}`;
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setRenamePreview([]);
    setSelectedFiles([]);
  };

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
      
      // Generate preview
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        const preview = files.map(file => ({
          original: file.name,
          renamed: generateNewFileName(file, project.code)
        }));
        setRenamePreview(preview);
      }
    }
  };

  const handleBulkRename = async () => {
    if (!selectedProject || selectedFiles.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona una commessa e i file da rinominare",
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
      // Process all files
      const renameResults: Array<{original: string, renamed: string}> = [];
      
      for (const file of selectedFiles) {
        const newName = generateNewFileName(file, project.code);
        
        // Create download with new name
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = newName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        renameResults.push({
          original: file.name,
          renamed: newName
        });
        
        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      onRenameComplete(renameResults);
      
      toast({
        title: "Rinominazione completata",
        description: `${renameResults.length} file rinominati e scaricati`,
      });

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
          Seleziona una cartella di commessa per rinominare tutti i file con il prefisso del codice commessa
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
          <Label htmlFor="folder-upload" className="text-sm font-medium">
            Carica file dalla cartella commessa
          </Label>
          <div className="relative">
            <input
              id="folder-upload"
              type="file"
              multiple
              onChange={handleFolderUpload}
              disabled={!selectedProject}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="folder-upload"
            />
          </div>
          <p className="text-xs text-gray-600">
            Seleziona tutti i file nella cartella della commessa che vuoi rinominare
          </p>
        </div>

        {/* Preview */}
        {renamePreview.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Anteprima rinominazione:</h4>
            <div className="max-h-64 overflow-y-auto bg-white border rounded-lg p-3">
              {renamePreview.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="text-sm">
                    <div className="text-red-600 line-through">{item.original}</div>
                    <div className="text-green-600 font-medium">→ {item.renamed}</div>
                  </div>
                  {item.original === item.renamed && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      ✓ Già corretto
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleBulkRename}
            disabled={!selectedProject || selectedFiles.length === 0 || isProcessing}
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
                📝 Rinomina e Scarica ({renamePreview.length} file)
              </>
            )}
          </Button>
        </div>

        {renamePreview.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800">
              <strong>Nota:</strong> I file rinominati verranno scaricati automaticamente. 
              Dovrai sostituire manualmente i file originali nella cartella della commessa.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}