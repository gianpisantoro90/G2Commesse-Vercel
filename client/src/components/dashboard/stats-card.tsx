import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { type Project, type Client } from "@shared/schema";

export default function StatsCard() {
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Calcola statistiche per status (usando i valori corretti del database)
  const projectsInCorso = projects.filter(p => p.status === "in_corso").length;
  const projectsSospese = projects.filter(p => p.status === "sospesa").length;
  const projectsConcluse = projects.filter(p => p.status === "conclusa").length;
  const totalProjects = projects.length;
  const totalClients = clients.length;

  const isLoading = isLoadingProjects || isLoadingClients;

  if (isLoading) {
    return (
      <div className="card-g2" data-testid="stats-card-loading">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-4 w-24 mx-auto mb-2" />
              <Skeleton className="h-9 w-16 mx-auto" />
            </div>
          ))}
        </div>
        <div className="text-center mb-4">
          <Skeleton className="h-4 w-28 mx-auto mb-2" />
          <Skeleton className="h-8 w-12 mx-auto" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="card-g2" data-testid="stats-card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stato Archivio</h3>
      <div className="grid grid-cols-1 gap-3 mb-6">
        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Commesse In Corso</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Attività in corso</div>
          </div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="stat-projects-active">
            {projectsInCorso}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Commesse Sospese</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">In sospensione</div>
          </div>
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="stat-projects-suspended">
            {projectsSospese}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Commesse Concluse</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completate</div>
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-projects-completed">
            {projectsConcluse}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Clienti Totali</div>
          <div className="text-2xl font-bold text-primary" data-testid="stat-clients">
            {totalClients}
          </div>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Totale Commesse</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="stat-projects-total">
            {totalProjects}
          </div>
        </div>
      </div>
    </div>
  );
}
