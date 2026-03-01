import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { usePaginatedQuery } from "@/lib/use-paginated-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Client, type Project } from "@shared/schema";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Schema for add form - minimal required fields
const addClientSchema = z.object({
  sigla: z.string().min(1, "Sigla è obbligatoria").max(10, "Sigla troppo lunga"),
  name: z.string().min(1, "Nome è obbligatorio"),
  formaGiuridica: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
});

type AddClientForm = z.infer<typeof addClientSchema>;

// Schema for edit form - includes all client fields
const editClientSchema = z.object({
  sigla: z.string().min(1, "Sigla è obbligatoria").max(10, "Sigla troppo lunga"),
  name: z.string().min(1, "Nome è obbligatorio"),

  // Dati Anagrafici
  partitaIva: z.string().max(16, "Partita IVA troppo lunga").optional().or(z.literal("")),
  codiceFiscale: z.string().max(16, "Codice Fiscale troppo lungo").optional().or(z.literal("")),
  formaGiuridica: z.string().optional().or(z.literal("")),

  // Indirizzo
  indirizzo: z.string().optional().or(z.literal("")),
  cap: z.string().max(5, "CAP non valido").optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  provincia: z.string().max(2, "Provincia deve essere di 2 caratteri").optional().or(z.literal("")),

  // Contatti
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  pec: z.string().email("PEC non valida").optional().or(z.literal("")),

  // Dati Amministrativi
  codiceDestinatario: z.string().max(7, "Codice Destinatario deve essere di 7 caratteri").optional().or(z.literal("")),

  // Referente
  nomeReferente: z.string().optional().or(z.literal("")),
  ruoloReferente: z.string().optional().or(z.literal("")),
  emailReferente: z.string().email("Email referente non valida").optional().or(z.literal("")),
  telefonoReferente: z.string().optional().or(z.literal("")),

  // Note
  note: z.string().optional().or(z.literal("")),
});

type EditClientForm = z.infer<typeof editClientSchema>;

