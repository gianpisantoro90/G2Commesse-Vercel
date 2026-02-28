import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const FatturazionePage = lazy(() => import("@/components/projects/fatturazione-page"));

export default function FatturazionePageWrapper() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Fatturazione</h2>
        <p className="text-sm text-muted-foreground">Prestazioni, fatture e pagamenti</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <FatturazionePage />
      </Suspense>
    </div>
  );
}
