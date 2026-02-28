import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const RegistroComunicazioni = lazy(() => import("@/components/projects/registro-comunicazioni"));

export default function ComunicazioniPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Comunicazioni</h2>
        <p className="text-sm text-muted-foreground">Registro comunicazioni e email</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <RegistroComunicazioni />
      </Suspense>
    </div>
  );
}
