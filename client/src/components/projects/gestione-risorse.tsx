import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Clock, TrendingUp, Trash2, Edit } from "lucide-react";
import { type Project } from "@shared/schema";

interface ProjectResource {
  id: string;
  projectId: string;
  userName: string;
  userEmail?: string;
  role: string;
  oreAssegnate: number;
  oreLavorate: number;
  costoOrario: number;
  isResponsabile: boolean;
  dataInizio?: string;
  dataFine?: string;
}

const ROLES = [
  { value: "progettista", label: "Progettista", icon: "📐" },
  { value: "dl", label: "Direttore Lavori", icon: "👷" },
  { value: "csp", label: "CSP - Coordinatore Sicurezza Progettazione", icon: "🦺" },
  { value: "cse", label: "CSE - Coordinatore Sicurezza Esecuzione", icon: "⚠️" },
  { value: "collaudatore", label: "Collaudatore", icon: "✅" },
  { value: "tecnico", label: "Tecnico", icon: "🔧" },
  { value: "geologo", label: "Geologo", icon: "🪨" },
  { value: "strutturista", label: "Ing. Strutturista", icon: "🏗️" },
  { value: "impiantista", label: "Ing. Impiantista", icon: "⚡" },
  { value: "altro", label: "Altro", icon: "👤" }
];

