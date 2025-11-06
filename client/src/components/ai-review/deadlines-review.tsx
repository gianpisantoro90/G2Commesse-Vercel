import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Wrench } from "lucide-react";

export function DeadlinesReview() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
      <div className="p-4 bg-orange-100 rounded-full">
        <Wrench className="h-12 w-12 text-orange-600" />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">In Sviluppo - Fase 3</h3>
        <p className="text-muted-foreground max-w-md">
          Questa funzionalità permetterà di rivedere e approvare scadenze e milestone suggerite
          automaticamente dall'AI basandosi sul contenuto delle comunicazioni.
        </p>
        <Badge variant="secondary" className="mt-4">
          <Calendar className="h-3 w-3 mr-1" />
          Disponibile nella Fase 3
        </Badge>
      </div>

      {/* Preview Card */}
      <Card className="mt-6 w-full max-w-2xl border-dashed">
        <CardContent className="pt-6">
          <div className="space-y-3 text-left text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Funzionalità previste:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Visualizzazione scadenze suggerite dall'AI</li>
              <li>Dettagli della scadenza (titolo, descrizione, data, tipo)</li>
              <li>Pulsante "Approva e Crea Scadenza"</li>
              <li>Modifica prima della creazione</li>
              <li>Rifiuto con feedback</li>
              <li>Collegamento automatico al progetto</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
