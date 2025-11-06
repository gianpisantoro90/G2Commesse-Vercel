import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, Mail, CheckSquare, Calendar } from "lucide-react";
import { CommunicationsReview } from "@/components/ai-review/communications-review";
import { TasksReview } from "@/components/ai-review/tasks-review";
import { DeadlinesReview } from "@/components/ai-review/deadlines-review";

export default function RevisioneAI() {
  const [activeTab, setActiveTab] = useState("communications");

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-lg">
          <Brain className="h-8 w-8 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Revisione AI</h1>
          <p className="text-muted-foreground">
            Gestisci comunicazioni, task e scadenze suggerite dall'intelligenza artificiale
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="communications" className="gap-2">
            <Mail className="h-4 w-4" />
            Comunicazioni da Rivedere
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            Task Proposte
          </TabsTrigger>
          <TabsTrigger value="deadlines" className="gap-2">
            <Calendar className="h-4 w-4" />
            Scadenze Proposte
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Communications Review */}
        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comunicazioni da Rivedere</CardTitle>
              <CardDescription>
                Email ricevute che richiedono l'assegnazione manuale a un progetto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommunicationsReview />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Tasks Review */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Task Proposte dall'AI</CardTitle>
              <CardDescription>
                Task suggerite automaticamente dall'analisi delle comunicazioni
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TasksReview />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Deadlines Review */}
        <TabsContent value="deadlines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scadenze Proposte dall'AI</CardTitle>
              <CardDescription>
                Scadenze e milestone suggerite dall'analisi delle comunicazioni
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeadlinesReview />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
