import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Euro, Clock, ChevronDown, ChevronUp,
  Edit, Trash2, ChevronLeft, ChevronRight, AlertTriangle,
  PieChart as PieChartIcon, BarChart as BarChartIcon, Plus, Check, ChevronsUpDown
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { type Project, type ProjectPrestazioni, type ProjectCost, type ProjectResource } from "@shared/schema";

// Tipologie di costo
const COST_TYPES = [
  { value: "risorsa", label: "Risorsa / Personale", icon: "👤", hasHours: true },
  { value: "consulenza", label: "Consulenza", icon: "💼", hasHours: false },
  { value: "rilievo", label: "Rilievo", icon: "📐", hasHours: false },
  { value: "benzina", label: "Benzina / Carburante", icon: "⛽", hasHours: false },
  { value: "nolo", label: "Nolo / Noleggio", icon: "🚗", hasHours: false },
  { value: "materiali", label: "Materiali", icon: "🧱", hasHours: false },
  { value: "altro", label: "Altro", icon: "📋", hasHours: false }
];

const ROLES = [
  { value: "progettista", label: "Progettista", icon: "📐" },
  { value: "dl", label: "Direttore Lavori", icon: "👷" },
  { value: "csp", label: "CSP", icon: "🦺" },
  { value: "cse", label: "CSE", icon: "⚠️" },
  { value: "collaudatore", label: "Collaudatore", icon: "✅" },
  { value: "tecnico", label: "Tecnico", icon: "🔧" },
  { value: "geologo", label: "Geologo", icon: "🪨" },
  { value: "strutturista", label: "Strutturista", icon: "🏗️" },
  { value: "impiantista", label: "Impiantista", icon: "⚡" },
  { value: "altro", label: "Altro", icon: "👤" }
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

export default function SezioneCosti() {
  const [activeTab, setActiveTab] = useState("panoramica");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
  const [projectComboOpen, setProjectComboOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedCostType, setSelectedCostType] = useState<string>("consulenza");
  const [editingCost, setEditingCost] = useState<{ type: 'resource' | 'cost', data: any } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 25 | 50>(10);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"margine" | "marginePercent" | "ricaviPrevisti" | "costiTotali">("margine");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states for resource
  const [resourceForm, setResourceForm] = useState({
    userName: "",
    userEmail: "",
    role: "progettista",
    oreAssegnate: 0,
    oreLavorate: 0,
    costoOrario: 0,
    isResponsabile: false,
    dataInizio: "",
    dataFine: ""
  });

  // Form states for generic cost
  const [costForm, setCostForm] = useState({
    descrizione: "",
    importo: 0,
    fornitore: "",
    data: ""
  });

  // Fetch data
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"]
  });

  const { data: resources = [] } = useQuery<ProjectResource[]>({
    queryKey: ["/api/project-resources"]
  });

  const { data: costs = [] } = useQuery<ProjectCost[]>({
    queryKey: ["/api/project-costs"]
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"]
  });

  // Mutations
  const saveResourceMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingCost?.type === 'resource'
        ? `/api/project-resources/${editingCost.data.id}`
        : "/api/project-resources";
      const method = editingCost?.type === 'resource' ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nel salvataggio");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-resources"] });
      toast({ title: "Costo salvato", description: "Il costo risorsa è stato salvato con successo" });
      closeCostDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const saveCostMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingCost?.type === 'cost'
        ? `/api/project-costs/${editingCost.data.id}`
        : "/api/project-costs";
      const method = editingCost?.type === 'cost' ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nel salvataggio");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-costs"] });
      toast({ title: "Costo salvato", description: "Il costo è stato salvato con successo" });
      closeCostDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-resources/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-resources"] });
      toast({ title: "Eliminato", description: "Costo risorsa eliminato" });
    }
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-costs/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-costs"] });
      toast({ title: "Eliminato", description: "Costo eliminato" });
    }
  });

  // Helper functions
  const closeCostDialog = () => {
    setIsCostDialogOpen(false);
    setSelectedProjectId("");
    setSelectedCostType("consulenza");
    setEditingCost(null);
    setResourceForm({
      userName: "", userEmail: "", role: "progettista",
      oreAssegnate: 0, oreLavorate: 0, costoOrario: 0,
      isResponsabile: false, dataInizio: "", dataFine: ""
    });
    setCostForm({ descrizione: "", importo: 0, fornitore: "", data: "" });
  };

  const openAddCostDialog = (projectId?: string) => {
    closeCostDialog();
    if (projectId) setSelectedProjectId(projectId);
    setIsCostDialogOpen(true);
  };

  const openEditResource = (resource: ProjectResource) => {
    setEditingCost({ type: 'resource', data: resource });
    setSelectedProjectId(resource.projectId);
    setSelectedCostType("risorsa");
    setResourceForm({
      userName: resource.userName,
      userEmail: resource.userEmail || "",
      role: resource.role,
      oreAssegnate: resource.oreAssegnate || 0,
      oreLavorate: resource.oreLavorate || 0,
      costoOrario: (resource.costoOrario || 0) / 100,
      isResponsabile: resource.isResponsabile || false,
      dataInizio: resource.dataInizio?.toString().split('T')[0] || "",
      dataFine: resource.dataFine?.toString().split('T')[0] || ""
    });
    setIsCostDialogOpen(true);
  };

  const openEditCost = (cost: ProjectCost) => {
    setEditingCost({ type: 'cost', data: cost });
    setSelectedProjectId(cost.projectId);
    setSelectedCostType(cost.tipo);
    setCostForm({
      descrizione: cost.descrizione || "",
      importo: (cost.importo || 0) / 100,
      fornitore: cost.fornitore || "",
      data: cost.data?.toString().split('T')[0] || ""
    });
    setIsCostDialogOpen(true);
  };

  const handleSubmitCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast({ title: "Errore", description: "Seleziona una commessa", variant: "destructive" });
      return;
    }

    if (selectedCostType === "risorsa") {
      saveResourceMutation.mutate({
        projectId: selectedProjectId,
        ...resourceForm,
        costoOrario: Math.round(resourceForm.costoOrario * 100)
      });
    } else {
      saveCostMutation.mutate({
        projectId: selectedProjectId,
        tipo: selectedCostType,
        descrizione: costForm.descrizione,
        importo: Math.round(costForm.importo * 100),
        fornitore: costForm.fornitore || null,
        data: costForm.data || null
      });
    }
  };

  // Calculate costs for each project
  const projectCostsData = useMemo(() => {
    return projects.map(project => {
      const projectResources = resources.filter(r => r.projectId === project.id);
      const projectCosts = costs.filter(c => c.projectId === project.id);
      const projectInvoices = invoices.filter(i => i.projectId === project.id);

      // Ricavi (importoServizio è in EURO, convertiamo in centesimi)
      const metadata = project.metadata as ProjectPrestazioni;
      const ricaviPrevisti = (metadata?.importoServizio || 0) * 100;
      const ricaviFatturati = projectInvoices.reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);
      const ricaviIncassati = projectInvoices
        .filter(inv => inv.stato === 'pagata')
        .reduce((sum, inv) => sum + (inv.importoNetto || 0), 0);

      // Costi Personale (da risorse)
      const costiPersonale = projectResources.reduce(
        (sum, r) => sum + ((r.oreLavorate || 0) * (r.costoOrario || 0)), 0
      );

      // Costi per tipologia (dalla nuova tabella projectCosts)
      const costiByType: Record<string, number> = {};
      projectCosts.forEach(c => {
        costiByType[c.tipo] = (costiByType[c.tipo] || 0) + (c.importo || 0);
      });

      const costiEsterni = projectCosts.reduce((sum, c) => sum + (c.importo || 0), 0);
      const costiTotali = costiPersonale + costiEsterni;
      const margine = ricaviPrevisti - costiTotali;
      const marginePercent = ricaviPrevisti > 0 ? (margine / ricaviPrevisti) * 100 : 0;

      // Ore
      const oreAssegnate = projectResources.reduce((sum, r) => sum + (r.oreAssegnate || 0), 0);
      const oreLavorate = projectResources.reduce((sum, r) => sum + (r.oreLavorate || 0), 0);

      return {
        project,
        resources: projectResources,
        costs: projectCosts,
        ricaviPrevisti,
        ricaviFatturati,
        ricaviIncassati,
        costiPersonale,
        costiByType,
        costiEsterni,
        costiTotali,
        margine,
        marginePercent,
        oreAssegnate,
        oreLavorate
      };
    });
  }, [projects, resources, costs, invoices]);

  // Global stats
  const globalStats = useMemo(() => {
    const totals = projectCostsData.reduce(
      (acc, p) => ({
        ricaviPrevisti: acc.ricaviPrevisti + p.ricaviPrevisti,
        ricaviFatturati: acc.ricaviFatturati + p.ricaviFatturati,
        ricaviIncassati: acc.ricaviIncassati + p.ricaviIncassati,
        costiPersonale: acc.costiPersonale + p.costiPersonale,
        costiEsterni: acc.costiEsterni + p.costiEsterni,
        costiTotali: acc.costiTotali + p.costiTotali,
        oreAssegnate: acc.oreAssegnate + p.oreAssegnate,
        oreLavorate: acc.oreLavorate + p.oreLavorate
      }),
      { ricaviPrevisti: 0, ricaviFatturati: 0, ricaviIncassati: 0, costiPersonale: 0, costiEsterni: 0, costiTotali: 0, oreAssegnate: 0, oreLavorate: 0 }
    );

    const margine = totals.ricaviPrevisti - totals.costiTotali;
    const marginePercent = totals.ricaviPrevisti > 0 ? (margine / totals.ricaviPrevisti) * 100 : 0;
    const efficienzaOre = totals.oreAssegnate > 0 ? (totals.oreLavorate / totals.oreAssegnate) * 100 : 0;

    // Costi per tipologia globale
    const costiByType: Record<string, number> = { risorsa: totals.costiPersonale };
    costs.forEach(c => {
      costiByType[c.tipo] = (costiByType[c.tipo] || 0) + (c.importo || 0);
    });

    return { ...totals, margine, marginePercent, efficienzaOre, costiByType };
  }, [projectCostsData, costs]);

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let data = [...projectCostsData];
    if (statusFilter !== "all") {
      data = data.filter(p => p.project.status === statusFilter);
    }
    data.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return data;
  }, [projectCostsData, statusFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Chart data
  const costiDistributionData = COST_TYPES
    .map((type, index) => ({
      name: type.label,
      value: globalStats.costiByType[type.value] || 0,
      color: COLORS[index % COLORS.length]
    }))
    .filter(item => item.value > 0);

  const top5Margine = [...projectCostsData].sort((a, b) => b.margine - a.margine).slice(0, 5);
  const bottom5Margine = [...projectCostsData].filter(p => p.margine < 0).sort((a, b) => a.margine - b.margine).slice(0, 5);

  const formatCurrency = (cents: number) => `€${(cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const getMargineColor = (percent: number) => percent >= 20 ? "text-green-600 dark:text-green-400" : percent >= 10 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const getMargineBadge = (percent: number) => {
    const color = percent >= 20 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : percent >= 10 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    return <Badge className={color}>{percent.toFixed(1)}%</Badge>;
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedCostTypeInfo = COST_TYPES.find(t => t.value === selectedCostType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Analisi Costi</h3>
          <p className="text-muted-foreground mt-1">Monitoraggio costi e margini per commessa</p>
        </div>
        <Button onClick={() => openAddCostDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Aggiungi Costo
        </Button>
      </div>

      {/* Dialog Aggiungi/Modifica Costo */}
      <Dialog open={isCostDialogOpen} onOpenChange={(open) => !open && closeCostDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCost ? "Modifica Costo" : "Aggiungi Nuovo Costo"}</DialogTitle>
            <DialogDescription>
              Inserisci un costo per una commessa
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitCost} className="space-y-4">
            {/* Selezione Commessa con Combobox */}
            <div className="space-y-2">
              <Label>Commessa *</Label>
              <Popover open={projectComboOpen} onOpenChange={setProjectComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectComboOpen}
                    className="w-full justify-between"
                    disabled={!!editingCost}
                  >
                    {selectedProject
                      ? `${selectedProject.code} - ${selectedProject.client}`
                      : "Cerca commessa..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cerca per codice, cliente o oggetto..." />
                    <CommandList>
                      <CommandEmpty>Nessuna commessa trovata.</CommandEmpty>
                      <CommandGroup>
                        {projects.map(project => (
                          <CommandItem
                            key={project.id}
                            value={`${project.code} ${project.client} ${project.object || ''}`}
                            onSelect={() => {
                              setSelectedProjectId(project.id);
                              setProjectComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedProjectId === project.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-medium">{project.code}</span>
                              {project.object && <span className="text-xs text-muted-foreground truncate">{project.object}</span>}
                              {project.client && <span className="text-xs text-muted-foreground/70 truncate">Cliente: {project.client}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Selezione Tipologia Costo */}
            <div className="space-y-2">
              <Label>Tipologia Costo *</Label>
              <Select
                value={selectedCostType}
                onValueChange={setSelectedCostType}
                disabled={!!editingCost}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campi per Risorsa */}
            {selectedCostType === "risorsa" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userName">Nome Risorsa *</Label>
                    <Input
                      id="userName"
                      value={resourceForm.userName}
                      onChange={(e) => setResourceForm({ ...resourceForm, userName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="userEmail">Email</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={resourceForm.userEmail}
                      onChange={(e) => setResourceForm({ ...resourceForm, userEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="role">Ruolo *</Label>
                  <Select value={resourceForm.role} onValueChange={(value) => setResourceForm({ ...resourceForm, role: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>{role.icon} {role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="oreAssegnate">Ore Assegnate</Label>
                    <Input id="oreAssegnate" type="number" value={resourceForm.oreAssegnate} onChange={(e) => setResourceForm({ ...resourceForm, oreAssegnate: parseInt(e.target.value) || 0 })} min="0" />
                  </div>
                  <div>
                    <Label htmlFor="oreLavorate">Ore Lavorate</Label>
                    <Input id="oreLavorate" type="number" value={resourceForm.oreLavorate} onChange={(e) => setResourceForm({ ...resourceForm, oreLavorate: parseInt(e.target.value) || 0 })} min="0" />
                  </div>
                  <div>
                    <Label htmlFor="costoOrario">Costo Orario (€)</Label>
                    <Input id="costoOrario" type="number" step="0.01" value={resourceForm.costoOrario} onChange={(e) => setResourceForm({ ...resourceForm, costoOrario: parseFloat(e.target.value) || 0 })} min="0" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dataInizio">Data Inizio</Label>
                    <Input id="dataInizio" type="date" value={resourceForm.dataInizio} onChange={(e) => setResourceForm({ ...resourceForm, dataInizio: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="dataFine">Data Fine</Label>
                    <Input id="dataFine" type="date" value={resourceForm.dataFine} onChange={(e) => setResourceForm({ ...resourceForm, dataFine: e.target.value })} />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="isResponsabile" checked={resourceForm.isResponsabile} onChange={(e) => setResourceForm({ ...resourceForm, isResponsabile: e.target.checked })} className="rounded" />
                  <Label htmlFor="isResponsabile" className="font-normal">Responsabile di Commessa</Label>
                </div>
              </>
            )}

            {/* Campi per altri tipi di costo */}
            {selectedCostType !== "risorsa" && (
              <>
                <div>
                  <Label htmlFor="descrizione">Descrizione</Label>
                  <Input
                    id="descrizione"
                    value={costForm.descrizione}
                    onChange={(e) => setCostForm({ ...costForm, descrizione: e.target.value })}
                    placeholder={`Es: ${selectedCostTypeInfo?.label || 'Descrizione'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="importo">Importo (€) *</Label>
                    <Input
                      id="importo"
                      type="number"
                      step="0.01"
                      value={costForm.importo}
                      onChange={(e) => setCostForm({ ...costForm, importo: parseFloat(e.target.value) || 0 })}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="fornitore">Fornitore</Label>
                    <Input
                      id="fornitore"
                      value={costForm.fornitore}
                      onChange={(e) => setCostForm({ ...costForm, fornitore: e.target.value })}
                      placeholder="Nome fornitore/azienda"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dataCosto">Data</Label>
                  <Input
                    id="dataCosto"
                    type="date"
                    value={costForm.data}
                    onChange={(e) => setCostForm({ ...costForm, data: e.target.value })}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCostDialog}>Annulla</Button>
              <Button type="submit" disabled={saveResourceMutation.isPending || saveCostMutation.isPending}>
                {(saveResourceMutation.isPending || saveCostMutation.isPending) ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card-g2">
          <p className="text-sm text-muted-foreground mb-1">Ricavi Totali</p>
          <p className="text-3xl font-bold text-foreground mb-3">{formatCurrency(globalStats.ricaviPrevisti)}</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Fatturato:</span><span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(globalStats.ricaviFatturati)}</span></div>
            <div className="flex justify-between"><span>Incassato:</span><span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(globalStats.ricaviIncassati)}</span></div>
          </div>
        </div>

        <div className="card-g2">
          <p className="text-sm text-muted-foreground mb-1">Costi Totali</p>
          <p className="text-3xl font-bold text-foreground mb-3">{formatCurrency(globalStats.costiTotali)}</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Personale:</span><span className="font-medium">{formatCurrency(globalStats.costiPersonale)}</span></div>
            <div className="flex justify-between"><span>Altri:</span><span className="font-medium">{formatCurrency(globalStats.costiEsterni)}</span></div>
          </div>
        </div>

        <div className="card-g2">
          <p className="text-sm text-muted-foreground mb-1">Margine Operativo</p>
          <p className={`text-3xl font-bold mb-3 ${getMargineColor(globalStats.marginePercent)}`}>{formatCurrency(globalStats.margine)}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Percentuale:</span>
            <span className={`font-bold flex items-center gap-1 ${getMargineColor(globalStats.marginePercent)}`}>
              {globalStats.marginePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {globalStats.marginePercent.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="card-g2">
          <p className="text-sm text-muted-foreground mb-1">Gestione Ore</p>
          <p className="text-3xl font-bold text-foreground mb-3">{globalStats.oreLavorate}h</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Assegnate:</span><span className="font-medium">{globalStats.oreAssegnate}h</span></div>
            <div className="flex justify-between"><span>Efficienza:</span><span className={`font-bold ${globalStats.efficienzaOre <= 100 ? 'text-green-600' : 'text-orange-600'}`}>{globalStats.efficienzaOre.toFixed(1)}%</span></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="panoramica"><BarChartIcon className="w-4 h-4 mr-1" />Panoramica</TabsTrigger>
          <TabsTrigger value="dettaglio"><Euro className="w-4 h-4 mr-1" />Dettaglio Commesse</TabsTrigger>
        </TabsList>

        <TabsContent value="panoramica" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card-g2">
              <h3 className="text-lg font-semibold text-foreground mb-4">Distribuzione Costi per Tipologia</h3>
              {costiDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={costiDistributionData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                      {costiDistributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nessun costo registrato</p>
              )}
            </div>

            <div className="card-g2">
              <h3 className="text-lg font-semibold text-foreground mb-4">Top 5 Commesse per Margine</h3>
              <div className="space-y-3">
                {top5Margine.map((item, index) => (
                  <div key={item.project.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-500' : 'text-gray-400'}`}>#{index + 1}</span>
                      <div>
                        <div className="font-medium">{item.project.code}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.project.object}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getMargineColor(item.marginePercent)}`}>{formatCurrency(item.margine)}</div>
                      {getMargineBadge(item.marginePercent)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {bottom5Margine.length > 0 && (
            <div className="card-g2 border-red-200 dark:border-red-800">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />Commesse in Perdita
              </h3>
              <div className="space-y-3">
                {bottom5Margine.map((item) => (
                  <div key={item.project.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <div>
                      <div className="font-medium">{item.project.code}</div>
                      <div className="text-xs text-muted-foreground">{item.project.client}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600 dark:text-red-400">{formatCurrency(item.margine)}</div>
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">{item.marginePercent.toFixed(1)}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dettaglio" className="space-y-4">
          {/* Filters */}
          <div className="card-g2">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="in corso">In Corso</SelectItem>
                    <SelectItem value="conclusa">Conclusa</SelectItem>
                    <SelectItem value="sospesa">Sospesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Ordina:</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margine">Margine €</SelectItem>
                    <SelectItem value="marginePercent">Margine %</SelectItem>
                    <SelectItem value="ricaviPrevisti">Ricavi</SelectItem>
                    <SelectItem value="costiTotali">Costi</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}>
                  {sortOrder === "desc" ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Projects List */}
          <div className="space-y-4">
            {paginatedData.map((item) => (
              <div key={item.project.id} className="card-g2">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedProject(expandedProject === item.project.id ? null : item.project.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{item.project.code}</span>
                      <ProjectStatusBadge status={item.project.status as "in corso" | "conclusa" | "sospesa"} />
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{item.project.client} - {item.project.object}</div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">Ricavi</div>
                      <div className="font-medium">{formatCurrency(item.ricaviPrevisti)}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">Costi</div>
                      <div className="font-medium">{formatCurrency(item.costiTotali)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Margine</div>
                      <div className={`font-bold ${getMargineColor(item.marginePercent)}`}>{formatCurrency(item.margine)}</div>
                    </div>
                    {getMargineBadge(item.marginePercent)}
                    {expandedProject === item.project.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {expandedProject === item.project.id && (
                  <div className="mt-6 pt-6 border-t space-y-6">
                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">Ricavi</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span>Previsti:</span><span className="font-medium">{formatCurrency(item.ricaviPrevisti)}</span></div>
                          <div className="flex justify-between"><span>Fatturato:</span><span className="font-medium">{formatCurrency(item.ricaviFatturati)}</span></div>
                          <div className="flex justify-between"><span>Incassato:</span><span className="font-medium">{formatCurrency(item.ricaviIncassati)}</span></div>
                        </div>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-red-800 dark:text-red-200">Costi</h4>
                          <Button variant="outline" size="sm" onClick={() => openAddCostDialog(item.project.id)}>
                            <Plus className="w-3 h-3 mr-1" />Aggiungi
                          </Button>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span>Personale:</span><span className="font-medium">{formatCurrency(item.costiPersonale)}</span></div>
                          {Object.entries(item.costiByType).map(([tipo, importo]) => {
                            const typeInfo = COST_TYPES.find(t => t.value === tipo);
                            return (
                              <div key={tipo} className="flex justify-between">
                                <span>{typeInfo?.icon} {typeInfo?.label || tipo}:</span>
                                <span className="font-medium">{formatCurrency(importo)}</span>
                              </div>
                            );
                          })}
                          <div className="flex justify-between border-t pt-2 font-semibold">
                            <span>Totale:</span>
                            <span className="text-red-600">{formatCurrency(item.costiTotali)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Risorse */}
                    {item.resources.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Risorse ({item.resources.length})</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr className="border-b">
                                <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Risorsa</th>
                                <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Ruolo</th>
                                <th className="text-right py-3 px-4 font-semibold text-foreground text-sm">Ore</th>
                                <th className="text-right py-3 px-4 font-semibold text-foreground text-sm">€/h</th>
                                <th className="text-right py-3 px-4 font-semibold text-foreground text-sm">Totale</th>
                                <th className="text-center py-3 px-4 font-semibold text-foreground text-sm">Azioni</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.resources.map(resource => {
                                const roleInfo = ROLES.find(r => r.value === resource.role);
                                const costoTotale = (resource.oreLavorate || 0) * (resource.costoOrario || 0);
                                return (
                                  <tr key={resource.id} className="border-b">
                                    <td className="py-2 px-3">
                                      <div className="font-medium">{resource.userName}</div>
                                      {resource.isResponsabile && <Badge variant="secondary" className="text-xs">Resp.</Badge>}
                                    </td>
                                    <td className="py-2 px-3">{roleInfo?.icon} {roleInfo?.label}</td>
                                    <td className="py-2 px-3 text-right">{resource.oreLavorate}/{resource.oreAssegnate}h</td>
                                    <td className="py-2 px-3 text-right">€{((resource.costoOrario || 0) / 100).toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right font-medium">{formatCurrency(costoTotale)}</td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEditResource(resource)}><Edit className="w-3 h-3" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Eliminare?")) deleteResourceMutation.mutate(resource.id); }}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Altri Costi */}
                    {item.costs.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Altri Costi ({item.costs.length})</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr className="border-b">
                                <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Tipo</th>
                                <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Descrizione</th>
                                <th className="text-left py-3 px-4 font-semibold text-foreground text-sm">Fornitore</th>
                                <th className="text-right py-3 px-4 font-semibold text-foreground text-sm">Importo</th>
                                <th className="text-center py-3 px-4 font-semibold text-foreground text-sm">Azioni</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.costs.map(cost => {
                                const typeInfo = COST_TYPES.find(t => t.value === cost.tipo);
                                return (
                                  <tr key={cost.id} className="border-b">
                                    <td className="py-2 px-3">{typeInfo?.icon} {typeInfo?.label}</td>
                                    <td className="py-2 px-3">{cost.descrizione || '-'}</td>
                                    <td className="py-2 px-3">{cost.fornitore || '-'}</td>
                                    <td className="py-2 px-3 text-right font-medium">{formatCurrency(cost.importo || 0)}</td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEditCost(cost)}><Edit className="w-3 h-3" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Eliminare?")) deleteCostMutation.mutate(cost.id); }}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">Pagina {currentPage} di {totalPages}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
