import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Project, type ProjectMetadata } from "@shared/schema";
import { formatImporto, renderPrestazioneBadge, renderTipoRapportoBadge, type PrestazioneType, type TipoRapportoType } from "@/lib/prestazioni-utils";
import { ArrowRight, MoreVertical, Eye, Edit, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProjectStatus = "in_corso" | "sospesa" | "conclusa";

interface KanbanColumn {
  id: ProjectStatus;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: "in_corso",
    title: "In Corso",
    icon: "⚡",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200"
  },
  {
    id: "sospesa",
    title: "Sospesa",
    icon: "⏸️",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200"
  },
  {
    id: "conclusa",
    title: "Conclusa",
    icon: "✅",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200"
  }
];

interface ProjectCardProps {
  project: Project;
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
}

function ProjectCard({ project, onStatusChange }: ProjectCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const metadata = project.metadata as ProjectMetadata;

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("projectId", project.id);
    e.dataTransfer.setData("currentStatus", project.status);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const availableStatuses = KANBAN_COLUMNS.filter(col => col.id !== project.status);

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`cursor-move transition-all duration-200 hover:shadow-lg ${
        isDragging ? "opacity-50 scale-95" : "opacity-100"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-bold text-primary truncate" title={project.code}>
              {project.code}
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2" title={project.object}>
              {project.object}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-2" />
                Visualizza
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="h-4 w-4 mr-2" />
                Modifica
              </DropdownMenuItem>
              {availableStatuses.map(status => (
                <DropdownMenuItem
                  key={status.id}
                  onClick={() => onStatusChange(project.id, status.id)}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Sposta in {status.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cliente e Città */}
        <div>
          <p className="text-sm font-medium text-gray-900">{project.client}</p>
          <p className="text-xs text-gray-500">{project.city}</p>
        </div>

        {/* Tipo Rapporto */}
        {project.tipoRapporto && project.tipoRapporto !== "diretto" && (
          <div>
            {(() => {
              const badge = renderTipoRapportoBadge(project.tipoRapporto as TipoRapportoType, 'sm');
              return (
                <span className={badge.className} title={badge.description}>
                  {badge.icon} {badge.label}
                </span>
              );
            })()}
          </div>
        )}

        {/* Prestazioni */}
        {metadata?.prestazioni && metadata.prestazioni.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {metadata.prestazioni.slice(0, 3).map((prestazione) => {
              const badge = renderPrestazioneBadge(prestazione as PrestazioneType, 'sm');
              return (
                <span key={prestazione} className={badge.className} title={badge.fullLabel}>
                  {badge.icon}
                </span>
              );
            })}
            {metadata.prestazioni.length > 3 && (
              <span className="text-xs text-gray-500 px-2 py-1">
                +{metadata.prestazioni.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Importo Servizio */}
        {metadata?.importoServizio && metadata.importoServizio > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-gray-500">Compenso:</span>
            <span className="text-sm font-bold text-green-700">
              {formatImporto(metadata.importoServizio)}
            </span>
          </div>
        )}

        {/* Anno */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          <span>20{project.year.toString().padStart(2, '0')}</span>
          {project.template && (
            <Badge variant="outline" className="ml-auto text-xs">
              {project.template}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface KanbanColumnComponentProps {
  column: KanbanColumn;
  projects: Project[];
  onDrop: (projectId: string, newStatus: ProjectStatus) => void;
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
}

function KanbanColumnComponent({ column, projects, onDrop, onStatusChange }: KanbanColumnComponentProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const projectId = e.dataTransfer.getData("projectId");
    const currentStatus = e.dataTransfer.getData("currentStatus");

    if (projectId && currentStatus !== column.id) {
      onDrop(projectId, column.id);
    }
  };

  const totalImportoServizi = projects.reduce((sum, p) => {
    const metadata = p.metadata as ProjectMetadata;
    return sum + (metadata?.importoServizio || 0);
  }, 0);

  return (
    <div className="flex flex-col h-full">
      <div className={`${column.bgColor} border-2 rounded-lg p-3 mb-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{column.icon}</span>
            <h3 className={`font-bold text-lg ${column.color}`}>
              {column.title}
            </h3>
          </div>
          <Badge variant="secondary" className="text-sm">
            {projects.length}
          </Badge>
        </div>
        {totalImportoServizi > 0 && (
          <p className="text-xs text-gray-600 mt-2">
            Totale: <span className="font-semibold">{formatImporto(totalImportoServizi)}</span>
          </p>
        )}
      </div>

      <ScrollArea
        className={`flex-1 rounded-lg border-2 p-3 transition-colors ${
          isDragOver ? "border-primary bg-primary/5" : "border-dashed border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-3 pb-4">
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Nessuna commessa {column.title.toLowerCase()}</p>
              <p className="text-xs mt-1">Trascina qui una card per spostare</p>
            </div>
          ) : (
            projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function KanbanView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ projectId, newStatus }: { projectId: string; newStatus: ProjectStatus }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}`, {
        status: newStatus,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      const statusLabels = {
        in_corso: "In Corso",
        sospesa: "Sospesa",
        conclusa: "Conclusa"
      };

      toast({
        title: "Stato aggiornato",
        description: `Commessa spostata in "${statusLabels[variables.newStatus]}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato della commessa",
        variant: "destructive",
      });
    },
  });

  const handleDrop = (projectId: string, newStatus: ProjectStatus) => {
    updateStatusMutation.mutate({ projectId, newStatus });
  };

  const handleStatusChange = (projectId: string, newStatus: ProjectStatus) => {
    updateStatusMutation.mutate({ projectId, newStatus });
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-24 rounded-lg" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-32 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const projectsByStatus = KANBAN_COLUMNS.reduce((acc, column) => {
    acc[column.id] = projects.filter(p => p.status === column.id);
    return acc;
  }, {} as Record<ProjectStatus, Project[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vista Kanban</h2>
          <p className="text-sm text-gray-500 mt-1">
            Trascina le card per cambiare lo stato delle commesse
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
            <span>In Corso: {projectsByStatus.in_corso.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-400 rounded-full" />
            <span>Sospese: {projectsByStatus.sospesa.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full" />
            <span>Concluse: {projectsByStatus.conclusa.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumnComponent
            key={column.id}
            column={column}
            projects={projectsByStatus[column.id]}
            onDrop={handleDrop}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  );
}
