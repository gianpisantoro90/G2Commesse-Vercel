import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const AiConfigPanelUnified = lazy(() => import("@/components/system/ai-config-panel-unified"));

export default function AiConfigPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configurazione AI</h2>
        <p className="text-sm text-muted-foreground">Modello AI, provider e funzionalita</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <AiConfigPanelUnified />
      </Suspense>
    </div>
  );
}
