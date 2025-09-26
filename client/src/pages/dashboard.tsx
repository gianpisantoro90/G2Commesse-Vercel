import { useState } from "react";
import Header from "@/components/layout/header";
import TabNavigation from "@/components/layout/tab-navigation";
import StatsCard from "@/components/dashboard/stats-card";
import RecentProjectsTable from "@/components/dashboard/recent-projects-table";
import OneDriveStatusCard from "@/components/dashboard/onedrive-status-card";
import NewProjectForm from "@/components/projects/new-project-form";
import FolderStructureCard from "@/components/projects/folder-structure-card";
import ProjectsTable from "@/components/projects/projects-table";
import ClientsTable from "@/components/projects/clients-table";
import BulkRenameForm from "@/components/routing/bulk-rename-form";
import BulkRenameResults from "@/components/routing/bulk-rename-results";
import OneDriveAutoRouting from "@/components/routing/onedrive-auto-routing";
import StoragePanel from "@/components/system/storage-panel";
import AiConfigPanel from "@/components/system/ai-config-panel";
import FolderConfigPanel from "@/components/system/folder-config-panel";
import OneDrivePanel from "@/components/system/onedrive-panel";
import OneDriveFileRouter from "@/components/onedrive/onedrive-file-router";
import OneDriveBrowser from "@/components/onedrive/onedrive-browser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Project } from "@shared/schema";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState({
    gestione: "progetti",
    sistema: "storage"
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
                {/* First Row - Recent Projects */}
                <RecentProjectsTable />
                
                {/* Second Row - Core System Info */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <StatsCard />
                  <OneDriveStatusCard />
                </div>
              </div>
            )}

            {/* Management Panel */}
            {activeTab === "gestione" && (
              <div data-testid="management-panel">
                <Tabs value={activeSubTab.gestione} onValueChange={(value) => handleSubTabChange("gestione", value)}>
                  <div className="bg-white rounded-t-2xl border-b border-gray-200">
                    <TabsList className="flex w-full bg-transparent border-0 p-0">
                      <TabsTrigger 
                        value="nuova" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-nuova"
                      >
                        Nuova Commessa
                      </TabsTrigger>
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
                  
                  <TabsContent value="nuova" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <div className="max-w-2xl mx-auto space-y-6">
                      <NewProjectForm 
                        onProjectSaved={setPendingProject}
                      />
                      <FolderStructureCard 
                        pendingProject={pendingProject}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="clienti" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <ClientsTable />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Auto-Routing Panel */}
            {activeTab === "routing" && (
              <div className="max-w-6xl mx-auto space-y-6" data-testid="routing-panel">
                <div className="grid gap-6 lg:grid-cols-1">
                  {/* New OneDrive Auto-Routing System */}
                  <OneDriveAutoRouting />
                  
                  {/* Bulk Rename Tool */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">🔄 Rinomina File in Massa</h3>
                    <p className="text-gray-600 mb-4">
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

            {/* OneDrive Browser Panel */}
            {activeTab === "onedrive" && (
              <div data-testid="onedrive-browser-panel">
                <OneDriveBrowser />
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
                        value="onedrive" 
                        className="px-6 py-4 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary hover:bg-gray-50 transition-colors rounded-none"
                        data-testid="tab-onedrive"
                      >
                        ☁️ OneDrive Config
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="storage" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <StoragePanel />
                  </TabsContent>
                  
                  <TabsContent value="ai" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <AiConfigPanel />
                  </TabsContent>
                  
                  
                  <TabsContent value="onedrive" className="bg-white rounded-b-2xl shadow-lg border border-gray-100 p-6 mt-0">
                    <div className="space-y-8">
                      {/* Sezione Cartelle */}
                      <div className="border-b border-gray-200 pb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          📁 Gestione Cartelle
                        </h3>
                        <FolderConfigPanel />
                      </div>
                      
                      {/* Sezione Configurazione OneDrive */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