export default function ClientsTable() {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClientProjects, setSelectedClientProjects] = useState<Project[] | null>(null);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounce search term (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Server-side paginated clients
  const {
    data: paginatedClients,
    total: totalClients,
    page: currentPage,
    pageSize: itemsPerPage,
    totalPages,
    setPage: setCurrentPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPage,
    isLoading,
    isFetching,
    refetch,
  } = usePaginatedQuery<Client>({
    basePath: '/api/clients',
    defaultPageSize: 10,
    search: debouncedSearch || undefined,
  });

  // Fetch projects for viewing client projects
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: QK.projects,
  });

  // Add client form
  const addForm = useForm<AddClientForm>({
    resolver: zodResolver(addClientSchema),
    defaultValues: {
      sigla: "",
      name: "",
      formaGiuridica: "",
      city: "",
      email: "",
      telefono: "",
    },
  });

  // Edit client form
  const editForm = useForm<EditClientForm>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      sigla: "",
      name: "",
      partitaIva: "",
      codiceFiscale: "",
      formaGiuridica: "",
      indirizzo: "",
      cap: "",
      city: "",
      provincia: "",
      email: "",
      telefono: "",
      pec: "",
      codiceDestinatario: "",
      nomeReferente: "",
      ruoloReferente: "",
      emailReferente: "",
      telefonoReferente: "",
      note: "",
    },
  });

  // Add client mutation
  const addClientMutation = useMutation({
    mutationFn: async (data: AddClientForm) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.clients });
      toast({
        title: "Cliente creato",
        description: "Il nuovo cliente è stato aggiunto con successo",
      });
      setShowAddModal(false);
      addForm.reset();
    },
    onError: (error: any) => {
      console.error("Add client error:", error);
      toast({
        title: "Errore nella creazione",
        description: error?.message || "Impossibile creare il cliente",
        variant: "destructive",
      });
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditClientForm }) => {
      const response = await apiRequest("PUT", `/api/clients/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.clients });
      queryClient.invalidateQueries({ queryKey: QK.projects });
      toast({
        title: "Cliente aggiornato",
        description: "Il cliente è stato aggiornato con successo",
      });
      setShowEditModal(false);
      setEditingClient(null);
      editForm.reset();
    },
    onError: (error: any) => {
      console.error("Update client error:", error);
      toast({
        title: "Errore nell'aggiornamento",
        description: error?.message || "Impossibile aggiornare il cliente",
        variant: "destructive",
      });
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Errore sconosciuto' }));
        throw new Error(errorData.message || `Errore HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.clients });
      queryClient.invalidateQueries({ queryKey: QK.projects });
      toast({
        title: "Cliente eliminato",
        description: "Il cliente è stato eliminato con successo",
      });
    },
    onError: (error: any) => {
      console.error("Delete client error:", error);
      toast({
        title: "Errore nell'eliminazione",
        description: error?.message || "Impossibile eliminare il cliente",
        variant: "destructive",
      });
    },
  });

  // Sync clients counts mutation
  const syncCountsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/clients/sync-counts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Errore sconosciuto' }));
        throw new Error(errorData.message || `Errore HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.clients });
      toast({
        title: "Sincronizzazione completata",
        description: "I conteggi delle commesse sono stati aggiornati",
      });
    },
    onError: (error: any) => {
      console.error("Sync counts error:", error);
      toast({
        title: "Errore nella sincronizzazione",
        description: error?.message || "Impossibile sincronizzare i conteggi",
        variant: "destructive",
      });
    },
  });

  // Pagination display calculations
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalClients);

  // Handle view client projects
  const handleViewProjects = (client: Client) => {
    // Filtro robusto: confronta case-insensitive e trimmed, gestisce null/undefined
    // IMPORTANTE: project.client contiene il NOME completo, non la sigla!
    const clientName = client.name?.trim().toLowerCase();
    const clientProjects = allProjects.filter(project => {
      const projectClient = project.client?.trim().toLowerCase();
      return projectClient && clientName && projectClient === clientName;
    });
    setSelectedClient(client);
    setSelectedClientProjects(clientProjects);
    setShowProjectsModal(true);
  };

  // Handle edit client
  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    editForm.reset({
      sigla: client.sigla,
      name: client.name,
      partitaIva: client.partitaIva || "",
      codiceFiscale: client.codiceFiscale || "",
      formaGiuridica: client.formaGiuridica || "",
      indirizzo: client.indirizzo || "",
      cap: client.cap || "",
      city: client.city || "",
      provincia: client.provincia || "",
      email: client.email || "",
      telefono: client.telefono || "",
      pec: client.pec || "",
      codiceDestinatario: client.codiceDestinatario || "",
      nomeReferente: client.nomeReferente || "",
      ruoloReferente: client.ruoloReferente || "",
      emailReferente: client.emailReferente || "",
      telefonoReferente: client.telefonoReferente || "",
      note: client.note || "",
    });
    setShowEditModal(true);
  };

  // Handle add form submit
  const handleAddSubmit = (data: AddClientForm) => {
    addClientMutation.mutate(data);
  };

  // Handle edit form submit
  const handleEditSubmit = (data: EditClientForm) => {
    if (editingClient) {
      updateClientMutation.mutate({
        id: editingClient.id,
        data,
      });
    }
  };

  // Handle delete client
  const handleDeleteClient = async (client: Client) => {
    // Filtro robusto: confronta case-insensitive e trimmed, gestisce null/undefined
    // IMPORTANTE: project.client contiene il NOME completo, non la sigla!
    const clientName = client.name?.trim().toLowerCase();
    const clientProjectsCount = allProjects.filter(project => {
      const projectClient = project.client?.trim().toLowerCase();
      return projectClient && clientName && projectClient === clientName;
    }).length;

    if (clientProjectsCount > 0) {
      toast({
        title: "Impossibile eliminare",
        description: `Il cliente ${client.name} ha ${clientProjectsCount} commesse associate. Eliminare prima le commesse.`,
        variant: "destructive",
      });
      return;
    }

    setClientToDelete(client);
  };

  const confirmDeleteClient = () => {
    if (clientToDelete) {
      deleteClientMutation.mutate(clientToDelete.id);
      setClientToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div data-testid="clients-table-loading">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 items-center p-4 bg-card rounded-lg border border-border">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-48 flex-1" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="clients-table">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h3 className="text-lg font-semibold text-foreground">Anagrafica Clienti</h3>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Input
              placeholder="Cerca clienti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background w-full"
              data-testid="search-clients"
            />
            <span className="absolute left-3 top-2.5 text-muted-foreground text-lg">🔍</span>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => syncCountsMutation.mutate()}
              disabled={syncCountsMutation.isPending}
              className="flex-1 sm:flex-none border-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900 text-xs sm:text-sm"
              data-testid="sync-counts"
              title="Sincronizza i conteggi delle commesse per tutti i clienti"
            >
              {syncCountsMutation.isPending ? '⏳' : '🔄'} <span className="hidden sm:inline">Sincronizza</span><span className="sm:hidden">Sync</span>
            </Button>
            <Button
              className="flex-1 sm:flex-none button-g2-primary text-xs sm:text-sm"
              data-testid="add-client"
              onClick={() => setShowAddModal(true)}
              disabled={addClientMutation.isPending}
            >
              {addClientMutation.isPending ? '⏳' : '➕'} <span className="hidden sm:inline">Nuovo Cliente</span><span className="sm:hidden">Nuovo</span>
            </Button>
          </div>
        </div>
      </div>
      
      {totalClients === 0 && !isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-2">👥</div>
          <p className="font-medium">
            {searchTerm ? "Nessun cliente trovato" : "Nessun cliente presente"}
          </p>
          <p className="text-sm">
            {searchTerm ? "Prova a modificare i criteri di ricerca" : "I clienti vengono creati automaticamente dalle commesse"}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW - Card Layout */}
          {isMobile ? (
            <div className="space-y-3" data-testid="clients-mobile-view">
              {paginatedClients.map((client) => (
                <div
                  key={client.id}
                  className="bg-card rounded-md border border-border p-4"
                  data-testid={`client-card-${client.id}`}
                >
                  {/* Header: Sigla + Projects Count */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono text-sm font-bold text-primary">{client.sigla}</span>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                        (client.projectsCount || 0) > 5
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {client.projectsCount || 0} commesse
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditClient(client)}>✏️</Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleViewProjects(client)}>📋</Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => handleDeleteClient(client)}>🗑️</Button>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="font-medium text-foreground mb-1">{client.name}</div>
                  {client.formaGiuridica && (
                    <div className="text-xs text-muted-foreground mb-2">
                      {client.formaGiuridica.replace(/_/g, ' ')}
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
                    {client.city && <span>📍 {client.city}</span>}
                    {client.email && <span>✉️ {client.email}</span>}
                    {client.telefono && <span>📞 {client.telefono}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
          /* DESKTOP VIEW - Table Layout */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-4 px-4 font-semibold text-foreground text-sm rounded-tl-lg">Sigla</th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground text-sm">Ragione Sociale</th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground text-sm">Email</th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground text-sm">Telefono</th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground text-sm">Città</th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground text-sm">N. Commesse</th>
                  <th className="text-left py-4 px-4 font-semibold text-foreground text-sm rounded-tr-lg">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-muted transition-colors">
                    <td className="py-4 px-4 font-mono text-sm font-semibold text-primary" data-testid={`client-sigla-${client.id}`}>
                      {client.sigla}
                    </td>
                    <td className="py-4 px-4 text-sm dark:text-foreground" data-testid={`client-name-${client.id}`}>
                      <div className="font-semibold">{client.name}</div>
                      {client.formaGiuridica && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {client.formaGiuridica.replace(/_/g, ' ')}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground" data-testid={`client-email-${client.id}`}>
                      {client.email || "-"}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground" data-testid={`client-telefono-${client.id}`}>
                      {client.telefono || "-"}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground" data-testid={`client-city-${client.id}`}>
                      {client.city || "-"}
                    </td>
                    <td className="py-4 px-4" data-testid={`client-projects-count-${client.id}`}>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        (client.projectsCount || 0) > 5
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {client.projectsCount || 0}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900 rounded-lg transition-colors"
                          title="Modifica"
                          onClick={() => handleEditClient(client)}
                          disabled={updateClientMutation.isPending}
                          data-testid={`edit-client-${client.id}`}
                        >
                          {updateClientMutation.isPending ? '⏳' : '✏️'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-2 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900 rounded-lg transition-colors"
                          title="Visualizza commesse"
                          onClick={() => handleViewProjects(client)}
                          data-testid={`view-client-projects-${client.id}`}
                        >
                          📋
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900 rounded-lg transition-colors"
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
          )}
          
          {/* Pagination Controls */}
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground" data-testid="clients-count">
                Mostrando <strong>{totalClients > 0 ? startIndex + 1 : 0}</strong>-<strong>{endIndex}</strong> di <strong>{totalClients}</strong> clienti
                {isFetching && <span className="ml-2 text-xs animate-pulse">Caricamento...</span>}
              </span>

              <div className="flex items-center gap-2">
                <label htmlFor="clients-items-per-page" className="text-muted-foreground">
                  Elementi per pagina:
                </label>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    changePageSize(parseInt(value) as 10 | 25 | 50);
                  }}
                >
                  <SelectTrigger id="clients-items-per-page" className="w-20" data-testid="clients-items-per-page-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">
                Pagina <strong>{currentPage}</strong> di <strong>{totalPages || 1}</strong>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  data-testid="clients-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Precedente</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages || totalPages === 0}
                  data-testid="clients-next-page"
                >
                  <span className="hidden sm:inline">Successiva</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Client Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aggiungi Nuovo Cliente</DialogTitle>
          </DialogHeader>

          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(handleAddSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="sigla"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sigla Cliente *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="es. ABC" maxLength={10} disabled={addClientMutation.isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="formaGiuridica"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma Giuridica</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={addClientMutation.isPending}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SRL">SRL</SelectItem>
                          <SelectItem value="SPA">SPA</SelectItem>
                          <SelectItem value="DITTA_INDIVIDUALE">Ditta Individuale</SelectItem>
                          <SelectItem value="ENTE_PUBBLICO">Ente Pubblico</SelectItem>
                          <SelectItem value="PRIVATO">Privato</SelectItem>
                          <SelectItem value="ALTRO">Altro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={addForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ragione Sociale *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome completo del cliente" disabled={addClientMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Città</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Roma" disabled={addClientMutation.isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="info@cliente.it" disabled={addClientMutation.isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={addForm.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" placeholder="+39 06 12345678" disabled={addClientMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  disabled={addClientMutation.isPending}
                  data-testid="button-cancel-add-client"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={addClientMutation.isPending}
                  data-testid="button-save-add-client"
                >
                  {addClientMutation.isPending ? "Creando..." : "Crea Cliente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Projects Modal */}
      <Dialog open={showProjectsModal} onOpenChange={setShowProjectsModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Commesse Cliente: {selectedClient?.name || 'Cliente'} ({selectedClient?.sigla})
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {selectedClientProjects && selectedClientProjects.length > 0 ? (
              <div className="space-y-2">
                {selectedClientProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="flex justify-between items-center p-4 border border-border rounded-lg hover:bg-muted"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {project.code}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.status === 'in corso'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : project.status === 'conclusa'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {project.object}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                        {project.city} • {project.year} • Template: {project.template}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
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

      {/* Edit Client Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Cliente</DialogTitle>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="bg-muted w-full flex-wrap h-auto gap-1 p-1">
                  <TabsTrigger value="general" className="flex-1 min-w-[70px] text-xs sm:text-sm data-[state=active]:bg-card dark:data-[state=active]:bg-card text-foreground">Generali</TabsTrigger>
                  <TabsTrigger value="address" className="flex-1 min-w-[70px] text-xs sm:text-sm data-[state=active]:bg-card dark:data-[state=active]:bg-card text-foreground">Indirizzo</TabsTrigger>
                  <TabsTrigger value="contacts" className="flex-1 min-w-[70px] text-xs sm:text-sm data-[state=active]:bg-card dark:data-[state=active]:bg-card text-foreground">Contatti</TabsTrigger>
                  <TabsTrigger value="referente" className="flex-1 min-w-[70px] text-xs sm:text-sm data-[state=active]:bg-card dark:data-[state=active]:bg-card text-foreground">Referente</TabsTrigger>
                </TabsList>

                {/* Tab Generali */}
                <TabsContent value="general" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="sigla"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sigla Cliente *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="es. ABC" maxLength={10} disabled={updateClientMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="formaGiuridica"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forma Giuridica</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={updateClientMutation.isPending}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="SRL">SRL</SelectItem>
                              <SelectItem value="SPA">SPA</SelectItem>
                              <SelectItem value="DITTA_INDIVIDUALE">Ditta Individuale</SelectItem>
                              <SelectItem value="ENTE_PUBBLICO">Ente Pubblico</SelectItem>
                              <SelectItem value="PRIVATO">Privato</SelectItem>
                              <SelectItem value="ALTRO">Altro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ragione Sociale *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome completo del cliente" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="partitaIva"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Partita IVA</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="IT12345678901" maxLength={16} disabled={updateClientMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="codiceFiscale"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Codice Fiscale</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="RSSMRA85M01H501Z" maxLength={16} disabled={updateClientMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="codiceDestinatario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Codice Destinatario SDI</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ABC1234" maxLength={7} disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Tab Indirizzo */}
                <TabsContent value="address" className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="indirizzo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indirizzo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Via, numero civico" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="cap"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CAP</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="00100" maxLength={5} disabled={updateClientMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Città</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Roma" disabled={updateClientMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="provincia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provincia</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="RM" maxLength={2} disabled={updateClientMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Tab Contatti */}
                <TabsContent value="contacts" className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Principale</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="info@cliente.it" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="pec"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PEC</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="pec@cliente.it" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="+39 06 12345678" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Note aggiuntive sul cliente..." rows={4} disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Tab Referente */}
                <TabsContent value="referente" className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="nomeReferente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Referente</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Mario Rossi" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="ruoloReferente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruolo/Funzione</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="es. Responsabile Tecnico, Amministratore..." disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="emailReferente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Referente</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="mario.rossi@cliente.it" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="telefonoReferente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono Referente</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="+39 333 1234567" disabled={updateClientMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={updateClientMutation.isPending}
                  data-testid="button-cancel-edit-client"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={updateClientMutation.isPending}
                  data-testid="button-save-edit-client"
                >
                  {updateClientMutation.isPending ? "Salvando..." : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il cliente?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>Sei sicuro di voler eliminare questo cliente?</div>
              {clientToDelete && (
                <div className="mt-3 p-3 bg-muted rounded-lg border border-border">
                  <div className="font-semibold text-sm mb-1 dark:text-foreground">
                    {clientToDelete.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sigla: <span className="font-mono font-semibold">{clientToDelete.sigla}</span>
                  </div>
                  {clientToDelete.city && (
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                      Città: {clientToDelete.city}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                    Commesse: {clientToDelete.projectsCount || 0}
                  </div>
                </div>
              )}
              <div className="text-red-600 dark:text-red-400 font-medium mt-2">
                ⚠️ Questa azione non può essere annullata.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClient}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 dark:bg-red-700 dark:hover:bg-red-800"
            >
              Elimina cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
