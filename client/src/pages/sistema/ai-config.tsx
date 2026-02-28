import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const AiConfigPanelUnified = lazy(() => import("@/components/system/ai-config-panel-unified"));
const AiFeatureConfigPanel = lazy(() => import("@/components/ai-assistant/ai-feature-config-panel"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

export default function AiConfigPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configurazione AI</h2>
        <p className="text-sm text-muted-foreground">Modello AI, provider e funzionalita</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <div className="space-y-8">
          <AiConfigPanelUnified />
          <div className="border-t border-border pt-8">
            <AiFeatureConfigPanel />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
