import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain, AlertTriangle, TrendingUp, FileText, Mail,
  Clock, X, RefreshCw, ChevronRight, Activity, Sparkles
} from "lucide-react";

interface ProactiveInsight {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  projectCode?: string;
  client?: string;
  actionSuggestion: string;
  createdAt: string;
}

interface InsightsData {
  insights: ProactiveInsight[];
  generatedAt: string;
  totalActive: number;
}

interface HealthSummary {
  totalActive: number;
  averageScore: number;
  criticalProjects: number;
  highRiskProjects: number;
  topIssues: Array<{ issue: string; count: number; severity: string }>;
  projectScores: Array<{
    projectCode: string;
    client: string;
    overallScore: number;
    riskLevel: string;
    recommendations: string[];
  }>;
}

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  urgent: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/30', label: 'Urgente' },
  high: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-950/30', label: 'Alta' },
  medium: { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-950/30', label: 'Media' },
  low: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950/30', label: 'Bassa' },
};

const typeIcons: Record<string, typeof AlertTriangle> = {
  billing: FileText,
  deadline: Clock,
  communication: Mail,
  project_health: Activity,
  financial: TrendingUp,
};

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth="4"
          className="text-border"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

export default function AiInsightsCard() {
  const queryClient = useQueryClient();

  const { data: healthData, isLoading: healthLoading } = useQuery<HealthSummary>({
    queryKey: QK.aiProjectHealth,
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery<InsightsData>({
    queryKey: QK.aiInsights,
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/insights/refresh"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.aiInsights });
      queryClient.invalidateQueries({ queryKey: QK.aiProjectHealth });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/ai/insights/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.aiInsights });
    },
  });

  if (healthLoading && insightsLoading) {
    return (
      <div className="card-g2">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const insights = insightsData?.insights || [];
  const urgentInsights = insights.filter(i => i.priority === 'urgent');
  const highInsights = insights.filter(i => i.priority === 'high');
  const topProjects = healthData?.projectScores?.slice(0, 5) || [];

  return (
    <div className="card-g2 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Intelligence AI</h3>
            <p className="text-xs text-muted-foreground">
              {insightsData?.generatedAt
                ? `Aggiornato: ${new Date(insightsData.generatedAt).toLocaleString('it-IT')}`
                : 'Analisi in corso...'}
            </p>
          </div>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>

      {/* Health Summary Metrics */}
      {healthData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-muted rounded-lg">
            <ScoreRing score={healthData.averageScore} size={52} />
            <p className="text-xs text-muted-foreground mt-1">Score Medio</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-foreground">{healthData.totalActive}</p>
            <p className="text-xs text-muted-foreground">Progetti Attivi</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{healthData.criticalProjects}</p>
            <p className="text-xs text-red-500">Critici</p>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{healthData.highRiskProjects}</p>
            <p className="text-xs text-orange-500">Alto Rischio</p>
          </div>
        </div>
      )}

      {/* Top At-Risk Projects */}
      {topProjects.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Progetti piu' a rischio</h4>
          <div className="space-y-2">
            {topProjects.map(project => (
              <div key={project.projectCode} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                <ScoreRing score={project.overallScore} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">{project.projectCode}</span>
                    <Badge variant={
                      project.riskLevel === 'critico' ? 'destructive' :
                      project.riskLevel === 'alto' ? 'default' : 'secondary'
                    } className="text-[10px] px-1.5 py-0">
                      {project.riskLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{project.client}</p>
                </div>
                {project.recommendations[0] && (
                  <p className="text-xs text-muted-foreground hidden lg:block max-w-[200px] truncate">
                    {project.recommendations[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent & High Priority Insights */}
      {(urgentInsights.length > 0 || highInsights.length > 0) && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            Alert prioritari ({urgentInsights.length + highInsights.length})
          </h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {[...urgentInsights, ...highInsights].slice(0, 8).map(insight => {
              const pConfig = priorityConfig[insight.priority] || priorityConfig.medium;
              const Icon = typeIcons[insight.type] || AlertTriangle;
              return (
                <div key={insight.id} className={`p-3 rounded-lg border ${pConfig.bg} border-opacity-50`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${pConfig.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm font-medium ${pConfig.color}`}>{insight.title}</span>
                        {insight.projectCode && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                            {insight.projectCode}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{insight.description}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" />
                        {insight.actionSuggestion}
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                      onClick={() => dismissMutation.mutate(insight.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {insights.length === 0 && !insightsLoading && (
        <div className="text-center py-6 text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nessun alert attivo. Tutti i progetti sono in buono stato!</p>
        </div>
      )}
    </div>
  );
}
