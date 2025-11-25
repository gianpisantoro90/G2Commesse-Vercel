import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type ProjectInvoice } from "@shared/schema";
import { FileText, Check, X, Plus, Trash2 } from "lucide-react";

interface InvoicesModalProps {
  projectId: string | null;
  projectCode: string;
  open: boolean;
  onClose: () => void;
}

interface InvoiceForm {
  numeroFattura: string;
  dataEmissione: string;
  importoNetto: number;
  cassaPrevidenziale: number;
  importoIVA: number;
  importoTotale: number;
  importoParcella: number;
  aliquotaIVA: number;
  stato: string;
  dataPagamento: string;
  note: string;
}

const emptyInvoice: InvoiceForm = {
  numeroFattura: "",
  dataEmissione: new Date().toISOString().split('T')[0],
  importoNetto: 0,
  cassaPrevidenziale: 0,
  importoIVA: 0,
  importoTotale: 0,
  importoParcella: 0,
  aliquotaIVA: 22,
  stato: "emessa",
  dataPagamento: "",
  note: ""
};

// Funzione per calcolare automaticamente cassa e IVA
const calculateCassaAndIVA = (netto: number, aliquota: number = 22) => {
  const cassa = netto * 0.04; // 4% Inarcassa
  const iva = (netto + cassa) * (aliquota / 100); // IVA su netto + cassa
  return { cassa: Math.round(cassa * 100) / 100, iva: Math.round(iva * 100) / 100 };
};

