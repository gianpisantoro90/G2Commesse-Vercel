import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { type Project, type ProjectMetadata, type PrestazioniStats } from "@shared/schema";
import { formatImporto } from "@/lib/prestazioni-utils";
import {
  DollarSign, Briefcase,
  PieChart as PieChartIcon, BarChart3, Target, AlertCircle, FileText, Euro
} from "lucide-react";

export default function EconomicDashboardCard() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: prestazioniStats } = useQuery<PrestazioniStats>({
    queryKey: ["/api/prestazioni/stats"],
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

  // Calcoli economici - importo opere da metadata progetto
  const projectsWithEconomicData = projects.filter(p => {
    const metadata = p.metadata as ProjectMetadata;
    return metadata?.importoOpere;
  });

  const totalImportoOpere = projectsWithEconomicData.reduce((sum, p) => {
    const metadata = p.metadata as ProjectMetadata;
    return sum + (metadata?.importoOpere || 0);
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

  const projectsInCorso = projects.filter(p => p.status === "in_corso");
  const projectsConcluse = projects.filter(p => p.status === "conclusa");

  const averageImportoServizio = prestazioniStats && prestazioniStats.totale > 0
    ? totalImportoPrevisto / prestazioniStats.totale
    : 0;

  // Dati per grafico distribuzione per anno (basato su progetti con importo opere)
  const yearlyData = projects.reduce((acc, project) => {
    const year = `20${project.year.toString().padStart(2, '0')}`;
    const metadata = project.metadata as ProjectMetadata;
    const importo = metadata?.importoOpere || 0;

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            Dashboard Economica
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Panoramica economica delle commesse attive e concluse
          </p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1 border-gray-300 dark:border-gray-600">
          {projectsWithEconomicData.length} commesse valorizzate
        </Badge>
      </div>

      {/* Content */}
      <div>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-gray-100 dark:bg-gray-800 w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Panoramica</span>
              <span className="sm:hidden">KPI</span>
            </TabsTrigger>
            <TabsTrigger value="charts" className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
              <BarChart3 className="h-4 w-4" />
              Grafici
            </TabsTrigger>
            <TabsTrigger value="top-projects" className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Top Commesse</span>
              <span className="sm:hidden">Top</span>
            </TabsTrigger>
          </TabsList>

          {/* Panoramica KPI */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* KPI 1: Importo Totale Opere */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border border-blue-200 dark:border-blue-800">
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
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Compensi Fatturati
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatImporto(totalImportoServizi)}
                </p>
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-2">
                  <FileText className="h-3 w-3" />
                  {prestazioniStats?.fatturate || 0} prestazioni fatturate
                </div>
              </div>

              {/* KPI 3: Da Fatturare */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/50 dark:to-yellow-900/50 border border-yellow-200 dark:border-yellow-800">
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
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border border-purple-200 dark:border-purple-800">
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
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  Importo Previsto Totale
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatImporto(totalImportoPrevisto)}
                </p>
                <Progress value={totalImportoPrevisto > 0 ? (importoServiziIncassati / totalImportoPrevisto) * 100 : 0} className="mt-3 h-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {prestazioniStats?.totale || 0} prestazioni totali
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  Da Incassare
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatImporto((prestazioniStats?.importoDaIncassare || 0) / 100)}
                </p>
                <Progress value={totalImportoServizi > 0 ? ((prestazioniStats?.importoDaIncassare || 0) / 100 / totalImportoServizi) * 100 : 0} className="mt-3 h-2 [&>div]:bg-purple-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {prestazioniStats?.fatturateNonPagate || 0} fatture in attesa
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  Tasso Incasso
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {prestazioniStats && prestazioniStats.totale > 0
                    ? ((prestazioniStats.pagate / prestazioniStats.totale) * 100).toFixed(1)
                    : 0}%
                </p>
                <Progress value={prestazioniStats && prestazioniStats.totale > 0 ? (prestazioniStats.pagate / prestazioniStats.totale) * 100 : 0} className="mt-3 h-2 [&>div]:bg-green-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {prestazioniStats?.pagate || 0}/{prestazioniStats?.totale || 0} prestazioni
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Grafici */}
          <TabsContent value="charts" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Grafico Distribuzione per Anno */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Distribuzione Annuale Compensi
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Distribuzione per Stato
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                <div className="mt-4 space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {statusData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white">
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
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Top 5 Commesse per Importo Opere
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Commesse con il maggiore importo lavori
                </p>
              </div>
              <div>
                <div className="space-y-4">
                  {topProjectsByValue.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
                      <p>Nessuna commessa con dati economici disponibili</p>
                    </div>
                  ) : (
                    topProjectsByValue.map((project, index) => {
                      const metadata = project.metadata as ProjectMetadata;
                      const importoOpere = metadata?.importoOpere || 0;
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
                                <div className="font-semibold text-gray-900 dark:text-white truncate" title={`${project.code} - ${project.object}`}>
                                  {project.code}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                  {project.client} - {project.city}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                              <div className="font-bold text-gray-900 dark:text-white">
                                {formatImporto(importoOpere)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
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
        </Tabs>
      </div>
    </div>
  );
}
