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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Edit,
  Calendar,
  Download,
  Link as LinkIcon,
  ExternalLink,
  Check,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { ProjectCombobox } from "@/components/ui/project-combobox";

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

// Config per stati fattura
const STATI_FATTURA = [
  { value: 'emessa', label: 'Emessa', icon: <FileText className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { value: 'pagata', label: 'Pagata', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  { value: 'parzialmente_pagata', label: 'Parzialmente Pagata', icon: <Clock className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  { value: 'scaduta', label: 'Scaduta', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' }
];

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
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [selectedPrestazione, setSelectedPrestazione] = useState<PrestazioneWithProject | null>(null);
  const [selectedProjectForAdd, setSelectedProjectForAdd] = useState<string>("");
  const [projectComboOpen, setProjectComboOpen] = useState(false);

  // Advance status dialog state
  const [advanceData, setAdvanceData] = useState({
    prestazioneId: '',
    newStato: '',
    data: new Date().toISOString().split('T')[0],
  });

  // Edit date dialog state
  const [isEditDateDialogOpen, setIsEditDateDialogOpen] = useState(false);
  const [editDateData, setEditDateData] = useState({
    prestazioneId: '',
    dateField: '' as 'dataInizio' | 'dataCompletamento' | 'dataFatturazione' | 'dataPagamento',
    dateValue: '',
    dateLabel: '',
  });

  // Form state for new prestazione (supports multiple types)
  const [formData, setFormData] = useState({
    tipiSelezionati: [] as typeof PRESTAZIONE_TIPI[number][],
    livelloProgettazione: '' as typeof LIVELLI_PROGETTAZIONE[number] | '',
    descrizione: '',
    importoPrevisto: 0,
    note: '',
  });

  // Invoice form state with breakdown
  const [invoiceFormData, setInvoiceFormData] = useState({
    numeroFattura: '',
    imponibile: 0,
    cassaPercentuale: 4,
    ivaPercentuale: 22,
    dataFattura: new Date().toISOString().split('T')[0],
    tipoFattura: 'unica' as 'acconto' | 'sal' | 'saldo' | 'unica',
    note: '',
  });

  // Calculated invoice amounts
  const invoiceCalcolati = useMemo(() => {
    const imponibile = invoiceFormData.imponibile || 0;
    const cassa = imponibile * (invoiceFormData.cassaPercentuale / 100);
    const baseIva = imponibile + cassa;
    const iva = baseIva * (invoiceFormData.ivaPercentuale / 100);
    const totale = baseIva + iva;
    return { imponibile, cassa, baseIva, iva, totale };
  }, [invoiceFormData.imponibile, invoiceFormData.cassaPercentuale, invoiceFormData.ivaPercentuale]);

  // Tab management
  const [activeTab, setActiveTab] = useState<"prestazioni" | "registro">("prestazioni");

  // Stato per gestione fatture globali (Registro Fatture)
  const [isStandaloneInvoiceDialogOpen, setIsStandaloneInvoiceDialogOpen] = useState(false);
  const [editingStandaloneInvoice, setEditingStandaloneInvoice] = useState<ProjectInvoice | null>(null);
  const [selectedProjectForInvoice, setSelectedProjectForInvoice] = useState<string | null>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 25 | 50>(10);

  // Form state for standalone invoice (global management)
  const [standaloneInvoiceForm, setStandaloneInvoiceForm] = useState({
    numeroFattura: "",
    dataEmissione: new Date().toISOString().split('T')[0],
    importoNetto: 0,
    cassaPercentuale: 4,
    aliquotaIVA: 22,
    ritenuta: 0,
    scadenzaPagamento: "",
    note: ""
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

  // Fetch ALL invoices for global management
  const { data: allInvoices = [], isLoading: loadingInvoices } = useQuery<ProjectInvoice[]>({
    queryKey: ["/api/invoices"],
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

  // === INVOICE STATISTICS AND PAGINATION ===

  // Calculate invoice statistics
  const invoiceStats = useMemo(() => {
    const totale = allInvoices.length;
    const emesse = allInvoices.filter(i => i.stato === 'emessa').length;
    const pagate = allInvoices.filter(i => i.stato === 'pagata').length;
    const scadute = allInvoices.filter(i => i.stato === 'scaduta').length;
    const importoTotale = allInvoices.reduce((sum, i) => sum + i.importoTotale, 0);
    const importoPagato = allInvoices.filter(i => i.stato === 'pagata').reduce((sum, i) => sum + i.importoTotale, 0);
    const importoDaPagare = allInvoices.filter(i => i.stato !== 'pagata').reduce((sum, i) => sum + i.importoTotale, 0);

    return {
      totale,
      emesse,
      pagate,
      scadute,
      importoTotale,
      importoPagato,
      importoDaPagare,
    };
  }, [allInvoices]);

  // Group invoices by project
  const groupedInvoices = useMemo(() => {
    return projects.map(project => {
      const projectInvoices = allInvoices.filter(i => i.projectId === project.id);
      const totaleFatturato = projectInvoices.reduce((sum, i) => sum + i.importoTotale, 0);
      const totalePagato = projectInvoices.filter(i => i.stato === 'pagata').reduce((sum, i) => sum + i.importoTotale, 0);

      return {
        project,
        invoices: projectInvoices,
        totaleFatturato,
        totalePagato,
        totaleInSospeso: totaleFatturato - totalePagato
      };
    }).filter(group => group.invoices.length > 0);
  }, [allInvoices, projects]);

  // Pagination logic for "all invoices" view
  const totalPages = Math.ceil(allInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = allInvoices.slice(startIndex, endIndex);

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
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
      // Toast is handled in handleSubmit for batch creation
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la prestazione", variant: "destructive" });
    },
  });

  const updateStatoMutation = useMutation({
    mutationFn: async ({ id, stato, data }: { id: string; stato: string; data?: string }) => {
      const res = await fetch(`/api/prestazioni/${id}/stato`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato, data }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
      toast({ title: "Stato aggiornato" });
      setIsAdvanceDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    },
  });

  const updateDateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const res = await fetch(`/api/prestazioni/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
      toast({ title: "Data aggiornata" });
      setIsEditDateDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare la data", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
      toast({ title: "Prestazione eliminata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la prestazione", variant: "destructive" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: {
      prestazioneId: string;
      projectId: string;
      invoice: any;
      tipoFattura: 'acconto' | 'sal' | 'saldo' | 'unica';
    }) => {
      // Create invoice with prestazioneId - server will auto-recalculate prestazione amounts
      const invoiceRes = await fetch(`/api/projects/${data.projectId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data.invoice,
          prestazioneId: data.prestazioneId,
          tipoFattura: data.tipoFattura,
        }),
        credentials: "include",
      });
      if (!invoiceRes.ok) throw new Error("Errore nella creazione fattura");
      return await invoiceRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
      toast({ title: "Fattura creata", description: "Fattura creata e collegata alla prestazione" });
      setIsInvoiceDialogOpen(false);
      setSelectedPrestazione(null);
      setInvoiceFormData({
        numeroFattura: '',
        imponibile: 0,
        cassaPercentuale: 4,
        ivaPercentuale: 22,
        dataFattura: new Date().toISOString().split('T')[0],
        tipoFattura: 'unica',
        note: '',
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la fattura", variant: "destructive" });
    },
  });

  // === MUTATIONS FOR GLOBAL INVOICE MANAGEMENT ===

  // Save standalone invoice (create or update)
  const saveStandaloneInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const projectId = data.projectId;
      const url = editingStandaloneInvoice
        ? `/api/projects/${projectId}/invoices/${editingStandaloneInvoice.id}`
        : `/api/projects/${projectId}/invoices`;
      const method = editingStandaloneInvoice ? "PATCH" : "POST";

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
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({
        title: editingStandaloneInvoice ? "Fattura aggiornata" : "Fattura creata",
        description: "La fattura è stata salvata con successo"
      });
      resetStandaloneInvoiceForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete invoice
  const deleteInvoiceMutation = useMutation({
    mutationFn: async ({ id, projectId }: { id: string, projectId: string }) => {
      const res = await fetch(`/api/projects/${projectId}/invoices/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({
        title: "Fattura eliminata",
        description: "La fattura è stata rimossa con successo"
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la fattura", variant: "destructive" });
    }
  });

  // Update invoice status
  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, projectId, stato, dataPagamento }: { id: string, projectId: string, stato: string, dataPagamento?: string }) => {
      const res = await fetch(`/api/projects/${projectId}/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato, dataPagamento }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({
        title: "Stato aggiornato",
        description: "Lo stato della fattura è stato aggiornato"
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      tipiSelezionati: [],
      livelloProgettazione: '',
      descrizione: '',
      importoPrevisto: 0,
      note: '',
    });
    setSelectedProjectForAdd('');
    setIsAddDialogOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedProjectForAdd || formData.tipiSelezionati.length === 0) {
      toast({ title: "Errore", description: "Seleziona commessa e almeno un tipo di prestazione", variant: "destructive" });
      return;
    }

    // Create prestazioni for each selected type
    const promises = formData.tipiSelezionati.map(tipo =>
      createMutation.mutateAsync({
        projectId: selectedProjectForAdd,
        prestazione: {
          tipo,
          livelloProgettazione: tipo === 'progettazione' ? formData.livelloProgettazione : null,
          descrizione: formData.descrizione || null,
          importoPrevisto: Math.round(formData.importoPrevisto * 100),
          note: formData.note || null,
        },
      })
    );

    try {
      await Promise.all(promises);
      const count = formData.tipiSelezionati.length;
      toast({
        title: count > 1 ? `${count} prestazioni aggiunte` : "Prestazione aggiunta",
        description: count > 1
          ? `Sono state create ${count} prestazioni con successo`
          : "La prestazione è stata creata con successo"
      });
      resetForm();
    } catch (error) {
      toast({ title: "Errore", description: "Si è verificato un errore nella creazione", variant: "destructive" });
    }
  };

  const handleCreateInvoice = () => {
    if (!selectedPrestazione || !invoiceFormData.numeroFattura || invoiceFormData.imponibile <= 0) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    createInvoiceMutation.mutate({
      prestazioneId: selectedPrestazione.id,
      projectId: selectedPrestazione.projectId,
      tipoFattura: invoiceFormData.tipoFattura,
      invoice: {
        numeroFattura: invoiceFormData.numeroFattura,
        importoNetto: invoiceFormData.imponibile, // imponibile in euro
        dataEmissione: invoiceFormData.dataFattura,
        aliquotaIVA: invoiceFormData.ivaPercentuale,
        stato: 'emessa',
        note: invoiceFormData.note
          ? `${invoiceFormData.note}\n---\nCassa ${invoiceFormData.cassaPercentuale}%: €${invoiceCalcolati.cassa.toFixed(2)}, IVA ${invoiceFormData.ivaPercentuale}%: €${invoiceCalcolati.iva.toFixed(2)}`
          : `Cassa ${invoiceFormData.cassaPercentuale}%: €${invoiceCalcolati.cassa.toFixed(2)}, IVA ${invoiceFormData.ivaPercentuale}%: €${invoiceCalcolati.iva.toFixed(2)}`,
      },
    });
  };

  const handleAdvanceStatus = () => {
    if (!advanceData.prestazioneId || !advanceData.newStato) return;
    updateStatoMutation.mutate({
      id: advanceData.prestazioneId,
      stato: advanceData.newStato,
      data: advanceData.data,
    });
  };

  const handleEditDate = () => {
    if (!editDateData.prestazioneId || !editDateData.dateField || !editDateData.dateValue) return;
    updateDateMutation.mutate({
      id: editDateData.prestazioneId,
      field: editDateData.dateField,
      value: editDateData.dateValue,
    });
  };

  const openEditDateDialog = (
    prestazioneId: string,
    field: 'dataInizio' | 'dataCompletamento' | 'dataFatturazione' | 'dataPagamento',
    currentValue: string | Date | null,
    label: string
  ) => {
    const dateStr = currentValue
      ? new Date(currentValue).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    setEditDateData({
      prestazioneId,
      dateField: field,
      dateValue: dateStr,
      dateLabel: label,
    });
    setIsEditDateDialogOpen(true);
  };

  const getNextStato = (currentStato: string): string | null => {
    const index = PRESTAZIONE_STATI.indexOf(currentStato as any);
    if (index < PRESTAZIONE_STATI.length - 1) {
      return PRESTAZIONE_STATI[index + 1];
    }
    return null;
  };

  // === HANDLERS FOR GLOBAL INVOICE MANAGEMENT ===

  const resetStandaloneInvoiceForm = () => {
    setStandaloneInvoiceForm({
      numeroFattura: "",
      dataEmissione: new Date().toISOString().split('T')[0],
      importoNetto: 0,
      cassaPercentuale: 4,
      aliquotaIVA: 22,
      ritenuta: 0,
      scadenzaPagamento: "",
      note: ""
    });
    setSelectedProjectForInvoice("");
    setEditingStandaloneInvoice(null);
    setIsStandaloneInvoiceDialogOpen(false);
  };

  const calculateStandaloneInvoice = () => {
    const netto = Math.round(standaloneInvoiceForm.importoNetto * 100); // Converti in centesimi
    const cassa = Math.round((netto * standaloneInvoiceForm.cassaPercentuale) / 100);
    const baseIva = netto + cassa;
    const iva = Math.round((baseIva * standaloneInvoiceForm.aliquotaIVA) / 100);
    const totale = baseIva + iva;
    const ritenuta = Math.round(standaloneInvoiceForm.ritenuta * 100);

    return {
      importoNetto: netto,
      cassaPrevidenziale: cassa,
      importoIVA: iva,
      importoTotale: totale,
      ritenuta,
      nettoPagare: totale - ritenuta
    };
  };

  const handleStandaloneInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProjectForInvoice) {
      toast({
        title: "Errore",
        description: "Seleziona una commessa",
        variant: "destructive"
      });
      return;
    }

    const calculated = calculateStandaloneInvoice();

    saveStandaloneInvoiceMutation.mutate({
      projectId: selectedProjectForInvoice,
      numeroFattura: standaloneInvoiceForm.numeroFattura,
      dataEmissione: standaloneInvoiceForm.dataEmissione,
      scadenzaPagamento: standaloneInvoiceForm.scadenzaPagamento || null,
      aliquotaIVA: standaloneInvoiceForm.aliquotaIVA,
      note: standaloneInvoiceForm.note,
      ...calculated,
      stato: 'emessa'
    });
  };

  const handleEditStandaloneInvoice = (invoice: ProjectInvoice) => {
    setEditingStandaloneInvoice(invoice);
    setSelectedProjectForInvoice(invoice.projectId);
    setStandaloneInvoiceForm({
      numeroFattura: invoice.numeroFattura,
      dataEmissione: invoice.dataEmissione.split('T')[0],
      importoNetto: invoice.importoNetto / 100,
      cassaPercentuale: invoice.cassaPrevidenziale ? (invoice.cassaPrevidenziale / invoice.importoNetto) * 100 : 4,
      aliquotaIVA: invoice.aliquotaIVA,
      ritenuta: invoice.ritenuta / 100,
      scadenzaPagamento: invoice.scadenzaPagamento?.split('T')[0] || "",
      note: invoice.note || ""
    });
    setIsStandaloneInvoiceDialogOpen(true);
  };

  const handleMarkAsPaid = (invoice: ProjectInvoice) => {
    updateInvoiceStatusMutation.mutate({
      id: invoice.id,
      projectId: invoice.projectId,
      stato: 'pagata',
      dataPagamento: new Date().toISOString()
    });
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
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "prestazioni" | "registro")} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 max-w-md">
        <TabsTrigger value="prestazioni">
          <FileText className="w-4 h-4 mr-2" />
          Prestazioni
        </TabsTrigger>
        <TabsTrigger value="registro">
          <Euro className="w-4 h-4 mr-2" />
          Registro Fatture
        </TabsTrigger>
      </TabsList>

      {/* TAB 1: PRESTAZIONI */}
      <TabsContent value="prestazioni" className="space-y-6">
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
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
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
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
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
                  <TableHead className="min-w-[180px]">Commessa</TableHead>
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
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {prestazione.project?.client}
                          </div>
                          {prestazione.project?.object && (
                            <div className="text-xs text-muted-foreground/70 truncate max-w-[180px] italic">
                              {prestazione.project.object}
                            </div>
                          )}
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
                              <button
                                className="flex items-center gap-1 hover:bg-muted px-1 py-0.5 rounded cursor-pointer transition-colors"
                                onClick={() => openEditDateDialog(
                                  prestazione.id,
                                  'dataInizio',
                                  prestazione.dataInizio,
                                  'Data Inizio'
                                )}
                                title="Clicca per modificare"
                              >
                                <Play className="h-3 w-3" />
                                <span>{formatDate(prestazione.dataInizio)}</span>
                              </button>
                            )}
                            {prestazione.dataCompletamento && (
                              <button
                                className="flex items-center gap-1 hover:bg-muted px-1 py-0.5 rounded cursor-pointer transition-colors"
                                onClick={() => openEditDateDialog(
                                  prestazione.id,
                                  'dataCompletamento',
                                  prestazione.dataCompletamento,
                                  'Data Completamento'
                                )}
                                title="Clicca per modificare"
                              >
                                <CheckCircle className="h-3 w-3 text-amber-600" />
                                <span>{formatDate(prestazione.dataCompletamento)}</span>
                              </button>
                            )}
                            {prestazione.dataFatturazione && (
                              <button
                                className="flex items-center gap-1 hover:bg-muted px-1 py-0.5 rounded cursor-pointer transition-colors"
                                onClick={() => openEditDateDialog(
                                  prestazione.id,
                                  'dataFatturazione',
                                  prestazione.dataFatturazione,
                                  'Data Fatturazione'
                                )}
                                title="Clicca per modificare"
                              >
                                <FileText className="h-3 w-3 text-purple-600" />
                                <span>{formatDate(prestazione.dataFatturazione)}</span>
                              </button>
                            )}
                            {prestazione.dataPagamento && (
                              <button
                                className="flex items-center gap-1 hover:bg-muted px-1 py-0.5 rounded cursor-pointer transition-colors"
                                onClick={() => openEditDateDialog(
                                  prestazione.id,
                                  'dataPagamento',
                                  prestazione.dataPagamento,
                                  'Data Pagamento'
                                )}
                                title="Clicca per modificare"
                              >
                                <Euro className="h-3 w-3 text-green-600" />
                                <span>{formatDate(prestazione.dataPagamento)}</span>
                              </button>
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
                                onClick={() => {
                                  setAdvanceData({
                                    prestazioneId: prestazione.id,
                                    newStato: nextStato,
                                    data: new Date().toISOString().split('T')[0],
                                  });
                                  setIsAdvanceDialogOpen(true);
                                }}
                                disabled={updateStatoMutation.isPending}
                                title={`Passa a: ${STATO_CONFIG[nextStato]?.label}`}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Create Invoice (when completata or fatturata - for multiple invoices) */}
                            {(prestazione.stato === 'completata' || prestazione.stato === 'fatturata') && (
                              <Button
                                size="sm"
                                variant={prestazione.stato === 'completata' ? "default" : "outline"}
                                onClick={() => {
                                  const residuo = ((prestazione.importoPrevisto || 0) - (prestazione.importoFatturato || 0)) / 100;
                                  const hasExistingInvoices = (prestazione.importoFatturato || 0) > 0;
                                  setSelectedPrestazione(prestazione);
                                  setInvoiceFormData({
                                    numeroFattura: '',
                                    imponibile: Math.max(0, residuo),
                                    cassaPercentuale: 4,
                                    ivaPercentuale: 22,
                                    dataFattura: new Date().toISOString().split('T')[0],
                                    tipoFattura: hasExistingInvoices ? 'saldo' : 'unica',
                                    note: '',
                                  });
                                  setIsInvoiceDialogOpen(true);
                                }}
                                title={prestazione.stato === 'fatturata' ? "Aggiungi altra fattura (SAL/Saldo)" : "Crea fattura"}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                {prestazione.stato === 'fatturata' ? '+Fattura' : 'Fattura'}
                              </Button>
                            )}

                            {/* Mark as Paid (when fatturata) */}
                            {prestazione.stato === 'fatturata' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setAdvanceData({
                                    prestazioneId: prestazione.id,
                                    newStato: 'pagata',
                                    data: new Date().toISOString().split('T')[0],
                                  });
                                  setIsAdvanceDialogOpen(true);
                                }}
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
              <Popover open={projectComboOpen} onOpenChange={setProjectComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectComboOpen}
                    className="w-full justify-between"
                  >
                    {selectedProjectForAdd
                      ? (() => {
                          const p = projects.find(p => p.id === selectedProjectForAdd);
                          return p ? `${p.code} - ${p.object || p.client}` : "Cerca commessa...";
                        })()
                      : "Cerca commessa..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cerca per codice o oggetto..." />
                    <CommandList>
                      <CommandEmpty>Nessuna commessa trovata.</CommandEmpty>
                      <CommandGroup>
                        {projects.map(project => (
                          <CommandItem
                            key={project.id}
                            value={`${project.code} ${project.client} ${project.object || ''}`}
                            onSelect={() => {
                              setSelectedProjectForAdd(project.id);
                              setProjectComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProjectForAdd === project.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-medium">{project.code}</span>
                              {project.object && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {project.object}
                                </span>
                              )}
                              {project.client && (
                                <span className="text-xs text-muted-foreground/70 truncate">
                                  Cliente: {project.client}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Tipi Prestazione * <span className="text-xs text-muted-foreground font-normal">(seleziona una o più)</span></Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                {PRESTAZIONE_TIPI.map(tipo => (
                  <div key={tipo} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tipo-${tipo}`}
                      checked={formData.tipiSelezionati.includes(tipo)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            tipiSelezionati: [...formData.tipiSelezionati, tipo]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            tipiSelezionati: formData.tipiSelezionati.filter(t => t !== tipo)
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor={`tipo-${tipo}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1"
                    >
                      <span>{PRESTAZIONE_CONFIG[tipo]?.icon}</span>
                      <span>{PRESTAZIONE_CONFIG[tipo]?.label}</span>
                    </label>
                  </div>
                ))}
              </div>
              {formData.tipiSelezionati.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.tipiSelezionati.length} tipo/i selezionato/i
                </p>
              )}
            </div>

            {formData.tipiSelezionati.includes('progettazione') && (
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crea Fattura</DialogTitle>
            <DialogDescription>
              {selectedPrestazione && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span>{PRESTAZIONE_CONFIG[selectedPrestazione.tipo]?.label} - {selectedPrestazione.project?.code}</span>
                  <span className="text-amber-600 font-medium">
                    Residuo: {formatCurrency((selectedPrestazione.importoPrevisto || 0) - (selectedPrestazione.importoFatturato || 0))}
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1 col-span-1">
                <Label className="text-xs">N. Fattura *</Label>
                <Input
                  value={invoiceFormData.numeroFattura}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, numeroFattura: e.target.value })}
                  placeholder="FT-001"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1 col-span-1">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={invoiceFormData.dataFattura}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, dataFattura: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1 col-span-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={invoiceFormData.tipoFattura}
                  onValueChange={(value) => setInvoiceFormData({ ...invoiceFormData, tipoFattura: value as 'acconto' | 'sal' | 'saldo' | 'unica' })}
                >
                  <SelectTrigger className="h-8 text-sm">
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
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Imponibile (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoiceFormData.imponibile}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, imponibile: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Cassa %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={invoiceFormData.cassaPercentuale}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, cassaPercentuale: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">IVA %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={invoiceFormData.ivaPercentuale}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, ivaPercentuale: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Calculated breakdown - compact */}
            <div className="rounded-lg bg-muted p-2 text-xs grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between">
                <span>Imponibile:</span>
                <span>€ {invoiceCalcolati.imponibile.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cassa {invoiceFormData.cassaPercentuale}%:</span>
                <span>€ {invoiceCalcolati.cassa.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA {invoiceFormData.ivaPercentuale}%:</span>
                <span>€ {invoiceCalcolati.iva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Totale:</span>
                <span>€ {invoiceCalcolati.totale.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Note (opzionale)</Label>
              <Textarea
                value={invoiceFormData.note}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, note: e.target.value })}
                placeholder="Note"
                rows={1}
                className="text-sm min-h-[32px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsInvoiceDialogOpen(false)}>Annulla</Button>
            <Button size="sm" onClick={handleCreateInvoice} disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? "..." : "Crea Fattura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Status Dialog */}
      <Dialog open={isAdvanceDialogOpen} onOpenChange={setIsAdvanceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aggiorna Stato</DialogTitle>
            <DialogDescription>
              Conferma il passaggio allo stato successivo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-center gap-3">
              {advanceData.newStato && (
                <Badge variant="secondary" className={`${STATO_CONFIG[advanceData.newStato]?.bgColor} ${STATO_CONFIG[advanceData.newStato]?.color} text-base px-4 py-1`}>
                  {STATO_CONFIG[advanceData.newStato]?.label}
                </Badge>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={advanceData.data}
                onChange={(e) => setAdvanceData({ ...advanceData, data: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                La data in cui è avvenuto il passaggio di stato
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdvanceDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleAdvanceStatus} disabled={updateStatoMutation.isPending}>
              {updateStatoMutation.isPending ? "Aggiornamento..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Date Dialog */}
      <Dialog open={isEditDateDialogOpen} onOpenChange={setIsEditDateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifica Data</DialogTitle>
            <DialogDescription>
              {editDateData.dateLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={editDateData.dateValue}
                onChange={(e) => setEditDateData({ ...editDateData, dateValue: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDateDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleEditDate} disabled={updateDateMutation.isPending}>
              {updateDateMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>
      {/* Fine tab Prestazioni */}

      {/* TAB 2: REGISTRO FATTURE */}
      <TabsContent value="registro" className="space-y-6">
        {/* TODO: Aggiungere contenuto Registro Fatture */}
        <div className="text-center py-12">
          <p className="text-muted-foreground">Contenuto Registro Fatture in arrivo...</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
