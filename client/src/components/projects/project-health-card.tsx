import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { getQueryFn } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, Check, ChevronRight } from "lucide-react";

interface HealthComponent {
  name: string;
  score: number;
  weight: number;
  details: string;
  severity: 'ok' | 'warning' | 'critical';
}

interface ProjectHealthResult {
  projectId: string;
  projectCode: string;
  overallScore: number;
  riskLevel: string;
  components: HealthComponent[];
  recommendations: string[];
  lastUpdated: string;
}

const riskColors: Record<string, { text: string; bg: string; badge: 'default' | 'secondary' | 'destructive' }> = {
  basso: { text: 'text-green-600', bg: 'bg-green-500', badge: 'secondary' },
  medio: { text: 'text-yellow-600', bg: 'bg-yellow-500', badge: 'default' },
  alto: { text: 'text-orange-600', bg: 'bg-orange-500', badge: 'default' },
  critico: { text: 'text-red-600', bg: 'bg-red-500', badge: 'destructive' },
};

const severityColors: Record<string, string> = {
  ok: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  critical: 'text-red-600 dark:text-red-400',
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function ProjectHealthCard({ projectId }: { projectId: string }) {
  const { data: health, isLoading, error } = useQuery<ProjectHealthResult>({
    queryKey: QK.aiProjectHealthDetail(projectId),
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
        Impossibile calcolare la salute del progetto
      </div>
    );
  }

  const risk = riskColors[health.riskLevel] || riskColors.medio;

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
        <div className="relative w-16 h-16">
          <svg width={64} height={64} className="-rotate-90">
            <circle cx={32} cy={32} r={28} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
            <circle
              cx={32} cy={32} r={28}
              fill="none"
              stroke={health.overallScore >= 80 ? '#10b981' : health.overallScore >= 60 ? '#f59e0b' : health.overallScore >= 40 ? '#f97316' : '#ef4444'}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={2 * Math.PI * 28 - (health.overallScore / 100) * 2 * Math.PI * 28}
              className="transition-all duration-700"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${risk.text}`}>
            {health.overallScore}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Salute Progetto</span>
            <Badge variant={risk.badge}>{health.riskLevel.toUpperCase()}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggiornato: {new Date(health.lastUpdated).toLocaleString('it-IT')}
          </p>
        </div>
      </div>

      {/* Component Scores */}
      <div className="space-y-2">
        {health.components.map(comp => (
          <div key={comp.name} className="p-2 bg-background rounded border border-border">
            <ScoreBar score={comp.score} label={comp.name} />
            <p className="text-[10px] text-gray-400 mt-1">{comp.details}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Azioni consigliate</p>
          {health.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ChevronRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact health badge for use in the projects table.
 */
export function ProjectHealthBadge({ projectId }: { projectId: string }) {
  const { data: health } = useQuery<ProjectHealthResult>({
    queryKey: QK.aiProjectHealthDetail(projectId),
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60 * 1000,
    enabled: !!projectId,
  });

  if (!health) return null;

  const color = health.overallScore >= 80 ? 'bg-green-500' :
    health.overallScore >= 60 ? 'bg-yellow-500' :
    health.overallScore >= 40 ? 'bg-orange-500' : 'bg-red-500';

  const textColor = health.overallScore >= 80 ? 'text-green-700 dark:text-green-400' :
    health.overallScore >= 60 ? 'text-yellow-700 dark:text-yellow-400' :
    health.overallScore >= 40 ? 'text-orange-700 dark:text-orange-400' : 'text-red-700 dark:text-red-400';

  return (
    <div className="flex items-center gap-1.5" title={`Salute: ${health.overallScore}/100 (${health.riskLevel})`}>
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className={`text-xs font-medium ${textColor}`}>{health.overallScore}</span>
    </div>
  );
}
