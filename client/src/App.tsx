import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth } from "@/hooks/useAuth";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Caricamento...</p>
      </div>
    </div>
  );
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route>
        <Dashboard />
      </Route>
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={login} />;
  }

  return (
    <div className="min-h-screen bg-g2-accent">
      <Toaster />
      <AuthenticatedRouter />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
