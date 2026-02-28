import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const StoragePanel = lazy(() => import("@/components/system/storage-panel"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

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
