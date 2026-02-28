import { lazy, Suspense, useState } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const NewProjectForm = lazy(() => import("@/components/projects/new-project-form"));

export default function NuovaCommessaPage() {
  const [, setPendingProject] = useState(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Nuova Commessa</h2>
        <p className="text-sm text-muted-foreground">Crea una nuova commessa o progetto</p>
      </div>
      <div className="max-w-2xl">
        <Suspense fallback={<PageFallback />}>
          <NewProjectForm onProjectSaved={setPendingProject} />
        </Suspense>
      </div>
    </div>
  );
}
