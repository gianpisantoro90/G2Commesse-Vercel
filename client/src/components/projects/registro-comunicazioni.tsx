import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { type Project } from "@shared/schema";
import {
  Mail,
  Phone,
  FileText,
  Users,
  MessageSquare,
  Send,
  Download,
  Star,
  MoreVertical,
  Trash2,
  Edit,
  Calendar,
  Clock,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Communication {
  id: string;
  projectId: string;
  projectCode?: string;
  projectClient?: string;
  type: 'email' | 'pec' | 'raccomandata' | 'telefono' | 'meeting' | 'nota_interna';
  direction: 'incoming' | 'outgoing' | 'internal';
  subject: string;
  body?: string;
  recipient?: string;
  sender?: string;
  attachments?: { name: string; size: number }[];
  tags?: string[];
  isImportant: boolean;
  communicationDate: Date;
  createdBy?: string;
}

const TYPE_CONFIG = {
  email: { label: 'Email', icon: <Mail className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700' },
  pec: { label: 'PEC', icon: <Mail className="h-4 w-4" />, color: 'bg-purple-100 text-purple-700' },
  raccomandata: { label: 'Raccomandata', icon: <FileText className="h-4 w-4" />, color: 'bg-red-100 text-red-700' },
  telefono: { label: 'Telefonata', icon: <Phone className="h-4 w-4" />, color: 'bg-green-100 text-green-700' },
  meeting: { label: 'Riunione', icon: <Users className="h-4 w-4" />, color: 'bg-orange-100 text-orange-700' },
  nota_interna: { label: 'Nota Interna', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-gray-100 text-gray-700' }
};

const DIRECTION_CONFIG = {
  outgoing: { label: 'Inviato', icon: <Send className="h-3 w-3" />, color: 'text-blue-600' },
  incoming: { label: 'Ricevuto', icon: <Download className="h-3 w-3" />, color: 'text-green-600' },
  internal: { label: 'Interno', icon: <MessageSquare className="h-3 w-3" />, color: 'text-gray-600' }
};

function CommunicationForm({
  onSubmit,
  initialData,
  projects
}: {
  onSubmit: (data: any) => void;
  initialData?: Partial<Communication>;
  projects: Project[];
}) {
  const [formData, setFormData] = useState({
    projectId: initialData?.projectId || '',
    type: initialData?.type || 'email',
    direction: initialData?.direction || 'outgoing',
    subject: initialData?.subject || '',
    body: initialData?.body || '',
    recipient: initialData?.recipient || '',
    sender: initialData?.sender || '',
    isImportant: initialData?.isImportant || false,
    communicationDate: initialData?.communicationDate || new Date(),
    tags: initialData?.tags || []
  });

  const [newTag, setNewTag] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validazione
    if (!formData.projectId) {
      alert("Seleziona una commessa");
      return;
    }
    if (!formData.subject.trim()) {
      alert("Inserisci l'oggetto della comunicazione");
      return;
    }

    // Converti la data in ISO string per il backend
    const dataToSubmit = {
      ...formData,
      communicationDate: new Date(formData.communicationDate).toISOString(),
    };

    onSubmit(dataToSubmit);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Commessa *</Label>
          <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona commessa..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.code} - {project.client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Data Comunicazione *</Label>
          <Input
            type="datetime-local"
            value={format(formData.communicationDate, "yyyy-MM-dd'T'HH:mm")}
            onChange={(e) => setFormData({ ...formData, communicationDate: new Date(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo Comunicazione *</Label>
          <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {config.icon} {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Direzione *</Label>
          <Select value={formData.direction} onValueChange={(value: any) => setFormData({ ...formData, direction: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIRECTION_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {config.icon} {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.direction === 'outgoing' && (
        <div className="space-y-2">
          <Label>Destinatario</Label>
          <Input
            value={formData.recipient}
            onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
            placeholder="Nome destinatario o email..."
          />
        </div>
      )}

      {formData.direction === 'incoming' && (
        <div className="space-y-2">
          <Label>Mittente</Label>
          <Input
            value={formData.sender}
            onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
            placeholder="Nome mittente o email..."
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Oggetto *</Label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Oggetto della comunicazione..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Contenuto/Note</Label>
        <Textarea
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          placeholder="Dettagli della comunicazione..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Aggiungi tag..."
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
          />
          <Button type="button" variant="outline" onClick={handleAddTag}>
            Aggiungi
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="important"
          checked={formData.isImportant}
          onCheckedChange={(checked) => setFormData({ ...formData, isImportant: !!checked })}
        />
        <label htmlFor="important" className="text-sm font-medium flex items-center gap-1">
          <Star className="h-4 w-4 text-yellow-500" />
          Segna come importante
        </label>
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full">
          {initialData ? 'Aggiorna Comunicazione' : 'Registra Comunicazione'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CommunicationCard({ comm, onEdit, onDelete }: {
  comm: Communication;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeConfig = TYPE_CONFIG[comm.type];
  const directionConfig = DIRECTION_CONFIG[comm.direction];

  return (
    <Card className={comm.isImportant ? 'border-yellow-300 bg-yellow-50' : ''}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={typeConfig.color}>
                  {typeConfig.icon} {typeConfig.label}
                </Badge>
                <Badge variant="outline" className={directionConfig.color}>
                  {directionConfig.icon} {directionConfig.label}
                </Badge>
                {comm.isImportant && (
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                )}
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">{comm.subject}</h4>
              {comm.body && (
                <p className="text-sm text-gray-600 line-clamp-3">{comm.body}</p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {(comm.recipient || comm.sender) && (
            <div className="text-sm text-gray-600">
              {comm.direction === 'outgoing' && `A: ${comm.recipient}`}
              {comm.direction === 'incoming' && `Da: ${comm.sender}`}
            </div>
          )}

          {comm.tags && comm.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {comm.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {comm.projectCode && (
            <div className="text-xs text-gray-500 pt-2 border-t">
              📁 {comm.projectCode} - {comm.projectClient}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(comm.communicationDate), 'dd MMM yyyy', { locale: it })}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(comm.communicationDate), 'HH:mm')}
            </div>
            {comm.createdBy && (
              <div className="ml-auto">
                👤 {comm.createdBy}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegistroComunicazioni() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComm, setEditingComm] = useState<Communication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showImportantOnly, setShowImportantOnly] = useState(false);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allCommunications = [] } = useQuery<Communication[]>({
    queryKey: ["/api/communications"],
  });

  // Enrich communications with project data
  const communications = allCommunications.map(comm => {
    const project = projects.find(p => p.id === comm.projectId);
    return {
      ...comm,
      projectCode: project?.code,
      projectClient: project?.client,
    };
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/communications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({
        title: "Comunicazione registrata",
        description: "La comunicazione è stata registrata con successo",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Errore nella creazione della comunicazione",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/communications/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({
        title: "Comunicazione aggiornata",
        description: "Le modifiche sono state salvate",
      });
      setEditingComm(null);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento della comunicazione",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/communications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({
        title: "Comunicazione eliminata",
        description: "La comunicazione è stata eliminata",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione della comunicazione",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: any) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: any) => {
    if (editingComm) {
      updateMutation.mutate({ id: editingComm.id, data });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Filtra comunicazioni
  const filteredComms = communications.filter(c => {
    if (searchTerm && !c.subject.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.body?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (filterDirection !== 'all' && c.direction !== filterDirection) return false;
    if (filterProject !== 'all' && c.projectId !== filterProject) return false;
    if (showImportantOnly && !c.isImportant) return false;
    return true;
  });

  // Stats
  const totalComms = communications.length;
  const importantComms = communications.filter(c => c.isImportant).length;
  const outgoingComms = communications.filter(c => c.direction === 'outgoing').length;
  const incomingComms = communications.filter(c => c.direction === 'incoming').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Registro Comunicazioni
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Traccia tutte le comunicazioni per ogni commessa
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuova Comunicazione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registra Nuova Comunicazione</DialogTitle>
              <DialogDescription>
                Aggiungi una comunicazione al registro
              </DialogDescription>
            </DialogHeader>
            <CommunicationForm onSubmit={handleCreate} projects={projects} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Totali</p>
                <p className="text-2xl font-bold">{totalComms}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Importanti</p>
                <p className="text-2xl font-bold text-yellow-600">{importantComms}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inviate</p>
                <p className="text-2xl font-bold text-blue-600">{outgoingComms}</p>
              </div>
              <ArrowUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ricevute</p>
                <p className="text-2xl font-bold text-green-600">{incomingComms}</p>
              </div>
              <ArrowDown className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cerca per oggetto o contenuto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tipi</SelectItem>
                  {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterDirection} onValueChange={setFilterDirection}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Direzione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="outgoing">Inviate</SelectItem>
                  <SelectItem value="incoming">Ricevute</SelectItem>
                  <SelectItem value="internal">Interne</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Commessa..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le commesse</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="important-only"
                checked={showImportantOnly}
                onCheckedChange={(checked) => setShowImportantOnly(!!checked)}
              />
              <label htmlFor="important-only" className="text-sm font-medium flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                Solo importanti
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista Comunicazioni */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredComms.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <MessageSquare className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Nessuna comunicazione trovata</p>
            <p className="text-sm text-gray-400 mt-1">Registra la prima comunicazione per iniziare</p>
          </div>
        ) : (
          filteredComms.map((comm) => (
            <CommunicationCard
              key={comm.id}
              comm={comm}
              onEdit={() => setEditingComm(comm)}
              onDelete={() => handleDelete(comm.id)}
            />
          ))
        )}
      </div>

      {/* Edit Dialog */}
      {editingComm && (
        <Dialog open={!!editingComm} onOpenChange={() => setEditingComm(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifica Comunicazione</DialogTitle>
              <DialogDescription>
                Aggiorna i dettagli della comunicazione
              </DialogDescription>
            </DialogHeader>
            <CommunicationForm
              onSubmit={handleUpdate}
              initialData={editingComm}
              projects={projects}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
