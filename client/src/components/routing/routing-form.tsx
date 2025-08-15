import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { type Project } from "@shared/schema";
import { aiRouter, type RoutingResult } from "@/lib/ai-router";
import { useToast } from "@/hooks/use-toast";

interface RoutingFormProps {
  onAnalysisComplete: (result: RoutingResult, file: File, project: Project | null) => void;
}

export default function RoutingForm({ onAnalysisComplete }: RoutingFormProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-detect template from selected project
      const project = projects.find(p => p.id === selectedProject);
      if (project && !selectedTemplate) {
        setSelectedTemplate(project.template);
      }
    }
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Errore",
        description: "Seleziona un file per continuare",
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
        title: "Analisi in corso",
        description: "Il sistema AI sta analizzando il file...",
      });
      
      // Use AI router to analyze the file
      const result = await aiRouter.routeFile(selectedFile, template, selectedProject || undefined);
      
      // Call parent callback with results
      onAnalysisComplete(result, selectedFile, project);
      
      toast({
        title: "Analisi completata",
        description: `Suggerimento generato con confidenza ${Math.round(result.confidence * 100)}%`,
      });
      
    } catch (error) {
      console.error('Routing analysis failed:', error);
      toast({
        title: "Errore nell'analisi",
        description: "Si è verificato un errore durante l'analisi del file",
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Auto-Routing Intelligente</h2>
          <p className="text-gray-600">Sistema di suggerimento automatico per posizionamento file</p>
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
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              data-testid="file-upload"
            />
            <div className="text-4xl mb-4">📄</div>
            <p className="text-gray-600 mb-2">
              {selectedFile ? selectedFile.name : "Trascina qui i file o clicca per selezionare"}
            </p>
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
            onClick={handleAnalyzeFile}
            disabled={!selectedFile || isAnalyzing}
            className="button-g2-primary disabled:opacity-50"
            data-testid="analyze-file"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analizzando...
              </>
            ) : (
              "🔍 Analizza e Suggerisci Percorso"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
