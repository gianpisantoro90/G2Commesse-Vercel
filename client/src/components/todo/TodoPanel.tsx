import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectCombobox } from "@/components/ui/project-combobox";
import { TaskStatusBadge, PriorityBadge } from "@/components/ui/status-badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task, type Project, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Plus, CheckCircle2, Circle, XCircle, Clock, Trash2, AlertCircle, StickyNote, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Icon mapping for status (used for clickable toggle)
const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const statusIconColors = {
  pending: "text-gray-500 dark:text-gray-400",
  in_progress: "text-blue-600 dark:text-blue-400",
  completed: "text-green-600 dark:text-green-400",
  cancelled: "text-red-600 dark:text-red-400",
};

// Labels for selects
const statusLabels = {
  pending: "Da Fare",
  in_progress: "In Corso",
  completed: "Completata",
  cancelled: "Annullata",
};

const priorityLabels = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

export default function TodoPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  // Fetch projects for dropdown
  const { data: rawProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch users for assignment
  const { data: rawUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Ensure no empty IDs - critical for Radix UI Select in development mode
  const projects = (rawProjects || []).filter(p => p?.id && typeof p.id === 'string' && p.id.trim() !== '');
  const users = (rawUsers || []).filter(u => u?.id && typeof u.id === 'string' && u.id.trim() !== '');

  // Filter tasks
  const filteredTasks = tasks
    .filter(task => {
      if (activeTab === "my" && task.assignedToId !== user?.id) return false;
      if (activeTab === "created" && task.createdById !== user?.id) return false;
      if (filterProject && filterProject !== "all" && task.projectId !== filterProject) return false;
      if (filterStatus && filterStatus !== "all" && task.status !== filterStatus) return false;
      if (filterPriority && filterPriority !== "all" && task.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      // Completed tasks go to the bottom
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return 0;
    });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  // Reset to page 1 when filters change or items per page changes
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Reset page when filters change
  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertTaskSchema>) => {
      console.log('Creating task with data:', data);
      return await apiRequest('POST', '/api/tasks', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task creata con successo" });
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      console.error('Task creation error:', error);
      toast({
        title: "Errore nella creazione della task",
        description: error?.message || "Verifica i dati inseriti",
        variant: "destructive"
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      return await apiRequest('PATCH', `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task aggiornata con successo" });
      setIsDetailOpen(false);
    },
    onError: () => {
      toast({ title: "Errore nell'aggiornamento della task", variant: "destructive" });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task eliminata con successo" });
      setIsDetailOpen(false);
    },
    onError: () => {
      toast({ title: "Errore nell'eliminazione della task", variant: "destructive" });
    },
  });

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "Nessun progetto";
    const project = projects.find(p => p.id === projectId);
    return project?.code || "Progetto sconosciuto";
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "Non assegnata";
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.fullName || "Utente sconosciuto";
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  const getTaskCounts = () => {
    const myTasks = tasks.filter(t => t.assignedToId === user?.id && t.status !== 'completed' && t.status !== 'cancelled');
    const overdue = tasks.filter(t => isOverdue(t));
    const highPriority = tasks.filter(t => t.priority === 'high' && t.status !== 'completed' && t.status !== 'cancelled');
    
    return { myTasks: myTasks.length, overdue: overdue.length, highPriority: highPriority.length };
  };

  const counts = getTaskCounts();

  const toggleTaskExpansion = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  return (
    <div className="animate-fade-in" data-testid="todo-panel">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">To Do</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestisci le tue task e assegnazioni
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary hover:bg-secondary/90" data-testid="button-create-task">
              <Plus className="w-4 h-4 mr-2" />
              Nuova Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Crea Nuova Task</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Compila i dettagli per creare una nuova task
              </DialogDescription>
            </DialogHeader>
            <CreateTaskForm
              projects={projects}
              users={users}
              currentUserId={user?.id || ''}
              isAdmin={user?.role === 'admin'}
              onSubmit={(data) => createTaskMutation.mutate(data)}
              isPending={createTaskMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-3 mb-6">
        <div className="card-g2 p-4">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Le Mie Task</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{counts.myTasks}</p>
        </div>
        <div className="card-g2 p-4">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Scadute</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{counts.overdue}</p>
        </div>
        <div className="card-g2 p-4">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Alta Priorità</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{counts.highPriority}</p>
        </div>
      </div>

      {/* Tasks List */}
      <div className="card-g2">
        {/* Header with filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Visualizza e gestisci le task
              </p>
            </div>
          </div>

          {/* Filters - responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Select value={filterProject || "all"} onValueChange={handleFilterChange(setFilterProject)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                <SelectValue placeholder="Tutti i progetti" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="all" className="text-gray-900 dark:text-white">Tutti i progetti</SelectItem>
                {projects.map(p => p.id && p.id.trim() !== '' ? (
                  <SelectItem key={p.id} value={p.id} className="text-gray-900 dark:text-white">{p.code}</SelectItem>
                ) : null)}
              </SelectContent>
            </Select>
            <Select value={filterStatus || "all"} onValueChange={handleFilterChange(setFilterStatus)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="all" className="text-gray-900 dark:text-white">Tutti gli stati</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => key && key.trim() !== '' ? (
                  <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{label}</SelectItem>
                ) : null)}
              </SelectContent>
            </Select>
            <Select value={filterPriority || "all"} onValueChange={handleFilterChange(setFilterPriority)}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                <SelectValue placeholder="Tutte le priorità" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="all" className="text-gray-900 dark:text-white">Tutte le priorità</SelectItem>
                {Object.entries(priorityLabels).map(([key, label]) => key && key.trim() !== '' ? (
                  <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{label}</SelectItem>
                ) : null)}
              </SelectContent>
            </Select>
            <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="10" className="text-gray-900 dark:text-white">10 per pagina</SelectItem>
                <SelectItem value="25" className="text-gray-900 dark:text-white">25 per pagina</SelectItem>
                <SelectItem value="50" className="text-gray-900 dark:text-white">50 per pagina</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task content */}
        <div className="overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 dark:bg-gray-800 mb-4 shadow-sm w-full flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm px-2 sm:px-3 py-1.5 flex-1 min-w-0">
                <span className="truncate">Tutte</span>
                <span className="ml-1 tabular-nums">({filteredTasks.length})</span>
              </TabsTrigger>
              <TabsTrigger value="my" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm px-2 sm:px-3 py-1.5 flex-1 min-w-0">
                <span className="hidden sm:inline">Le Mie Task</span>
                <span className="sm:hidden">Mie</span>
                <span className="ml-1 tabular-nums">({tasks.filter(t => t.assignedToId === user?.id).length})</span>
              </TabsTrigger>
              <TabsTrigger value="created" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm px-2 sm:px-3 py-1.5 flex-1 min-w-0">
                <span className="hidden sm:inline">Create da Me</span>
                <span className="sm:hidden">Create</span>
                <span className="ml-1 tabular-nums">({tasks.filter(t => t.createdById === user?.id).length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {tasksLoading ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  Caricamento task...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <p>Nessuna task trovata</p>
                  <p className="text-sm">Crea una nuova task per iniziare</p>
                </div>
              ) : (
                <>
                  {/* Desktop View - visible on md+ */}
                  <div className="hidden md:block space-y-2">
                    {paginatedTasks.map(task => {
                      const StatusIcon = statusIcons[task.status as keyof typeof statusIcons];
                      const statusColor = statusIconColors[task.status as keyof typeof statusIconColors];
                      const overdueTask = isOverdue(task);
                      const isExpanded = expandedTasks.has(task.id);
                      const hasDescription = task.description && task.description.trim() !== '';
                      const isCompleted = task.status === 'completed';

                      return (
                        <div
                          key={task.id}
                          className={`rounded-lg border border-gray-200 dark:border-gray-700 transition-colors ${
                            isCompleted
                              ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          data-testid={`task-item-${task.id}`}
                        >
                          <div
                            onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
                            className="flex items-center gap-4 p-4 cursor-pointer"
                          >
                            {/* Status toggle icon */}
                            <div
                              className="flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                                updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } });
                              }}
                              title={task.status === 'completed' ? 'Segna come da fare' : 'Segna come completata'}
                            >
                              <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                            </div>

                            {/* Task info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold text-gray-900 dark:text-white truncate max-w-md">{task.title}</h4>
                                <PriorityBadge priority={task.priority as "high" | "medium" | "low"} />
                                {task.notes && task.notes.trim() !== '' && (
                                  <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800">
                                    <StickyNote className="w-3 h-3 mr-1" />
                                    Note
                                  </Badge>
                                )}
                                {overdueTask && (
                                  <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Scaduta
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                                <span className="font-mono text-xs">{getProjectName(task.projectId)}</span>
                                <span>•</span>
                                <span>{getUserName(task.assignedToId)}</span>
                                {task.dueDate && (
                                  <>
                                    <span>•</span>
                                    <span className={overdueTask ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                                      {format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: it })}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Status badge and expand */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <TaskStatusBadge status={task.status as "completed" | "in_progress" | "cancelled" | "pending"} />
                              {hasDescription && (
                                <button
                                  onClick={(e) => toggleTaskExpansion(task.id, e)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expandable description */}
                          {hasDescription && isExpanded && (
                            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
                              <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                <p className="font-medium text-gray-900 dark:text-white mb-1">Descrizione:</p>
                                {task.description}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile View - visible on small screens */}
                  <div className="md:hidden space-y-3">
                    {paginatedTasks.map(task => {
                      const StatusIcon = statusIcons[task.status as keyof typeof statusIcons];
                      const statusColor = statusIconColors[task.status as keyof typeof statusIconColors];
                      const overdueTask = isOverdue(task);
                      const isCompleted = task.status === 'completed';

                      return (
                        <div
                          key={task.id}
                          onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
                          className={`rounded-lg p-4 cursor-pointer transition-colors ${
                            isCompleted
                              ? 'bg-green-50 dark:bg-green-900/20'
                              : 'bg-gray-50 dark:bg-gray-800'
                          }`}
                          data-testid={`task-item-mobile-${task.id}`}
                        >
                          {/* Header: Title + Status toggle */}
                          <div className="flex items-start gap-3 mb-3">
                            <div
                              className="flex-shrink-0 mt-0.5 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                                updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } });
                              }}
                            >
                              <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2">{task.title}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                                {getProjectName(task.projectId)}
                              </p>
                            </div>
                          </div>

                          {/* Badges row */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <PriorityBadge priority={task.priority as "high" | "medium" | "low"} />
                            <TaskStatusBadge status={task.status as "completed" | "in_progress" | "cancelled" | "pending"} />
                            {overdueTask && (
                              <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800 text-xs">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Scaduta
                              </Badge>
                            )}
                          </div>

                          {/* Info grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div>
                              <p className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">Assegnato</p>
                              <p className="text-gray-600 dark:text-gray-400 truncate">{getUserName(task.assignedToId)}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">Scadenza</p>
                              <p className={`${overdueTask ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                                {task.dueDate ? format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: it }) : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Mostrando {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} di {filteredTasks.length} task
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline ml-1">Precedente</span>
                        </Button>
                        <div className="flex items-center gap-1 px-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {currentPage}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            / {totalPages}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        >
                          <span className="hidden sm:inline mr-1">Successivo</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Task Detail Dialog */}
      {selectedTask && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Dettagli Task</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Visualizza e modifica i dettagli della task
              </DialogDescription>
            </DialogHeader>
            <TaskDetailForm
              task={selectedTask}
              projects={projects}
              users={users}
              currentUserId={user?.id || ''}
              isAdmin={user?.role === 'admin'}
              onUpdate={(data) => updateTaskMutation.mutate({ id: selectedTask.id, data })}
              onDelete={() => deleteTaskMutation.mutate(selectedTask.id)}
              isPending={updateTaskMutation.isPending || deleteTaskMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Create Task Form Component
function CreateTaskForm({
  projects,
  users,
  currentUserId,
  isAdmin,
  onSubmit,
  isPending
}: {
  projects: Project[];
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  onSubmit: (data: z.infer<typeof insertTaskSchema>) => void;
  isPending: boolean;
}) {
  const form = useForm<z.infer<typeof insertTaskSchema>>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      notes: "",
      projectId: null,
      assignedToId: null,
      createdById: currentUserId,
      priority: "medium",
      status: "pending",
      dueDate: null,
    },
  });

  const handleSubmit = (data: z.infer<typeof insertTaskSchema>) => {
    // Validate that createdById is set
    if (!data.createdById || data.createdById.trim() === '') {
      console.error('Cannot create task: createdById is missing', { currentUserId, userData: data });
      return;
    }

    const submitData = {
      ...data,
      projectId: data.projectId === "none" ? null : data.projectId,
      assignedToId: data.assignedToId === "none" ? null : data.assignedToId,
    };
    console.log('Submitting task data:', submitData);
    onSubmit(submitData);
  };

  // Filter users list for non-admin: they can only assign to themselves
  const availableUsers = isAdmin ? users : users.filter(u => u.id === currentUserId);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-white">Titolo *</FormLabel>
              <FormControl>
                <Input {...field} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="input-task-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-white">Descrizione</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value || ''} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" rows={3} data-testid="textarea-task-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-white">Progetto</FormLabel>
                <FormControl>
                  <ProjectCombobox
                    projects={projects}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Cerca per codice..."
                    data-testid="select-task-project"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assignedToId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-white">Assegna a</FormLabel>
                <Select onValueChange={field.onChange} value={field.value && field.value !== '' ? field.value : undefined}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-task-assignee">
                      <SelectValue placeholder="Seleziona utente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="none" className="text-gray-900 dark:text-white">Non assegnata</SelectItem>
                    {availableUsers.map(u => u.id && u.id.trim() !== '' ? (
                      <SelectItem key={u.id} value={u.id} className="text-gray-900 dark:text-white">{u.fullName}</SelectItem>
                    ) : null)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-white">Priorità</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-white">Scadenza</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value && field.value !== null ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    data-testid="input-task-duedate"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isPending} className="bg-secondary hover:bg-secondary/90" data-testid="button-submit-task">
            {isPending ? "Creazione..." : "Crea Task"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Task Detail Form Component
function TaskDetailForm({
  task,
  projects,
  users,
  currentUserId,
  isAdmin,
  onUpdate,
  onDelete,
  isPending,
}: {
  task: Task;
  projects: Project[];
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  onUpdate: (data: Partial<Task>) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const form = useForm({
    defaultValues: {
      title: task.title,
      description: task.description || "",
      notes: task.notes || "",
      projectId: task.projectId || "none",
      assignedToId: task.assignedToId || "none",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate || null,
    },
  });

  const handleSubmit = (data: any) => {
    // If user is not admin, only send status and notes
    if (!canEditAllFields) {
      onUpdate({
        status: data.status,
        notes: data.notes,
      });
    } else {
      // Admin can update all fields
      onUpdate({
        ...data,
        projectId: data.projectId === "none" ? null : data.projectId,
        assignedToId: data.assignedToId === "none" ? null : data.assignedToId,
      });
    }
  };

  // Check if task is assigned to current user
  const isAssignedToCurrentUser = task.assignedToId === currentUserId;

  // Non-admin users can only edit tasks assigned to them, and only status and notes
  const canEdit = isAdmin || isAssignedToCurrentUser;
  const canEditAllFields = isAdmin;

  // Get user and project names
  const assignedUserName = task.assignedToId ? users.find(u => u.id === task.assignedToId)?.fullName || "Utente sconosciuto" : "Non assegnata";
  const projectName = task.projectId ? projects.find(p => p.id === task.projectId)?.code || "Progetto sconosciuto" : "Nessun progetto";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Status and Priority Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <TaskStatusBadge status={task.status as "completed" | "in_progress" | "cancelled" | "pending"} />
          <PriorityBadge priority={task.priority as "high" | "medium" | "low"} />
        </div>

        {/* Non-admin view: Show read-only fields for non-editable data */}
        {!canEditAllFields && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titolo</h3>
              <p className="text-gray-900 dark:text-white">{task.title}</p>
            </div>

            {task.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</h3>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Progetto</h3>
                <p className="text-gray-900 dark:text-white">{projectName}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assegnata a</h3>
                <p className="text-gray-900 dark:text-white">{assignedUserName}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priorità</h3>
                <p className="text-gray-900 dark:text-white">{priorityLabels[task.priority as keyof typeof priorityLabels]}</p>
              </div>

              {task.dueDate && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scadenza</h3>
                  <p className="text-gray-900 dark:text-white">{format(new Date(task.dueDate), 'dd MMM yyyy', { locale: it })}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin view: Show all editable fields */}
        {canEditAllFields && (
          <>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900 dark:text-white">Titolo</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="input-edit-task-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900 dark:text-white">Descrizione</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" rows={3} data-testid="textarea-edit-task-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Status - Editable for both admin and non-admin */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-white">Stato</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-edit-task-status">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes Section - Editable for both admin and non-admin */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-white">Note</FormLabel>
              <FormDescription className="text-gray-600 dark:text-gray-400">
                Aggiungi note o commenti per questa task
              </FormDescription>
              <FormControl>
                <Textarea {...field} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" rows={4} placeholder="Scrivi le tue note qui..." data-testid="textarea-task-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Admin-only fields */}
        {canEditAllFields && (
          <>
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900 dark:text-white">Priorità</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-edit-task-priority">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      {Object.entries(priorityLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-900 dark:text-white">Progetto</FormLabel>
                    <FormControl>
                      <ProjectCombobox
                        projects={projects}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Cerca per codice..."
                        data-testid="select-edit-task-project"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-900 dark:text-white">Assegna a</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value && field.value !== '' ? field.value : undefined}>
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-edit-task-assignee">
                          <SelectValue placeholder="Seleziona utente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectItem value="none" className="text-gray-900 dark:text-white">Non assegnata</SelectItem>
                        {users.map(u => u.id && u.id.trim() !== '' ? (
                          <SelectItem key={u.id} value={u.id} className="text-gray-900 dark:text-white">{u.fullName}</SelectItem>
                        ) : null)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900 dark:text-white">Scadenza</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value && field.value !== null ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      data-testid="input-edit-task-duedate"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Task Meta */}
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
          {task.createdAt && <p>Creata il: {format(new Date(task.createdAt), 'dd MMM yyyy HH:mm', { locale: it })}</p>}
          {task.updatedAt && <p>Ultima modifica: {format(new Date(task.updatedAt), 'dd MMM yyyy HH:mm', { locale: it })}</p>}
          {task.completedAt && (
            <p>Completata il: {format(new Date(task.completedAt), 'dd MMM yyyy HH:mm', { locale: it })}</p>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-4">
          {/* Only admin can delete tasks */}
          {isAdmin && (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={isPending} data-testid="button-delete-task">
              <Trash2 className="w-4 h-4 mr-2" />
              Elimina
            </Button>
          )}
          {!isAdmin && <div />}
          <Button type="submit" disabled={isPending || !canEdit} className="bg-secondary hover:bg-secondary/90" data-testid="button-update-task">
            {isPending ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
