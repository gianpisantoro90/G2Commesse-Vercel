import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { type Project } from "@shared/schema";
import { aiRouter, type RoutingResult } from "@/lib/ai-router";
import { useToast } from "@/hooks/use-toast";
import { folderManager } from "@/lib/folder-manager";
import { AlertCircle, CheckCircle, Settings } from "lucide-react";

interface RoutingFormProps {
  onAnalysisComplete: (results: Array<{result: RoutingResult, file: File}>, project: Project | null) => void;
}

export default function RoutingForm({ onAnalysisComplete }: RoutingFormProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rootFolderStatus, setRootFolderStatus] = useState<'configured' | 'not-configured' | 'checking'>('checking');
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  useEffect(() => {
    // Check root folder configuration status
    const checkRootFolderStatus = () => {
      const isConfigured = folderManager.isConfigured();
      setRootFolderStatus(isConfigured ? 'configured' : 'not-configured');
    };
    
    checkRootFolderStatus();
    
    // Listen for storage changes (when user configures folder in another tab)
    const handleStorageChange = () => {
      checkRootFolderStatus();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
      // Auto-detect template from selected project
      const project = projects.find(p => p.id === selectedProject);
      if (project && !selectedTemplate) {
        setSelectedTemplate(project.template);
      }
    }
  };

  const handleAnalyzeFiles = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un file per continuare",
        variant: "destructive",
      });
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      // Get project details
      const project = projects.find(p => p.id === selectedProject) || null;
      const template = selectedTemplate || project?.template || 'LUNGO';
      
      toast({
        title: "Analisi AI in corso",
        description: `Claude AI sta analizzando ${selectedFiles.length} file con algoritmi avanzati...`,
      });
      
      // Analyze all files in parallel
      const analysisPromises = selectedFiles.map(async (file) => {
        const result = await aiRouter.routeFile(file, template, selectedProject || undefined);
        return { result, file };
      });
      
      const results = await Promise.all(analysisPromises);
      
      // Call parent callback with all results
      onAnalysisComplete(results, project);
      
      toast({
        title: "Analisi AI completata",
        description: `${selectedFiles.length} file classificati dall'AI con successo`,
      });
      
    } catch (error) {
      console.error('Routing analysis failed:', error);
      toast({
        title: "Errore analisi AI",
        description: error instanceof Error ? error.message : "Errore durante l'analisi AI dei file",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="card-g2" data-testid="routing-form">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🤖</span>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Auto-Routing AI-Only</h2>
          <p className="text-gray-600">Sistema intelligente Claude AI per classificazione automatica file</p>
          
          {/* Root Folder Status */}
          <div className="mt-2 flex items-center gap-2">
            {rootFolderStatus === 'configured' ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">Cartella radice configurata</span>
              </>
            ) : rootFolderStatus === 'not-configured' ? (
              <>
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 font-medium">Cartella radice non configurata</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    toast({
                      title: "Configurazione cartella",
                      description: "Vai in Sistema > Cartelle per configurare la cartella radice delle commesse.",
                    });
                  }}
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Configura ora
                </Button>
              </>
            ) : (
              <span className="text-sm text-gray-500">Verifica configurazione...</span>
            )}
          </div>
        </div>
      </div>
      
      <form className="space-y-6">
        <div>
          <Label className="block text-sm font-semibold text-gray-700 mb-2">
            Commessa di Riferimento
          </Label>
          <Select value={selectedProject} onValueChange={setSelectedProject} data-testid="select-project">
            <SelectTrigger className="input-g2">
              <SelectValue placeholder="Seleziona commessa..." />
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
            Template Progetto
          </Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate} data-testid="select-routing-template">
            <SelectTrigger className="input-g2">
              <SelectValue placeholder="Seleziona template o auto-detect dal progetto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LUNGO">LUNGO - Progetti complessi</SelectItem>
              <SelectItem value="BREVE">BREVE - Progetti semplici</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="block text-sm font-semibold text-gray-700 mb-2">
            Carica File da Classificare
          </Label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              data-testid="file-upload"
            />
            <div className="text-4xl mb-4">{selectedFiles.length > 1 ? '📁' : '📄'}</div>
            <p className="text-gray-600 mb-2">
              {selectedFiles.length > 0 ? (
                selectedFiles.length === 1 ? (
                  selectedFiles[0].name
                ) : (
                  `${selectedFiles.length} file selezionati`
                )
              ) : (
                "Trascina qui i file o clicca per selezionare"
              )}
            </p>
            {selectedFiles.length > 1 && (
              <div className="text-xs text-gray-500 mb-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="truncate">
                    • {file.name}
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              onClick={() => document.getElementById('file-upload')?.click()}
              className="button-g2-primary"
              data-testid="select-files"
            >
              Seleziona File
            </Button>
          </div>
        </div>
        
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={handleAnalyzeFiles}
            disabled={selectedFiles.length === 0 || isAnalyzing}
            className="button-g2-primary disabled:opacity-50"
            data-testid="analyze-files"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analizzando {selectedFiles.length} file...
              </>
            ) : (
              selectedFiles.length > 1 
                ? `🔍 Analizza ${selectedFiles.length} File` 
                : "🔍 Analizza e Suggerisci Percorso"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
