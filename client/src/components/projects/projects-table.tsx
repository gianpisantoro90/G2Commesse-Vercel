import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Project, type OneDriveMapping, type ProjectMetadata, type Communication, type Deadline } from "@shared/schema";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import EditProjectForm from "./edit-project-form";
import PrestazioniModal from "./prestazioni-modal";
import FatturazioneModal from "./fatturazione-modal";
import { 
  renderPrestazioneBadge, 
  formatImporto, 
  renderClasseDMColumn,
  renderLivelliProgettazioneColumn,
  renderTipoRapportoBadge,
  PRESTAZIONI_CONFIG,
  type PrestazioneType,
  type TipoRapportoType 
} from "@/lib/prestazioni-utils";

export default function ProjectsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [selectedProjectForPrestazioni, setSelectedProjectForPrestazioni] = useState<Project | null>(null);
  const [selectedProjectForFatturazione, setSelectedProjectForFatturazione] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Column visibility toggles
  const [showTechInfo, setShowTechInfo] = useState(false);
  const [showPrestazioni, setShowPrestazioni] = useState(false);
  const [showFatturazione, setShowFatturazione] = useState(true);
  const [showComunicazioni, setShowComunicazioni] = useState(true);
  const [showScadenze, setShowScadenze] = useState(true);
  const [showOneDrive, setShowOneDrive] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, refetch } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Load communications
  const { data: communications = [] } = useQuery<Communication[]>({
    queryKey: ["/api/communications"],
  });

  // Load deadlines
  const { data: deadlines = [] } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
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

  // Get unique years from projects
  const availableYears = Array.from(new Set(projects.map(p => p.year))).sort((a, b) => b - a);

  const filteredProjects = projects.filter(project => {
    // Text search filter
    const matchesSearch = searchTerm === "" ||
      project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.object.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;

    // Year filter
    const matchesYear = yearFilter === "all" || project.year === parseInt(yearFilter);

    return matchesSearch && matchesStatus && matchesYear;
  });

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
  };

  const confirmDeleteProject = () => {
    if (projectToDelete) {
      deleteProjectMutation.mutate(projectToDelete.id);
      setProjectToDelete(null);
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

  // Communication helper function
  const getLastCommunication = (projectId: string): Communication | undefined => {
    const projectComms = communications
      .filter(comm => comm.projectId === projectId)
      .sort((a, b) => new Date(b.communicationDate).getTime() - new Date(a.communicationDate).getTime());
    return projectComms[0];
  };

  // Deadline helper function - get next upcoming deadline
  const getNextDeadline = (projectId: string): Deadline | undefined => {
    const now = new Date();
    const projectDeadlines = deadlines
      .filter(deadline => deadline.projectId === projectId && deadline.status === 'pending')
      .filter(deadline => new Date(deadline.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return projectDeadlines[0];
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
      <div data-testid="projects-table-loading">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 items-center p-4 bg-white rounded-lg border border-gray-100">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-40 flex-1" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="projects-table">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Tutte le Commesse</h3>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="button-g2-secondary"
            data-testid="refresh-projects"
          >
            🔄 Aggiorna
          </Button>
        </div>

        {/* Column Toggle Buttons */}
        <div className="flex gap-2 flex-wrap items-center mb-4 pb-3 border-b border-gray-200">
          <span className="text-sm text-gray-600 font-medium mr-2">Mostra colonne:</span>
          <Button
            size="sm"
            variant={showTechInfo ? "default" : "outline"}
            onClick={() => setShowTechInfo(!showTechInfo)}
            className="text-xs"
          >
            ⚙️ Info Tecniche
          </Button>
          <Button
            size="sm"
            variant={showPrestazioni ? "default" : "outline"}
            onClick={() => setShowPrestazioni(!showPrestazioni)}
            className="text-xs"
          >
            📋 Prestazioni/DM143
          </Button>
          <Button
            size="sm"
            variant={showFatturazione ? "default" : "outline"}
            onClick={() => setShowFatturazione(!showFatturazione)}
            className="text-xs"
          >
            💰 Fatturazione
          </Button>
          <Button
            size="sm"
            variant={showComunicazioni ? "default" : "outline"}
            onClick={() => setShowComunicazioni(!showComunicazioni)}
            className="text-xs"
          >
            💬 Comunicazioni
          </Button>
          <Button
            size="sm"
            variant={showScadenze ? "default" : "outline"}
            onClick={() => setShowScadenze(!showScadenze)}
            className="text-xs"
          >
            📅 Scadenze
          </Button>
          <Button
            size="sm"
            variant={showOneDrive ? "default" : "outline"}
            onClick={() => setShowOneDrive(!showOneDrive)}
            className="text-xs"
          >
            ☁️ OneDrive
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Input
              placeholder="Cerca per codice, cliente, città, oggetto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              data-testid="search-projects"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-lg">🔍</span>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="filter-status">
              <SelectValue placeholder="Tutti gli stati" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="in_corso">✅ In Corso</SelectItem>
              <SelectItem value="sospesa">⏸️ Sospesa</SelectItem>
              <SelectItem value="conclusa">🏁 Conclusa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[150px]" data-testid="filter-year">
              <SelectValue placeholder="Tutti gli anni" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli anni</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  20{year.toString().padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(statusFilter !== "all" || yearFilter !== "all" || searchTerm !== "") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setYearFilter("all");
                setSearchTerm("");
              }}
              className="text-gray-500 hover:text-gray-700"
              data-testid="clear-filters"
            >
              ✕ Pulisci filtri
            </Button>
          )}
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
                  {showTechInfo && (
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-28">
                      Tipo Rapporto
                      <span className="ml-1 text-xs text-gray-500 cursor-help" title="Chi commissiona il lavoro a G2 Ingegneria">ⓘ</span>
                    </th>
                  )}
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-24">Città</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-40">Oggetto</th>
                  {showPrestazioni && (
                    <>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-48">
                        Prestazioni
                        <span className="ml-1 text-xs text-gray-500 cursor-help" title="Tipologia di servizi professionali">ⓘ</span>
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-40">
                        Livelli Progettazione
                        <span className="ml-1 text-xs text-gray-500 cursor-help" title="Livelli di progettazione DM 143/2013">ⓘ</span>
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-32">
                        Classe DM 143/2013
                        <span className="ml-1 text-xs text-gray-500 cursor-help" title="Classificazione tariffa professionale">ⓘ</span>
                      </th>
                    </>
                  )}
                  {showTechInfo && (
                    <>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-16">Anno</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-20">Template</th>
                    </>
                  )}
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-24">Stato</th>
                  {showFatturazione && (
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-32">
                      Fatturazione
                      <span className="ml-1 text-xs text-gray-500 cursor-help" title="Stato fatturazione e pagamento">ⓘ</span>
                    </th>
                  )}
                  {showComunicazioni && (
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-48">
                      Ultima Comunicazione
                      <span className="ml-1 text-xs text-gray-500 cursor-help" title="Ultima comunicazione relativa alla commessa">ⓘ</span>
                    </th>
                  )}
                  {showScadenze && (
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-40">
                      Prossima Scadenza
                      <span className="ml-1 text-xs text-gray-500 cursor-help" title="Prossima scadenza in programma">ⓘ</span>
                    </th>
                  )}
                  {showOneDrive && (
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm w-48">OneDrive</th>
                  )}
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
                      <div>
                        <div className="font-medium">{project.client}</div>
                        {project.committenteFinale && project.tipoRapporto !== "diretto" && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            ↳ Per: {project.committenteFinale}
                          </div>
                        )}
                      </div>
                    </td>
                    {showTechInfo && (
                      <td className="py-4 px-4" data-testid={`project-tipo-rapporto-${project.id}`}>
                        {(() => {
                          const tipoRapporto = project.tipoRapporto || "diretto";
                          const badge = renderTipoRapportoBadge(tipoRapporto as TipoRapportoType, 'sm');
                          return (
                            <span
                              className={badge.className}
                              title={badge.description}
                            >
                              {badge.icon} {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    <td className="py-4 px-4 text-sm text-gray-600" data-testid={`project-city-${project.id}`}>
                      {project.city}
                    </td>
                    <td className="py-4 px-4 text-sm" data-testid={`project-object-${project.id}`}>
                      {project.object}
                    </td>
                    {showPrestazioni && (
                      <>
                        {/* Colonna Prestazioni */}
                        <td className="py-4 px-4" data-testid={`project-prestazioni-${project.id}`}>
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
                        {/* Colonna Livelli Progettazione */}
                        <td className="py-4 px-4" data-testid={`project-livelli-progettazione-${project.id}`}>
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const metadata = project.metadata as ProjectMetadata;
                              const livelliBadges = renderLivelliProgettazioneColumn(
                                metadata?.prestazioni,
                                metadata?.livelloProgettazione
                              );

                              if (livelliBadges.length === 0) {
                                return <span className="text-xs text-gray-400 italic">-</span>;
                              }

                              return livelliBadges.map((badge, index) => (
                                <span
                                  key={index}
                                  className={badge.className}
                                  title={badge.fullLabel}
                                >
                                  {badge.icon} {badge.label}
                                </span>
                              ));
                            })()}
                          </div>
                        </td>
                        {/* Colonna Classe DM 143/2013 */}
                        <td className="py-4 px-4" data-testid={`project-classe-dm-${project.id}`}>
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
                      </>
                    )}
                    {showTechInfo && (
                      <>
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
                      </>
                    )}
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
                    {showFatturazione && (
                      <td className="py-4 px-4" data-testid={`project-fatturazione-${project.id}`}>
                        <div
                          className="flex flex-col gap-1 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                          onClick={() => setSelectedProjectForFatturazione(project)}
                          title="Clicca per gestire fatturazione"
                        >
                          {project.fatturato ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                                ✓ Fatturato
                              </span>
                              {project.importoFatturato && project.importoFatturato > 0 && (
                                <span className="text-xs text-gray-600">
                                  €{(project.importoFatturato / 100).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Non fatturato</span>
                          )}
                          {project.pagato && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                              ✓ Pagato
                            </span>
                          )}
                          {project.fatturato && !project.pagato && (
                            <span className="text-xs text-orange-600 font-medium">⏳ Da incassare</span>
                          )}
                        </div>
                      </td>
                    )}
                    {showComunicazioni && (
                      <td className="py-4 px-4" data-testid={`project-last-communication-${project.id}`}>
                        {(() => {
                          const lastComm = getLastCommunication(project.id);
                          if (!lastComm) {
                            return <span className="text-xs text-gray-400 italic">Nessuna comunicazione</span>;
                          }

                          const commDate = new Date(lastComm.communicationDate);
                          const icon = lastComm.direction === 'in' ? '📩' : '📤';
                          const typeLabel = lastComm.type === 'email' ? 'Email' :
                                           lastComm.type === 'pec' ? 'PEC' :
                                           lastComm.type === 'phone' ? 'Tel' :
                                           lastComm.type === 'meeting' ? 'Riunione' : 'Altro';

                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <span title={lastComm.direction === 'in' ? 'In entrata' : 'In uscita'}>{icon}</span>
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded font-medium">
                                  {typeLabel}
                                </span>
                                {lastComm.isImportant && (
                                  <span className="text-red-500" title="Comunicazione importante">⚠️</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 truncate max-w-[200px]" title={lastComm.subject}>
                                {lastComm.subject}
                              </div>
                              <div className="text-xs text-gray-400">
                                {commDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    )}
                    {showScadenze && (
                      <td className="py-4 px-4" data-testid={`project-next-deadline-${project.id}`}>
                        {(() => {
                          const nextDeadline = getNextDeadline(project.id);
                          if (!nextDeadline) {
                            return <span className="text-xs text-gray-400 italic">Nessuna scadenza</span>;
                          }

                          const dueDate = new Date(nextDeadline.dueDate);
                          const now = new Date();
                          const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                          const priorityConfig: Record<string, { color: string; icon: string }> = {
                            low: { color: 'bg-gray-100 text-gray-700', icon: '🟢' },
                            medium: { color: 'bg-blue-100 text-blue-700', icon: '🟡' },
                            high: { color: 'bg-orange-100 text-orange-700', icon: '🟠' },
                            urgent: { color: 'bg-red-100 text-red-700', icon: '🔴' }
                          };

                          const typeIcon: Record<string, string> = {
                            general: '📌',
                            deposito: '📝',
                            collaudo: '✅',
                            scadenza_assicurazione: '🛡️',
                            milestone: '🎯'
                          };

                          const priority = priorityConfig[nextDeadline.priority];

                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <span>{typeIcon[nextDeadline.type] || '📌'}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.color}`}>
                                  {priority.icon} {nextDeadline.priority === 'low' ? 'Bassa' :
                                     nextDeadline.priority === 'medium' ? 'Media' :
                                     nextDeadline.priority === 'high' ? 'Alta' : 'Urgente'}
                                </span>
                              </div>
                              <div className="text-xs font-medium text-gray-700 truncate max-w-[180px]" title={nextDeadline.title}>
                                {nextDeadline.title}
                              </div>
                              <div className={`text-xs font-medium ${daysUntil <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                                {dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                {daysUntil <= 7 && <span className="ml-1">⚠️ {daysUntil}gg</span>}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    )}
                    {showOneDrive && (
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
                    )}
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
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
      
      {/* Prestazioni Modal */}
      {selectedProjectForPrestazioni && (
        <PrestazioniModal
          project={selectedProjectForPrestazioni}
          isOpen={true}
          onClose={handleClosePrestazioniModal}
        />
      )}

      {/* Fatturazione Modal */}
      <FatturazioneModal
        project={selectedProjectForFatturazione}
        open={!!selectedProjectForFatturazione}
        onClose={() => setSelectedProjectForFatturazione(null)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la commessa?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>Sei sicuro di voler eliminare questa commessa?</div>
              {projectToDelete && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="font-mono font-semibold text-primary text-sm mb-1">
                    {projectToDelete.code}
                  </div>
                  <div className="text-sm text-gray-700">
                    <strong>{projectToDelete.client}</strong> - {projectToDelete.city}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {projectToDelete.object}
                  </div>
                </div>
              )}
              <div className="text-red-600 font-medium mt-2">
                ⚠️ Questa azione non può essere annullata.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Elimina commessa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
