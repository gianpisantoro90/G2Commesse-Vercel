import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Project } from "@shared/schema";
import { ProjectCombobox } from "@/components/ui/project-combobox";
import {
  CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit,
  Bell,
  Calendar as CalendarClock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture, isToday, addDays } from "date-fns";
import { it } from "date-fns/locale";

interface Deadline {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  type: 'general' | 'deposito' | 'collaudo' | 'scadenza_assicurazione' | 'milestone';
  notifyDaysBefore?: number;
  completedAt?: Date;
  projectCode?: string;
  projectClient?: string;
}

const PRIORITY_CONFIG = {
  low: { label: 'Bassa', color: 'bg-muted text-foreground dark:bg-background dark:text-foreground', icon: '🟢' },
  medium: { label: 'Media', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', icon: '🟡' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', icon: '🟠' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: '🔴' }
};

const TYPE_CONFIG = {
  general: { label: 'Generale', icon: '📌' },
  deposito: { label: 'Deposito', icon: '📝' },
  collaudo: { label: 'Collaudo', icon: '✅' },
  scadenza_assicurazione: { label: 'Scadenza Assicurazione', icon: '🛡️' },
  milestone: { label: 'Milestone', icon: '🎯' }
};

function DeadlineForm({
  onSubmit,
  initialData,
  projects
}: {
  onSubmit: (data: any) => void;
  initialData?: Partial<Deadline>;
  projects: Project[];
}) {
  const [formData, setFormData] = useState({
    projectId: initialData?.projectId || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    dueDate: initialData?.dueDate ? new Date(initialData.dueDate) : new Date(),
    priority: initialData?.priority || 'medium',
    type: initialData?.type || 'general',
    notifyDaysBefore: initialData?.notifyDaysBefore || 7,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project">Commessa *</Label>
        <ProjectCombobox
          projects={projects}
          value={formData.projectId}
          onValueChange={(value) => setFormData({ ...formData, projectId: value || '' })}
          placeholder="Seleziona commessa..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Titolo Scadenza *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="es. Deposito progetto esecutivo"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrizione</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Note aggiuntive..."
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data Scadenza *</Label>
          <Calendar
            mode="single"
            selected={formData.dueDate}
            onSelect={(date) => date && setFormData({ ...formData, dueDate: date })}
            className="rounded-md border"
            locale={it}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo Scadenza *</Label>
            <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Priorità *</Label>
            <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notifica (giorni prima)</Label>
            <Input
              type="number"
              value={formData.notifyDaysBefore}
              onChange={(e) => setFormData({ ...formData, notifyDaysBefore: parseInt(e.target.value) || 0 })}
              min="0"
              max="90"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full">
          {initialData ? 'Aggiorna Scadenza' : 'Crea Scadenza'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeadlineCard({ deadline, onComplete, onDelete, onEdit }: {
  deadline: Deadline;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const isOverdue = isPast(new Date(deadline.dueDate)) && deadline.status === 'pending';
  const daysUntil = Math.ceil((new Date(deadline.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const isUpcoming = daysUntil <= (deadline.notifyDaysBefore || 7) && daysUntil > 0;

  const priorityConfig = PRIORITY_CONFIG[deadline.priority];
  const typeConfig = TYPE_CONFIG[deadline.type];

  return (
    <div className={`card-g2 ${
      isOverdue && deadline.status === 'pending' ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-950/20' :
      isUpcoming && deadline.status === 'pending' ? 'border-orange-300 bg-orange-50 dark:border-orange-600 dark:bg-orange-950/20' :
      deadline.status === 'completed' ? 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-950/20' :
      ''
    }`}>
      <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={priorityConfig.color}>
                  {priorityConfig.icon} {priorityConfig.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {typeConfig.icon} {typeConfig.label}
                </Badge>
              </div>
              <h4 className="font-semibold text-foreground mb-1">{deadline.title}</h4>
              {deadline.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{deadline.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span>{format(new Date(deadline.dueDate), 'dd MMM yyyy', { locale: it })}</span>
            </div>
            {deadline.status === 'pending' && (
              <div className={`flex items-center gap-1 ${
                isOverdue ? 'text-red-600' :
                isUpcoming ? 'text-orange-600' :
                'text-muted-foreground'
              }`}>
                <Clock className="h-4 w-4" />
                <span>
                  {isOverdue ? 'Scaduta' : formatDistanceToNow(new Date(deadline.dueDate), { addSuffix: true, locale: it })}
                </span>
              </div>
            )}
          </div>

          {deadline.projectCode && (
            <div className="text-xs text-muted-foreground">
              📁 {deadline.projectCode} - {deadline.projectClient}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t dark:border-border">
            {deadline.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={onComplete}
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Completa</span>
              </Button>
            )}
            {deadline.status === 'completed' && (
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Completata</span>
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
  );
}

export default function Scadenzario() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [deadlineToDelete, setDeadlineToDelete] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<10 | 25 | 50>(10);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Load deadlines from API
  const { data: deadlines = [] } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/deadlines", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      toast({
        title: "Scadenza creata",
        description: "La scadenza è stata creata con successo",
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione della scadenza",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/deadlines/${editingDeadline?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      toast({
        title: "Scadenza aggiornata",
        description: "Le modifiche sono state salvate",
      });
      setEditingDeadline(null);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento della scadenza",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (deadlineId: string) => {
      await apiRequest("PATCH", `/api/deadlines/${deadlineId}`, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      toast({
        title: "Scadenza completata",
        description: "La scadenza è stata marcata come completata",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel completamento della scadenza",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/deadlines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      toast({
        title: "Scadenza eliminata",
        description: "La scadenza è stata eliminata",
      });
      setDeadlineToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione della scadenza",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: any) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: any) => {
    updateMutation.mutate(data);
  };

  const handleComplete = (deadlineId: string) => {
    completeMutation.mutate(deadlineId);
  };

  const handleDelete = () => {
    if (!deadlineToDelete) return;
    deleteMutation.mutate(deadlineToDelete);
  };

  // Aggiungi projectCode e projectClient alle scadenze
  const enrichedDeadlines = deadlines.map(d => ({
    ...d,
    projectCode: projects.find(p => p.id === d.projectId)?.code,
    projectClient: projects.find(p => p.id === d.projectId)?.client,
  }));

  // Filtra scadenze
  const filteredDeadlines = enrichedDeadlines.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterPriority !== 'all' && d.priority !== filterPriority) return false;
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredDeadlines.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDeadlines = filteredDeadlines.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = (type: 'status' | 'priority', value: string) => {
    if (type === 'status') setFilterStatus(value);
    else setFilterPriority(value);
    setCurrentPage(1);
  };

  // Conta scadenze per categoria
  const overdueCount = enrichedDeadlines.filter(d => isPast(new Date(d.dueDate)) && d.status === 'pending').length;
  const upcomingCount = enrichedDeadlines.filter(d => {
    const daysUntil = Math.ceil((new Date(d.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 7 && daysUntil > 0 && d.status === 'pending';
  }).length;
  const completedCount = enrichedDeadlines.filter(d => d.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-blue-600" />
            Scadenzario Commesse
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestisci scadenze, milestone e notifiche per le tue commesse
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuova Scadenza</span>
              <span className="sm:hidden">Nuova</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crea Nuova Scadenza</DialogTitle>
              <DialogDescription>
                Aggiungi una nuova scadenza o milestone per una commessa
              </DialogDescription>
            </DialogHeader>
            <DeadlineForm onSubmit={handleCreate} projects={projects} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card-g2 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">Scadute</p>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100">{overdueCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="card-g2 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">In Scadenza (7gg)</p>
              <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">{upcomingCount}</p>
            </div>
            <Bell className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>

        <div className="card-g2 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">In Programma</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {enrichedDeadlines.filter(d => d.status === 'pending').length - overdueCount - upcomingCount}
              </p>
            </div>
            <CalendarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="card-g2 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">Completate</p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">{completedCount}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="card-g2">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-2 block text-foreground">Stato</Label>
            <Select value={filterStatus} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger className="dark:bg-background dark:border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le scadenze</SelectItem>
                <SelectItem value="pending">In Sospeso</SelectItem>
                <SelectItem value="completed">Completate</SelectItem>
                <SelectItem value="overdue">Scadute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-2 block text-foreground">Priorità</Label>
            <Select value={filterPriority} onValueChange={(v) => handleFilterChange('priority', v)}>
              <SelectTrigger className="dark:bg-background dark:border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le priorità</SelectItem>
                <SelectItem value="urgent">🔴 Urgente</SelectItem>
                <SelectItem value="high">🟠 Alta</SelectItem>
                <SelectItem value="medium">🟡 Media</SelectItem>
                <SelectItem value="low">🟢 Bassa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Mostra:</Label>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(v) => {
                setItemsPerPage(parseInt(v) as 10 | 25 | 50);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20 dark:bg-background dark:border-border">
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
      </div>

      {/* Lista Scadenze */}
      <div className="space-y-4">
        {/* Counter */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando <strong>{startIndex + 1}</strong>-<strong>{Math.min(endIndex, filteredDeadlines.length)}</strong> di <strong>{filteredDeadlines.length}</strong> scadenze
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedDeadlines.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <CalendarClock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nessuna scadenza trovata</p>
              <p className="text-sm text-muted-foreground mt-1">Crea la prima scadenza per iniziare</p>
            </div>
          ) : (
            paginatedDeadlines.map((deadline) => (
              <DeadlineCard
                key={deadline.id}
                deadline={deadline}
                onComplete={() => handleComplete(deadline.id)}
                onDelete={() => setDeadlineToDelete(deadline.id)}
                onEdit={() => setEditingDeadline(deadline)}
              />
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-muted-foreground">
              Pagina <strong>{currentPage}</strong> di <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Precedente</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline">Successiva</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingDeadline && (
        <Dialog open={!!editingDeadline} onOpenChange={() => setEditingDeadline(null)}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifica Scadenza</DialogTitle>
              <DialogDescription>
                Aggiorna i dettagli della scadenza
              </DialogDescription>
            </DialogHeader>
            <DeadlineForm
              onSubmit={handleUpdate}
              initialData={editingDeadline}
              projects={projects}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deadlineToDelete} onOpenChange={() => setDeadlineToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la scadenza?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La scadenza verrà eliminata definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
