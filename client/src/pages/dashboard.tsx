import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { type Task, type ProjectDeadline, type Project, type Client } from "@shared/schema";
import {
  CalendarClock, CheckSquare, AlertTriangle, Briefcase,
  Users, FolderCheck, Pause, LayoutDashboard
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import RecentProjectsTable from "@/components/dashboard/recent-projects-table";
import RecentTasksTable from "@/components/dashboard/recent-tasks-table";
import OneDriveStatusCard from "@/components/dashboard/onedrive-status-card";
import EconomicDashboardCard from "@/components/dashboard/economic-dashboard-card";

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
        <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
          <CheckSquare className="h-5 w-5 text-teal-600 dark:text-teal-400" />
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

function AdminQuickStats() {
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: QK.projects,
  });
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: QK.clients,
  });

  const projectsInCorso = projects.filter(p => p.status === "in corso").length;
  const projectsSospese = projects.filter(p => p.status === "sospesa").length;
  const projectsConcluse = projects.filter(p => p.status === "conclusa").length;
  const isLoading = isLoadingProjects || isLoadingClients;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  const stats = [
    { label: "In Corso", value: projectsInCorso, icon: Briefcase, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    { label: "Sospese", value: projectsSospese, icon: Pause, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Concluse", value: projectsConcluse, icon: FolderCheck, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/30" },
    { label: "Clienti", value: clients.length, icon: Users, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className={`flex items-center gap-3 p-3 rounded-lg border border-border ${s.bg}`}>
          <s.icon className={`h-5 w-5 shrink-0 ${s.color}`} />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <LayoutDashboard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {isAdmin ? "Dashboard" : `Ciao, ${user?.fullName || "utente"}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Panoramica generale del sistema" : "Ecco il riepilogo delle tue attività"}
          </p>
        </div>
      </div>

      {/* User Dashboard - simple layout */}
      {!isAdmin && (
        <>
          <UserQuickStats />
          <RecentTasksTable />
          <RecentProjectsTable />
        </>
      )}

      {/* Admin Dashboard - structured grid layout */}
      {isAdmin && (
        <>
          {/* Row 1: Quick stats bar */}
          <AdminQuickStats />

          {/* Row 2: Economic Dashboard full width */}
          <EconomicDashboardCard />

          {/* Row 4: Billing Alerts */}
          <Suspense fallback={<Skeleton className="h-32 w-full rounded-lg" />}>
            <BillingAlerts maxAlerts={5} />
          </Suspense>

          {/* Row 5: Tasks + Projects side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <RecentTasksTable />
            <RecentProjectsTable />
          </div>

          {/* Row 6: OneDrive compact */}
          <OneDriveStatusCard />
        </>
      )}
    </div>
  );
}
