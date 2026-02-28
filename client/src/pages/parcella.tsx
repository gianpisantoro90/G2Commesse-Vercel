import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const ParcellaCalculator = lazy(() => import("@/components/projects/parcella-calculator-new"));

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
