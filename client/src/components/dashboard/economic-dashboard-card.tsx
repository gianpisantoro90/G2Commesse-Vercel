import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { type Project, type ProjectMetadata, type PrestazioniStats } from "@shared/schema";
import { formatImporto, getImportoOpere } from "@/lib/prestazioni-utils";
import {
  DollarSign, Briefcase,
  PieChart as PieChartIcon, BarChart3, Target, AlertCircle, FileText, Euro,
  TrendingUp, AlertTriangle, Clock, Play, CheckCircle
} from "lucide-react";

export default function EconomicDashboardCard() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: QK.projects,
  });

  const { data: prestazioniStats } = useQuery<PrestazioniStats>({
    queryKey: QK.prestazioniStats,
  });

  if (isLoading) {
    return (
      <div className="card-g2" data-testid="economic-dashboard-loading">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Calcoli economici - importo opere da metadata progetto (usa classificazioniDM2016 con fallback)
  const projectsWithEconomicData = projects.filter(p => {
    const metadata = p.metadata as ProjectMetadata;
    return getImportoOpere(metadata) > 0;
  });

  const totalImportoOpere = projectsWithEconomicData.reduce((sum, p) => {
    const metadata = p.metadata as ProjectMetadata;
    return sum + getImportoOpere(metadata);
  }, 0);

  // Compensi professionali ora provengono dalle prestazioni
  // Usa i dati delle prestazioni se disponibili
  const totalImportoServizi = prestazioniStats?.importoTotaleFatturato
    ? prestazioniStats.importoTotaleFatturato / 100 // convertito da centesimi
    : 0;

  const totalImportoPrevisto = prestazioniStats?.importoTotalePrevisto
    ? prestazioniStats.importoTotalePrevisto / 100
    : 0;

  const importoServiziInCorso = prestazioniStats?.importoDaFatturare
    ? prestazioniStats.importoDaFatturare / 100
    : 0;

  const importoServiziIncassati = prestazioniStats?.importoTotalePagato
    ? prestazioniStats.importoTotalePagato / 100
    : 0;

  const averageImportoServizio = prestazioniStats && prestazioniStats.totale > 0
    ? totalImportoPrevisto / prestazioniStats.totale
    : 0;

  // Dati per grafico distribuzione per anno (basato su progetti con importo opere)
  const yearlyData = projects.reduce((acc, project) => {
    const year = `20${project.year.toString().padStart(2, '0')}`;
    const metadata = project.metadata as ProjectMetadata;
    const importo = getImportoOpere(metadata);

    const existing = acc.find(item => item.year === year);
    if (existing) {
      existing.importo += importo;
      existing.count += 1;
    } else {
      acc.push({ year, importo, count: 1 });
    }
    return acc;
  }, [] as Array<{ year: string; importo: number; count: number }>)
  .sort((a, b) => a.year.localeCompare(b.year));

  // Dati per grafico distribuzione per stato prestazioni
  const statusData = prestazioniStats ? [
    {
      name: 'Da fatturare',
      value: prestazioniStats.importoDaFatturare / 100,
      count: prestazioniStats.completateNonFatturate,
      color: '#F59E0B'
    },
    {
      name: 'Da incassare',
      value: prestazioniStats.importoDaIncassare / 100,
      count: prestazioniStats.fatturateNonPagate,
      color: '#8B5CF6'
    },
    {
      name: 'Incassate',
      value: prestazioniStats.importoTotalePagato / 100,
      count: prestazioniStats.pagate,
      color: '#10B981'
    },
  ].filter(item => item.count > 0) : [];

  // Top 5 commesse per importo opere
  const topProjectsByValue = [...projectsWithEconomicData]
    .sort((a, b) => {
      const metadataA = a.metadata as ProjectMetadata;
      const metadataB = b.metadata as ProjectMetadata;
      return (metadataB?.importoOpere || 0) - (metadataA?.importoOpere || 0);
    })
    .slice(0, 5);

  return (
    <div className="card-g2" data-testid="economic-dashboard-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            Dashboard Economica
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Panoramica economica delle commesse attive e concluse
          </p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1 border-border">
          {projectsWithEconomicData.length} commesse valorizzate
        </Badge>
      </div>

      {/* Content */}
      <div>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Panoramica</span>
              <span className="sm:hidden">KPI</span>
            </TabsTrigger>
            <TabsTrigger value="charts" className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
              <BarChart3 className="h-4 w-4" />
              Grafici
            </TabsTrigger>
            <TabsTrigger value="top-projects" className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Top Commesse</span>
              <span className="sm:hidden">Top</span>
            </TabsTrigger>
            <TabsTrigger value="prestazioni" className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-card text-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Prestazioni</span>
              <span className="sm:hidden">Prest.</span>
            </TabsTrigger>
          </TabsList>

          {/* Panoramica KPI */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* KPI 1: Importo Totale Opere */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  Importo Totale Opere
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatImporto(totalImportoOpere)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Base di calcolo compensi professionali
                </p>
              </div>

              {/* KPI 2: Compensi Fatturati */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Compensi Fatturati
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatImporto(totalImportoServizi)}
                </p>
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-2">
                  <FileText className="h-3 w-3" />
                  {(prestazioniStats?.fatturate || 0) + (prestazioniStats?.pagate || 0)} prestazioni fatturate
                </div>
              </div>

              {/* KPI 3: Da Fatturare */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/50 dark:to-yellow-900/50 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                  Da Fatturare
                </p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {formatImporto(importoServiziInCorso)}
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  {prestazioniStats?.completateNonFatturate || 0} prestazioni completate
                </p>
              </div>

              {/* KPI 4: Incassato */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border border-purple-200 dark:border-purple-800">
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                  Totale Incassato
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatImporto(importoServiziIncassati)}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  <Euro className="h-3 w-3 inline mr-1" />
                  {prestazioniStats?.pagate || 0} prestazioni pagate
                </p>
              </div>
            </div>

            {/* Metriche Secondarie */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-muted border border-border">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Importo Previsto Totale
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatImporto(totalImportoPrevisto)}
                </p>
                <Progress value={totalImportoPrevisto > 0 ? (importoServiziIncassati / totalImportoPrevisto) * 100 : 0} className="mt-3 h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {prestazioniStats?.totale || 0} prestazioni totali
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted border border-border">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Da Incassare
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatImporto((prestazioniStats?.importoDaIncassare || 0) / 100)}
                </p>
                <Progress value={totalImportoServizi > 0 ? ((prestazioniStats?.importoDaIncassare || 0) / 100 / totalImportoServizi) * 100 : 0} className="mt-3 h-2 [&>div]:bg-purple-500" />
                <p className="text-xs text-muted-foreground mt-2">
                  {prestazioniStats?.fatturateNonPagate || 0} fatture in attesa
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted border border-border">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Tasso Incasso
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {prestazioniStats && prestazioniStats.importoTotaleFatturato > 0
                    ? ((prestazioniStats.importoTotalePagato / prestazioniStats.importoTotaleFatturato) * 100).toFixed(1)
                    : 0}%
                </p>
                <Progress value={prestazioniStats && prestazioniStats.importoTotaleFatturato > 0 ? (prestazioniStats.importoTotalePagato / prestazioniStats.importoTotaleFatturato) * 100 : 0} className="mt-3 h-2 [&>div]:bg-green-500" />
                <p className="text-xs text-muted-foreground mt-2">
                  {formatImporto(importoServiziIncassati)} su {formatImporto(totalImportoServizi)} fatturato
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Grafici */}
          <TabsContent value="charts" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Grafico Distribuzione per Anno */}
              <div className="p-4 rounded-lg bg-muted border border-border">
                <div className="mb-4">
                  <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Distribuzione Annuale Compensi
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Andamento compensi professionali per anno
                  </p>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={yearlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 12 }}
                        stroke="#6B7280"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#6B7280"
                        tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => formatImporto(value)}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                      />
                      <Bar
                        dataKey="importo"
                        fill="#3B82F6"
                        radius={[8, 8, 0, 0]}
                        name="Compensi"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grafico Distribuzione per Stato */}
              <div className="p-4 rounded-lg bg-muted border border-border">
                <div className="mb-4">
                  <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Distribuzione per Stato
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ripartizione compensi per stato commessa
                  </p>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatImporto(value)}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 pt-4 border-t border-border">
                  {statusData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-foreground">{item.name}</span>
                      </div>
                      <div className="font-medium text-foreground">
                        {formatImporto(item.value)} ({item.count})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Top Commesse */}
          <TabsContent value="top-projects" className="space-y-4">
            <div className="p-4 rounded-lg bg-muted border border-border">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Top 5 Commesse per Importo Opere
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Commesse con il maggiore importo lavori
                </p>
              </div>
              <div>
                <div className="space-y-4">
                  {topProjectsByValue.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p>Nessuna commessa con dati economici disponibili</p>
                    </div>
                  ) : (
                    topProjectsByValue.map((project, index) => {
                      const metadata = project.metadata as ProjectMetadata;
                      const importoOpere = getImportoOpere(metadata);
                      const percentage = totalImportoOpere > 0 ? (importoOpere / totalImportoOpere) * 100 : 0;

                      return (
                        <div key={project.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                                index === 0 ? 'bg-yellow-500' :
                                index === 1 ? 'bg-gray-400' :
                                index === 2 ? 'bg-orange-600' :
                                'bg-blue-500'
                              }`}>
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-foreground truncate" title={`${project.code} - ${project.object}`}>
                                  {project.code}
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {project.client} - {project.city}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                              <div className="font-bold text-foreground">
                                {formatImporto(importoOpere)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {percentage.toFixed(1)}% del totale
                              </div>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Prestazioni */}
          <TabsContent value="prestazioni" className="space-y-4">
            {prestazioniStats && prestazioniStats.totale > 0 ? (
              <div className="space-y-4">
                {/* Alert Section */}
                {(prestazioniStats.completateNonFatturate > 0 || prestazioniStats.fatturateNonPagate > 0) && (
                  <div className="space-y-2">
                    {prestazioniStats.completateNonFatturate > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Completate da fatturare
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 font-semibold">
                            {prestazioniStats.completateNonFatturate}
                          </Badge>
                          <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                            {formatImporto(prestazioniStats.importoDaFatturare / 100)}
                          </span>
                        </div>
                      </div>
                    )}
                    {prestazioniStats.fatturateNonPagate > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                            In attesa di pagamento
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100 font-semibold">
                            {prestazioniStats.fatturateNonPagate}
                          </Badge>
                          <span className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                            {formatImporto(prestazioniStats.importoDaIncassare / 100)}
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
                    <span className="font-medium">{prestazioniStats.totale > 0 ? Math.round((prestazioniStats.pagate / prestazioniStats.totale) * 100) : 0}% pagate</span>
                  </div>
                  <Progress value={prestazioniStats.totale > 0 ? (prestazioniStats.pagate / prestazioniStats.totale) * 100 : 0} className="h-2" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="p-1.5 rounded-md bg-muted">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Da iniziare</p>
                      <p className="font-semibold">{prestazioniStats.daIniziare}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900">
                      <Play className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">In corso</p>
                      <p className="font-semibold">{prestazioniStats.inCorso}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900">
                      <CheckCircle className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Completate</p>
                      <p className="font-semibold">{prestazioniStats.completate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900">
                      <FileText className="h-3.5 w-3.5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fatturate</p>
                      <p className="font-semibold">{prestazioniStats.fatturate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 col-span-2 lg:col-span-1">
                    <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900">
                      <Euro className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Pagate</p>
                      <div className="flex justify-between items-baseline">
                        <p className="font-semibold">{prestazioniStats.pagate} / {prestazioniStats.totale}</p>
                        <p className="text-sm text-green-600 font-medium">{formatImporto(prestazioniStats.importoTotalePagato / 100)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="pt-2 border-t">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Previsto</p>
                      <p className="font-medium text-sm text-foreground">{formatImporto(prestazioniStats.importoTotalePrevisto / 100)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fatturato</p>
                      <p className="font-medium text-sm text-foreground">{formatImporto(prestazioniStats.importoTotaleFatturato / 100)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Incassato</p>
                      <p className="font-medium text-sm text-green-700 dark:text-green-400">{formatImporto(prestazioniStats.importoTotalePagato / 100)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessuna prestazione registrata</p>
                <p className="text-sm">Inizia aggiungendo prestazioni ai tuoi progetti</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
