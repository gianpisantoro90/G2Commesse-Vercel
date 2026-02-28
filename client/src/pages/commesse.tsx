import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const ProjectsTable = lazy(() => import("@/components/projects/projects-table"));

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
