import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CLASSI_DM143 } from "@/lib/parcella-calculator";

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
    classificazioniDM143: [],
  });

  // Initialize form with existing project data
  useEffect(() => {
    if (project && isOpen) {
      const metadata = project.metadata as ProjectMetadata;

      // Migra vecchi dati al nuovo formato se necessario
      let classificazioni = metadata?.classificazioniDM143 || [];

      // Se esiste il vecchio formato (classeDM143 singola), convertilo al nuovo formato
      if (!classificazioni.length && metadata?.classeDM143) {
        classificazioni = [{
          codice: metadata.classeDM143,
          importo: metadata.importoOpere || 0
        }];
      }

      setFormData({
        prestazioni: metadata?.prestazioni || [],
        livelloProgettazione: metadata?.livelloProgettazione || [],
        classificazioniDM143: classificazioni,
      });
    }
  }, [project, isOpen]);

  // Mutation for saving prestazioni
  const savePrestazioniMutation = useMutation({
    mutationFn: async (data: ProjectPrestazioni) => {
      const response = await apiRequest("PUT", `/api/projects/${project.id}/prestazioni`, data);
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

  // Handlers per classificazioni DM 143/2013
  const handleAddClassificazione = () => {
    setFormData(prev => ({
      ...prev,
      classificazioniDM143: [
        ...(prev.classificazioniDM143 || []),
        { codice: '', importo: 0 }
      ]
    }));
  };

  const handleRemoveClassificazione = (index: number) => {
    setFormData(prev => ({
      ...prev,
      classificazioniDM143: (prev.classificazioniDM143 || []).filter((_, i) => i !== index)
    }));
  };

  const handleClassificazioneChange = (index: number, field: 'codice' | 'importo', value: string | number) => {
    setFormData(prev => {
      const newClassificazioni = [...(prev.classificazioniDM143 || [])];
      if (field === 'codice') {
        newClassificazioni[index] = { ...newClassificazioni[index], codice: value as string };
      } else {
        newClassificazioni[index] = { ...newClassificazioni[index], importo: value as number };
      }
      return {
        ...prev,
        classificazioniDM143: newClassificazioni
      };
    });
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

  // Calcola importo totale opere dalla somma delle classificazioni
  const importoTotaleOpere = (formData.classificazioniDM143 || []).reduce((sum, c) => sum + (c.importo || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="prestazioni-modal">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose} aria-hidden="true" />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white" data-testid="modal-title">
              Dettagli Prestazioni Professionali
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Commessa: <span className="font-mono font-semibold text-primary">{project.code}</span> - {project.object}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={savePrestazioniMutation.isPending}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            data-testid="close-modal"
          >
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Sezione Tipologia Prestazioni */}
          <div className="space-y-4">
            <div>
              <Label className="text-lg font-semibold text-gray-900 dark:text-white">
                Tipologia Prestazioni <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Seleziona tutte le prestazioni professionali relative a questa commessa
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4" data-testid="prestazioni-checkboxes">
              {prestazioniList.map(({ id, config }) => (
                <div key={id} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Checkbox
                    id={`prestazione-${id}`}
                    checked={formData.prestazioni?.includes(id) || false}
                    onCheckedChange={(checked) => handlePrestazioneChange(id, checked as boolean)}
                    data-testid={`checkbox-prestazione-${id}`}
                  />
                  <Label htmlFor={`prestazione-${id}`} className="flex items-center gap-2 cursor-pointer flex-1">
                    <span className="text-lg">{config.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{config.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Sezione Livello Progettazione (condizionale) */}
          {showLivelloProgettazione && (
            <div className="space-y-4 bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <Label className="text-lg font-semibold text-gray-900 dark:text-white">
                  Livello Progettazione <span className="text-red-500">*</span>
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Specifica il livello di progettazione secondo la normativa vigente
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4" data-testid="livello-progettazione-checkboxes">
                {livelliProgettazioneList.map(({ id, config }) => (
                  <div key={id} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <Checkbox
                      id={`livello-${id}`}
                      checked={formData.livelloProgettazione?.includes(id) || false}
                      onCheckedChange={(checked) => handleLivelloProgettazioneChange(id, checked as boolean)}
                      data-testid={`checkbox-livello-${id}`}
                    />
                    <Label htmlFor={`livello-${id}`} className="cursor-pointer flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{config.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sezione Classificazioni DM 143/2013 - Multiple */}
          <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <Label className="text-lg font-semibold text-gray-900 dark:text-white">
                  Classificazioni DM 143/2013
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Aggiungi una o più categorie con i rispettivi importi opere
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAddClassificazione}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                ➕ Aggiungi
              </Button>
            </div>

            {/* Lista classificazioni */}
            <div className="space-y-3">
              {formData.classificazioniDM143 && formData.classificazioniDM143.length > 0 ? (
                formData.classificazioniDM143.map((classificazione, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    {/* Dropdown Categoria */}
                    <div className="space-y-1">
                      <Label htmlFor={`classe-dm-${index}`} className="text-xs font-medium">
                        Classe e Categoria
                      </Label>
                      <Select
                        value={classificazione.codice || ''}
                        onValueChange={(value) => handleClassificazioneChange(index, 'codice', value)}
                      >
                        <SelectTrigger id={`classe-dm-${index}`} className="font-mono text-sm">
                          <SelectValue placeholder="Seleziona categoria..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          {/* EDILIZIA */}
                          <SelectGroup>
                            <SelectLabel>Edilizia</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Edilizia')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>

                          {/* STRUTTURE */}
                          <SelectGroup>
                            <SelectLabel>Strutture</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Strutture')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>

                          {/* IMPIANTI */}
                          <SelectGroup>
                            <SelectLabel>Impianti</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Impianti')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>

                          {/* INFRASTRUTTURE MOBILITÀ */}
                          <SelectGroup>
                            <SelectLabel>Infrastrutture Mobilità</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Infrastrutture Mobilità')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>

                          {/* IDRAULICA */}
                          <SelectGroup>
                            <SelectLabel>Idraulica</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Idraulica')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>

                          {/* TECNOLOGIE ICT */}
                          <SelectGroup>
                            <SelectLabel>Tecnologie ICT</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Tecnologie ICT')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>

                          {/* PAESAGGIO E AMBIENTE */}
                          <SelectGroup>
                            <SelectLabel>Paesaggio e Ambiente</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Paesaggio e Ambiente')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>

                          {/* TERRITORIO E URBANISTICA */}
                          <SelectGroup>
                            <SelectLabel>Territorio e Urbanistica</SelectLabel>
                            {Object.entries(CLASSI_DM143)
                              .filter(([_, data]) => data.categoria === 'Territorio e Urbanistica')
                              .map(([codice, data]) => (
                                <SelectItem key={codice} value={codice}>
                                  <span className="font-mono font-semibold">{codice}</span> - {data.descrizione}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Input Importo */}
                    <div className="space-y-1">
                      <Label htmlFor={`importo-${index}`} className="text-xs font-medium">
                        Importo Opere (€)
                      </Label>
                      <Input
                        id={`importo-${index}`}
                        type="number"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        value={classificazione.importo || ''}
                        onChange={(e) => handleClassificazioneChange(index, 'importo', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        className="text-sm"
                      />
                    </div>

                    {/* Bottone Rimuovi */}
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={() => handleRemoveClassificazione(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">Nessuna classificazione aggiunta</p>
                  <p className="text-xs mt-1">Clicca "Aggiungi" per inserire una categoria</p>
                </div>
              )}
            </div>

            {/* Totale Importo Opere */}
            {formData.classificazioniDM143 && formData.classificazioniDM143.length > 0 && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Importo Totale Opere:
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatImporto(importoTotaleOpere)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer con azioni */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
    </div>
  );
}