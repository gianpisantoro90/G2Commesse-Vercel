import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Mail, CheckSquare, Calendar } from "lucide-react";
import { CommunicationsReview } from "@/components/ai-review/communications-review";
import { TasksReview } from "@/components/ai-review/tasks-review";
import { DeadlinesReview } from "@/components/ai-review/deadlines-review";

export default function RevisioneAI() {
  const [activeTab, setActiveTab] = useState("communications");

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Revisione AI</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            <span className="hidden sm:inline">Gestisci comunicazioni, task e scadenze suggerite dall'intelligenza artificiale</span>
            <span className="sm:hidden">Gestisci suggerimenti AI</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-100 dark:bg-gray-800 w-full flex-wrap h-auto gap-1 p-1 mb-4">
          <TabsTrigger
            value="communications"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 flex-1 min-w-0 gap-1 sm:gap-2"
          >
            <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Comunicazioni</span>
            <span className="sm:hidden">Email</span>
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 flex-1 min-w-0 gap-1 sm:gap-2"
          >
            <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Task Proposte</span>
            <span className="sm:hidden">Task</span>
          </TabsTrigger>
          <TabsTrigger
            value="deadlines"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 flex-1 min-w-0 gap-1 sm:gap-2"
          >
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Scadenze</span>
            <span className="sm:hidden">Scad.</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Communications Review */}
        <TabsContent value="communications" className="space-y-4">
          <div className="card-g2">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Comunicazioni da Rivedere</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Email ricevute che richiedono l'assegnazione manuale a un progetto
              </p>
            </div>
            <CommunicationsReview />
          </div>
        </TabsContent>

        {/* Tab 2: Tasks Review */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="card-g2">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Proposte dall'AI</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Task suggerite automaticamente dall'analisi delle comunicazioni
              </p>
            </div>
            <TasksReview />
          </div>
        </TabsContent>

        {/* Tab 3: Deadlines Review */}
        <TabsContent value="deadlines" className="space-y-4">
          <div className="card-g2">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scadenze Proposte dall'AI</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scadenze e milestone suggerite dall'analisi delle comunicazioni
              </p>
            </div>
            <DeadlinesReview />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
