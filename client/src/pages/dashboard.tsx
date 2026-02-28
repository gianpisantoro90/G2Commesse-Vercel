import { useState, useCallback, useEffect, lazy, Suspense } from "react";
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
import PrestazioniStatsWidget from "@/components/dashboard/prestazioni-stats-widget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Project } from "@shared/schema";

// Lazy-loaded tab components (only loaded when their tab is active)
const ProjectsTable = lazy(() => import("@/components/projects/projects-table"));
const ClientsTable = lazy(() => import("@/components/projects/clients-table"));
const NewProjectForm = lazy(() => import("@/components/projects/new-project-form"));
const ParcellaCalculator = lazy(() => import("@/components/projects/parcella-calculator-new"));
const RegistroComunicazioni = lazy(() => import("@/components/projects/registro-comunicazioni"));
const SezioneCosti = lazy(() => import("@/components/projects/sezione-costi"));
const RequisitiTecnici = lazy(() => import("@/components/projects/requisiti-tecnici"));
const TodoPanel = lazy(() => import("@/components/todo/TodoPanel"));
const Scadenzario = lazy(() => import("@/components/projects/scadenzario"));
const FatturazionePage = lazy(() => import("@/components/projects/fatturazione-page"));
const CommunicationsReview = lazy(() => import("@/components/ai-review/communications-review").then(m => ({ default: m.CommunicationsReview })));
const TasksReview = lazy(() => import("@/components/ai-review/tasks-review").then(m => ({ default: m.TasksReview })));
const DeadlinesReview = lazy(() => import("@/components/ai-review/deadlines-review").then(m => ({ default: m.DeadlinesReview })));
const StoragePanel = lazy(() => import("@/components/system/storage-panel"));
const AiConfigPanelUnified = lazy(() => import("@/components/system/ai-config-panel-unified"));
const AiFeatureConfigPanel = lazy(() => import("@/components/ai-assistant/ai-feature-config-panel"));
const FolderConfigPanel = lazy(() => import("@/components/system/folder-config-panel"));
const OneDrivePanel = lazy(() => import("@/components/system/onedrive-panel"));
const UserManagementPanel = lazy(() => import("@/components/system/user-management-panel"));
const OneDriveBrowser = lazy(() => import("@/components/onedrive/onedrive-browser"));

