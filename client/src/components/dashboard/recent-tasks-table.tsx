import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Task, type Project, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { TaskStatusBadge, PriorityBadge } from "@/components/ui/status-badge";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { QK } from "@/lib/query-utils";
import { cn } from "@/lib/utils";

export default function RecentTasksTable() {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: QK.tasks,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: QK.projects,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: QK.users,
  });

  // Get the 5 most recent tasks
  const recentTasks = tasks
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "-";
    const project = projects.find(p => p.id === projectId);
    return project ? project.code : "-";
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "-";
    const foundUser = users.find(u => u.id === userId);
    return foundUser ? foundUser.fullName : "-";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === "completed" || task.status === "cancelled") return false;
    return new Date(task.dueDate) < new Date();
  };

  return (
    <div className="card-g2" data-testid="recent-tasks-table">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h3 className="text-lg font-semibold text-foreground">Task Recenti</h3>
        <Button variant="ghost" asChild className="text-primary hover:text-primary/80 font-medium text-sm whitespace-nowrap" data-testid="view-all-tasks">
          <Link href="/todo">Vedi Tutte →</Link>
        </Button>
      </div>

      {recentTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Nessuna task presente</p>
          <p className="text-sm mt-1">Crea la prima task per iniziare</p>
        </div>
      ) : (
        <>
          {/* Desktop/Tablet: Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-foreground text-sm">Titolo</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-foreground text-sm">Commessa</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-foreground text-sm">Assegnato</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-foreground text-sm">Priorità</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-foreground text-sm">Status</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-foreground text-sm">Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-foreground" data-testid={`task-title-${task.id}`}>
                      <div className="max-w-xs truncate" title={task.title}>
                        {task.title}
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-muted-foreground font-mono" data-testid={`task-project-${task.id}`}>
                      {getProjectName(task.projectId)}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-muted-foreground" data-testid={`task-assigned-${task.id}`}>
                      <div className="truncate">{getUserName(task.assignedToId)}</div>
                    </td>
                    <td className="py-3 px-2 sm:px-4" data-testid={`task-priority-${task.id}`}>
                      <PriorityBadge priority={task.priority as "high" | "medium" | "low"} />
                    </td>
                    <td className="py-3 px-2 sm:px-4" data-testid={`task-status-${task.id}`}>
                      <TaskStatusBadge status={task.status as "completed" | "in_progress" | "cancelled" | "pending"} />
                    </td>
                    <td className={cn(
                      "py-3 px-2 sm:px-4 text-xs sm:text-sm",
                      isOverdue(task) ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
                    )} data-testid={`task-due-${task.id}`}>
                      <span className="flex items-center gap-1">
                        {isOverdue(task) && <AlertTriangle className="h-3 w-3" />}
                        {formatDate(task.dueDate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet: Cards */}
          <div className="lg:hidden space-y-3">
            {recentTasks.map((task) => (
              <div key={task.id} className="w-full bg-muted rounded-lg p-4 space-y-3 overflow-hidden">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{task.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    📋 {getProjectName(task.projectId)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={task.priority as "high" | "medium" | "low"} />
                  <TaskStatusBadge status={task.status as "completed" | "in_progress" | "cancelled" | "pending"} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground pt-3 border-t border-border">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground mb-1">Assegnato</div>
                    <div className="truncate">{getUserName(task.assignedToId)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground mb-1">Scadenza</div>
                    <div className={cn(
                      isOverdue(task) ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
                    )}>
                      {isOverdue(task) && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      {formatDate(task.dueDate)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
