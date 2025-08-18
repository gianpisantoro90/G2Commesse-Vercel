import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema, type InsertProject } from "@shared/schema";
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
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client: "",
      city: "",
      object: "",
      year: new Date().getFullYear() % 100,
      template: "LUNGO",
      status: "in_corso",
      code: "",
      fsRoot: null,
      metadata: {},
    },
  });

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

  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: (project) => {
      toast({
        title: "Commessa salvata",
        description: "La commessa è stata salvata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onProjectSaved(project);
    },
    onError: () => {
      toast({
        title: "Errore nel salvataggio",
        description: "Si è verificato un errore durante il salvataggio della commessa",
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

  const handleSelectRootFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      toast({
        title: "API non supportata",
        description: "File System Access API non disponibile in questo browser",
        variant: "destructive",
      });
      return;
    }

    try {
      // @ts-ignore - showDirectoryPicker is not in types yet
      const dirHandle = await showDirectoryPicker({ mode: 'readwrite' });
      setSelectedRootFolder(dirHandle.name);
      form.setValue("fsRoot", dirHandle.name);
    } catch (error) {
      // User cancelled the picker
    }
  };

  const onSubmit = (data: FormData) => {
    if (!generatedCode) {
      toast({
        title: "Codice mancante",
        description: "Generare prima il codice commessa",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate(data);
  };

  return (
    <div className="card-g2" data-testid="new-project-form">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Crea Nuova Commessa</h2>
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="client" className="block text-sm font-semibold text-gray-700 mb-2">
              Cliente *
            </Label>
            <Input
              id="client"
              placeholder="Es. Comune di Milano"
              className="input-g2"
              data-testid="input-client"
              {...form.register("client")}
            />
            {form.formState.errors.client && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.client.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
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
        
        <div>
          <Label htmlFor="object" className="block text-sm font-semibold text-gray-700 mb-2">
            Oggetto Commessa *
          </Label>
          <Input
            id="object"
            placeholder="Descrizione sintetica del progetto"
            className="input-g2"
            data-testid="input-object"
            {...form.register("object")}
          />
          {form.formState.errors.object && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.object.message}</p>
          )}
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="year" className="block text-sm font-semibold text-gray-700 mb-2">
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
            {form.formState.errors.year && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.year.message}</p>
            )}
          </div>
          <div>
            <Label className="block text-sm font-semibold text-gray-700 mb-2">
              Template Progetto *
            </Label>
            <Select
              onValueChange={(value) => form.setValue("template", value)}
              defaultValue={form.getValues("template")}
              data-testid="select-template"
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
            <Label className="block text-sm font-semibold text-gray-700 mb-2">
              Stato Commessa *
            </Label>
            <Select
              onValueChange={(value) => form.setValue("status", value)}
              defaultValue={form.getValues("status")}
              data-testid="select-status"
            >
              <SelectTrigger className="input-g2">
                <SelectValue placeholder="Seleziona stato..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_corso">🟡 In Corso</SelectItem>
                <SelectItem value="conclusa">🟢 Conclusa</SelectItem>
                <SelectItem value="sospesa">🔴 Sospesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label className="block text-sm font-semibold text-gray-700 mb-2">
            Codice Commessa
          </Label>
          <div className="flex gap-3">
            <Input
              readOnly
              value={generatedCode}
              placeholder="Generato automaticamente..."
              className="flex-1 input-g2 bg-gray-50 text-gray-600 font-mono"
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
        
        <div className="border-t pt-6">
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={createProjectMutation.isPending || !generatedCode}
              className="px-8 py-3 bg-g2-success text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              data-testid="button-save-project"
            >
              💾 {createProjectMutation.isPending ? "Salvando..." : "Salva Commessa"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectRootFolder}
              className="button-g2-secondary"
              data-testid="button-select-folder"
            >
              📁 Seleziona Cartella
            </Button>
            <Button
              type="reset"
              variant="outline"
              onClick={() => {
                form.reset();
                setGeneratedCode("");
                setSelectedRootFolder("");
              }}
              className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              data-testid="button-reset-form"
            >
              Cancella
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-3" data-testid="selected-folder-path">
            <span className="font-medium">Cartella selezionata:</span> {selectedRootFolder || "Nessuna cartella selezionata"}
          </p>
        </div>
      </form>
    </div>
  );
}
