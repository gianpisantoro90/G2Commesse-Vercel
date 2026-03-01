import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, RefreshCw } from "lucide-react";
import OneDriveAutoRouting from "@/components/routing/onedrive-auto-routing";
import BulkRenameForm from "@/components/routing/bulk-rename-form";
import BulkRenameResults from "@/components/routing/bulk-rename-results";

interface BulkRenameResult {
  original: string;
  renamed: string;
}

export default function RoutingPage() {
  const [bulkRenameResults, setBulkRenameResults] = useState<BulkRenameResult[] | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestione File e Routing AI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Classificazione intelligente e organizzazione file su OneDrive
        </p>
      </div>

      <Tabs defaultValue="intelligent" className="w-full">
        <TabsList>
          <TabsTrigger value="intelligent" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Routing AI</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="bulk-rename" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Rinomina in massa</span>
            <span className="sm:hidden">Rinomina</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intelligent" className="mt-6">
          <OneDriveAutoRouting />
        </TabsContent>

        <TabsContent value="bulk-rename" className="mt-6 space-y-6">
          {bulkRenameResults ? (
            <>
              <BulkRenameResults
                results={bulkRenameResults}
                onClear={() => setBulkRenameResults(null)}
              />
              <BulkRenameForm onRenameComplete={setBulkRenameResults} />
            </>
          ) : (
            <BulkRenameForm onRenameComplete={setBulkRenameResults} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
