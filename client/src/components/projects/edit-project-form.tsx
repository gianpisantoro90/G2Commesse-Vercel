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
import { QK } from "@/lib/query-utils";
import { insertProjectSchema, type Project, type InsertProject, type Client, type ProjectPrestazioni, type ProjectMetadata } from "@shared/schema";
import {
  TIPO_RAPPORTO_CONFIG,
  type TipoRapportoType,
  getAllPrestazioni,
  getAllLivelliProgettazione,
  formatImporto
} from "@/lib/prestazioni-utils";
import { CATEGORIE_DM2016 } from "@/lib/parcella-calculator";
import { ClientCombobox } from "@/components/ui/client-combobox";
import { ChevronDown, ChevronUp, Plus, Trash2, Loader2, Copy } from "lucide-react";
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
    health: false,
  });
  const [expandedPrestazioni, setExpandedPrestazioni] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State per prestazioni (classificazioni are now managed via API)
  const [prestazioniData, setPrestazioniData] = useState<ProjectPrestazioni>({
    prestazioni: [],
    livelloProgettazione: [],
  });

  // Fetch existing prestazioni from DB for this project
  const { data: dbPrestazioni = [] } = useQuery({
    queryKey: QK.projectPrestazioni(project.id),
    queryFn: () => apiRequest("GET", `/api/projects/${project.id}/prestazioni`).then(r => r.json()),
    enabled: open,
  });

  // Fetch existing classificazioni from DB for this project
  const { data: dbClassificazioni = [], refetch: refetchClassificazioni } = useQuery({
    queryKey: QK.projectClassificazioni(project.id),
    queryFn: () => apiRequest("GET", `/api/projects/${project.id}/classificazioni`).then(r => r.json()),
    enabled: open,
  });

  // Fetch existing clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: QK.clients,
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

  // Mutations for classificazioni CRUD (real-time, not on form save)
  const invalidateAfterClassificazione = () => {
    refetchClassificazioni();
    queryClient.invalidateQueries({ queryKey: QK.projectPrestazioni(project.id) });
    queryClient.invalidateQueries({ queryKey: QK.projects });
  };

  const createClassificazioneMutation = useMutation({
    mutationFn: async ({ prestazioneId, data }: { prestazioneId: string; data: any }) => {
      const response = await apiRequest("POST", `/api/prestazioni/${prestazioneId}/classificazioni`, data);
      return response.json();
    },
    onSuccess: invalidateAfterClassificazione,
    onError: () => {
      toast({ title: "Errore", description: "Classificazione già presente o dati non validi", variant: "destructive" });
      invalidateAfterClassificazione();
    },
  });

  const updateClassificazioneMutation = useMutation({
    mutationFn: async ({ prestazioneId, classId, data }: { prestazioneId: string; classId: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/prestazioni/${prestazioneId}/classificazioni/${classId}`, data);
      return response.json();
    },
    onSuccess: invalidateAfterClassificazione,
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare: classificazione già presente", variant: "destructive" });
      invalidateAfterClassificazione();
    },
  });

  const deleteClassificazioneMutation = useMutation({
    mutationFn: async ({ prestazioneId, classId }: { prestazioneId: string; classId: string }) => {
      await apiRequest("DELETE", `/api/prestazioni/${prestazioneId}/classificazioni/${classId}`);
    },
    onSuccess: invalidateAfterClassificazione,
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la classificazione", variant: "destructive" });
    },
  });

  const copyClassificazioniMutation = useMutation({
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

  // Helper: find the DB prestazione record for a given tipo
  const getDbPrestazioneByTipo = (tipo: string) => {
    return dbPrestazioni.find((p: any) => p.tipo === tipo);
  };

  // Helper: get classificazioni for a specific prestazione
  const getClassificazioniForPrestazione = (prestazioneId: string) => {
    return dbClassificazioni.filter((c: any) => c.prestazioneId === prestazioneId);
  };

  const updateProjectMutation = useMutation({
    mutationFn: async (data: Partial<InsertProject>) => {
      // classificazioniDM2016 is managed by syncProjectMetadataFromClassificazioni on the backend
      // Do NOT include it here — it would overwrite with stale data from the form's initial load
      const existingMetadata = typeof data.metadata === 'object' && data.metadata !== null ? data.metadata as Record<string, unknown> : {};
      const { classificazioniDM2016: _ignored, ...restMetadata } = existingMetadata as any;
      const projectData = {
        ...data,
        metadata: {
          ...restMetadata,
          prestazioni: prestazioniData.prestazioni,
          livelloProgettazione: prestazioniData.livelloProgettazione,
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
      queryClient.invalidateQueries({ queryKey: QK.projects });
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

      setPrestazioniData({
        prestazioni: metadata?.prestazioni || [],
        livelloProgettazione: metadata?.livelloProgettazione || [],
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
        metadata: project.metadata || {},
      });
    }
  }, [open, project, form]);

  const prestazioniList = getAllPrestazioni();
  const livelliProgettazioneList = getAllLivelliProgettazione();

  // Compute totals from DB classificazioni (amounts in euro)
  const importoTotaleOpere = dbClassificazioni.reduce((sum: number, c: any) => sum + (c.importoOpere || 0), 0);
  const importoTotaleServizio = dbClassificazioni.reduce((sum: number, c: any) => sum + (c.importoServizio || 0), 0);

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

            {/* SEZIONE 3: Prestazioni e Classificazioni */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('prestazioni')}
                className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted transition-colors"
              >
                <span className="font-semibold text-foreground text-sm">Prestazioni e Classificazioni DM</span>
                {expandedSections.prestazioni ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandedSections.prestazioni && (
                <div className="p-4 space-y-3">
                  {/* Checkbox grid for prestazione types */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {prestazioniList.map(({ id, config }) => {
                      const isChecked = prestazioniData.prestazioni?.includes(id) || false;
                      const dbPrestazione = getDbPrestazioneByTipo(id);
                      const isExpanded = expandedPrestazioni.has(id);
                      const classificazioni = dbPrestazione ? getClassificazioniForPrestazione(dbPrestazione.id) : [];

                      return (
                        <div key={id} className="col-span-full">
                          <div className="flex items-center gap-2 p-2 border border-border rounded-lg hover:bg-muted">
                            <Checkbox
                              id={`edit-prestazione-${id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => handlePrestazioneChange(id, checked as boolean)}
                            />
                            <Label htmlFor={`edit-prestazione-${id}`} className="flex items-center gap-1 cursor-pointer text-xs flex-1">
                              <span>{config.icon}</span>
                              <span>{config.shortLabel}</span>
                              {classificazioni.length > 0 && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {classificazioni.length} class. | Serv: {formatImporto(classificazioni.reduce((s: number, c: any) => s + (c.importoServizio || 0), 0))}
                                </span>
                              )}
                            </Label>
                            {isChecked && dbPrestazione && (
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

                          {/* Livello Progettazione (for progettazione only) */}
                          {isChecked && id === 'progettazione' && (
                            <div className="ml-6 mt-2 bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                              <Label className="text-xs font-medium text-foreground mb-2 block">Livello Progettazione</Label>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {livelliProgettazioneList.map(({ id: livId, config: livConfig }) => (
                                  <div key={livId} className="flex items-center space-x-2 p-1.5 bg-card border border-blue-200 dark:border-blue-700 rounded-lg">
                                    <Checkbox
                                      id={`edit-livello-${livId}`}
                                      checked={prestazioniData.livelloProgettazione?.includes(livId) || false}
                                      onCheckedChange={(checked) => handleLivelloProgettazioneChange(livId, checked as boolean)}
                                    />
                                    <Label htmlFor={`edit-livello-${livId}`} className="cursor-pointer text-xs">{livConfig.label}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Expanded classificazioni area */}
                          {isChecked && isExpanded && dbPrestazione && (
                            <div className="ml-6 mt-2 p-3 border border-dashed border-border rounded-lg bg-muted/30 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-muted-foreground">Classificazioni DM 17/06/2016</span>
                                <div className="flex items-center gap-1">
                                  {/* Copia da altra prestazione */}
                                  {(() => {
                                    const otherWithClass = dbPrestazioni.filter((p: any) =>
                                      p.id !== dbPrestazione.id && getClassificazioniForPrestazione(p.id).length > 0
                                    );
                                    if (otherWithClass.length === 0) return null;
                                    return (
                                      <Select
                                        value=""
                                        onValueChange={(fromId) => {
                                          copyClassificazioniMutation.mutate({ fromId, toId: dbPrestazione.id });
                                        }}
                                      >
                                        <SelectTrigger className="h-6 text-xs px-2 w-auto gap-1">
                                          <Copy className="w-3 h-3" />
                                          <span>Copia da...</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {otherWithClass.map((p: any) => {
                                            const pConfig = prestazioniList.find(pl => pl.id === p.tipo)?.config;
                                            const pClass = getClassificazioniForPrestazione(p.id);
                                            return (
                                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                                {pConfig?.icon} {pConfig?.shortLabel || p.tipo}
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
                                      const usedCodes = classificazioni.map((c: any) => c.codiceDM);
                                      const allCodes = Object.keys(CATEGORIE_DM2016);
                                      const firstAvailable = allCodes.find(code => !usedCodes.includes(code)) || 'E.01';
                                      createClassificazioneMutation.mutate({
                                        prestazioneId: dbPrestazione.id,
                                        data: { codiceDM: firstAvailable, importoOpere: 0, importoServizio: 0 },
                                      });
                                    }}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Aggiungi
                                  </Button>
                                </div>
                              </div>

                              {classificazioni.length > 0 ? (
                                <div className="space-y-2">
                                  {classificazioni.map((c: any) => {
                                    // Codici già usati da ALTRE classificazioni di questa prestazione (esclusa la corrente)
                                    const usedByOthers = classificazioni
                                      .filter((other: any) => other.id !== c.id)
                                      .map((other: any) => other.codiceDM);
                                    return (
                                    <div key={c.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                                      <Select
                                        value={c.codiceDM}
                                        onValueChange={(value) => {
                                          updateClassificazioneMutation.mutate({
                                            prestazioneId: dbPrestazione.id,
                                            classId: c.id,
                                            data: { codiceDM: value },
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="font-mono text-xs h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                          <SelectGroup>
                                            <SelectLabel>Edilizia</SelectLabel>
                                            {Object.entries(CATEGORIE_DM2016)
                                              .filter(([codice, data]) => data.categoria === 'Edilizia' && (codice === c.codiceDM || !usedByOthers.includes(codice)))
                                              .map(([codice, data]) => (
                                                <SelectItem key={codice} value={codice} className="text-xs">
                                                  <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                                </SelectItem>
                                              ))}
                                          </SelectGroup>
                                          <SelectGroup>
                                            <SelectLabel>Strutture</SelectLabel>
                                            {Object.entries(CATEGORIE_DM2016)
                                              .filter(([codice, data]) => data.categoria === 'Strutture' && (codice === c.codiceDM || !usedByOthers.includes(codice)))
                                              .map(([codice, data]) => (
                                                <SelectItem key={codice} value={codice} className="text-xs">
                                                  <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                                </SelectItem>
                                              ))}
                                          </SelectGroup>
                                          <SelectGroup>
                                            <SelectLabel>Impianti</SelectLabel>
                                            {Object.entries(CATEGORIE_DM2016)
                                              .filter(([codice, data]) => data.categoria === 'Impianti' && (codice === c.codiceDM || !usedByOthers.includes(codice)))
                                              .map(([codice, data]) => (
                                                <SelectItem key={codice} value={codice} className="text-xs">
                                                  <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                                </SelectItem>
                                              ))}
                                          </SelectGroup>
                                          <SelectGroup>
                                            <SelectLabel>Altro</SelectLabel>
                                            {Object.entries(CATEGORIE_DM2016)
                                              .filter(([codice, data]) => !['Edilizia', 'Strutture', 'Impianti'].includes(data.categoria) && (codice === c.codiceDM || !usedByOthers.includes(codice)))
                                              .map(([codice, data]) => (
                                                <SelectItem key={codice} value={codice} className="text-xs">
                                                  <span className="font-mono">{codice}</span> - {data.descrizione.substring(0, 35)}
                                                </SelectItem>
                                              ))}
                                          </SelectGroup>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        key={`opere-${c.id}-${c.importoOpere}`}
                                        type="number"
                                        placeholder="Opere"
                                        min="0"
                                        step="0.01"
                                        defaultValue={c.importoOpere || ''}
                                        onBlur={(e) => {
                                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                          if (val !== c.importoOpere) {
                                            updateClassificazioneMutation.mutate({
                                              prestazioneId: dbPrestazione.id,
                                              classId: c.id,
                                              data: { importoOpere: val },
                                            });
                                          }
                                        }}
                                        className="text-xs h-8"
                                      />
                                      <Input
                                        key={`servizio-${c.id}-${c.importoServizio}`}
                                        type="number"
                                        placeholder="Servizio"
                                        min="0"
                                        step="0.01"
                                        defaultValue={c.importoServizio || ''}
                                        onBlur={(e) => {
                                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                          if (val !== c.importoServizio) {
                                            updateClassificazioneMutation.mutate({
                                              prestazioneId: dbPrestazione.id,
                                              classId: c.id,
                                              data: { importoServizio: val },
                                            });
                                          }
                                        }}
                                        className="text-xs h-8"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        onClick={() => {
                                          deleteClassificazioneMutation.mutate({
                                            prestazioneId: dbPrestazione.id,
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
                                    <span>Opere: {formatImporto(classificazioni.reduce((s: number, c: any) => s + (c.importoOpere || 0), 0))}</span>
                                    <span className="font-medium text-primary">Servizio: {formatImporto(classificazioni.reduce((s: number, c: any) => s + (c.importoServizio || 0), 0))}</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-2">Nessuna classificazione</p>
                              )}
                            </div>
                          )}

                          {/* Message for newly checked prestazione not yet in DB */}
                          {isChecked && !dbPrestazione && (
                            <p className="ml-6 mt-1 text-xs text-amber-600">Salva la commessa per aggiungere classificazioni a questa prestazione</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Grand Total */}
                  {dbClassificazioni.length > 0 && (
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
