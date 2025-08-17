import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-2 border-green-200 bg-green-50/50" data-testid="bulk-rename-results">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-green-900 flex items-center gap-2">
            <span className="text-xl">✅</span>
            Rinominazione Completata
          </CardTitle>
          <div className="text-sm text-green-700">
            {results.length} file elaborati
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{renamedCount}</div>
            <div className="text-sm text-gray-600">File rinominati</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{alreadyCorrectCount}</div>
            <div className="text-sm text-gray-600">Già corretti</div>
          </div>
        </div>

        {renamedCount > 0 && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              <strong>Download completato!</strong> I file rinominati sono stati scaricati. 
              Sostituisci manualmente i file originali nella cartella della commessa.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Dettagli operazione:</h4>
          <div className="max-h-64 overflow-y-auto bg-white border rounded-lg p-3">
            {results.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="text-sm">
                  <div className="text-gray-600">{item.original}</div>
                  {item.original !== item.renamed && (
                    <div className="text-green-600 font-medium">→ {item.renamed}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  {item.original === item.renamed ? (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Già corretto
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Rinominato
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={onClear}
            variant="outline"
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
            data-testid="clear-results-button"
          >
            🔄 Rinomina Altri File
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}