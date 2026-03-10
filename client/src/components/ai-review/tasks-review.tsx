import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckSquare, XCircle, User, Sparkles, CalendarClock, Mail,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "./confirm-dialog";
import { BulkActionBar } from "./bulk-action-bar";

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

interface FlatTask {
  comm: Communication;
  task: SuggestedTask;
  index: number;
  key: string;
}

export function TasksReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [confirmDismiss, setConfirmDismiss] = useState<{ items: FlatTask[] } | null>(null);

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

  // Flatten tasks from all communications
  const allTasks: FlatTask[] = communications.flatMap((comm) => {
    const suggestedTasks = comm.aiSuggestions?.suggestedTasks || [];
    const tasksStatus = comm.aiTasksStatus || {};
    return suggestedTasks
      .map((task, index) => ({
        comm,
        task,
        index,
        key: `${comm.id}-${index}`,
      }))
      .filter((_, idx) => {
        const status = tasksStatus[idx];
        return !status || (status.action as string) === 'pending';
      });
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
      toast({ title: "Task creato", description: `Il task "${data.task.title}" è stato creato` });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedTasks });
      queryClient.invalidateQueries({ queryKey: QK.tasks });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
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
      toast({ title: "Task rifiutato", description: "Il task suggerito è stato rifiutato" });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedTasks });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive' as const;
      case 'medium': return 'default' as const;
      case 'low': return 'secondary' as const;
      default: return 'default' as const;
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

  // Pagination
  const totalPages = Math.ceil(allTasks.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTasks = allTasks.slice(startIndex, endIndex);

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1);
    setSelectedKeys(new Set());
  };

  // Selection helpers
  const toggleSelection = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedKeys.size === paginatedTasks.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(paginatedTasks.map(t => t.key)));
    }
  };

  // Bulk actions
  const handleBulkDismiss = () => {
    const items = allTasks.filter(t => selectedKeys.has(t.key));
    setConfirmDismiss({ items });
  };

  const executeBulkDismiss = async () => {
    if (!confirmDismiss) return;
    try {
      for (const item of confirmDismiss.items) {
        await dismissTask.mutateAsync({ communicationId: item.comm.id, taskIndex: item.index });
      }
      setSelectedKeys(new Set());
    } finally {
      setConfirmDismiss(null);
    }
  };

  const handleBulkApprove = async () => {
    const items = allTasks.filter(t => selectedKeys.has(t.key));
    for (const item of items) {
      try {
        await approveTask.mutateAsync({
          communicationId: item.comm.id,
          taskIndex: item.index,
          assignedToId: selectedUsers[item.key],
        });
      } catch {
        // Error toast already shown by mutation
      }
    }
    setSelectedKeys(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Caricamento task...</p>
        </div>
      </div>
    );
  }

  if (allTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
        <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Nessun Task da Rivedere</h3>
          <p className="text-muted-foreground">
            Non ci sono task suggeriti dall'AI in attesa di revisione
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Badge variant="secondary" className="text-sm sm:text-base py-1 sm:py-1.5 px-2 sm:px-3">
          {allTasks.length} task da rivedere
        </Badge>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">Mostra:</span>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[80px] sm:w-[100px]">
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

      {/* Mobile: Card view */}
      {isMobile ? (
        <div className="space-y-3">
          {paginatedTasks.map(({ comm, task, index, key }) => (
            <Card key={key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedKeys.has(key)}
                    onCheckedChange={() => toggleSelection(key)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Task title + priority */}
                    <div className="flex items-start gap-2">
                      <CheckSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium line-clamp-2">{task.title}</span>
                          <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                            {getPriorityLabel(task.priority)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Due date */}
                    {task.dueDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        <span>{format(new Date(task.dueDate), "dd/MM/yy", { locale: it })}</span>
                      </div>
                    )}

                    {/* Communication + Project */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{comm.subject}</span>
                      </div>
                      {comm.aiSuggestions?.projectMatches?.[0] && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {comm.aiSuggestions.projectMatches[0].projectCode}
                        </Badge>
                      )}
                    </div>

                    {/* User assignment */}
                    <Select
                      value={selectedUsers[key] || ""}
                      onValueChange={(value) => setSelectedUsers(prev => ({ ...prev, [key]: value }))}
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Assegna a..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => approveTask.mutate({
                          communicationId: comm.id, taskIndex: index,
                          assignedToId: selectedUsers[key],
                        })}
                        disabled={approveTask.isPending}
                      >
                        <CheckSquare className="h-4 w-4 mr-1" />
                        Approva
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDismiss({ items: [{ comm, task, index, key }] })}
                        disabled={dismissTask.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop: Table view */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={paginatedTasks.length > 0 && selectedKeys.size === paginatedTasks.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="w-[28%]">Task</TableHead>
                  <TableHead className="w-[8%]">Priorità</TableHead>
                  <TableHead className="w-[10%]">Scadenza</TableHead>
                  <TableHead className="w-[18%]">Comunicazione</TableHead>
                  <TableHead className="w-[10%]">Progetto</TableHead>
                  <TableHead className="w-[14%]">Assegna</TableHead>
                  <TableHead className="w-[12%] text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.map(({ comm, task, index, key }) => (
                  <TableRow key={key}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedKeys.has(key)}
                        onCheckedChange={() => toggleSelection(key)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-start gap-2">
                        <CheckSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="line-clamp-2">{task.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                        {getPriorityLabel(task.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <div className="flex items-center gap-1 text-sm">
                          <CalendarClock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {format(new Date(task.dueDate), "dd/MM/yy", { locale: it })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{comm.subject}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {comm.aiSuggestions?.projectMatches?.[0] ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {comm.aiSuggestions.projectMatches[0].projectCode}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={selectedUsers[key] || ""}
                        onValueChange={(value) => setSelectedUsers(prev => ({ ...prev, [key]: value }))}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Assegna..." />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => approveTask.mutate({
                            communicationId: comm.id, taskIndex: index,
                            assignedToId: selectedUsers[key],
                          })}
                          disabled={approveTask.isPending}
                          title="Approva"
                        >
                          <CheckSquare className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDismiss({ items: [{ comm, task, index, key }] })}
                          disabled={dismissTask.isPending}
                          title="Rifiuta"
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Pagina {currentPage} di {totalPages} ({startIndex + 1}-{Math.min(endIndex, allTasks.length)} di {allTasks.length})
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Precedente</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <span className="hidden sm:inline mr-1">Successiva</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedKeys.size}
        totalCount={allTasks.length}
        onClearSelection={() => setSelectedKeys(new Set())}
        actions={[
          {
            label: "Approva selezionati",
            icon: <CheckSquare className="h-4 w-4" />,
            onClick: handleBulkApprove,
            disabled: approveTask.isPending,
          },
          {
            label: "Rifiuta selezionati",
            icon: <XCircle className="h-4 w-4" />,
            variant: "outline" as const,
            onClick: handleBulkDismiss,
            disabled: dismissTask.isPending,
          },
        ]}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmDismiss}
        onOpenChange={() => setConfirmDismiss(null)}
        title="Rifiuta task"
        description={confirmDismiss?.items.length === 1
          ? "Sei sicuro di voler rifiutare questo task? L'azione non è reversibile."
          : `Sei sicuro di voler rifiutare ${confirmDismiss?.items.length} task? L'azione non è reversibile.`}
        confirmLabel="Rifiuta"
        onConfirm={executeBulkDismiss}
        isPending={dismissTask.isPending}
      />
    </div>
  );
}
