import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const OneDriveBrowser = lazy(() => import("@/components/onedrive/onedrive-browser"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

export default function OneDriveBrowserPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">OneDrive Browser</h2>
        <p className="text-sm text-muted-foreground">Esplora e collega file OneDrive ai progetti</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <OneDriveBrowser />
      </Suspense>
    </div>
  );
}
