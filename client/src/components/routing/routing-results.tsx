import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type RoutingResult } from "@/lib/ai-router";
import { type Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { aiRouter } from "@/lib/ai-router";

interface RoutingResultsProps {
  result: RoutingResult | null;
  file: File | null;
  project: Project | null;
  onClear: () => void;
}

export default function RoutingResults({ result, file, project, onClear }: RoutingResultsProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { toast } = useToast();

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (percentage >= 80) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Alta ({percentage}%)</span>;
    } else if (percentage >= 60) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Media ({percentage}%)</span>;
    } else {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Bassa ({percentage}%)</span>;
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
      'ai': <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">🤖 AI</span>,
      'rules': <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">📋 Regole</span>,
      'learned': <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">🧠 Appreso</span>
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

  const suggestedFileName = project?.code ? generateNewFileName(file, project.code) : file.name;

  const handleSelectPath = (path: string) => {
    setSelectedPath(path);
    toast({
      title: "Percorso selezionato",
      description: `Selezionato: ${path}`,
    });
  };

  const handleAcceptSuggestion = () => {
    if (!result || !file) return;
    
    const pathToUse = selectedPath || result.suggestedPath;
    const finalFileName = suggestedFileName;
    
    // Learn from this acceptance if user made a selection
    if (selectedPath && selectedPath !== result.suggestedPath) {
      aiRouter.learnFromCorrection(file, selectedPath);
    }
    
    const hasRenamed = finalFileName !== file.name;
    const message = hasRenamed 
      ? `File "${finalFileName}" verrà spostato in: ${pathToUse}`
      : `File verrà spostato in: ${pathToUse}`;
    
    toast({
      title: "Suggerimento accettato",
      description: message,
    });
    
    // TODO: Implement actual file moving and renaming logic when File System API is available
    console.log('Would move and rename file:', {
      originalName: file.name,
      newName: finalFileName,
      path: pathToUse,
      fullPath: `${pathToUse}${finalFileName}`
    });
  };

  const handleManualPath = () => {
    const manualPath = prompt("Inserisci il percorso manuale:");
    if (manualPath && file) {
      aiRouter.learnFromCorrection(file, manualPath);
      toast({
        title: "Percorso manuale impostato",
        description: `Il sistema ha appreso: ${manualPath}`,
      });
    }
  };

  const handleAnalyzeAnother = () => {
    onClear();
  };

  if (!result || !file) {
    return null;
  }

  return (
    <div className="card-g2" data-testid="routing-results">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Risultati Analisi</h3>
      
      <div className="space-y-4">
        {/* File Info */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="font-semibold text-gray-700 mb-2">Informazioni File</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <span className="text-gray-600">Nome originale:</span>{" "}
              <span className="font-mono" data-testid="file-name">
                {file.name}
              </span>
            </div>
            {project?.code && suggestedFileName !== file.name && (
              <div className="col-span-2">
                <span className="text-gray-600">Nome suggerito:</span>{" "}
                <span className="font-mono font-semibold text-primary" data-testid="suggested-file-name">
                  {suggestedFileName}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Dimensione:</span>{" "}
              <span data-testid="file-size">{getFileSize(file.size)}</span>
            </div>
            <div>
              <span className="text-gray-600">Tipo:</span>{" "}
              <span data-testid="file-type">{file.type || 'File generico'}</span>
            </div>
            <div>
              <span className="text-gray-600">Progetto:</span>{" "}
              <span data-testid="file-project">{project?.code || 'Nessuno'}</span>
            </div>
          </div>
        </div>
        
        {/* Analysis Result */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-3">💡 Risultato Analisi</h4>
          <div className="space-y-3">
            {/* Main suggestion */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedPath === result.suggestedPath 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => handleSelectPath(result.suggestedPath)}
              data-testid="main-suggestion"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-1">
                  <div className="font-mono text-sm text-primary font-semibold">
                    📁 {result.suggestedPath}
                  </div>
                  {project?.code && suggestedFileName !== file.name && (
                    <div className="font-mono text-xs text-gray-600">
                      📄 {suggestedFileName}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {getMethodBadge(result.method)}
                  {getConfidenceBadge(result.confidence)}
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {result.reasoning}
              </div>
            </div>
            
            {/* Alternative suggestions */}
            {result.alternatives && result.alternatives.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Percorsi alternativi:</h5>
                <div className="space-y-2">
                  {result.alternatives.map((altPath, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPath === altPath 
                          ? 'border-primary bg-primary/5' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleSelectPath(altPath)}
                      data-testid={`alternative-path-${index}`}
                    >
                      <div className="font-mono text-sm text-gray-700">
                        {altPath}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleAcceptSuggestion}
            className="px-6 py-2 bg-g2-success text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            data-testid="accept-suggestion"
          >
            ✅ Accetta Suggerimento
          </Button>
          <Button
            variant="outline"
            onClick={handleManualPath}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            data-testid="manual-path"
          >
            ✏️ Percorso Manuale
          </Button>
          <Button
            variant="ghost"
            onClick={handleAnalyzeAnother}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            data-testid="analyze-another"
          >
            🔄 Analizza Altro File
          </Button>
        </div>
      </div>
    </div>
  );
}
