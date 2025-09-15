import { useQuery } from "@tanstack/react-query";
import { type Project, type Client } from "@shared/schema";

export default function StatsCard() {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Calcola statistiche per status (usando i valori corretti del database)
  const projectsInCorso = projects.filter(p => p.status === "in_corso").length;
  const projectsSospese = projects.filter(p => p.status === "sospesa").length;
  const projectsConcluse = projects.filter(p => p.status === "conclusa").length;
  const totalProjects = projects.length;
  const totalClients = clients.length;

  return (
    <div className="card-g2" data-testid="stats-card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Stato Archivio</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-1">Commesse In Corso</div>
          <div className="text-3xl font-bold text-green-600" data-testid="stat-projects-active">
            {projectsInCorso}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-1">Commesse Sospese</div>
          <div className="text-3xl font-bold text-yellow-600" data-testid="stat-projects-suspended">
            {projectsSospese}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-1">Commesse Concluse</div>
          <div className="text-3xl font-bold text-blue-600" data-testid="stat-projects-completed">
            {projectsConcluse}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-1">Clienti Totali</div>
          <div className="text-3xl font-bold text-primary" data-testid="stat-clients">
            {totalClients}
          </div>
        </div>
      </div>
      <div className="text-center mb-4">
        <div className="text-sm text-gray-400 mb-1">Totale Commesse</div>
        <div className="text-2xl font-semibold text-gray-700" data-testid="stat-projects-total">
          {totalProjects}
        </div>
      </div>
      <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
        💾 Dati memorizzati localmente in IndexedDB
      </div>
    </div>
  );
}
