import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function EmailCheckerCard() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckEmails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/emails/check-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore nel controllo email");
      }

      const data = await response.json();
      toast({
        title: "✓ Controllo Completato",
        description: data.message,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "✗ Errore",
        description: error instanceof Error ? error.message : "Errore nel controllo email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Controllo Email
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Verifica manualmente i nuovi messaggi
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Button
          onClick={handleCheckEmails}
          disabled={isLoading}
          className="w-full gap-2"
          variant="default"
          data-testid="button-check-emails"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Controllo in corso...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Controlla Email Adesso
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        💡 Il controllo è manuale. Clicca il tasto per verificare i nuovi messaggi.
      </p>
    </div>
  );
}
