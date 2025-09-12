import { useState, useEffect } from "react";
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
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { useOneDriveRootConfig } from "@/hooks/use-onedrive-root-config";
import { Cloud, CheckCircle, AlertCircle, Loader2, FolderOpen, ExternalLink, Settings } from "lucide-react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected } = useOneDriveSync();

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

  // Comprehensive OneDrive project creation mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      // Step 1: Create project in database
      setCreationStep("💾 Creando commessa nel database...");
      const projectResponse = await apiRequest("POST", "/api/projects", data);
      const project = await projectResponse.json();

      // Step 2: Create OneDrive folder with template
      setCreationStep("☁️ Creando cartella OneDrive...");
      const folderResponse = await apiRequest("POST", "/api/onedrive/create-project-folder", {
        projectCode: data.code,
        template: data.template,
        object: data.object // Pass project object for folder naming
      });
      const folderResult = await folderResponse.json();
      
      if (!folderResult.success) {
        throw new Error('Failed to create OneDrive folder');
      }

      // Step 3: Finalize setup
      setCreationStep("✅ Finalizzando configurazione...");
      setCreatedFolderPath(folderResult.folder?.path || '');
      
      return { project, folder: folderResult.folder };
    },
    onSuccess: ({ project, folder }) => {
      setCreationStep("");
      toast({
        title: "Commessa creata con successo",
        description: `Progetto ${project.code} creato su OneDrive: ${folder?.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ['onedrive-files'] });
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
    // Navigate to OneDrive configuration in system settings
    window.location.href = '/#sistema';
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
        
        {/* OneDrive Configuration Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Stato OneDrive
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Connessione OneDrive:</span>
              <div className="flex items-center gap-2">
                {isLoadingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : isConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-green-600" data-testid="onedrive-connection-status">Connesso</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-red-600" data-testid="onedrive-connection-status">Non connesso</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Cartella radice configurata:</span>
              <div className="flex items-center gap-2">
                {isLoadingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : isRootConfigured ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-green-600" data-testid="root-folder-status">
                      {rootConfig?.folderName || 'Configurata'}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-red-600" data-testid="root-folder-status">Non configurata</span>
                  </>
                )}
              </div>
            </div>
            {!isConnected || !isRootConfigured ? (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800 text-sm mb-2">
                  ⚠️ {!isConnected ? 'OneDrive deve essere connesso' : 'La cartella radice deve essere configurata'} prima di creare una commessa.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNavigateToOneDriveSettings}
                  className="text-yellow-800 border-yellow-300"
                  data-testid="button-configure-onedrive"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configura OneDrive
                </Button>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-green-800 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  OneDrive configurato correttamente. La commessa sarà creata in: <span className="font-mono text-xs">{rootConfig?.path}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Creation Progress */}
        {creationStep && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="font-medium text-blue-900" data-testid="creation-progress">{creationStep}</span>
            </div>
          </div>
        )}

        {/* Success State */}
        {createdFolderPath && !createProjectMutation.isPending && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 mb-2">Commessa creata con successo!</h4>
                <p className="text-sm text-green-700 mb-3">
                  La cartella è stata creata su OneDrive con la struttura template.
                </p>
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-mono text-green-800" data-testid="created-folder-path">{createdFolderPath}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-6">
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={createProjectMutation.isPending || !generatedCode || !isConnected || !isRootConfigured}
              className="px-8 py-3 bg-g2-success text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              data-testid="button-save-project"
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
              type="reset"
              variant="outline"
              disabled={createProjectMutation.isPending}
              onClick={() => {
                form.reset();
                setGeneratedCode("");
                setCreationStep("");
                setCreatedFolderPath("");
              }}
              className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              data-testid="button-reset-form"
            >
              Cancella
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
