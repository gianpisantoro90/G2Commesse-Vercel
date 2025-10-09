import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { type Project } from "@shared/schema";
import { FileText, Check, X } from "lucide-react";

interface FatturazioneModalProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}

export default function FatturazioneModal({ project, open, onClose }: FatturazioneModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    fatturato: false,
    numeroFattura: "",
    dataFattura: "",
    importoFatturato: 0,
    pagato: false,
    dataPagamento: "",
    importoPagato: 0,
    noteFatturazione: ""
  });

  useEffect(() => {
    if (project) {
      setFormData({
        fatturato: project.fatturato || false,
        numeroFattura: project.numeroFattura || "",
        dataFattura: project.dataFattura ? new Date(project.dataFattura).toISOString().split('T')[0] : "",
        importoFatturato: project.importoFatturato ? project.importoFatturato / 100 : 0,
        pagato: project.pagato || false,
        dataPagamento: project.dataPagamento ? new Date(project.dataPagamento).toISOString().split('T')[0] : "",
        importoPagato: project.importoPagato ? project.importoPagato / 100 : 0,
        noteFatturazione: project.noteFatturazione || ""
      });
    }
  }, [project]);

  const updateFatturazioneMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/projects/${project!.id}`, {
        fatturato: data.fatturato,
        numeroFattura: data.numeroFattura || null,
        dataFattura: data.dataFattura ? new Date(data.dataFattura).toISOString() : null,
        importoFatturato: Math.round(data.importoFatturato * 100), // Converti in centesimi
        pagato: data.pagato,
        dataPagamento: data.dataPagamento ? new Date(data.dataPagamento).toISOString() : null,
        importoPagato: Math.round(data.importoPagato * 100),
        noteFatturazione: data.noteFatturazione || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.refetchQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Fatturazione aggiornata",
        description: "Lo stato di fatturazione è stato aggiornato con successo"
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFatturazioneMutation.mutate(formData);
  };

  const handleQuickFatturato = () => {
    setFormData(prev => ({
      ...prev,
      fatturato: true,
      dataFattura: prev.dataFattura || new Date().toISOString().split('T')[0]
    }));
  };

  const handleQuickPagato = () => {
    setFormData(prev => ({
      ...prev,
      fatturato: true,
      pagato: true,
      dataFattura: prev.dataFattura || new Date().toISOString().split('T')[0],
      dataPagamento: prev.dataPagamento || new Date().toISOString().split('T')[0],
      importoPagato: prev.importoPagato || prev.importoFatturato
    }));
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Gestione Fatturazione - {project.code}
          </DialogTitle>
          <DialogDescription>
            {project.object}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickFatturato}
              className="flex-1"
            >
              <Check className="w-4 h-4 mr-2" />
              Segna Fatturato
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickPagato}
              className="flex-1"
            >
              <Check className="w-4 h-4 mr-2" />
              Segna Fatturato e Pagato
            </Button>
          </div>

          {/* Fatturazione Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="fatturato"
                checked={formData.fatturato}
                onChange={(e) => setFormData({ ...formData, fatturato: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <Label htmlFor="fatturato" className="text-base font-semibold cursor-pointer">
                📄 Fatturato
              </Label>
            </div>

            {formData.fatturato && (
              <div className="grid gap-4 md:grid-cols-2 ml-8">
                <div>
                  <Label htmlFor="numeroFattura">Numero Fattura/Parcella</Label>
                  <Input
                    id="numeroFattura"
                    value={formData.numeroFattura}
                    onChange={(e) => setFormData({ ...formData, numeroFattura: e.target.value })}
                    placeholder="es. 001/2025"
                  />
                </div>

                <div>
                  <Label htmlFor="dataFattura">Data Emissione</Label>
                  <Input
                    id="dataFattura"
                    type="date"
                    value={formData.dataFattura}
                    onChange={(e) => setFormData({ ...formData, dataFattura: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="importoFatturato">Importo Fatturato (€)</Label>
                  <Input
                    id="importoFatturato"
                    type="number"
                    step="0.01"
                    value={formData.importoFatturato}
                    onChange={(e) => setFormData({ ...formData, importoFatturato: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pagamento Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-green-50/50">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="pagato"
                checked={formData.pagato}
                onChange={(e) => setFormData({ ...formData, pagato: e.target.checked })}
                className="w-5 h-5 rounded"
                disabled={!formData.fatturato}
              />
              <Label htmlFor="pagato" className="text-base font-semibold cursor-pointer">
                💰 Pagato / Incassato
              </Label>
              {!formData.fatturato && (
                <span className="text-xs text-gray-500">(prima segna come fatturato)</span>
              )}
            </div>

            {formData.pagato && formData.fatturato && (
              <div className="grid gap-4 md:grid-cols-2 ml-8">
                <div>
                  <Label htmlFor="dataPagamento">Data Incasso</Label>
                  <Input
                    id="dataPagamento"
                    type="date"
                    value={formData.dataPagamento}
                    onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="importoPagato">Importo Incassato (€)</Label>
                  <Input
                    id="importoPagato"
                    type="number"
                    step="0.01"
                    value={formData.importoPagato}
                    onChange={(e) => setFormData({ ...formData, importoPagato: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <Label htmlFor="noteFatturazione">Note Fatturazione/Pagamento</Label>
            <Textarea
              id="noteFatturazione"
              value={formData.noteFatturazione}
              onChange={(e) => setFormData({ ...formData, noteFatturazione: e.target.value })}
              rows={3}
              placeholder="Note aggiuntive su fatturazione, scadenze pagamento, ecc."
            />
          </div>

          {/* Summary */}
          {(formData.fatturato || formData.pagato) && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
              <div className="font-semibold">Riepilogo:</div>
              {formData.fatturato && (
                <div className="flex justify-between">
                  <span>📄 Fatturato:</span>
                  <span className="font-medium">
                    {formData.numeroFattura || "N/A"} - €{formData.importoFatturato.toFixed(2)}
                    {formData.dataFattura && ` (${new Date(formData.dataFattura).toLocaleDateString('it-IT')})`}
                  </span>
                </div>
              )}
              {formData.pagato && (
                <div className="flex justify-between text-green-700">
                  <span>💰 Incassato:</span>
                  <span className="font-medium">
                    €{formData.importoPagato.toFixed(2)}
                    {formData.dataPagamento && ` (${new Date(formData.dataPagamento).toLocaleDateString('it-IT')})`}
                  </span>
                </div>
              )}
              {formData.fatturato && !formData.pagato && (
                <div className="flex justify-between text-orange-600">
                  <span>⏳ Da incassare:</span>
                  <span className="font-medium">€{formData.importoFatturato.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Annulla
            </Button>
            <Button type="submit" disabled={updateFatturazioneMutation.isPending}>
              {updateFatturazioneMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
