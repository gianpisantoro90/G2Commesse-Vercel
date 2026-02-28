import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Link as LinkIcon
} from "lucide-react";
import { type Project, type ProjectPrestazione, type ProjectInvoice, PRESTAZIONE_TIPI, PRESTAZIONE_STATI, LIVELLI_PROGETTAZIONE } from "@shared/schema";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Configurazione display per tipi prestazione
const PRESTAZIONE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  'progettazione': { label: 'Progettazione', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: '📐' },
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
  'in_corso': { label: 'In corso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', icon: <Play className="w-3 h-3" /> },
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
    queryKey: [`/api/projects/${project.id}/prestazioni`],
  });

  // Fetch fatture del progetto (per collegamento)
  const { data: invoices = [] } = useQuery<ProjectInvoice[]>({
    queryKey: [`/api/projects/${project.id}/invoices`],
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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/prestazioni`] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/prestazioni`] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/prestazioni`] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni/stats"] });
      toast({ title: "Prestazione eliminata", description: "La prestazione è stata rimossa" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la prestazione", variant: "destructive" });
    }
  });

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
      importoPrevisto: Math.round(formData.importoPrevisto * 100), // Converti in centesimi
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

  const formatCurrency = (cents: number | null | undefined) => {
    if (!cents) return "€ 0,00";
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
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

              return (
                <div
                  key={prestazione.id}
                  className="flex items-center justify-between p-3 rounded-lg border dark:border-border bg-card hover:bg-muted transition-colors"
                >
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
                  </div>

                  <div className="flex items-center gap-2">
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

                    {/* Note: Link to Invoice button removed - invoices are now created with prestazioneId directly */}

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
              );
            })}
          </div>
        )}

        {/* Link Invoice Dialog removed - invoices are now created with prestazioneId directly from billing page */}
      </div>
    </div>
  );
}
