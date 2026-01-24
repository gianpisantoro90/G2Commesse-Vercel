import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Euro,
  FileText,
  Play,
  Plus,
  Search,
  Settings,
  ChevronRight,
  Edit,
  Download,
  Send,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Project,
  type ProjectPrestazione,
  type ProjectInvoice,
  PRESTAZIONE_TIPI,
  LIVELLI_PROGETTAZIONE,
} from "@shared/schema";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { BillingConfig } from "./billing-config";

// ============================================
// CONFIGURAZIONI
// ============================================

const PRESTAZIONE_CONFIG: Record<string, { label: string; color: string }> = {
  progettazione: { label: "Progettazione", color: "bg-blue-500" },
  dl: { label: "Dir. Lavori", color: "bg-purple-500" },
  csp: { label: "CSP", color: "bg-orange-500" },
  cse: { label: "CSE", color: "bg-red-500" },
  contabilita: { label: "Contabilità", color: "bg-green-500" },
  collaudo: { label: "Collaudo", color: "bg-yellow-500" },
  perizia: { label: "Perizia", color: "bg-pink-500" },
  pratiche: { label: "Pratiche", color: "bg-gray-500" },
};

const STATO_CONFIG: Record<string, { label: string; color: string; bgColor: string; position: number }> = {
  da_iniziare: { label: "Da iniziare", color: "text-gray-500", bgColor: "bg-gray-200", position: 0 },
  in_corso: { label: "In corso", color: "text-blue-600", bgColor: "bg-blue-500", position: 1 },
  completata: { label: "Completata", color: "text-amber-600", bgColor: "bg-amber-500", position: 2 },
  fatturata: { label: "Fatturata", color: "text-purple-600", bgColor: "bg-purple-500", position: 3 },
  pagata: { label: "Pagata", color: "text-green-600", bgColor: "bg-green-500", position: 4 },
};

