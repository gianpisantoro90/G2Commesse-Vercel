/**
 * CRE Generator Component
 *
 * Componente per la generazione automatica delle Certificazioni di Buona Esecuzione (CRE)
 * per servizi di ingegneria e architettura.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Building2,
  Calendar,
  Euro,
  Briefcase,
  Loader2,
} from "lucide-react";
import type { Project } from "@shared/schema";

interface CREGeneratorProps {
  project: Project;
  children?: React.ReactNode;
}

interface CREPreview {
  committente: {
    denominazione: string;
    indirizzo: string;
    codiceFiscale: string;
    partitaIva: string;
    responsabileProcedimento: string;
    qualifica: string;
  };
  opera: {
    oggetto: string;
    cig: string;
    numeroContratto: string;
    dataInizio: string;
    dataFine: string;
  };
  servizio: {
    tipologie: string[];
    importoTotaleOpere: number;
    importoTotaleServizio: number;
  };
  classificazioni: Array<{
    codice: string;
    importo: number;
    importoOpere?: number;
    importoServizio?: number;
    gradoComplessita: string;
  }>;
  isComplete: {
    complete: boolean;
    missing: string[];
  };
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "- -";
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function CREGenerator({ project, children }: CREGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch CRE preview data
  const { data: preview, isLoading, error } = useQuery<CREPreview>({
    queryKey: [`/api/projects/${project.id}/cre/preview`],
    enabled: open,
  });

  // Handle document download
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/cre/generate`, { credentials: "include" });
      if (!response.ok) {
        throw new Error('Errore nella generazione del documento');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRE_${project.code}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading CRE:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            Genera CRE
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Certificazione di Buona Esecuzione
          </DialogTitle>
          <DialogDescription>
            Commessa {project.code} - {project.client}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Caricamento anteprima...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription>
              Impossibile caricare l'anteprima della CRE
            </AlertDescription>
          </Alert>
        ) : preview ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            {/* Completeness Check */}
            {!preview.isComplete.complete && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Dati Incompleti</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">Per generare una CRE completa, mancano i seguenti dati:</p>
                  <ul className="list-disc list-inside text-sm">
                    {preview.isComplete.missing.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {preview.isComplete.complete && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Dati Completi</AlertTitle>
                <AlertDescription className="text-green-700">
                  Tutti i dati necessari sono disponibili per generare la CRE.
                </AlertDescription>
              </Alert>
            )}

            {/* Committente Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Committente</h3>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500">Denominazione:</span>
                    <p className="font-medium">{preview.committente.denominazione || "- -"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Indirizzo:</span>
                    <p className="font-medium">{preview.committente.indirizzo || "- -"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">C.F.:</span>
                    <p className="font-medium">{preview.committente.codiceFiscale || "- -"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">P.IVA:</span>
                    <p className="font-medium">{preview.committente.partitaIva || "- -"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Resp. Procedimento:</span>
                    <p className="font-medium">{preview.committente.responsabileProcedimento || "- -"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Qualifica:</span>
                    <p className="font-medium">{preview.committente.qualifica || "- -"}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Opera Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Opera/Intervento</h3>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Oggetto:</span>
                  <p className="font-medium">{preview.opera.oggetto || "- -"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500">CIG:</span>
                    <p className="font-medium">{preview.opera.cig || "- -"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">N. Contratto:</span>
                    <p className="font-medium">{preview.opera.numeroContratto || "- -"}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Periodo Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Periodo di Esecuzione</h3>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500">Data Inizio:</span>
                    <p className="font-medium">{preview.opera.dataInizio}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Fine:</span>
                    <p className="font-medium">{preview.opera.dataFine}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Tipologia Servizio */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Tipologia del Servizio</h3>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                {preview.servizio.tipologie.length > 0 ? (
                  <ul className="space-y-1">
                    {preview.servizio.tipologie.map((t, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-primary">•</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">Nessuna prestazione specificata</p>
                )}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Importi Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Importi</h3>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500">Importo Totale Opere:</span>
                    <p className="font-semibold text-lg">{formatCurrency(preview.servizio.importoTotaleOpere)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Importo Totale Servizio:</span>
                    <p className="font-semibold text-lg text-primary">{formatCurrency(preview.servizio.importoTotaleServizio)}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Classificazioni DM */}
            <div className="space-y-4">
              <h3 className="font-semibold">Classificazioni DM 17/06/2016</h3>
              {preview.classificazioni.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">ID. Opere</th>
                        <th className="px-3 py-2 text-center">Grado G</th>
                        <th className="px-3 py-2 text-right">Importo Opere</th>
                        <th className="px-3 py-2 text-right">Importo Servizio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.classificazioni.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <Badge variant="outline">{c.codice}</Badge>
                          </td>
                          <td className="px-3 py-2 text-center font-mono">{c.gradoComplessita}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(c.importoOpere || c.importo)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(c.importoServizio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessuna classificazione DM 17/06/2016 specificata. Aggiungi le classificazioni nella sezione Prestazioni del progetto.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>
        ) : null}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Chiudi
          </Button>
          <Button
            onClick={handleDownload}
            disabled={downloading || isLoading}
            className="gap-2"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generazione...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Scarica CRE (Word)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
