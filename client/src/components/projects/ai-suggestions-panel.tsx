import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle, Sparkles, TrendingUp, Info } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ProjectMatch {
  projectId: string;
  projectCode: string;
  confidence: number;
  reasoning: string;
  matchedFields: string[];
}

interface AISuggestion {
  projectCode?: string;
  projectId?: string;
  confidence: number;
  projectMatches: ProjectMatch[];
  extractedData: {
    deadlines?: string[];
    amounts?: string[];
    actionItems?: string[];
    keyPoints?: string[];
  };
  suggestedTags: string[];
  isImportant: boolean;
  summary?: string;
}

interface AISuggestionsPanelProps {
  communicationId: string;
  aiSuggestions: AISuggestion;
  currentProjectId?: string;
  onProjectSelected?: (projectId: string) => void;
}

export function AISuggestionsPanel({
  communicationId,
  aiSuggestions,
  currentProjectId,
  onProjectSelected
}: AISuggestionsPanelProps) {
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const selectProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/communications/${communicationId}/select-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to select project');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      if (onProjectSelected && data.projectId) {
        onProjectSelected(data.projectId);
      }
    },
  });

  const dismissSuggestionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/communications/${communicationId}/dismiss-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss suggestions');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });

  if (!aiSuggestions) {
    return null;
  }

  const matches = aiSuggestions.projectMatches || [];
  const hasMatches = matches.length > 0;

  // Don't show if already linked to a project (unless it was auto-imported)
  if (currentProjectId && !hasMatches) {
    return null;
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-100 text-green-800 border-green-300";
    if (confidence >= 0.7) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (confidence >= 0.5) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-muted text-foreground border-border";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (confidence >= 0.7) return <TrendingUp className="h-4 w-4 text-yellow-600" />;
    return <AlertCircle className="h-4 w-4 text-orange-600" />;
  };

  return (
    <div className="card-g2 border-2 border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20">
      <div className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-semibold text-foreground">Suggerimenti AI</h3>
          </div>
          {hasMatches && (
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              {matches.length} {matches.length === 1 ? 'match trovato' : 'match trovati'}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {hasMatches
            ? "L'AI ha identificato possibili commesse correlate a questa email"
            : "Nessuna commessa correlata trovata automaticamente"}
        </p>
      </div>

      <div className="space-y-4">
        {/* Summary */}
        {aiSuggestions.summary && (
          <div className="bg-card rounded-lg p-3 border border-purple-200 dark:border-purple-800">
            <p className="text-sm text-foreground italic">"{aiSuggestions.summary}"</p>
          </div>
        )}

        {/* Project Matches */}
        {hasMatches && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Commesse Suggerite (ordinate per rilevanza)
            </h4>

            {matches.map((match, index) => (
              <div
                key={match.projectId}
                className={`rounded-lg border p-4 transition-all ${
                  selectedMatchIndex === index
                    ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/30'
                    : 'hover:bg-muted bg-card border-border'
                } ${
                  currentProjectId === match.projectId
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                    : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getConfidenceIcon(match.confidence)}
                        <h5 className="font-semibold text-foreground">
                          {match.projectCode}
                        </h5>
                        <Badge
                          variant="outline"
                          className={getConfidenceColor(match.confidence)}
                        >
                          {(match.confidence * 100).toFixed(0)}% affidabilità
                        </Badge>
                      </div>
                      {currentProjectId === match.projectId && (
                        <Badge variant="default" className="mt-1 bg-green-600 dark:bg-green-700">
                          ✓ Commessa Attuale
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="bg-muted rounded p-3">
                    <p className="text-sm text-foreground">
                      <strong className="text-foreground">Perché questo match:</strong>{" "}
                      {match.reasoning}
                    </p>
                  </div>

                  {/* Matched Fields */}
                  {match.matchedFields && match.matchedFields.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Campi matched:</span>
                      {match.matchedFields.map((field) => (
                        <Badge
                          key={field}
                          variant="secondary"
                          className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                        >
                          {field}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {currentProjectId !== match.projectId && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedMatchIndex(index);
                          selectProjectMutation.mutate(match.projectId);
                        }}
                        disabled={selectProjectMutation.isPending}
                        className="flex-1"
                      >
                        {selectProjectMutation.isPending && selectedMatchIndex === index
                          ? "Collegamento..."
                          : "✓ Usa Questa Commessa"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Dismiss All Button */}
            {!currentProjectId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => dismissSuggestionMutation.mutate()}
                disabled={dismissSuggestionMutation.isPending}
                className="w-full"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {dismissSuggestionMutation.isPending ? "Chiudendo..." : "Nessuna di Queste"}
              </Button>
            )}
          </div>
        )}

        {/* Extracted Data */}
        {(aiSuggestions.extractedData?.deadlines?.length ||
          aiSuggestions.extractedData?.amounts?.length ||
          aiSuggestions.extractedData?.actionItems?.length) && (
          <div className="space-y-2 pt-2 border-t border-purple-200 dark:border-purple-800">
            <h4 className="font-medium text-sm text-foreground">Informazioni Estratte</h4>

            {aiSuggestions.extractedData.deadlines && aiSuggestions.extractedData.deadlines.length > 0 && (
              <div className="bg-card rounded p-2 text-sm">
                <strong className="text-foreground">📅 Scadenze:</strong>{" "}
                <span className="text-foreground">{aiSuggestions.extractedData.deadlines.join(", ")}</span>
              </div>
            )}

            {aiSuggestions.extractedData.amounts && aiSuggestions.extractedData.amounts.length > 0 && (
              <div className="bg-card rounded p-2 text-sm">
                <strong className="text-foreground">💰 Importi:</strong>{" "}
                <span className="text-foreground">{aiSuggestions.extractedData.amounts.join(", ")}</span>
              </div>
            )}

            {aiSuggestions.extractedData.actionItems && aiSuggestions.extractedData.actionItems.length > 0 && (
              <div className="bg-card rounded p-2 text-sm">
                <strong className="text-foreground">✓ Azioni da fare:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {aiSuggestions.extractedData.actionItems.map((item, i) => (
                    <li key={i} className="text-foreground">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {aiSuggestions.suggestedTags && aiSuggestions.suggestedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            <span className="text-xs text-muted-foreground">Tag suggeriti:</span>
            {aiSuggestions.suggestedTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
