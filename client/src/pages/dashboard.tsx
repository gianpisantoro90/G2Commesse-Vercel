import { useState } from "react";
import Header from "@/components/layout/header";
import TabNavigation from "@/components/layout/tab-navigation";
import { useAuth } from "@/hooks/useAuth";
import StatsCard from "@/components/dashboard/stats-card";
import RecentProjectsTable from "@/components/dashboard/recent-projects-table";
import OneDriveStatusCard from "@/components/dashboard/onedrive-status-card";
import EconomicDashboardCard from "@/components/dashboard/economic-dashboard-card";
import NewProjectForm from "@/components/projects/new-project-form";
import FolderStructureCard from "@/components/projects/folder-structure-card";
import ProjectsTable from "@/components/projects/projects-table";
import ClientsTable from "@/components/projects/clients-table";
import ParcellaCalculator from "@/components/projects/parcella-calculator-new";
import Scadenzario from "@/components/projects/scadenzario";
import RegistroComunicazioni from "@/components/projects/registro-comunicazioni";
import GestioneRisorse from "@/components/projects/gestione-risorse";
import KpiDashboard from "@/components/projects/kpi-dashboard";
import BulkRenameForm from "@/components/routing/bulk-rename-form";
import BulkRenameResults from "@/components/routing/bulk-rename-results";
import OneDriveAutoRouting from "@/components/routing/onedrive-auto-routing";
import StoragePanel from "@/components/system/storage-panel";
import AiConfigPanel from "@/components/system/ai-config-panel";
import FolderConfigPanel from "@/components/system/folder-config-panel";
import OneDrivePanel from "@/components/system/onedrive-panel";
import UserManagementPanel from "@/components/system/user-management-panel";
import OneDriveFileRouter from "@/components/onedrive/onedrive-file-router";
import OneDriveBrowser from "@/components/onedrive/onedrive-browser";
import TodoPanel from "@/components/todo/TodoPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Project } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState({
    gestione: "progetti",
    sistema: "users",
    vista: "tabella"
  });
  const [pendingProject, setPendingProject] = useState(null);

  // Routing state
  const [bulkRenameResults, setBulkRenameResults] = useState<Array<{original: string, renamed: string}> | null>(null);

  const handleSubTabChange = (mainTab: string, subTab: string) => {
    setActiveSubTab(prev => ({ ...prev, [mainTab]: subTab }));
  };
  

  const handleBulkRenameComplete = (results: Array<{original: string, renamed: string}>) => {
    setBulkRenameResults(results);
  };

  const handleClearBulkRename = () => {
    setBulkRenameResults(null);
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

        <main className="p-6" id="main-content">
          <div className="animate-fade-in">
            {/* Dashboard Panel */}
            {activeTab === "dashboard" && (
              <div className="space-y-8" data-testid="dashboard-panel">
                {/* First Row - Economic Dashboard (Admin only) */}
                {isAdmin && <EconomicDashboardCard />}

                {/* Second Row - Recent Projects */}
                <RecentProjectsTable />

                {/* Third Row - Core System Info */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {isAdmin && <StatsCard />}
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
                  <div className="bg-white dark:bg-gray-900 rounded-t-2xl border-b border-gray-200 dark:border-gray-700">
                    <TabsList className="flex flex-wrap w-full bg-transparent border-0 p-0">
                      {isAdmin && (
                        <TabsTrigger
                          value="nuova"
                          className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-nuova"
                        >
                          ➕ Nuova
                        </TabsTrigger>
                      )}
                      <TabsTrigger
                        value="progetti"
                        className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-progetti"
                      >
                        📋 Commesse
                      </TabsTrigger>
                      {isAdmin && (
                        <TabsTrigger
                          value="clienti"
                          className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-clienti"
                        >
                          👥 Clienti
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger
                          value="risorse"
                          className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-risorse"
                        >
                          👷 Risorse
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger
                          value="kpi"
                          className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-kpi"
                        >
                          📊 KPI
                        </TabsTrigger>
                      )}
                      {isAdmin && (
                        <TabsTrigger
                          value="parcella"
                          className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                          data-testid="tab-parcella"
                        >
                          💰 Calc. Parcella
                        </TabsTrigger>
                      )}
                      <TabsTrigger
                        value="scadenzario"
                        className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-scadenzario"
                      >
                        📅 Scadenze
                      </TabsTrigger>
                      <TabsTrigger
                        value="comunicazioni"
                        className="px-6 py-4 text-base font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none whitespace-nowrap"
                        data-testid="tab-comunicazioni"
                      >
                        💬 Comun.
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="progetti" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <ProjectsTable />
                  </TabsContent>

                  {isAdmin && (
                    <TabsContent value="risorse" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <GestioneRisorse />
                    </TabsContent>
                  )}

                  {isAdmin && (
                    <TabsContent value="kpi" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <KpiDashboard />
                    </TabsContent>
                  )}

                  {isAdmin && (
                    <TabsContent value="parcella" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <ParcellaCalculator />
                    </TabsContent>
                  )}

                  <TabsContent value="scadenzario" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <Scadenzario />
                  </TabsContent>

                  <TabsContent value="comunicazioni" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                    <RegistroComunicazioni />
                  </TabsContent>

                  {isAdmin && (
                    <TabsContent value="nuova" className="bg-white dark:bg-gray-900 rounded-b-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mt-0">
                      <div className="max-w-2xl mx-auto space-y-6">
                        <NewProjectForm
                          onProjectSaved={setPendingProject}
                        />
                        <FolderStructureCard
                          pendingProject={pendingProject}
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

            {/* Auto-Routing Panel (Admin only) */}
            {activeTab === "routing" && isAdmin && (
              <div className="max-w-6xl mx-auto space-y-6" data-testid="routing-panel">
                <div className="grid gap-6 lg:grid-cols-1">
                  {/* New OneDrive Auto-Routing System */}
                  <OneDriveAutoRouting />
                  
                  {/* Bulk Rename Tool */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🔄 Rinomina File in Massa</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Strumento per rinominare file in massa con pattern personalizzati.
                    </p>
                    <BulkRenameForm onRenameComplete={handleBulkRenameComplete} />
                  </div>
                </div>
                
                {bulkRenameResults && (
                  <BulkRenameResults 
                    results={bulkRenameResults}
                    onClear={handleClearBulkRename}
                  />
                )}
              </div>
            )}

            {/* OneDrive Browser Panel (Admin only) */}
            {activeTab === "onedrive" && isAdmin && (
              <div data-testid="onedrive-browser-panel">
                <OneDriveBrowser />
              </div>
            )}

            {/* System Panel (Admin only) */}
            {activeTab === "sistema" && isAdmin && (
              <div data-testid="system-panel">
                <Tabs value={activeSubTab.sistema} onValueChange={(value) => handleSubTabChange("sistema", value)}>
                  <div className="bg-white dark:bg-gray-900 rounded-t-2xl border-b border-gray-200 dark:border-gray-700">
                    <TabsList className="flex w-full bg-transparent border-0 p-0">
                      <TabsTrigger
                        value="users"
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none"
                        data-testid="tab-users"
                      >
                        👥 Utenti
                      </TabsTrigger>
                      <TabsTrigger
                        value="storage"
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none"
                        data-testid="tab-storage"
                      >
                        💾 Storage
                      </TabsTrigger>
                      <TabsTrigger
                        value="ai"
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none"
                        data-testid="tab-ai"
                      >
                        🤖 Configurazione AI
                      </TabsTrigger>
                      <TabsTrigger
                        value="onedrive"
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-none"
                        data-testid="tab-onedrive"
                      >
                        ☁️ OneDrive Config
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
                    <AiConfigPanel />
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
