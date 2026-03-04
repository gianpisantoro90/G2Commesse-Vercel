import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkRenameResultsProps {
  results: Array<{original: string, renamed: string}>;
  onClear: () => void;
}

export default function BulkRenameResults({ results, onClear }: BulkRenameResultsProps) {
  if (!results || results.length === 0) {
    return null;
  }

  const renamedCount = results.filter(r => r.original !== r.renamed).length;
  const alreadyCorrectCount = results.filter(r => r.original === r.renamed).length;

  return (
    <div className="card-g2 border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20" data-testid="bulk-rename-results">
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 flex items-center gap-2">
            <span className="text-xl">✅</span>
            Rinominazione Completata
          </h3>
          <div className="text-sm text-green-700 dark:text-green-300">
            {results.length} file elaborati
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{renamedCount}</div>
            <div className="text-sm text-muted-foreground">File rinominati</div>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{alreadyCorrectCount}</div>
            <div className="text-sm text-muted-foreground">Già corretti</div>
          </div>
        </div>

        {renamedCount > 0 && (
          <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Download completato!</strong> I file rinominati sono stati scaricati.
              Sostituisci manualmente i file originali nella cartella della commessa.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Dettagli operazione:</h4>
          <div className="max-h-64 overflow-y-auto bg-card border border-border rounded-lg p-3">
            {results.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                <div className="text-sm">
                  <div className="text-muted-foreground">{item.original}</div>
                  {item.original !== item.renamed && (
                    <div className="text-green-600 dark:text-green-400 font-medium">→ {item.renamed}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  {item.original === item.renamed ? (
                    <span className="text-xs bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 px-2 py-1 rounded">
                      Già corretto
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                      Rinominato
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            onClick={onClear}
            variant="outline"
            className="px-6 py-2 border-2 border-border text-foreground rounded-lg font-semibold hover:bg-muted"
            data-testid="clear-results-button"
          >
            🔄 Rinomina Altri File
          </Button>
        </div>
      </div>
    </div>
  );
}