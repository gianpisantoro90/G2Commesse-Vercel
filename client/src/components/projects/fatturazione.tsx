import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Edit, Trash2, Euro, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { type Project } from "@shared/schema";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ProjectInvoice {
  id: string;
  projectId: string;
  numeroFattura: string;
  dataEmissione: string;
  importoNetto: number;
  importoIVA: number;
  importoTotale: number;
  aliquotaIVA: number;
  ritenuta: number;
  stato: 'emessa' | 'pagata' | 'parzialmente_pagata' | 'scaduta';
  scadenzaPagamento?: string;
  dataPagamento?: string;
  note?: string;
  attachmentPath?: string;
}

const STATI_FATTURA = [
  { value: 'emessa', label: 'Emessa', icon: <FileText className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  { value: 'pagata', label: 'Pagata', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  { value: 'parzialmente_pagata', label: 'Parzialmente Pagata', icon: <Clock className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  { value: 'scaduta', label: 'Scaduta', icon: <AlertCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-700' }
];

export default function Fatturazione() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ProjectInvoice | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    numeroFattura: "",
    dataEmissione: new Date().toISOString().split('T')[0],
    importoNetto: 0,
    aliquotaIVA: 22,
    ritenuta: 0,
    scadenzaPagamento: "",
    note: ""
  });

  // Fetch progetti
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"]
  });

  // Fetch fatture
  const { data: invoices, isLoading } = useQuery<ProjectInvoice[]>({
    queryKey: ["/api/project-invoices"]
  });

  // Create/Update invoice mutation
  const saveInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingInvoice
        ? `/api/project-invoices/${editingInvoice.id}`
        : "/api/project-invoices";
      const method = editingInvoice ? "PUT" : "POST";

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
      queryClient.invalidateQueries({ queryKey: ["/api/project-invoices"] });
      toast({
        title: editingInvoice ? "Fattura aggiornata" : "Fattura creata",
        description: "La fattura è stata salvata con successo"
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-invoices/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-invoices"] });
      toast({
        title: "Fattura eliminata",
        description: "La fattura è stata rimossa con successo"
      });
    }
  });

  // Update invoice status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, stato, dataPagamento }: { id: string, stato: string, dataPagamento?: string }) => {
      const res = await fetch(`/api/project-invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato, dataPagamento }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-invoices"] });
      toast({
        title: "Stato aggiornato",
        description: "Lo stato della fattura è stato aggiornato"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      numeroFattura: "",
      dataEmissione: new Date().toISOString().split('T')[0],
      importoNetto: 0,
      aliquotaIVA: 22,
      ritenuta: 0,
      scadenzaPagamento: "",
      note: ""
    });
    setSelectedProject("");
    setEditingInvoice(null);
    setIsDialogOpen(false);
  };

  const calculateInvoice = () => {
    const netto = Math.round(formData.importoNetto * 100); // Converti in centesimi
    const iva = Math.round((netto * formData.aliquotaIVA) / 100);
    const totale = netto + iva;
    const ritenuta = Math.round(formData.ritenuta * 100);

    return {
      importoNetto: netto,
      importoIVA: iva,
      importoTotale: totale,
      ritenuta,
      nettoPagare: totale - ritenuta
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProject) {
      toast({
        title: "Errore",
        description: "Seleziona una commessa",
        variant: "destructive"
      });
      return;
    }

    const calculated = calculateInvoice();

    saveInvoiceMutation.mutate({
      projectId: selectedProject,
      numeroFattura: formData.numeroFattura,
      dataEmissione: formData.dataEmissione,
      scadenzaPagamento: formData.scadenzaPagamento || null,
      aliquotaIVA: formData.aliquotaIVA,
      note: formData.note,
      ...calculated,
      stato: 'emessa'
    });
  };

  const handleEdit = (invoice: ProjectInvoice) => {
    setEditingInvoice(invoice);
    setSelectedProject(invoice.projectId);
    setFormData({
      numeroFattura: invoice.numeroFattura,
      dataEmissione: invoice.dataEmissione.split('T')[0],
      importoNetto: invoice.importoNetto / 100,
      aliquotaIVA: invoice.aliquotaIVA,
      ritenuta: invoice.ritenuta / 100,
      scadenzaPagamento: invoice.scadenzaPagamento?.split('T')[0] || "",
      note: invoice.note || ""
    });
    setIsDialogOpen(true);
  };

  const handleMarkAsPaid = (invoice: ProjectInvoice) => {
    updateStatusMutation.mutate({
      id: invoice.id,
      stato: 'pagata',
      dataPagamento: new Date().toISOString()
    });
  };

  // Calcola statistiche
  const stats = {
    totale: invoices?.length || 0,
    emesse: invoices?.filter(i => i.stato === 'emessa').length || 0,
    pagate: invoices?.filter(i => i.stato === 'pagata').length || 0,
    scadute: invoices?.filter(i => i.stato === 'scaduta').length || 0,
    importoTotale: invoices?.reduce((sum, i) => sum + i.importoTotale, 0) || 0,
    importoPagato: invoices?.filter(i => i.stato === 'pagata').reduce((sum, i) => sum + i.importoTotale, 0) || 0,
    importoDaPagare: invoices?.filter(i => i.stato !== 'pagata').reduce((sum, i) => sum + i.importoTotale, 0) || 0
  };

  const groupedInvoices = projects?.map(project => {
    const projectInvoices = invoices?.filter(i => i.projectId === project.id) || [];
    const totaleFatturato = projectInvoices.reduce((sum, i) => sum + i.importoTotale, 0);
    const totalePagato = projectInvoices.filter(i => i.stato === 'pagata').reduce((sum, i) => sum + i.importoTotale, 0);

    return {
      project,
      invoices: projectInvoices,
      totaleFatturato,
      totalePagato,
      totaleInSospeso: totaleFatturato - totalePagato
    };
  }).filter(group => group.invoices.length > 0) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Fatture</h2>
          <p className="text-gray-600 mt-1">Emissione e tracciamento fatture per commessa</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuova Fattura
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingInvoice ? "Modifica Fattura" : "Crea Nuova Fattura"}</DialogTitle>
              <DialogDescription>
                Compila i dati della fattura per la commessa selezionata
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="project">Commessa *</Label>
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                  disabled={!!editingInvoice}
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
                  <Label htmlFor="numeroFattura">Numero Fattura *</Label>
                  <Input
                    id="numeroFattura"
                    value={formData.numeroFattura}
                    onChange={(e) => setFormData({ ...formData, numeroFattura: e.target.value })}
                    placeholder="es. 001/2025"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dataEmissione">Data Emissione *</Label>
                  <Input
                    id="dataEmissione"
                    type="date"
                    value={formData.dataEmissione}
                    onChange={(e) => setFormData({ ...formData, dataEmissione: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="importoNetto">Imponibile (€) *</Label>
                  <Input
                    id="importoNetto"
                    type="number"
                    step="0.01"
                    value={formData.importoNetto}
                    onChange={(e) => setFormData({ ...formData, importoNetto: parseFloat(e.target.value) || 0 })}
                    required
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="aliquotaIVA">Aliquota IVA (%)</Label>
                  <Input
                    id="aliquotaIVA"
                    type="number"
                    value={formData.aliquotaIVA}
                    onChange={(e) => setFormData({ ...formData, aliquotaIVA: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <Label htmlFor="ritenuta">Ritenuta d'Acconto (€)</Label>
                  <Input
                    id="ritenuta"
                    type="number"
                    step="0.01"
                    value={formData.ritenuta}
                    onChange={(e) => setFormData({ ...formData, ritenuta: parseFloat(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="scadenzaPagamento">Scadenza Pagamento</Label>
                <Input
                  id="scadenzaPagamento"
                  type="date"
                  value={formData.scadenzaPagamento}
                  onChange={(e) => setFormData({ ...formData, scadenzaPagamento: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Riepilogo */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="font-semibold text-sm text-gray-700">Riepilogo Fattura</div>
                <div className="flex justify-between text-sm">
                  <span>Imponibile:</span>
                  <span>€{formData.importoNetto.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA ({formData.aliquotaIVA}%):</span>
                  <span>€{((formData.importoNetto * formData.aliquotaIVA) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Totale con IVA:</span>
                  <span>€{(formData.importoNetto + (formData.importoNetto * formData.aliquotaIVA) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>Ritenuta d'Acconto:</span>
                  <span>-€{formData.ritenuta.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Netto a Pagare:</span>
                  <span className="text-green-600">
                    €{(formData.importoNetto + (formData.importoNetto * formData.aliquotaIVA) / 100 - formData.ritenuta).toFixed(2)}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Annulla
                </Button>
                <Button type="submit" disabled={saveInvoiceMutation.isPending}>
                  {saveInvoiceMutation.isPending ? "Salvataggio..." : "Salva Fattura"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiche */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Fatture Totali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.totale}</div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-xs text-gray-600 mt-2">
              <div>Emesse: {stats.emesse} | Pagate: {stats.pagate}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Importo Totale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                €{(stats.importoTotale / 100).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
              </div>
              <Euro className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Incassato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">
                €{(stats.importoPagato / 100).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Da Incassare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-orange-600">
                €{(stats.importoDaPagare / 100).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabelle Fatture */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Tutte le Fatture</TabsTrigger>
          <TabsTrigger value="by-project">Per Commessa</TabsTrigger>
          <TabsTrigger value="unpaid">Da Incassare</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              {isLoading ? (
                <p className="text-center text-gray-500 py-8">Caricamento...</p>
              ) : invoices?.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nessuna fattura emessa</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">N. Fattura</th>
                        <th className="text-left py-3 px-4">Commessa</th>
                        <th className="text-left py-3 px-4">Data Emissione</th>
                        <th className="text-right py-3 px-4">Importo</th>
                        <th className="text-center py-3 px-4">Stato</th>
                        <th className="text-center py-3 px-4">Scadenza</th>
                        <th className="text-center py-3 px-4">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices?.map(invoice => {
                        const project = projects?.find(p => p.id === invoice.projectId);
                        const statoConfig = STATI_FATTURA.find(s => s.value === invoice.stato);

                        return (
                          <tr key={invoice.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{invoice.numeroFattura}</td>
                            <td className="py-3 px-4">
                              <div className="text-sm">
                                <div className="font-medium">{project?.code}</div>
                                <div className="text-gray-500 truncate max-w-xs">{project?.object}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {format(new Date(invoice.dataEmissione), 'dd/MM/yyyy', { locale: it })}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold">
                              €{(invoice.importoTotale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge className={statoConfig?.color}>
                                {statoConfig?.icon}
                                <span className="ml-1">{statoConfig?.label}</span>
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-center text-sm">
                              {invoice.scadenzaPagamento
                                ? format(new Date(invoice.scadenzaPagamento), 'dd/MM/yyyy', { locale: it })
                                : '-'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                {invoice.stato !== 'pagata' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMarkAsPaid(invoice)}
                                    title="Segna come pagata"
                                  >
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(invoice)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Sei sicuro di voler eliminare questa fattura?")) {
                                      deleteInvoiceMutation.mutate(invoice.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-project" className="space-y-4">
          {groupedInvoices.map(group => (
            <Card key={group.project.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{group.project.code}</CardTitle>
                    <CardDescription className="mt-1">{group.project.object}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Fatturato Totale</div>
                    <div className="text-xl font-bold">
                      €{(group.totaleFatturato / 100).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.invoices.map(invoice => {
                    const statoConfig = STATI_FATTURA.find(s => s.value === invoice.stato);
                    return (
                      <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <div className="font-semibold">{invoice.numeroFattura}</div>
                          <div className="text-sm text-gray-600">
                            {format(new Date(invoice.dataEmissione), 'dd MMMM yyyy', { locale: it })}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={statoConfig?.color}>
                            {statoConfig?.label}
                          </Badge>
                          <div className="text-right">
                            <div className="font-bold">
                              €{(invoice.importoTotale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {invoice.stato !== 'pagata' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsPaid(invoice)}
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(invoice)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Sei sicuro di voler eliminare questa fattura?")) {
                                  deleteInvoiceMutation.mutate(invoice.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
          {groupedInvoices.length === 0 && (
            <Card>
              <CardContent className="p-8">
                <p className="text-center text-gray-500">Nessuna fattura emessa</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="unpaid" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              {invoices?.filter(i => i.stato !== 'pagata').length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nessuna fattura da incassare</p>
              ) : (
                <div className="space-y-3">
                  {invoices?.filter(i => i.stato !== 'pagata').map(invoice => {
                    const project = projects?.find(p => p.id === invoice.projectId);
                    const statoConfig = STATI_FATTURA.find(s => s.value === invoice.stato);

                    return (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold">{invoice.numeroFattura}</div>
                            <Badge className={statoConfig?.color}>
                              {statoConfig?.label}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {project?.code} - {project?.object}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Emessa: {format(new Date(invoice.dataEmissione), 'dd/MM/yyyy', { locale: it })}
                            {invoice.scadenzaPagamento && (
                              <> | Scadenza: {format(new Date(invoice.scadenzaPagamento), 'dd/MM/yyyy', { locale: it })}</>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-bold">
                              €{(invoice.importoTotale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(invoice)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Segna Pagata
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
