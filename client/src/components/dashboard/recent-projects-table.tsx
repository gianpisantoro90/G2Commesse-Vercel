import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { Cloud, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { ProjectStatusBadge } from "@/components/ui/status-badge";
import { QK } from "@/lib/query-utils";

export default function RecentProjectsTable() {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: QK.projects,
  });

  const { isConnected, getSyncStatus } = useOneDriveSync();

  // Get OneDrive mappings to check if projects are already synced
  const { data: oneDriveMappings } = useQuery({
    queryKey: QK.onedriveMappings,
    enabled: isConnected
  }) as { data: any[] | undefined };

  // Get the 3 most recent projects
  const recentProjects = projects
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 3);

  const getOneDriveSyncIndicator = (project: Project) => {
    if (!isConnected) {
      return (
        <div className="flex items-center space-x-1 text-gray-400" title="OneDrive non configurato">
          <Cloud className="h-3 w-3 opacity-50" />
        </div>
      );
    }

    const syncStatus = getSyncStatus(project.id);
    
    // Check if project has OneDrive mapping (already synced on server)
    const hasOneDriveMapping = oneDriveMappings && Array.isArray(oneDriveMappings) 
      ? oneDriveMappings.some(mapping => mapping.projectCode === project.code)
      : false;
    
    switch (syncStatus.status) {
      case 'synced':
        return (
          <div className="flex items-center space-x-1 text-green-600" title="Sincronizzato con OneDrive">
            <Cloud className="h-3 w-3" />
            <CheckCircle className="h-3 w-3" />
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center space-x-1 text-blue-600" title="Sincronizzazione in corso">
            <Cloud className="h-3 w-3" />
            <RefreshCw className="h-3 w-3 animate-spin" />
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center space-x-1 text-red-600" title={`Errore: ${syncStatus.error || 'Sincronizzazione fallita'}`}>
            <Cloud className="h-3 w-3" />
            <AlertTriangle className="h-3 w-3" />
          </div>
        );
      default:
        // If no local sync status but has OneDrive mapping, show as synced
        if (hasOneDriveMapping) {
          return (
            <div className="flex items-center space-x-1 text-green-600" title="Sincronizzato con OneDrive">
              <Cloud className="h-3 w-3" />
              <CheckCircle className="h-3 w-3" />
            </div>
          );
        }
        // Otherwise, not synced yet
        return (
          <div className="flex items-center space-x-1 text-gray-400" title="Non ancora sincronizzato">
            <Cloud className="h-3 w-3 opacity-50" />
          </div>
        );
    }
  };

  return (
    <div className="card-g2" data-testid="recent-projects-table">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Commesse Recenti</h3>
        <Button variant="ghost" asChild className="text-primary hover:text-primary/80 font-medium text-sm whitespace-nowrap" data-testid="view-all-projects">
          <Link href="/commesse">Vedi Tutte →</Link>
        </Button>
      </div>
      
      {recentProjects.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📁</div>
          <p>Nessuna commessa presente</p>
          <p className="text-sm">Crea la prima commessa per iniziare</p>
        </div>
      ) : (
        <>
          {/* Desktop/Tablet: Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Codice</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Cliente</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Città</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Oggetto</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Status</th>
                  <th className="text-center py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">☁️</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map((project) => (
                  <tr key={project.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="py-3 px-2 sm:px-4 font-mono text-xs sm:text-sm font-semibold text-primary" data-testid={`project-code-${project.id}`}>
                      {project.code}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm dark:text-gray-300" data-testid={`project-client-${project.id}`}>
                      <div className="truncate">{project.client}</div>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400" data-testid={`project-city-${project.id}`}>
                      {project.city}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm dark:text-gray-300" data-testid={`project-object-${project.id}`}>
                      <div className="truncate">{project.object}</div>
                    </td>
                    <td className="py-3 px-2 sm:px-4" data-testid={`project-status-${project.id}`}>
                      <ProjectStatusBadge status={project.status as "in corso" | "conclusa" | "sospesa"} />
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-center" data-testid={`project-onedrive-${project.id}`}>
                      {getOneDriveSyncIndicator(project)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet: Cards */}
          <div className="lg:hidden space-y-3">
            {recentProjects.map((project) => (
              <div key={project.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-primary text-sm">{project.code}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{project.client}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{project.object}</div>
                  </div>
                  {getOneDriveSyncIndicator(project)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400">📍 {project.city}</div>
                  <ProjectStatusBadge status={project.status as "in corso" | "conclusa" | "sospesa"} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
