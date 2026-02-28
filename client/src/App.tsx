import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/error-boundary";
import AiChatWidget from "@/components/ai-assistant/ai-chat-widget";
import AppLayout from "@/components/layout/app-layout";

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CommessePage = lazy(() => import("@/pages/commesse"));
const NuovaCommessaPage = lazy(() => import("@/pages/nuova-commessa"));
const ClientiPage = lazy(() => import("@/pages/clienti"));
const ComunicazioniPage = lazy(() => import("@/pages/comunicazioni"));
const CostiPage = lazy(() => import("@/pages/costi"));
const ParcellaPage = lazy(() => import("@/pages/parcella"));
const RequisitiPage = lazy(() => import("@/pages/requisiti"));
const TodoPage = lazy(() => import("@/pages/todo"));
const ScadenzePage = lazy(() => import("@/pages/scadenze"));
const FatturazionePage = lazy(() => import("@/pages/fatturazione"));
const RevisioneAI = lazy(() => import("@/pages/revisione-ai"));
const UtentiPage = lazy(() => import("@/pages/sistema/utenti"));
const StoragePage = lazy(() => import("@/pages/sistema/storage"));
const AiConfigPage = lazy(() => import("@/pages/sistema/ai-config"));
const OneDriveBrowserPage = lazy(() => import("@/pages/sistema/onedrive-browser"));
const OneDriveConfigPage = lazy(() => import("@/pages/sistema/onedrive-config"));

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Caricamento...</span>
    </div>
  );
}

// Redirect old hash-based URLs to new routes
const hashRedirectMap: Record<string, string> = {
  gestione: "/commesse",
  todo: "/todo",
  scadenze: "/scadenze",
  fatturazione: "/fatturazione",
  "revisione-ai": "/revisione-ai",
  sistema: "/sistema/utenti",
};

function HashRedirector() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && hashRedirectMap[hash]) {
      window.location.hash = "";
      setLocation(hashRedirectMap[hash]);
    }
  }, [setLocation]);

  return null;
}

// Admin-only route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <PageFallback />;
  }
  if (user?.role !== "admin") {
    return <Redirect to="/" />;
  }
  return <>{children}</>;
}

function AuthenticatedRouter() {
  return (
    <AppLayout>
      <HashRedirector />
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/commesse" component={CommessePage} />
          <Route path="/commesse/nuova">
            <AdminRoute><NuovaCommessaPage /></AdminRoute>
          </Route>
          <Route path="/clienti">
            <AdminRoute><ClientiPage /></AdminRoute>
          </Route>
          <Route path="/comunicazioni" component={ComunicazioniPage} />
          <Route path="/costi">
            <AdminRoute><CostiPage /></AdminRoute>
          </Route>
          <Route path="/parcella">
            <AdminRoute><ParcellaPage /></AdminRoute>
          </Route>
          <Route path="/requisiti">
            <AdminRoute><RequisitiPage /></AdminRoute>
          </Route>
          <Route path="/todo" component={TodoPage} />
          <Route path="/scadenze" component={ScadenzePage} />
          <Route path="/fatturazione">
            <AdminRoute><FatturazionePage /></AdminRoute>
          </Route>
          <Route path="/revisione-ai">
            <AdminRoute><RevisioneAI /></AdminRoute>
          </Route>
          <Route path="/revisione-ai/tasks">
            <AdminRoute><RevisioneAI /></AdminRoute>
          </Route>
          <Route path="/revisione-ai/scadenze">
            <AdminRoute><RevisioneAI /></AdminRoute>
          </Route>
          <Route path="/sistema/utenti">
            <AdminRoute><UtentiPage /></AdminRoute>
          </Route>
          <Route path="/sistema/storage">
            <AdminRoute><StoragePage /></AdminRoute>
          </Route>
          <Route path="/sistema/ai-config">
            <AdminRoute><AiConfigPage /></AdminRoute>
          </Route>
          <Route path="/sistema/onedrive-browser">
            <AdminRoute><OneDriveBrowserPage /></AdminRoute>
          </Route>
          <Route path="/sistema/onedrive-config">
            <AdminRoute><OneDriveConfigPage /></AdminRoute>
          </Route>
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={checkAuth} />;
  }

  return (
    <>
      <Toaster />
      <AuthenticatedRouter />
      <AiChatWidget />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
