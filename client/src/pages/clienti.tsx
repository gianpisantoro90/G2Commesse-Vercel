import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const ClientsTable = lazy(() => import("@/components/projects/clients-table"));

export default function ClientiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Clienti</h2>
        <p className="text-sm text-muted-foreground">Gestione anagrafica clienti</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <ClientsTable />
      </Suspense>
    </div>
  );
}
