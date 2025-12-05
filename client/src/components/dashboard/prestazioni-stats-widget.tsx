import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Link } from "wouter";

export default function PrestazioniStatsWidget() {
  const { data: stats, isLoading, error } = useQuery<PrestazioniStats>({
    queryKey: ["/api/prestazioni/stats"],
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stato Prestazioni</CardTitle>
          <CardDescription>Impossibile caricare le statistiche</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Se non ci sono prestazioni, mostra un messaggio
  if (stats.totale === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Stato Prestazioni
          </CardTitle>
          <CardDescription>Riepilogo fatturazione e pagamento prestazioni</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nessuna prestazione registrata</p>
            <p className="text-sm">Inizia aggiungendo prestazioni ai tuoi progetti</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAlerts = stats.completateNonFatturate > 0 || stats.fatturateNonPagate > 0;
  const completionPercent = stats.totale > 0 ? Math.round((stats.pagate / stats.totale) * 100) : 0;

  return (
    <Card className={hasAlerts ? "border-amber-500/50" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Stato Prestazioni
          {hasAlerts && (
            <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Attenzione
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Riepilogo fatturazione e pagamento prestazioni</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
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
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    {stats.completateNonFatturate}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
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
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    {stats.fatturateNonPagate}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
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
              <p className="font-medium text-sm">{formatCurrency(stats.importoTotalePrevisto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fatturato</p>
              <p className="font-medium text-sm">{formatCurrency(stats.importoTotaleFatturato)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Incassato</p>
              <p className="font-medium text-sm text-green-600">{formatCurrency(stats.importoTotalePagato)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
