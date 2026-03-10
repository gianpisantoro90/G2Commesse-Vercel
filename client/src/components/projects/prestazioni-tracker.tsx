import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Play,
  CheckCircle,
  FileText,
  Euro,
  Trash2,
  Edit,
  Clock,
  AlertCircle,
  ArrowRight,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Copy
} from "lucide-react";
import { type Project, type ProjectPrestazione, type ProjectInvoice, PRESTAZIONE_TIPI, PRESTAZIONE_STATI, LIVELLI_PROGETTAZIONE } from "@shared/schema";
import { QK } from "@/lib/query-utils";
import { apiRequest } from "@/lib/queryClient";
import { CATEGORIE_DM2016 } from "@/lib/parcella-calculator";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Configurazione display per tipi prestazione
const PRESTAZIONE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  'progettazione': { label: 'Progettazione', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', icon: '📐' },
  'dl': { label: 'Direzione Lavori', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: '👷' },
  'csp': { label: 'CSP', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: '🦺' },
  'cse': { label: 'CSE', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: '🔒' },
  'contabilita': { label: 'Contabilità', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: '📊' },
  'collaudo': { label: 'Collaudo', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: '✅' },
  'perizia': { label: 'Perizia', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', icon: '📋' },
  'pratiche': { label: 'Pratiche', color: 'bg-muted text-foreground dark:bg-background dark:text-foreground', icon: '📁' },
};

// Configurazione display per stati
const STATO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'da_iniziare': { label: 'Da iniziare', color: 'bg-muted text-muted-foreground dark:bg-background dark:text-foreground', icon: <Clock className="w-3 h-3" /> },
  'in_corso': { label: 'In corso', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300', icon: <Play className="w-3 h-3" /> },
  'completata': { label: 'Completata', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: <CheckCircle className="w-3 h-3" /> },
  'fatturata': { label: 'Fatturata', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', icon: <FileText className="w-3 h-3" /> },
  'pagata': { label: 'Pagata', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', icon: <Euro className="w-3 h-3" /> },
};

// Livelli progettazione config
const LIVELLO_CONFIG: Record<string, string> = {
  'pfte': 'PFTE',
  'definitivo': 'Definitivo',
  'esecutivo': 'Esecutivo',
  'variante': 'Variante',
};

interface PrestazioniTrackerProps {
  project: Project;
}

export default function PrestazioniTracker({ project }: PrestazioniTrackerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPrestazione, setEditingPrestazione] = useState<ProjectPrestazione | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // Note: Link invoice dialog removed - invoices are now created with prestazioneId directly
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    tipo: '' as typeof PRESTAZIONE_TIPI[number] | '',
    livelloProgettazione: '' as typeof LIVELLI_PROGETTAZIONE[number] | '',
    descrizione: '',
    importoPrevisto: 0,
    note: '',
  });

  // Fetch prestazioni del progetto
  const { data: prestazioni = [], isLoading } = useQuery<ProjectPrestazione[]>({
    queryKey: QK.projectPrestazioni(project.id),
  });

  // Fetch fatture del progetto (per collegamento)
  const { data: invoices = [] } = useQuery<ProjectInvoice[]>({
    queryKey: QK.projectInvoices(project.id),
  });

  // Fetch classificazioni for all project prestazioni
  const { data: allClassificazioni = [], refetch: refetchClassificazioni } = useQuery<any[]>({
    queryKey: QK.projectClassificazioni(project.id),
    queryFn: () => apiRequest("GET", `/api/projects/${project.id}/classificazioni`).then(r => r.json()),
  });

  // Create prestazione
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/projects/${project.id}/prestazioni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nella creazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.projectPrestazioni(project.id) });
      queryClient.invalidateQueries({ queryKey: QK.prestazioniStats });
      toast({ title: "Prestazione aggiunta", description: "La prestazione è stata creata con successo" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la prestazione", variant: "destructive" });
    }
  });

  // Update stato
  const updateStatoMutation = useMutation({
    mutationFn: async ({ id, stato }: { id: string; stato: string }) => {
      const res = await fetch(`/api/prestazioni/${id}/stato`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.projectPrestazioni(project.id) });
      queryClient.invalidateQueries({ queryKey: QK.prestazioniStats });
      toast({ title: "Stato aggiornato", description: "Lo stato della prestazione è stato aggiornato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    }
  });

  // Note: Link to invoice functionality has been removed.
  // Invoices are now created with prestazioneId directly from the billing page.
  // Multiple invoices per prestazione are supported (acconto, sal, saldo, unica).

  // Delete prestazione
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prestazioni/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.projectPrestazioni(project.id) });
      queryClient.invalidateQueries({ queryKey: QK.prestazioniStats });
      toast({ title: "Prestazione eliminata", description: "La prestazione è stata rimossa" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la prestazione", variant: "destructive" });
    }
  });

  // Classificazioni mutations
  const invalidateAfterClassificazione = () => {
    refetchClassificazioni();
    queryClient.invalidateQueries({ queryKey: QK.projectPrestazioni(project.id) });
    queryClient.invalidateQueries({ queryKey: QK.projects });
  };

  const createClassMutation = useMutation({
    mutationFn: async ({ prestazioneId, data }: { prestazioneId: string; data: any }) => {
      const response = await apiRequest("POST", `/api/prestazioni/${prestazioneId}/classificazioni`, data);
      return response.json();
    },
    onSuccess: invalidateAfterClassificazione,
  });

  const deleteClassMutation = useMutation({
    mutationFn: async ({ prestazioneId, classId }: { prestazioneId: string; classId: string }) => {
      await apiRequest("DELETE", `/api/prestazioni/${prestazioneId}/classificazioni/${classId}`);
    },
    onSuccess: invalidateAfterClassificazione,
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ prestazioneId, classId, data }: { prestazioneId: string; classId: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/prestazioni/${prestazioneId}/classificazioni/${classId}`, data);
      return response.json();
    },
    onSuccess: invalidateAfterClassificazione,
  });

  const copyClassMutation = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      const response = await apiRequest("POST", `/api/prestazioni/${fromId}/classificazioni/copy-to/${toId}`);
      return response.json();
    },
    onSuccess: (data: { copied: number; skipped: number }) => {
      invalidateAfterClassificazione();
      toast({
        title: "Classificazioni copiate",
        description: `${data.copied} copiate${data.skipped > 0 ? `, ${data.skipped} già presenti` : ''}`,
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile copiare le classificazioni", variant: "destructive" });
    },
  });

  const getClassificazioniForPrestazione = (prestazioneId: string) => {
    return allClassificazioni.filter((c: any) => c.prestazioneId === prestazioneId);
  };

  const resetForm = () => {
    setFormData({
      tipo: '',
      livelloProgettazione: '',
      descrizione: '',
      importoPrevisto: 0,
      note: '',
    });
    setIsAddDialogOpen(false);
    setEditingPrestazione(null);
  };

  const handleSubmit = () => {
    if (!formData.tipo) {
      toast({ title: "Errore", description: "Seleziona un tipo di prestazione", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      tipo: formData.tipo,
      livelloProgettazione: formData.tipo === 'progettazione' ? formData.livelloProgettazione : null,
      descrizione: formData.descrizione || null,
      importoPrevisto: formData.importoPrevisto, // In euro
      note: formData.note || null,
    });
  };

  const getNextStato = (currentStato: string): string | null => {
    const index = PRESTAZIONE_STATI.indexOf(currentStato as any);
    if (index < PRESTAZIONE_STATI.length - 1) {
      return PRESTAZIONE_STATI[index + 1];
    }
    return null;
  };

  const formatCurrency = (euros: number | null | undefined) => {
    if (!euros) return "€ 0,00";
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(euros);
  };

  if (isLoading) {
    return <div className="p-4 text-center">Caricamento prestazioni...</div>;
  }

  return (
    <div className="card-g2">
      <div className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Prestazioni Professionali</h3>
          <p className="text-sm text-muted-foreground">Gestisci lo stato di fatturazione e pagamento per ogni prestazione</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Aggiungi
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi Prestazione</DialogTitle>
              <DialogDescription>
                Aggiungi una nuova prestazione professionale al progetto
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Tipo Prestazione *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v as any })}
                >
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
                <Label>Descrizione</Label>
                <Input
                  value={formData.descrizione}
                  onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                  placeholder="Descrizione opzionale"
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
      </div>

      <div>
        {prestazioni.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nessuna prestazione registrata</p>
            <p className="text-sm">Clicca "Aggiungi" per inserire la prima prestazione</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prestazioni.map((prestazione) => {
              const config = PRESTAZIONE_CONFIG[prestazione.tipo] || { label: prestazione.tipo, color: 'bg-muted', icon: '📋' };
              const statoConfig = STATO_CONFIG[prestazione.stato] || STATO_CONFIG['da_iniziare'];
              const nextStato = getNextStato(prestazione.stato);
              // Find invoices linked to this prestazione (new 1:N relationship)
              const linkedInvoices = invoices.filter(i => i.prestazioneId === prestazione.id);
              const classificazioni = getClassificazioniForPrestazione(prestazione.id);
              const isExpanded = expandedCards.has(prestazione.id);

              return (
                <div key={prestazione.id} className="rounded-lg border dark:border-border bg-card">
                  {/* Existing row */}
                  <div className="flex items-center justify-between p-3 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Tipo Badge */}
                      <Badge variant="outline" className={config.color}>
                        <span className="mr-1">{config.icon}</span>
                        {config.label}
                        {prestazione.livelloProgettazione && (
                          <span className="ml-1 text-xs opacity-70">
                            ({LIVELLO_CONFIG[prestazione.livelloProgettazione]})
                          </span>
                        )}
                      </Badge>

                      {/* Stato Badge */}
                      <Badge variant="secondary" className={`${statoConfig.color} flex items-center gap-1`}>
                        {statoConfig.icon}
                        {statoConfig.label}
                      </Badge>

                      {/* Importo */}
                      {prestazione.importoPrevisto && prestazione.importoPrevisto > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(prestazione.importoPrevisto)}
                        </span>
                      )}

                      {/* Linked Invoices (multiple invoices per prestazione) */}
                      {linkedInvoices.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          {linkedInvoices.length === 1
                            ? linkedInvoices[0].numeroFattura
                            : `${linkedInvoices.length} fatture`}
                        </Badge>
                      )}

                      {/* Classificazioni count badge */}
                      {classificazioni.length > 0 && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {classificazioni.length} DM
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Expand button for classificazioni */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setExpandedCards(prev => {
                            const next = new Set(prev);
                            if (next.has(prestazione.id)) next.delete(prestazione.id);
                            else next.add(prestazione.id);
                            return next;
                          });
                        }}
                        title="Classificazioni DM"
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>

                      {/* Advance Status Button */}
                      {nextStato && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatoMutation.mutate({ id: prestazione.id, stato: nextStato })}
                          disabled={updateStatoMutation.isPending}
                          title={`Passa a: ${STATO_CONFIG[nextStato]?.label}`}
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          {STATO_CONFIG[nextStato]?.label}
                        </Button>
                      )}

                      {/* Delete Button */}
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
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded classificazioni section */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-border">
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-muted-foreground">Classificazioni DM 17/06/2016</span>
                          <div className="flex items-center gap-1">
                            {/* Copia da altra prestazione */}
                            {(() => {
                              const otherWithClass = prestazioni.filter(p =>
                                p.id !== prestazione.id && getClassificazioniForPrestazione(p.id).length > 0
                              );
                              if (otherWithClass.length === 0) return null;
                              return (
                                <Select
                                  value=""
                                  onValueChange={(fromId) => {
                                    copyClassMutation.mutate({ fromId, toId: prestazione.id });
                                  }}
                                >
                                  <SelectTrigger className="h-6 text-xs px-2 w-auto gap-1">
                                    <Copy className="w-3 h-3" />
                                    <span>Copia da...</span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {otherWithClass.map(p => {
                                      const pConfig = PRESTAZIONE_CONFIG[p.tipo] || { label: p.tipo, icon: '📋' };
                                      const pClass = getClassificazioniForPrestazione(p.id);
                                      return (
                                        <SelectItem key={p.id} value={p.id} className="text-xs">
                                          {pConfig.icon} {pConfig.label}
                                          {p.livelloProgettazione && ` (${LIVELLO_CONFIG[p.livelloProgettazione]})`}
                                          {' '}&mdash; {pClass.length} class.
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => {
                                createClassMutation.mutate({
                                  prestazioneId: prestazione.id,
                                  data: { codiceDM: 'E.01', importoOpere: 0, importoServizio: 0 },
                                });
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Aggiungi
                            </Button>
                          </div>
                        </div>

                        {classificazioni.length > 0 ? (
                          <div className="space-y-1">
                            {classificazioni.map((c: any) => {
                              return (
                                <div key={c.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center text-xs">
                                  <Select
                                    value={c.codiceDM}
                                    onValueChange={(value) => {
                                      updateClassMutation.mutate({
                                        prestazioneId: prestazione.id,
                                        classId: c.id,
                                        data: { codiceDM: value },
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="font-mono text-xs h-7">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                      <SelectGroup>
                                        <SelectLabel>Edilizia</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => data.categoria === 'Edilizia')
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 30)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                      <SelectGroup>
                                        <SelectLabel>Strutture</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => data.categoria === 'Strutture')
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 30)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                      <SelectGroup>
                                        <SelectLabel>Impianti</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => data.categoria === 'Impianti')
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 30)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                      <SelectGroup>
                                        <SelectLabel>Altro</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => !['Edilizia', 'Strutture', 'Impianti'].includes(data.categoria))
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 30)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    placeholder="Opere"
                                    className="h-7 text-xs"
                                    defaultValue={c.importoOpere || ''}
                                    onBlur={(e) => {
                                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                      if (val !== c.importoOpere) {
                                        updateClassMutation.mutate({
                                          prestazioneId: prestazione.id,
                                          classId: c.id,
                                          data: { importoOpere: val },
                                        });
                                      }
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="Servizio"
                                    className="h-7 text-xs"
                                    defaultValue={c.importoServizio || ''}
                                    onBlur={(e) => {
                                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                      if (val !== c.importoServizio) {
                                        updateClassMutation.mutate({
                                          prestazioneId: prestazione.id,
                                          classId: c.id,
                                          data: { importoServizio: val },
                                        });
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                    onClick={() => {
                                      deleteClassMutation.mutate({
                                        prestazioneId: prestazione.id,
                                        classId: c.id,
                                      });
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}
                            <div className="flex justify-end gap-4 text-xs text-muted-foreground pt-1 border-t">
                              <span>Opere: {formatCurrency(classificazioni.reduce((s: number, c: any) => s + (c.importoOpere || 0), 0))}</span>
                              <span className="font-medium text-primary">Servizio: {formatCurrency(classificazioni.reduce((s: number, c: any) => s + (c.importoServizio || 0), 0))}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-2">Nessuna classificazione DM</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Link Invoice Dialog removed - invoices are now created with prestazioneId directly from billing page */}
      </div>
    </div>
  );
}
