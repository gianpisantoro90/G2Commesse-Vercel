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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Brand Logo */}
            <img
              src={logoUrl}
              alt="G2 Ingegneria Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-lg object-contain flex-shrink-0"
              data-testid="brand-logo"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-primary tracking-tight truncate" data-testid="brand-title">
                G2 Ingegneria
              </h1>
              <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 truncate" data-testid="brand-subtitle">
                Sistema Gestione Commesse
              </p>
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
            <ThemeToggle />
            <NotificationCenter />
            {user && (
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs sm:text-sm font-semibold flex-shrink-0">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col">
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
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>

        </div>
      </div>
    </header>
  );
}
