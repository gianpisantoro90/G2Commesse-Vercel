import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const RegistroComunicazioni = lazy(() => import("@/components/projects/registro-comunicazioni"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

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
