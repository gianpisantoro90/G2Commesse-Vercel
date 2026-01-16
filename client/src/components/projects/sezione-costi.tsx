import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, Euro, Users, Clock, ChevronDown, ChevronUp,
  UserPlus, Edit, Trash2, ChevronLeft, ChevronRight, AlertTriangle,
  PieChart as PieChartIcon, BarChart as BarChartIcon, Plus, Receipt
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { type Project, type ProjectPrestazioni, type ProjectBudget } from "@shared/schema";

interface ProjectResource {
  id: string;
  projectId: string;
  userName: string;
  userEmail?: string;
  role: string;
  oreAssegnate: number;
  oreLavorate: number;
  costoOrario: number;
  isResponsabile: boolean;
  dataInizio?: string;
  dataFine?: string;
}

interface ProjectInvoice {
  id: string;
  projectId: string;
  numeroFattura: string;
  importoNetto: number;
  stato: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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

export default function SezioneCosti() {
  const [activeTab, setActiveTab] = useState("panoramica");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ProjectResource | null>(null);
  const [selectedProjectForResource, setSelectedProjectForResource] = useState<string>("");
  const [selectedProjectForCost, setSelectedProjectForCost] = useState<string>("");
  const [editingBudgetProjectId, setEditingBudgetProjectId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 25 | 50>(10);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"margine" | "marginePercent" | "ricavi" | "costi">("margine");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [resourceFormData, setResourceFormData] = useState({
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

  const [budgetFormData, setBudgetFormData] = useState({
    costiConsulenze: 0,
    costiRilievi: 0,
    altriCosti: 0
  });

  // Fetch data
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"]
  });

  const { data: resources } = useQuery<ProjectResource[]>({
    queryKey: ["/api/project-resources"]
  });

  const { data: budgets } = useQuery<ProjectBudget[]>({
    queryKey: ["/api/project-budgets"]
  });

  const { data: invoices } = useQuery<ProjectInvoice[]>({
    queryKey: ["/api/invoices"]
  });

  // Mutations
  const saveResourceMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingResource
        ? `/api/project-resources/${editingResource.id}`
        : "/api/project-resources";
      const method = editingResource ? "PUT" : "POST";

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
      toast({
        title: editingResource ? "Risorsa aggiornata" : "Risorsa aggiunta",
        description: "La risorsa è stata salvata con successo"
      });
      resetResourceForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-resources/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-resources"] });
      toast({
        title: "Risorsa eliminata",
        description: "La risorsa è stata rimossa con successo"
      });
    }
  });

  const saveBudgetMutation = useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: any }) => {
      const existingBudget = budgets?.find(b => b.projectId === projectId);
      const url = existingBudget
        ? `/api/project-budgets/${existingBudget.id}`
        : "/api/project-budgets";
      const method = existingBudget ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...data }),
        credentials: "include"
      });

      if (!res.ok) throw new Error("Errore nel salvataggio");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-budgets"] });
      toast({
        title: "Budget aggiornato",
        description: "I costi esterni sono stati salvati con successo"
      });
      setIsBudgetDialogOpen(false);
      setEditingBudgetProjectId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Helper functions
  const resetResourceForm = () => {
    setResourceFormData({
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
    setSelectedProjectForResource("");
    setEditingResource(null);
    setIsResourceDialogOpen(false);
  };

  const handleEditResource = (resource: ProjectResource) => {
    setEditingResource(resource);
    setSelectedProjectForResource(resource.projectId);
    setResourceFormData({
      userName: resource.userName,
      userEmail: resource.userEmail || "",
      role: resource.role,
      oreAssegnate: resource.oreAssegnate,
      oreLavorate: resource.oreLavorate,
      costoOrario: resource.costoOrario / 100,
      isResponsabile: resource.isResponsabile,
      dataInizio: resource.dataInizio?.split('T')[0] || "",
      dataFine: resource.dataFine?.split('T')[0] || ""
    });
    setIsResourceDialogOpen(true);
  };

  const handleEditBudget = (projectId: string) => {
    const budget = budgets?.find(b => b.projectId === projectId);
    setBudgetFormData({
      costiConsulenze: (budget?.costiConsulenze || 0) / 100,
      costiRilievi: (budget?.costiRilievi || 0) / 100,
      altriCosti: (budget?.altriCosti || 0) / 100
    });
    setEditingBudgetProjectId(projectId);
    setIsBudgetDialogOpen(true);
  };

  const handleResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectForResource) {
      toast({
        title: "Errore",
        description: "Seleziona una commessa",
        variant: "destructive"
      });
      return;
    }

    saveResourceMutation.mutate({
      projectId: selectedProjectForResource,
      ...resourceFormData,
      costoOrario: Math.round(resourceFormData.costoOrario * 100)
    });
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudgetProjectId) return;

    saveBudgetMutation.mutate({
      projectId: editingBudgetProjectId,
      data: {
        costiConsulenze: Math.round(budgetFormData.costiConsulenze * 100),
        costiRilievi: Math.round(budgetFormData.costiRilievi * 100),
        altriCosti: Math.round(budgetFormData.altriCosti * 100)
      }
    });
  };

  // Calculate costs for each project
  const projectCostsData = useMemo(() => {
    if (!projects) return [];

    return projects.map(project => {
      const projectResources = resources?.filter(r => r.projectId === project.id) || [];
      const projectBudget = budgets?.find(b => b.projectId === project.id);
      const projectInvoices = invoices?.filter(i => i.projectId === project.id) || [];

      // Ricavi
      // NOTA: importoServizio è in EURO, lo convertiamo in centesimi per coerenza
      const metadata = project.metadata as ProjectPrestazioni;
      const ricaviPrevisti = (metadata?.importoServizio || 0) * 100;
      const ricaviFatturati = projectInvoices.reduce((sum, inv) => sum + inv.importoNetto, 0);
      const ricaviIncassati = projectInvoices
        .filter(inv => inv.stato === 'pagata')
        .reduce((sum, inv) => sum + inv.importoNetto, 0);

      // Costi Personale (da risorse)
      const costiPersonale = projectResources.reduce(
        (sum, r) => sum + (r.oreLavorate * r.costoOrario), 0
      );

      // Costi Esterni (da budget)
      const costiConsulenze = projectBudget?.costiConsulenze || 0;
      const costiRilievi = projectBudget?.costiRilievi || 0;
      const altriCosti = projectBudget?.altriCosti || 0;
      const costiEsterni = costiConsulenze + costiRilievi + altriCosti;

      // Totali
      const costiTotali = costiPersonale + costiEsterni;
      const margine = ricaviPrevisti - costiTotali;
      const marginePercent = ricaviPrevisti > 0 ? (margine / ricaviPrevisti) * 100 : 0;

      // Ore
      const oreAssegnate = projectResources.reduce((sum, r) => sum + r.oreAssegnate, 0);
      const oreLavorate = projectResources.reduce((sum, r) => sum + r.oreLavorate, 0);
      const responsabile = projectResources.find(r => r.isResponsabile);

      return {
        project,
        resources: projectResources,
        ricaviPrevisti,
        ricaviFatturati,
        ricaviIncassati,
        costiPersonale,
        costiConsulenze,
        costiRilievi,
        altriCosti,
        costiEsterni,
        costiTotali,
        margine,
        marginePercent,
        oreAssegnate,
        oreLavorate,
        responsabile
      };
    });
  }, [projects, resources, budgets, invoices]);

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
      {
        ricaviPrevisti: 0,
        ricaviFatturati: 0,
        ricaviIncassati: 0,
        costiPersonale: 0,
        costiEsterni: 0,
        costiTotali: 0,
        oreAssegnate: 0,
        oreLavorate: 0
      }
    );

    const margine = totals.ricaviPrevisti - totals.costiTotali;
    const marginePercent = totals.ricaviPrevisti > 0
      ? (margine / totals.ricaviPrevisti) * 100
      : 0;
    const efficienzaOre = totals.oreAssegnate > 0
      ? (totals.oreLavorate / totals.oreAssegnate) * 100
      : 0;

    return { ...totals, margine, marginePercent, efficienzaOre };
  }, [projectCostsData]);

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let data = [...projectCostsData];

    // Filter by status
    if (statusFilter !== "all") {
      data = data.filter(p => p.project.status === statusFilter);
    }

    // Sort
    data.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

    return data;
  }, [projectCostsData, statusFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Chart data
  const costiDistributionData = [
    { name: "Personale", value: globalStats.costiPersonale, color: COLORS[0] },
    { name: "Consulenze", value: globalStats.costiEsterni > 0 ? (budgets?.reduce((s, b) => s + (b.costiConsulenze || 0), 0) || 0) : 0, color: COLORS[1] },
    { name: "Rilievi", value: budgets?.reduce((s, b) => s + (b.costiRilievi || 0), 0) || 0, color: COLORS[2] },
    { name: "Altri", value: budgets?.reduce((s, b) => s + (b.altriCosti || 0), 0) || 0, color: COLORS[3] }
  ].filter(item => item.value > 0);

  const top5Margine = [...projectCostsData]
    .sort((a, b) => b.margine - a.margine)
    .slice(0, 5);

  const bottom5Margine = [...projectCostsData]
    .filter(p => p.margine < 0)
    .sort((a, b) => a.margine - b.margine)
    .slice(0, 5);

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getMargineColor = (percent: number) => {
    if (percent >= 20) return "text-green-600 dark:text-green-400";
    if (percent >= 10) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMargineBadge = (percent: number) => {
    if (percent >= 20) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{percent.toFixed(1)}%</Badge>;
    if (percent >= 10) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{percent.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{percent.toFixed(1)}%</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analisi Costi</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Monitoraggio costi e margini per commessa</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setSelectedProjectForCost("");
              setBudgetFormData({ costiConsulenze: 0, costiRilievi: 0, altriCosti: 0 });
              setIsCostDialogOpen(true);
            }}>
              <Receipt className="w-4 h-4 mr-2" />
              Aggiungi Costo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              resetResourceForm();
              setIsResourceDialogOpen(true);
            }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Aggiungi Risorsa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dialog Aggiungi Risorsa */}
        <Dialog open={isResourceDialogOpen} onOpenChange={setIsResourceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingResource ? "Modifica Risorsa" : "Aggiungi Nuova Risorsa"}</DialogTitle>
              <DialogDescription>
                Assegna una risorsa ad una commessa con ore e costo orario
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResourceSubmit} className="space-y-4">
              <div>
                <Label htmlFor="project">Commessa *</Label>
                <Select
                  value={selectedProjectForResource}
                  onValueChange={setSelectedProjectForResource}
                  disabled={!!editingResource}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona commessa" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.object}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userName">Nome Risorsa *</Label>
                  <Input
                    id="userName"
                    value={resourceFormData.userName}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, userName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={resourceFormData.userEmail}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, userEmail: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">Ruolo *</Label>
                <Select
                  value={resourceFormData.role}
                  onValueChange={(value) => setResourceFormData({ ...resourceFormData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.icon} {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="oreAssegnate">Ore Assegnate</Label>
                  <Input
                    id="oreAssegnate"
                    type="number"
                    value={resourceFormData.oreAssegnate}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, oreAssegnate: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="oreLavorate">Ore Lavorate</Label>
                  <Input
                    id="oreLavorate"
                    type="number"
                    value={resourceFormData.oreLavorate}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, oreLavorate: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="costoOrario">Costo Orario (€)</Label>
                  <Input
                    id="costoOrario"
                    type="number"
                    step="0.01"
                    value={resourceFormData.costoOrario}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, costoOrario: parseFloat(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dataInizio">Data Inizio</Label>
                  <Input
                    id="dataInizio"
                    type="date"
                    value={resourceFormData.dataInizio}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, dataInizio: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dataFine">Data Fine Prevista</Label>
                  <Input
                    id="dataFine"
                    type="date"
                    value={resourceFormData.dataFine}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, dataFine: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isResponsabile"
                  checked={resourceFormData.isResponsabile}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, isResponsabile: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isResponsabile" className="font-normal">
                  Responsabile di Commessa
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetResourceForm}>
                  Annulla
                </Button>
                <Button type="submit" disabled={saveResourceMutation.isPending}>
                  {saveResourceMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Aggiungi Costo */}
        <Dialog open={isCostDialogOpen} onOpenChange={setIsCostDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi Costo Esterno</DialogTitle>
              <DialogDescription>
                Inserisci costi esterni (consulenze, rilievi, altri) per una commessa
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!selectedProjectForCost) {
                toast({
                  title: "Errore",
                  description: "Seleziona una commessa",
                  variant: "destructive"
                });
                return;
              }
              saveBudgetMutation.mutate({
                projectId: selectedProjectForCost,
                data: {
                  costiConsulenze: Math.round(budgetFormData.costiConsulenze * 100),
                  costiRilievi: Math.round(budgetFormData.costiRilievi * 100),
                  altriCosti: Math.round(budgetFormData.altriCosti * 100)
                }
              });
              setIsCostDialogOpen(false);
            }} className="space-y-4">
              <div>
                <Label htmlFor="projectCost">Commessa *</Label>
                <Select
                  value={selectedProjectForCost}
                  onValueChange={(value) => {
                    setSelectedProjectForCost(value);
                    const budget = budgets?.find(b => b.projectId === value);
                    setBudgetFormData({
                      costiConsulenze: (budget?.costiConsulenze || 0) / 100,
                      costiRilievi: (budget?.costiRilievi || 0) / 100,
                      altriCosti: (budget?.altriCosti || 0) / 100
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona commessa" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.object}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="costiConsulenzeNew">Consulenze (€)</Label>
                <Input
                  id="costiConsulenzeNew"
                  type="number"
                  step="0.01"
                  value={budgetFormData.costiConsulenze}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, costiConsulenze: parseFloat(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="costiRilieviNew">Rilievi (€)</Label>
                <Input
                  id="costiRilieviNew"
                  type="number"
                  step="0.01"
                  value={budgetFormData.costiRilievi}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, costiRilievi: parseFloat(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="altriCostiNew">Altri Costi (€)</Label>
                <Input
                  id="altriCostiNew"
                  type="number"
                  step="0.01"
                  value={budgetFormData.altriCosti}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, altriCosti: parseFloat(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCostDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={saveBudgetMutation.isPending}>
                  {saveBudgetMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Ricavi */}
        <div className="card-g2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ricavi Totali</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {formatCurrency(globalStats.ricaviPrevisti)}
          </p>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Fatturato:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {formatCurrency(globalStats.ricaviFatturati)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Incassato:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(globalStats.ricaviIncassati)}
              </span>
            </div>
          </div>
        </div>

        {/* Costi */}
        <div className="card-g2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Costi Totali</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {formatCurrency(globalStats.costiTotali)}
          </p>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Personale:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(globalStats.costiPersonale)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Esterni:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(globalStats.costiEsterni)}
              </span>
            </div>
          </div>
        </div>

        {/* Margine */}
        <div className="card-g2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Margine Operativo</p>
          <p className={`text-3xl font-bold mb-3 ${getMargineColor(globalStats.marginePercent)}`}>
            {formatCurrency(globalStats.margine)}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Percentuale:</span>
            <span className={`font-bold flex items-center gap-1 ${getMargineColor(globalStats.marginePercent)}`}>
              {globalStats.marginePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {globalStats.marginePercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Ore */}
        <div className="card-g2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gestione Ore</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{globalStats.oreLavorate}h</p>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Assegnate:</span>
              <span className="font-medium text-gray-900 dark:text-white">{globalStats.oreAssegnate}h</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Efficienza:</span>
              <span className={`font-bold ${globalStats.efficienzaOre <= 100 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {globalStats.efficienzaOre.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(globalStats.marginePercent < 20 || globalStats.efficienzaOre > 100) && (
        <div className="card-g2 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-semibold mb-3">
            <AlertTriangle className="w-5 h-5" />
            Attenzione
          </div>
          <div className="space-y-2">
            {globalStats.marginePercent < 20 && (
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Marginalità globale bassa ({globalStats.marginePercent.toFixed(1)}%). Considerare ottimizzazione costi o revisione compensi.
              </p>
            )}
            {globalStats.efficienzaOre > 100 && (
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Ore lavorate superiori alle ore assegnate ({globalStats.efficienzaOre.toFixed(1)}%). Verificare budget ore progetti.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-100 dark:bg-gray-800 w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="panoramica" className="flex-1 min-w-[100px] text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
            <BarChartIcon className="w-4 h-4 mr-1 hidden sm:inline" />
            Panoramica
          </TabsTrigger>
          <TabsTrigger value="dettaglio" className="flex-1 min-w-[100px] text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
            <Euro className="w-4 h-4 mr-1 hidden sm:inline" />
            Dettaglio Commesse
          </TabsTrigger>
        </TabsList>

        {/* Panoramica Tab */}
        <TabsContent value="panoramica" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Distribuzione Costi */}
            <div className="card-g2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribuzione Costi</h3>
              {costiDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={costiDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {costiDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nessun costo registrato</p>
              )}
            </div>

            {/* Top 5 Margine */}
            <div className="card-g2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Commesse per Margine</h3>
              <div className="space-y-3">
                {top5Margine.map((item, index) => (
                  <div key={item.project.id} className="flex items-center justify-between p-3 border dark:border-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                        #{index + 1}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{item.project.code}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{item.project.object}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getMargineColor(item.marginePercent)}`}>
                        {formatCurrency(item.margine)}
                      </div>
                      {getMargineBadge(item.marginePercent)}
                    </div>
                  </div>
                ))}
                {top5Margine.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nessuna commessa</p>
                )}
              </div>
            </div>
          </div>

          {/* Commesse in Perdita */}
          {bottom5Margine.length > 0 && (
            <div className="card-g2 border-red-200 dark:border-red-800">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Commesse in Perdita
              </h3>
              <div className="space-y-3">
                {bottom5Margine.map((item) => (
                  <div key={item.project.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.project.code}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.project.client}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(item.margine)}
                      </div>
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        {item.marginePercent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Dettaglio Commesse Tab */}
        <TabsContent value="dettaglio" className="space-y-4">
          {/* Filters */}
          <div className="card-g2">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="in corso">In Corso</SelectItem>
                    <SelectItem value="conclusa">Conclusa</SelectItem>
                    <SelectItem value="sospesa">Sospesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Ordina per:</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margine">Margine €</SelectItem>
                    <SelectItem value="marginePercent">Margine %</SelectItem>
                    <SelectItem value="ricavi">Ricavi</SelectItem>
                    <SelectItem value="costi">Costi</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                >
                  {sortOrder === "desc" ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-sm">Mostra:</Label>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(v) => {
                    setItemsPerPage(parseInt(v) as 10 | 25 | 50);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
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
          </div>

          {/* Projects List */}
          <div className="space-y-4">
            {paginatedData.map((item) => (
              <div key={item.project.id} className="card-g2">
                {/* Project Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedProject(expandedProject === item.project.id ? null : item.project.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-gray-900 dark:text-white">{item.project.code}</div>
                      <Badge variant={item.project.status === 'in corso' ? 'default' : item.project.status === 'conclusa' ? 'secondary' : 'outline'}>
                        {item.project.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{item.project.client} - {item.project.object}</div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Ricavi</div>
                      <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.ricaviPrevisti)}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Costi</div>
                      <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.costiTotali)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Margine</div>
                      <div className={`font-bold ${getMargineColor(item.marginePercent)}`}>
                        {formatCurrency(item.margine)}
                      </div>
                    </div>
                    <div>
                      {getMargineBadge(item.marginePercent)}
                    </div>
                    {expandedProject === item.project.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedProject === item.project.id && (
                  <div className="mt-6 pt-6 border-t dark:border-gray-700 space-y-6">
                    {/* Economic Summary */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Ricavi */}
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">Ricavi</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Previsti:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.ricaviPrevisti)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Fatturato:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.ricaviFatturati)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Incassato:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.ricaviIncassati)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 dark:border-gray-600">
                            <span className="text-gray-600 dark:text-gray-400">Da fatturare:</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(item.ricaviPrevisti - item.ricaviFatturati)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Costi */}
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-red-800 dark:text-red-200">Costi</h4>
                          <Button variant="outline" size="sm" onClick={() => handleEditBudget(item.project.id)}>
                            <Edit className="w-3 h-3 mr-1" />
                            Modifica
                          </Button>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Personale:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.costiPersonale)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Consulenze:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.costiConsulenze)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Rilievi:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.costiRilievi)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Altri:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.altriCosti)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 dark:border-gray-600">
                            <span className="font-semibold text-gray-900 dark:text-white">Totale:</span>
                            <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(item.costiTotali)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Margine Bar */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900 dark:text-white">Margine Operativo</span>
                        <span className={`text-2xl font-bold ${getMargineColor(item.marginePercent)}`}>
                          {formatCurrency(item.margine)} ({item.marginePercent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full ${item.marginePercent >= 20 ? 'bg-green-500' : item.marginePercent >= 10 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.max(0, Math.min(100, item.marginePercent))}%` }}
                        />
                      </div>
                    </div>

                    {/* Resources Table */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Risorse Assegnate</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProjectForResource(item.project.id);
                            setIsResourceDialogOpen(true);
                          }}
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          Aggiungi
                        </Button>
                      </div>
                      {item.resources.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nessuna risorsa assegnata</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b dark:border-gray-700">
                                <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Risorsa</th>
                                <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Ruolo</th>
                                <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Ore</th>
                                <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">€/h</th>
                                <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Totale</th>
                                <th className="text-center py-2 px-3 text-gray-700 dark:text-gray-300">Azioni</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.resources.map(resource => {
                                const roleInfo = ROLES.find(r => r.value === resource.role);
                                const costoTotale = resource.oreLavorate * resource.costoOrario;
                                return (
                                  <tr key={resource.id} className="border-b dark:border-gray-700">
                                    <td className="py-2 px-3">
                                      <div className="font-medium text-gray-900 dark:text-white">{resource.userName}</div>
                                      {resource.isResponsabile && <Badge variant="secondary" className="text-xs">Resp.</Badge>}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="text-gray-600 dark:text-gray-400">{roleInfo?.icon} {roleInfo?.label}</span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                                      {resource.oreLavorate}/{resource.oreAssegnate}h
                                    </td>
                                    <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                                      €{(resource.costoOrario / 100).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                                      {formatCurrency(costoTotale)}
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleEditResource(resource)}>
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (confirm("Eliminare questa risorsa?")) {
                                              deleteResourceMutation.mutate(resource.id);
                                            }
                                          }}
                                        >
                                          <Trash2 className="w-3 h-3 text-red-500" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                                <td colSpan={2} className="py-2 px-3 text-gray-900 dark:text-white">Totale</td>
                                <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                                  {item.oreLavorate}/{item.oreAssegnate}h
                                </td>
                                <td className="py-2 px-3"></td>
                                <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                                  {formatCurrency(item.costiPersonale)}
                                </td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {paginatedData.length === 0 && (
              <div className="card-g2 text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">Nessuna commessa trovata con i filtri selezionati</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pagina <strong>{currentPage}</strong> di <strong>{totalPages}</strong> ({filteredData.length} commesse)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Precedente</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <span className="hidden sm:inline mr-1">Successiva</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Budget Edit Dialog */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Costi Esterni</DialogTitle>
            <DialogDescription>
              Inserisci i costi esterni per questa commessa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBudgetSubmit} className="space-y-4">
            <div>
              <Label htmlFor="costiConsulenze">Consulenze (€)</Label>
              <Input
                id="costiConsulenze"
                type="number"
                step="0.01"
                value={budgetFormData.costiConsulenze}
                onChange={(e) => setBudgetFormData({ ...budgetFormData, costiConsulenze: parseFloat(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="costiRilievi">Rilievi (€)</Label>
              <Input
                id="costiRilievi"
                type="number"
                step="0.01"
                value={budgetFormData.costiRilievi}
                onChange={(e) => setBudgetFormData({ ...budgetFormData, costiRilievi: parseFloat(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="altriCosti">Altri Costi (€)</Label>
              <Input
                id="altriCosti"
                type="number"
                step="0.01"
                value={budgetFormData.altriCosti}
                onChange={(e) => setBudgetFormData({ ...budgetFormData, altriCosti: parseFloat(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={saveBudgetMutation.isPending}>
                {saveBudgetMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
