import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import TabNavigation from "@/components/layout/tab-navigation";
import { useAuth } from "@/hooks/useAuth";
import StatsCard from "@/components/dashboard/stats-card";
import RecentProjectsTable from "@/components/dashboard/recent-projects-table";
import RecentTasksTable from "@/components/dashboard/recent-tasks-table";
import OneDriveStatusCard from "@/components/dashboard/onedrive-status-card";
import EconomicDashboardCard from "@/components/dashboard/economic-dashboard-card";
import NewProjectForm from "@/components/projects/new-project-form";
import ProjectsTable from "@/components/projects/projects-table";
import ClientsTable from "@/components/projects/clients-table";
import ParcellaCalculator from "@/components/projects/parcella-calculator-new";
import Scadenzario from "@/components/projects/scadenzario";
import RegistroComunicazioni from "@/components/projects/registro-comunicazioni";
import SezioneCosti from "@/components/projects/sezione-costi";
import { CommunicationsReview } from "@/components/ai-review/communications-review";
import { TasksReview } from "@/components/ai-review/tasks-review";
import { DeadlinesReview } from "@/components/ai-review/deadlines-review";
import StoragePanel from "@/components/system/storage-panel";
import AiConfigPanelUnified from "@/components/system/ai-config-panel-unified";
import FolderConfigPanel from "@/components/system/folder-config-panel";
import OneDrivePanel from "@/components/system/onedrive-panel";
import UserManagementPanel from "@/components/system/user-management-panel";
import OneDriveBrowser from "@/components/onedrive/onedrive-browser";
import TodoPanel from "@/components/todo/TodoPanel";
import PrestazioniStatsWidget from "@/components/dashboard/prestazioni-stats-widget";
import FatturazionePage from "@/components/projects/fatturazione-page";
import RequisitiTecnici from "@/components/projects/requisiti-tecnici";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Project } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState({
    gestione: "progetti",
    sistema: "users",
    vista: "tabella"
  });
  const [pendingProject, setPendingProject] = useState(null);
  const [isCheckingEmails, setIsCheckingEmails] = useState(false);

  // Email check handler for AI Review section
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
      toast({
        title: "Controllo Completato",
        description: data.message,
        variant: "default",
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

  const handleSubTabChange = (mainTab: string, subTab: string) => {
    setActiveSubTab(prev => ({ ...prev, [mainTab]: subTab }));
  };

  return (
    <div className="min-h-screen bg-g2-accent dark:bg-gray-950">
      <Header />
      
      <div className="max-w-7xl mx-auto">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isAdmin={isAdmin}
        />

        <main className="p-3 sm:p-4 md:p-6" id="main-content">
          <div className="animate-fade-in">
            {/* Dashboard Panel */}
            {activeTab === "dashboard" && (
              <div className="space-y-6" data-testid="dashboard-panel">
                {/* Row 1 - Economic Dashboard (Admin only - Full width) */}
                {isAdmin && <EconomicDashboardCard />}

                {/* Row 2 - Stats Cards (Admin only) */}
                {isAdmin && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <PrestazioniStatsWidget />
                    <StatsCard />
                  </div>
                )}

                {/* Row 3 - Recent Tasks (All users - Full width) */}
                <RecentTasksTable />

                {/* Row 4 - Recent Projects (Full width) */}
                <RecentProjectsTable />

                {/* Row 5 - System Status */}
                <div className="grid gap-6 lg:grid-cols-1">
                  <OneDriveStatusCard />
                </div>
              </div>
            )}

            {/* To Do Panel */}
            {activeTab === "todo" && <TodoPanel />}

            {/* Management Panel */}
            {activeTab === "gestione" && (
              <div data-testid="management-panel">
                <Tabs value={activeSubTab.gestione} onValueChange={(value) => handleSubTabChange("gestione", value)}>
                  <div className="bg-white dark:bg-gray-900 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <TabsList className="flex w-full bg-transparent border-0 p-0 min-w-max">
                      <TabsTrigger
                        value="progetti"
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-progetti"
                      >
                        📋 Commesse
                      </TabsTrigger>
                      {isAdmin && (
                        <TabsTrigger
                          value="nuova"
                          className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-nuova"
                        >
                          ➕ Nuova
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger
                          value="clienti"
                          className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-clienti"
                        >
                          👥 Clienti
                        </TabsTrigger>
                      )}
                      <TabsTrigger
                        value="comunicazioni"
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-comunicazioni"
                      >
                        💬 Comun.
                      </TabsTrigger>
                      {isAdmin && (
                        <TabsTrigger
                          value="costi"
                          className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-costi"
                        >
                          💰 Costi
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger
                          value="parcella"
                          className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-parcella"
                        >
                          💰 Calc. Parcella
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger
                          value="requisiti"
                          className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-requisiti"
                        >
                          🏆 Requisiti
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </div>

                  <TabsContent value="progetti" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <ProjectsTable />
                  </TabsContent>

                  {isAdmin && (
                    <TabsContent value="costi" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <SezioneCosti />
                    </TabsContent>
                  )}

                  {isAdmin && (
                    <TabsContent value="parcella" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <ParcellaCalculator />
                    </TabsContent>
                  )}

                  <TabsContent value="comunicazioni" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <RegistroComunicazioni />
                  </TabsContent>

                  {isAdmin && (
                    <TabsContent value="requisiti" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <RequisitiTecnici />
                    </TabsContent>
                  )}

                  {isAdmin && (
                    <TabsContent value="nuova" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <div className="max-w-2xl mx-auto">
                        <NewProjectForm
                          onProjectSaved={setPendingProject}
                        />
                      </div>
                    </TabsContent>
                  )}

                  {isAdmin && (
                    <TabsContent value="clienti" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <ClientsTable />
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}

            {/* Revisione AI Panel (Admin only) */}
            {activeTab === "revisione-ai" && isAdmin && (
              <div className="space-y-6" data-testid="revisione-ai-panel">
                {/* Header con controllo email */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Controllo Email
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Verifica manualmente nuove email da analizzare con AI
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleCheckEmails}
                      disabled={isCheckingEmails}
                      className="gap-2 w-full sm:w-auto"
                      variant="default"
                      data-testid="button-check-emails"
                    >
                      {isCheckingEmails ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Controllo in corso...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Controlla Email Adesso
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="communications" className="w-full">
                  <TabsList className="bg-gray-100 dark:bg-gray-800 w-full flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="communications" className="flex-1 min-w-[100px] text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
                      <span className="hidden sm:inline">Comunicazioni da Rivedere</span>
                      <span className="sm:hidden">Comunicazioni</span>
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="flex-1 min-w-[100px] text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
                      <span className="hidden sm:inline">Task Proposte</span>
                      <span className="sm:hidden">Task</span>
                    </TabsTrigger>
                    <TabsTrigger value="deadlines" className="flex-1 min-w-[100px] text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-gray-900 dark:text-white">
                      <span className="hidden sm:inline">Scadenze Proposte</span>
                      <span className="sm:hidden">Scadenze</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="communications">
                    <CommunicationsReview />
                  </TabsContent>

                  <TabsContent value="tasks">
                    <TasksReview />
                  </TabsContent>

                  <TabsContent value="deadlines">
                    <DeadlinesReview />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Scadenze Panel (All users) */}
            {activeTab === "scadenze" && (
              <div data-testid="scadenze-panel">
                <Scadenzario />
              </div>
            )}

            {/* Fatturazione Panel (Admin only) */}
            {activeTab === "fatturazione" && isAdmin && (
              <div data-testid="fatturazione-panel">
                <FatturazionePage />
              </div>
            )}

            {/* System Panel (Admin only) */}
            {activeTab === "sistema" && isAdmin && (
              <div data-testid="system-panel">
                <Tabs value={activeSubTab.sistema} onValueChange={(value) => handleSubTabChange("sistema", value)}>
                  <div className="bg-white dark:bg-gray-900 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <TabsList className="flex w-full bg-transparent border-0 p-0 min-w-max">
                      <TabsTrigger
                        value="users"
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-users"
                      >
                        👥 Utenti
                      </TabsTrigger>
                      <TabsTrigger
                        value="storage"
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-storage"
                      >
                        💾 Storage
                      </TabsTrigger>
                      <TabsTrigger
                        value="ai"
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-ai"
                      >
                        🤖 Config AI
                      </TabsTrigger>
                      <TabsTrigger
                        value="onedrive-browser"
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-onedrive-browser"
                      >
                        ☁️ OneDrive Browser
                      </TabsTrigger>
                      <TabsTrigger
                        value="onedrive"
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-onedrive"
                      >
                        ⚙️ OneDrive Config
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="users" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <UserManagementPanel />
                  </TabsContent>

                  <TabsContent value="storage" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <StoragePanel />
                  </TabsContent>
                  
                  <TabsContent value="ai" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <AiConfigPanelUnified />
                  </TabsContent>

                  <TabsContent value="onedrive-browser" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <OneDriveBrowser />
                  </TabsContent>

                  <TabsContent value="onedrive" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <div className="space-y-8">
                      {/* Sezione Cartelle */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          📁 Gestione Cartelle
                        </h3>
                        <FolderConfigPanel />
                      </div>
                      
                      {/* Sezione Configurazione OneDrive */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          ⚙️ Configurazione OneDrive
                        </h3>
                        <OneDrivePanel />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
