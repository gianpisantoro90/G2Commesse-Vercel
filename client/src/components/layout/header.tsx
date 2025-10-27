import logoUrl from "@assets/G2 - Logo_1755532156423.png";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function Header() {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b-2 border-primary sticky top-0 z-50 shadow-sm" data-testid="header">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Brand Logo */}
            <img
              src={logoUrl}
              alt="G2 Ingegneria Logo"
              className="w-12 h-12 rounded-xl shadow-lg object-contain"
              data-testid="brand-logo"
            />
            <div>
              <h1 className="text-xl font-bold text-primary tracking-tight" data-testid="brand-title">
                G2 Ingegneria
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="brand-subtitle">
                Sistema Gestione Commesse
              </p>
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationCenter />
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.fullName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {user.role === 'admin' ? 'Amministratore' : 'Utilizzatore'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Esci
            </Button>
          </div>

        </div>
      </div>
    </header>
  );
}