// Shared className constants
const subTabTriggerClass = "px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm sm:text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap";
const systemTabTriggerClass = "px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap";
const tabContentClass = "bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0";

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      <span className="ml-2 text-gray-500">Caricamento...</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  // Hash-based tab routing: reads initial tab from URL hash, syncs on change
  const validTabs = ["dashboard", "gestione", "todo", "scadenze", "fatturazione", "revisione-ai", "sistema"];
  const getTabFromHash = useCallback(() => {
    const hash = window.location.hash.slice(1); // remove #
    return validTabs.includes(hash) ? hash : "dashboard";
  }, []);

  const [activeTab, setActiveTabState] = useState(getTabFromHash);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    window.location.hash = tab === "dashboard" ? "" : tab;
  }, []);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => setActiveTabState(getTabFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [getTabFromHash]);

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
              <div className="space-y-6" id="tabpanel-dashboard" role="tabpanel" aria-labelledby="tab-dashboard" data-testid="dashboard-panel">
                {isAdmin && <EconomicDashboardCard />}
                {isAdmin && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <PrestazioniStatsWidget />
                    <StatsCard />
                  </div>
                )}
                <RecentTasksTable />
                <RecentProjectsTable />
                <div className="grid gap-6 lg:grid-cols-1">
                  <OneDriveStatusCard />
                </div>
              </div>
            )}

            {/* To Do Panel */}
            {activeTab === "todo" && (
              <div id="tabpanel-todo" role="tabpanel" aria-labelledby="tab-todo">
                <Suspense fallback={<TabFallback />}>
                  <TodoPanel />
                </Suspense>
              </div>
            )}

            {/* Management Panel */}
            {activeTab === "gestione" && (
              <div id="tabpanel-gestione" role="tabpanel" aria-labelledby="tab-gestione" data-testid="management-panel">
                <Tabs value={activeSubTab.gestione} onValueChange={(value) => handleSubTabChange("gestione", value)}>
                  <div className="bg-white dark:bg-gray-900 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <TabsList className="flex w-full bg-transparent border-0 p-0 min-w-max">
                      <TabsTrigger value="progetti" className={subTabTriggerClass} data-testid="tab-progetti">
                        📋 Commesse
                      </TabsTrigger>
                      {isAdmin && (
                        <TabsTrigger value="nuova" className={subTabTriggerClass} data-testid="tab-nuova">
                          ➕ Nuova
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger value="clienti" className={subTabTriggerClass} data-testid="tab-clienti">
                          👥 Clienti
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="comunicazioni" className={subTabTriggerClass} data-testid="tab-comunicazioni">
                        💬 Comun.
                      </TabsTrigger>
                      {isAdmin && (
                        <TabsTrigger value="costi" className={subTabTriggerClass} data-testid="tab-costi">
                          💰 Costi
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger value="parcella" className={subTabTriggerClass} data-testid="tab-parcella">
                          💰 Calc. Parcella
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger value="requisiti" className={subTabTriggerClass} data-testid="tab-requisiti">
                          🏆 Requisiti
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </div>

                  <Suspense fallback={<TabFallback />}>
                    <TabsContent value="progetti" className={tabContentClass}>
                      <ProjectsTable />
                    </TabsContent>

                    {isAdmin && (
                      <TabsContent value="costi" className={tabContentClass}>
                        <SezioneCosti />
                      </TabsContent>
                    )}

                    {isAdmin && (
                      <TabsContent value="parcella" className={tabContentClass}>
                        <ParcellaCalculator />
                      </TabsContent>
                    )}

                    <TabsContent value="comunicazioni" className={tabContentClass}>
                      <RegistroComunicazioni />
                    </TabsContent>

                    {isAdmin && (
                      <TabsContent value="requisiti" className={tabContentClass}>
                        <RequisitiTecnici />
                      </TabsContent>
                    )}

                    {isAdmin && (
                      <TabsContent value="nuova" className={tabContentClass}>
                        <div className="max-w-2xl mx-auto">
                          <NewProjectForm
                            onProjectSaved={setPendingProject}
                          />
                        </div>
                      </TabsContent>
                    )}

                    {isAdmin && (
                      <TabsContent value="clienti" className={tabContentClass}>
                        <ClientsTable />
                      </TabsContent>
                    )}
                  </Suspense>
                </Tabs>
              </div>
            )}

            {/* Revisione AI Panel (Admin only) */}
            {activeTab === "revisione-ai" && isAdmin && (
              <div className="space-y-6" id="tabpanel-revisione-ai" role="tabpanel" aria-labelledby="tab-revisione-ai" data-testid="revisione-ai-panel">
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

                  <Suspense fallback={<TabFallback />}>
                    <TabsContent value="communications">
                      <CommunicationsReview />
                    </TabsContent>
                    <TabsContent value="tasks">
                      <TasksReview />
                    </TabsContent>
                    <TabsContent value="deadlines">
                      <DeadlinesReview />
                    </TabsContent>
                  </Suspense>
                </Tabs>
              </div>
            )}

            {/* Scadenze Panel (All users) */}
            {activeTab === "scadenze" && (
              <div id="tabpanel-scadenze" role="tabpanel" aria-labelledby="tab-scadenze" data-testid="scadenze-panel">
                <Suspense fallback={<TabFallback />}>
                  <Scadenzario />
                </Suspense>
              </div>
            )}

            {/* Fatturazione Panel (Admin only) */}
            {activeTab === "fatturazione" && isAdmin && (
              <div id="tabpanel-fatturazione" role="tabpanel" aria-labelledby="tab-fatturazione" data-testid="fatturazione-panel">
                <Suspense fallback={<TabFallback />}>
                  <FatturazionePage />
                </Suspense>
              </div>
            )}

            {/* System Panel (Admin only) */}
            {activeTab === "sistema" && isAdmin && (
              <div id="tabpanel-sistema" role="tabpanel" aria-labelledby="tab-sistema" data-testid="system-panel">
                <Tabs value={activeSubTab.sistema} onValueChange={(value) => handleSubTabChange("sistema", value)}>
                  <div className="bg-white dark:bg-gray-900 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <TabsList className="flex w-full bg-transparent border-0 p-0 min-w-max">
                      <TabsTrigger value="users" className={systemTabTriggerClass} data-testid="tab-users">
                        👥 Utenti
                      </TabsTrigger>
                      <TabsTrigger value="storage" className={systemTabTriggerClass} data-testid="tab-storage">
                        💾 Storage
                      </TabsTrigger>
                      <TabsTrigger value="ai" className={systemTabTriggerClass} data-testid="tab-ai">
                        🤖 Config AI
                      </TabsTrigger>
                      <TabsTrigger value="onedrive-browser" className={systemTabTriggerClass} data-testid="tab-onedrive-browser">
                        ☁️ OneDrive Browser
                      </TabsTrigger>
                      <TabsTrigger value="onedrive" className={systemTabTriggerClass} data-testid="tab-onedrive">
                        ⚙️ OneDrive Config
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <Suspense fallback={<TabFallback />}>
                    <TabsContent value="users" className={tabContentClass}>
                      <UserManagementPanel />
                    </TabsContent>
                    <TabsContent value="storage" className={tabContentClass}>
                      <StoragePanel />
                    </TabsContent>
                    <TabsContent value="ai" className={tabContentClass}>
                      <div className="space-y-8">
                        <AiConfigPanelUnified />
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                          <AiFeatureConfigPanel />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="onedrive-browser" className={tabContentClass}>
                      <OneDriveBrowser />
                    </TabsContent>
                    <TabsContent value="onedrive" className={tabContentClass}>
                      <div className="space-y-8">
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            📁 Gestione Cartelle
                          </h3>
                          <FolderConfigPanel />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            ⚙️ Configurazione OneDrive
                          </h3>
                          <OneDrivePanel />
                        </div>
                      </div>
                    </TabsContent>
                  </Suspense>
                </Tabs>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
