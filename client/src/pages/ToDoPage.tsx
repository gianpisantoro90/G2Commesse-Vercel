import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/header";
import TabNavigation from "@/components/layout/tab-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task, type Project, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Plus, CheckCircle2, Circle, XCircle, Clock, Trash2, Edit, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type TaskWithRelations = Task & {
  projectName?: string;
  assignedToName?: string;
  createdByName?: string;
};

const statusConfig = {
  pending: { label: "Da Fare", icon: Circle, color: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
  in_progress: { label: "In Corso", icon: Clock, color: "bg-blue-200 dark:bg-blue-900 text-blue-700 dark:text-blue-300" },
  completed: { label: "Completata", icon: CheckCircle2, color: "bg-green-200 dark:bg-green-900 text-green-700 dark:text-green-300" },
  cancelled: { label: "Annullata", icon: XCircle, color: "bg-red-200 dark:bg-red-900 text-red-700 dark:text-red-300" },
};

const priorityConfig = {
  low: { label: "Bassa", color: "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-400 border-green-300 dark:border-green-800" },
  medium: { label: "Media", color: "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800" },
  high: { label: "Alta", color: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800" },
};

export default function ToDoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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
  const filteredTasks = tasks.filter(task => {
    if (activeTab === "my" && task.assignedToId !== user?.id) return false;
    if (activeTab === "created" && task.createdById !== user?.id) return false;
    if (filterProject && filterProject !== "all" && task.projectId !== filterProject) return false;
    if (filterStatus && filterStatus !== "all" && task.status !== filterStatus) return false;
    if (filterPriority && filterPriority !== "all" && task.priority !== filterPriority) return false;
    return true;
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertTaskSchema>) => {
      return await apiRequest('/api/tasks', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task creata con successo" });
      setIsCreateOpen(false);
    },
    onError: () => {
      toast({ title: "Errore nella creazione della task", variant: "destructive" });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      return await apiRequest(`/api/tasks/${id}`, 'PATCH', data);
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
      return await apiRequest(`/api/tasks/${id}`, 'DELETE');
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

  return (
    <div className="min-h-screen bg-g2-accent dark:bg-gray-950">
      <Header />
      
      <div className="max-w-7xl mx-auto">
        <TabNavigation
          activeTab="todo"
          onTabChange={() => {}}
          isAdmin={isAdmin}
        />

        <main className="p-6">
          <div className="animate-fade-in">
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
                    onSubmit={(data) => createTaskMutation.mutate(data)}
                    isPending={createTaskMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Le Mie Task</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{counts.myTasks}</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Scadute</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.overdue}</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Alta Priorità</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{counts.highPriority}</div>
                </CardContent>
              </Card>
            </div>

            {/* Tasks List */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-gray-900 dark:text-white">Task</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      Visualizza e gestisci le task
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterProject} onValueChange={setFilterProject}>
                      <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Tutti i progetti" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectItem value="all" className="text-gray-900 dark:text-white">Tutti i progetti</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-gray-900 dark:text-white">{p.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-40 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Tutti gli stati" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectItem value="all" className="text-gray-900 dark:text-white">Tutti gli stati</SelectItem>
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterPriority} onValueChange={setFilterPriority}>
                      <SelectTrigger className="w-40 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Tutte le priorità" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectItem value="all" className="text-gray-900 dark:text-white">Tutte le priorità</SelectItem>
                        {Object.entries(priorityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-gray-100 dark:bg-gray-800 mb-4">
                    <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
                      Tutte ({filteredTasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="my" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
                      Le Mie Task ({tasks.filter(t => t.assignedToId === user?.id).length})
                    </TabsTrigger>
                    <TabsTrigger value="created" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
                      Create da Me ({tasks.filter(t => t.createdById === user?.id).length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value={activeTab}>
                    {tasksLoading ? (
                      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                        Caricamento task...
                      </div>
                    ) : filteredTasks.length === 0 ? (
                      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                        Nessuna task trovata
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTasks.map(task => {
                          const statusInfo = statusConfig[task.status as keyof typeof statusConfig];
                          const priorityInfo = priorityConfig[task.priority as keyof typeof priorityConfig];
                          const StatusIcon = statusInfo.icon;
                          const overdueTask = isOverdue(task);

                          return (
                            <div
                              key={task.id}
                              onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
                              className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                              data-testid={`task-item-${task.id}`}
                            >
                              <div
                                className="flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                                  updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } });
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                title={task.status === 'completed' ? 'Segna come da fare' : 'Segna come completata'}
                              >
                                <StatusIcon className={`w-5 h-5 pointer-events-none ${statusInfo.color.includes('text-') ? statusInfo.color.split(' ').find(c => c.startsWith('text-')) : 'text-gray-600 dark:text-gray-400'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">{task.title}</h4>
                                  <Badge variant="outline" className={`${priorityInfo.color} flex-shrink-0`}>
                                    {priorityInfo.label}
                                  </Badge>
                                  {overdueTask && (
                                    <Badge variant="outline" className="bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-400 border-red-300 dark:border-red-800 flex-shrink-0">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      Scaduta
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                  <span>{getProjectName(task.projectId)}</span>
                                  <span>•</span>
                                  <span>Assegnata a: {getUserName(task.assignedToId)}</span>
                                  {task.dueDate && (
                                    <>
                                      <span>•</span>
                                      <span className={overdueTask ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                                        Scadenza: {format(new Date(task.dueDate), 'dd MMM yyyy', { locale: it })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
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
              onUpdate={(data) => updateTaskMutation.mutate({ id: selectedTask.id, data })}
              onDelete={() => deleteTaskMutation.mutate(selectedTask.id)}
              isPending={updateTaskMutation.isPending || deleteTaskMutation.isPending}
              isAdmin={isAdmin}
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
  onSubmit, 
  isPending 
}: { 
  projects: Project[]; 
  users: User[]; 
  currentUserId: string;
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-white">Progetto</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-task-project">
                      <SelectValue placeholder="Seleziona progetto" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="none" className="text-gray-900 dark:text-white">Nessun progetto</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-gray-900 dark:text-white">{p.code} - {p.object}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-task-assignee">
                      <SelectValue placeholder="Seleziona utente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="none" className="text-gray-900 dark:text-white">Non assegnata</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id} className="text-gray-900 dark:text-white">{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{config.label}</SelectItem>
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
  onUpdate,
  onDelete,
  isPending,
  isAdmin,
}: {
  task: Task;
  projects: Project[];
  users: User[];
  onUpdate: (data: Partial<Task>) => void;
  onDelete: () => void;
  isPending: boolean;
  isAdmin: boolean;
}) {
  const form = useForm({
    defaultValues: {
      title: task.title,
      description: task.description || "",
      notes: task.notes || "",
      projectId: task.projectId || "",
      assignedToId: task.assignedToId || "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate || null,
    },
  });

  const handleSubmit = (data: any) => {
    // For non-admin users, only send status and notes
    if (!isAdmin) {
      const payload = {
        status: data.status,
        notes: data.notes,
      };
      onUpdate(payload);
    } else {
      // For admin users, send all fields
      const payload = {
        ...data,
        projectId: data.projectId === "none" ? null : data.projectId,
        assignedToId: data.assignedToId === "none" ? null : data.assignedToId,
      };
      onUpdate(payload);
    }
  };

  const statusInfo = statusConfig[task.status as keyof typeof statusConfig];
  const priorityInfo = priorityConfig[task.priority as keyof typeof priorityConfig];
  const StatusIcon = statusInfo.icon;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Status and Priority Badges */}
        <div className="flex gap-2 mb-4">
          <Badge className={statusInfo.color}>
            <StatusIcon className="w-4 h-4 mr-1" />
            {statusInfo.label}
          </Badge>
          <Badge variant="outline" className={priorityInfo.color}>
            {priorityInfo.label}
          </Badge>
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-900 dark:text-white">Titolo</FormLabel>
              <FormControl>
                <Input {...field} disabled={!isAdmin} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed" data-testid="input-edit-task-title" />
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
                <Textarea {...field} disabled={!isAdmin} className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed" rows={3} data-testid="textarea-edit-task-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes Section */}
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

        <div className="grid grid-cols-2 gap-4">
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
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-white">Priorità</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed" data-testid="select-edit-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key} className="text-gray-900 dark:text-white">{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900 dark:text-white">Progetto</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined} disabled={!isAdmin}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed" data-testid="select-edit-task-project">
                      <SelectValue placeholder="Seleziona progetto" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="none" className="text-gray-900 dark:text-white">Nessun progetto</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-gray-900 dark:text-white">{p.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} value={field.value || undefined} disabled={!isAdmin}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed" data-testid="select-edit-task-assignee">
                      <SelectValue placeholder="Seleziona utente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="none" className="text-gray-900 dark:text-white">Non assegnata</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id} className="text-gray-900 dark:text-white">{u.fullName}</SelectItem>
                    ))}
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
                  disabled={!isAdmin}
                  value={field.value && field.value !== null ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="input-edit-task-duedate"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Task Meta */}
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p>Creata il: {format(new Date(task.createdAt), 'dd MMM yyyy HH:mm', { locale: it })}</p>
          <p>Ultima modifica: {format(new Date(task.updatedAt), 'dd MMM yyyy HH:mm', { locale: it })}</p>
          {task.completedAt && (
            <p>Completata il: {format(new Date(task.completedAt), 'dd MMM yyyy HH:mm', { locale: it })}</p>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-4">
          {isAdmin && (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={isPending} data-testid="button-delete-task">
              <Trash2 className="w-4 h-4 mr-2" />
              Elimina
            </Button>
          )}
          <Button type="submit" disabled={isPending} className="bg-secondary hover:bg-secondary/90 ml-auto" data-testid="button-update-task">
            {isPending ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
