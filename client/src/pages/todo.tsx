import { lazy, Suspense } from "react";
import { PageFallback } from "@/components/layout/page-fallback";

const TodoPanel = lazy(() => import("@/components/todo/TodoPanel"));

export default function TodoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">To Do</h2>
        <p className="text-sm text-muted-foreground">Gestione attivita e compiti</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <TodoPanel />
      </Suspense>
    </div>
  );
}
