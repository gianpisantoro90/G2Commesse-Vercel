import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";

const NewProjectForm = lazy(() => import("@/components/projects/new-project-form"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

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