const INVOICE_STATO_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  bozza: { label: "Bozza", color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800" },
  emessa: { label: "Emessa", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  scaduta: { label: "Scaduta", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
  pagata: { label: "Pagata", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  parzialmente_pagata: { label: "Parziale", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
};

// ============================================
// TIPI
// ============================================

interface PrestazioneWithInvoices extends ProjectPrestazione {
  invoices: ProjectInvoice[];
}

interface ProjectWithBilling extends Project {
  prestazioni: PrestazioneWithInvoices[];
  directInvoices: ProjectInvoice[]; // Fatture non collegate a prestazioni
  totals: {
    budget: number;
    fatturato: number;
    incassato: number;
    daIncassare: number;
    percentualeFatturato: number;
    percentualeIncassato: number;
  };
  alerts: {
    prestazioniDaFatturare: number;
    fattureScadute: number;
    pagamentiInRitardo: number;
  };
}

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

export default function BillingFlow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showConfig, setShowConfig] = useState(false);
  const [selectedPrestazione, setSelectedPrestazione] = useState<PrestazioneWithInvoices | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ProjectInvoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    numeroFattura: "",
    dataEmissione: new Date().toISOString().split("T")[0],
    imponibile: 0,
    cassaPercentuale: 4,
    ivaPercentuale: 22,
    ritenuta: 0,
    scadenzaPagamento: "",
    tipoFattura: "unica" as "acconto" | "sal" | "saldo" | "unica",
    note: "",
  });

  // Fetch data
  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allPrestazioni = [], isLoading: loadingPrestazioni } = useQuery<ProjectPrestazione[]>({
    queryKey: ["/api/prestazioni"],
  });

  const { data: allInvoices = [], isLoading: loadingInvoices } = useQuery<ProjectInvoice[]>({
    queryKey: ["/api/invoices"],
  });

  // Combine data
  const projectsWithBilling = useMemo((): ProjectWithBilling[] => {
    return projects
      .map((project) => {
        const projectPrestazioni = allPrestazioni.filter((p) => p.projectId === project.id);
        const projectInvoices = allInvoices.filter((i) => i.projectId === project.id);

        // Associate invoices with prestazioni
        const prestazioniWithInvoices: PrestazioneWithInvoices[] = projectPrestazioni.map((p) => ({
          ...p,
          invoices: projectInvoices.filter((i) => i.prestazioneId === p.id),
        }));

        // Direct invoices (not linked to prestazioni)
        const directInvoices = projectInvoices.filter((i) => !i.prestazioneId);

        // Calculate totals
        const budget = projectPrestazioni.reduce((sum, p) => sum + (p.importoPrevisto || 0), 0);
        const fatturato = projectInvoices.reduce((sum, i) => sum + i.importoTotale, 0);
        const incassato = projectInvoices
          .filter((i) => i.stato === "pagata")
          .reduce((sum, i) => sum + i.importoTotale, 0);
        const daIncassare = fatturato - incassato;

        // Calculate alerts
        const now = new Date();
        const prestazioniDaFatturare = projectPrestazioni.filter((p) => {
          if (p.stato !== "completata" || !p.dataCompletamento) return false;
          const daysSinceCompletion = Math.floor(
            (now.getTime() - new Date(p.dataCompletamento).getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSinceCompletion >= 15;
        }).length;

        const fattureScadute = projectInvoices.filter((i) => i.stato === "scaduta").length;

        const pagamentiInRitardo = projectInvoices.filter((i) => {
          if (i.stato === "pagata") return false;
          const daysSinceEmission = Math.floor(
            (now.getTime() - new Date(i.dataEmissione).getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSinceEmission >= 60;
        }).length;

        return {
          ...project,
          prestazioni: prestazioniWithInvoices,
          directInvoices,
          totals: {
            budget,
            fatturato,
            incassato,
            daIncassare,
            percentualeFatturato: budget > 0 ? Math.round((fatturato / budget) * 100) : 0,
            percentualeIncassato: fatturato > 0 ? Math.round((incassato / fatturato) * 100) : 0,
          },
          alerts: {
            prestazioniDaFatturare,
            fattureScadute,
            pagamentiInRitardo,
          },
        };
      })
      .filter((p) => p.prestazioni.length > 0 || p.directInvoices.length > 0);
  }, [projects, allPrestazioni, allInvoices]);

  // Global stats
  const globalStats = useMemo(() => {
    const totals = projectsWithBilling.reduce(
      (acc, p) => ({
        fatturato: acc.fatturato + p.totals.fatturato,
        incassato: acc.incassato + p.totals.incassato,
        daIncassare: acc.daIncassare + p.totals.daIncassare,
        prestazioniDaFatturare: acc.prestazioniDaFatturare + p.alerts.prestazioniDaFatturare,
        fattureScadute: acc.fattureScadute + p.alerts.fattureScadute,
        pagamentiInRitardo: acc.pagamentiInRitardo + p.alerts.pagamentiInRitardo,
      }),
      { fatturato: 0, incassato: 0, daIncassare: 0, prestazioniDaFatturare: 0, fattureScadute: 0, pagamentiInRitardo: 0 }
    );

    const percentualeIncassato = totals.fatturato > 0 ? Math.round((totals.incassato / totals.fatturato) * 100) : 0;
    const totalAlerts = totals.prestazioniDaFatturare + totals.fattureScadute + totals.pagamentiInRitardo;

    return { ...totals, percentualeIncassato, totalAlerts };
  }, [projectsWithBilling]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projectsWithBilling.filter((p) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchCode = p.code?.toLowerCase().includes(search);
        const matchClient = p.client?.toLowerCase().includes(search);
        const matchObject = p.object?.toLowerCase().includes(search);
        if (!matchCode && !matchClient && !matchObject) return false;
      }

      if (statusFilter !== "all") {
        if (statusFilter === "alert") {
          const hasAlert = p.alerts.prestazioniDaFatturare > 0 || p.alerts.fattureScadute > 0 || p.alerts.pagamentiInRitardo > 0;
          if (!hasAlert) return false;
        } else if (statusFilter === "da_incassare") {
          if (p.totals.daIncassare <= 0) return false;
        } else if (statusFilter === "completati") {
          const allPaid = p.prestazioni.every((pr) => pr.stato === "pagata");
          if (!allPaid || p.prestazioni.length === 0) return false;
        }
      }

      return true;
    });
  }, [projectsWithBilling, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProjects.slice(start, start + itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Mutations
  const updateStatoMutation = useMutation({
    mutationFn: async ({ id, stato }: { id: string; stato: string }) => {
      const res = await fetch(`/api/prestazioni/${id}/stato`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato, data: new Date().toISOString() }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Stato aggiornato" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/projects/${data.projectId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nella creazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Fattura creata" });
      closeInvoiceDialog();
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, projectId, ...data }: any) => {
      const res = await fetch(`/api/projects/${projectId}/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Fattura aggiornata" });
      closeInvoiceDialog();
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const res = await fetch(`/api/projects/${projectId}/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato: "pagata", dataPagamento: new Date().toISOString() }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Fattura incassata" });
    },
  });

  // Helpers
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd/MM/yy", { locale: it });
  };

  const calculateInvoiceTotals = () => {
    const imponibile = invoiceForm.imponibile * 100;
    const cassa = Math.round(imponibile * (invoiceForm.cassaPercentuale / 100));
    const baseIva = imponibile + cassa;
    const iva = Math.round(baseIva * (invoiceForm.ivaPercentuale / 100));
    const totale = baseIva + iva;
    const ritenuta = invoiceForm.ritenuta * 100;
    return { imponibile, cassa, iva, totale, ritenuta, netto: totale - ritenuta };
  };

  const openInvoiceDialog = (project: Project, prestazione?: PrestazioneWithInvoices, invoice?: ProjectInvoice) => {
    setSelectedProject(project);
    setSelectedPrestazione(prestazione || null);
    setEditingInvoice(invoice || null);

    if (invoice) {
      setInvoiceForm({
        numeroFattura: invoice.numeroFattura,
        dataEmissione: new Date(invoice.dataEmissione).toISOString().split("T")[0],
        imponibile: invoice.importoNetto / 100,
        cassaPercentuale: invoice.cassaPrevidenziale ? (invoice.cassaPrevidenziale / invoice.importoNetto) * 100 : 4,
        ivaPercentuale: invoice.aliquotaIVA || 22,
        ritenuta: (invoice.ritenuta || 0) / 100,
        scadenzaPagamento: invoice.scadenzaPagamento ? new Date(invoice.scadenzaPagamento).toISOString().split("T")[0] : "",
        tipoFattura: (invoice.tipoFattura as any) || "unica",
        note: invoice.note || "",
      });
    } else {
      setInvoiceForm({
        numeroFattura: "",
        dataEmissione: new Date().toISOString().split("T")[0],
        imponibile: prestazione ? (prestazione.importoPrevisto || 0) / 100 : 0,
        cassaPercentuale: 4,
        ivaPercentuale: 22,
        ritenuta: 0,
        scadenzaPagamento: "",
        tipoFattura: "unica",
        note: "",
      });
    }

    setIsInvoiceDialogOpen(true);
  };

  const closeInvoiceDialog = () => {
    setIsInvoiceDialogOpen(false);
    setSelectedProject(null);
    setSelectedPrestazione(null);
    setEditingInvoice(null);
  };

  const handleSaveInvoice = () => {
    if (!selectedProject) return;

    const totals = calculateInvoiceTotals();

    const invoiceData = {
      projectId: selectedProject.id,
      prestazioneId: selectedPrestazione?.id || null,
      numeroFattura: invoiceForm.numeroFattura,
      dataEmissione: invoiceForm.dataEmissione,
      scadenzaPagamento: invoiceForm.scadenzaPagamento || null,
      importoNetto: totals.imponibile,
      cassaPrevidenziale: totals.cassa,
      importoIVA: totals.iva,
      importoTotale: totals.totale,
      aliquotaIVA: invoiceForm.ivaPercentuale,
      ritenuta: totals.ritenuta,
      tipoFattura: invoiceForm.tipoFattura,
      note: invoiceForm.note,
      stato: "emessa",
    };

    if (editingInvoice) {
      updateInvoiceMutation.mutate({ id: editingInvoice.id, ...invoiceData });
    } else {
      createInvoiceMutation.mutate(invoiceData);
    }
  };

  const getNextStato = (current: string): string | null => {
    const order = ["da_iniziare", "in_corso", "completata", "fatturata", "pagata"];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : null;
  };

  const getDaysSince = (date: Date | string | null): number => {
    if (!date) return 0;
    return Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };

  const isLoading = loadingProjects || loadingPrestazioni || loadingInvoices;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Euro className="w-7 h-7" />
            Fatturazione
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestione completa prestazioni e fatture
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
            <Settings className="w-4 h-4 mr-1" />
            Config
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Nuova Fattura
          </Button>
        </div>
      </div>

      {/* CONFIG (collapsible) */}
      {showConfig && (
        <BillingConfig />
      )}

      {/* RIEPILOGO GLOBALE */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-0">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Fatturato</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(globalStats.fatturato)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Incassato</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(globalStats.incassato)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Da incassare</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(globalStats.daIncassare)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-48">
                <div className="flex justify-between text-sm mb-1">
                  <span>Incassato</span>
                  <span>{globalStats.percentualeIncassato}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${globalStats.percentualeIncassato}%` }}
                  />
                </div>
              </div>

              {globalStats.totalAlerts > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {globalStats.totalAlerts} alert
                </Badge>
              )}
            </div>
          </div>

          {/* Alert breakdown */}
          {globalStats.totalAlerts > 0 && (
            <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {globalStats.prestazioniDaFatturare > 0 && (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  {globalStats.prestazioniDaFatturare} da fatturare
                </span>
              )}
              {globalStats.fattureScadute > 0 && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {globalStats.fattureScadute} scadute
                </span>
              )}
              {globalStats.pagamentiInRitardo > 0 && (
                <span className="text-sm text-orange-600 dark:text-orange-400">
                  {globalStats.pagamentiInRitardo} in ritardo
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FILTRI */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Cerca commessa, cliente..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtra per stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="alert">Con alert</SelectItem>
            <SelectItem value="da_incassare">Da incassare</SelectItem>
            <SelectItem value="completati">Completati</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Per pagina:</span>
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-[80px]">
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

      {/* LISTA COMMESSE */}
      <div className="space-y-4">
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna commessa con prestazioni o fatture</p>
            </CardContent>
          </Card>
        ) : (
          paginatedProjects.map((project) => (
            <ProjectBillingCard
              key={project.id}
              project={project}
              onAdvanceStato={(prestazione) => {
                const next = getNextStato(prestazione.stato);
                if (next && next !== "fatturata" && next !== "pagata") {
                  updateStatoMutation.mutate({ id: prestazione.id, stato: next });
                }
              }}
              onCreateInvoice={(prestazione) => openInvoiceDialog(project, prestazione)}
              onEditInvoice={(invoice, prestazione) => openInvoiceDialog(project, prestazione, invoice)}
              onMarkAsPaid={(invoice) => markAsPaidMutation.mutate({ id: invoice.id, projectId: project.id })}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getDaysSince={getDaysSince}
            />
          ))
        )}
      </div>

      {/* PAGINAZIONE */}
      {filteredProjects.length > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {filteredProjects.length} commesse totali
            {filteredProjects.length > itemsPerPage && (
              <span> | Pagina {currentPage} di {totalPages}</span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Precedente
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Successiva
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* DIALOG FATTURA */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? "Modifica Fattura" : "Nuova Fattura"}
            </DialogTitle>
            <DialogDescription>
              {selectedProject?.code} - {selectedProject?.client}
              {selectedPrestazione && (
                <span className="ml-2">
                  | {PRESTAZIONE_CONFIG[selectedPrestazione.tipo]?.label || selectedPrestazione.tipo}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Numero Fattura *</Label>
                <Input
                  value={invoiceForm.numeroFattura}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, numeroFattura: e.target.value })}
                  placeholder="001/2025"
                />
              </div>
              <div>
                <Label>Data Emissione *</Label>
                <Input
                  type="date"
                  value={invoiceForm.dataEmissione}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dataEmissione: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={invoiceForm.tipoFattura}
                  onValueChange={(v) => setInvoiceForm({ ...invoiceForm, tipoFattura: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Unica</SelectItem>
                    <SelectItem value="acconto">Acconto</SelectItem>
                    <SelectItem value="sal">SAL</SelectItem>
                    <SelectItem value="saldo">Saldo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scadenza Pagamento</Label>
                <Input
                  type="date"
                  value={invoiceForm.scadenzaPagamento}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, scadenzaPagamento: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Imponibile (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoiceForm.imponibile}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, imponibile: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Cassa %</Label>
                <Input
                  type="number"
                  value={invoiceForm.cassaPercentuale}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, cassaPercentuale: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>IVA %</Label>
                <Input
                  type="number"
                  value={invoiceForm.ivaPercentuale}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, ivaPercentuale: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Ritenuta (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoiceForm.ritenuta}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, ritenuta: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Totals preview */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Imponibile:</span>
                <span className="text-right">{formatCurrency(calculateInvoiceTotals().imponibile)}</span>
                <span>Cassa {invoiceForm.cassaPercentuale}%:</span>
                <span className="text-right">{formatCurrency(calculateInvoiceTotals().cassa)}</span>
                <span>IVA {invoiceForm.ivaPercentuale}%:</span>
                <span className="text-right">{formatCurrency(calculateInvoiceTotals().iva)}</span>
                <span className="font-bold border-t pt-1">TOTALE:</span>
                <span className="text-right font-bold border-t pt-1">
                  {formatCurrency(calculateInvoiceTotals().totale)}
                </span>
                {invoiceForm.ritenuta > 0 && (
                  <>
                    <span>Ritenuta:</span>
                    <span className="text-right">-{formatCurrency(calculateInvoiceTotals().ritenuta)}</span>
                    <span className="font-bold">Netto a pagare:</span>
                    <span className="text-right font-bold">{formatCurrency(calculateInvoiceTotals().netto)}</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label>Note</Label>
              <Input
                value={invoiceForm.note}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, note: e.target.value })}
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeInvoiceDialog}>
              Annulla
            </Button>
            <Button onClick={handleSaveInvoice} disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}>
              {editingInvoice ? "Salva Modifiche" : "Crea Fattura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// COMPONENTE CARD COMMESSA
// ============================================

interface ProjectBillingCardProps {
  project: ProjectWithBilling;
  onAdvanceStato: (prestazione: PrestazioneWithInvoices) => void;
  onCreateInvoice: (prestazione?: PrestazioneWithInvoices) => void;
  onEditInvoice: (invoice: ProjectInvoice, prestazione?: PrestazioneWithInvoices) => void;
  onMarkAsPaid: (invoice: ProjectInvoice) => void;
  formatCurrency: (cents: number) => string;
  formatDate: (date: Date | string | null) => string;
  getDaysSince: (date: Date | string | null) => number;
}

function ProjectBillingCard({
  project,
  onAdvanceStato,
  onCreateInvoice,
  onEditInvoice,
  onMarkAsPaid,
  formatCurrency,
  formatDate,
  getDaysSince,
}: ProjectBillingCardProps) {
  const hasAlerts = project.alerts.prestazioniDaFatturare > 0 ||
                    project.alerts.fattureScadute > 0 ||
                    project.alerts.pagamentiInRitardo > 0;

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      hasAlerts ? "border-amber-500/50" : "border-gray-200 dark:border-gray-700"
    )}>
      {/* Header Commessa */}
      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            <span className="font-bold text-gray-900 dark:text-white">{project.code}</span>
          </div>
          <span className="text-gray-600 dark:text-gray-400">{project.client}</span>
          {hasAlerts && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Alert
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span>
            Budget: <strong>{formatCurrency(project.totals.budget)}</strong>
          </span>
          <span>
            Fatt: <strong className="text-purple-600">{formatCurrency(project.totals.fatturato)}</strong>
            <span className="text-gray-500 ml-1">({project.totals.percentualeFatturato}%)</span>
          </span>
          <span>
            Inc: <strong className="text-green-600">{formatCurrency(project.totals.incassato)}</strong>
            <span className="text-gray-500 ml-1">({project.totals.percentualeIncassato}%)</span>
          </span>
          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${project.totals.percentualeIncassato}%` }}
            />
          </div>
        </div>
      </div>

      {/* Prestazioni */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {project.prestazioni.map((prestazione) => (
          <PrestazioneRow
            key={prestazione.id}
            prestazione={prestazione}
            project={project}
            onAdvanceStato={() => onAdvanceStato(prestazione)}
            onCreateInvoice={() => onCreateInvoice(prestazione)}
            onEditInvoice={(invoice) => onEditInvoice(invoice, prestazione)}
            onMarkAsPaid={onMarkAsPaid}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            getDaysSince={getDaysSince}
          />
        ))}

        {/* Direct Invoices */}
        {project.directInvoices.map((invoice) => (
          <DirectInvoiceRow
            key={invoice.id}
            invoice={invoice}
            onEdit={() => onEditInvoice(invoice)}
            onMarkAsPaid={() => onMarkAsPaid(invoice)}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            getDaysSince={getDaysSince}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE RIGA PRESTAZIONE
// ============================================

interface PrestazioneRowProps {
  prestazione: PrestazioneWithInvoices;
  project: ProjectWithBilling;
  onAdvanceStato: () => void;
  onCreateInvoice: () => void;
  onEditInvoice: (invoice: ProjectInvoice) => void;
  onMarkAsPaid: (invoice: ProjectInvoice) => void;
  formatCurrency: (cents: number) => string;
  formatDate: (date: Date | string | null) => string;
  getDaysSince: (date: Date | string | null) => number;
}

function PrestazioneRow({
  prestazione,
  project,
  onAdvanceStato,
  onCreateInvoice,
  onEditInvoice,
  onMarkAsPaid,
  formatCurrency,
  formatDate,
  getDaysSince,
}: PrestazioneRowProps) {
  const config = PRESTAZIONE_CONFIG[prestazione.tipo] || { label: prestazione.tipo, color: "bg-gray-500" };
  const statoConfig = STATO_CONFIG[prestazione.stato] || STATO_CONFIG.da_iniziare;

  const isCompletedLongAgo = prestazione.stato === "completata" && getDaysSince(prestazione.dataCompletamento) >= 15;
  const needsInvoice = prestazione.stato === "completata" && prestazione.invoices.length === 0;

  return (
    <div className={cn(
      "px-4 py-3 grid grid-cols-12 gap-4 items-start",
      isCompletedLongAgo && "bg-amber-50/50 dark:bg-amber-900/10"
    )}>
      {/* Prestazione Info */}
      <div className="col-span-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", config.color)} />
          <span className="font-medium text-gray-900 dark:text-white">{config.label}</span>
        </div>
        {prestazione.livelloProgettazione && (
          <span className="text-xs text-gray-500 ml-4">{prestazione.livelloProgettazione.toUpperCase()}</span>
        )}
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {formatCurrency(prestazione.importoPrevisto || 0)}
        </div>
      </div>

      {/* Workflow Timeline */}
      <div className="col-span-4">
        <WorkflowTimeline stato={prestazione.stato} />

        <div className="mt-2 flex items-center gap-2">
          <Badge className={cn("text-xs", statoConfig.bgColor, statoConfig.color)}>
            {statoConfig.label}
          </Badge>

          {isCompletedLongAgo && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {getDaysSince(prestazione.dataCompletamento)}gg fa
            </span>
          )}

          {/* Action button */}
          {prestazione.stato === "da_iniziare" && (
            <Button size="sm" variant="outline" onClick={onAdvanceStato} className="h-6 text-xs">
              <Play className="w-3 h-3 mr-1" /> Avvia
            </Button>
          )}
          {prestazione.stato === "in_corso" && (
            <Button size="sm" variant="outline" onClick={onAdvanceStato} className="h-6 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" /> Completa
            </Button>
          )}
          {needsInvoice && (
            <Button size="sm" variant="default" onClick={onCreateInvoice} className="h-6 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Fattura
            </Button>
          )}
        </div>

        {isCompletedLongAgo && needsInvoice && (
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Da fatturare
          </div>
        )}
      </div>

      {/* Fatture */}
      <div className="col-span-6">
        {prestazione.invoices.length === 0 ? (
          <div className="text-sm text-gray-400 italic">
            Nessuna fattura
          </div>
        ) : (
          <div className="space-y-2">
            {prestazione.invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onEdit={() => onEditInvoice(invoice)}
                onMarkAsPaid={() => onMarkAsPaid(invoice)}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getDaysSince={getDaysSince}
              />
            ))}
          </div>
        )}

        {prestazione.invoices.length > 0 && prestazione.stato !== "pagata" && (
          <Button size="sm" variant="ghost" onClick={onCreateInvoice} className="mt-2 h-6 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Altra fattura
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE RIGA FATTURA DIRETTA
// ============================================

interface DirectInvoiceRowProps {
  invoice: ProjectInvoice;
  onEdit: () => void;
  onMarkAsPaid: () => void;
  formatCurrency: (cents: number) => string;
  formatDate: (date: Date | string | null) => string;
  getDaysSince: (date: Date | string | null) => number;
}

function DirectInvoiceRow({
  invoice,
  onEdit,
  onMarkAsPaid,
  formatCurrency,
  formatDate,
  getDaysSince,
}: DirectInvoiceRowProps) {
  const isOverdue = invoice.stato === "scaduta";

  return (
    <div className={cn(
      "px-4 py-3 grid grid-cols-12 gap-4 items-start",
      isOverdue && "bg-red-50/50 dark:bg-red-900/10"
    )}>
      {/* Prestazione Info (placeholder) */}
      <div className="col-span-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="font-medium text-gray-500 italic">Fattura diretta</span>
        </div>
        <div className="text-xs text-gray-400 ml-4">Non collegata a prestazione</div>
      </div>

      {/* Workflow Timeline (empty) */}
      <div className="col-span-4">
        <div className="h-6 flex items-center text-gray-400 text-sm">
          —
        </div>
      </div>

      {/* Fattura */}
      <div className="col-span-6">
        <InvoiceCard
          invoice={invoice}
          onEdit={onEdit}
          onMarkAsPaid={onMarkAsPaid}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getDaysSince={getDaysSince}
        />
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE WORKFLOW TIMELINE
// ============================================

function WorkflowTimeline({ stato }: { stato: string }) {
  const stages = ["da_iniziare", "in_corso", "completata", "fatturata", "pagata"];
  const currentIndex = stages.indexOf(stato);

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const config = STATO_CONFIG[stage];

        return (
          <div key={stage} className="flex items-center">
            {/* Node */}
            <div
              className={cn(
                "w-3 h-3 rounded-full border-2 transition-all",
                isCompleted
                  ? cn(config.bgColor, "border-transparent")
                  : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600",
                isCurrent && "ring-2 ring-offset-1 ring-blue-400"
              )}
            />
            {/* Connector */}
            {index < stages.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5",
                  index < currentIndex
                    ? "bg-green-500"
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// COMPONENTE CARD FATTURA
// ============================================

interface InvoiceCardProps {
  invoice: ProjectInvoice;
  onEdit: () => void;
  onMarkAsPaid: () => void;
  formatCurrency: (cents: number) => string;
  formatDate: (date: Date | string | null) => string;
  getDaysSince: (date: Date | string | null) => number;
}

function InvoiceCard({
  invoice,
  onEdit,
  onMarkAsPaid,
  formatCurrency,
  formatDate,
  getDaysSince,
}: InvoiceCardProps) {
  const statoConfig = INVOICE_STATO_CONFIG[invoice.stato] || INVOICE_STATO_CONFIG.emessa;
  const isOverdue = invoice.stato === "scaduta";
  const isPaid = invoice.stato === "pagata";

  const daysInfo = useMemo(() => {
    if (isPaid) return null;
    if (invoice.scadenzaPagamento) {
      const days = getDaysSince(invoice.scadenzaPagamento);
      if (days > 0) return { label: `Scaduta ${days}gg`, color: "text-red-600" };
      if (days < 0) return { label: `Scade tra ${Math.abs(days)}gg`, color: "text-gray-500" };
      return { label: "Scade oggi", color: "text-amber-600" };
    }
    const daysSinceEmission = getDaysSince(invoice.dataEmissione);
    return { label: `${daysSinceEmission}gg fa`, color: "text-gray-500" };
  }, [invoice, isPaid, getDaysSince]);

  return (
    <div className={cn(
      "border rounded-lg p-3",
      statoConfig.bgColor,
      isOverdue && "border-red-300 dark:border-red-700"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{invoice.numeroFattura}</span>
            {invoice.tipoFattura && invoice.tipoFattura !== "unica" && (
              <Badge variant="outline" className="text-xs">
                {invoice.tipoFattura}
              </Badge>
            )}
            <Badge className={cn("text-xs", statoConfig.color, statoConfig.bgColor)}>
              {isPaid && <CheckCircle className="w-3 h-3 mr-1" />}
              {isOverdue && <AlertTriangle className="w-3 h-3 mr-1" />}
              {statoConfig.label}
            </Badge>
          </div>

          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
            <span>Emessa: {formatDate(invoice.dataEmissione)}</span>
            {isPaid && invoice.dataPagamento && (
              <span>Pagata: {formatDate(invoice.dataPagamento)}</span>
            )}
            {!isPaid && daysInfo && (
              <span className={daysInfo.color}>{daysInfo.label}</span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-400">
            <div>
              <span className="block text-gray-400">Imponibile</span>
              <span>{formatCurrency(invoice.importoNetto)}</span>
            </div>
            <div>
              <span className="block text-gray-400">Cassa</span>
              <span>{formatCurrency(invoice.cassaPrevidenziale || 0)}</span>
            </div>
            <div>
              <span className="block text-gray-400">IVA</span>
              <span>{formatCurrency(invoice.importoIVA)}</span>
            </div>
            <div>
              <span className="block text-gray-400">Totale</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatCurrency(invoice.importoTotale)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 w-7 p-0">
            <Edit className="w-3 h-3" />
          </Button>
          {!isPaid && (
            <Button
              size="sm"
              variant={isOverdue ? "destructive" : "default"}
              onClick={onMarkAsPaid}
              className="h-7 text-xs px-2"
            >
              <Euro className="w-3 h-3 mr-1" />
              Incassa
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
