import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const UserManagementPanel = lazy(() => import("@/components/system/user-management-panel"));

export default function UtentiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Gestione Utenti</h2>
        <p className="text-sm text-muted-foreground">Crea, modifica e gestisci gli utenti del sistema</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <UserManagementPanel />
      </Suspense>
    </div>
  );
}
