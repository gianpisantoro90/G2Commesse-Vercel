import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, User, Tag, AlertCircle, CheckCircle2, Sparkles, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AISuggestionsPanel } from "@/components/projects/ai-suggestions-panel";
import { useToast } from "@/hooks/use-toast";

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
    projectId: string | null;
    projectCode: string;
    confidence: number;
    reasoning: string;
    isImportant: boolean;
    suggestedTags: string[];
    projectMatches: Array<{
      projectId: string;
      projectCode: string;
      confidence: number;
      reasoning: string;
      matchedFields: string[];
    }>;
  };
}

// Component for individual communication card
function CommunicationCard({ comm, onProjectAssigned }: { comm: Communication; onProjectAssigned: () => void }) {
  const [showFullEmail, setShowFullEmail] = useState(false);

  return (
    <Card key={comm.id} className="border-l-4 border-l-purple-500">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {comm.subject}
              {comm.isImportant && (
                <Badge variant="destructive" className="ml-2">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Importante
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="space-y-1">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{comm.sender}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {format(new Date(comm.communicationDate), "dd MMM yyyy 'alle' HH:mm", {
                      locale: it,
                    })}
                  </span>
                </div>
              </div>
            </CardDescription>
          </div>
        </div>

        {/* Tags */}
        {comm.tags && comm.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {comm.tags.map((tag: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Email Content with Expand/Collapse */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="font-medium text-sm">Contenuto Email</h5>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullEmail(!showFullEmail)}
              className="h-8"
            >
              {showFullEmail ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Comprimi
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Espandi
                </>
              )}
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            {showFullEmail ? (
              comm.emailHtml ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: comm.emailHtml }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{comm.body}</p>
              )
            ) : (
              <p className="text-sm line-clamp-3">{comm.body}</p>
            )}
          </div>
        </div>

        <Separator />

        {/* AI Suggestions Panel */}
        {comm.aiSuggestions?.projectMatches && comm.aiSuggestions.projectMatches.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold">Suggerimenti AI</h4>
              <Badge variant="secondary">
                {comm.aiSuggestions.projectMatches.length} progetti suggeriti
              </Badge>
            </div>
            <AISuggestionsPanel
              communicationId={comm.id}
              aiSuggestions={comm.aiSuggestions}
              currentProjectId={null}
              onProjectSelected={onProjectAssigned}
            />
          </div>
        ) : (
          <div className="text-center p-6 bg-yellow-50 rounded-lg">
            <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-sm text-yellow-800">
              Nessun progetto suggerito dall'AI per questa comunicazione
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CommunicationsReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch communications that need review (have aiSuggestions but no projectId)
  const { data: communications = [], isLoading } = useQuery<Communication[]>({
    queryKey: ["/api/communications/pending-review"],
    queryFn: async () => {
      const response = await fetch("/api/communications/pending-review");
      if (!response.ok) throw new Error("Failed to fetch pending communications");
      return response.json();
    },
  });

  const handleProjectAssigned = () => {
    // Refresh the list after a project is assigned
    queryClient.invalidateQueries({ queryKey: ["/api/communications/pending-review"] });
    queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
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
        <div className="p-4 bg-green-100 rounded-full">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
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
    <div className="space-y-6">
      {/* Summary Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-lg py-2 px-4">
          {communications.length} {communications.length === 1 ? "comunicazione" : "comunicazioni"} da rivedere
        </Badge>
      </div>

      {/* Communications List */}
      <div className="space-y-6">
        {communications.map((comm) => (
          <CommunicationCard
            key={comm.id}
            comm={comm}
            onProjectAssigned={handleProjectAssigned}
          />
        ))}
      </div>
    </div>
  );
}
