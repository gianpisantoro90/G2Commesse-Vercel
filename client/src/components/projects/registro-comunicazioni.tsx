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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { type Project } from "@shared/schema";
import { ProjectCombobox } from "@/components/ui/project-combobox";
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
  ArrowUpDown,
  Plus,
  Search,
  Filter,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ProjectMatch {
  projectId: string;
  projectCode: string;
  confidence: number;
  reasoning: string;
  matchedFields: string[];
}

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
  // Email integration fields
  emailMessageId?: string;
  emailHeaders?: any;
  emailRaw?: string;
  emailHtml?: string;
  emailText?: string;
  autoImported?: boolean;
  aiSuggestions?: {
    projectCode?: string;
    projectId?: string;
    confidence: number;
    projectMatches?: ProjectMatch[];
    extractedData?: {
      deadlines?: string[];
      amounts?: string[];
      actionItems?: string[];
      keyPoints?: string[];
    };
    suggestedTags?: string[];
    isImportant?: boolean;
    summary?: string;
  };
  importedAt?: Date;
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
          <ProjectCombobox
            projects={projects}
            value={formData.projectId}
            onValueChange={(value) => setFormData({ ...formData, projectId: value || '' })}
            placeholder="Seleziona commessa..."
          />
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

function CommunicationCard({ comm, onEdit, onDelete, onSendEmail }: {
  comm: Communication;
  onEdit: () => void;
  onDelete: () => void;
  onSendEmail?: () => void;
}) {
  const typeConfig = TYPE_CONFIG[comm.type];
  const directionConfig = DIRECTION_CONFIG[comm.direction];
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  return (
    <Card className={comm.isImportant ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-950/20' : ''}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={typeConfig.color}>
                  {typeConfig.icon} {typeConfig.label}
                </Badge>
                <Badge variant="outline" className={directionConfig.color}>
                  {directionConfig.icon} {directionConfig.label}
                </Badge>
                {comm.isImportant && (
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400" />
                )}
                {/* Auto-imported indicator with AI confidence */}
                {comm.autoImported && comm.aiSuggestions && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-700 gap-1">
                    <Zap className="h-3 w-3" />
                    Auto-importata
                    {comm.aiSuggestions.confidence && (
                      <span className="ml-1 text-xs">
                        ({Math.round(comm.aiSuggestions.confidence * 100)}%)
                      </span>
                    )}
                  </Badge>
                )}
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{comm.subject}</h4>

              {/* AI Summary if available */}
              {comm.aiSuggestions?.summary && (
                <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-2 dark:bg-purple-950/30 dark:border-purple-700">
                  <p className="text-xs text-purple-900 dark:text-purple-300 flex items-start gap-1">
                    <Zap className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="italic">{comm.aiSuggestions.summary}</span>
                  </p>
                </div>
              )}

              {comm.body && (
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{comm.body}</p>
              )}

              {/* AI Extracted Data */}
              {comm.aiSuggestions?.extractedData && (
                <div className="mt-2 space-y-1">
                  {comm.aiSuggestions.extractedData.actionItems && comm.aiSuggestions.extractedData.actionItems.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-orange-700">Azioni:</span>
                      <ul className="list-disc list-inside ml-2 text-gray-600">
                        {comm.aiSuggestions.extractedData.actionItems.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {comm.aiSuggestions.extractedData.deadlines && comm.aiSuggestions.extractedData.deadlines.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-red-700">Scadenze:</span>
                      <span className="ml-1 text-gray-600">{comm.aiSuggestions.extractedData.deadlines.join(', ')}</span>
                    </div>
                  )}
                  {comm.aiSuggestions.extractedData.amounts && comm.aiSuggestions.extractedData.amounts.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-green-700">Importi:</span>
                      <span className="ml-1 text-gray-600">{comm.aiSuggestions.extractedData.amounts.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {comm.emailHtml && (
                  <DropdownMenuItem onClick={() => setShowEmailPreview(!showEmailPreview)}>
                    <Eye className="h-4 w-4 mr-2" />
                    {showEmailPreview ? 'Nascondi' : 'Mostra'} Email
                  </DropdownMenuItem>
                )}
                {(comm.type === 'email' || comm.type === 'pec') && onSendEmail && (
                  <DropdownMenuItem onClick={onSendEmail}>
                    <Send className="h-4 w-4 mr-2" />
                    Invia Email
                  </DropdownMenuItem>
                )}
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

          {/* Email HTML Preview */}
          {showEmailPreview && comm.emailHtml && (
            <div className="border rounded p-3 bg-gray-50 max-h-64 overflow-y-auto">
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                <Mail className="h-3 w-3" />
                Anteprima Email HTML
              </div>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: comm.emailHtml }}
              />
            </div>
          )}

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

          <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t flex-wrap">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(comm.communicationDate), 'dd MMM yyyy', { locale: it })}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(comm.communicationDate), 'HH:mm')}
            </div>
            {comm.importedAt && (
              <div className="flex items-center gap-1 text-purple-600">
                <CheckCircle2 className="h-3 w-3" />
                Importata {format(new Date(comm.importedAt), 'dd/MM HH:mm')}
              </div>
            )}
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

function EmailSendDialog({
  open,
  onOpenChange,
  replyTo
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: Communication;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    to: replyTo?.sender || '',
    subject: replyTo ? `Re: ${replyTo.subject}` : '',
    body: ''
  });

  const handleSend = async () => {
    if (!formData.to || !formData.subject) {
      toast({
        title: "Campi mancanti",
        description: "Inserisci destinatario e oggetto",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    try {
      const response = await apiRequest("POST", "/api/email/send", {
        to: formData.to,
        subject: formData.subject,
        text: formData.body,
        projectId: replyTo?.projectId
      });

      toast({
        title: "Email inviata",
        description: "L'email è stata inviata con successo"
      });

      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      onOpenChange(false);
      setFormData({ to: '', subject: '', body: '' });
    } catch (error) {
      toast({
        title: "Errore invio",
        description: "Impossibile inviare l'email",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invia Email</DialogTitle>
          <DialogDescription>
            Componi e invia un'email che verrà registrata automaticamente
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Destinatario *</Label>
            <Input
              type="email"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              placeholder="email@esempio.it"
            />
          </div>
          <div className="space-y-2">
            <Label>Oggetto *</Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Oggetto dell'email..."
            />
          </div>
          <div className="space-y-2">
            <Label>Messaggio</Label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Testo dell'email..."
              rows={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? (
              <>Invio...</>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Invia Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RegistroComunicazioni() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComm, setEditingComm] = useState<Communication | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [replyToComm, setReplyToComm] = useState<Communication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showImportantOnly, setShowImportantOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedComm, setSelectedComm] = useState<Communication | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Sorting states
  type SortField = 'subject' | 'type' | 'projectCode' | 'communicationDate';
  const [sortField, setSortField] = useState<SortField>('communicationDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allCommunications = [], isLoading: commsLoading, error: commsError } = useQuery<Communication[]>({
    queryKey: ["/api/communications"],
  });

  // Enrich communications with project data
  const communications = (allCommunications || []).map(comm => {
    const project = (projects || []).find(p => p.id === comm.projectId);
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

  const deleteMultipleMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/communications/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({
        title: "Comunicazioni eliminate",
        description: `${selectedIds.size} comunicazioni eliminate con successo`,
      });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione delle comunicazioni",
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

  const handleSelectOne = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedIds(newSelectedIds);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedComms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedComms.map(c => c.id)));
    }
  };

  const handleDeleteMultiple = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Elimina ${selectedIds.size} comunicazioni? Questa azione non può essere annullata.`)) {
      deleteMultipleMutation.mutate(Array.from(selectedIds));
    }
  };

  // Sorting handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline-block text-gray-400" />;
    }
    return sortOrder === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1 inline-block text-primary" />
      : <ArrowDown className="h-4 w-4 ml-1 inline-block text-primary" />;
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

  // Sort communications
  const sortedComms = [...filteredComms].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortField) {
      case 'subject':
        compareValue = a.subject.localeCompare(b.subject);
        break;
      case 'type':
        compareValue = a.type.localeCompare(b.type);
        break;
      case 'projectCode':
        compareValue = (a.projectCode || '').localeCompare(b.projectCode || '');
        break;
      case 'communicationDate':
        compareValue = new Date(a.communicationDate).getTime() - new Date(b.communicationDate).getTime();
        break;
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedComms.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedComms = sortedComms.slice(startIndex, endIndex);

  // Reset to page 1 when page size changes
  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1);
  };

  // Stats
  const totalComms = communications.length;
  const importantComms = communications.filter(c => c.isImportant).length;
  const outgoingComms = communications.filter(c => c.direction === 'outgoing').length;
  const incomingComms = communications.filter(c => c.direction === 'incoming').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Registro Comunicazioni
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
          <DialogContent className="w-full max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
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
        <div className="card-g2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Totali</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalComms}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="card-g2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Importanti</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{importantComms}</p>
            </div>
            <Star className="h-8 w-8 text-yellow-500 fill-yellow-500 dark:text-yellow-400 dark:fill-yellow-400" />
          </div>
        </div>

        <div className="card-g2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Inviate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{outgoingComms}</p>
            </div>
            <ArrowUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="card-g2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ricevute</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{incomingComms}</p>
            </div>
            <ArrowDown className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="card-g2">
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  placeholder="Cerca per oggetto o contenuto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px] dark:bg-gray-800 dark:border-gray-700">
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
              <SelectTrigger className="w-full sm:w-[150px] dark:bg-gray-800 dark:border-gray-700">
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
              <SelectTrigger className="w-full sm:w-[200px] dark:bg-gray-800 dark:border-gray-700">
                <SelectValue placeholder="Commessa..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le commesse</SelectItem>
                {(projects || []).map((p) => (
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
            <label htmlFor="important-only" className="text-sm font-medium flex items-center gap-1 text-gray-700 dark:text-gray-300">
              <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
              Solo importanti
            </label>
          </div>
        </div>
      </div>

      {/* Lista Comunicazioni */}
      <div className="space-y-4">
        {/* Header with page size selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-base py-1.5 px-3">
              {filteredComms.length} comunicazion{filteredComms.length === 1 ? "e" : "i"}
            </Badge>
            {selectedIds.size > 0 && (
              <Badge variant="destructive" className="text-base py-1.5 px-3">
                {selectedIds.size} selezionat{selectedIds.size === 1 ? "a" : "e"}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteMultiple}
                disabled={deleteMultipleMutation.isPending}
                data-testid="button-delete-multiple"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina ({selectedIds.size})
              </Button>
            )}
            <span className="text-sm text-muted-foreground">Mostra:</span>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[100px]">
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

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filteredComms.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Nessuna comunicazione trovata</p>
                <p className="text-sm text-gray-400 mt-1">Registra la prima comunicazione per iniziare</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5%]">
                      <Checkbox
                        checked={selectedIds.size === paginatedComms.length && paginatedComms.length > 0}
                        indeterminate={selectedIds.size > 0 && selectedIds.size < paginatedComms.length}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead 
                      className="w-[45%] cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('subject')}
                      data-testid="header-sort-subject"
                    >
                      Oggetto
                      <SortIcon field="subject" />
                    </TableHead>
                    <TableHead 
                      className="w-[12%] cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('type')}
                      data-testid="header-sort-type"
                    >
                      Tipo
                      <SortIcon field="type" />
                    </TableHead>
                    <TableHead className="w-[10%]">Mittente/Dest.</TableHead>
                    <TableHead 
                      className="w-[12%] cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('projectCode')}
                      data-testid="header-sort-project"
                    >
                      Commessa
                      <SortIcon field="projectCode" />
                    </TableHead>
                    <TableHead 
                      className="w-[10%] cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('communicationDate')}
                      data-testid="header-sort-date"
                    >
                      Data
                      <SortIcon field="communicationDate" />
                    </TableHead>
                    <TableHead className="w-[6%] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedComms.map((comm) => {
                    const typeConfig = TYPE_CONFIG[comm.type];
                    const directionConfig = DIRECTION_CONFIG[comm.direction];

                    return (
                      <TableRow
                        key={comm.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          comm.isImportant ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''
                        } ${selectedIds.has(comm.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                        onClick={() => setSelectedComm(comm)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(comm.id)}
                            onCheckedChange={() => handleSelectOne(comm.id)}
                            data-testid={`checkbox-communication-${comm.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-start gap-2">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="line-clamp-1">{comm.subject}</span>
                                {comm.isImportant && (
                                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400 flex-shrink-0" />
                                )}
                              </div>
                              {comm.tags && comm.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {comm.tags.slice(0, 2).map((tag: string, index: number) => (
                                    <Badge
                                      key={index}
                                      variant="outline"
                                      className="text-xs h-5 px-1.5"
                                    >
                                      #{tag}
                                    </Badge>
                                  ))}
                                  {comm.tags.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{comm.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                              {comm.autoImported && comm.aiSuggestions && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-700 text-xs h-5 px-1.5 gap-1">
                                  <Zap className="h-2 w-2" />
                                  Auto
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={`${typeConfig.color} text-xs w-fit`}>
                              {typeConfig.icon} {typeConfig.label}
                            </Badge>
                            <Badge variant="outline" className={`${directionConfig.color} text-xs w-fit`}>
                              {directionConfig.icon} {directionConfig.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">
                              {comm.direction === 'outgoing' ? comm.recipient : comm.sender}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{comm.projectCode}</div>
                            {comm.projectClient && (
                              <div className="text-xs text-muted-foreground truncate">
                                {comm.projectClient}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(comm.communicationDate), "dd/MM/yy", { locale: it })}
                            <div className="text-xs">
                              {format(new Date(comm.communicationDate), "HH:mm")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComm(comm);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizza
                              </DropdownMenuItem>
                              {(comm.type === 'email' || comm.type === 'pec') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setReplyToComm(comm);
                                  setEmailDialogOpen(true);
                                }}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Invia Email
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setEditingComm(comm);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifica
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(comm.id);
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Pagina {currentPage} di {totalPages} ({startIndex + 1}-{Math.min(endIndex, filteredComms.length)} di {filteredComms.length})
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Precedente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Successiva
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Communication Detail Dialog */}
      <Dialog open={!!selectedComm} onOpenChange={() => setSelectedComm(null)}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedComm?.subject}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>
                    {selectedComm?.direction === 'outgoing'
                      ? `A: ${selectedComm?.recipient || 'N/D'}`
                      : `Da: ${selectedComm?.sender || 'N/D'}`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {selectedComm && format(new Date(selectedComm.communicationDate), "dd MMM yyyy 'alle' HH:mm", {
                      locale: it,
                    })}
                  </span>
                </div>
                {selectedComm?.projectCode && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">📁 {selectedComm.projectCode}</span>
                    {selectedComm.projectClient && (
                      <span className="text-muted-foreground">- {selectedComm.projectClient}</span>
                    )}
                  </div>
                )}
              </div>
              {selectedComm?.tags && selectedComm.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedComm.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Email Content */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Contenuto</h4>
              <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded-lg max-h-[400px] overflow-y-auto">
                {selectedComm?.emailHtml ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedComm.emailHtml }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{selectedComm?.body}</p>
                )}
              </div>
            </div>

            {/* AI Summary if available */}
            {selectedComm?.aiSuggestions?.summary && (
              <div className="bg-purple-50 border border-purple-200 rounded p-3 dark:bg-purple-950/30 dark:border-purple-700">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-medium text-sm text-purple-900 dark:text-purple-300">AI Summary</h4>
                </div>
                <p className="text-sm text-purple-800 dark:text-purple-200 italic">
                  {selectedComm.aiSuggestions.summary}
                </p>
              </div>
            )}

            {/* AI Extracted Data */}
            {selectedComm?.aiSuggestions?.extractedData && (
              <div className="grid gap-3 md:grid-cols-2">
                {selectedComm.aiSuggestions.extractedData.actionItems &&
                 selectedComm.aiSuggestions.extractedData.actionItems.length > 0 && (
                  <div className="border rounded p-3">
                    <h4 className="font-medium text-sm mb-2 text-orange-700 dark:text-orange-400">Azioni</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {selectedComm.aiSuggestions.extractedData.actionItems.map((item, i) => (
                        <li key={i} className="text-gray-700 dark:text-gray-300">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedComm.aiSuggestions.extractedData.deadlines &&
                 selectedComm.aiSuggestions.extractedData.deadlines.length > 0 && (
                  <div className="border rounded p-3">
                    <h4 className="font-medium text-sm mb-2 text-red-700 dark:text-red-400">Scadenze</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedComm.aiSuggestions.extractedData.deadlines.join(', ')}
                    </p>
                  </div>
                )}
                {selectedComm.aiSuggestions.extractedData.amounts &&
                 selectedComm.aiSuggestions.extractedData.amounts.length > 0 && (
                  <div className="border rounded p-3">
                    <h4 className="font-medium text-sm mb-2 text-green-700 dark:text-green-400">Importi</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedComm.aiSuggestions.extractedData.amounts.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              {(selectedComm?.type === 'email' || selectedComm?.type === 'pec') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setReplyToComm(selectedComm);
                    setEmailDialogOpen(true);
                    setSelectedComm(null);
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Rispondi
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setEditingComm(selectedComm);
                  setSelectedComm(null);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Modifica
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedComm) {
                    handleDelete(selectedComm.id);
                    setSelectedComm(null);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Send Dialog */}
      <EmailSendDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        replyTo={replyToComm || undefined}
      />

      {/* Edit Dialog */}
      {editingComm && (
        <Dialog open={!!editingComm} onOpenChange={() => setEditingComm(null)}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
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
