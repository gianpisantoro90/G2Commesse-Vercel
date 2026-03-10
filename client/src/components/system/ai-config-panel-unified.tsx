import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { testClaudeConnection } from "@/lib/ai-router";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { QK } from "@/lib/query-utils";
import {
  Eye, EyeOff, Check, AlertTriangle, Zap, Brain, Settings,
  Mail, MessageSquare, Activity, Bell, TrendingUp,
  Shield, Save, BarChart3
} from "lucide-react";
import { z } from "zod";

// ─── Provider / Model config (used by Provider tab) ─────────────────────────

const aiConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1, "Modello richiesto"),
});

type AiConfigForm = z.infer<typeof aiConfigSchema>;

const AI_PROVIDERS = {
  anthropic: {
    name: "Anthropic Claude",
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (Top)', tokens: 200 },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tokens: 200 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Fast)', tokens: 200 },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Legacy)', tokens: 200 },
    ],
    features: ['Routing intelligente', 'Analisi documenti', 'Pattern matching'],
    color: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
  },
  deepseek: {
    name: "DeepSeek",
    models: [
      { id: 'deepseek-reasoner', name: 'DeepSeek V3.2 Reasoner (Ragionamento)', tokens: 128 },
      { id: 'deepseek-chat', name: 'DeepSeek V3.2 Chat', tokens: 128 },
    ],
    features: ['Chain-of-thought', 'Analisi profonda', 'Ragionamento esteso'],
    color: 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800'
  }
};

// ─── Per-feature routing config (used by Feature Routing tab) ────────────────

interface FeatureConfig {
  feature: string;
  provider: 'anthropic' | 'deepseek';
  model: string;
  enabled: boolean;
}

interface AutoApprovalConfig {
  enabled: boolean;
  emailAssignmentThreshold: number;
  taskCreationThreshold: number;
  deadlineCreationThreshold: number;
}

interface FeedbackStats {
  totalFeedback: number;
  approved: number;
  dismissed: number;
  corrected: number;
  approvalRate: string | number;
  avgConfidenceApproved: string;
  byType: Record<string, { approved: number; dismissed: number; corrected: number }>;
}

const FEATURES = [
  { id: 'email_analysis', name: 'Analisi Email', desc: 'Classificazione, matching progetto, estrazione task', icon: Mail },
  { id: 'chat_assistant', name: 'Chat Assistant', desc: 'Chatbot conversazionale con dati sistema', icon: MessageSquare },
  { id: 'project_health', name: 'Salute Progetto', desc: 'Analisi rischio e stato progetti', icon: Activity },
  { id: 'proactive_alerts', name: 'Alert Proattivi', desc: 'Suggerimenti e notifiche intelligenti', icon: Bell },
  { id: 'financial_forecast', name: 'Previsioni Finanziarie', desc: 'Cash flow e previsioni fatturazione', icon: TrendingUp },
];

const PROVIDER_MODELS = {
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Veloce)' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Legacy)' },
  ],
  deepseek: [
    { id: 'deepseek-reasoner', name: 'DeepSeek V3.2 Reasoner' },
    { id: 'deepseek-chat', name: 'DeepSeek V3.2 Chat' },
  ],
};

const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  feature: '',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  enabled: true,
};

// ─── Main unified component ──────────────────────────────────────────────────

