import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { type Task, type Project, type Deadline } from "@shared/schema";
import {
  CheckCircle, Clock, AlertTriangle, CalendarClock, Briefcase, ListTodo
} from "lucide-react";

export default function UserSummaryCard() {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: QK.tasks,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: QK.projects,
  });

  const { data: deadlines = [] } = useQuery<Deadline[]>({
    queryKey: QK.deadlines,
  });

  // Filter tasks assigned to current user
  const myTasks = tasks.filter(t => t.assignedToId === user?.id);
  const myPending = myTasks.filter(t => t.status === "pending").length;
  const myInProgress = myTasks.filter(t => t.status === "in_progress").length;
  const myCompleted = myTasks.filter(t => t.status === "completed").length;
  const myOverdue = myTasks.filter(t => {
    if (!t.dueDate) return false;
    if (t.status === "completed" || t.status === "cancelled") return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  // Active projects count
  const activeProjects = projects.filter(p => p.status === "in corso").length;

  // Upcoming deadlines (next 14 days)
  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = deadlines.filter(d => {
    const dueDate = new Date(d.dueDate);
    return dueDate >= now && dueDate <= twoWeeksFromNow;
  }).length;

  return (
    <div className="card-g2" data-testid="user-summary-card">
      <div className="flex items-center gap-2 mb-4">
        <ListTodo className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Il tuo riepilogo</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Tasks in attesa */}
        <div className="p-3 rounded-lg bg-muted border border-border text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-yellow-600" />
          <div className="text-2xl font-bold text-foreground">{myPending}</div>
          <div className="text-xs text-muted-foreground">In attesa</div>
        </div>

        {/* Tasks in corso */}
        <div className="p-3 rounded-lg bg-muted border border-border text-center">
          <Briefcase className="h-4 w-4 mx-auto mb-1 text-blue-600" />
          <div className="text-2xl font-bold text-foreground">{myInProgress}</div>
          <div className="text-xs text-muted-foreground">In corso</div>
        </div>

        {/* Tasks completate */}
        <div className="p-3 rounded-lg bg-muted border border-border text-center">
          <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-600" />
          <div className="text-2xl font-bold text-foreground">{myCompleted}</div>
          <div className="text-xs text-muted-foreground">Completate</div>
        </div>

        {/* Task scadute */}
        <div className={`p-3 rounded-lg border text-center ${
          myOverdue > 0
            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
            : "bg-muted border-border"
        }`}>
          <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${myOverdue > 0 ? "text-red-600" : "text-muted-foreground"}`} />
          <div className={`text-2xl font-bold ${myOverdue > 0 ? "text-red-600" : "text-foreground"}`}>{myOverdue}</div>
          <div className="text-xs text-muted-foreground">Scadute</div>
        </div>

        {/* Scadenze prossime */}
        <div className={`p-3 rounded-lg border text-center ${
          upcomingDeadlines > 0
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
            : "bg-muted border-border"
        }`}>
          <CalendarClock className={`h-4 w-4 mx-auto mb-1 ${upcomingDeadlines > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
          <div className={`text-2xl font-bold ${upcomingDeadlines > 0 ? "text-amber-600" : "text-foreground"}`}>{upcomingDeadlines}</div>
          <div className="text-xs text-muted-foreground">Scadenze 14gg</div>
        </div>
      </div>

      {/* Quick stats footer */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
        <span>{activeProjects} commesse attive</span>
        <Badge variant="outline" className="text-xs">
          {myTasks.length} task totali
        </Badge>
      </div>
    </div>
  );
}
