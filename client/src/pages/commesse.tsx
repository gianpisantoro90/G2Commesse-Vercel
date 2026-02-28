import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const ProjectsTable = lazy(() => import("@/components/projects/projects-table"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

export default function CommessePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Commesse</h2>
        <p className="text-sm text-muted-foreground">Elenco di tutte le commesse e progetti</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <ProjectsTable />
      </Suspense>
    </div>
  );
}
