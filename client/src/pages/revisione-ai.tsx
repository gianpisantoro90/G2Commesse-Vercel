import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Brain, Mail, CheckSquare, Calendar, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QK } from "@/lib/query-utils";
import { CommunicationsReview } from "@/components/ai-review/communications-review";
import { TasksReview } from "@/components/ai-review/tasks-review";
import { DeadlinesReview } from "@/components/ai-review/deadlines-review";

function getTabFromPath(path: string) {
  if (path === "/revisione-ai/tasks") return "tasks";
  if (path === "/revisione-ai/scadenze") return "deadlines";
  return "communications";
}

export default function RevisioneAI() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(getTabFromPath(location));
  const [isCheckingEmails, setIsCheckingEmails] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "communications") setLocation("/revisione-ai");
    else if (value === "tasks") setLocation("/revisione-ai/tasks");
    else if (value === "deadlines") setLocation("/revisione-ai/scadenze");
  };

  const handleCheckEmails = async () => {
    setIsCheckingEmails(true);
    try {
      const response = await fetch("/api/emails/check-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore nel controllo email");
      }

      const data = await response.json();

      // Invalidate all AI review queries so tabs refresh with new data
      queryClient.invalidateQueries({ queryKey: QK.communicationsPending });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedTasks });
      queryClient.invalidateQueries({ queryKey: QK.aiSuggestedDeadlines });
      queryClient.invalidateQueries({ queryKey: QK.communications });

      const hasErrors = data.errors && data.errors.length > 0;
      toast({
        title: hasErrors ? "Controllo Completato con Errori" : "Controllo Completato",
        description: hasErrors
          ? `${data.message}\n${data.errors.join('\n')}`
          : data.message,
        variant: hasErrors ? "destructive" : "default",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore nel controllo email",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEmails(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Revisione AI</h2>
            <p className="text-sm text-muted-foreground">
              Gestisci comunicazioni, task e scadenze suggerite dall'AI
            </p>
          </div>
        </div>
        <Button
          onClick={handleCheckEmails}
          disabled={isCheckingEmails}
          className="gap-2 w-full sm:w-auto"
          variant="default"
        >
          {isCheckingEmails ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Controllo in corso...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Controlla Email
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger
            value="communications"
            className="data-[state=active]:bg-background text-foreground text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 flex-1 min-w-0 gap-1 sm:gap-2"
          >
            <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Comunicazioni</span>
            <span className="sm:hidden">Email</span>
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="data-[state=active]:bg-background text-foreground text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 flex-1 min-w-0 gap-1 sm:gap-2"
          >
            <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Task Proposte</span>
            <span className="sm:hidden">Task</span>
          </TabsTrigger>
          <TabsTrigger
            value="deadlines"
            className="data-[state=active]:bg-background text-foreground text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 flex-1 min-w-0 gap-1 sm:gap-2"
          >
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Scadenze Proposte</span>
            <span className="sm:hidden">Scadenze</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="communications" className="space-y-4">
          <CommunicationsReview />
        </TabsContent>
        <TabsContent value="tasks" className="space-y-4">
          <TasksReview />
        </TabsContent>
        <TabsContent value="deadlines" className="space-y-4">
          <DeadlinesReview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