export default function AiConfigPanelUnified() {
  const { toast } = useToast();

  // ── Provider tab state ──
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'anthropic' | 'deepseek'>('anthropic');
  const [savedModel, setSavedModel] = useState("claude-sonnet-4-6");
  const [hasServerKey, setHasServerKey] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<{ anthropic: boolean; deepseek: boolean }>({ anthropic: false, deepseek: false });
  const [keySource, setKeySource] = useState<'none' | 'env' | 'db'>('none');

  const form = useForm<AiConfigForm>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      apiKey: "",
      model: savedModel,
    },
  });

  // ── Feature routing tab state ──
  const [featureConfigs, setFeatureConfigs] = useState<FeatureConfig[]>([]);
  const [autoApproval, setAutoApproval] = useState<AutoApprovalConfig>({
    enabled: false,
    emailAssignmentThreshold: 0.95,
    taskCreationThreshold: 0.90,
    deadlineCreationThreshold: 0.90,
  });
  const [isSaving, setIsSaving] = useState(false);

  // ── Queries for feature config / auto-approval / feedback stats ──
  const { data: savedFeatureConfigs } = useQuery<FeatureConfig[]>({
    queryKey: QK.aiFeatureConfigs,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: savedAutoApproval } = useQuery<AutoApprovalConfig>({
    queryKey: QK.aiAutoApproval,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: feedbackStats } = useQuery<FeedbackStats>({
    queryKey: QK.aiFeedbackStats,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // ── Effects ──

  useEffect(() => {
    const loadServerConfig = async () => {
      // 1. Check which providers are available (env vars + DB)
      try {
        const keyStatusRes = await fetch('/api/ai/key-status', { credentials: "include" });
        if (keyStatusRes.ok) {
          const keyStatus = await keyStatusRes.json();
          setAvailableProviders(keyStatus.providers || { anthropic: false, deepseek: false });
        }
      } catch {
        // Could not check key status
      }

      // 2. Load stored DB config (if any)
      let hasDbConfig = false;
      try {
        const response = await fetch('/api/ai/config', { credentials: "include" });
        if (response.ok) {
          const { value } = await response.json();
          if (value) {
            const model = value.model || savedModel;
            setSavedModel(model);
            form.reset({ apiKey: "", model });
            setHasServerKey(true);
            setKeySource('db');
            hasDbConfig = true;
          }
        }
      } catch {
        // Could not load server config
      }

      // 3. Always test connection (works via env vars even without DB config)
      if (!hasDbConfig) {
        setKeySource('env');
      }
      checkAiStatus();
    };
    loadServerConfig();
  }, []);

  useEffect(() => {
    if (savedFeatureConfigs && Array.isArray(savedFeatureConfigs)) {
      setFeatureConfigs(savedFeatureConfigs);
    }
  }, [savedFeatureConfigs]);

  useEffect(() => {
    if (savedAutoApproval) {
      setAutoApproval(savedAutoApproval);
    }
  }, [savedAutoApproval]);

  // ── Provider tab handlers ──

  const checkAiStatus = async () => {
    try {
      const connected = await testClaudeConnection('server-managed', savedModel);
      setIsConnected(connected);
      if (connected) setLastSync(new Date().toLocaleString("it-IT"));
    } catch {
      setIsConnected(false);
    }
  };

  const handleTestConnection = async () => {
    const apiKey = form.getValues("apiKey");
    const hasAnyKey = hasServerKey || availableProviders.anthropic || availableProviders.deepseek;
    const keyToTest = apiKey || (hasAnyKey ? 'server-managed' : '');
    if (!keyToTest) {
      toast({ title: "API Key mancante", description: "Inserire prima l'API Key", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      const model = form.getValues("model");
      const connected = await testClaudeConnection(keyToTest, model);
      setIsConnected(connected);
      if (connected) {
        setLastSync(new Date().toLocaleString("it-IT"));
        toast({ title: "Connessione riuscita", description: "L'API Key funziona perfettamente" });
      } else {
        toast({ title: "Connessione fallita", description: "Verifica l'API Key", variant: "destructive" });
      }
    } catch {
      setIsConnected(false);
      toast({ title: "Errore", description: "Errore durante il test", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const onSubmit = async (data: AiConfigForm) => {
    try {
      setSavedModel(data.model);

      const modelToProvider: Record<string, 'anthropic' | 'deepseek'> = {
        'claude-opus-4-6': 'anthropic',
        'claude-sonnet-4-6': 'anthropic',
        'claude-haiku-4-5-20251001': 'anthropic',
        'claude-sonnet-4-20250514': 'anthropic',
        'deepseek-reasoner': 'deepseek',
        'deepseek-chat': 'deepseek',
      };

      const configToSave = {
        ...data,
        provider: modelToProvider[data.model] || 'anthropic',
      };
      const response = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ value: configToSave }),
      });
      if (!response.ok) throw new Error('Errore nel salvataggio');

      setHasServerKey(true);
      form.setValue("apiKey", "");
      toast({ title: "Salvato", description: "Configurazione AI salvata sul server" });
      checkAiStatus();
    } catch {
      toast({ title: "Errore", description: "Errore nel salvataggio", variant: "destructive" });
    }
  };

  // ── Feature routing helpers ──

  const getFeatureConfig = (featureId: string): FeatureConfig => {
    return featureConfigs.find(fc => fc.feature === featureId) || {
      ...DEFAULT_FEATURE_CONFIG,
      feature: featureId,
    };
  };

  const updateFeatureConfig = (featureId: string, updates: Partial<FeatureConfig>) => {
    setFeatureConfigs(prev => {
      const existing = prev.find(fc => fc.feature === featureId);
      if (existing) {
        return prev.map(fc => fc.feature === featureId ? { ...fc, ...updates } : fc);
      }
      return [...prev, { ...DEFAULT_FEATURE_CONFIG, feature: featureId, ...updates }];
    });
  };

  const saveFeatureConfigs = async () => {
    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/ai/feature-configs", { configs: featureConfigs });
      toast({ title: "Configurazione salvata", description: "Le configurazioni AI per feature sono state aggiornate" });
    } catch {
      toast({ title: "Errore", description: "Errore nel salvataggio", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const saveAutoApproval = async () => {
    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/ai/auto-approval", autoApproval);
      toast({ title: "Configurazione salvata", description: "Soglie auto-approvazione aggiornate" });
    } catch {
      toast({ title: "Errore", description: "Errore nel salvataggio", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Derived values ──

  const currentModel = form.getValues("model");
  const providerInfo = Object.entries(AI_PROVIDERS).find(([_, info]) =>
    info.models.some(m => m.id === currentModel)
  )?.[1];

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Gestione AI Integrata
        </h3>
        <p className="text-muted-foreground">
          Configura provider AI, routing per feature, soglie di auto-approvazione e monitoraggio feedback
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
                  <p className="font-semibold text-green-900 dark:text-green-200">Connesso</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Ultimo test: {lastSync}
                    {keySource === 'env' && " (chiave da variabile d'ambiente)"}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {availableProviders.anthropic && (
                      <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Anthropic Claude
                      </Badge>
                    )}
                    {availableProviders.deepseek && (
                      <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        DeepSeek
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200">Non configurato</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Completa la configurazione per attivare le funzionalita AI</p>
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
        <TabsList className="bg-muted w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="provider" className="flex-1 min-w-[80px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Provider AI</span>
            <span className="sm:hidden">Provider</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="flex-1 min-w-[80px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Routing Feature</span>
            <span className="sm:hidden">Routing</span>
          </TabsTrigger>
          <TabsTrigger value="approval" className="flex-1 min-w-[80px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Auto-Approvazione</span>
            <span className="sm:hidden">Auto</span>
          </TabsTrigger>
          <TabsTrigger value="learning" className="flex-1 min-w-[80px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Apprendimento</span>
            <span className="sm:hidden">Learn</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Provider Configuration ─── */}
        <TabsContent value="provider" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Provider Selection */}
            <div className="card-g2">
              <div className="pb-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Seleziona Provider
                </h3>
              </div>
              <div className="space-y-4">
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => {
                  const isAvailable = availableProviders[key as keyof typeof availableProviders];
                  return (
                    <div key={key} className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedProvider === key
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-border hover:border-gray-300 dark:hover:border-gray-500'
                    }`} onClick={() => setSelectedProvider(key as 'anthropic' | 'deepseek')}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{provider.name}</p>
                        {isAvailable ? (
                          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Attivo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Non configurato
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {provider.features.map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* API Configuration Form */}
            <div className="card-g2">
              <div className="pb-4">
                <h3 className="text-lg font-semibold text-foreground">Configurazione</h3>
                <p className="text-sm text-muted-foreground mt-1">Inserisci le credenziali API</p>
              </div>
              <div>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* API Key Input */}
                  <div className="space-y-2">
                    <Label className="text-foreground">API Key</Label>
                    {keySource === 'env' && availableProviders[selectedProvider] ? (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                            Chiave configurata via variabile d&apos;ambiente
                          </p>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Puoi sovrascriverla inserendo una chiave qui sotto (opzionale)
                        </p>
                      </div>
                    ) : null}
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        placeholder={keySource === 'env' ? "(opzionale — sovrascrive env var)" : "sk-... o your-api-key"}
                        {...form.register("apiKey")}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Salvato in modo sicuro sul server</p>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Modello AI</Label>
                    <Select
                      value={form.watch("model")}
                      onValueChange={(value) => form.setValue("model", value)}
                    >
                      <SelectTrigger>
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
                    <Alert className="bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800">
                      <AlertDescription className="text-sm text-teal-900 dark:text-teal-100">
                        <strong>Funzionalita:</strong> {providerInfo.features.join(" - ")}
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

        {/* ─── Tab 2: Per-Feature Routing ─── */}
        <TabsContent value="features" className="space-y-4">
          <Alert className="bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800">
            <AlertDescription className="text-teal-900 dark:text-teal-100 text-sm">
              Scegli quale provider e modello AI usare per ogni funzionalita. DeepSeek e piu economico per task ad alto volume, Claude offre migliore qualita per analisi complesse e scrittura.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {FEATURES.map(feature => {
              const config = getFeatureConfig(feature.id);
              const Icon = feature.icon;
              return (
                <div key={feature.id} className="card-g2 p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground text-sm">{feature.name}</p>
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(checked) => updateFeatureConfig(feature.id, { enabled: checked })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{feature.desc}</p>
                      </div>
                    </div>

                    {config.enabled && (
                      <div className="flex gap-3 flex-1">
                        <div className="flex-1 min-w-[140px]">
                          <Label className="text-xs text-muted-foreground">Provider</Label>
                          <Select
                            value={config.provider}
                            onValueChange={(v: 'anthropic' | 'deepseek') => {
                              const defaultModel = PROVIDER_MODELS[v][0].id;
                              updateFeatureConfig(feature.id, { provider: v, model: defaultModel });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                              <SelectItem value="deepseek">DeepSeek</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 min-w-[160px]">
                          <Label className="text-xs text-muted-foreground">Modello</Label>
                          <Select
                            value={config.model}
                            onValueChange={(v) => updateFeatureConfig(feature.id, { model: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROVIDER_MODELS[config.provider].map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={saveFeatureConfigs} disabled={isSaving} className="w-full button-g2-primary">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvataggio..." : "Salva Configurazione Routing"}
          </Button>
        </TabsContent>

        {/* ─── Tab 3: Auto-Approval ─── */}
        <TabsContent value="approval" className="space-y-4">
          <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <AlertDescription className="text-amber-900 dark:text-amber-100 text-sm">
              Quando abilitato, i suggerimenti AI con confidenza superiore alla soglia vengono applicati automaticamente senza revisione manuale.
            </AlertDescription>
          </Alert>

          <div className="card-g2 p-4 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Auto-Approvazione</p>
                <p className="text-sm text-muted-foreground">Applica automaticamente suggerimenti ad alta confidenza</p>
              </div>
              <Switch
                checked={autoApproval.enabled}
                onCheckedChange={(checked) => setAutoApproval(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            {autoApproval.enabled && (
              <div className="space-y-6 pt-2 border-t">
                <ThresholdSlider
                  label="Assegnazione email a progetto"
                  description="Soglia confidenza per assegnare automaticamente un'email a un progetto"
                  value={autoApproval.emailAssignmentThreshold}
                  onChange={(v) => setAutoApproval(prev => ({ ...prev, emailAssignmentThreshold: v }))}
                />
                <ThresholdSlider
                  label="Creazione task"
                  description="Soglia confidenza per creare automaticamente un task dai suggerimenti AI"
                  value={autoApproval.taskCreationThreshold}
                  onChange={(v) => setAutoApproval(prev => ({ ...prev, taskCreationThreshold: v }))}
                />
                <ThresholdSlider
                  label="Creazione scadenze"
                  description="Soglia confidenza per creare automaticamente scadenze dai suggerimenti AI"
                  value={autoApproval.deadlineCreationThreshold}
                  onChange={(v) => setAutoApproval(prev => ({ ...prev, deadlineCreationThreshold: v }))}
                />
              </div>
            )}
          </div>

          <Button onClick={saveAutoApproval} disabled={isSaving} className="w-full button-g2-primary">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvataggio..." : "Salva Soglie Auto-Approvazione"}
          </Button>
        </TabsContent>

        {/* ─── Tab 4: Learning Mode ─── */}
        <TabsContent value="learning" className="space-y-4">
          <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <AlertDescription className="text-green-900 dark:text-green-100 text-sm">
              Il Learning Mode traccia le tue approvazioni e rifiuti per migliorare progressivamente la precisione dell'AI.
            </AlertDescription>
          </Alert>

          {feedbackStats ? (
            <div className="space-y-4">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Feedback totali" value={feedbackStats.totalFeedback} />
                <StatCard label="Approvati" value={feedbackStats.approved} color="text-green-600" />
                <StatCard label="Rifiutati" value={feedbackStats.dismissed} color="text-red-500" />
                <StatCard label="Tasso approvazione" value={`${feedbackStats.approvalRate}%`} color="text-teal-600" />
              </div>

              {/* Per-type breakdown */}
              {Object.keys(feedbackStats.byType).length > 0 && (
                <div className="card-g2 p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-3">Dettaglio per tipo</h3>
                  <div className="space-y-2">
                    {Object.entries(feedbackStats.byType).map(([type, stats]) => {
                      const total = stats.approved + stats.dismissed + stats.corrected;
                      const rate = total > 0 ? (stats.approved / total * 100).toFixed(0) : 0;
                      return (
                        <div key={type} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm font-medium capitalize">{type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">{total} feedback</Badge>
                            <span className="text-sm font-semibold">{rate}% approvati</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {feedbackStats.totalFeedback === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nessun feedback registrato</p>
                  <p className="text-sm">Le statistiche appariranno quando inizierai a revisionare i suggerimenti AI nella pagina Revisione AI.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Caricamento statistiche...</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

function ThresholdSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant={value >= 0.95 ? "default" : "secondary"} className="text-sm font-mono">
          {(value * 100).toFixed(0)}%
        </Badge>
      </div>
      <Slider
        value={[value * 100]}
        onValueChange={([v]) => onChange(v / 100)}
        min={50}
        max={100}
        step={5}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>50% (molte auto-approvazioni)</span>
        <span>100% (solo match perfetti)</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card-g2 p-3 text-center">
      <p className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