export default function GestioneRisorse() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ProjectResource | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    userName: "",
    userEmail: "",
    role: "progettista",
    oreAssegnate: 0,
    oreLavorate: 0,
    costoOrario: 0,
    isResponsabile: false,
    dataInizio: "",
    dataFine: ""
  });

  // Fetch progetti
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"]
  });

  // Fetch risorse
  const { data: resources, isLoading } = useQuery<ProjectResource[]>({
    queryKey: ["/api/project-resources"]
  });

  // Create/Update resource mutation
  const saveResourceMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingResource
        ? `/api/project-resources/${editingResource.id}`
        : "/api/project-resources";
      const method = editingResource ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });

      if (!res.ok) throw new Error("Errore nel salvataggio");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-resources"] });
      toast({
        title: editingResource ? "Risorsa aggiornata" : "Risorsa aggiunta",
        description: "La risorsa è stata salvata con successo"
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-resources/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-resources"] });
      toast({
        title: "Risorsa eliminata",
        description: "La risorsa è stata rimossa con successo"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      userName: "",
      userEmail: "",
      role: "progettista",
      oreAssegnate: 0,
      oreLavorate: 0,
      costoOrario: 0,
      isResponsabile: false,
      dataInizio: "",
      dataFine: ""
    });
    setSelectedProject("");
    setEditingResource(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProject) {
      toast({
        title: "Errore",
        description: "Seleziona una commessa",
        variant: "destructive"
      });
      return;
    }

    saveResourceMutation.mutate({
      projectId: selectedProject,
      ...formData,
      costoOrario: Math.round(formData.costoOrario * 100) // Converti in centesimi
    });
  };

  const handleEdit = (resource: ProjectResource) => {
    setEditingResource(resource);
    setSelectedProject(resource.projectId);
    setFormData({
      userName: resource.userName,
      userEmail: resource.userEmail || "",
      role: resource.role,
      oreAssegnate: resource.oreAssegnate,
      oreLavorate: resource.oreLavorate,
      costoOrario: resource.costoOrario / 100, // Converti da centesimi
      isResponsabile: resource.isResponsabile,
      dataInizio: resource.dataInizio?.split('T')[0] || "",
      dataFine: resource.dataFine?.split('T')[0] || ""
    });
    setIsDialogOpen(true);
  };

  // Calcola statistiche
  const projectResourceStats = projects?.map(project => {
    const projectResources = resources?.filter(r => r.projectId === project.id) || [];
    const totalOreAssegnate = projectResources.reduce((sum, r) => sum + r.oreAssegnate, 0);
    const totalOreLavorate = projectResources.reduce((sum, r) => sum + r.oreLavorate, 0);
    const totalCosti = projectResources.reduce((sum, r) => sum + (r.oreLavorate * r.costoOrario), 0);
    const responsabile = projectResources.find(r => r.isResponsabile);

    return {
      project,
      resources: projectResources,
      totalOreAssegnate,
      totalOreLavorate,
      totalCosti,
      responsabile,
      percentualeCompletamento: totalOreAssegnate > 0
        ? Math.round((totalOreLavorate / totalOreAssegnate) * 100)
        : 0
    };
  }) || [];

  const overallStats = {
    totalRisorse: resources?.length || 0,
    totalOreAssegnate: resources?.reduce((sum, r) => sum + r.oreAssegnate, 0) || 0,
    totalOreLavorate: resources?.reduce((sum, r) => sum + r.oreLavorate, 0) || 0,
    totalCosti: resources?.reduce((sum, r) => sum + (r.oreLavorate * r.costoOrario), 0) || 0
  };

  return (
    <div className="space-y-6">
      {/* Header con statistiche */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Risorse</h2>
          <p className="text-gray-600 mt-1">Assegnazione e monitoraggio risorse per commessa</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <UserPlus className="w-4 h-4 mr-2" />
              Assegna Risorsa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingResource ? "Modifica Risorsa" : "Assegna Nuova Risorsa"}</DialogTitle>
              <DialogDescription>
                Assegna una risorsa ad una commessa e definisci il ruolo e le ore stimate
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="project">Commessa *</Label>
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                  disabled={!!editingResource}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona commessa" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.object}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userName">Nome Risorsa *</Label>
                  <Input
                    id="userName"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={formData.userEmail}
                    onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">Ruolo *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.icon} {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="oreAssegnate">Ore Assegnate</Label>
                  <Input
                    id="oreAssegnate"
                    type="number"
                    value={formData.oreAssegnate}
                    onChange={(e) => setFormData({ ...formData, oreAssegnate: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="oreLavorate">Ore Lavorate</Label>
                  <Input
                    id="oreLavorate"
                    type="number"
                    value={formData.oreLavorate}
                    onChange={(e) => setFormData({ ...formData, oreLavorate: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="costoOrario">Costo Orario (€)</Label>
                  <Input
                    id="costoOrario"
                    type="number"
                    step="0.01"
                    value={formData.costoOrario}
                    onChange={(e) => setFormData({ ...formData, costoOrario: parseFloat(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dataInizio">Data Inizio</Label>
                  <Input
                    id="dataInizio"
                    type="date"
                    value={formData.dataInizio}
                    onChange={(e) => setFormData({ ...formData, dataInizio: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dataFine">Data Fine Prevista</Label>
                  <Input
                    id="dataFine"
                    type="date"
                    value={formData.dataFine}
                    onChange={(e) => setFormData({ ...formData, dataFine: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isResponsabile"
                  checked={formData.isResponsabile}
                  onChange={(e) => setFormData({ ...formData, isResponsabile: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isResponsabile" className="font-normal">
                  Responsabile di Commessa
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Annulla
                </Button>
                <Button type="submit" disabled={saveResourceMutation.isPending}>
                  {saveResourceMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiche Globali */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Risorse Totali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{overallStats.totalRisorse}</div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ore Assegnate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{overallStats.totalOreAssegnate}h</div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ore Lavorate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{overallStats.totalOreLavorate}h</div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Costi Totali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                €{(overallStats.totalCosti / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-2xl">💰</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabelle Risorse per Commessa */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Tutte le Risorse</TabsTrigger>
          <TabsTrigger value="by-project">Per Commessa</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tutte le Risorse</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-gray-500 py-8">Caricamento...</p>
              ) : resources?.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nessuna risorsa assegnata</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Risorsa</th>
                        <th className="text-left py-3 px-4">Commessa</th>
                        <th className="text-left py-3 px-4">Ruolo</th>
                        <th className="text-right py-3 px-4">Ore Ass./Lav.</th>
                        <th className="text-right py-3 px-4">Costo Orario</th>
                        <th className="text-right py-3 px-4">Costo Totale</th>
                        <th className="text-center py-3 px-4">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resources?.map(resource => {
                        const project = projects?.find(p => p.id === resource.projectId);
                        const roleInfo = ROLES.find(r => r.value === resource.role);
                        const costoTotale = resource.oreLavorate * resource.costoOrario;

                        return (
                          <tr key={resource.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-medium">{resource.userName}</div>
                                {resource.userEmail && (
                                  <div className="text-sm text-gray-500">{resource.userEmail}</div>
                                )}
                                {resource.isResponsabile && (
                                  <Badge variant="secondary" className="mt-1">Responsabile</Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm">
                                <div className="font-medium">{project?.code}</div>
                                <div className="text-gray-500 truncate max-w-xs">{project?.object}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">
                                {roleInfo?.icon} {roleInfo?.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="text-sm">
                                <div>{resource.oreLavorate}h / {resource.oreAssegnate}h</div>
                                <div className="text-gray-500">
                                  {resource.oreAssegnate > 0
                                    ? Math.round((resource.oreLavorate / resource.oreAssegnate) * 100)
                                    : 0}%
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              €{(resource.costoOrario / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              €{(costoTotale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(resource)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Sei sicuro di voler eliminare questa risorsa?")) {
                                      deleteResourceMutation.mutate(resource.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-project" className="space-y-4">
          {projectResourceStats.map(stat => (
            <Card key={stat.project.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{stat.project.code}</CardTitle>
                    <CardDescription className="mt-1">{stat.project.object}</CardDescription>
                  </div>
                  <div className="text-right">
                    {stat.responsabile && (
                      <div className="text-sm">
                        <div className="font-medium">Responsabile:</div>
                        <div className="text-gray-600">{stat.responsabile.userName}</div>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {stat.resources.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Nessuna risorsa assegnata</p>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-gray-600">Risorse</div>
                        <div className="text-xl font-bold">{stat.resources.length}</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-sm text-gray-600">Ore Assegnate</div>
                        <div className="text-xl font-bold">{stat.totalOreAssegnate}h</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-sm text-gray-600">Ore Lavorate</div>
                        <div className="text-xl font-bold">{stat.totalOreLavorate}h</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-sm text-gray-600">Costo Totale</div>
                        <div className="text-xl font-bold">
                          €{(stat.totalCosti / 100).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {stat.resources.map(resource => {
                        const roleInfo = ROLES.find(r => r.value === resource.role);
                        return (
                          <div key={resource.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-medium">{resource.userName}</div>
                                <div className="text-sm text-gray-500">{roleInfo?.icon} {roleInfo?.label}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right text-sm">
                                <div className="text-gray-600">Ore: {resource.oreLavorate}/{resource.oreAssegnate}</div>
                                <div className="font-medium">
                                  €{((resource.oreLavorate * resource.costoOrario) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(resource)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Sei sicuro di voler eliminare questa risorsa?")) {
                                      deleteResourceMutation.mutate(resource.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
