import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const FolderConfigPanel = lazy(() => import("@/components/system/folder-config-panel"));
const OneDrivePanel = lazy(() => import("@/components/system/onedrive-panel"));

export default function OneDriveConfigPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configurazione OneDrive</h2>
        <p className="text-sm text-muted-foreground">Gestione cartelle e connessione OneDrive</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <div className="space-y-8">
          <div className="border-b border-border pb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Gestione Cartelle</h3>
            <FolderConfigPanel />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Configurazione OneDrive</h3>
            <OneDrivePanel />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
