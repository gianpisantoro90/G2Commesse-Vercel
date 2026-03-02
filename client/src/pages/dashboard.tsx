import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { type Task, type ProjectDeadline } from "@shared/schema";
import { CalendarClock, CheckSquare, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCard from "@/components/dashboard/stats-card";
import RecentProjectsTable from "@/components/dashboard/recent-projects-table";
import RecentTasksTable from "@/components/dashboard/recent-tasks-table";
import OneDriveStatusCard from "@/components/dashboard/onedrive-status-card";
import EconomicDashboardCard from "@/components/dashboard/economic-dashboard-card";
import AiInsightsCard from "@/components/dashboard/ai-insights-card";
import CashFlowForecastCard from "@/components/dashboard/cashflow-forecast-card";

const BillingAlerts = lazy(() => import("@/components/projects/billing-alerts"));

function UserQuickStats() {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: QK.tasks,
  });

  const { data: deadlines = [] } = useQuery<ProjectDeadline[]>({
    queryKey: QK.deadlines,
  });

  const now = new Date();
  const myTasks = tasks.filter(t => t.assignedToId === user?.id);
  const myPending = myTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const myOverdue = myTasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < now && t.status !== "completed" && t.status !== "cancelled"
  );

  const upcomingDeadlines = deadlines
    .filter(d => d.status === "pending" && new Date(d.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const overdueDeadlines = deadlines.filter(
    d => d.status === "pending" && new Date(d.dueDate) < now
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="card-g2 flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{myPending.length}</p>
          <p className="text-xs text-muted-foreground">Task da completare</p>
        </div>
      </div>
      <div className="card-g2 flex items-center gap-3">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
          <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{upcomingDeadlines.length}</p>
          <p className="text-xs text-muted-foreground">Scadenze imminenti</p>
        </div>
      </div>
      <div className="card-g2 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${(myOverdue.length + overdueDeadlines.length) > 0
          ? "bg-red-100 dark:bg-red-900/30"
          : "bg-green-100 dark:bg-green-900/30"
        }`}>
          <AlertTriangle className={`h-5 w-5 ${(myOverdue.length + overdueDeadlines.length) > 0
            ? "text-red-600 dark:text-red-400"
            : "text-green-600 dark:text-green-400"
          }`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{myOverdue.length + overdueDeadlines.length}</p>
          <p className="text-xs text-muted-foreground">Scaduti / In ritardo</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Panoramica generale del sistema" : `Benvenuto, ${user?.fullName || "utente"}`}
        </p>
      </div>

      {!isAdmin && <UserQuickStats />}
      {isAdmin && <AiInsightsCard />}
      {isAdmin && <EconomicDashboardCard />}
      {isAdmin && <CashFlowForecastCard />}
      {isAdmin && (
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-lg" />}>
          <BillingAlerts maxAlerts={5} />
        </Suspense>
      )}
      {isAdmin && <StatsCard />}
      <RecentTasksTable />
      <RecentProjectsTable />
      {isAdmin && <OneDriveStatusCard />}
    </div>
  );
}
