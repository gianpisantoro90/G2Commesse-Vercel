import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema, type Project, type InsertProject } from "@shared/schema";
import { TIPO_RAPPORTO_CONFIG, type TipoRapportoType } from "@/lib/prestazioni-utils";

interface EditProjectFormProps {
  project: Project;
  children: React.ReactNode;
}

export default function EditProjectForm({ project, children }: EditProjectFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      code: project.code,
      client: project.client,
      city: project.city,
      object: project.object,
      year: project.year,
      template: project.template,
      status: project.status,
      tipoRapporto: project.tipoRapporto || "diretto",
      committenteFinale: project.committenteFinale || undefined,
      fsRoot: project.fsRoot || undefined,
      metadata: project.metadata || {},
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: Partial<InsertProject>) => {
      const response = await apiRequest("PUT", `/api/projects/${project.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Commessa aggiornata",
        description: "La commessa è stata aggiornata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setOpen(false);
      form.reset();
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
      form.reset({
        code: project.code,
        client: project.client,
        city: project.city,
        object: project.object,
        year: project.year,
        template: project.template,
        status: project.status,
        tipoRapporto: project.tipoRapporto || "diretto",
        committenteFinale: project.committenteFinale || undefined,
        fsRoot: project.fsRoot || undefined,
        metadata: project.metadata || {},
      });
    }
  }, [open, project, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifica Commessa - {project.code}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Codice Commessa</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-project-code" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="client"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-project-client" />
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
            
            <FormField
              control={form.control}
              name="tipoRapporto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tipo Rapporto
                    <span className="ml-1 text-xs text-gray-500 font-normal">Chi commissiona a G2?</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="edit-project-tipo-rapporto">
                        <SelectValue placeholder="Seleziona tipo rapporto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(TIPO_RAPPORTO_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.label} - {config.description}
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
                    <FormLabel>
                      Committente Finale
                      <span className="ml-1 text-xs text-gray-500 font-normal">Proprietario/Ente finale dell'opera</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="edit-project-committente-finale" placeholder="Es. Comune di Roma, Privato, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="object"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Oggetto</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-project-object" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
                      data-testid="edit-project-year"
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
                      <SelectTrigger data-testid="edit-project-template">
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
                      <SelectTrigger data-testid="edit-project-status">
                        <SelectValue placeholder="Seleziona stato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="in_corso">🟡 In Corso</SelectItem>
                      <SelectItem value="conclusa">🟢 Conclusa</SelectItem>
                      <SelectItem value="sospesa">🔴 Sospesa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-3 pt-4">
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
                {updateProjectMutation.isPending ? "Salvando..." : "Salva Modifiche"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}