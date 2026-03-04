import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckSquare,
  XCircle,
  Clock,
  User,
  AlertTriangle,
  Sparkles,
  CalendarClock,
  Mail,
  Calendar,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SuggestedDeadline {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'general' | 'deposito' | 'collaudo' | 'scadenza_assicurazione' | 'milestone';
  dueDate: string;
  notifyDaysBefore?: number;
  reasoning: string;
}

interface Communication {
  id: string;
  subject: string;
  sender: string;
  communicationDate: string;
  projectId?: string;
  aiSuggestions: {
    suggestedDeadlines?: SuggestedDeadline[];
    projectMatches?: Array<{
      projectCode: string;
      confidence: number;
    }>;
  };
  aiDeadlinesStatus?: Record<number, {
    action: 'approved' | 'dismissed';
    deadlineId?: string;
    approvedAt?: string;
    dismissedAt?: string;
  }>;
}

export function DeadlinesReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedComm, setSelectedComm] = useState<{ comm: Communication; deadlineIndex: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch communications with suggested deadlines
  const { data: communications = [], isLoading } = useQuery<Communication[]>({
    queryKey: QK.aiSuggestedDeadlines,
  });

  // Flatten deadlines for table view
  const allDeadlines = communications.flatMap((comm) => {
    const suggestedDeadlines = comm.aiSuggestions?.suggestedDeadlines || [];
    const deadlinesStatus = comm.aiDeadlinesStatus || {};

    return suggestedDeadlines
      .map((deadline, index) => ({
        comm,
        deadline,
        index,
        isPending: !deadlinesStatus[index] || (deadlinesStatus[index].action as string) === 'pending'
      }))
      .filter(item => item.isPending);
  });

  // Approve deadline mutation
  const approveDeadline = useMutation({
    mutationFn: async ({ communicationId, deadlineIndex }: { communicationId: string; deadlineIndex: number }) => {
      const res = await fetch("/api/ai/suggested-deadlines/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ communicationId, deadlineIndex }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Errore nell'approvazione della scadenza");
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Scadenza creata",
        description: `La scadenza "${data.deadline.title}" è stata creata con successo`,
      });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedDeadlines });
      queryClient.invalidateQueries({ queryKey: QK.deadlines });
      setSelectedComm(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Dismiss deadline mutation
  const dismissDeadline = useMutation({
    mutationFn: async ({ communicationId, deadlineIndex }: { communicationId: string; deadlineIndex: number }) => {
      const res = await fetch("/api/ai/suggested-deadlines/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ communicationId, deadlineIndex }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Errore nel rifiuto della scadenza");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Scadenza rifiutata",
        description: "La scadenza suggerita è stata rifiutata",
      });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedDeadlines });
      setSelectedComm(null);
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
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Bassa';
      default: return priority;
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'deposito': return { label: 'Deposito', icon: '📝' };
      case 'collaudo': return { label: 'Collaudo', icon: '✅' };
      case 'scadenza_assicurazione': return { label: 'Scad. Assicurazione', icon: '🛡️' };
      case 'milestone': return { label: 'Milestone', icon: '🎯' };
      default: return { label: 'Generale', icon: '📌' };
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(allDeadlines.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDeadlines = allDeadlines.slice(startIndex, endIndex);

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (allDeadlines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
          <CheckSquare className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Nessuna Scadenza da Rivedere</h3>
          <p className="text-muted-foreground max-w-md">
            Ottimo! Non ci sono scadenze suggerite dall'AI che richiedono la tua revisione.
            Le scadenze appariranno qui quando l'AI identificherà date importanti nelle comunicazioni.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with summary and controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm sm:text-base py-1 sm:py-1.5 px-2 sm:px-3">
            <Sparkles className="h-3 w-3 mr-1" />
            {allDeadlines.length} scadenz{allDeadlines.length === 1 ? 'a' : 'e'} suggerite
          </Badge>
        </div>

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
          {paginatedDeadlines.map(({ comm, deadline, index }) => {
            const typeConfig = getTypeConfig(deadline.type);
            return (
              <Card key={`${comm.id}-${index}`} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Title */}
                    <div className="flex items-start gap-2">
                      <CalendarClock className="h-4 w-4 mt-0.5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
                      <span className="font-medium line-clamp-2">{deadline.title}</span>
                    </div>

                    {/* Date and badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(deadline.dueDate), "dd/MM/yy", { locale: it })}
                      </Badge>
                      <Badge variant={getPriorityColor(deadline.priority)} className="text-xs">
                        {getPriorityLabel(deadline.priority)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {typeConfig.icon} {typeConfig.label}
                      </Badge>
                    </div>

                    {/* Communication info */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{comm.subject}</span>
                      </div>
                      {comm.aiSuggestions?.projectMatches?.[0] && (
                        <Badge variant="outline" className="text-xs">
                          {comm.aiSuggestions.projectMatches[0].projectCode}
                        </Badge>
                      )}
                    </div>

                    {/* Action */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedComm({ comm, deadlineIndex: index })}
                    >
                      Revisiona
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Desktop: Table view */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Scadenza</TableHead>
                  <TableHead className="w-[15%]">Data</TableHead>
                  <TableHead className="w-[10%]">Priorità</TableHead>
                  <TableHead className="w-[15%]">Tipo</TableHead>
                  <TableHead className="w-[20%]">Comunicazione</TableHead>
                  <TableHead className="w-[10%] text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeadlines.map(({ comm, deadline, index }) => {
                  const typeConfig = getTypeConfig(deadline.type);
                  return (
                    <TableRow
                      key={`${comm.id}-${index}`}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-start gap-2">
                          <CalendarClock className="h-4 w-4 mt-0.5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
                          <span className="line-clamp-2">{deadline.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {format(new Date(deadline.dueDate), "dd/MM/yy", { locale: it })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityColor(deadline.priority)} className="text-xs">
                          {getPriorityLabel(deadline.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {typeConfig.icon} {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-xs">{comm.subject}</span>
                          </div>
                          {comm.aiSuggestions?.projectMatches?.[0] && (
                            <Badge variant="outline" className="text-xs">
                              {comm.aiSuggestions.projectMatches[0].projectCode}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedComm({ comm, deadlineIndex: index })}
                        >
                          Revisiona
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Pagina {currentPage} di {totalPages} ({startIndex + 1}-{Math.min(endIndex, allDeadlines.length)} di {allDeadlines.length})
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

      {/* Deadline Detail Dialog */}
      <Dialog open={!!selectedComm} onOpenChange={() => setSelectedComm(null)}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              {selectedComm && selectedComm.comm.aiSuggestions.suggestedDeadlines?.[selectedComm.deadlineIndex]?.title}
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Da: {selectedComm?.comm.sender}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {selectedComm && format(new Date(selectedComm.comm.communicationDate), "dd MMM yyyy 'alle' HH:mm", { locale: it })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  <span className="text-xs">{selectedComm?.comm.subject}</span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          {selectedComm && (() => {
            const deadline = selectedComm.comm.aiSuggestions.suggestedDeadlines![selectedComm.deadlineIndex];
            const typeConfig = getTypeConfig(deadline.type);

            return (
              <div className="space-y-4">
                {/* Deadline Details */}
                <div className="space-y-3 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getPriorityColor(deadline.priority)}>
                      {getPriorityLabel(deadline.priority)}
                    </Badge>
                    <Badge variant="outline">
                      {typeConfig.icon} {typeConfig.label}
                    </Badge>
                  </div>

                  {deadline.description && (
                    <p className="text-sm text-muted-foreground">
                      {deadline.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium">Scadenza: {format(new Date(deadline.dueDate), "dd MMM yyyy", { locale: it })}</span>
                    </div>
                    {deadline.notifyDaysBefore && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Notifica {deadline.notifyDaysBefore}gg prima</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Reasoning */}
                <Alert className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
                  <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <AlertDescription className="text-sm">
                    <strong>Perché l'AI suggerisce questa scadenza:</strong><br />
                    {deadline.reasoning}
                  </AlertDescription>
                </Alert>

                {/* Project Warning */}
                {!selectedComm.comm.projectId && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      La comunicazione deve essere associata a un progetto prima di poter creare la scadenza.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            );
          })()}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                if (selectedComm && window.confirm("Sei sicuro di voler rifiutare questa scadenza suggerita? L'azione non è reversibile.")) {
                  dismissDeadline.mutate({
                    communicationId: selectedComm.comm.id,
                    deadlineIndex: selectedComm.deadlineIndex
                  });
                }
              }}
              disabled={dismissDeadline.isPending}
            >
              <XCircle className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Rifiuta</span>
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                if (selectedComm) {
                  approveDeadline.mutate({
                    communicationId: selectedComm.comm.id,
                    deadlineIndex: selectedComm.deadlineIndex
                  });
                }
              }}
              disabled={approveDeadline.isPending || !selectedComm?.comm.projectId}
            >
              <CheckSquare className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Approva e Crea Scadenza</span>
              <span className="sm:hidden">Approva</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
