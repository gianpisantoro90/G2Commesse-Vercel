import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { getQueryFn } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, ComposedChart, Line
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Clock, Target } from "lucide-react";

interface CashFlowMonth {
  month: string;
  label: string;
  entriPrevisti: number;
  uscitePreviste: number;
  saldoPrevisto: number;
  fattureDaIncassare: number;
  prestazioniDaFatturare: number;
  confidence: number;
}

interface CashFlowForecast {
  months: CashFlowMonth[];
  summary: {
    totalEntriPrevisti: number;
    totalUscitePreviste: number;
    saldoPeriodo: number;
    avgMonthlyEntri: number;
    avgMonthlyUscite: number;
    collectionDelayDays: number;
    collectionRate: number;
  };
  historicalMonths: CashFlowMonth[];
  generatedAt: string;
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatEuroCompact(cents: number): string {
  const euros = cents / 100;
  if (Math.abs(euros) >= 1000000) return `${(euros / 1000000).toFixed(1)}M`;
  if (Math.abs(euros) >= 1000) return `${(euros / 1000).toFixed(0)}k`;
  return euros.toFixed(0);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatEuro(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function CashFlowForecastCard() {
  const { data: forecast, isLoading } = useQuery<CashFlowForecast>({
    queryKey: QK.aiCashFlowForecast,
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <div className="card-g2">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!forecast) {
    return null;
  }

  // Combine historical + forecast for the chart
  const chartData = [
    ...forecast.historicalMonths.map(m => ({
      ...m,
      entriPrevisti: m.entriPrevisti / 100,
      uscitePreviste: m.uscitePreviste / 100,
      saldoPrevisto: m.saldoPrevisto / 100,
      isHistorical: true,
    })),
    ...forecast.months.map(m => ({
      ...m,
      entriPrevisti: m.entriPrevisti / 100,
      uscitePreviste: m.uscitePreviste / 100,
      saldoPrevisto: m.saldoPrevisto / 100,
      isHistorical: false,
    })),
  ];

  const { summary } = forecast;
  const saldoPositivo = summary.saldoPeriodo >= 0;

  return (
    <div className="card-g2 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Previsione Cash Flow</h3>
            <p className="text-xs text-muted-foreground">
              Prossimi {forecast.months.length} mesi (storico + previsione)
            </p>
          </div>
        </div>
        <Badge variant={saldoPositivo ? "secondary" : "destructive"} className="text-xs">
          {saldoPositivo ? '+' : ''}{formatEuroCompact(summary.saldoPeriodo)}
        </Badge>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
          <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            {formatEuroCompact(summary.totalEntriPrevisti)}
          </p>
          <p className="text-[10px] text-green-600">Entri previsti</p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
          <TrendingDown className="w-4 h-4 text-red-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-red-700 dark:text-red-400">
            {formatEuroCompact(summary.totalUscitePreviste)}
          </p>
          <p className="text-[10px] text-red-600">Uscite previste</p>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
          <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
            {summary.collectionDelayDays}gg
          </p>
          <p className="text-[10px] text-blue-600">Ritardo medio incasso</p>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-center">
          <Target className="w-4 h-4 text-purple-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
            {Math.round(summary.collectionRate * 100)}%
          </p>
          <p className="text-[10px] text-purple-600">Tasso incasso</p>
        </div>
      </div>

      {/* Chart */}
      <Tabs defaultValue="combined">
        <TabsList className="bg-muted">
          <TabsTrigger value="combined" className="text-xs">Combinato</TabsTrigger>
          <TabsTrigger value="detail" className="text-xs">Dettaglio</TabsTrigger>
        </TabsList>

        <TabsContent value="combined" className="mt-3">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
                <Bar
                  dataKey="entriPrevisti"
                  name="Entri"
                  fill="#10b981"
                  fillOpacity={0.8}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="uscitePreviste"
                  name="Uscite"
                  fill="#ef4444"
                  fillOpacity={0.6}
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="saldoPrevisto"
                  name="Saldo"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-3 h-2 bg-green-500 rounded-sm" /> Storico
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-3 h-2 bg-green-500 rounded-sm opacity-50" /> Previsione
            </div>
          </div>
        </TabsContent>

        <TabsContent value="detail" className="mt-3">
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {forecast.months.map(month => (
              <div key={month.month} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                <div className="w-16 text-xs font-medium text-foreground">
                  {month.label}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-600">+{formatEuro(month.entriPrevisti)}</span>
                    <span className="text-red-600">-{formatEuro(month.uscitePreviste)}</span>
                    <span className={month.saldoPrevisto >= 0 ? 'text-blue-600 font-medium' : 'text-red-600 font-medium'}>
                      = {month.saldoPrevisto >= 0 ? '+' : ''}{formatEuro(month.saldoPrevisto)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round(month.confidence * 100)}%`, opacity: month.confidence }}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground w-12 text-right">
                  {Math.round(month.confidence * 100)}%
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            La barra indica il livello di confidenza della previsione
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
