import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const Scadenzario = lazy(() => import("@/components/projects/scadenzario"));

export default function ScadenzePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Scadenze</h2>
        <p className="text-sm text-muted-foreground">Calendario e gestione scadenze</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <Scadenzario />
      </Suspense>
    </div>
  );
}
