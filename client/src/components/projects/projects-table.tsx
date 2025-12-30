import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
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
import { type Project, type OneDriveMapping, type ProjectMetadata, type Communication, type Deadline, type ProjectPrestazione } from "@shared/schema";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import EditProjectForm from "./edit-project-form";
import PrestazioniModal from "./prestazioni-modal";
import CREGenerator from "./cre-generator";
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

type SortField = "code" | "client" | "city" | "object" | "year" | "status";
type SortOrder = "asc" | "desc";

export default function ProjectsTable() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [creFilter, setCreFilter] = useState<string>("all"); // 'all', 'archiviato', 'non_archiviato'
  const [selectedProjectForPrestazioni, setSelectedProjectForPrestazioni] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 25 | 50>(10);

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [sortByStatus, setSortByStatus] = useState(true);

  // Column visibility toggles
  const [showTechInfo, setShowTechInfo] = useState(false);
  const [showPrestazioni, setShowPrestazioni] = useState(false);
  const [showFatturazione, setShowFatturazione] = useState(false);
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

  // Load prestazioni for fatturazione column
  const { data: allPrestazioni = [] } = useQuery<ProjectPrestazione[]>({
    queryKey: ["/api/prestazioni"],
    enabled: showFatturazione && isAdmin,
  });

  // Aggregate prestazioni stats by project
  const prestazioniByProject = allPrestazioni.reduce((acc, p) => {
    if (!acc[p.projectId]) {
      acc[p.projectId] = {
        totale: 0,
        completate: 0,
        fatturate: 0,
        pagate: 0,
        importoPrevisto: 0,
        importoFatturato: 0,
        importoPagato: 0,
      };
    }
    acc[p.projectId].totale++;
    if (p.stato === 'completata' || p.stato === 'fatturata' || p.stato === 'pagata') {
      acc[p.projectId].completate++;
    }
    if (p.stato === 'fatturata' || p.stato === 'pagata') {
      acc[p.projectId].fatturate++;
      acc[p.projectId].importoFatturato += p.importoFatturato || 0;
    }
    if (p.stato === 'pagata') {
      acc[p.projectId].pagate++;
      acc[p.projectId].importoPagato += p.importoPagato || 0;
    }
    acc[p.projectId].importoPrevisto += p.importoPrevisto || 0;
    return acc;
  }, {} as Record<string, { totale: number; completate: number; fatturate: number; pagate: number; importoPrevisto: number; importoFatturato: number; importoPagato: number }>);

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

  // Toggle CRE archival status
  const toggleCREMutation = useMutation({
    mutationFn: async ({ projectId, archiviato }: { projectId: string; archiviato: boolean }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/cre/archiviato`, { archiviato });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.archiviato ? "CRE archiviato" : "CRE rimosso dall'archivio",
        description: variables.archiviato
          ? "Il CRE firmato è stato segnato come ricevuto"
          : "Lo stato di archiviazione CRE è stato rimosso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore nell'aggiornamento dello stato CRE",
        variant: "destructive",
      });
    },
  });

  const handleToggleCRE = (project: Project) => {
    toggleCREMutation.mutate({
      projectId: project.id,
      archiviato: !project.creArchiviato,
    });
  };

  // Get unique years from projects
  const availableYears = Array.from(new Set(projects.map(p => p.year))).sort((a, b) => b - a);

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle sort order if clicking same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline-block text-gray-400" />;
    }
    return sortOrder === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1 inline-block text-primary" />
      : <ArrowDown className="h-4 w-4 ml-1 inline-block text-primary" />;
  };

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

    // CRE filter
    const matchesCre = creFilter === "all" ||
      (creFilter === "archiviato" && project.creArchiviato) ||
      (creFilter === "non_archiviato" && !project.creArchiviato);

    return matchesSearch && matchesStatus && matchesYear && matchesCre;
  });

  // Sort filtered projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    // Primary sort: status priority (if enabled)
    if (sortByStatus) {
      const statusPriority = {
        'in corso': 1,
        'conclusa': 2,
        'sospesa': 3
      };
      
      const aStatusPriority = statusPriority[a.status as keyof typeof statusPriority] || 999;
      const bStatusPriority = statusPriority[b.status as keyof typeof statusPriority] || 999;
      
      if (aStatusPriority !== bStatusPriority) {
        return aStatusPriority - bStatusPriority;
      }
    }

    // Secondary sort: user-selected field
    if (!sortField) return 0;

    let aValue: string | number = "";
    let bValue: string | number = "";

    switch (sortField) {
      case "code":
        aValue = a.code;
        bValue = b.code;
        break;
      case "client":
        aValue = a.client.toLowerCase();
        bValue = b.client.toLowerCase();
        break;
      case "city":
        aValue = a.city.toLowerCase();
        bValue = b.city.toLowerCase();
        break;
      case "object":
        aValue = a.object.toLowerCase();
        bValue = b.object.toLowerCase();
        break;
      case "year":
        aValue = a.year;
        bValue = b.year;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProjects = sortedProjects.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: any) => void) => (value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
  };

  const confirmDeleteProject = () => {
    if (projectToDelete) {
      deleteProjectMutation.mutate(projectToDelete.id);
      setProjectToDelete(null);
    }
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
      .filter(deadline => deadline.projectId === projectId && deadline.status !== 'completed' && deadline.status !== 'cancelled')
      .sort((a, b) => {
        // Sort by priority: urgent > high > medium > low
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        // Then by date
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
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
            <div key={i} className="flex gap-4 items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tutte le Commesse</h3>
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
        <div className="flex gap-1.5 sm:gap-2 flex-wrap items-center mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400 font-medium mr-1 sm:mr-2">Opzioni:</span>
          <Button
            size="default"
            variant={sortByStatus ? "default" : "outline"}
            onClick={() => setSortByStatus(!sortByStatus)}
            className="text-xs min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2 sm:px-3"
            title={sortByStatus ? "Ordinamento per stato attivo (In corso → Sospesa → Conclusa)" : "Ordina per stato"}
            data-testid="toggle-sort-by-status"
          >
            {sortByStatus ? "📊" : "📋"} <span className="hidden sm:inline">Ordina per</span> Stato
          </Button>

          <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400 font-medium mr-1 sm:mr-2 ml-2 sm:ml-4">Mostra:</span>
          <Button
            size="default"
            variant={showTechInfo ? "default" : "outline"}
            onClick={() => setShowTechInfo(!showTechInfo)}
            className="text-xs min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2 sm:px-3"
          >
            ⚙️ <span className="hidden sm:inline">Info</span> Tech
          </Button>
          <Button
            size="default"
            variant={showPrestazioni ? "default" : "outline"}
            onClick={() => setShowPrestazioni(!showPrestazioni)}
            className="text-xs min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2 sm:px-3"
          >
            📋 <span className="hidden sm:inline">Prestazioni/</span>DM143
          </Button>
          {isAdmin && (
            <Button
              size="default"
              variant={showFatturazione ? "default" : "outline"}
              onClick={() => setShowFatturazione(!showFatturazione)}
              className="text-xs min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2 sm:px-3"
            >
              💰 Fatt.
            </Button>
          )}
          <Button
            size="default"
            variant={showComunicazioni ? "default" : "outline"}
            onClick={() => setShowComunicazioni(!showComunicazioni)}
            className="text-xs min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2 sm:px-3"
          >
            💬 <span className="hidden sm:inline">Comunicazioni</span><span className="sm:hidden">Msg</span>
          </Button>
          <Button
            size="default"
            variant={showScadenze ? "default" : "outline"}
            onClick={() => setShowScadenze(!showScadenze)}
            className="text-xs min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2 sm:px-3"
          >
            📅 <span className="hidden sm:inline">Scadenze</span><span className="sm:hidden">Scad.</span>
          </Button>
          <Button
            size="default"
            variant={showOneDrive ? "default" : "outline"}
            onClick={() => setShowOneDrive(!showOneDrive)}
            className="text-xs min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2 sm:px-3"
          >
            ☁️ <span className="hidden sm:inline">OneDrive</span><span className="sm:hidden">Cloud</span>
          </Button>
        </div>

        {/* Filters Row - MOBILE OPTIMIZED */}
        <div className="flex gap-2 sm:gap-3 flex-wrap items-center">
          <div className="relative w-full md:flex-1 md:min-w-[250px]">
            <Input
              placeholder={isMobile ? "Cerca..." : "Cerca per codice, cliente, città, oggetto..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-white"
              data-testid="search-projects"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500 text-lg">🔍</span>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-[180px]" data-testid="filter-status">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="in corso">✅ In Corso</SelectItem>
              <SelectItem value="sospesa">⏸️ Sospesa</SelectItem>
              <SelectItem value="conclusa">🏁 Conclusa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-[150px]" data-testid="filter-year">
              <SelectValue placeholder="Anno" />
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

          <Select value={creFilter} onValueChange={setCreFilter}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-[150px]" data-testid="filter-cre">
              <SelectValue placeholder="CRE" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i CRE</SelectItem>
              <SelectItem value="archiviato">✓ CRE archiviato</SelectItem>
              <SelectItem value="non_archiviato">○ CRE mancante</SelectItem>
            </SelectContent>
          </Select>

          {(statusFilter !== "all" || yearFilter !== "all" || creFilter !== "all" || searchTerm !== "") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setYearFilter("all");
                setCreFilter("all");
                setSearchTerm("");
              }}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              data-testid="clear-filters"
            >
              ✕ Pulisci filtri
            </Button>
          )}
        </div>
      </div>
      
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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
          {/* MOBILE VIEW - Card Layout */}
          {isMobile ? (
            <div className="space-y-3" data-testid="projects-mobile-view">
              {paginatedProjects.map((project) => {
                const lastComm = getLastCommunication(project.id);
                const nextDeadline = getNextDeadline(project.id);

                return (
                  <div
                    key={project.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                    data-testid={`project-card-${project.id}`}
                  >
                    {/* Header: Code + Status */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-mono text-sm font-bold text-primary">{project.code}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          project.status === 'in corso'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : project.status === 'conclusa'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {project.status === 'in corso' ? '🟡' : project.status === 'conclusa' ? '🟢' : '🔴'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <EditProjectForm project={project}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">✏️</Button>
                        </EditProjectForm>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenPrestazioniModal(project)}
                        >🏗️</Button>
                        <CREGenerator project={project}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Genera CRE">📜</Button>
                        </CREGenerator>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-8 w-8 p-0 ${project.creArchiviato ? 'text-green-600' : 'text-gray-400'}`}
                          onClick={() => handleToggleCRE(project)}
                          disabled={toggleCREMutation.isPending}
                          title={project.creArchiviato ? 'CRE archiviato - clicca per rimuovere' : 'Segna CRE come archiviato'}
                        >
                          {project.creArchiviato ? '✓' : '○'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600"
                          onClick={() => handleDeleteProject(project)}
                        >🗑️</Button>
                      </div>
                    </div>

                    {/* Client + City */}
                    <div className="mb-2">
                      <div className="font-medium text-gray-900 dark:text-white">{project.client}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">📍 {project.city}</div>
                    </div>

                    {/* Object */}
                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                      {project.object}
                    </div>

                    {/* Info Row: Communication + Deadline */}
                    <div className="flex gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                      {/* Last Communication */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">💬 Comunicazione</div>
                        {lastComm ? (
                          <div className="text-xs">
                            <span className="font-medium">{lastComm.direction === 'in' ? '📩' : '📤'}</span>
                            <span className="text-gray-600 dark:text-gray-300 ml-1 truncate block">
                              {lastComm.subject?.substring(0, 30)}{lastComm.subject && lastComm.subject.length > 30 ? '...' : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Nessuna</span>
                        )}
                      </div>

                      {/* Next Deadline */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📅 Scadenza</div>
                        {nextDeadline ? (
                          <div className="text-xs">
                            <span className={`font-medium ${
                              new Date(nextDeadline.dueDate) < new Date() ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {new Date(nextDeadline.dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400 ml-1 truncate block">
                              {nextDeadline.title?.substring(0, 20)}{nextDeadline.title && nextDeadline.title.length > 20 ? '...' : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Nessuna</span>
                        )}
                      </div>
                    </div>

                    {/* Fatturazione for Admin */}
                    {isAdmin && project.fatturato && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                          ✓ Fatturato
                        </span>
                        {project.pagato && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded ml-1">
                            ✓ Pagato
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
          /* DESKTOP VIEW - Table Layout */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]" aria-label="Tabella delle commesse">
              <caption className="sr-only">Elenco di tutte le commesse con dettagli, stato e azioni</caption>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th 
                    scope="col" 
                    className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm rounded-tl-lg w-24 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort("code")}
                    data-testid="sort-code"
                  >
                    <div className="flex items-center">
                      Codice
                      <SortIcon field="code" />
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-32 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort("client")}
                    data-testid="sort-client"
                  >
                    <div className="flex items-center">
                      Cliente
                      <SortIcon field="client" />
                    </div>
                  </th>
                  {showTechInfo && (
                    <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-28">
                      Tipo Rapporto
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 cursor-help" title="Chi commissiona il lavoro a G2 Ingegneria">ⓘ</span>
                    </th>
                  )}
                  <th 
                    scope="col" 
                    className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-24 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort("city")}
                    data-testid="sort-city"
                  >
                    <div className="flex items-center">
                      Città
                      <SortIcon field="city" />
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-40 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort("object")}
                    data-testid="sort-object"
                  >
                    <div className="flex items-center">
                      Oggetto
                      <SortIcon field="object" />
                    </div>
                  </th>
                  {showPrestazioni && (
                    <>
                      <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-48">
                        Prestazioni
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 cursor-help" title="Tipologia di servizi professionali">ⓘ</span>
                      </th>
                      <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-40">
                        Livelli Progettazione
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 cursor-help" title="Livelli di progettazione DM 143/2013">ⓘ</span>
                      </th>
                      <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-32">
                        Classe DM 143/2013
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 cursor-help" title="Classificazione tariffa professionale">ⓘ</span>
                      </th>
                    </>
                  )}
                  {showTechInfo && (
                    <>
                      <th 
                        scope="col" 
                        className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-16 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => handleSort("year")}
                        data-testid="sort-year"
                      >
                        <div className="flex items-center">
                          Anno
                          <SortIcon field="year" />
                        </div>
                      </th>
                      <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-20">Template</th>
                    </>
                  )}
                  <th 
                    scope="col" 
                    className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-24 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort("status")}
                    data-testid="sort-status"
                  >
                    <div className="flex items-center">
                      Stato
                      <SortIcon field="status" />
                    </div>
                  </th>
                  {showFatturazione && isAdmin && (
                    <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-32">
                      Fatturazione
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 cursor-help" title="Stato fatturazione e pagamento">ⓘ</span>
                    </th>
                  )}
                  {showComunicazioni && (
                    <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-48">
                      Ultima Comunicazione
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 cursor-help" title="Ultima comunicazione relativa alla commessa">ⓘ</span>
                    </th>
                  )}
                  {showScadenze && (
                    <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-40">
                      Prossima Scadenza
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 cursor-help" title="Prossima scadenza in programma">ⓘ</span>
                    </th>
                  )}
                  {showOneDrive && (
                    <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm w-48">OneDrive</th>
                  )}
                  <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300 text-sm rounded-tr-lg w-32">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-4 font-mono text-sm font-semibold text-primary" data-testid={`project-code-${project.id}`}>
                      {project.code}
                    </td>
                    <td className="py-4 px-4 text-sm dark:text-gray-300" data-testid={`project-client-${project.id}`}>
                      <div>
                        <div className="font-medium">{project.client}</div>
                        {project.committenteFinale && project.tipoRapporto !== "diretto" && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400" data-testid={`project-city-${project.id}`}>
                      {project.city}
                    </td>
                    <td className="py-4 px-4 text-sm dark:text-gray-300" data-testid={`project-object-${project.id}`}>
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
                                  classeDM.isFormatted ? 'bg-gray-800 text-white dark:bg-gray-600' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {classeDM.classe}
                                </span>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                        <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400" data-testid={`project-year-${project.id}`}>
                          20{project.year.toString().padStart(2, '0')}
                        </td>
                        <td className="py-4 px-4" data-testid={`project-template-${project.id}`}>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            project.template === 'LUNGO'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          }`}>
                            {project.template}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="py-4 px-4" data-testid={`project-status-${project.id}`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        project.status === 'in corso'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : project.status === 'conclusa'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {project.status === 'in corso' ? '🟡 In Corso' :
                         project.status === 'conclusa' ? '🟢 Conclusa' :
                         '🔴 Sospesa'}
                      </span>
                    </td>
                    {showFatturazione && isAdmin && (
                      <td className="py-4 px-4" data-testid={`project-fatturazione-${project.id}`}>
                        {(() => {
                          const stats = prestazioniByProject[project.id];
                          if (!stats || stats.totale === 0) {
                            return <span className="text-xs text-gray-400 dark:text-gray-500 italic">-</span>;
                          }
                          return (
                            <div className="flex flex-col gap-1">
                              {/* Stato prestazioni */}
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {stats.totale} prest.
                              </div>
                              {/* Fatturate */}
                              {stats.fatturate > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded font-medium">
                                    {stats.fatturate} fatt.
                                  </span>
                                  {stats.importoFatturato > 0 && (
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                      €{(stats.importoFatturato / 100).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* Pagate */}
                              {stats.pagate > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded font-medium">
                                    {stats.pagate} pag.
                                  </span>
                                  {stats.importoPagato > 0 && (
                                    <span className="text-xs text-green-600 dark:text-green-400">
                                      €{(stats.importoPagato / 100).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* Da fatturare */}
                              {stats.completate > stats.fatturate && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                  ⏳ {stats.completate - stats.fatturate} da fatt.
                                </span>
                              )}
                              {/* Da incassare */}
                              {stats.fatturate > stats.pagate && (
                                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                  💰 {stats.fatturate - stats.pagate} da incass.
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    )}
                    {showComunicazioni && (
                      <td className="py-4 px-4" data-testid={`project-last-communication-${project.id}`}>
                        {(() => {
                          const lastComm = getLastCommunication(project.id);
                          if (!lastComm) {
                            return <span className="text-xs text-gray-400 dark:text-gray-500 italic">Nessuna comunicazione</span>;
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
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded font-medium">
                                  {typeLabel}
                                </span>
                                {lastComm.isImportant && (
                                  <span className="text-red-500 dark:text-red-400" title="Comunicazione importante">⚠️</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={lastComm.subject}>
                                {lastComm.subject}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">
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
                            return <span className="text-xs text-gray-400 dark:text-gray-500 italic">Nessuna scadenza</span>;
                          }

                          const dueDate = new Date(nextDeadline.dueDate);
                          const now = new Date();
                          const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                          const priorityConfig: Record<string, { color: string; icon: string }> = {
                            low: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: '🟢' },
                            medium: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200', icon: '🟡' },
                            high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200', icon: '🟠' },
                            urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200', icon: '🔴' }
                          };

                          const typeIcon: Record<string, string> = {
                            general: '📌',
                            deposito: '📝',
                            collaudo: '✅',
                            scadenza_assicurazione: '🛡️',
                            milestone: '🎯'
                          };

                          const priority = priorityConfig[nextDeadline.priority] || priorityConfig.medium;

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
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]" title={nextDeadline.title}>
                                {nextDeadline.title}
                              </div>
                              <div className={`text-xs font-medium ${daysUntil <= 7 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
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
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline text-left truncate"
                                    title={`Apri cartella: ${mapping.oneDriveFolderPath}`}
                                    data-testid={`onedrive-link-${project.id}`}
                                  >
                                    📁 {mapping.oneDriveFolderName}
                                  </button>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={mapping.oneDriveFolderPath}>
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
                                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    Non configurato
                                  </span>
                                </div>
                              )}

                              {status.status === 'error' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleConfigureOneDrive(project)}
                                  className="text-xs h-6 px-1 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
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
                            size="default"
                            variant="ghost"
                            className="min-w-[44px] min-h-[44px] p-3 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900 rounded-lg transition-colors"
                            title="Modifica"
                            data-testid={`edit-project-${project.id}`}
                          >
                            ✏️
                          </Button>
                        </EditProjectForm>
                        <Button
                          size="default"
                          variant="ghost"
                          onClick={() => handleOpenPrestazioniModal(project)}
                          className="min-w-[44px] min-h-[44px] p-3 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900 rounded-lg transition-colors"
                          title="Dettagli Prestazioni"
                          data-testid={`prestazioni-details-${project.id}`}
                        >
                          🏗️
                        </Button>
                        <CREGenerator project={project}>
                          <Button
                            size="default"
                            variant="ghost"
                            className="min-w-[44px] min-h-[44px] p-3 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900 rounded-lg transition-colors"
                            title="Genera CRE"
                            data-testid={`cre-generator-${project.id}`}
                          >
                            📜
                          </Button>
                        </CREGenerator>
                        <Button
                          size="default"
                          variant="ghost"
                          onClick={() => handleToggleCRE(project)}
                          disabled={toggleCREMutation.isPending}
                          className={`min-w-[44px] min-h-[44px] p-3 rounded-lg transition-colors ${
                            project.creArchiviato
                              ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900'
                              : 'text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-gray-800'
                          }`}
                          title={project.creArchiviato
                            ? `CRE archiviato il ${project.creDataArchiviazione ? new Date(project.creDataArchiviazione).toLocaleDateString('it-IT') : ''} - clicca per rimuovere`
                            : 'Segna CRE come archiviato'}
                          data-testid={`cre-archivio-${project.id}`}
                        >
                          {project.creArchiviato ? '✓' : '○'}
                        </Button>
                        <Button
                          size="default"
                          variant="ghost"
                          onClick={() => handleDeleteProject(project)}
                          disabled={deleteProjectMutation.isPending}
                          className="min-w-[44px] min-h-[44px] p-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900 rounded-lg transition-colors"
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
          )}

          {/* Pagination Controls */}
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-gray-600 dark:text-gray-400" data-testid="projects-count">
                Mostrando <strong>{startIndex + 1}</strong>-<strong>{Math.min(endIndex, sortedProjects.length)}</strong> di <strong>{sortedProjects.length}</strong> commesse
                {sortedProjects.length !== projects.length && (
                  <span className="text-gray-500 dark:text-gray-500 ml-1">({projects.length} totali)</span>
                )}
              </span>
              
              <div className="flex items-center gap-2">
                <label htmlFor="items-per-page" className="text-gray-600 dark:text-gray-400">
                  Elementi per pagina:
                </label>
                <Select 
                  value={itemsPerPage.toString()} 
                  onValueChange={(value) => {
                    setItemsPerPage(parseInt(value) as 10 | 25 | 50);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger id="items-per-page" className="w-20" data-testid="items-per-page-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-gray-600 dark:text-gray-400">
                Pagina <strong>{currentPage}</strong> di <strong>{totalPages || 1}</strong>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Precedente</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  data-testid="next-page"
                >
                  <span className="hidden sm:inline">Successiva</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la commessa?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>Sei sicuro di voler eliminare questa commessa?</div>
              {projectToDelete && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="font-mono font-semibold text-primary text-sm mb-1">
                    {projectToDelete.code}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>{projectToDelete.client}</strong> - {projectToDelete.city}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
