import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Project } from "@shared/schema";

export default function ProjectsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, refetch } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Commessa eliminata",
        description: "La commessa è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: () => {
      toast({
        title: "Errore nell'eliminazione",
        description: "Si è verificato un errore durante l'eliminazione della commessa",
        variant: "destructive",
      });
    },
  });

  const filteredProjects = projects.filter(project =>
    project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.object.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteProject = (project: Project) => {
    if (confirm(`Sei sicuro di voler eliminare la commessa ${project.code}?`)) {
      deleteProjectMutation.mutate(project.id);
    }
  };

  const handleExportProject = (project: Project) => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Esportazione completata",
      description: `Commessa ${project.code} esportata con successo`,
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl">⏳</div>
        <p>Caricamento commesse...</p>
      </div>
    );
  }

  return (
    <div data-testid="projects-table">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Tutte le Commesse</h3>
        <div className="flex gap-3">
          <div className="relative">
            <Input
              placeholder="Cerca commesse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              data-testid="search-projects"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-lg">🔍</span>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="button-g2-secondary"
            data-testid="refresh-projects"
          >
            🔄 Aggiorna
          </Button>
        </div>
      </div>
      
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">📁</div>
          <p className="text-lg font-medium">
            {searchTerm ? "Nessuna commessa trovata" : "Nessuna commessa presente"}
          </p>
          <p className="text-sm">
            {searchTerm ? "Prova a modificare i criteri di ricerca" : "Crea la prima commessa per iniziare"}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm rounded-tl-lg">Codice</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Cliente</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Città</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Oggetto</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Anno</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Template</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Stato</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm rounded-tr-lg">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 font-mono text-sm font-semibold text-primary" data-testid={`project-code-${project.id}`}>
                      {project.code}
                    </td>
                    <td className="py-4 px-4 text-sm" data-testid={`project-client-${project.id}`}>
                      {project.client}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600" data-testid={`project-city-${project.id}`}>
                      {project.city}
                    </td>
                    <td className="py-4 px-4 text-sm" data-testid={`project-object-${project.id}`}>
                      {project.object}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600" data-testid={`project-year-${project.id}`}>
                      20{project.year.toString().padStart(2, '0')}
                    </td>
                    <td className="py-4 px-4" data-testid={`project-template-${project.id}`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        project.template === 'LUNGO' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {project.template}
                      </span>
                    </td>
                    <td className="py-4 px-4" data-testid={`project-status-${project.id}`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifica"
                          data-testid={`edit-project-${project.id}`}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportProject(project)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Esporta"
                          data-testid={`export-project-${project.id}`}
                        >
                          📄
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteProject(project)}
                          disabled={deleteProjectMutation.isPending}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Elimina"
                          data-testid={`delete-project-${project.id}`}
                        >
                          🗑️
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 flex justify-between items-center text-sm text-gray-500">
            <span data-testid="projects-count">
              Mostrando <strong>{filteredProjects.length}</strong> di <strong>{projects.length}</strong> commesse
            </span>
          </div>
        </>
      )}
    </div>
  );
}
