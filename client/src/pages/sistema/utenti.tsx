import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const UserManagementPanel = lazy(() => import("@/components/system/user-management-panel"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

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
