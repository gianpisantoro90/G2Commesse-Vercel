import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Client, type Project } from "@shared/schema";

export default function ClientsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientProjects, setSelectedClientProjects] = useState<Project[] | null>(null);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects for viewing client projects
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: (clientId: string) => apiRequest(`/api/clients/${clientId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cliente eliminato",
        description: "Il cliente è stato eliminato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore nell'eliminazione",
        description: error.message || "Impossibile eliminare il cliente",
        variant: "destructive",
      });
    },
  });

  const filteredClients = clients.filter(client =>
    client.sigla.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.city && client.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle view client projects
  const handleViewProjects = (client: Client) => {
    const clientProjects = allProjects.filter(project => project.client === client.sigla);
    setSelectedClientProjects(clientProjects);
    setShowProjectsModal(true);
  };

  // Handle delete client
  const handleDeleteClient = async (client: Client) => {
    const clientProjectsCount = allProjects.filter(project => project.client === client.sigla).length;
    
    if (clientProjectsCount > 0) {
      toast({
        title: "Impossibile eliminare",
        description: `Il cliente ${client.name} ha ${clientProjectsCount} commesse associate. Eliminare prima le commesse.`,
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Sei sicuro di voler eliminare il cliente "${client.name}"?`)) {
      deleteClientMutation.mutate(client.id);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl">⏳</div>
        <p>Caricamento clienti...</p>
      </div>
    );
  }

  return (
    <div data-testid="clients-table">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Anagrafica Clienti</h3>
        <div className="flex gap-3">
          <div className="relative">
            <Input
              placeholder="Cerca clienti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              data-testid="search-clients"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-lg">🔍</span>
          </div>
          <Button
            className="button-g2-primary"
            data-testid="add-client"
          >
            ➕ Nuovo Cliente
          </Button>
        </div>
      </div>
      
      {filteredClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-lg font-medium">
            {searchTerm ? "Nessun cliente trovato" : "Nessun cliente presente"}
          </p>
          <p className="text-sm">
            {searchTerm ? "Prova a modificare i criteri di ricerca" : "I clienti vengono creati automaticamente dalle commesse"}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm rounded-tl-lg">Sigla</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Nome Cliente</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">Città Principale</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm">N. Commesse</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 text-sm rounded-tr-lg">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 font-mono text-sm font-semibold text-primary" data-testid={`client-sigla-${client.id}`}>
                      {client.sigla}
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold" data-testid={`client-name-${client.id}`}>
                      {client.name}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600" data-testid={`client-city-${client.id}`}>
                      {client.city || "-"}
                    </td>
                    <td className="py-4 px-4" data-testid={`client-projects-count-${client.id}`}>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        (client.projectsCount || 0) > 5 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {client.projectsCount || 0}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifica"
                          onClick={() => toast({ title: "Funzionalità in sviluppo", description: "La modifica clienti sarà disponibile presto" })}
                          data-testid={`edit-client-${client.id}`}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Visualizza commesse"
                          onClick={() => handleViewProjects(client)}
                          data-testid={`view-client-projects-${client.id}`}
                        >
                          📋
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Elimina"
                          onClick={() => handleDeleteClient(client)}
                          disabled={deleteClientMutation.isPending}
                          data-testid={`delete-client-${client.id}`}
                        >
                          {deleteClientMutation.isPending ? '⏳' : '🗑️'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 text-sm text-gray-500" data-testid="clients-count">
            Mostrando <strong>{filteredClients.length}</strong> di <strong>{clients.length}</strong> clienti
          </div>
        </>
      )}

      {/* Projects Modal */}
      <Dialog open={showProjectsModal} onOpenChange={setShowProjectsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Commesse Cliente: {selectedClientProjects && selectedClientProjects.length > 0 
                ? allProjects.find(p => p.client === selectedClientProjects[0]?.client)?.client 
                : 'Cliente'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {selectedClientProjects && selectedClientProjects.length > 0 ? (
              <div className="space-y-2">
                {selectedClientProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {project.code}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.status === 'In Corso' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : project.status === 'Conclusa'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {project.object}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {project.city} • {project.year} • Template: {project.template}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-3xl mb-2">📋</div>
                <p>Nessuna commessa trovata per questo cliente</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowProjectsModal(false)}>
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