export default function InvoicesModal({ projectId, projectCode, open, onClose }: InvoicesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [invoices, setInvoices] = useState<(ProjectInvoice & { _isNew?: boolean })[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<InvoiceForm>(emptyInvoice);

  // Fetch invoices
  const { data: fetchedInvoices = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/invoices`],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await fetch(`/api/projects/${projectId}/invoices`);
      if (!response.ok) return [];
      return response.json() as Promise<ProjectInvoice[]>;
    },
    enabled: open && !!projectId
  });

  useEffect(() => {
    if (open && fetchedInvoices.length > 0) {
      setInvoices(fetchedInvoices);
    } else if (open) {
      setInvoices([]);
    }
  }, [open, fetchedInvoices]);

  const saveMutation = useMutation({
    mutationFn: async (invoice: any) => {
      if (editingIndex !== null && editingIndex < invoices.length) {
        const existingInvoice = invoices[editingIndex];
        if (!existingInvoice._isNew) {
          await apiRequest("PATCH", `/api/projects/${projectId}/invoices/${existingInvoice.id}`, invoice);
        } else {
          await apiRequest("POST", `/api/projects/${projectId}/invoices`, invoice);
        }
      } else {
        await apiRequest("POST", `/api/projects/${projectId}/invoices`, invoice);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/invoices`] });
      toast({
        title: "Fattura salvata",
        description: "La fattura è stata salvata con successo"
      });
      setEditingIndex(null);
      setFormData(emptyInvoice);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/invoices/${invoiceId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/invoices`] });
      toast({
        title: "Fattura eliminata",
        description: "La fattura è stata eliminata con successo"
      });
    }
  });

  const handleAddNew = () => {
    setEditingIndex(invoices.length);
    setInvoices([...invoices, { ...emptyInvoice, _isNew: true } as any]);
    setFormData(emptyInvoice);
  };

  const handleEdit = (index: number) => {
    const invoice = invoices[index];
    setEditingIndex(index);
    setFormData({
      numeroFattura: invoice.numeroFattura,
      dataEmissione: new Date(invoice.dataEmissione).toISOString().split('T')[0],
      importoNetto: invoice.importoNetto / 100,
      cassaPrevidenziale: invoice.cassaPrevidenziale ? invoice.cassaPrevidenziale / 100 : 0,
      importoIVA: invoice.importoIVA / 100,
      importoTotale: invoice.importoTotale / 100,
      importoParcella: invoice.importoParcella / 100,
      aliquotaIVA: invoice.aliquotaIVA,
      stato: invoice.stato,
      dataPagamento: invoice.dataPagamento ? new Date(invoice.dataPagamento).toISOString().split('T')[0] : "",
      note: invoice.note || ""
    });
  };

  const handleSave = () => {
    if (!formData.numeroFattura) {
      toast({
        title: "Numero fattura mancante",
        description: "Inserisci il numero della fattura",
        variant: "destructive"
      });
      return;
    }

    saveMutation.mutate({
      numeroFattura: formData.numeroFattura,
      dataEmissione: new Date(formData.dataEmissione).toISOString(),
      importoNetto: formData.importoNetto,
      importoParcella: formData.importoParcella,
      aliquotaIVA: formData.aliquotaIVA,
      stato: formData.stato,
      dataPagamento: formData.dataPagamento ? new Date(formData.dataPagamento).toISOString() : null,
      note: formData.note || null
    });
  };

  const handleDelete = (index: number) => {
    const invoice = invoices[index];
    if (invoice.id && !invoice._isNew) {
      deleteMutation.mutate(invoice.id);
    }
    const newInvoices = invoices.filter((_, i) => i !== index);
    setInvoices(newInvoices);
    setEditingIndex(null);
    setFormData(emptyInvoice);
  };

  // Funzioni di calcolo automatico
  const updateCalculatedFields = (netto: number, aliquota: number = formData.aliquotaIVA) => {
    const cassa = netto * 0.04; // 4% Inarcassa
    const iva = (netto + cassa) * (aliquota / 100); // IVA su netto+cassa
    const totale = netto + cassa + iva;
    return { cassa, iva, totale };
  };

  const calculateImportoTotale = () => {
    return formData.importoNetto + formData.cassaPrevidenziale + formData.importoIVA;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Gestione Fatture - {projectCode}
          </DialogTitle>
          <DialogDescription>
            Aggiungi, modifica o elimina fatture per questa commessa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lista Fatture */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-white">Fatture ({invoices.length})</h3>
              <Button
                size="sm"
                onClick={handleAddNew}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuova Fattura
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {invoices.map((invoice, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    editingIndex === index
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => handleEdit(index)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {invoice.numeroFattura}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        €{(invoice.importoTotale / 100).toFixed(2)} • {new Date(invoice.dataEmissione).toLocaleDateString('it-IT')}
                      </div>
                      {invoice.importoParcella > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          Parcella: €{(invoice.importoParcella / 100).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        invoice.stato === 'pagata'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}>
                        {invoice.stato === 'pagata' ? '✓ Pagata' : '⏳ Da pagare'}
                      </span>
                      {editingIndex === index && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(index);
                          }}
                          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Editing */}
          {editingIndex !== null && (
            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {invoices[editingIndex]?._isNew ? 'Nuova Fattura' : 'Modifica Fattura'}
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="numeroFattura">Numero Fattura</Label>
                  <Input
                    id="numeroFattura"
                    value={formData.numeroFattura}
                    onChange={(e) => setFormData({ ...formData, numeroFattura: e.target.value })}
                    placeholder="es. 001/2025"
                  />
                </div>

                <div>
                  <Label htmlFor="dataEmissione">Data Emissione</Label>
                  <Input
                    id="dataEmissione"
                    type="date"
                    value={formData.dataEmissione}
                    onChange={(e) => setFormData({ ...formData, dataEmissione: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="importoNetto">Importo Netto (€)</Label>
                  <Input
                    id="importoNetto"
                    type="number"
                    step="0.01"
                    value={formData.importoNetto}
                    onChange={(e) => {
                      const netto = parseFloat(e.target.value) || 0;
                      const calcs = updateCalculatedFields(netto, formData.aliquotaIVA);
                      setFormData({ 
                        ...formData, 
                        importoNetto: netto,
                        cassaPrevidenziale: calcs.cassa,
                        importoIVA: calcs.iva,
                        importoTotale: calcs.totale
                      });
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="importoParcella">Parcella Pattuita (€)</Label>
                  <Input
                    id="importoParcella"
                    type="number"
                    step="0.01"
                    value={formData.importoParcella}
                    onChange={(e) => setFormData({ ...formData, importoParcella: parseFloat(e.target.value) || 0 })}
                    placeholder="Importo accordato"
                  />
                </div>

                <div>
                  <Label htmlFor="aliquotaIVA">Aliquota IVA (%)</Label>
                  <Input
                    id="aliquotaIVA"
                    type="number"
                    value={formData.aliquotaIVA}
                    onChange={(e) => {
                      const aliquota = parseInt(e.target.value) || 22;
                      const calcs = updateCalculatedFields(formData.importoNetto, aliquota);
                      setFormData({ 
                        ...formData, 
                        aliquotaIVA: aliquota,
                        cassaPrevidenziale: calcs.cassa,
                        importoIVA: calcs.iva,
                        importoTotale: calcs.totale
                      });
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="cassaPrevidenziale">Cassa Previdenziale - Inarcassa 4% (€)</Label>
                  <Input
                    id="cassaPrevidenziale"
                    type="number"
                    step="0.01"
                    value={formData.cassaPrevidenziale}
                    disabled
                    className="bg-gray-100 dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Calcolata automaticamente: Netto × 4%</p>
                </div>

                <div>
                  <Label htmlFor="importoIVA">IVA (€)</Label>
                  <Input
                    id="importoIVA"
                    type="number"
                    step="0.01"
                    value={formData.importoIVA}
                    disabled
                    className="bg-gray-100 dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Calcolata automaticamente: (Netto + Cassa) × Aliquota%</p>
                </div>

                <div className="md:col-span-2">
                  <Label>Importo Totale: €{calculateImportoTotale().toFixed(2)}</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Netto + Cassa + IVA</p>
                </div>

                <div>
                  <Label htmlFor="stato">Stato</Label>
                  <select
                    id="stato"
                    value={formData.stato}
                    onChange={(e) => setFormData({ ...formData, stato: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="emessa">Emessa</option>
                    <option value="pagata">Pagata</option>
                    <option value="parzialmente_pagata">Parzialmente Pagata</option>
                  </select>
                </div>

                {formData.stato !== 'emessa' && (
                  <div>
                    <Label htmlFor="dataPagamento">Data Pagamento</Label>
                    <Input
                      id="dataPagamento"
                      type="date"
                      value={formData.dataPagamento}
                      onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <Label htmlFor="note">Note</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    rows={2}
                    placeholder="Note aggiuntive sulla fattura"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingIndex(null);
                    setFormData(emptyInvoice);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Annulla
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </div>
          )}

          {/* Riepilogo */}
          {invoices.length > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Totale Fatturato:</span>
                  <span>€{(invoices.reduce((sum, inv) => sum + inv.importoTotale, 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Totale Parcelle:</span>
                  <span>€{(invoices.reduce((sum, inv) => sum + (inv.importoParcella || 0), 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Pagato:</span>
                  <span>€{(invoices.filter(inv => inv.stato === 'pagata').reduce((sum, inv) => sum + inv.importoTotale, 0) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
