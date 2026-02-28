import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const SezioneCosti = lazy(() => import("@/components/projects/sezione-costi"));

export default function CostiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Costi</h2>
        <p className="text-sm text-muted-foreground">Gestione costi risorse e spese</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <SezioneCosti />
      </Suspense>
    </div>
  );
}
