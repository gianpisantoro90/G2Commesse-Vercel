import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PROJECT_TEMPLATES } from "@/lib/file-system";

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
  const [rootHandle, setRootHandle] = useState<any>(null);
  const { toast } = useToast();

  const structure = pendingProject ? getTemplateStructure(pendingProject.template) : {};

  const handleCreateStructure = async () => {
    if (!pendingProject || !rootHandle) {
      toast({
        title: "Dati mancanti",
        description: "Selezionare una commessa salvata e una cartella radice",
        variant: "destructive",
      });
      return;
    }

    try {
      const { sanitizeFileName } = await import("@/lib/file-system");
      const folderName = sanitizeFileName(`${pendingProject.code}_${pendingProject.object}`);
      
      console.log('🚀 Starting folder creation process');
      console.log('📁 Project folder name:', folderName);
      console.log('📋 Template structure:', structure);
      console.log('🎯 Root handle:', rootHandle);
      
      // Check if we're in a local environment (detect by checking if we're on localhost)
      const isLocalEnvironment = window.location.hostname === 'localhost' || 
                                 window.location.hostname === '127.0.0.1' ||
                                 window.location.hostname.includes('replit.dev');
      
      console.log('🏠 Environment detected:', isLocalEnvironment ? 'Local/Replit' : 'Web');
      
      // Create main project folder with extra validation for local environments
      const projectHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
      console.log('✅ Main project folder created:', folderName);
      
      // Create subfolder structure using centralized function
      const { createFolderStructure } = await import("@/lib/file-system");
      await createFolderStructure(projectHandle, structure);
      console.log('✅ Complete folder structure created successfully');
      
      toast({
        title: "Struttura creata",
        description: `Struttura cartelle creata con successo: ${folderName}`,
      });
    } catch (error: any) {
      console.error('❌ Folder creation error:', error);
      console.error('❌ Complete error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack,
        toString: error.toString()
      });
      
      // Provide specific error messages based on error type
      let errorMessage = 'Errore sconosciuto nella creazione cartelle';
      if (error.message?.includes('Name is not allowed')) {
        errorMessage = 'Nome cartella non valido per il sistema operativo locale. Prova con un nome progetto più semplice.';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'Permessi insufficienti. Assicurati di selezionare una cartella con permessi di scrittura.';
      } else if (error.message?.includes('not supported')) {
        errorMessage = 'File System API non supportato in questo browser. Usa Chrome/Edge più recente.';
      }
      
      toast({
        title: "Errore nella creazione",
        description: errorMessage,
        variant: "destructive",
      });
    }
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

    const folderName = `${pendingProject.code}_${pendingProject.object.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')}`;
    
    // Generate batch script
    const batCommands = [`mkdir "${folderName}"`];
    const generateBatCommands = (struct: any, path = folderName) => {
      Object.keys(struct).forEach(key => {
        const fullPath = `${path}\\${key}`;
        batCommands.push(`mkdir "${fullPath}"`);
        if (struct[key] && typeof struct[key] === 'object' && Object.keys(struct[key]).length > 0) {
          generateBatCommands(struct[key], fullPath);
        }
      });
    };
    generateBatCommands(structure);

    // Generate shell script
    const shCommands = [`mkdir -p "${folderName}"`];
    const generateShCommands = (struct: any, path = folderName) => {
      Object.keys(struct).forEach(key => {
        const fullPath = `${path}/${key}`;
        shCommands.push(`mkdir -p "${fullPath}"`);
        if (struct[key] && typeof struct[key] === 'object' && Object.keys(struct[key]).length > 0) {
          generateShCommands(struct[key], fullPath);
        }
      });
    };
    generateShCommands(structure);

    // Download batch file
    const batBlob = new Blob([batCommands.join('\r\n')], { type: 'text/plain' });
    const batUrl = URL.createObjectURL(batBlob);
    const batA = document.createElement('a');
    batA.href = batUrl;
    batA.download = `${pendingProject.code}_create_dirs.bat`;
    batA.click();
    URL.revokeObjectURL(batUrl);

    // Download shell script
    const shBlob = new Blob([shCommands.join('\n')], { type: 'text/plain' });
    const shUrl = URL.createObjectURL(shBlob);
    const shA = document.createElement('a');
    shA.href = shUrl;
    shA.download = `${pendingProject.code}_create_dirs.sh`;
    shA.click();
    URL.revokeObjectURL(shUrl);

    toast({
      title: "Script scaricati",
      description: "Gli script di creazione cartelle sono stati scaricati",
    });
  };

  const handleSelectFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      toast({
        title: "API non supportata",
        description: "File System Access API non disponibile in questo browser",
        variant: "destructive",
      });
      return;
    }

    try {
      // @ts-ignore - showDirectoryPicker is not in types yet
      const dirHandle = await showDirectoryPicker({ mode: 'readwrite' });
      setRootHandle(dirHandle);
    } catch (error) {
      // User cancelled the picker
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
              <div>📁 {pendingProject.code}_{pendingProject.object}/</div>
              <div className="ml-4">
                {renderStructurePreview(structure, 1)}
              </div>
            </>
          ) : (
            <div className="text-gray-400">Salvare prima una commessa per vedere l'anteprima</div>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          onClick={handleSelectFolder}
          className="button-g2-secondary"
          data-testid="button-select-root-folder"
        >
          📁 Seleziona Cartella Radice
        </Button>
        {rootHandle && (
          <span className="text-sm text-gray-600 flex items-center" data-testid="selected-root-folder">
            Cartella selezionata: <strong>{rootHandle.name}</strong>
          </span>
        )}
      </div>
      
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleCreateStructure}
          disabled={!pendingProject || !rootHandle}
          className="button-g2-primary disabled:opacity-50"
          data-testid="button-create-structure"
        >
          🏗️ Crea Struttura
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
        ℹ️ La struttura verrà creata nella cartella selezionata con il nome <span className="font-mono bg-gray-100 px-2 py-1 rounded">[CODICE]_[OGGETTO]</span>
      </div>
    </div>
  );
}
