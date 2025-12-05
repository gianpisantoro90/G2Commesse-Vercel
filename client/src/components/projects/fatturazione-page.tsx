import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Euro,
  FileText,
  Play,
  ArrowRight,
  Trash2,
  Calendar,
  Download,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import {
  type Project,
  type ProjectPrestazione,
  type ProjectInvoice,
  type Client,
  PRESTAZIONE_TIPI,
  PRESTAZIONE_STATI,
  LIVELLI_PROGETTAZIONE,
} from "@shared/schema";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Config per tipi prestazione
const PRESTAZIONE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  'progettazione': { label: 'Progettazione', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: '📐' },
  'dl': { label: 'Dir. Lavori', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: '👷' },
  'csp': { label: 'CSP', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: '🦺' },
  'cse': { label: 'CSE', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: '🔒' },
  'contabilita': { label: 'Contabilità', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: '📊' },
  'collaudo': { label: 'Collaudo', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: '✅' },
  'perizia': { label: 'Perizia', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', icon: '📋' },
  'pratiche': { label: 'Pratiche', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: '📁' },
};

// Config per stati
const STATO_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'da_iniziare': { label: 'Da iniziare', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  'in_corso': { label: 'In corso', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900' },
  'completata': { label: 'Completata', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900' },
  'fatturata': { label: 'Fatturata', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900' },
  'pagata': { label: 'Pagata', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900' },
};

const LIVELLO_CONFIG: Record<string, string> = {
  'pfte': 'PFTE',
  'definitivo': 'Definitivo',
  'esecutivo': 'Esecutivo',
  'variante': 'Variante',
};

interface PrestazioneWithProject extends ProjectPrestazione {
  project?: Project;
}

export default function FatturazionePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statoFilter, setStatoFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedPrestazione, setSelectedPrestazione] = useState<PrestazioneWithProject | null>(null);
  const [selectedProjectForAdd, setSelectedProjectForAdd] = useState<string>("");

  // Form state for new prestazione
  const [formData, setFormData] = useState({
    tipo: '' as typeof PRESTAZIONE_TIPI[number] | '',
    livelloProgettazione: '' as typeof LIVELLI_PROGETTAZIONE[number] | '',
    descrizione: '',
    importoPrevisto: 0,
    note: '',
  });

  // Invoice form state
  const [invoiceFormData, setInvoiceFormData] = useState({
    numeroFattura: '',
    importoFatturato: 0,
    dataFattura: new Date().toISOString().split('T')[0],
    note: '',
  });

  // Fetch all data
  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: prestazioni = [], isLoading: loadingPrestazioni } = useQuery<ProjectPrestazione[]>({
    queryKey: ["/api/prestazioni"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Combine prestazioni with project info
  const prestazioniWithProjects = useMemo(() => {
    return prestazioni.map(p => ({
      ...p,
      project: projects.find(proj => proj.id === p.projectId),
    }));
  }, [prestazioni, projects]);

  // Calculate stats
  const stats = useMemo(() => {
    const daIniziare = prestazioni.filter(p => p.stato === 'da_iniziare').length;
    const inCorso = prestazioni.filter(p => p.stato === 'in_corso').length;
    const completate = prestazioni.filter(p => p.stato === 'completata').length;
    const fatturate = prestazioni.filter(p => p.stato === 'fatturata').length;
    const pagate = prestazioni.filter(p => p.stato === 'pagata').length;

    const completateNonFatturate = prestazioni.filter(p => p.stato === 'completata');
    const fatturateNonPagate = prestazioni.filter(p => p.stato === 'fatturata');

    const importoDaFatturare = completateNonFatturate.reduce((sum, p) => sum + (p.importoPrevisto || 0), 0);
    const importoDaIncassare = fatturateNonPagate.reduce((sum, p) => sum + (p.importoFatturato || 0), 0);

    return {
      totale: prestazioni.length,
      daIniziare,
      inCorso,
      completate,
      fatturate,
      pagate,
      completateNonFatturate: completateNonFatturate.length,
      fatturateNonPagate: fatturateNonPagate.length,
      importoDaFatturare,
      importoDaIncassare,
    };
  }, [prestazioni]);

  // Filter prestazioni
  const filteredPrestazioni = useMemo(() => {
    return prestazioniWithProjects.filter(p => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchProject = p.project?.code?.toLowerCase().includes(search) ||
                           p.project?.client?.toLowerCase().includes(search) ||
                           p.project?.object?.toLowerCase().includes(search);
        const matchTipo = PRESTAZIONE_CONFIG[p.tipo]?.label.toLowerCase().includes(search);
        if (!matchProject && !matchTipo) return false;
      }

      // Stato filter
      if (statoFilter !== 'all' && p.stato !== statoFilter) return false;

      // Tipo filter
      if (tipoFilter !== 'all' && p.tipo !== tipoFilter) return false;

      // Project filter
      if (projectFilter !== 'all' && p.projectId !== projectFilter) return false;

      return true;
    });
  }, [prestazioniWithProjects, searchTerm, statoFilter, tipoFilter, projectFilter]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: { projectId: string; prestazione: any }) => {
      const res = await fetch(`/api/projects/${data.projectId}/prestazioni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.prestazione),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nella creazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Prestazione aggiunta", description: "La prestazione è stata creata con successo" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la prestazione", variant: "destructive" });
    },
  });

  const updateStatoMutation = useMutation({
    mutationFn: async ({ id, stato }: { id: string; stato: string }) => {
      const res = await fetch(`/api/prestazioni/${id}/stato`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Stato aggiornato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prestazioni/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Prestazione eliminata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la prestazione", variant: "destructive" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { prestazioneId: string; projectId: string; invoice: any; importoFatturato: number }) => {
      // Create invoice
      const invoiceRes = await fetch(`/api/projects/${data.projectId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.invoice),
        credentials: "include",
      });
      if (!invoiceRes.ok) throw new Error("Errore nella creazione fattura");
      const invoice = await invoiceRes.json();

      // Link prestazione to invoice and update importoFatturato
      const linkRes = await fetch(`/api/prestazioni/${data.prestazioneId}/link-invoice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
        credentials: "include",
      });
      if (!linkRes.ok) throw new Error("Errore nel collegamento");

      // Update prestazione with importoFatturato and stato
      await fetch(`/api/prestazioni/${data.prestazioneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importoFatturato: data.importoFatturato,
          dataFatturazione: new Date().toISOString(),
          stato: 'fatturata'
        }),
        credentials: "include",
      });

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({ title: "Fattura creata", description: "Fattura creata e collegata alla prestazione" });
      setIsInvoiceDialogOpen(false);
      setSelectedPrestazione(null);
      setInvoiceFormData({
        numeroFattura: '',
        importoFatturato: 0,
        dataFattura: new Date().toISOString().split('T')[0],
        note: '',
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la fattura", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: '',
      livelloProgettazione: '',
      descrizione: '',
      importoPrevisto: 0,
      note: '',
    });
    setSelectedProjectForAdd('');
    setIsAddDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!selectedProjectForAdd || !formData.tipo) {
      toast({ title: "Errore", description: "Seleziona commessa e tipo prestazione", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      projectId: selectedProjectForAdd,
      prestazione: {
        tipo: formData.tipo,
        livelloProgettazione: formData.tipo === 'progettazione' ? formData.livelloProgettazione : null,
        descrizione: formData.descrizione || null,
        importoPrevisto: Math.round(formData.importoPrevisto * 100),
        note: formData.note || null,
      },
    });
  };

  const handleCreateInvoice = () => {
    if (!selectedPrestazione || !invoiceFormData.numeroFattura) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    createInvoiceMutation.mutate({
      prestazioneId: selectedPrestazione.id,
      projectId: selectedPrestazione.projectId,
      importoFatturato: Math.round(invoiceFormData.importoFatturato * 100), // in centesimi
      invoice: {
        numeroFattura: invoiceFormData.numeroFattura,
        importoNetto: invoiceFormData.importoFatturato, // in euro, verrà convertito dall'API
        dataEmissione: invoiceFormData.dataFattura,
        stato: 'emessa',
        note: invoiceFormData.note || null,
      },
    });
  };

  const getNextStato = (currentStato: string): string | null => {
    const index = PRESTAZIONE_STATI.indexOf(currentStato as any);
    if (index < PRESTAZIONE_STATI.length - 1) {
      return PRESTAZIONE_STATI[index + 1];
    }
    return null;
  };

  const formatCurrency = (cents: number | null | undefined) => {
    if (!cents) return "€ 0,00";
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yy", { locale: it });
  };

  const isLoading = loadingProjects || loadingPrestazioni;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Alert Card */}
        {(stats.completateNonFatturate > 0 || stats.fatturateNonPagate > 0) && (
          <Card className="border-amber-500/50 md:col-span-2 lg:col-span-4">
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                {stats.completateNonFatturate > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">
                      {stats.completateNonFatturate} completate da fatturare
                    </span>
                    <Badge variant="secondary" className="bg-amber-100">
                      {formatCurrency(stats.importoDaFatturare)}
                    </Badge>
                  </div>
                )}
                {stats.fatturateNonPagate > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800 dark:text-orange-200">
                      {stats.fatturateNonPagate} in attesa di pagamento
                    </span>
                    <Badge variant="secondary" className="bg-orange-100">
                      {formatCurrency(stats.importoDaIncassare)}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Da iniziare</p>
                <p className="text-2xl font-bold">{stats.daIniziare}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In corso</p>
                <p className="text-2xl font-bold">{stats.inCorso}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fatturate</p>
                <p className="text-2xl font-bold">{stats.fatturate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Euro className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagate</p>
                <p className="text-2xl font-bold">{stats.pagate}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>Gestione Prestazioni e Fatturazione</CardTitle>
              <CardDescription>
                Gestisci lo stato di completamento, fatturazione e pagamento delle prestazioni
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuova Prestazione
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per commessa, cliente, tipo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statoFilter} onValueChange={setStatoFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {PRESTAZIONE_STATI.map(stato => (
                  <SelectItem key={stato} value={stato}>
                    {STATO_CONFIG[stato]?.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {PRESTAZIONE_TIPI.map(tipo => (
                  <SelectItem key={tipo} value={tipo}>
                    {PRESTAZIONE_CONFIG[tipo]?.icon} {PRESTAZIONE_CONFIG[tipo]?.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Commessa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le commesse</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Commessa</TableHead>
                  <TableHead className="min-w-[100px]">Prestazione</TableHead>
                  <TableHead className="min-w-[100px]">Stato</TableHead>
                  <TableHead className="min-w-[180px]">Date</TableHead>
                  <TableHead className="text-right min-w-[100px]">Importo</TableHead>
                  <TableHead className="text-right min-w-[150px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrestazioni.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {prestazioni.length === 0
                        ? "Nessuna prestazione registrata. Clicca 'Nuova Prestazione' per iniziare."
                        : "Nessuna prestazione corrisponde ai filtri selezionati."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPrestazioni.map((prestazione) => {
                    const config = PRESTAZIONE_CONFIG[prestazione.tipo] || { label: prestazione.tipo, color: 'bg-gray-100', icon: '📋' };
                    const statoConfig = STATO_CONFIG[prestazione.stato] || STATO_CONFIG['da_iniziare'];
                    const nextStato = getNextStato(prestazione.stato);

                    return (
                      <TableRow key={prestazione.id}>
                        <TableCell>
                          <div className="font-medium">{prestazione.project?.code || '-'}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {prestazione.project?.client}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${config.color} whitespace-nowrap`}>
                            <span className="mr-1">{config.icon}</span>
                            {config.label}
                          </Badge>
                          {prestazione.livelloProgettazione && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {LIVELLO_CONFIG[prestazione.livelloProgettazione]}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${statoConfig.bgColor} ${statoConfig.color}`}>
                            {statoConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {prestazione.dataInizio && (
                              <div className="flex items-center gap-1">
                                <Play className="h-3 w-3" />
                                <span>{formatDate(prestazione.dataInizio)}</span>
                              </div>
                            )}
                            {prestazione.dataCompletamento && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-amber-600" />
                                <span>{formatDate(prestazione.dataCompletamento)}</span>
                              </div>
                            )}
                            {prestazione.dataFatturazione && (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3 text-purple-600" />
                                <span>{formatDate(prestazione.dataFatturazione)}</span>
                              </div>
                            )}
                            {prestazione.dataPagamento && (
                              <div className="flex items-center gap-1">
                                <Euro className="h-3 w-3 text-green-600" />
                                <span>{formatDate(prestazione.dataPagamento)}</span>
                              </div>
                            )}
                            {!prestazione.dataInizio && !prestazione.dataCompletamento &&
                             !prestazione.dataFatturazione && !prestazione.dataPagamento && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm font-medium">
                            {formatCurrency(prestazione.importoPrevisto)}
                          </div>
                          {prestazione.importoFatturato && prestazione.importoFatturato > 0 && (
                            <div className="text-xs text-purple-600">
                              Fatt: {formatCurrency(prestazione.importoFatturato)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {/* Advance Status */}
                            {nextStato && nextStato !== 'fatturata' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatoMutation.mutate({ id: prestazione.id, stato: nextStato })}
                                disabled={updateStatoMutation.isPending}
                                title={`Passa a: ${STATO_CONFIG[nextStato]?.label}`}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Create Invoice (when completata) */}
                            {prestazione.stato === 'completata' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setSelectedPrestazione(prestazione);
                                  setInvoiceFormData({
                                    numeroFattura: '',
                                    importoFatturato: (prestazione.importoPrevisto || 0) / 100,
                                    dataFattura: new Date().toISOString().split('T')[0],
                                    note: '',
                                  });
                                  setIsInvoiceDialogOpen(true);
                                }}
                                title="Crea fattura"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Fattura
                              </Button>
                            )}

                            {/* Mark as Paid (when fatturata) */}
                            {prestazione.stato === 'fatturata' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => updateStatoMutation.mutate({ id: prestazione.id, stato: 'pagata' })}
                                disabled={updateStatoMutation.isPending}
                                title="Segna come pagata"
                              >
                                <Euro className="h-4 w-4 mr-1" />
                                Pagata
                              </Button>
                            )}

                            {/* Delete */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Sei sicuro di voler eliminare questa prestazione?")) {
                                  deleteMutation.mutate(prestazione.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Prestazione Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Prestazione</DialogTitle>
            <DialogDescription>
              Aggiungi una nuova prestazione professionale
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Commessa *</Label>
              <Select value={selectedProjectForAdd} onValueChange={setSelectedProjectForAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona commessa" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code} - {project.client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Tipo Prestazione *</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PRESTAZIONE_TIPI.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {PRESTAZIONE_CONFIG[tipo]?.icon} {PRESTAZIONE_CONFIG[tipo]?.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.tipo === 'progettazione' && (
              <div className="grid gap-2">
                <Label>Livello Progettazione</Label>
                <Select
                  value={formData.livelloProgettazione}
                  onValueChange={(v) => setFormData({ ...formData, livelloProgettazione: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona livello" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIVELLI_PROGETTAZIONE.map(livello => (
                      <SelectItem key={livello} value={livello}>
                        {LIVELLO_CONFIG[livello]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Importo Previsto (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.importoPrevisto}
                onChange={(e) => setFormData({ ...formData, importoPrevisto: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label>Note</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="Note aggiuntive"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Annulla</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea Fattura</DialogTitle>
            <DialogDescription>
              {selectedPrestazione && (
                <span>
                  Crea fattura per: {PRESTAZIONE_CONFIG[selectedPrestazione.tipo]?.label} - {selectedPrestazione.project?.code}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Numero Fattura *</Label>
              <Input
                value={invoiceFormData.numeroFattura}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, numeroFattura: e.target.value })}
                placeholder="Es: FT-2024-001"
              />
            </div>

            <div className="grid gap-2">
              <Label>Importo (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={invoiceFormData.importoFatturato}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, importoFatturato: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Data Fattura</Label>
              <Input
                type="date"
                value={invoiceFormData.dataFattura}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, dataFattura: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Note</Label>
              <Textarea
                value={invoiceFormData.note}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, note: e.target.value })}
                placeholder="Note sulla fattura"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleCreateInvoice} disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? "Creazione..." : "Crea Fattura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
