import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { testClaudeConnection } from "@/lib/ai-router";
import { z } from "zod";

const aiConfigSchema = z.object({
  apiKey: z.string().min(1, "API Key richiesta"),
  model: z.string().min(1, "Modello richiesto"),
  autoRouting: z.boolean(),
  contentAnalysis: z.boolean(),
  learningMode: z.boolean(),
});

type AiConfigForm = z.infer<typeof aiConfigSchema>;

export default function AiConfigPanel() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const [aiConfig, setAiConfig] = useLocalStorage("ai_config", {
    apiKey: "",
    model: "claude-3-sonnet-20240229",
    autoRouting: true,
    contentAnalysis: true,
    learningMode: true,
  });

  const form = useForm<AiConfigForm>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: aiConfig,
  });

  useEffect(() => {
    // Load current config and update form
    const currentConfig = {
      ...aiConfig,
      apiKey: aiConfig.apiKey ? atob(aiConfig.apiKey) : '' // Decode for display
    };
    form.reset(currentConfig);
    
    // Check AI status on load
    if (aiConfig.apiKey) {
      checkAiStatus();
    }
  }, [aiConfig]);  // Add aiConfig dependency

  const checkAiStatus = async () => {
    if (!aiConfig.apiKey) return;
    
    try {
      // Decode the stored API key before testing
      const decodedKey = atob(aiConfig.apiKey);
      const connected = await testClaudeConnection(decodedKey);
      setIsConnected(connected);
      if (connected) {
        setLastSync(new Date().toLocaleString("it-IT"));
      }
    } catch (error) {
      console.error('Error checking AI status:', error);
      setIsConnected(false);
    }
  };

  const handleTestConnection = async () => {
    const apiKey = form.getValues("apiKey");
    if (!apiKey) {
      toast({
        title: "API Key mancante",
        description: "Inserire prima l'API Key",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const connected = await testClaudeConnection(apiKey);
      setIsConnected(connected);
      
      if (connected) {
        setLastSync(new Date().toLocaleString("it-IT"));
        toast({
          title: "Connessione riuscita",
          description: "L'API Key è valida e la connessione funziona",
        });
      } else {
        toast({
          title: "Connessione fallita",
          description: "L'API Key non è valida o il servizio non è disponibile",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsConnected(false);
      toast({
        title: "Errore di connessione",
        description: "Si è verificato un errore durante il test della connessione",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const onSubmit = (data: AiConfigForm) => {
    // Encode API key for storage
    const configToSave = {
      ...data,
      apiKey: data.apiKey ? btoa(data.apiKey) : "",
    };
    
    setAiConfig(configToSave);
    
    toast({
      title: "Configurazione salvata",
      description: "Le impostazioni AI sono state salvate con successo",
    });

    // Test connection after saving
    if (data.apiKey) {
      checkAiStatus();
    }
  };

  const handleResetConfig = () => {
    if (confirm("Sei sicuro di voler ripristinare la configurazione AI?")) {
      form.reset({
        apiKey: "",
        model: "claude-3-sonnet-20240229",
        autoRouting: true,
        contentAnalysis: true,
        learningMode: true,
      });
      setAiConfig({
        apiKey: "",
        model: "claude-3-sonnet-20240229",
        autoRouting: true,
        contentAnalysis: true,
        learningMode: true,
      });
      setIsConnected(false);
      setLastSync("");
      
      toast({
        title: "Configurazione ripristinata",
        description: "La configurazione AI è stata ripristinata ai valori predefiniti",
      });
    }
  };

  return (
    <div className="max-w-2xl" data-testid="ai-config-panel">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">🤖 Configurazione AI</h3>
      
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✨</span>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Integrazione Claude AI</h4>
            <p className="text-gray-600 text-sm">
              Configura l'integrazione con Claude AI per funzionalità avanzate di routing e analisi documenti.
            </p>
          </div>
        </div>
      </div>
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Label htmlFor="apiKey" className="block text-sm font-semibold text-gray-700 mb-2">
            API Key Claude
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? "text" : "password"}
              placeholder="sk-ant-api..."
              className="input-g2 pr-12 font-mono"
              data-testid="input-api-key"
              {...form.register("apiKey")}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              onClick={() => setShowApiKey(!showApiKey)}
              data-testid="toggle-api-key-visibility"
            >
              {showApiKey ? "🙈" : "👁️"}
            </Button>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            🔒 La chiave API viene memorizzata localmente e crittografata
          </div>
          {form.formState.errors.apiKey && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.apiKey.message}</p>
          )}
        </div>
        
        <div>
          <Label className="block text-sm font-semibold text-gray-700 mb-2">
            Modello AI
          </Label>
          <Select
            onValueChange={(value) => form.setValue("model", value)}
            defaultValue={form.getValues("model")}
            data-testid="select-ai-model"
          >
            <SelectTrigger className="input-g2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku (Veloce, Economico)</SelectItem>
              <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet (Bilanciato)</SelectItem>
              <SelectItem value="claude-3-opus-20240229">Claude 3 Opus (Massima qualità)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="block text-sm font-semibold text-gray-700 mb-2">
            Configurazione Avanzata
          </Label>
          <div className="space-y-4 bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Routing Automatico</div>
                <div className="text-sm text-gray-600">Attiva suggerimenti automatici per file</div>
              </div>
              <Switch
                checked={form.watch("autoRouting")}
                onCheckedChange={(checked) => form.setValue("autoRouting", checked)}
                data-testid="switch-auto-routing"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Analisi Contenuto</div>
                <div className="text-sm text-gray-600">Scansiona contenuto documenti per classificazione</div>
              </div>
              <Switch
                checked={form.watch("contentAnalysis")}
                onCheckedChange={(checked) => form.setValue("contentAnalysis", checked)}
                data-testid="switch-content-analysis"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Learning Mode</div>
                <div className="text-sm text-gray-600">Impara dalle tue correzioni</div>
              </div>
              <Switch
                checked={form.watch("learningMode")}
                onCheckedChange={(checked) => form.setValue("learningMode", checked)}
                data-testid="switch-learning-mode"
              />
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 pt-6 border-t">
          <Button
            type="submit"
            className="px-6 py-3 bg-g2-success text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
            data-testid="save-ai-config"
          >
            💾 Salva Configurazione
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="button-g2-secondary"
            data-testid="test-ai-connection"
          >
            {isTesting ? "🔄 Testando..." : "🔍 Testa Connessione"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleResetConfig}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            data-testid="reset-ai-config"
          >
            🔄 Reset
          </Button>
        </div>
      </form>
      
      {/* AI Status */}
      <div className={`mt-8 rounded-xl border p-4 ${
        isConnected 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`} data-testid="ai-status">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-g2-success animate-pulse' : 'bg-red-500'
          }`}></span>
          <span className={`font-semibold ${
            isConnected ? 'text-green-900' : 'text-red-900'
          }`}>
            {isConnected ? 'AI Attivo' : 'AI Non Connesso'}
          </span>
        </div>
        {isConnected && lastSync && (
          <div className="mt-2 text-sm text-green-700">
            Ultima sincronizzazione: <span data-testid="last-sync">{lastSync}</span>
          </div>
        )}
      </div>
    </div>
  );
}
