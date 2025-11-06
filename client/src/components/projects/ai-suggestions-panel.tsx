import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (confidence >= 0.7) return <TrendingUp className="h-4 w-4 text-yellow-600" />;
    return <AlertCircle className="h-4 w-4 text-orange-600" />;
  };

  return (
    <Card className="border-2 border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Suggerimenti AI</CardTitle>
          </div>
          {hasMatches && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              {matches.length} {matches.length === 1 ? 'match trovato' : 'match trovati'}
            </Badge>
          )}
        </div>
        <CardDescription>
          {hasMatches
            ? "L'AI ha identificato possibili commesse correlate a questa email"
            : "Nessuna commessa correlata trovata automaticamente"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        {aiSuggestions.summary && (
          <div className="bg-white rounded-lg p-3 border border-purple-200">
            <p className="text-sm text-gray-700 italic">"{aiSuggestions.summary}"</p>
          </div>
        )}

        {/* Project Matches */}
        {hasMatches && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Commesse Suggerite (ordinate per rilevanza)
            </h4>

            {matches.map((match, index) => (
              <Card
                key={match.projectId}
                className={`transition-all ${
                  selectedMatchIndex === index
                    ? 'ring-2 ring-purple-500 bg-purple-50'
                    : 'hover:shadow-md'
                } ${
                  currentProjectId === match.projectId
                    ? 'border-green-500 bg-green-50'
                    : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getConfidenceIcon(match.confidence)}
                          <h5 className="font-semibold text-gray-900">
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
                          <Badge variant="default" className="mt-1 bg-green-600">
                            ✓ Commessa Attuale
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Reasoning */}
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm text-gray-700">
                        <strong className="text-gray-900">Perché questo match:</strong>{" "}
                        {match.reasoning}
                      </p>
                    </div>

                    {/* Matched Fields */}
                    {match.matchedFields && match.matchedFields.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-gray-500">Campi matched:</span>
                        {match.matchedFields.map((field) => (
                          <Badge
                            key={field}
                            variant="secondary"
                            className="text-xs bg-blue-100 text-blue-700"
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
                </CardContent>
              </Card>
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
          <div className="space-y-2 pt-2 border-t border-purple-200">
            <h4 className="font-medium text-sm text-gray-700">Informazioni Estratte</h4>

            {aiSuggestions.extractedData.deadlines && aiSuggestions.extractedData.deadlines.length > 0 && (
              <div className="bg-white rounded p-2 text-sm">
                <strong className="text-gray-900">📅 Scadenze:</strong>{" "}
                {aiSuggestions.extractedData.deadlines.join(", ")}
              </div>
            )}

            {aiSuggestions.extractedData.amounts && aiSuggestions.extractedData.amounts.length > 0 && (
              <div className="bg-white rounded p-2 text-sm">
                <strong className="text-gray-900">💰 Importi:</strong>{" "}
                {aiSuggestions.extractedData.amounts.join(", ")}
              </div>
            )}

            {aiSuggestions.extractedData.actionItems && aiSuggestions.extractedData.actionItems.length > 0 && (
              <div className="bg-white rounded p-2 text-sm">
                <strong className="text-gray-900">✓ Azioni da fare:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {aiSuggestions.extractedData.actionItems.map((item, i) => (
                    <li key={i} className="text-gray-700">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {aiSuggestions.suggestedTags && aiSuggestions.suggestedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            <span className="text-xs text-gray-500">Tag suggeriti:</span>
            {aiSuggestions.suggestedTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
