import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const OneDriveBrowser = lazy(() => import("@/components/onedrive/onedrive-browser"));

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
