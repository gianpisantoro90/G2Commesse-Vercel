import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema, type Project, type InsertProject, type Client, type ProjectPrestazioni, type ProjectMetadata } from "@shared/schema";
import {
  TIPO_RAPPORTO_CONFIG,
  type TipoRapportoType,
  getAllPrestazioni,
  getAllLivelliProgettazione,
  hasProgettazione,
  formatImporto
} from "@/lib/prestazioni-utils";
import { CATEGORIE_DM2016 } from "@/lib/parcella-calculator";
import { ClientCombobox } from "@/components/ui/client-combobox";
import { ChevronDown, ChevronUp, Plus, Trash2, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import ProjectHealthCard from "./project-health-card";

interface EditProjectFormProps {
  project: Project;
  children: React.ReactNode;
}

export default function EditProjectForm({ project, children }: EditProjectFormProps) {
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    base: true,
    contratto: false,
    prestazioni: false,
    classificazioni: false,
    health: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State per prestazioni e classificazioni
  const [prestazioniData, setPrestazioniData] = useState<ProjectPrestazioni>({
    prestazioni: [],
    livelloProgettazione: [],
    classificazioniDM2016: [],
  });

  // Fetch existing clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      code: project.code,
      client: project.client,
      city: project.city,
      object: project.object,
      oggettoCompleto: (project as any).oggettoCompleto || undefined,
      year: project.year,
      template: project.template,
      status: project.status,
      tipoRapporto: project.tipoRapporto || "diretto",
      committenteFinale: project.committenteFinale || undefined,
      cig: (project as any).cig || undefined,
      numeroContratto: (project as any).numeroContratto || undefined,
      fsRoot: project.fsRoot || undefined,
      metadata: project.metadata || {},
    },
  });

  // Toggle section
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Handlers per prestazioni
  const handlePrestazioneChange = (prestazioneId: string, checked: boolean) => {
    setPrestazioniData(prev => ({
      ...prev,
      prestazioni: checked
        ? [...(prev.prestazioni || []), prestazioneId as any]
        : (prev.prestazioni || []).filter(p => p !== prestazioneId)
    }));
  };

  const handleLivelloProgettazioneChange = (livelloId: string, checked: boolean) => {
    setPrestazioniData(prev => ({
      ...prev,
      livelloProgettazione: checked
        ? [...(prev.livelloProgettazione || []), livelloId as any]
        : (prev.livelloProgettazione || []).filter(l => l !== livelloId)
    }));
  };

  // Handlers per classificazioni DM 17/06/2016
  const handleAddClassificazione = () => {
    setPrestazioniData(prev => ({
      ...prev,
      classificazioniDM2016: [
        ...(prev.classificazioniDM2016 || []),
        { codice: '', importo: 0 }
      ]
    }));
  };

  const handleRemoveClassificazione = (index: number) => {
    setPrestazioniData(prev => ({
      ...prev,
      classificazioniDM2016: (prev.classificazioniDM2016 || []).filter((_, i) => i !== index)
    }));
  };

  const handleClassificazioneChange = (index: number, field: 'codice' | 'importo' | 'importoServizio', value: string | number) => {
    setPrestazioniData(prev => {
      const newClassificazioni = [...(prev.classificazioniDM2016 || [])];
      if (field === 'codice') {
        newClassificazioni[index] = { ...newClassificazioni[index], codice: value as string };
      } else if (field === 'importo') {
        newClassificazioni[index] = { ...newClassificazioni[index], importo: value as number };
      } else if (field === 'importoServizio') {
        newClassificazioni[index] = { ...newClassificazioni[index], importoServizio: value as number };
      }
      return {
        ...prev,
        classificazioniDM2016: newClassificazioni
      };
    });
  };

  const updateProjectMutation = useMutation({
    mutationFn: async (data: Partial<InsertProject>) => {
      // Include prestazioni data in metadata
      const projectData = {
        ...data,
        metadata: {
          ...(typeof data.metadata === 'object' && data.metadata !== null ? data.metadata as Record<string, unknown> : {}),
          prestazioni: prestazioniData.prestazioni,
          livelloProgettazione: prestazioniData.livelloProgettazione,
          classificazioniDM2016: prestazioniData.classificazioniDM2016,
        }
      };

      const response = await apiRequest("PUT", `/api/projects/${project.id}`, projectData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Commessa aggiornata",
        description: "La commessa è stata aggiornata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "Errore nell'aggiornamento",
        description: "Si è verificato un errore durante l'aggiornamento della commessa",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProject) => {
    updateProjectMutation.mutate(data);
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const metadata = project.metadata as ProjectMetadata;

      // Migra vecchi dati al nuovo formato se necessario
      let classificazioni = metadata?.classificazioniDM2016 || [];
      if (!classificazioni.length && metadata?.classeDM2016) {
        classificazioni = [{
          codice: metadata.classeDM2016,
          importo: metadata.importoOpere || 0
        }];
      }

      setPrestazioniData({
        prestazioni: metadata?.prestazioni || [],
        livelloProgettazione: metadata?.livelloProgettazione || [],
        classificazioniDM2016: classificazioni,
      });

      form.reset({
        code: project.code,
        client: project.client,
        city: project.city,
        object: project.object,
        oggettoCompleto: (project as any).oggettoCompleto || undefined,
        year: project.year,
        template: project.template,
        status: project.status,
        tipoRapporto: project.tipoRapporto || "diretto",
        committenteFinale: project.committenteFinale || undefined,
        cig: (project as any).cig || undefined,
        numeroContratto: (project as any).numeroContratto || undefined,
        fsRoot: project.fsRoot || undefined,
        metadata: project.metadata || {},
      });
    }
  }, [open, project, form]);

  const prestazioniList = getAllPrestazioni();
  const livelliProgettazioneList = getAllLivelliProgettazione();
  const showLivelloProgettazione = hasProgettazione(prestazioniData.prestazioni);

  // Calcola importo totale opere dalla somma delle classificazioni
  const importoTotaleOpere = (prestazioniData.classificazioniDM2016 || []).reduce((sum, c) => sum + (c.importo || 0), 0);
  const importoTotaleServizio = (prestazioniData.classificazioniDM2016 || []).reduce((sum, c) => sum + (c.importoServizio || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Commessa - {project.code}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* SEZIONE 1: Dati Base */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('base')}
                className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted transition-colors"
              >
                <span className="font-semibold text-foreground text-sm">Dati Base Commessa</span>
                {expandedSections.base ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandedSections.base && (
                <div className="p-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Codice Commessa</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="edit-project-code" className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="client"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente</FormLabel>
                          <FormControl>
                            <ClientCombobox
                              clients={clients}
                              value={field.value}
                              onValueChange={(value) => field.onChange(value || "")}
                              placeholder="Seleziona cliente..."
                              disabled={false}
                              className="input-g2"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Città</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="edit-project-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="tipoRapporto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo Rapporto</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona tipo rapporto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(TIPO_RAPPORTO_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  {config.icon} {config.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("tipoRapporto") && form.watch("tipoRapporto") !== "diretto" && (
                      <FormField
                        control={form.control}
                        name="committenteFinale"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Committente Finale</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="Es. Comune di Roma" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="object"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Oggetto (Abbreviato)
                          <span className="ml-1 text-xs text-muted-foreground font-normal">Per cartelle e tabella</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Es. Ristrutturazione edificio" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="oggettoCompleto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Oggetto Completo
                          <span className="ml-1 text-xs text-muted-foreground font-normal">Descrizione estesa per CRE</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="Es. Ristrutturazione e riqualificazione energetica edificio residenziale in Via..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Anno</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min="0"
                              max="99"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="template"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona template" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="LUNGO">LUNGO</SelectItem>
                              <SelectItem value="BREVE">BREVE</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stato</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona stato" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="in corso">In Corso</SelectItem>
                              <SelectItem value="conclusa">Conclusa</SelectItem>
                              <SelectItem value="sospesa">Sospesa</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SEZIONE 2: Dati Contratto */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('contratto')}
                className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted transition-colors"
              >
                <span className="font-semibold text-foreground text-sm">Dati Contratto (per CRE)</span>
                {expandedSections.contratto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandedSections.contratto && (
                <div className="p-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="cig"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CIG</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="Codice Identificativo Gara" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="numeroContratto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>N. Contratto</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="Numero contratto/accordo" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SEZIONE 3: Prestazioni Professionali */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('prestazioni')}
                className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted transition-colors"
              >
                <span className="font-semibold text-foreground text-sm">Prestazioni Professionali</span>
                {expandedSections.prestazioni ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandedSections.prestazioni && (
                <div className="p-4 space-y-4">
                  {/* Tipologia Prestazioni */}
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-3 block">
                      Tipologia Prestazioni
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {prestazioniList.map(({ id, config }) => (
                        <div key={id} className="flex items-center space-x-2 p-2 border border-border rounded-lg hover:bg-muted">
                          <Checkbox
                            id={`edit-prestazione-${id}`}
                            checked={prestazioniData.prestazioni?.includes(id) || false}
                            onCheckedChange={(checked) => handlePrestazioneChange(id, checked as boolean)}
                          />
                          <Label htmlFor={`edit-prestazione-${id}`} className="flex items-center gap-1 cursor-pointer text-xs">
                            <span>{config.icon}</span>
                            <span>{config.shortLabel}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Livello Progettazione - condizionale */}
                  {showLivelloProgettazione && (
                    <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Label className="text-sm font-medium text-foreground mb-2 block">
                        Livello Progettazione
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {livelliProgettazioneList.map(({ id, config }) => (
                          <div key={id} className="flex items-center space-x-2 p-2 bg-card border border-blue-200 dark:border-blue-700 rounded-lg">
                            <Checkbox
                              id={`edit-livello-${id}`}
                              checked={prestazioniData.livelloProgettazione?.includes(id) || false}
                              onCheckedChange={(checked) => handleLivelloProgettazioneChange(id, checked as boolean)}
                            />
                            <Label htmlFor={`edit-livello-${id}`} className="cursor-pointer text-xs">
                              {config.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SEZIONE 4: Classificazioni DM 17/06/2016 */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('classificazioni')}
                className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted transition-colors"
              >
                <span className="font-semibold text-foreground text-sm">Classificazioni DM 17/06/2016</span>
                {expandedSections.classificazioni ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandedSections.classificazioni && (
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      Categorie con importi
                    </p>
                    <Button
                      type="button"
                      onClick={handleAddClassificazione}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 text-xs"
                    >
                      <Plus className="w-3 h-3" /> Aggiungi
                    </Button>
                  </div>

                  {/* Lista classificazioni */}
                  <div className="space-y-2">
                    {prestazioniData.classificazioniDM2016 && prestazioniData.classificazioniDM2016.length > 0 ? (
                      prestazioniData.classificazioniDM2016.map((classificazione, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2 p-2 bg-muted rounded-lg border border-border">
                          {/* Dropdown Categoria */}
                          <div>
                            <Select
                              value={classificazione.codice || ''}
                              onValueChange={(value) => handleClassificazioneChange(index, 'codice', value)}
                            >
                              <SelectTrigger className="font-mono text-xs h-9">
                                <SelectValue placeholder="Categoria..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectGroup>
                                  <SelectLabel>Edilizia</SelectLabel>
                                  {Object.entries(CATEGORIE_DM2016)
                                    .filter(([_, data]) => data.categoria === 'Edilizia')
                                    .map(([codice, data]) => (
                                      <SelectItem key={codice} value={codice} className="text-xs">
                                        <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 40)}...
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>Strutture</SelectLabel>
                                  {Object.entries(CATEGORIE_DM2016)
                                    .filter(([_, data]) => data.categoria === 'Strutture')
                                    .map(([codice, data]) => (
                                      <SelectItem key={codice} value={codice} className="text-xs">
                                        <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 40)}...
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>Impianti</SelectLabel>
                                  {Object.entries(CATEGORIE_DM2016)
                                    .filter(([_, data]) => data.categoria === 'Impianti')
                                    .map(([codice, data]) => (
                                      <SelectItem key={codice} value={codice} className="text-xs">
                                        <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 40)}...
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>Altro</SelectLabel>
                                  {Object.entries(CATEGORIE_DM2016)
                                    .filter(([_, data]) => !['Edilizia', 'Strutture', 'Impianti'].includes(data.categoria))
                                    .map(([codice, data]) => (
                                      <SelectItem key={codice} value={codice} className="text-xs">
                                        <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 40)}...
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Input Importo Opere */}
                          <div>
                            <Input
                              type="number"
                              placeholder="Importo Opere"
                              min="0"
                              step="0.01"
                              value={classificazione.importo || ''}
                              onChange={(e) => handleClassificazioneChange(index, 'importo', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              className="text-xs h-9"
                            />
                          </div>

                          {/* Input Importo Servizio */}
                          <div>
                            <Input
                              type="number"
                              placeholder="Importo Servizio"
                              min="0"
                              step="0.01"
                              value={classificazione.importoServizio || ''}
                              onChange={(e) => handleClassificazioneChange(index, 'importoServizio', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              className="text-xs h-9"
                            />
                          </div>

                          {/* Bottone Rimuovi */}
                          <Button
                            type="button"
                            onClick={() => handleRemoveClassificazione(index)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded-lg">
                        <p className="text-xs">Nessuna classificazione</p>
                      </div>
                    )}
                  </div>

                  {/* Totale Importi */}
                  {prestazioniData.classificazioniDM2016 && prestazioniData.classificazioniDM2016.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Totale Opere:</span>
                        <span className="font-semibold">{formatImporto(importoTotaleOpere)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Totale Servizio:</span>
                        <span className="font-semibold text-primary">{formatImporto(importoTotaleServizio)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SEZIONE 5: Salute Progetto (AI) */}
            {project && (
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('health')}
                  className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted transition-colors"
                >
                  <span className="font-semibold text-foreground text-sm flex items-center gap-2">
                    🩺 Salute Progetto (AI)
                  </span>
                  {expandedSections.health ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.health && (
                  <div className="p-4">
                    <ProjectHealthCard projectId={project.id} />
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="cancel-edit-project"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={updateProjectMutation.isPending}
                className="button-g2-primary"
                data-testid="save-edit-project"
              >
                {updateProjectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salva Modifiche"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
