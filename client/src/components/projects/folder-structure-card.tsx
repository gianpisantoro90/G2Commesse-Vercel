import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PROJECT_TEMPLATES, downloadScriptFiles } from "@/lib/file-system";
import { AlertCircle } from "lucide-react";

interface FolderStructureCardProps {
  pendingProject: any;
}

const getTemplateStructure = (template: string) => {
  const templateData = PROJECT_TEMPLATES[template];
  console.log('Getting template structure for:', template, 'Found:', templateData);
  return templateData ? templateData.structure : {};
};

const renderStructurePreview = (structure: any, indent = 0) => {
  return Object.keys(structure).map(key => (
    <div key={key} className={`ml-${indent * 4}`}>
      <div className="font-mono text-xs text-gray-700">
        📁 {key}/
      </div>
      {structure[key] && typeof structure[key] === 'object' && Object.keys(structure[key]).length > 0 && 
        renderStructurePreview(structure[key], indent + 1)
      }
    </div>
  ));
};

export default function FolderStructureCard({ pendingProject }: FolderStructureCardProps) {
  const { toast } = useToast();
  const structure = pendingProject ? getTemplateStructure(pendingProject.template) : {};

  const handleCreateStructure = async () => {
    if (!pendingProject) {
      toast({
        title: "Funzionalità OneDrive",
        description: "Usa OneDrive per creare le strutture cartelle delle commesse",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Usa OneDrive",
      description: "Le cartelle vengono create direttamente in OneDrive. Usa gli script fallback per creare la struttura localmente.",
    });
  };

  const handleDownloadScripts = () => {
    if (!pendingProject) {
      toast({
        title: "Nessuna commessa",
        description: "Salvare prima una commessa",
        variant: "destructive",
      });
      return;
    }

    try {
      downloadScriptFiles(pendingProject.code, pendingProject.object, pendingProject.template);
      toast({
        title: "Script scaricati",
        description: "Gli script di creazione cartelle sono stati scaricati",
      });
    } catch (error) {
      console.error('Error downloading scripts:', error);
      toast({
        title: "Errore",
        description: "Errore durante il download degli script",
        variant: "destructive",
      });
    }
  };


  return (
    <div className="card-g2" data-testid="folder-structure-card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Creazione Struttura Cartelle</h3>
      
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-sm text-gray-600 mb-2"><strong>Anteprima struttura:</strong></p>
        <div className="font-mono text-xs text-gray-700 space-y-1 max-h-60 overflow-y-auto" data-testid="structure-preview">
          {pendingProject ? (
            <>
              <div>📁 {pendingProject.code}_{pendingProject.object.replace(/\s+/g, '_')}/</div>
              <div className="ml-4">
                {renderStructurePreview(structure, 1)}
              </div>
            </>
          ) : (
            <div className="text-gray-400">Salvare prima una commessa per vedere l'anteprima</div>
          )}
        </div>
      </div>
      
      {/* Stato OneDrive */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          <div>
            <span className="text-sm font-medium text-blue-700">Sistema OneDrive Attivo</span>
            <div className="text-xs text-gray-600">Le cartelle vengono create direttamente in OneDrive o tramite script locali</div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleCreateStructure}
          disabled={!pendingProject}
          className="button-g2-primary disabled:opacity-50"
          data-testid="button-create-structure"
        >
          📁 OneDrive Info
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadScripts}
          disabled={!pendingProject}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          data-testid="button-download-scripts"
        >
          📜 Script Fallback
        </Button>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        ℹ️ Usa OneDrive per gestire le cartelle o scarica gli script per creare la struttura <span className="font-mono bg-gray-100 px-2 py-1 rounded">[CODICE]_[OGGETTO]</span> localmente
      </div>
    </div>
  );
}
