import { useAuth } from "@/hooks/useAuth";
import StatsCard from "@/components/dashboard/stats-card";
import RecentProjectsTable from "@/components/dashboard/recent-projects-table";
import RecentTasksTable from "@/components/dashboard/recent-tasks-table";
import OneDriveStatusCard from "@/components/dashboard/onedrive-status-card";
import EconomicDashboardCard from "@/components/dashboard/economic-dashboard-card";

import AiInsightsCard from "@/components/dashboard/ai-insights-card";
import CashFlowForecastCard from "@/components/dashboard/cashflow-forecast-card";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Panoramica generale del sistema</p>
      </div>

      {isAdmin && <AiInsightsCard />}
      {isAdmin && <EconomicDashboardCard />}
      {isAdmin && <CashFlowForecastCard />}
      {isAdmin && <StatsCard />}
      <RecentTasksTable />
      <RecentProjectsTable />
      <OneDriveStatusCard />
    </div>
  );
}
