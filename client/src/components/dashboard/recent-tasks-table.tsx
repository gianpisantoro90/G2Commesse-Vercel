import { useQuery } from "@tanstack/react-query";
import { type Task, type Project, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { TaskStatusBadge, PriorityBadge } from "@/components/ui/status-badge";

export default function RecentTasksTable() {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
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

  return (
    <div className="card-g2" data-testid="recent-tasks-table">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Task Recenti</h3>
        <Button
          variant="ghost"
          className="text-primary hover:text-teal-700 font-medium text-sm whitespace-nowrap"
          data-testid="view-all-tasks"
          onClick={() => {
            const tabButton = document.querySelector('[data-testid="tab-todo"]') as HTMLElement;
            if (tabButton) tabButton.click();
          }}
        >
          Vedi Tutte →
        </Button>
      </div>

      {recentTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <p>Nessuna task presente</p>
          <p className="text-sm">Crea la prima task per iniziare</p>
        </div>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Titolo</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Commessa</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Assegnato</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Priorità</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Status</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium dark:text-gray-300" data-testid={`task-title-${task.id}`}>
                      <div className="max-w-xs truncate" title={task.title}>
                        {task.title}
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-mono" data-testid={`task-project-${task.id}`}>
                      {getProjectName(task.projectId)}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400" data-testid={`task-assigned-${task.id}`}>
                      <div className="truncate">{getUserName(task.assignedToId)}</div>
                    </td>
                    <td className="py-3 px-2 sm:px-4" data-testid={`task-priority-${task.id}`}>
                      <PriorityBadge priority={task.priority as "high" | "medium" | "low"} />
                    </td>
                    <td className="py-3 px-2 sm:px-4" data-testid={`task-status-${task.id}`}>
                      <TaskStatusBadge status={task.status as "completed" | "in_progress" | "cancelled" | "pending"} />
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400" data-testid={`task-due-${task.id}`}>
                      {formatDate(task.dueDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-2">
            {recentTasks.map((task) => (
              <div key={task.id} className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3 overflow-hidden">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="font-medium text-sm dark:text-gray-200 truncate">{task.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    📋 {getProjectName(task.projectId)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={task.priority as "high" | "medium" | "low"} />
                  <TaskStatusBadge status={task.status as "completed" | "in_progress" | "cancelled" | "pending"} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Assegnato</div>
                    <div className="truncate">{getUserName(task.assignedToId)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Scadenza</div>
                    <div className="text-red-600 dark:text-red-400 font-medium">{formatDate(task.dueDate)}</div>
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
