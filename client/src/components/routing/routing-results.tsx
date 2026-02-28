import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type RoutingResult } from "@/lib/ai-router";
import { type Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { aiRouter } from "@/lib/ai-router";
import { apiRequest } from "@/lib/queryClient";

interface RoutingResultsProps {
  results: Array<{result: RoutingResult, file: File}> | null;
  project: Project | null;
  onClear: () => void;
}

export default function RoutingResults({ results, project, onClear }: RoutingResultsProps) {
  const [selectedPaths, setSelectedPaths] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (percentage >= 80) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-full text-xs font-medium">Alta ({percentage}%)</span>;
    } else if (percentage >= 60) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-full text-xs font-medium">Media ({percentage}%)</span>;
    } else {
      return <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 rounded-full text-xs font-medium">Bassa ({percentage}%)</span>;
    }
  };

  const getFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getMethodBadge = (method: string) => {
    const badges = {
      'ai': <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-xs font-medium">🤖 AI</span>,
      'rules': <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded-full text-xs font-medium">📋 Regole</span>,
      'learned': <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 rounded-full text-xs font-medium">🧠 Appreso</span>
    };
    return badges[method as keyof typeof badges] || badges.rules;
  };

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

  const handleSelectPath = (fileIndex: number, path: string) => {
    setSelectedPaths(prev => ({ ...prev, [fileIndex]: path }));
    toast({
      title: "Percorso selezionato",
      description: `Selezionato: ${path}`,
    });
  };

  const handleAcceptSuggestion = async (fileIndex: number) => {
    if (!results || !results[fileIndex]) return;
    
    const { result, file } = results[fileIndex];
    const pathToUse = selectedPaths[fileIndex] || result.suggestedPath;
    const finalFileName = project?.code ? generateNewFileName(file, project.code) : file.name;
    
    // Learn from this acceptance if user made a selection
    if (selectedPaths[fileIndex] && selectedPaths[fileIndex] !== result.suggestedPath) {
      aiRouter.learnFromCorrection(file, selectedPaths[fileIndex]);
    }
    
    try {
      // OneDrive-centric system: download file with suggested name and path
      await handleDownloadFallback(file, pathToUse, finalFileName);
      
      // Save routing record
      if (project?.id) {
        await saveFileRoutingRecord(project.id, file, pathToUse, result);
      }
      
      const hasRenamed = finalFileName !== file.name;
      const message = hasRenamed 
        ? `File "${finalFileName}" spostato in: ${pathToUse}`
        : `File "${file.name}" spostato in: ${pathToUse}`;
      
      toast({
        title: "File spostato con successo",
        description: message,
      });
      
    } catch (error) {
      console.error('Errore nel spostamento file:', error);
      toast({
        title: "Errore nello spostamento",
        description: "Impossibile spostare il file. Verifica i permessi.",
        variant: "destructive"
      });
    }
  };

  const handleManualPath = (fileIndex: number) => {
    if (!results || !results[fileIndex]) return;
    
    const { file } = results[fileIndex];
    const manualPath = prompt(`Inserisci il percorso manuale per "${file.name}":`);
    if (manualPath) {
      aiRouter.learnFromCorrection(file, manualPath);
      setSelectedPaths(prev => ({ ...prev, [fileIndex]: manualPath }));
      toast({
        title: "Percorso manuale impostato",
        description: `Il sistema ha appreso: ${manualPath}`,
      });
    }
  };

  const handleAnalyzeAnother = () => {
    onClear();
  };


  // Function to handle download fallback
  const handleDownloadFallback = async (file: File, targetPath: string, finalFileName: string) => {
    try {
      // QUESTO È IL PROBLEMA: Il file originale viene perso e sostituito con un TXT
      // Invece di creare un nuovo blob, usiamo il file originale
      const url = URL.createObjectURL(file); // Usa il file originale
      const link = document.createElement('a');
      link.href = url;
      
      // CORREZIONE: Usa direttamente il nome rinominato senza prefissi aggiuntivi
      link.download = finalFileName; // Nome corretto con estensione originale
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Show instruction to user
      toast({
        title: "File scaricato",
        description: `Sposta manualmente "${finalFileName}" in: ${targetPath}`,
      });
    } catch (error) {
      console.error('Download fallback error:', error);
      throw error;
    }
  };

  // Function to save file routing record to database
  const saveFileRoutingRecord = async (projectId: string, file: File, targetPath: string, result: RoutingResult) => {
    try {
      const requestData = {
        projectId,
        fileName: file.name,
        fileType: file.type || 'unknown',
        suggestedPath: targetPath,
        actualPath: targetPath,
        confidence: Math.round(result.confidence * 100),
        method: result.method,
      };
      
      await apiRequest('POST', '/api/file-routings', requestData);
    } catch (error) {
      console.error('Error saving file routing record:', error);
      // Don't throw - this is not critical for the user experience
    }
  };

  const handleAcceptAllSuggestions = async () => {
    if (!results) return;
    
    // Process all files in parallel
    const promises = results.map((_, index) => handleAcceptSuggestion(index));
    
    try {
      await Promise.all(promises);
      
      toast({
        title: "Tutti i suggerimenti accettati",
        description: `${results.length} file elaborati`,
      });
    } catch (error) {
      toast({
        title: "Errore nell'elaborazione",
        description: "Alcuni file potrebbero non essere stati elaborati correttamente",
        variant: "destructive"
      });
    }
  };

  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="card-g2" data-testid="routing-results">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">📊 Risultati Analisi</h3>
        <div className="text-sm text-muted-foreground">
          {results.length} file analizzati
        </div>
      </div>

      <div className="space-y-6">
        {results.map(({ result, file }, fileIndex) => {
          const suggestedFileName = project?.code ? generateNewFileName(file, project.code) : file.name;
          const selectedPath = selectedPaths[fileIndex];

          return (
            <div key={fileIndex} className="border border-border rounded-lg p-4 bg-card">
              {/* File Info */}
              <div className="bg-muted rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  File {fileIndex + 1} di {results.length}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Nome originale:</span>{" "}
                    <span className="font-mono text-foreground" data-testid={`file-name-${fileIndex}`}>
                      {file.name}
                    </span>
                  </div>
                  {project?.code && suggestedFileName !== file.name && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Nome suggerito:</span>{" "}
                      <span className="font-mono font-semibold text-primary" data-testid={`suggested-file-name-${fileIndex}`}>
                        {suggestedFileName}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Dimensione:</span>{" "}
                    <span className="text-foreground" data-testid={`file-size-${fileIndex}`}>{getFileSize(file.size)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>{" "}
                    <span className="text-foreground" data-testid={`file-type-${fileIndex}`}>{file.type || 'File generico'}</span>
                  </div>
                </div>
              </div>
              
              {/* Analysis Result */}
              <div>
                <h4 className="font-semibold text-foreground mb-3">💡 Risultato Analisi</h4>
                <div className="space-y-3">
                  {/* Main suggestion */}
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPath === result.suggestedPath
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                    onClick={() => handleSelectPath(fileIndex, result.suggestedPath)}
                    data-testid={`main-suggestion-${fileIndex}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="space-y-1">
                        <div className="font-mono text-sm text-primary font-semibold">
                          📁 {result.suggestedPath}
                        </div>
                        {project?.code && suggestedFileName !== file.name && (
                          <div className="font-mono text-xs text-muted-foreground">
                            📄 {suggestedFileName}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {getMethodBadge(result.method)}
                        {getConfidenceBadge(result.confidence)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.reasoning}
                    </div>
                  </div>

                  {/* Alternative suggestions */}
                  {result.alternatives && result.alternatives.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-foreground mb-2">Percorsi alternativi:</h5>
                      <div className="space-y-2">
                        {result.alternatives.map((altPath, altIndex) => (
                          <div
                            key={altIndex}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedPath === altPath
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted'
                            }`}
                            onClick={() => handleSelectPath(fileIndex, altPath)}
                            data-testid={`alternative-path-${fileIndex}-${altIndex}`}
                          >
                            <div className="font-mono text-sm text-foreground">
                              {altPath}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t border-border mt-4">
                <Button
                  onClick={() => handleAcceptSuggestion(fileIndex)}
                  className="px-4 py-2 bg-g2-success text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
                  data-testid={`accept-suggestion-${fileIndex}`}
                >
                  ✅ Accetta
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManualPath(fileIndex)}
                  className="px-4 py-2 border-2 border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-colors text-sm"
                  data-testid={`manual-path-${fileIndex}`}
                >
                  ✏️ Manuale
                </Button>
              </div>
            </div>
          );
        })}

        <div className="flex gap-3 pt-4 border-t border-border bg-muted rounded-lg p-4">
          <Button
            onClick={handleAcceptAllSuggestions}
            className="px-6 py-2 bg-g2-success text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            data-testid="accept-all-suggestions"
          >
            ✅ Accetta Tutti i Suggerimenti
          </Button>
          <Button
            variant="ghost"
            onClick={handleAnalyzeAnother}
            className="px-6 py-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="analyze-another"
          >
            🔄 Analizza Altri File
          </Button>
        </div>
      </div>
    </div>
  );
}