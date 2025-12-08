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
    <div className="card-g2" data-testid="email-checker-card">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Controllo Email
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Verifica manualmente i nuovi messaggi
          </p>
        </div>
      </div>

      {/* Action */}
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

      {/* Hint */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
        💡 Il controllo è manuale. Clicca il tasto per verificare i nuovi messaggi.
      </p>
    </div>
  );
}
