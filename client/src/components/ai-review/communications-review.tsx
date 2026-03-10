import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { QK } from "@/lib/query-utils";
import DOMPurify from "dompurify";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "./confirm-dialog";
import { BulkActionBar } from "./bulk-action-bar";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  X,
  Search,
  FolderOpen,
  Loader2,
  XCircle
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

interface Project {
  id: number;
  code: string;
  client: string;
  object: string;
  status: string;
}

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
  const isMobile = useIsMobile();
  const [selectedComm, setSelectedComm] = useState<Communication | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDismiss, setConfirmDismiss] = useState<{ ids: string[] } | null>(null);

  // Fetch communications that need review
  const { data: communications = [], isLoading } = useQuery<Communication[]>({
    queryKey: QK.communicationsPending,
    queryFn: async () => {
      const response = await fetch("/api/communications/pending-review", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch pending communications");
      return response.json();
    },
  });

  // Fetch projects for manual assignment
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: QK.projects,
    queryFn: async () => {
      const response = await fetch("/api/projects", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
  });

  // Filter projects based on search
  const filteredProjects = projects
    .filter((p) => p.status !== "completato" && p.status !== "annullato")
    .filter((p) => {
      if (!projectSearch) return true;
      const search = projectSearch.toLowerCase();
      return (
        p.code.toLowerCase().includes(search) ||
        p.client.toLowerCase().includes(search) ||
        p.object.toLowerCase().includes(search)
      );
    })
    .slice(0, 20); // Limit to 20 results for performance

  // Mutation to manually assign a project
  const assignProjectMutation = useMutation({
    mutationFn: async ({ communicationId, projectId }: { communicationId: string; projectId: string }) => {
      const response = await fetch(`/api/communications/${communicationId}/select-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error("Failed to assign project");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.communicationsPending });
      queryClient.invalidateQueries({ queryKey: QK.communications });
      setSelectedComm(null);
      setProjectSearch("");
      setSelectedProjectId(null);
      toast({
        title: "Comunicazione assegnata",
        description: "La comunicazione è stata collegata alla commessa selezionata",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile assegnare la comunicazione alla commessa",
        variant: "destructive",
      });
    },
  });

  // Mutation to dismiss a communication
  const dismissMutation = useMutation({
    mutationFn: async (communicationId: string) => {
      await apiRequest("POST", `/api/communications/${communicationId}/dismiss-suggestions`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.communicationsPending });
      queryClient.invalidateQueries({ queryKey: QK.communications });
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
    queryClient.invalidateQueries({ queryKey: QK.communicationsPending });
    queryClient.invalidateQueries({ queryKey: QK.communications });
    setSelectedComm(null);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paginatedComms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedComms.map(c => c.id)));
    }
  };

  const handleDismiss = (ids: string[]) => {
    setConfirmDismiss({ ids });
  };

  const executeDismiss = async () => {
    if (!confirmDismiss) return;
    try {
      for (const id of confirmDismiss.ids) {
        await dismissMutation.mutateAsync(id);
      }
      setSelectedIds(new Set());
      setSelectedComm(null);
    } finally {
      setConfirmDismiss(null);
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
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm sm:text-base py-1 sm:py-1.5 px-2 sm:px-3">
            {communications.length} comunicazion{communications.length === 1 ? "e" : "i"} da rivedere
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
          {paginatedComms.map((comm) => (
            <Card key={comm.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedIds.has(comm.id)}
                      onCheckedChange={() => toggleSelection(comm.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Subject and importance */}
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium line-clamp-2">{comm.subject}</span>
                            {comm.isImportant && (
                              <Badge variant="destructive" className="text-xs">!</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sender and Date */}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{comm.sender}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(comm.communicationDate), "dd/MM/yy HH:mm", { locale: it })}</span>
                        </div>
                      </div>

                      {/* Tags */}
                      {comm.tags && comm.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {comm.tags.slice(0, 3).map((tag: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs h-5 px-1.5">{tag}</Badge>
                          ))}
                          {comm.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{comm.tags.length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* Project AI info */}
                      {comm.aiSuggestions?.projectMatches?.[0] && (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                          <Badge variant="outline" className="font-mono text-xs">
                            {comm.aiSuggestions.projectMatches[0].projectCode}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(comm.aiSuggestions.projectMatches[0].confidence * 100)}%
                          </span>
                        </div>
                      )}

                      {/* Project suggestions */}
                      <div className="flex items-center gap-2">
                        {comm.aiSuggestions?.projectMatches && comm.aiSuggestions.projectMatches.length > 0 ? (
                          <>
                            <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            <Badge variant="secondary" className="text-xs">
                              {comm.aiSuggestions.projectMatches.length} progett{comm.aiSuggestions.projectMatches.length === 1 ? 'o' : 'i'}
                            </Badge>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-xs text-muted-foreground">Nessun progetto suggerito</span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setProjectSearch("");
                            setSelectedProjectId(null);
                            setSelectedComm(comm);
                          }}
                          data-testid={`button-review-${comm.id}`}
                        >
                          Revisiona
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDismiss([comm.id]); }}
                          disabled={dismissMutation.isPending}
                          data-testid={`button-dismiss-${comm.id}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
                      checked={paginatedComms.length > 0 && selectedIds.size === paginatedComms.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="w-[30%]">Oggetto</TableHead>
                  <TableHead className="w-[15%]">Mittente</TableHead>
                  <TableHead className="w-[12%]">Data</TableHead>
                  <TableHead className="w-[18%]">Progetto AI</TableHead>
                  <TableHead className="w-[10%] text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedComms.map((comm) => (
                  <TableRow
                    key={comm.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(comm.id)}
                        onCheckedChange={() => toggleSelection(comm.id)}
                      />
                    </TableCell>
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
                      {comm.aiSuggestions?.projectMatches?.[0] ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-xs">
                            {comm.aiSuggestions.projectMatches[0].projectCode}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(comm.aiSuggestions.projectMatches[0].confidence * 100)}%
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-xs text-muted-foreground">Nessuno</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProjectSearch("");
                            setSelectedProjectId(null);
                            setSelectedComm(comm);
                          }}
                          data-testid={`button-review-${comm.id}`}
                        >
                          Revisiona
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDismiss([comm.id]); }}
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
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
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

      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={communications.length}
        onClearSelection={() => setSelectedIds(new Set())}
        actions={[
          {
            label: "Ignora selezionati",
            icon: <XCircle className="h-4 w-4" />,
            variant: "outline" as const,
            onClick: () => handleDismiss(Array.from(selectedIds)),
          },
        ]}
      />

      <ConfirmDialog
        open={!!confirmDismiss}
        onOpenChange={() => setConfirmDismiss(null)}
        title="Ignora comunicazioni"
        description={confirmDismiss?.ids.length === 1
          ? "Sei sicuro di voler ignorare questa comunicazione? L'azione non è reversibile."
          : `Sei sicuro di voler ignorare ${confirmDismiss?.ids.length} comunicazioni? L'azione non è reversibile.`}
        confirmLabel="Ignora"
        onConfirm={executeDismiss}
        isPending={dismissMutation.isPending}
      />

      {/* Communication Detail Dialog */}
      <Dialog
        open={!!selectedComm}
        onOpenChange={(open) => {
          // Prevent closing while dismiss mutation is pending
          if (!open && !dismissMutation.isPending && !assignProjectMutation.isPending) {
            setSelectedComm(null);
            setProjectSearch("");
            setSelectedProjectId(null);
          }
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
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
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedComm.emailHtml) }}
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
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">
                      Nessun progetto suggerito dall'AI
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Puoi assegnare manualmente questa comunicazione a una commessa esistente.
                  </p>
                </div>

                {/* Manual project selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    <h4 className="font-semibold text-foreground">Assegna a Commessa</h4>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Cerca per codice, cliente o oggetto..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-10"
                      data-testid="input-project-search"
                    />
                  </div>

                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-2 space-y-1">
                      {filteredProjects.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          {projectSearch ? "Nessuna commessa trovata" : "Inizia a digitare per cercare..."}
                        </div>
                      ) : (
                        filteredProjects.map((project) => (
                          <div
                            key={project.id}
                            onClick={() => setSelectedProjectId(project.id.toString())}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${
                              selectedProjectId === project.id.toString()
                                ? "bg-teal-100 dark:bg-teal-900/30 border-2 border-teal-500"
                                : "hover:bg-muted border border-transparent"
                            }`}
                            data-testid={`project-option-${project.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                                    {project.code}
                                  </Badge>
                                  {selectedProjectId === project.id.toString() && (
                                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm font-medium text-foreground mt-1 truncate">
                                  {project.client}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {project.object}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        if (selectedComm && selectedProjectId) {
                          assignProjectMutation.mutate({
                            communicationId: selectedComm.id,
                            projectId: selectedProjectId,
                          });
                        }
                      }}
                      disabled={!selectedProjectId || assignProjectMutation.isPending}
                      className="flex-1"
                      data-testid="button-assign-project"
                    >
                      {assignProjectMutation.isPending ? (
                        "Assegnazione..."
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Assegna a Commessa
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => selectedComm && handleDismiss([selectedComm.id])}
                      disabled={dismissMutation.isPending}
                      data-testid="button-dismiss-no-match"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Ignora
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
