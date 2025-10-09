import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  calcolaParcella,
  calcolaFattura,
  formatEuro,
  suggestClasseDM143,
  CLASSI_DM143,
  type ParcellaInput,
  type ParcellaResult,
  type FatturaCalculation
} from "@/lib/parcella-calculator";
import { PRESTAZIONI_CONFIG, LIVELLO_PROGETTAZIONE_CONFIG } from "@/lib/prestazioni-utils";
import {
  Calculator,
  FileText,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

type WizardStep = 'input' | 'result';

export default function ParcellaCalculator() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('input');
  const [calculationResult, setCalculationResult] = useState<ParcellaResult | null>(null);
  const [fatturaResult, setFatturaResult] = useState<FatturaCalculation | null>(null);

  // Form state
  const [importoOpere, setImportoOpere] = useState<string>('');
  const [classeDM143, setClasseDM143] = useState<string>('');
  const [prestazioni, setPrestazioni] = useState<string[]>([]);
  const [livelloProgettazione, setLivelloProgettazione] = useState<string[]>([]);
  const [complessita, setComplessita] = useState<'bassa' | 'media' | 'alta'>('media');

  // Fattura settings
  const [aliquotaCPA, setAliquotaCPA] = useState<number>(4);
  const [aliquotaIVA, setAliquotaIVA] = useState<number>(22);
  const [aliquotaRitenuta, setAliquotaRitenuta] = useState<number>(20);

  const handlePrestazioneToggle = (prestazioneId: string) => {
    setPrestazioni(prev =>
      prev.includes(prestazioneId)
        ? prev.filter(p => p !== prestazioneId)
        : [...prev, prestazioneId]
    );

    // Se deseleziono progettazione, resetto i livelli
    if (prestazioneId === 'progettazione' && prestazioni.includes('progettazione')) {
      setLivelloProgettazione([]);
    }
  };

  const handleLivelloToggle = (livelloId: string) => {
    setLivelloProgettazione(prev =>
      prev.includes(livelloId)
        ? prev.filter(l => l !== livelloId)
        : [...prev, livelloId]
    );
  };

  const handleCalculate = () => {
    const importo = parseFloat(importoOpere.replace(/[^0-9.-]/g, ''));

    if (!importo || importo <= 0) {
      toast({
        title: "Errore",
        description: "Inserire un importo opere valido",
        variant: "destructive"
      });
      return;
    }

    if (prestazioni.length === 0) {
      toast({
        title: "Errore",
        description: "Selezionare almeno una prestazione",
        variant: "destructive"
      });
      return;
    }

    if (prestazioni.includes('progettazione') && livelloProgettazione.length === 0) {
      toast({
        title: "Errore",
        description: "Selezionare almeno un livello di progettazione",
        variant: "destructive"
      });
      return;
    }

    const input: ParcellaInput = {
      importoOpere: importo,
      classeDM143: classeDM143 || undefined,
      prestazioni,
      livelloProgettazione: livelloProgettazione.length > 0 ? livelloProgettazione : undefined,
      complessita
    };

    const result = calcolaParcella(input);
    setCalculationResult(result);

    // Calcola anche la fattura
    const fattura = calcolaFattura(
      result.compensoTotale,
      aliquotaCPA,
      aliquotaIVA,
      aliquotaRitenuta
    );
    setFatturaResult(fattura);

    setCurrentStep('result');
  };

  const handleReset = () => {
    setCurrentStep('input');
    setImportoOpere('');
    setClasseDM143('');
    setPrestazioni([]);
    setLivelloProgettazione([]);
    setComplessita('media');
    setCalculationResult(null);
    setFatturaResult(null);
  };

  const handleSuggestClasse = () => {
    const importo = parseFloat(importoOpere.replace(/[^0-9.-]/g, ''));
    if (importo > 0) {
      const suggestions = suggestClasseDM143(importo);
      if (suggestions.length > 0) {
        setClasseDM143(suggestions[0]);
        toast({
          title: "Classe suggerita",
          description: `${suggestions[0]} - ${CLASSI_DM143[suggestions[0] as keyof typeof CLASSI_DM143]?.descrizione}`,
        });
      }
    }
  };

  const handleExportPDF = () => {
    toast({
      title: "Esportazione PDF",
      description: "Funzionalità in sviluppo - Sarà disponibile a breve",
    });
  };

  const handleCopyToClipboard = () => {
    if (!calculationResult) return;

    const text = `
CALCOLO PARCELLA PROFESSIONALE DM 143/2013

Importo Opere: ${formatEuro(calculationResult.importoBase)}
Classe DM 143: ${classeDM143 || 'Non specificata'}
Complessità: ${complessita.toUpperCase()}

DETTAGLIO COMPENSI:
${calculationResult.dettagli.map(d =>
  `- ${d.prestazione}: ${d.percentuale.toFixed(2)}% = ${formatEuro(d.importo)}`
).join('\n')}

TOTALE COMPENSO: ${formatEuro(calculationResult.compensoTotale)}
Percentuale Totale: ${calculationResult.percentualeApplicata.toFixed(2)}%

${fatturaResult ? `
PROSPETTO FATTURA:
- Compenso netto: ${formatEuro(fatturaResult.compensoNetto)}
- CPA ${aliquotaCPA}%: ${formatEuro(fatturaResult.cpa)}
- Imponibile: ${formatEuro(fatturaResult.imponibile)}
- IVA ${aliquotaIVA}%: ${formatEuro(fatturaResult.iva)}
- Totale con IVA: ${formatEuro(fatturaResult.totaleConIVA)}
- Ritenuta d'acconto ${aliquotaRitenuta}%: ${formatEuro(fatturaResult.ritenutaAcconto)}
- NETTO A PAGARE: ${formatEuro(fatturaResult.nettoAPagare)}
` : ''}
    `.trim();

    navigator.clipboard.writeText(text);
    toast({
      title: "Copiato!",
      description: "Calcolo copiato negli appunti",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-600" />
            Calcolatore Parcella DM 143/2013
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Calcola automaticamente i compensi professionali secondo le tariffe DM 143/2013
          </p>
        </div>
        {currentStep === 'result' && (
          <Button variant="outline" onClick={handleReset}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Nuovo Calcolo
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${currentStep === 'input' ? 'text-blue-600' : 'text-green-600'}`}>
          {currentStep === 'input' ? (
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              1
            </div>
          ) : (
            <CheckCircle2 className="w-8 h-8" />
          )}
          <span className="font-semibold">Dati Input</span>
        </div>
        <ChevronRight className="text-gray-400" />
        <div className={`flex items-center gap-2 ${currentStep === 'result' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full ${currentStep === 'result' ? 'bg-blue-600 text-white' : 'bg-gray-200'} flex items-center justify-center font-bold`}>
            2
          </div>
          <span className="font-semibold">Risultato</span>
        </div>
      </div>

      {/* INPUT STEP */}
      {currentStep === 'input' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Basic Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dati Base Commessa</CardTitle>
              <CardDescription>Inserisci l'importo lavori e la classificazione</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="importo-opere">Importo Opere (€) *</Label>
                <Input
                  id="importo-opere"
                  type="number"
                  value={importoOpere}
                  onChange={(e) => setImportoOpere(e.target.value)}
                  placeholder="es. 500000"
                  className="text-lg font-semibold"
                />
                {importoOpere && parseFloat(importoOpere) > 0 && (
                  <p className="text-sm text-gray-600">
                    {formatEuro(parseFloat(importoOpere))}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="classe-dm">Classe DM 143/2013</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSuggestClasse}
                    disabled={!importoOpere || parseFloat(importoOpere) <= 0}
                  >
                    Suggerisci
                  </Button>
                </div>
                <Select value={classeDM143} onValueChange={setClasseDM143}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona classe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLASSI_DM143).map(([classe, info]) => (
                      <SelectItem key={classe} value={classe}>
                        {classe} - {info.descrizione}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Complessità Opera *</Label>
                <Select value={complessita} onValueChange={(value: any) => setComplessita(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bassa">🟢 Bassa - Opera semplice</SelectItem>
                    <SelectItem value="media">🟡 Media - Complessità standard</SelectItem>
                    <SelectItem value="alta">🔴 Alta - Opera complessa</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  La complessità influenza le percentuali applicate
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Prestazioni */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prestazioni Professionali *</CardTitle>
              <CardDescription>Seleziona i servizi da includere nel calcolo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {Object.entries(PRESTAZIONI_CONFIG).map(([id, config]) => (
                  <div key={id} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={id}
                        checked={prestazioni.includes(id)}
                        onCheckedChange={() => handlePrestazioneToggle(id)}
                      />
                      <label
                        htmlFor={id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </label>
                    </div>

                    {/* Livelli Progettazione (solo se progettazione selezionata) */}
                    {id === 'progettazione' && prestazioni.includes('progettazione') && (
                      <div className="ml-6 pl-4 border-l-2 border-blue-200 space-y-2">
                        <p className="text-xs text-gray-600 font-medium">Livelli di Progettazione:</p>
                        {Object.entries(LIVELLO_PROGETTAZIONE_CONFIG).map(([livelloId, livelloConfig]) => (
                          <div key={livelloId} className="flex items-center space-x-2">
                            <Checkbox
                              id={livelloId}
                              checked={livelloProgettazione.includes(livelloId)}
                              onCheckedChange={() => handleLivelloToggle(livelloId)}
                            />
                            <label
                              htmlFor={livelloId}
                              className="text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {livelloConfig.icon} {livelloConfig.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              <Button
                onClick={handleCalculate}
                className="w-full"
                size="lg"
                disabled={!importoOpere || prestazioni.length === 0}
              >
                <Calculator className="h-5 w-5 mr-2" />
                Calcola Compenso
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RESULT STEP */}
      {currentStep === 'result' && calculationResult && fatturaResult && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="text-sm text-blue-700 font-medium mb-1">Importo Opere</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatEuro(calculationResult.importoBase)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 font-medium mb-1">Percentuale Applicata</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {calculationResult.percentualeApplicata.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 font-medium mb-1">Compenso Totale</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {formatEuro(calculationResult.compensoTotale)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dettaglio Compensi */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Dettaglio Compensi per Prestazione
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copia
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {calculationResult.dettagli.map((dettaglio, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{dettaglio.prestazione}</p>
                      <p className="text-sm text-gray-600">
                        {dettaglio.percentuale.toFixed(2)}% su {formatEuro(calculationResult.importoBase)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-green-700">
                      {formatEuro(dettaglio.importo)}
                    </p>
                  </div>
                  <Progress
                    value={(dettaglio.importo / calculationResult.compensoTotale) * 100}
                    className="h-2"
                  />
                </div>
              ))}

              <Separator />

              <div className="flex items-center justify-between pt-2">
                <p className="text-lg font-bold text-gray-900">TOTALE COMPENSO PROFESSIONALE</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatEuro(calculationResult.compensoTotale)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Prospetto Fattura */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Prospetto Fattura
              </CardTitle>
              <CardDescription>
                Calcolo con CPA, IVA e ritenuta d'acconto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Aliquote personalizzabili */}
              <div className="grid gap-4 md:grid-cols-3 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="cpa" className="text-xs">CPA (%)</Label>
                  <Input
                    id="cpa"
                    type="number"
                    value={aliquotaCPA}
                    onChange={(e) => setAliquotaCPA(parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="iva" className="text-xs">IVA (%)</Label>
                  <Input
                    id="iva"
                    type="number"
                    value={aliquotaIVA}
                    onChange={(e) => setAliquotaIVA(parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ritenuta" className="text-xs">Ritenuta (%)</Label>
                  <Input
                    id="ritenuta"
                    type="number"
                    value={aliquotaRitenuta}
                    onChange={(e) => setAliquotaRitenuta(parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Compenso netto</span>
                  <span className="font-semibold">{formatEuro(fatturaResult.compensoNetto)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">+ CPA {aliquotaCPA}%</span>
                  <span className="text-gray-700">{formatEuro(fatturaResult.cpa)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center font-medium">
                  <span className="text-gray-700">Imponibile</span>
                  <span>{formatEuro(fatturaResult.imponibile)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">+ IVA {aliquotaIVA}%</span>
                  <span className="text-gray-700">{formatEuro(fatturaResult.iva)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center font-semibold text-lg">
                  <span className="text-gray-900">Totale con IVA</span>
                  <span className="text-blue-700">{formatEuro(fatturaResult.totaleConIVA)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">- Ritenuta d'acconto {aliquotaRitenuta}%</span>
                  <span className="text-red-600">-{formatEuro(fatturaResult.ritenutaAcconto)}</span>
                </div>
                <Separator className="border-2" />
                <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg">
                  <span className="text-xl font-bold text-green-900">NETTO A PAGARE</span>
                  <span className="text-2xl font-bold text-green-700">
                    {formatEuro(fatturaResult.nettoAPagare)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note */}
          {calculationResult.note.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {calculationResult.note.map((nota, index) => (
                    <li key={index}>{nota}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Info Box */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Nota Legale</p>
              <p>
                Le percentuali utilizzate sono indicative e basate sul DM 143/2013.
                Per calcoli ufficiali consultare sempre la normativa vigente e verificare
                le tariffe professionali del proprio ordine. Il calcolatore non sostituisce
                la consulenza di un commercialista.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
