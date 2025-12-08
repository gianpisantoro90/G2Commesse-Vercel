import { cn } from "@/lib/utils";

// Badge per stato progetto/commessa
type ProjectStatus = "in corso" | "conclusa" | "sospesa";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
  showIcon?: boolean;
}

export function ProjectStatusBadge({ status, className, showIcon = true }: ProjectStatusBadgeProps) {
  const config = {
    "in corso": {
      icon: "🟡",
      label: "In Corso",
      classes: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
    },
    "conclusa": {
      icon: "🟢",
      label: "Conclusa",
      classes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-green-200 dark:border-green-800"
    },
    "sospesa": {
      icon: "🔴",
      label: "Sospesa",
      classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-red-200 dark:border-red-800"
    }
  };

  const { icon, label, classes } = config[status] || config["in corso"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
        classes,
        className
      )}
    >
      {showIcon && <span>{icon}</span>}
      {label}
    </span>
  );
}

// Badge per stato task
type TaskStatus = "completed" | "in_progress" | "cancelled" | "pending";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
  showIcon?: boolean;
}

export function TaskStatusBadge({ status, className, showIcon = true }: TaskStatusBadgeProps) {
  const config = {
    completed: {
      icon: "✅",
      label: "Completata",
      classes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-green-200 dark:border-green-800"
    },
    in_progress: {
      icon: "⏳",
      label: "In Corso",
      classes: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
    },
    cancelled: {
      icon: "❌",
      label: "Annullata",
      classes: "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-200 border-gray-200 dark:border-gray-600"
    },
    pending: {
      icon: "📋",
      label: "Da Fare",
      classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-blue-200 dark:border-blue-800"
    }
  };

  const { icon, label, classes } = config[status] || config["pending"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
        classes,
        className
      )}
    >
      {showIcon && <span>{icon}</span>}
      {label}
    </span>
  );
}

// Badge per priorità task
type Priority = "high" | "medium" | "low";

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
  showIcon?: boolean;
}

export function PriorityBadge({ priority, className, showIcon = true }: PriorityBadgeProps) {
  const config = {
    high: {
      icon: "🔴",
      label: "Alta",
      classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-red-200 dark:border-red-800"
    },
    medium: {
      icon: "🟡",
      label: "Media",
      classes: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
    },
    low: {
      icon: "🔵",
      label: "Bassa",
      classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-blue-200 dark:border-blue-800"
    }
  };

  const { icon, label, classes } = config[priority] || config["low"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
        classes,
        className
      )}
    >
      {showIcon && <span>{icon}</span>}
      {label}
    </span>
  );
}
