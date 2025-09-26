import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Project, type OneDriveMapping, type ProjectMetadata } from "@shared/schema";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import EditProjectForm from "./edit-project-form";
import { 
  renderPrestazioneBadge, 
  formatImporto, 
  renderClasseDMColumn,
  PRESTAZIONI_CONFIG,
  type PrestazioneType 
} from "@/lib/prestazioni-utils";

export default function ProjectsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectForPrestazioni, setSelectedProjectForPrestazioni] = useState<Project | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, refetch } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // OneDrive integration
  const { data: oneDriveMappings = [] } = useQuery<OneDriveMapping[]>({
    queryKey: ["/api/onedrive/mappings"],
  });

  const {
    isConnected: isOneDriveConnected,
    syncProject,
    getSyncStatus,
    isSyncing
  } = useOneDriveSync();

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Commessa eliminata",
        description: "La commessa è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onedrive/mappings"] });
    },
    onError: () => {
      toast({
        title: "Errore nell'eliminazione",
        description: "Si è verificato un errore durante l'eliminazione della commessa",
        variant: "destructive",
      });
    },
  });

  const filteredProjects = projects.filter(project =>
    project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.object.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteProject = (project: Project) => {
    if (confirm(`Sei sicuro di voler eliminare la commessa ${project.code}?`)) {
      deleteProjectMutation.mutate(project.id);
    }
  };

  const handleExportProject = (project: Project) => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Esportazione completata",
      description: `Commessa ${project.code} esportata con successo`,
    });
  };

  // Handler for opening prestazioni modal
  const handleOpenPrestazioniModal = (project: Project) => {
    setSelectedProjectForPrestazioni(project);
  };

  const handleClosePrestazioniModal = () => {
    setSelectedProjectForPrestazioni(null);
  };

  // OneDrive helper functions
  const getOneDriveMapping = (projectCode: string): OneDriveMapping | undefined => {
    return oneDriveMappings.find(mapping => mapping.projectCode === projectCode);
  };

  const getOneDriveStatus = (project: Project) => {
    const mapping = getOneDriveMapping(project.code);
    const syncStatus = getSyncStatus(project.id);
    
    if (!isOneDriveConnected) {
      return { status: 'disconnected', label: 'OneDrive non collegato', icon: '🔌', color: 'text-gray-500' };
    }
    
    if (syncStatus.status === 'pending') {
      return { status: 'syncing', label: 'In sincronizzazione...', icon: '🔄', color: 'text-blue-600' };
    }
    
    if (syncStatus.status === 'error') {
      return { status: 'error', label: 'Errore sync', icon: '❌', color: 'text-red-600' };
    }
    
    if (!mapping) {
      return { status: 'not_configured', label: 'Non configurato', icon: '⚠️', color: 'text-yellow-600' };
    }
    
    return { status: 'synced', label: 'Sincronizzato', icon: '✅', color: 'text-green-600' };
  };

  const handleConfigureOneDrive = (project: Project) => {
    if (!isOneDriveConnected) {
      toast({
        title: "OneDrive non collegato",
        description: "Configura prima la connessione OneDrive nelle impostazioni",
        variant: "destructive",
      });
      return;
    }
    
    syncProject(project.id);
  };

  const handleOpenOneDriveFolder = (mapping: OneDriveMapping) => {
    // Construct OneDrive web URL
    const oneDriveBaseUrl = "https://onedrive.live.com/?id=";
    const folderUrl = `${oneDriveBaseUrl}${mapping.oneDriveFolderId}&cid=${mapping.oneDriveFolderId}`;
    window.open(folderUrl, '_blank');
    
    toast({
      title: "OneDrive aperto",
      description: `Cartella ${mapping.oneDriveFolderName} aperta in OneDrive`,
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl">⏳</div>
        <p>Caricamento commesse...</p>
      </div>
    );
  }

  return (
    <div data-testid="projects-table">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Tutte le Commesse</h3>
        <div className="flex gap-3">
          <div className="relative">
            <Input
              placeholder="Cerca commesse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              data-testid="search-projects"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-lg">🔍</span>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="button-g2-secondary"
            data-testid="refresh-projects"
          >
            🔄 Aggiorna
          </Button>
        </div>
      </div>
      
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">📁</div>
          <p className="text-lg font-medium">
            {searchTerm ? "Nessuna commessa trovata" : "Nessuna commessa presente"}
          </p>
          <p className="text-sm">
            {searchTerm ? "Prova a modificare i criteri di ricerca" : "Crea la prima commessa per iniziare"}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm rounded-tl-lg w-24">Codice</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-32">Cliente</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-24">Città</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-40">Oggetto</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-48 bg-green-50 border-l-4 border-green-400">
                    Prestazioni 
                    <span className="ml-1 text-xs text-gray-500 cursor-help" title="Tipologia di servizi professionali">ⓘ</span>
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-32 bg-green-50 border-r-4 border-green-400">
                    Classe DM 143/2013
                    <span className="ml-1 text-xs text-gray-500 cursor-help" title="Classificazione tariffa professionale">ⓘ</span>
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-16">Anno</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-20">Template</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-24">Stato</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-48">OneDrive</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm rounded-tr-lg w-32">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 font-mono text-sm font-semibold text-primary" data-testid={`project-code-${project.id}`}>
                      {project.code}
                    </td>
                    <td className="py-4 px-4 text-sm" data-testid={`project-client-${project.id}`}>
                      {project.client}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600" data-testid={`project-city-${project.id}`}>
                      {project.city}
                    </td>
                    <td className="py-4 px-4 text-sm" data-testid={`project-object-${project.id}`}>
                      {project.object}
                    </td>
                    {/* Colonna Prestazioni */}
                    <td className="py-4 px-4 bg-green-50 border-l-4 border-green-400" data-testid={`project-prestazioni-${project.id}`}>
                      <div className="flex flex-wrap gap-1">
                        {((project.metadata as ProjectMetadata)?.prestazioni || []).map((prestazione) => {
                          const badge = renderPrestazioneBadge(prestazione as PrestazioneType, 'sm');
                          return (
                            <span 
                              key={prestazione}
                              className={badge.className}
                              title={badge.fullLabel}
                            >
                              {badge.icon} {badge.label}
                            </span>
                          );
                        })}
                        {!(project.metadata as ProjectMetadata)?.prestazioni?.length && (
                          <span className="text-xs text-gray-400 italic">Non specificate</span>
                        )}
                      </div>
                    </td>
                    {/* Colonna Classe DM 143/2013 */}
                    <td className="py-4 px-4 bg-green-50 border-r-4 border-green-400" data-testid={`project-classe-dm-${project.id}`}>
                      {(() => {
                        const metadata = project.metadata as ProjectMetadata;
                        const classeDM = renderClasseDMColumn(metadata?.classeDM143, metadata?.importoOpere);
                        return (
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                              classeDM.isFormatted ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {classeDM.classe}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {classeDM.importo}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600" data-testid={`project-year-${project.id}`}>
                      20{project.year.toString().padStart(2, '0')}
                    </td>
                    <td className="py-4 px-4" data-testid={`project-template-${project.id}`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        project.template === 'LUNGO' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {project.template}
                      </span>
                    </td>
                    <td className="py-4 px-4" data-testid={`project-status-${project.id}`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        project.status === 'in_corso' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : project.status === 'conclusa'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {project.status === 'in_corso' ? '🟡 In Corso' : 
                         project.status === 'conclusa' ? '🟢 Conclusa' : 
                         '🔴 Sospesa'}
                      </span>
                    </td>
                    <td className="py-4 px-4" data-testid={`project-onedrive-${project.id}`}>
                      {(() => {
                        const mapping = getOneDriveMapping(project.code);
                        const status = getOneDriveStatus(project);
                        
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${status.color}`} title={status.label}>
                              {status.icon}
                            </span>
                            
                            {mapping ? (
                              <div className="flex flex-col gap-1 min-w-0">
                                <button
                                  onClick={() => handleOpenOneDriveFolder(mapping)}
                                  className="text-blue-600 hover:text-blue-800 text-xs underline text-left truncate"
                                  title={`Apri cartella: ${mapping.oneDriveFolderPath}`}
                                  data-testid={`onedrive-link-${project.id}`}
                                >
                                  📁 {mapping.oneDriveFolderName}
                                </button>
                                <span className="text-xs text-gray-500 truncate" title={mapping.oneDriveFolderPath}>
                                  {mapping.oneDriveFolderPath}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 min-w-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleConfigureOneDrive(project)}
                                  disabled={!isOneDriveConnected || isSyncing}
                                  className="text-xs h-6 px-2 whitespace-nowrap"
                                  title={!isOneDriveConnected ? "OneDrive non collegato" : "Configura OneDrive per questo progetto"}
                                  data-testid={`configure-onedrive-${project.id}`}
                                >
                                  {isSyncing ? '🔄' : '⚙️'} Configura
                                </Button>
                                <span className="text-xs text-gray-400 truncate">
                                  Non configurato
                                </span>
                              </div>
                            )}
                            
                            {status.status === 'error' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleConfigureOneDrive(project)}
                                className="text-xs h-6 px-1 text-orange-600 hover:text-orange-800"
                                title="Riprova sincronizzazione"
                                data-testid={`retry-sync-${project.id}`}
                              >
                                🔄
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <EditProjectForm project={project}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifica"
                            data-testid={`edit-project-${project.id}`}
                          >
                            ✏️
                          </Button>
                        </EditProjectForm>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportProject(project)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Esporta"
                          data-testid={`export-project-${project.id}`}
                        >
                          📄
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenPrestazioniModal(project)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Dettagli Prestazioni"
                          data-testid={`prestazioni-details-${project.id}`}
                        >
                          🏗️
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteProject(project)}
                          disabled={deleteProjectMutation.isPending}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Elimina"
                          data-testid={`delete-project-${project.id}`}
                        >
                          🗑️
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 flex justify-between items-center text-sm text-gray-500">
            <span data-testid="projects-count">
              Mostrando <strong>{filteredProjects.length}</strong> di <strong>{projects.length}</strong> commesse
            </span>
          </div>
        </>
      )}
      
      {/* TODO: Prestazioni Modal Placeholder - Will be implemented in Task 5 */}
      {selectedProjectForPrestazioni && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Prestazioni per {selectedProjectForPrestazioni.code}
            </h3>
            <p className="text-gray-600 mb-4">
              Modal prestazioni in implementazione...
            </p>
            <Button onClick={handleClosePrestazioniModal}>
              Chiudi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
