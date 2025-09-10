import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Brain, Upload, FileText, FolderOpen, CheckCircle } from "lucide-react";
import oneDriveService, { OneDriveFile } from "@/lib/onedrive-service";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { aiRouter } from "@/lib/ai-router";
import { type Project } from '@shared/schema';

interface OneDriveFileRouterProps {
  onRouteComplete?: (results: Array<{file: OneDriveFile, suggestedPath: string, confidence: number}>) => void;
}

export default function OneDriveFileRouter({ onRouteComplete }: OneDriveFileRouterProps) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<OneDriveFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [routingResults, setRoutingResults] = useState<Array<{
    file: OneDriveFile;
    suggestedPath: string;
    confidence: number;
    reasoning?: string;
  }>>([]);

  const { toast } = useToast();
  const { isConnected } = useOneDriveSync();

  // Get projects for selection
  const { data: projects } = useQuery({
    queryKey: ['projects']
  });

  // Get OneDrive files
  const { data: oneDriveFiles, refetch: refetchFiles } = useQuery({
    queryKey: ['onedrive-files'],
    queryFn: () => oneDriveService.listFiles(),
    enabled: isConnected
  });

  const handleFileSelect = (file: OneDriveFile, selected: boolean) => {
    if (selected) {
      setSelectedFiles(prev => [...prev, file]);
    } else {
      setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
    }
  };

  const handleAnalyzeFiles = async () => {
    if (!selectedProject || selectedFiles.length === 0) {
      toast({
        title: "Selezione mancante",
        description: "Seleziona un progetto e almeno un file",
        variant: "destructive",
      });
      return;
    }

    const project = projects?.find((p: Project) => p.id === selectedProject);
    if (!project) {
      toast({
        title: "Progetto non trovato",
        description: "Il progetto selezionato non è valido",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    const results: Array<{
      file: OneDriveFile;
      suggestedPath: string;
      confidence: number;
      reasoning?: string;
    }> = [];

    try {
      for (const oneDriveFile of selectedFiles) {
        try {
          // Download file from OneDrive
          const blob = await oneDriveService.downloadFile(oneDriveFile.id);
          if (!blob) {
            throw new Error('Failed to download file');
          }

          // Create File object for AI analysis
          const file = new File([blob], oneDriveFile.name, { type: blob.type });

          // Analyze with AI router
          const routingResult = await aiRouter.routeFile(file, project.template, project.id);

          results.push({
            file: oneDriveFile,
            suggestedPath: routingResult.suggestedPath,
            confidence: routingResult.confidence,
            reasoning: routingResult.reasoning
          });

          console.log(`✅ Analyzed ${oneDriveFile.name}: ${routingResult.suggestedPath} (${routingResult.confidence}%)`);
        } catch (error) {
          console.error(`❌ Failed to analyze ${oneDriveFile.name}:`, error);
          results.push({
            file: oneDriveFile,
            suggestedPath: 'MATERIALE_RICEVUTO/',
            confidence: 50,
            reasoning: `Errore nell'analisi: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      setRoutingResults(results);
      onRouteComplete?.(results);

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

  const handleMoveFilesToSuggested = async () => {
    if (routingResults.length === 0) return;

    try {
      const project = projects?.find((p: Project) => p.id === selectedProject);
      if (!project) throw new Error('Project not found');

      for (const result of routingResults) {
        // Here we would implement the actual file moving logic
        // For now, we'll just log the intended action
        console.log(`Moving ${result.file.name} to ${project.code}/${result.suggestedPath}`);
      }

      toast({
        title: "File spostati",
        description: `${routingResults.length} file spostati nelle cartelle suggerite`,
      });

      // Clear results and refresh files
      setRoutingResults([]);
      setSelectedFiles([]);
      refetchFiles();
    } catch (error) {
      console.error('Move failed:', error);
      toast({
        title: "Errore spostamento",
        description: "Impossibile spostare i file",
        variant: "destructive",
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>OneDrive non connesso</p>
        <p className="text-sm">Configura OneDrive nelle impostazioni per utilizzare questa funzionalità</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-3">🎯 Seleziona Progetto</h4>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Scegli un progetto per l'analisi AI..." />
          </SelectTrigger>
          <SelectContent>
            {projects?.map((project: Project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.code} - {project.object}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* File Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-3">📄 Seleziona File da OneDrive</h4>
        {oneDriveFiles && oneDriveFiles.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {oneDriveFiles.filter(file => !file.folder).map((file) => (
              <div
                key={file.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedFiles.some(f => f.id === file.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => handleFileSelect(file, !selectedFiles.some(f => f.id === file.id))}
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
          <div className="text-center py-4 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Nessun file trovato in OneDrive</p>
          </div>
        )}
      </div>

      {/* Analysis Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">🧠 Analisi AI</h4>
            <p className="text-sm text-gray-600">
              {selectedFiles.length} file selezionati per l'analisi
            </p>
          </div>
          <Button
            onClick={handleAnalyzeFiles}
            disabled={!selectedProject || selectedFiles.length === 0 || isAnalyzing}
            className="button-g2-primary"
          >
            {isAnalyzing ? (
              <>
                <Brain className="w-4 h-4 mr-2 animate-pulse" />
                Analizzando...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Analizza con AI
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Results */}
      {routingResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">📋 Risultati Analisi</h4>
            <Button
              onClick={handleMoveFilesToSuggested}
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Sposta File
            </Button>
          </div>
          
          <div className="space-y-3">
            {routingResults.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">{result.file.name}</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      result.confidence >= 80 
                        ? 'bg-green-100 text-green-800'
                        : result.confidence >= 60
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.confidence}% confidenza
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  📁 Cartella suggerita: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{result.suggestedPath}</span>
                </div>
                {result.reasoning && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {result.reasoning}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}