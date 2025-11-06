import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Wrench } from "lucide-react";

export function TasksReview() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
      <div className="p-4 bg-blue-100 rounded-full">
        <Wrench className="h-12 w-12 text-blue-600" />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">In Sviluppo - Fase 3</h3>
        <p className="text-muted-foreground max-w-md">
          Questa funzionalità permetterà di rivedere e approvare task suggerite automaticamente
          dall'AI basandosi sul contenuto delle comunicazioni.
        </p>
        <Badge variant="secondary" className="mt-4">
          <CheckSquare className="h-3 w-3 mr-1" />
          Disponibile nella Fase 3
        </Badge>
      </div>

      {/* Preview Card */}
      <Card className="mt-6 w-full max-w-2xl border-dashed">
        <CardContent className="pt-6">
          <div className="space-y-3 text-left text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Funzionalità previste:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Visualizzazione task suggerite dall'AI</li>
              <li>Dettagli del task (titolo, descrizione, priorità, scadenza)</li>
              <li>Pulsante "Approva e Crea Task"</li>
              <li>Modifica prima della creazione</li>
              <li>Rifiuto con feedback</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
