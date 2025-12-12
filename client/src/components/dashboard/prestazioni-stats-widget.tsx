import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Euro,
  FileText,
  TrendingUp,
  Play
} from "lucide-react";
import { type PrestazioniStats } from "@shared/schema";

export default function PrestazioniStatsWidget() {
  const { data: stats, isLoading, error } = useQuery<PrestazioniStats>({
    queryKey: ["/api/prestazioni/stats"],
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="card-g2" data-testid="prestazioni-stats-loading">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card-g2" data-testid="prestazioni-stats-error">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stato Prestazioni</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Impossibile caricare le statistiche</p>
      </div>
    );
  }

  // Se non ci sono prestazioni, mostra un messaggio
  if (stats.totale === 0) {
    return (
      <div className="card-g2" data-testid="prestazioni-stats-empty">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Stato Prestazioni
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Riepilogo fatturazione e pagamento prestazioni</p>
        <div className="text-center py-6 text-gray-500 dark:text-gray-400 mt-4">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nessuna prestazione registrata</p>
          <p className="text-sm">Inizia aggiungendo prestazioni ai tuoi progetti</p>
        </div>
      </div>
    );
  }

  const hasAlerts = stats.completateNonFatturate > 0 || stats.fatturateNonPagate > 0;
  const completionPercent = stats.totale > 0 ? Math.round((stats.pagate / stats.totale) * 100) : 0;

  return (
    <div className={`card-g2 ${hasAlerts ? "border-amber-500/50" : ""}`} data-testid="prestazioni-stats-widget">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Stato Prestazioni
          {hasAlerts && (
            <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Attenzione
            </Badge>
          )}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Riepilogo fatturazione e pagamento prestazioni</p>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Alert Section */}
        {hasAlerts && (
          <div className="space-y-2">
            {stats.completateNonFatturate > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Completate da fatturare
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 font-semibold">
                    {stats.completateNonFatturate}
                  </Badge>
                  <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {formatCurrency(stats.importoDaFatturare)}
                  </span>
                </div>
              </div>
            )}

            {stats.fatturateNonPagate > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    In attesa di pagamento
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100 font-semibold">
                    {stats.fatturateNonPagate}
                  </Badge>
                  <span className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                    {formatCurrency(stats.importoDaIncassare)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completamento ciclo</span>
            <span className="font-medium">{completionPercent}% pagate</span>
          </div>
          <Progress value={completionPercent} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800">
              <Clock className="h-3.5 w-3.5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Da iniziare</p>
              <p className="font-semibold">{stats.daIniziare}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900">
              <Play className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In corso</p>
              <p className="font-semibold">{stats.inCorso}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900">
              <CheckCircle className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completate</p>
              <p className="font-semibold">{stats.completate}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900">
              <FileText className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fatturate</p>
              <p className="font-semibold">{stats.fatturate}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 col-span-2">
            <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900">
              <Euro className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Pagate</p>
              <div className="flex justify-between items-baseline">
                <p className="font-semibold">{stats.pagate} / {stats.totale}</p>
                <p className="text-sm text-green-600 font-medium">{formatCurrency(stats.importoTotalePagato)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="pt-2 border-t">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Previsto</p>
              <p className="font-medium text-sm text-gray-900 dark:text-white">{formatCurrency(stats.importoTotalePrevisto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fatturato</p>
              <p className="font-medium text-sm text-gray-900 dark:text-white">{formatCurrency(stats.importoTotaleFatturato)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Incassato</p>
              <p className="font-medium text-sm text-green-700 dark:text-green-400">{formatCurrency(stats.importoTotalePagato)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
