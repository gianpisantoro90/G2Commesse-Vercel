import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const RequisitiTecnici = lazy(() => import("@/components/projects/requisiti-tecnici"));

export default function RequisitiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Requisiti Tecnici</h2>
        <p className="text-sm text-muted-foreground">Classificazioni e requisiti DM2016</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <RequisitiTecnici />
      </Suspense>
    </div>
  );
}
