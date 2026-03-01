import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { getQueryFn } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CheckSquare,
  XCircle,
  Clock,
  User,
  AlertTriangle,
  Sparkles,
  CalendarClock,
  FileText,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SuggestedTask {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  reasoning: string;
}

interface Communication {
  id: string;
  subject: string;
  sender: string;
  communicationDate: string;
  projectId?: string;
  aiSuggestions: {
    suggestedTasks?: SuggestedTask[];
    projectMatches?: Array<{
      projectCode: string;
      confidence: number;
    }>;
  };
  aiTasksStatus?: Record<number, {
    action: 'approved' | 'dismissed';
    taskId?: string;
    approvedAt?: string;
    dismissedAt?: string;
  }>;
}

export function TasksReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>({});

  // Fetch communications with suggested tasks
  const { data: communications = [], isLoading } = useQuery<Communication[]>({
    queryKey: QK.aiSuggestedTasks,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery<any[]>({
    queryKey: QK.users,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Approve task mutation
  const approveTask = useMutation({
    mutationFn: async ({ communicationId, taskIndex, assignedToId }: { communicationId: string; taskIndex: number; assignedToId?: string }) => {
      const res = await fetch("/api/ai/suggested-tasks/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ communicationId, taskIndex, assignedToId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Errore nell'approvazione del task");
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Task creato",
        description: `Il task "${data.task.title}" è stato creato con successo`,
      });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedTasks });
      queryClient.invalidateQueries({ queryKey: QK.tasks });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Dismiss task mutation
  const dismissTask = useMutation({
    mutationFn: async ({ communicationId, taskIndex }: { communicationId: string; taskIndex: number }) => {
      const res = await fetch("/api/ai/suggested-tasks/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ communicationId, taskIndex }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Errore nel rifiuto del task");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Task rifiutato",
        description: "Il task suggerito è stato rifiutato",
      });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedTasks });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Bassa';
      default: return priority;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="p-4 bg-green-100 rounded-full">
          <CheckSquare className="h-12 w-12 text-green-600" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Nessun Task da Rivedere</h3>
          <p className="text-muted-foreground max-w-md">
            Ottimo! Non ci sono task suggeriti dall'AI che richiedono la tua revisione.
            I task appariranno qui quando l'AI identificherà azioni da intraprendere nelle comunicazioni.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Task Proposte dall'AI</h3>
          <p className="text-sm text-muted-foreground">
            {communications.length} comunicazion{communications.length === 1 ? 'e' : 'i'} con task suggeriti
          </p>
        </div>
        <Badge variant="outline" className="h-7 sm:h-8">
          <Sparkles className="h-3 w-3 mr-1" />
          AI Analysis
        </Badge>
      </div>

      <div className="space-y-4">
        {communications.map((comm) => {
          const suggestedTasks = comm.aiSuggestions?.suggestedTasks || [];
          const tasksStatus = comm.aiTasksStatus || {};
          const pendingTasks = suggestedTasks.filter((_, idx) => !tasksStatus[idx] || (tasksStatus[idx].action as string) === 'pending');

          if (pendingTasks.length === 0) return null;

          return (
            <div key={comm.id} className="card-g2">
              <div className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {comm.subject}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        Da: {comm.sender}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {format(new Date(comm.communicationDate), "dd MMM yyyy 'alle' HH:mm", { locale: it })}
                      </div>
                      {comm.aiSuggestions?.projectMatches?.[0] && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            Progetto: {comm.aiSuggestions.projectMatches[0].projectCode}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {suggestedTasks.map((task, taskIndex) => {
                  const taskStatus = tasksStatus[taskIndex];

                  // Skip if already processed
                  if (taskStatus && (taskStatus.action as string) !== 'pending') return null;

                  const key = `${comm.id}-${taskIndex}`;

                  return (
                    <div key={taskIndex} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                            <h4 className="font-semibold">{task.title}</h4>
                            <Badge variant={getPriorityColor(task.priority)}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                          </div>

                          {task.description && (
                            <p className="text-sm text-muted-foreground pl-6">
                              {task.description}
                            </p>
                          )}

                          {task.dueDate && (
                            <div className="flex items-center gap-2 pl-6 text-sm">
                              <CalendarClock className="h-3 w-3" />
                              <span>Scadenza: {format(new Date(task.dueDate), "dd MMM yyyy", { locale: it })}</span>
                            </div>
                          )}

                          <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                              <strong>Perché l'AI suggerisce questo task:</strong><br />
                              {task.reasoning}
                            </AlertDescription>
                          </Alert>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Select
                            value={selectedUsers[key] || ""}
                            onValueChange={(value) =>
                              setSelectedUsers(prev => ({ ...prev, [key]: value }))
                            }
                          >
                            <SelectTrigger className="w-full sm:w-[180px]">
                              <SelectValue placeholder="Assegna a..." />
                            </SelectTrigger>
                            <SelectContent>
                              {users.map((user: any) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.username}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-initial"
                            onClick={() => dismissTask.mutate({ communicationId: comm.id, taskIndex })}
                            disabled={dismissTask.isPending}
                          >
                            <XCircle className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Rifiuta</span>
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-initial"
                            onClick={() => approveTask.mutate({
                              communicationId: comm.id,
                              taskIndex,
                              assignedToId: selectedUsers[key]
                            })}
                            disabled={approveTask.isPending}
                          >
                            <CheckSquare className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Approva e Crea Task</span>
                            <span className="sm:hidden">Approva</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
