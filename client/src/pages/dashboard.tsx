import { useState } from "react";
import Header from "@/components/layout/header";
import TabNavigation from "@/components/layout/tab-navigation";
import StatsCard from "@/components/dashboard/stats-card";
import QuickActionsCard from "@/components/dashboard/quick-actions-card";
import SystemInfoCard from "@/components/dashboard/system-info-card";
import RecentProjectsTable from "@/components/dashboard/recent-projects-table";
import NewProjectForm from "@/components/projects/new-project-form";
import FolderStructureCard from "@/components/projects/folder-structure-card";
import ProjectsTable from "@/components/projects/projects-table";
import ClientsTable from "@/components/projects/clients-table";
import RoutingForm from "@/components/routing/routing-form";
import RoutingResults from "@/components/routing/routing-results";
import BulkRenameForm from "@/components/routing/bulk-rename-form";
import BulkRenameResults from "@/components/routing/bulk-rename-results";
import StoragePanel from "@/components/system/storage-panel";
import AiConfigPanel from "@/components/system/ai-config-panel";
import FolderConfigPanel from "@/components/system/folder-config-panel";
import OneDrivePanel from "@/components/system/onedrive-panel";
import OneDriveFileRouter from "@/components/onedrive/onedrive-file-router";
import OneDriveBrowser from "@/components/onedrive/onedrive-browser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type RoutingResult } from "@/lib/ai-router";
import { type Project } from "@shared/schema";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState({
    gestione: "progetti",
    sistema: "storage"
  });
  const [pendingProject, setPendingProject] = useState(null);
  
  // Routing state
  const [routingResults, setRoutingResults] = useState<Array<{result: RoutingResult, file: File}> | null>(null);
  const [routingProject, setRoutingProject] = useState<Project | null>(null);
  const [bulkRenameResults, setBulkRenameResults] = useState<Array<{original: string, renamed: string}> | null>(null);

  const handleSubTabChange = (mainTab: string, subTab: string) => {
    setActiveSubTab(prev => ({ ...prev, [mainTab]: subTab }));
  };
  
  const handleAnalysisComplete = (results: Array<{result: RoutingResult, file: File}>, project: Project | null) => {
    setRoutingResults(results);
    setRoutingProject(project);
  };
  
  const handleClearRouting = () => {
    setRoutingResults(null);
    setRoutingProject(null);
  };

  const handleBulkRenameComplete = (results: Array<{original: string, renamed: string}>) => {
    setBulkRenameResults(results);
  };

  const handleClearBulkRename = () => {
    setBulkRenameResults(null);
  };

  return (
    <div className="min-h-screen bg-g2-accent">
      <Header />
      
      <div className="max-w-7xl mx-auto">
        <TabNavigation 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
        />

        <main className="p-6">
          <div className="animate-fade-in">
            {/* Dashboard Panel */}
            {activeTab === "dashboard" && (
              <div className="space-y-8" data-testid="dashboard-panel">
                <div className="grid gap-6 lg:grid-cols-3">
                  <StatsCard />
                  <QuickActionsCard onNewProject={() => setActiveTab("nuova")} />
                  <SystemInfoCard />
                </div>
                <RecentProjectsTable />
              </div>
            )}

            {/* New Project Panel */}
            {activeTab === "nuova" && (
              <div className="max-w-2xl mx-auto space-y-6" data-testid="new-project-panel">
                <NewProjectForm 
                  onProjectSaved={setPendingProject}
                />
                <FolderStructureCard 
                  pendingProject={pendingProject}
                />
              </div>
            )}

            {/* Management Panel */}
            {activeTab === "gestione" && (
              <div data-testid="management-panel">
                <Tabs value={activeSubTab.gestione} onValueChange={(value) => handleSubTabChange("gestione", value)}>
                  <div className="bg-white rounded-t-2xl border-b border-gray-200">
                    <TabsList className="flex w-full bg-transparent border-0 p-0">
                      <TabsTrigger 
                        value="progetti" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-progetti"
                      >
                        Gestione Commesse
                      </TabsTrigger>
                      <TabsTrigger 
                        value="clienti" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-clienti"
                      >
                        Anagrafica Clienti
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="progetti" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <ProjectsTable />
                  </TabsContent>
                  
                  <TabsContent value="clienti" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <ClientsTable />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Auto-Routing Panel */}
            {activeTab === "routing" && (
              <div className="max-w-4xl mx-auto space-y-6" data-testid="routing-panel">
                <div className="grid gap-6 lg:grid-cols-1">
                  <RoutingForm onAnalysisComplete={handleAnalysisComplete} />
                  <BulkRenameForm onRenameComplete={handleBulkRenameComplete} />
                  
                  {/* OneDrive AI Router */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">☁️ Routing AI con OneDrive</h3>
                    <p className="text-gray-600 mb-4">
                      Analizza e organizza automaticamente i file da OneDrive utilizzando l'intelligenza artificiale.
                    </p>
                    <OneDriveFileRouter />
                  </div>
                </div>
                
                <RoutingResults 
                  results={routingResults}
                  project={routingProject}
                  onClear={handleClearRouting}
                />
                
                {bulkRenameResults && (
                  <BulkRenameResults 
                    results={bulkRenameResults}
                    onClear={handleClearBulkRename}
                  />
                )}
              </div>
            )}

            {/* System Panel */}
            {activeTab === "sistema" && (
              <div data-testid="system-panel">
                <Tabs value={activeSubTab.sistema} onValueChange={(value) => handleSubTabChange("sistema", value)}>
                  <div className="bg-white rounded-t-2xl border-b border-gray-200">
                    <TabsList className="flex w-full bg-transparent border-0 p-0">
                      <TabsTrigger 
                        value="storage" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-storage"
                      >
                        💾 Storage
                      </TabsTrigger>
                      <TabsTrigger 
                        value="ai" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-ai"
                      >
                        🤖 Configurazione AI
                      </TabsTrigger>
                      <TabsTrigger 
                        value="folders" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-folders"
                      >
                        📁 Cartelle
                      </TabsTrigger>
                      <TabsTrigger 
                        value="onedrive" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-onedrive"
                      >
                        ☁️ OneDrive Config
                      </TabsTrigger>
                      <TabsTrigger 
                        value="browser" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-onedrive-browser"
                      >
                        📁 OneDrive Browser
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="storage" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <StoragePanel />
                  </TabsContent>
                  
                  <TabsContent value="ai" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <AiConfigPanel />
                  </TabsContent>
                  
                  <TabsContent value="folders" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <FolderConfigPanel />
                  </TabsContent>
                  
                  <TabsContent value="onedrive" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <OneDrivePanel />
                  </TabsContent>
                  
                  <TabsContent value="browser" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <OneDriveBrowser />
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
