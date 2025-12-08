import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { testClaudeConnection } from "@/lib/ai-router";
import { Eye, EyeOff, Check, AlertTriangle, Zap, Brain, Settings } from "lucide-react";
import { z } from "zod";

const aiConfigSchema = z.object({
  apiKey: z.string().min(1, "API Key richiesta"),
  model: z.string().min(1, "Modello richiesto"),
});

type AiConfigForm = z.infer<typeof aiConfigSchema>;

const AI_PROVIDERS = {
  anthropic: {
    name: "Anthropic Claude",
    models: [
      { id: 'claude-4-20250514', name: 'Claude 4.5 (Latest)', tokens: 800 },
      { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', tokens: 800 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tokens: 800 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)', tokens: 400 },
    ],
    features: ['Routing intelligente', 'Analisi documenti', 'Pattern matching'],
    color: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
  },
  deepseek: {
    name: "DeepSeek",
    models: [
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (Ragionamento)', tokens: 800 },
      { id: 'deepseek-chat', name: 'DeepSeek Chat', tokens: 400 },
    ],
    features: ['Chain-of-thought', 'Analisi profonda', 'Ragionamento esteso'],
    color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
  }
};

export default function AiConfigPanelUnified() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'anthropic' | 'deepseek'>('anthropic');
  const { toast } = useToast();

  const [aiConfig, setAiConfig] = useLocalStorage("ai_config", {
    apiKey: "",
    model: "claude-sonnet-4-20250514",
  });

  const form = useForm<AiConfigForm>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: aiConfig,
  });

  useEffect(() => {
    const loadServerConfig = async () => {
      try {
        const response = await fetch('/api/system-config/ai_config');
        if (response.ok) {
          const { value } = await response.json();
          if (value) {
            const mergedConfig = {
              apiKey: aiConfig.apiKey || '',
              model: value.model || aiConfig.model,
            };
            setAiConfig(mergedConfig);
            form.reset(mergedConfig);
            if (mergedConfig.apiKey) checkAiStatus();
            return;
          }
        }
      } catch (error) {
        console.warn('Could not load server config:', error);
      }
      if (aiConfig.apiKey) checkAiStatus();
    };
    loadServerConfig();
  }, []);

  const checkAiStatus = async () => {
    if (!aiConfig.apiKey) return;
    try {
      const connected = await testClaudeConnection(aiConfig.apiKey, aiConfig.model);
      setIsConnected(connected);
      if (connected) setLastSync(new Date().toLocaleString("it-IT"));
    } catch (error) {
      setIsConnected(false);
    }
  };

  const handleTestConnection = async () => {
    const apiKey = form.getValues("apiKey");
    if (!apiKey) {
      toast({ title: "API Key mancante", description: "Inserire prima l'API Key", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      const model = form.getValues("model");
      const connected = await testClaudeConnection(apiKey, model);
      setIsConnected(connected);
      if (connected) {
        setLastSync(new Date().toLocaleString("it-IT"));
        toast({ title: "✅ Connessione riuscita", description: "L'API Key funziona perfettamente" });
      } else {
        toast({ title: "❌ Connessione fallita", description: "Verifica l'API Key", variant: "destructive" });
      }
    } catch (error) {
      setIsConnected(false);
      toast({ title: "Errore", description: "Errore durante il test", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const onSubmit = async (data: AiConfigForm) => {
    try {
      setAiConfig(data);
      const modelToProvider: Record<string, 'anthropic' | 'deepseek'> = {
        'claude-4-20250514': 'anthropic',
        'claude-sonnet-4-20250514': 'anthropic',
        'claude-3-5-sonnet-20241022': 'anthropic',
        'claude-3-haiku-20240307': 'anthropic',
        'deepseek-reasoner': 'deepseek',
        'deepseek-chat': 'deepseek',
      };
      const configToSave = {
        ...data,
        provider: modelToProvider[data.model] || 'anthropic',
      };
      const response = await fetch('/api/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_config', value: configToSave }),
      });
      if (!response.ok) throw new Error('Errore nel salvataggio');
      toast({ title: "✅ Salvato", description: "Configurazione AI salvata con successo" });
      if (data.apiKey) checkAiStatus();
    } catch (error) {
      toast({ title: "❌ Errore", description: "Errore nel salvataggio", variant: "destructive" });
    }
  };

  const currentModel = form.getValues("model");
  const providerInfo = Object.entries(AI_PROVIDERS).find(([_, info]) => 
    info.models.some(m => m.id === currentModel)
  )?.[1];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Brain className="w-6 h-6" />
          Gestione AI Integrata
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configura i provider AI per routing intelligente e revisioni comunicazioni automatiche
        </p>
      </div>

      {/* Status Banner */}
      <div className={`border-l-4 p-4 rounded-lg ${isConnected ? 'bg-green-50 dark:bg-green-950/30 border-green-500' : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-500'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-200">✅ Connesso</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Ultimo test: {lastSync}</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200">⚠️ Non configurato</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Completa la configurazione per attivare le funzionalità AI</p>
                </div>
              </>
            )}
          </div>
          <Button onClick={handleTestConnection} disabled={isTesting} variant="outline" size="sm">
            {isTesting ? "Test..." : "Test Connessione"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="provider" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="provider" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
            <Zap className="w-4 h-4" />
            Provider AI
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
            <Settings className="w-4 h-4" />
            Revisioni Email
          </TabsTrigger>
        </TabsList>

        {/* Provider Configuration Tab */}
        <TabsContent value="provider" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Provider Selection */}
            <div className="card-g2">
              <div className="pb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Seleziona Provider
                </h3>
              </div>
              <div className="space-y-4">
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                  <div key={key} className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedProvider === key
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                  }`} onClick={() => setSelectedProvider(key as any)}>
                    <p className="font-semibold text-gray-900 dark:text-white">{provider.name}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.features.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* API Configuration Form */}
            <div className="card-g2">
              <div className="pb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configurazione</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Inserisci le credenziali API</p>
              </div>
              <div>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* API Key Input */}
                  <div className="space-y-2">
                    <Label className="text-gray-900 dark:text-white">API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        placeholder="sk-... o your-api-key"
                        {...form.register("apiKey")}
                        className="pr-10 dark:bg-gray-800 dark:border-gray-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">🔒 Salvato localmente e crittografato</p>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-gray-900 dark:text-white">Modello AI</Label>
                    <Select
                      value={form.watch("model")}
                      onValueChange={(value) => form.setValue("model", value)}
                    >
                      <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_PROVIDERS[selectedProvider].models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name} ({model.tokens} tokens)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Features Info */}
                  {providerInfo && (
                    <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Funzionalità:</strong> {providerInfo.features.join(" • ")}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full button-g2-primary">
                    Salva Configurazione
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Review Settings Tab */}
        <TabsContent value="review">
          <div className="card-g2">
            <div className="pb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Revisioni Comunicazioni</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Configurazione analisi email e comunicazioni</p>
            </div>
            <div className="space-y-4">
              <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>ℹ️ Revisioni Automatiche:</strong> L'AI analizza tutte le email ricevute e suggerisce automaticamente:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Progetti pertinenti basati sul contenuto</li>
                    <li>Task prioritari derivati da richieste clienti</li>
                    <li>Scadenze importanti e milestone</li>
                    <li>Azioni consigliate per il follow-up</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-3 mt-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">🔄 Provider Utilizzato</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {selectedProvider === 'anthropic' ? 'Claude' : 'DeepSeek'} per analisi email e comunicazioni
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
