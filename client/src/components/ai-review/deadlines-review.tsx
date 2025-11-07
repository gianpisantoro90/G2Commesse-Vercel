import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckSquare,
  XCircle,
  Clock,
  User,
  AlertTriangle,
  Sparkles,
  CalendarClock,
  FileText,
  Mail,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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

  // Fetch communications with suggested deadlines
  const { data: communications = [], isLoading } = useQuery<Communication[]>({
    queryKey: ["/api/ai/suggested-deadlines"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/ai/suggested-deadlines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/ai/suggested-deadlines"] });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scadenze Proposte dall'AI</h2>
          <p className="text-muted-foreground">
            {communications.length} comunicazion{communications.length === 1 ? 'e' : 'i'} con scadenze suggerite
          </p>
        </div>
        <Badge variant="outline" className="h-8">
          <Sparkles className="h-3 w-3 mr-1" />
          AI Analysis
        </Badge>
      </div>

      <div className="space-y-4">
        {communications.map((comm) => {
          const suggestedDeadlines = comm.aiSuggestions?.suggestedDeadlines || [];
          const deadlinesStatus = comm.aiDeadlinesStatus || {};
          const pendingDeadlines = suggestedDeadlines.filter((_, idx) => !deadlinesStatus[idx] || deadlinesStatus[idx].action === 'pending');

          if (pendingDeadlines.length === 0) return null;

          return (
            <Card key={comm.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {comm.subject}
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
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
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {suggestedDeadlines.map((deadline, deadlineIndex) => {
                  const deadlineStatus = deadlinesStatus[deadlineIndex];

                  // Skip if already processed
                  if (deadlineStatus && deadlineStatus.action !== 'pending') return null;

                  const typeConfig = getTypeConfig(deadline.type);

                  return (
                    <div key={deadlineIndex} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CalendarClock className="h-4 w-4 text-blue-600" />
                            <h4 className="font-semibold">{deadline.title}</h4>
                            <Badge variant={getPriorityColor(deadline.priority)}>
                              {getPriorityLabel(deadline.priority)}
                            </Badge>
                            <Badge variant="outline">
                              {typeConfig.icon} {typeConfig.label}
                            </Badge>
                          </div>

                          {deadline.description && (
                            <p className="text-sm text-muted-foreground pl-6">
                              {deadline.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 pl-6 text-sm">
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

                          <Alert className="bg-blue-50 border-blue-200">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-sm">
                              <strong>Perché l'AI suggerisce questa scadenza:</strong><br />
                              {deadline.reasoning}
                            </AlertDescription>
                          </Alert>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => dismissDeadline.mutate({ communicationId: comm.id, deadlineIndex })}
                          disabled={dismissDeadline.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rifiuta
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveDeadline.mutate({ communicationId: comm.id, deadlineIndex })}
                          disabled={approveDeadline.isPending || !comm.projectId}
                        >
                          <CheckSquare className="h-4 w-4 mr-1" />
                          Approva e Crea Scadenza
                        </Button>
                      </div>

                      {!comm.projectId && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            La comunicazione deve essere associata a un progetto prima di poter creare la scadenza.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
