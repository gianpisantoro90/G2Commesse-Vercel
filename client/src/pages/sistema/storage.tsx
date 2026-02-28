import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const StoragePanel = lazy(() => import("@/components/system/storage-panel"));

export default function StoragePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Storage</h2>
        <p className="text-sm text-muted-foreground">Esportazione e importazione dati</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <StoragePanel />
      </Suspense>
    </div>
  );
}
