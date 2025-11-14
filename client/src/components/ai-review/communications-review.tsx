import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Mail,
  Calendar,
  User,
  Tag,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AISuggestionsPanel } from "@/components/projects/ai-suggestions-panel";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Communication {
  id: string;
  subject: string;
  body: string;
  emailHtml?: string;
  sender: string;
  recipient: string;
  communicationDate: string;
  type: string;
  direction: string;
  isImportant: boolean;
  tags: string[];
  aiSuggestions?: {
    confidence: number;
    reasoning?: string;
    summary?: string;
    isImportant?: boolean;
    suggestedTags?: string[];
    extractedData?: {
      deadlines?: string[];
      amounts?: string[];
      actionItems?: string[];
      keyPoints?: string[];
    };
    projectMatches: Array<{
      projectId: string;
      projectCode: string;
      confidence: number;
      reasoning: string;
      matchedFields: string[];
    }>;
  };
}

export function CommunicationsReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedComm, setSelectedComm] = useState<Communication | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch communications that need review
  const { data: communications = [], isLoading } = useQuery<Communication[]>({
    queryKey: ["/api/communications/pending-review"],
    queryFn: async () => {
      const response = await fetch("/api/communications/pending-review");
      if (!response.ok) throw new Error("Failed to fetch pending communications");
      return response.json();
    },
  });

  // Mutation to dismiss a communication
  const dismissMutation = useMutation({
    mutationFn: async (communicationId: string) => {
      await apiRequest("POST", `/api/communications/${communicationId}/dismiss-suggestions`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/pending-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({
        title: "Comunicazione ignorata",
        description: "La comunicazione è stata rimossa dalla lista di revisione",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile ignorare la comunicazione",
        variant: "destructive",
      });
    },
  });

  const handleProjectAssigned = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/communications/pending-review"] });
    queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
    setSelectedComm(null);
  };

  const handleDismiss = async (communicationId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      await dismissMutation.mutateAsync(communicationId);
      // Close dialog only after mutation completes successfully
      setSelectedComm(null);
    } catch (error) {
      // Error toast is already shown by mutation onError
      // Keep dialog open so user can retry
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(communications.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedComms = communications.slice(startIndex, endIndex);

  // Reset to page 1 when page size changes
  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Caricamento comunicazioni...</p>
        </div>
      </div>
    );
  }

  if (communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
        <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Tutto Revisionato!</h3>
          <p className="text-muted-foreground">
            Non ci sono comunicazioni in attesa di revisione
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with summary and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-base py-1.5 px-3">
            {communications.length} comunicazion{communications.length === 1 ? "e" : "i"} da rivedere
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mostra:</span>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Oggetto</TableHead>
                <TableHead className="w-[20%]">Mittente</TableHead>
                <TableHead className="w-[15%]">Data</TableHead>
                <TableHead className="w-[15%]">Progetti Suggeriti</TableHead>
                <TableHead className="w-[10%] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedComms.map((comm) => (
                <TableRow
                  key={comm.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-2">{comm.subject}</span>
                          {comm.isImportant && (
                            <Badge variant="destructive" className="text-xs">
                              !
                            </Badge>
                          )}
                        </div>
                        {comm.tags && comm.tags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {comm.tags.slice(0, 3).map((tag: string, index: number) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs h-5 px-1.5"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {comm.tags.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{comm.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{comm.sender}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {format(new Date(comm.communicationDate), "dd/MM/yy HH:mm", {
                          locale: it,
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {comm.aiSuggestions?.projectMatches && comm.aiSuggestions.projectMatches.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <Badge variant="secondary" className="text-xs">
                          {comm.aiSuggestions.projectMatches.length} progett{comm.aiSuggestions.projectMatches.length === 1 ? 'o' : 'i'}
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">Nessuno</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedComm(comm)}
                        data-testid={`button-review-${comm.id}`}
                      >
                        Revisiona
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDismiss(comm.id, e)}
                        disabled={dismissMutation.isPending}
                        data-testid={`button-dismiss-${comm.id}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Pagina {currentPage} di {totalPages} ({startIndex + 1}-{Math.min(endIndex, communications.length)} di {communications.length})
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Successiva
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Communication Detail Dialog */}
      <Dialog 
        open={!!selectedComm} 
        onOpenChange={(open) => {
          // Prevent closing while dismiss mutation is pending
          if (!open && !dismissMutation.isPending) {
            setSelectedComm(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedComm?.subject}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{selectedComm?.sender}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {selectedComm && format(new Date(selectedComm.communicationDate), "dd MMM yyyy 'alle' HH:mm", {
                      locale: it,
                    })}
                  </span>
                </div>
              </div>
              {selectedComm?.tags && selectedComm.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {selectedComm.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Email Content */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Contenuto Email</h4>
              <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded-lg max-h-[300px] overflow-y-auto">
                {selectedComm?.emailHtml ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedComm.emailHtml }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{selectedComm?.body}</p>
                )}
              </div>
            </div>

            {/* AI Suggestions */}
            {selectedComm?.aiSuggestions?.projectMatches && selectedComm.aiSuggestions.projectMatches.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-semibold">Suggerimenti AI</h4>
                  <Badge variant="secondary">
                    {selectedComm.aiSuggestions.projectMatches.length} progetti suggeriti
                  </Badge>
                </div>
                <AISuggestionsPanel
                  communicationId={selectedComm.id}
                  aiSuggestions={{
                    confidence: selectedComm.aiSuggestions.confidence,
                    summary: selectedComm.aiSuggestions.summary,
                    projectMatches: selectedComm.aiSuggestions.projectMatches,
                    suggestedTags: selectedComm.aiSuggestions.suggestedTags || [],
                    isImportant: selectedComm.aiSuggestions.isImportant || false,
                    extractedData: selectedComm.aiSuggestions.extractedData || {
                      deadlines: [],
                      amounts: [],
                      actionItems: [],
                      keyPoints: []
                    }
                  }}
                  currentProjectId={undefined}
                  onProjectSelected={handleProjectAssigned}
                />
              </div>
            ) : (
              <div className="text-center p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg space-y-3">
                <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Nessun progetto suggerito dall'AI per questa comunicazione
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedComm && handleDismiss(selectedComm.id)}
                  disabled={dismissMutation.isPending}
                  data-testid="button-dismiss-no-match"
                  className="mt-2"
                >
                  <X className="h-4 w-4 mr-2" />
                  Ignora questa comunicazione
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
