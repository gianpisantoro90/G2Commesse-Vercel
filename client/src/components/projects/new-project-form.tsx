import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema, type InsertProject, type Client, type ProjectPrestazioni } from "@shared/schema";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { useOneDriveRootConfig } from "@/hooks/use-onedrive-root-config";
import {
  TIPO_RAPPORTO_CONFIG,
  type TipoRapportoType,
  getAllPrestazioni,
  getAllLivelliProgettazione,
  formatImporto
} from "@/lib/prestazioni-utils";
import { CATEGORIE_DM2016 } from "@/lib/parcella-calculator";
import { Cloud, CheckCircle, AlertCircle, Loader2, FolderOpen, Settings, Save, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { ClientCombobox } from "@/components/ui/client-combobox";
import { z } from "zod";

const formSchema = insertProjectSchema.extend({
  year: z.number().min(0).max(99),
});

type FormData = z.infer<typeof formSchema>;

interface NewProjectFormProps {
  onProjectSaved: (project: any) => void;
}

export default function NewProjectForm({ onProjectSaved }: NewProjectFormProps) {
  const [generatedCode, setGeneratedCode] = useState("");
  const [creationStep, setCreationStep] = useState<string>("");
  const [createdFolderPath, setCreatedFolderPath] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState({
    base: true,
    contratto: false,
    prestazioni: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected } = useOneDriveSync();

  // State per prestazioni e classificazioni
  const [prestazioniData, setPrestazioniData] = useState<ProjectPrestazioni>({
    prestazioni: [],
    livelloProgettazione: [],
  });

  const [expandedPrestazioni, setExpandedPrestazioni] = useState<Set<string>>(new Set());
  // Classificazioni per tipo di prestazione (local state, saved after project creation)
  const [classificazioniPerTipo, setClassificazioniPerTipo] = useState<
    Record<string, Array<{ codice: string; importoOpere: number; importoServizio: number }>>
  >({});

  // Fetch existing clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: QK.clients,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client: "",
      city: "",
      object: "",
      oggettoCompleto: "",
      year: new Date().getFullYear() % 100,
      template: "LUNGO",
      status: "in corso",
      tipoRapporto: "diretto",
      committenteFinale: undefined,
      cig: "",
      numeroContratto: "",
      code: "",
      metadata: {},
    },
  });

  // Use shared OneDrive root folder configuration hook
  const {
    rootConfig,
    isConfigured: isRootConfigured,
    isLoading: isLoadingConfig,
  } = useOneDriveRootConfig();

  const generateCodeMutation = useMutation({
    mutationFn: async (data: { client: string; city: string; year: number }) => {
      const response = await apiRequest("POST", "/api/generate-code", data);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      form.setValue("code", data.code);
    },
    onError: () => {
      toast({
        title: "Errore nella generazione del codice",
        description: "Si è verificato un errore durante la generazione del codice commessa",
        variant: "destructive",
      });
    },
  });

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

  // Handlers per classificazioni DM 17/06/2016 (local state, per tipo di prestazione)
  const handleAddClassificazioneForTipo = (tipo: string) => {
    setClassificazioniPerTipo(prev => ({
      ...prev,
      [tipo]: [...(prev[tipo] || []), { codice: 'E.01', importoOpere: 0, importoServizio: 0 }],
    }));
  };

  const handleRemoveClassificazioneForTipo = (tipo: string, index: number) => {
    setClassificazioniPerTipo(prev => ({
      ...prev,
      [tipo]: (prev[tipo] || []).filter((_, i) => i !== index),
    }));
  };

  const handleClassificazioneChangeForTipo = (tipo: string, index: number, field: string, value: string | number) => {
    setClassificazioniPerTipo(prev => {
      const arr = [...(prev[tipo] || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [tipo]: arr };
    });
  };

  // Toggle section
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // OneDrive project creation mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      // Step 1: Create project in database
      setCreationStep("Creando commessa nel database...");

      // Include prestazioni data in metadata (classificazioni saved separately after creation)
      const projectData = {
        ...data,
        metadata: {
          ...(typeof data.metadata === 'object' && data.metadata !== null ? data.metadata as Record<string, unknown> : {}),
          prestazioni: prestazioniData.prestazioni,
          livelloProgettazione: prestazioniData.livelloProgettazione,
        }
      };

      const projectResponse = await apiRequest("POST", "/api/projects", projectData);
      const project = await projectResponse.json();

      // Step 1b: Save classificazioni for each prestazione
      const hasClassificazioni = Object.values(classificazioniPerTipo).some(arr => arr.length > 0);
      if (hasClassificazioni) {
        setCreationStep("Salvando classificazioni DM...");
        const prestazioniResponse = await apiRequest("GET", `/api/projects/${project.id}/prestazioni`);
        const prestazioni = await prestazioniResponse.json();

        for (const [tipo, classificazioni] of Object.entries(classificazioniPerTipo)) {
          if (!classificazioni || classificazioni.length === 0) continue;
          const prestazione = prestazioni.find((p: any) => p.tipo === tipo);
          if (!prestazione) continue;

          for (const c of classificazioni) {
            if (!c.codice) continue;
            try {
              await apiRequest("POST", `/api/prestazioni/${prestazione.id}/classificazioni`, {
                codiceDM: c.codice,
                importoOpere: Math.round(c.importoOpere * 100),
                importoServizio: Math.round(c.importoServizio * 100),
              });
            } catch (err) {
              console.error(`Error saving classificazione for ${tipo}:`, err);
            }
          }
        }
      }

      // Step 2: Create OneDrive folder with template
      setCreationStep("Creando cartella OneDrive...");
      const folderResponse = await apiRequest("POST", "/api/onedrive/create-project-folder", {
        projectCode: data.code,
        template: data.template,
        object: data.object
      });
      const folderResult = await folderResponse.json();

      if (!folderResult.success) {
        throw new Error('Failed to create OneDrive folder');
      }

      // Step 3: Finalize setup
      setCreationStep("Finalizzando configurazione...");
      setCreatedFolderPath(folderResult.folder?.path || '');

      return { project, folder: folderResult.folder };
    },
    onSuccess: ({ project, folder }) => {
      setCreationStep("");
      toast({
        title: "Commessa creata con successo",
        description: `Progetto ${project.code} creato su OneDrive: ${folder?.name}`,
      });
      queryClient.invalidateQueries({ queryKey: QK.projects });
      queryClient.invalidateQueries({ queryKey: QK.clients });
      queryClient.invalidateQueries({ queryKey: QK.onedriveFiles });
      onProjectSaved(project);
    },
    onError: (error: any) => {
      setCreationStep("");
      console.error('Project creation error:', error);

      let errorMessage = "Si è verificato un errore durante la creazione della commessa";
      if (error.message?.includes('OneDrive')) {
        errorMessage = "Errore nella creazione della cartella OneDrive. Verifica la connessione.";
      } else if (error.message?.includes('root folder')) {
        errorMessage = "Cartella radice OneDrive non configurata. Configura nelle impostazioni.";
      }

      toast({
        title: "Errore nella creazione",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Simple project creation without OneDrive
  const createProjectOnlyMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      setCreationStep("Creando commessa nel database...");

      // Include prestazioni data in metadata (classificazioni saved separately after creation)
      const projectData = {
        ...data,
        metadata: {
          ...(typeof data.metadata === 'object' && data.metadata !== null ? data.metadata as Record<string, unknown> : {}),
          prestazioni: prestazioniData.prestazioni,
          livelloProgettazione: prestazioniData.livelloProgettazione,
        }
      };

      const projectResponse = await apiRequest("POST", "/api/projects", projectData);
      const project = await projectResponse.json();

      // Save classificazioni for each prestazione
      const hasClassificazioni = Object.values(classificazioniPerTipo).some(arr => arr.length > 0);
      if (hasClassificazioni) {
        setCreationStep("Salvando classificazioni DM...");
        const prestazioniResponse = await apiRequest("GET", `/api/projects/${project.id}/prestazioni`);
        const prestazioni = await prestazioniResponse.json();

        for (const [tipo, classificazioni] of Object.entries(classificazioniPerTipo)) {
          if (!classificazioni || classificazioni.length === 0) continue;
          const prestazione = prestazioni.find((p: any) => p.tipo === tipo);
          if (!prestazione) continue;

          for (const c of classificazioni) {
            if (!c.codice) continue;
            try {
              await apiRequest("POST", `/api/prestazioni/${prestazione.id}/classificazioni`, {
                codiceDM: c.codice,
                importoOpere: Math.round(c.importoOpere * 100),
                importoServizio: Math.round(c.importoServizio * 100),
              });
            } catch (err) {
              console.error(`Error saving classificazione for ${tipo}:`, err);
            }
          }
        }
      }

      return { project };
    },
    onSuccess: ({ project }) => {
      setCreationStep("");
      toast({
        title: "Commessa creata con successo",
        description: `Progetto ${project.code} creato. Potrai associare OneDrive successivamente.`,
      });
      queryClient.invalidateQueries({ queryKey: QK.projects });
      queryClient.invalidateQueries({ queryKey: QK.clients });
      onProjectSaved(project);
    },
    onError: (error: any) => {
      setCreationStep("");
      console.error('Project creation error:', error);

      toast({
        title: "Errore nella creazione",
        description: "Si è verificato un errore durante la creazione della commessa",
        variant: "destructive",
      });
    },
  });

  const handleGenerateCode = () => {
    const { client, city, year } = form.getValues();
    if (!client || !city || !year) {
      toast({
        title: "Campi mancanti",
        description: "Compilare Cliente, Città e Anno prima di generare il codice",
        variant: "destructive",
      });
      return;
    }

    generateCodeMutation.mutate({ client, city, year });
  };

  const handleNavigateToOneDriveSettings = () => {
    window.location.hash = 'sistema';
  };

  const onSubmitWithOneDrive = (data: FormData) => {
    if (!generatedCode) {
      toast({
        title: "Codice mancante",
        description: "Generare prima il codice commessa",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "OneDrive non connesso",
        description: "Configura OneDrive nelle impostazioni di sistema prima di creare una commessa",
        variant: "destructive",
      });
      return;
    }

    if (!isRootConfigured) {
      toast({
        title: "Cartella radice non configurata",
        description: "Configura la cartella radice OneDrive nelle impostazioni prima di creare una commessa",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate(data);
  };

  const onSubmitWithoutOneDrive = (data: FormData) => {
    if (!generatedCode) {
      toast({
        title: "Codice mancante",
        description: "Generare prima il codice commessa",
        variant: "destructive",
      });
      return;
    }

    createProjectOnlyMutation.mutate(data);
  };

  const handleCreateWithOneDrive = () => {
    form.handleSubmit(onSubmitWithOneDrive)();
  };

  const handleCreateWithoutOneDrive = () => {
    form.handleSubmit(onSubmitWithoutOneDrive)();
  };

  const prestazioniList = getAllPrestazioni();
  const livelliProgettazioneList = getAllLivelliProgettazione();
  // Calcola importo totale opere dalla somma delle classificazioni (tutte le prestazioni)
  const importoTotaleOpere = Object.values(classificazioniPerTipo).flat().reduce((sum, c) => sum + (c.importoOpere || 0), 0);
  const importoTotaleServizio = Object.values(classificazioniPerTipo).flat().reduce((sum, c) => sum + (c.importoServizio || 0), 0);

  return (
    <div className="card-g2" data-testid="new-project-form">
      <h2 className="text-2xl font-bold text-foreground mb-6">Crea Nuova Commessa</h2>

      <form className="space-y-4">
        {/* SEZIONE 1: Dati Base */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('base')}
            className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted transition-colors"
          >
            <span className="font-semibold text-foreground">Dati Base Commessa</span>
            {expandedSections.base ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedSections.base && (
            <div className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="client" className="block text-sm font-medium text-foreground mb-2">
                    Cliente *
                  </Label>
                  <ClientCombobox
                    clients={clients}
                    value={form.watch("client")}
                    onValueChange={(value) => form.setValue("client", value || "")}
                    placeholder="Digita per cercare cliente..."
                    disabled={false}
                    className="input-g2"
                  />
                  {form.formState.errors.client && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.client.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="city" className="block text-sm font-medium text-foreground mb-2">
                    Città *
                  </Label>
                  <Input
                    id="city"
                    placeholder="Es. Milano"
                    className="input-g2"
                    data-testid="input-city"
                    {...form.register("city")}
                  />
                  {form.formState.errors.city && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.city.message}</p>
                  )}
                </div>
              </div>

              {/* Tipo Rapporto */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-2">
                    Tipo Rapporto *
                    <span className="ml-1 text-xs text-muted-foreground font-normal">Chi commissiona a G2?</span>
                  </Label>
                  <Select
                    onValueChange={(value) => form.setValue("tipoRapporto", value as TipoRapportoType)}
                    defaultValue={form.getValues("tipoRapporto")}
                    data-testid="select-tipo-rapporto"
                  >
                    <SelectTrigger className="input-g2">
                      <SelectValue placeholder="Seleziona tipo rapporto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_RAPPORTO_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.label} - {config.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Committente Finale - condizionale */}
                {form.watch("tipoRapporto") && form.watch("tipoRapporto") !== "diretto" && (
                  <div>
                    <Label htmlFor="committente-finale" className="block text-sm font-medium text-foreground mb-2">
                      Committente Finale
                    </Label>
                    <Input
                      id="committente-finale"
                      placeholder="Es. Comune di Roma"
                      className="input-g2"
                      {...form.register("committenteFinale")}
                    />
                  </div>
                )}
              </div>

              {/* Oggetto */}
              <div>
                <Label htmlFor="object" className="block text-sm font-medium text-foreground mb-2">
                  Oggetto Commessa (Abbreviato) *
                  <span className="ml-1 text-xs text-muted-foreground font-normal">Per cartelle e tabella</span>
                </Label>
                <Input
                  id="object"
                  placeholder="Es. Ristrutturazione edificio"
                  className="input-g2"
                  data-testid="input-object"
                  {...form.register("object")}
                />
              </div>

              {/* Oggetto Completo */}
              <div>
                <Label htmlFor="oggettoCompleto" className="block text-sm font-medium text-foreground mb-2">
                  Oggetto Completo
                  <span className="ml-1 text-xs text-muted-foreground font-normal">Descrizione estesa per CRE</span>
                </Label>
                <Input
                  id="oggettoCompleto"
                  placeholder="Es. Ristrutturazione e riqualificazione energetica edificio residenziale in Via..."
                  className="input-g2"
                  {...form.register("oggettoCompleto")}
                />
              </div>

              {/* Anno, Template, Stato */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="year" className="block text-sm font-medium text-foreground mb-2">
                    Anno (AA) *
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="24"
                    className="input-g2"
                    data-testid="input-year"
                    {...form.register("year", { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-2">
                    Template Progetto *
                  </Label>
                  <Select
                    onValueChange={(value) => form.setValue("template", value)}
                    defaultValue={form.getValues("template")}
                  >
                    <SelectTrigger className="input-g2">
                      <SelectValue placeholder="Seleziona template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LUNGO">LUNGO - Progetti complessi</SelectItem>
                      <SelectItem value="BREVE">BREVE - Progetti semplici</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-2">
                    Stato Commessa *
                  </Label>
                  <Select
                    onValueChange={(value) => form.setValue("status", value)}
                    defaultValue={form.getValues("status")}
                  >
                    <SelectTrigger className="input-g2">
                      <SelectValue placeholder="Seleziona stato..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in corso">In Corso</SelectItem>
                      <SelectItem value="conclusa">Conclusa</SelectItem>
                      <SelectItem value="sospesa">Sospesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Codice Commessa */}
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">
                  Codice Commessa
                </Label>
                <div className="flex gap-3">
                  <Input
                    readOnly
                    value={generatedCode}
                    placeholder="Generato automaticamente..."
                    className="flex-1 input-g2 bg-muted text-muted-foreground font-mono"
                    data-testid="input-generated-code"
                  />
                  <Button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={generateCodeMutation.isPending}
                    className="button-g2-primary"
                    data-testid="button-generate-code"
                  >
                    {generateCodeMutation.isPending ? "Generando..." : "Genera"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SEZIONE 2: Dati Contratto */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('contratto')}
            className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted transition-colors"
          >
            <span className="font-semibold text-foreground">Dati Contratto (per CRE)</span>
            {expandedSections.contratto ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedSections.contratto && (
            <div className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="cig" className="block text-sm font-medium text-foreground mb-2">
                    CIG
                    <span className="ml-1 text-xs text-muted-foreground font-normal">Codice Identificativo Gara</span>
                  </Label>
                  <Input
                    id="cig"
                    placeholder="Es. Z2A3B4C5D6"
                    className="input-g2"
                    {...form.register("cig")}
                  />
                </div>
                <div>
                  <Label htmlFor="numeroContratto" className="block text-sm font-medium text-foreground mb-2">
                    N. Contratto
                    <span className="ml-1 text-xs text-muted-foreground font-normal">Numero contratto/accordo</span>
                  </Label>
                  <Input
                    id="numeroContratto"
                    placeholder="Es. 2024/001"
                    className="input-g2"
                    {...form.register("numeroContratto")}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SEZIONE 3: Prestazioni e Classificazioni */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('prestazioni')}
            className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted transition-colors"
          >
            <span className="font-semibold text-foreground">Prestazioni e Classificazioni DM</span>
            {expandedSections.prestazioni ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedSections.prestazioni && (
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                {prestazioniList.map(({ id, config }) => {
                  const isChecked = prestazioniData.prestazioni?.includes(id) || false;
                  const isExpanded = expandedPrestazioni.has(id);
                  const classificazioni = classificazioniPerTipo[id] || [];

                  return (
                    <div key={id}>
                      <div className="flex items-center gap-2 p-2 border border-border rounded-lg hover:bg-muted">
                        <Checkbox
                          id={`prestazione-${id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => handlePrestazioneChange(id, checked as boolean)}
                        />
                        <Label htmlFor={`prestazione-${id}`} className="flex items-center gap-1 cursor-pointer text-sm flex-1">
                          <span>{config.icon}</span>
                          <span>{config.shortLabel}</span>
                          {classificazioni.length > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {classificazioni.length} class. | Serv: {formatImporto(classificazioni.reduce((s, c) => s + (c.importoServizio || 0), 0))}
                            </span>
                          )}
                        </Label>
                        {isChecked && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setExpandedPrestazioni(prev => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              });
                            }}
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>
                        )}
                      </div>

                      {/* Livello Progettazione for progettazione */}
                      {isChecked && id === 'progettazione' && (
                        <div className="ml-6 mt-2 bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <Label className="text-xs font-medium text-foreground mb-2 block">Livello Progettazione</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {livelliProgettazioneList.map(({ id: livId, config: livConfig }) => (
                              <div key={livId} className="flex items-center space-x-2 p-1.5 bg-card border border-blue-200 dark:border-blue-700 rounded-lg">
                                <Checkbox
                                  id={`livello-${livId}`}
                                  checked={prestazioniData.livelloProgettazione?.includes(livId) || false}
                                  onCheckedChange={(checked) => handleLivelloProgettazioneChange(livId, checked as boolean)}
                                />
                                <Label htmlFor={`livello-${livId}`} className="cursor-pointer text-xs">{livConfig.label}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expanded classificazioni area (local state) */}
                      {isChecked && isExpanded && (
                        <div className="ml-6 mt-2 p-3 border border-dashed border-border rounded-lg bg-muted/30 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-muted-foreground">Classificazioni DM 17/06/2016</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => handleAddClassificazioneForTipo(id)}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Aggiungi
                            </Button>
                          </div>

                          {classificazioni.length > 0 ? (
                            <div className="space-y-2">
                              {classificazioni.map((c, index) => (
                                <div key={index} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                                  <Select
                                    value={c.codice}
                                    onValueChange={(value) => handleClassificazioneChangeForTipo(id, index, 'codice', value)}
                                  >
                                    <SelectTrigger className="font-mono text-xs h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                      <SelectGroup>
                                        <SelectLabel>Edilizia</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => data.categoria === 'Edilizia')
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                      <SelectGroup>
                                        <SelectLabel>Strutture</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => data.categoria === 'Strutture')
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                      <SelectGroup>
                                        <SelectLabel>Impianti</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => data.categoria === 'Impianti')
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                      <SelectGroup>
                                        <SelectLabel>Altro</SelectLabel>
                                        {Object.entries(CATEGORIE_DM2016)
                                          .filter(([_, data]) => !['Edilizia', 'Strutture', 'Impianti'].includes(data.categoria))
                                          .map(([codice, data]) => (
                                            <SelectItem key={codice} value={codice} className="text-xs">
                                              <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                            </SelectItem>
                                          ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    placeholder="Opere"
                                    min="0"
                                    step="0.01"
                                    value={c.importoOpere || ''}
                                    onChange={(e) => handleClassificazioneChangeForTipo(id, index, 'importoOpere', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                    className="text-xs h-8"
                                  />
                                  <Input
                                    type="number"
                                    placeholder="Servizio"
                                    min="0"
                                    step="0.01"
                                    value={c.importoServizio || ''}
                                    onChange={(e) => handleClassificazioneChangeForTipo(id, index, 'importoServizio', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                    className="text-xs h-8"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                    onClick={() => handleRemoveClassificazioneForTipo(id, index)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                              <div className="flex justify-end gap-4 text-xs text-muted-foreground pt-1 border-t">
                                <span>Opere: {formatImporto(classificazioni.reduce((s, c) => s + (c.importoOpere || 0), 0))}</span>
                                <span className="font-medium text-primary">Servizio: {formatImporto(classificazioni.reduce((s, c) => s + (c.importoServizio || 0), 0))}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">Nessuna classificazione</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Grand Total */}
              {importoTotaleOpere > 0 || importoTotaleServizio > 0 ? (
                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Totale Commessa Opere:</span>
                    <span className="font-semibold">{formatImporto(importoTotaleOpere)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Totale Commessa Servizio:</span>
                    <span className="font-semibold text-primary">{formatImporto(importoTotaleServizio)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* OneDrive Configuration Status */}
        <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
          <h4 className="font-semibold text-teal-900 dark:text-teal-100 mb-3 flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Stato OneDrive
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-teal-700 dark:text-teal-300">Connessione OneDrive:</span>
              <div className="flex items-center gap-2">
                {isLoadingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                ) : isConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-green-600">Connesso</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-red-600">Non connesso</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-teal-700 dark:text-teal-300">Cartella radice configurata:</span>
              <div className="flex items-center gap-2">
                {isLoadingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                ) : isRootConfigured ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-green-600">{rootConfig?.folderName || 'Configurata'}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-red-600">Non configurata</span>
                  </>
                )}
              </div>
            </div>
            {!isConnected || !isRootConfigured ? (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm mb-2">
                  {!isConnected ? 'OneDrive deve essere connesso' : 'La cartella radice deve essere configurata'} prima di creare una commessa con OneDrive.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNavigateToOneDriveSettings}
                  className="text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configura OneDrive
                </Button>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded">
                <p className="text-green-800 dark:text-green-200 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  OneDrive configurato correttamente. La commessa sarà creata in: <span className="font-mono text-xs">{rootConfig?.folderPath}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Creation Progress */}
        {creationStep && (
          <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
              <span className="font-medium text-teal-900 dark:text-teal-100">{creationStep}</span>
            </div>
          </div>
        )}

        {/* Success State */}
        {createdFolderPath && !createProjectMutation.isPending && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Commessa creata con successo!</h4>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  La cartella è stata creata su OneDrive con la struttura template.
                </p>
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-mono text-green-800 dark:text-green-200">{createdFolderPath}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="border-t pt-6">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleCreateWithOneDrive}
              disabled={createProjectMutation.isPending || createProjectOnlyMutation.isPending || !generatedCode || !isConnected || !isRootConfigured}
              className="px-8 py-3 bg-g2-success text-white rounded-md font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 mr-2" />
                  Crea Commessa OneDrive
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleCreateWithoutOneDrive}
              disabled={createProjectMutation.isPending || createProjectOnlyMutation.isPending || !generatedCode}
              className="px-8 py-3 bg-teal-600 text-white rounded-md font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {createProjectOnlyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Crea Commessa
                </>
              )}
            </Button>

            <Button
              type="reset"
              variant="outline"
              disabled={createProjectMutation.isPending || createProjectOnlyMutation.isPending}
              onClick={() => {
                form.reset();
                setGeneratedCode("");
                setCreationStep("");
                setCreatedFolderPath("");
                setPrestazioniData({
                  prestazioni: [],
                  livelloProgettazione: [],
                });
                setExpandedPrestazioni(new Set());
                setClassificazioniPerTipo({});
              }}
              className="px-8 py-3 border-2 border-border text-foreground rounded-md font-semibold hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancella
            </Button>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p className="mb-2">
              <strong className="text-foreground">Crea Commessa OneDrive:</strong> Crea la commessa con cartella OneDrive automatica
            </p>
            <p>
              <strong className="text-foreground">Crea Commessa:</strong> Crea solo la commessa nel database
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
