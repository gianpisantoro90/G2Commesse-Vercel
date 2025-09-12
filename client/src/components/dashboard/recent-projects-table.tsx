import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

export default function RecentProjectsTable() {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { isConnected, getSyncStatus } = useOneDriveSync();

  // Get the 3 most recent projects
  const recentProjects = projects
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 3);

  const getStatusBadge = (project: Project) => {
    // Use the actual status from database to match the Gestione tab
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
        project.status === 'in_corso' 
          ? 'bg-yellow-100 text-yellow-800' 
          : project.status === 'conclusa'
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}>
        {project.status === 'in_corso' ? '🟡 In Corso' : 
         project.status === 'conclusa' ? '🟢 Conclusa' : 
         '🔴 Sospesa'}
      </span>
    );
  };

  const getOneDriveSyncIndicator = (project: Project) => {
    if (!isConnected) {
      return (
        <div className="flex items-center space-x-1 text-gray-400" title="OneDrive non configurato">
          <Cloud className="h-3 w-3 opacity-50" />
        </div>
      );
    }

    const syncStatus = getSyncStatus(project.id);
    
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
        return (
          <div className="flex items-center space-x-1 text-gray-400" title="Non ancora sincronizzato">
            <CloudOff className="h-3 w-3" />
          </div>
        );
    }
  };

  return (
    <div className="card-g2" data-testid="recent-projects-table">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Commesse Recenti</h3>
        <Button variant="ghost" className="text-primary hover:text-teal-700 font-medium text-sm" data-testid="view-all-projects">
          Vedi Tutte →
        </Button>
      </div>
      
      {recentProjects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📁</div>
          <p>Nessuna commessa presente</p>
          <p className="text-sm">Crea la prima commessa per iniziare</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Codice</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Cliente</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Città</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Oggetto</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Status</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 text-sm">☁️</th>
              </tr>
            </thead>
            <tbody>
              {recentProjects.map((project) => (
                <tr key={project.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-sm font-semibold text-primary" data-testid={`project-code-${project.id}`}>
                    {project.code}
                  </td>
                  <td className="py-3 px-4 text-sm" data-testid={`project-client-${project.id}`}>
                    {project.client}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600" data-testid={`project-city-${project.id}`}>
                    {project.city}
                  </td>
                  <td className="py-3 px-4 text-sm" data-testid={`project-object-${project.id}`}>
                    {project.object}
                  </td>
                  <td className="py-3 px-4" data-testid={`project-status-${project.id}`}>
                    {getStatusBadge(project)}
                  </td>
                  <td className="py-3 px-4 text-center" data-testid={`project-onedrive-${project.id}`}>
                    {getOneDriveSyncIndicator(project)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
