import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, RefreshCw, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BillingConfigData {
  alert_completata_giorni: number;
  alert_scadenza_fattura_giorni: number;
  alert_pagamento_giorni: number;
  auto_sync_prestazioni: number;
  auto_data_inizio: number;
}

export function BillingConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<BillingConfigData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch config
  const { data: config, isLoading } = useQuery<BillingConfigData>({
    queryKey: ["/api/billing-config"],
    queryFn: async () => {
      const res = await fetch('/api/billing-config', { credentials: 'include' });
      if (!res.ok) throw new Error('Errore nel caricamento configurazione');
      const data = await res.json();
      setLocalConfig(data);
      return data;
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<BillingConfigData>) => {
      const promises = Object.entries(updates).map(([key, value]) =>
        fetch(`/api/billing-config/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
          credentials: 'include',
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-config"] });
      setHasChanges(false);
      toast({ title: "Configurazione salvata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare la configurazione", variant: "destructive" });
    },
  });

  const handleChange = (key: keyof BillingConfigData, value: number) => {
    if (localConfig) {
      setLocalConfig({ ...localConfig, [key]: value });
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    if (localConfig) {
      saveMutation.mutate(localConfig);
    }
  };

  const handleReset = () => {
    if (config) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  };

  // Sync prestazioni mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/sync-prestazioni', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Errore nella sincronizzazione');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestazioni"] });
      toast({
        title: "Sincronizzazione completata",
        description: `Creati ${data.created} nuovi record in ${data.synced} progetti`,
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile sincronizzare le prestazioni", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurazione Alert
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!localConfig) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurazione Alert Fatturazione
            </CardTitle>
            <CardDescription>
              Configura le soglie per la generazione automatica degli alert
            </CardDescription>
          </div>
          {hasChanges && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Annulla
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Soglie Alert */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Soglie Alert (giorni)</h4>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="alert_completata">
                Prestazione completata
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="alert_completata"
                  type="number"
                  min="1"
                  max="365"
                  value={localConfig.alert_completata_giorni}
                  onChange={(e) => handleChange('alert_completata_giorni', parseInt(e.target.value) || 15)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">giorni</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alert se completata ma non fatturata dopo N giorni
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert_scadenza">
                Scadenza fattura
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="alert_scadenza"
                  type="number"
                  min="1"
                  max="365"
                  value={localConfig.alert_scadenza_fattura_giorni}
                  onChange={(e) => handleChange('alert_scadenza_fattura_giorni', parseInt(e.target.value) || 30)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">giorni</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Scadenza default fattura dopo emissione
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert_pagamento">
                Pagamento in ritardo
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="alert_pagamento"
                  type="number"
                  min="1"
                  max="365"
                  value={localConfig.alert_pagamento_giorni}
                  onChange={(e) => handleChange('alert_pagamento_giorni', parseInt(e.target.value) || 60)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">giorni</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alert se fattura emessa ma non pagata dopo N giorni
              </p>
            </div>
          </div>
        </div>

        {/* Automazioni */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium text-sm text-foreground">Automazioni</h4>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto_sync">Sincronizzazione prestazioni</Label>
                <p className="text-sm text-muted-foreground">
                  Sincronizza automaticamente le prestazioni da metadata a tabella
                </p>
              </div>
              <Switch
                id="auto_sync"
                checked={localConfig.auto_sync_prestazioni === 1}
                onCheckedChange={(checked) => handleChange('auto_sync_prestazioni', checked ? 1 : 0)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto_data">Data inizio automatica</Label>
                <p className="text-sm text-muted-foreground">
                  Imposta automaticamente la data inizio commessa alla creazione
                </p>
              </div>
              <Switch
                id="auto_data"
                checked={localConfig.auto_data_inizio === 1}
                onCheckedChange={(checked) => handleChange('auto_data_inizio', checked ? 1 : 0)}
              />
            </div>

            {/* Sync manuale */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="space-y-0.5">
                <Label>Sincronizza prestazioni</Label>
                <p className="text-sm text-muted-foreground">
                  Forza la sincronizzazione delle prestazioni da metadata per tutti i progetti
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <Database className="h-4 w-4 mr-1" />
                {syncMutation.isPending ? "Sincronizzando..." : "Sincronizza ora"}
              </Button>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm">
          <p className="font-medium text-blue-800 dark:text-blue-200">Come funziona</p>
          <ul className="mt-2 space-y-1 text-blue-700 dark:text-blue-300 list-disc list-inside">
            <li>Il sistema controlla automaticamente ogni ora</li>
            <li>Genera alert quando le soglie vengono superate</li>
            <li>Gli alert vengono risolti automaticamente quando l'azione viene completata</li>
            <li>Puoi forzare un controllo manuale con il pulsante "Aggiorna" negli alert</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default BillingConfig;
