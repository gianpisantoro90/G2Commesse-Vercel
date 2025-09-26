import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Project, type ProjectMetadata, type ProjectPrestazioni } from "@shared/schema";
import { 
  getAllPrestazioni, 
  getAllLivelliProgettazione,
  validatePrestazioniData,
  hasProgettazione,
  formatImporto 
} from "@/lib/prestazioni-utils";

interface PrestazioniModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrestazioniModal({ project, isOpen, onClose }: PrestazioniModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<ProjectPrestazioni>({
    prestazioni: [],
    livelloProgettazione: [],
    classeDM143: '',
    importoOpere: undefined,
    importoServizio: undefined,
    percentualeParcella: undefined,
  });

  // Initialize form with existing project data
  useEffect(() => {
    if (project && isOpen) {
      const metadata = project.metadata as ProjectMetadata;
      setFormData({
        prestazioni: metadata?.prestazioni || [],
        livelloProgettazione: metadata?.livelloProgettazione || [],
        classeDM143: metadata?.classeDM143 || '',
        importoOpere: metadata?.importoOpere,
        importoServizio: metadata?.importoServizio,
        percentualeParcella: metadata?.percentualeParcella,
      });
    }
  }, [project, isOpen]);

  // Mutation for saving prestazioni
  const savePrestazioniMutation = useMutation({
    mutationFn: async (data: ProjectPrestazioni) => {
      const response = await apiRequest("PUT", `/api/projects/${project.id}/prestazioni`, {
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Prestazioni aggiornate",
        description: `Le prestazioni della commessa ${project.code} sono state aggiornate con successo`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onClose();
    },
    onError: (error: any) => {
      console.error('Error saving prestazioni:', error);
      toast({
        title: "Errore nel salvataggio",
        description: "Si è verificato un errore durante il salvataggio delle prestazioni",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handlePrestazioneChange = (prestazioneId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      prestazioni: checked 
        ? [...(prev.prestazioni || []), prestazioneId as any]
        : (prev.prestazioni || []).filter(p => p !== prestazioneId)
    }));
  };

  const handleLivelloProgettazioneChange = (livelloId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      livelloProgettazione: checked 
        ? [...(prev.livelloProgettazione || []), livelloId as any]
        : (prev.livelloProgettazione || []).filter(l => l !== livelloId)
    }));
  };

  const handleInputChange = (field: keyof ProjectPrestazioni, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate data
    const validation = validatePrestazioniData(formData);
    if (!validation.isValid) {
      toast({
        title: "Dati non validi",
        description: validation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    savePrestazioniMutation.mutate(formData);
  };

  const handleClose = () => {
    if (savePrestazioniMutation.isPending) return;
    onClose();
  };

  if (!isOpen) return null;

  const prestazioniList = getAllPrestazioni();
  const livelliProgettazioneList = getAllLivelliProgettazione();
  const showLivelloProgettazione = hasProgettazione(formData.prestazioni);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" data-testid="prestazioni-modal">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900" data-testid="modal-title">
              Dettagli Prestazioni Professionali
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Commessa: <span className="font-mono font-semibold text-primary">{project.code}</span> - {project.object}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={savePrestazioniMutation.isPending}
            className="text-gray-400 hover:text-gray-600"
            data-testid="close-modal"
          >
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Sezione Tipologia Prestazioni */}
          <div className="space-y-4">
            <div>
              <Label className="text-lg font-semibold text-gray-900">
                Tipologia Prestazioni <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Seleziona tutte le prestazioni professionali relative a questa commessa
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4" data-testid="prestazioni-checkboxes">
              {prestazioniList.map(({ id, config }) => (
                <div key={id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id={`prestazione-${id}`}
                    checked={formData.prestazioni?.includes(id) || false}
                    onCheckedChange={(checked) => handlePrestazioneChange(id, checked as boolean)}
                    data-testid={`checkbox-prestazione-${id}`}
                  />
                  <Label htmlFor={`prestazione-${id}`} className="flex items-center gap-2 cursor-pointer flex-1">
                    <span className="text-lg">{config.icon}</span>
                    <div>
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-gray-500">{config.description}</div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Sezione Livello Progettazione (condizionale) */}
          {showLivelloProgettazione && (
            <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div>
                <Label className="text-lg font-semibold text-gray-900">
                  Livello Progettazione <span className="text-red-500">*</span>
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Specifica il livello di progettazione secondo la normativa vigente
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4" data-testid="livello-progettazione-checkboxes">
                {livelliProgettazioneList.map(({ id, config }) => (
                  <div key={id} className="flex items-center space-x-3 p-3 bg-white border border-blue-200 rounded-lg">
                    <Checkbox
                      id={`livello-${id}`}
                      checked={formData.livelloProgettazione?.includes(id) || false}
                      onCheckedChange={(checked) => handleLivelloProgettazioneChange(id, checked as boolean)}
                      data-testid={`checkbox-livello-${id}`}
                    />
                    <Label htmlFor={`livello-${id}`} className="cursor-pointer flex-1">
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-gray-500">{config.description}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sezione Classificazione DM 143/2013 */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <Label className="text-lg font-semibold text-gray-900">
                Classificazione DM 143/2013
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Parametri per la determinazione del compenso professionale
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classe-dm" className="text-sm font-medium">
                  Classe e Categoria
                </Label>
                <Input
                  id="classe-dm"
                  placeholder="Es: E22, IA03, S05"
                  value={formData.classeDM143 || ''}
                  onChange={(e) => handleInputChange('classeDM143', e.target.value)}
                  className="font-mono"
                  data-testid="input-classe-dm"
                />
                <p className="text-xs text-gray-500">
                  Codice secondo il Decreto Ministeriale 143/2013
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="importo-opere" className="text-sm font-medium">
                  Importo Opere (€)
                </Label>
                <Input
                  id="importo-opere"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={formData.importoOpere || ''}
                  onChange={(e) => handleInputChange('importoOpere', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                  data-testid="input-importo-opere"
                />
                <p className="text-xs text-gray-500">
                  Importo dei lavori base per calcolo parcella
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="importo-servizio" className="text-sm font-medium">
                  Importo Servizio Professionale (€)
                </Label>
                <Input
                  id="importo-servizio"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={formData.importoServizio || ''}
                  onChange={(e) => handleInputChange('importoServizio', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                  data-testid="input-importo-servizio"
                />
                <p className="text-xs text-gray-500">
                  Compenso professionale al netto di cassa e IVA
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="percentuale-parcella" className="text-sm font-medium">
                  Percentuale Parcella (%)
                </Label>
                <Input
                  id="percentuale-parcella"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.percentualeParcella || ''}
                  onChange={(e) => handleInputChange('percentualeParcella', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                  data-testid="input-percentuale-parcella"
                />
                <p className="text-xs text-gray-500">
                  Percentuale applicata sull'importo opere
                </p>
              </div>
            </div>

            {/* Riepilogo importi */}
            {(formData.importoOpere || formData.importoServizio) && (
              <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Riepilogo Economico</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Importo Opere:</span>
                    <div className="font-semibold text-blue-600">{formatImporto(formData.importoOpere || 0)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Compenso Professionale:</span>
                    <div className="font-semibold text-green-600">{formatImporto(formData.importoServizio || 0)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer con azioni */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={savePrestazioniMutation.isPending}
              data-testid="cancel-button"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={savePrestazioniMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="save-button"
            >
              {savePrestazioniMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">🔄</span>
                  Salvando...
                </>
              ) : (
                <>
                  💾 Salva Classificazione
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}