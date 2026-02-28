import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const ParcellaCalculator = lazy(() => import("@/components/projects/parcella-calculator-new"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

export default function ParcellaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Calcolatore Parcella</h2>
        <p className="text-sm text-muted-foreground">Calcolo compensi professionali secondo DM2016</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <ParcellaCalculator />
      </Suspense>
    </div>
  );
}
