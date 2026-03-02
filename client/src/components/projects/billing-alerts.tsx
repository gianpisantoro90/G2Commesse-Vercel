import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  X,
  RefreshCw,
  ChevronRight,
  Euro,
  FileText,
  Play,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "wouter";
import { QK } from "@/lib/query-utils";

interface BillingAlert {
  id: string;
  projectId: string;
  prestazioneId?: string;
  invoiceId?: string;
  alertType: 'completata_non_fatturata' | 'fattura_scaduta' | 'pagamento_ritardo';
  daysOverdue: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  message?: string;
  dismissedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  project?: {
    id: string;
    code: string;
    client: string;
    object: string;
  };
  prestazione?: {
    id: string;
    tipo: string;
    livelloProgettazione?: string;
    stato: string;
  };
  invoice?: {
    id: string;
    numeroFattura: string;
    importoTotale: number;
    stato: string;
  };
}

interface AlertStats {
  totale: number;
  completateNonFatturate: number;
  fattureScadute: number;
  pagamentiInRitardo: number;
}

const ALERT_TYPE_CONFIG = {
  completata_non_fatturata: {
    label: 'Da fatturare',
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    actionLabel: 'Fattura',
    actionIcon: Euro,
  },
  fattura_scaduta: {
    label: 'Fattura scaduta',
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    actionLabel: 'Incassa',
    actionIcon: CheckCircle,
  },
  pagamento_ritardo: {
    label: 'Pagamento in ritardo',
    icon: Clock,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    actionLabel: 'Incassa',
    actionIcon: CheckCircle,
  },
};

const PRIORITY_CONFIG = {
  low: { label: 'Bassa', color: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground' },
  medium: { label: 'Media', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' },
};

const PRESTAZIONE_LABELS: Record<string, string> = {
  progettazione: 'Progettazione',
  dl: 'Dir. Lavori',
  csp: 'CSP',
  cse: 'CSE',
  contabilita: 'Contabilita',
  collaudo: 'Collaudo',
  perizia: 'Perizia',
  pratiche: 'Pratiche',
};

interface BillingAlertsProps {
  projectId?: string;
  maxAlerts?: number;
  showStats?: boolean;
  compact?: boolean;
  onNavigate?: (projectId: string, tab: string, searchTerm?: string) => void;
}

export function BillingAlerts({
  projectId,
  maxAlerts = 5,
  showStats = true,
  compact = false,
  onNavigate,
}: BillingAlertsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  // Fetch alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<BillingAlert[]>({
    queryKey: [...QK.billingAlerts, { projectId, active: true }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      params.append('active', 'true');
      const res = await fetch(`/api/billing-alerts?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Errore nel caricamento degli alert');
      return res.json();
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<AlertStats>({
    queryKey: QK.billingAlertsStats,
    queryFn: async () => {
      const res = await fetch('/api/billing-alerts/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Errore nel caricamento delle statistiche');
      return res.json();
    },
    enabled: showStats,
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/billing-alerts/${alertId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'admin' }), // TODO: use actual user
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Errore');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.billingAlerts });
      toast({ title: "Alert ignorato" });
    },
  });

  // Refresh alerts mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing-alerts/check', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Errore');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.billingAlerts });
      toast({ title: "Alert aggiornati" });
    },
  });

  const displayedAlerts = showAll ? alerts : alerts.slice(0, maxAlerts);
  const hasMoreAlerts = alerts.length > maxAlerts;

  const handleAction = (alert: BillingAlert) => {
    if (onNavigate && alert.project?.code) {
      // Naviga alla fatturazione con il codice commessa come filtro di ricerca
      onNavigate(alert.projectId, 'fatturazione', alert.project.code);
    }
  };

  if (alertsLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Alert Fatturazione
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0 && !showStats) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Alert Fatturazione
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Summary */}
        {showStats && stats && stats.totale > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {stats.completateNonFatturate}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300">Da fatturare</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {stats.fattureScadute}
              </div>
              <div className="text-xs text-red-700 dark:text-red-300">Scadute</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {stats.pagamentiInRitardo}
              </div>
              <div className="text-xs text-orange-700 dark:text-orange-300">In ritardo</div>
            </div>
          </div>
        )}

        {/* Alert List */}
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>Nessun alert attivo</p>
            <p className="text-sm">Tutto in ordine!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedAlerts.map((alert) => {
              const config = ALERT_TYPE_CONFIG[alert.alertType];
              const priorityConfig = PRIORITY_CONFIG[alert.priority];
              const Icon = config.icon;
              const ActionIcon = config.actionIcon;

              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => handleAction(alert)}
                  title={`Clicca per vedere ${alert.project?.code || 'la commessa'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`mt-0.5 ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">
                            {alert.project?.code || 'N/A'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {alert.project?.client}
                          </span>
                          <Badge className={priorityConfig.color} variant="outline">
                            {alert.daysOverdue}gg
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground mt-0.5">
                          {alert.prestazione && (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-medium">
                                {PRESTAZIONE_LABELS[alert.prestazione.tipo] || alert.prestazione.tipo}
                              </span>
                              {alert.prestazione.livelloProgettazione && (
                                <span className="text-xs bg-muted px-1 rounded">
                                  {alert.prestazione.livelloProgettazione.toUpperCase()}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                • {config.label}
                              </span>
                            </span>
                          )}
                          {alert.invoice && (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-medium">Fatt. {alert.invoice.numeroFattura}</span>
                              <span className="font-medium text-foreground">
                                {(alert.invoice.importoTotale / 100).toLocaleString('it-IT', {
                                  style: 'currency',
                                  currency: 'EUR'
                                })}
                              </span>
                              <span className="text-xs text-gray-400">
                                • {config.label}
                              </span>
                            </span>
                          )}
                        </div>

                        {!compact && alert.message && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {alert.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={config.color}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(alert);
                        }}
                        title={`Vai a ${config.actionLabel}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissMutation.mutate(alert.id);
                        }}
                        disabled={dismissMutation.isPending}
                        title="Ignora questo alert"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show more/less */}
            {hasMoreAlerts && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Mostra meno' : `Mostra altri ${alerts.length - maxAlerts} alert`}
                <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showAll ? 'rotate-90' : ''}`} />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for sidebar/header
export function BillingAlertsBadge() {
  const { data: stats } = useQuery<AlertStats>({
    queryKey: QK.billingAlertsStats,
    queryFn: async () => {
      const res = await fetch('/api/billing-alerts/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Errore');
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (!stats || stats.totale === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="ml-2 animate-pulse"
    >
      {stats.totale}
    </Badge>
  );
}

export default BillingAlerts;
