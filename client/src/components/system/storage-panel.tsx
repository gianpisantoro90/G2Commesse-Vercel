import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ImportReport } from "@shared/schema";
import { AlertTriangle, CheckCircle2, Upload, Download, Loader2 } from "lucide-react";

const ENTITY_LABELS: Record<string, string> = {
  users: "Utenti",
  clients: "Clienti",
  systemConfig: "Configurazione",
  projects: "Commesse",
  oneDriveMappings: "Mapping OneDrive",
  filesIndex: "Indice File",
  fileRoutings: "Routing File",
  tasks: "Attività",
  communications: "Comunicazioni",
  deadlines: "Scadenze",
  invoices: "Fatture",
  prestazioni: "Prestazioni",
  budget: "Budget",
  resources: "Risorse",
};

export default function StoragePanel() {
  const { toast } = useToast();
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"merge" | "overwrite">("merge");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const handleExportAllData = async () => {
    try {
      const response = await apiRequest("GET", "/api/export");
      const data = await response.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `g2-backup-completo-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export completato",
        description: "Tutti i dati sono stati esportati con successo",
      });
    } catch (error) {
      toast({
        title: "Errore nell'export",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    }
  };

  const handleImportClick = () => {
    setSelectedMode("merge");
    setConfirmOverwrite(false);
    setModeDialogOpen(true);
  };

  const handleModeConfirm = () => {
    if (selectedMode === "overwrite" && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    setModeDialogOpen(false);
    setConfirmOverwrite(false);
    triggerFileSelect();
  };

  const triggerFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await executeImport(file);
    };
    input.click();
  };

  const executeImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const payload = { ...data, mode: selectedMode };
      const jsonString = JSON.stringify(payload);

      // Compress with gzip to stay under Vercel's 4.5MB infrastructure limit
      const encoder = new TextEncoder();
      const stream = new Blob([encoder.encode(jsonString)]).stream();
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      const compressedBlob = await new Response(compressedStream).blob();

      const res = await fetch("/api/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
        },
        body: compressedBlob,
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || `Import failed: ${res.status}`);
      }

      const result = await res.json();
      const report: ImportReport = result.report;
      setImportReport(report);
      setReportDialogOpen(true);

      toast({
        title: report.success ? "Import completato" : "Import completato con avvisi",
        description: `${report.totalCreated} creati, ${report.totalUpdated} aggiornati${report.totalErrors > 0 ? `, ${report.totalErrors} errori` : ''}`,
        variant: report.totalErrors > 0 ? "destructive" : "default",
      });
    } catch (error: any) {
      toast({
        title: "Errore nell'import",
        description: error.message || "Si è verificato un errore durante l'importazione",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div data-testid="storage-panel">
      <h3 className="text-lg font-semibold text-foreground mb-6">Gestione Dati</h3>

      {/* Data Management */}
      <div className="bg-muted rounded-md p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-background rounded-lg p-4 text-center">
            <div className="text-2xl mb-2"><Download className="mx-auto h-6 w-6 text-muted-foreground" /></div>
            <div className="font-semibold text-foreground mb-1">Export Completo</div>
            <div className="text-sm text-muted-foreground mb-3">Esporta tutti i dati in formato JSON</div>
            <Button
              onClick={handleExportAllData}
              className="w-full button-g2-primary"
              data-testid="export-all"
            >
              Esporta
            </Button>
          </div>
          <div className="bg-background rounded-lg p-4 text-center">
            <div className="text-2xl mb-2"><Upload className="mx-auto h-6 w-6 text-muted-foreground" /></div>
            <div className="font-semibold text-foreground mb-1">Import Dati</div>
            <div className="text-sm text-muted-foreground mb-3">
              Importa dati da file JSON
              <br />
              <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">Opzioni: Unisci o Sovrascrivi</span>
            </div>
            <Button
              onClick={handleImportClick}
              variant="outline"
              className="w-full button-g2-secondary"
              data-testid="import-data"
              disabled={importing}
            >
              {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</> : "Importa"}
            </Button>
          </div>
          <div className="bg-background rounded-lg p-4 text-center">
            <div className="text-2xl mb-2"><CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" /></div>
            <div className="font-semibold text-foreground mb-1">Backup Auto</div>
            <div className="text-sm text-muted-foreground mb-3">Funzionalità in fase di sviluppo</div>
            <Badge variant="outline" className="text-xs">Prossimamente</Badge>
          </div>
        </div>
      </div>

      {/* Mode Selection Dialog */}
      <Dialog open={modeDialogOpen} onOpenChange={(open) => { setModeDialogOpen(open); setConfirmOverwrite(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modalità di importazione</DialogTitle>
            <DialogDescription>
              Scegli come gestire i dati esistenti durante l'importazione.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={selectedMode} onValueChange={(v) => { setSelectedMode(v as "merge" | "overwrite"); setConfirmOverwrite(false); }}>
            <div className="flex items-start space-x-3 p-3 rounded-md border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="merge" id="mode-merge" className="mt-0.5" />
              <Label htmlFor="mode-merge" className="cursor-pointer flex-1">
                <div className="font-semibold">Unisci (Merge)</div>
                <div className="text-sm text-muted-foreground">
                  Mantiene i dati esistenti. I record con lo stesso ID vengono aggiornati, i nuovi vengono aggiunti.
                </div>
              </Label>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-md border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="overwrite" id="mode-overwrite" className="mt-0.5" />
              <Label htmlFor="mode-overwrite" className="cursor-pointer flex-1">
                <div className="font-semibold">Sovrascrivi (Overwrite)</div>
                <div className="text-sm text-muted-foreground">
                  Elimina tutti i dati esistenti e li sostituisce con quelli dal file.
                </div>
              </Label>
            </div>
          </RadioGroup>

          {confirmOverwrite && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Attenzione: Sovrascrittura irreversibile</div>
                <div>Tutti i dati esistenti verranno eliminati. Consiglio: esporta prima un backup. Clicca di nuovo per confermare.</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModeDialogOpen(false); setConfirmOverwrite(false); }}>
              Annulla
            </Button>
            <Button
              onClick={handleModeConfirm}
              variant={selectedMode === "overwrite" && confirmOverwrite ? "destructive" : "default"}
            >
              {selectedMode === "overwrite" && confirmOverwrite ? "Conferma sovrascrittura" : "Seleziona file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importReport?.success
                ? <><CheckCircle2 className="h-5 w-5 text-green-600" /> Report Import</>
                : <><AlertTriangle className="h-5 w-5 text-yellow-600" /> Report Import (con avvisi)</>
              }
            </DialogTitle>
            <DialogDescription>
              Modalità: <Badge variant="outline">{importReport?.mode === 'merge' ? 'Unisci' : 'Sovrascrivi'}</Badge>
            </DialogDescription>
          </DialogHeader>

          {importReport && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-2 rounded bg-green-50 dark:bg-green-950/30">
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">{importReport.totalCreated}</div>
                  <div className="text-xs text-muted-foreground">Creati</div>
                </div>
                <div className="p-2 rounded bg-teal-50 dark:bg-teal-950/30">
                  <div className="text-lg font-bold text-teal-700 dark:text-teal-400">{importReport.totalUpdated}</div>
                  <div className="text-xs text-muted-foreground">Aggiornati</div>
                </div>
                <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-950/30">
                  <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{importReport.totalSkipped}</div>
                  <div className="text-xs text-muted-foreground">Saltati</div>
                </div>
                <div className="p-2 rounded bg-red-50 dark:bg-red-950/30">
                  <div className="text-lg font-bold text-red-700 dark:text-red-400">{importReport.totalErrors}</div>
                  <div className="text-xs text-muted-foreground">Errori</div>
                </div>
              </div>

              {/* Detail Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entità</TableHead>
                    <TableHead className="text-right">Creati</TableHead>
                    <TableHead className="text-right">Aggiornati</TableHead>
                    <TableHead className="text-right">Saltati</TableHead>
                    <TableHead className="text-right">Errori</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(importReport.entities).map(([key, entity]) => (
                    <TableRow key={key} className={entity.errors.length > 0 ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                      <TableCell className="font-medium">{ENTITY_LABELS[key] || key}</TableCell>
                      <TableCell className="text-right">{entity.created}</TableCell>
                      <TableCell className="text-right">{entity.updated}</TableCell>
                      <TableCell className="text-right">{entity.skipped}</TableCell>
                      <TableCell className="text-right">
                        {entity.errors.length > 0 ? (
                          <span className="text-destructive font-semibold">{entity.errors.length}</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Error details */}
              {importReport.totalErrors > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive">Dettaglio errori</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {Object.entries(importReport.entities)
                      .filter(([, entity]) => entity.errors.length > 0)
                      .flatMap(([key, entity]) =>
                        entity.errors.map((err, i) => (
                          <div key={`${key}-${i}`} className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1">
                            <span className="font-medium">{ENTITY_LABELS[key] || key}:</span> {err}
                          </div>
                        ))
                      )}
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button onClick={() => setReportDialogOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
