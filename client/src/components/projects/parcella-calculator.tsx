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
  suggestClasseDM2016,
  CATEGORIE_DM2016,
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
  const [classeDM2016, setClasseDM2016] = useState<string>('');
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
      classeDM2016: classeDM2016 || undefined,
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
    setClasseDM2016('');
    setPrestazioni([]);
    setLivelloProgettazione([]);
    setComplessita('media');
    setCalculationResult(null);
    setFatturaResult(null);
  };

  const handleSuggestClasse = () => {
    const importo = parseFloat(importoOpere.replace(/[^0-9.-]/g, ''));
    if (importo > 0) {
      const suggestions = suggestClasseDM2016(importo);
      if (suggestions.length > 0) {
        setClasseDM2016(suggestions[0]);
        toast({
          title: "Classe suggerita",
          description: `${suggestions[0]} - ${CATEGORIE_DM2016[suggestions[0] as keyof typeof CATEGORIE_DM2016]?.descrizione}`,
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
CALCOLO PARCELLA PROFESSIONALE DM 17/06/2016

Importo Opere: ${formatEuro(calculationResult.importoBase)}
Classe DM 17/06/2016: ${classeDM2016 || 'Non specificata'}
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
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Calcolatore Parcella DM 17/06/2016
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Calcola automaticamente i compensi professionali secondo le tariffe DM 17/06/2016
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
        <div className={`flex items-center gap-2 ${currentStep === 'input' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
          {currentStep === 'input' ? (
            <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold">
              1
            </div>
          ) : (
            <CheckCircle2 className="w-8 h-8" />
          )}
          <span className="font-semibold">Dati Input</span>
        </div>
        <ChevronRight className="text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === 'result' ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full ${currentStep === 'result' ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-muted text-muted-foreground'} flex items-center justify-center font-bold`}>
            2
          </div>
          <span className="font-semibold">Risultato</span>
        </div>
      </div>

      {/* INPUT STEP */}
      {currentStep === 'input' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Basic Data */}
          <div className="card-g2">
            <h3 className="text-lg font-semibold text-foreground mb-1">Dati Base Commessa</h3>
            <p className="text-sm text-muted-foreground mb-4">Inserisci l'importo lavori e la classificazione</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="importo-opere" className="text-foreground">Importo Opere (€) *</Label>
                <Input
                  id="importo-opere"
                  type="number"
                  value={importoOpere}
                  onChange={(e) => setImportoOpere(e.target.value)}
                  placeholder="es. 500000"
                  className="text-lg font-semibold dark:bg-background dark:border-border"
                />
                {importoOpere && parseFloat(importoOpere) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {formatEuro(parseFloat(importoOpere))}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="classe-dm" className="text-foreground">Classe DM 17/06/2016</Label>
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
                <Select value={classeDM2016} onValueChange={setClasseDM2016}>
                  <SelectTrigger className="dark:bg-background dark:border-border">
                    <SelectValue placeholder="Seleziona classe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIE_DM2016).map(([classe, info]) => (
                      <SelectItem key={classe} value={classe}>
                        {classe} - {info.descrizione}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Complessità Opera *</Label>
                <Select value={complessita} onValueChange={(value: any) => setComplessita(value)}>
                  <SelectTrigger className="dark:bg-background dark:border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bassa">🟢 Bassa - Opera semplice</SelectItem>
                    <SelectItem value="media">🟡 Media - Complessità standard</SelectItem>
                    <SelectItem value="alta">🔴 Alta - Opera complessa</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  La complessità influenza le percentuali applicate
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Prestazioni */}
          <div className="card-g2">
            <h3 className="text-lg font-semibold text-foreground mb-1">Prestazioni Professionali *</h3>
            <p className="text-sm text-muted-foreground mb-4">Seleziona i servizi da includere nel calcolo</p>
            <div className="space-y-4">
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
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 text-foreground"
                      >
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </label>
                    </div>

                    {/* Livelli Progettazione (solo se progettazione selezionata) */}
                    {id === 'progettazione' && prestazioni.includes('progettazione') && (
                      <div className="ml-6 pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">Livelli di Progettazione:</p>
                        {Object.entries(LIVELLO_PROGETTAZIONE_CONFIG).map(([livelloId, livelloConfig]) => (
                          <div key={livelloId} className="flex items-center space-x-2">
                            <Checkbox
                              id={livelloId}
                              checked={livelloProgettazione.includes(livelloId)}
                              onCheckedChange={() => handleLivelloToggle(livelloId)}
                            />
                            <label
                              htmlFor={livelloId}
                              className="text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
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

              <Separator className="dark:bg-border" />

              <Button
                onClick={handleCalculate}
                className="w-full"
                size="lg"
                disabled={!importoOpere || prestazioni.length === 0}
              >
                <Calculator className="h-5 w-5 mr-2" />
                Calcola Compenso
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT STEP */}
      {currentStep === 'result' && calculationResult && fatturaResult && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="card-g2 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">Importo Opere</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatEuro(calculationResult.importoBase)}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">Percentuale Applicata</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {calculationResult.percentualeApplicata.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">Compenso Totale</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {formatEuro(calculationResult.compensoTotale)}
                </p>
              </div>
            </div>
          </div>

          {/* Dettaglio Compensi */}
          <div className="card-g2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Dettaglio Compensi per Prestazione
              </h3>
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
            <div className="space-y-4">
              {calculationResult.dettagli.map((dettaglio, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{dettaglio.prestazione}</p>
                      <p className="text-sm text-muted-foreground">
                        {dettaglio.percentuale.toFixed(2)}% su {formatEuro(calculationResult.importoBase)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      {formatEuro(dettaglio.importo)}
                    </p>
                  </div>
                  <Progress
                    value={(dettaglio.importo / calculationResult.compensoTotale) * 100}
                    className="h-2"
                  />
                </div>
              ))}

              <Separator className="dark:bg-border" />

              <div className="flex items-center justify-between pt-2">
                <p className="text-lg font-bold text-foreground">TOTALE COMPENSO PROFESSIONALE</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatEuro(calculationResult.compensoTotale)}
                </p>
              </div>
            </div>
          </div>

          {/* Prospetto Fattura */}
          <div className="card-g2">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                Prospetto Fattura
              </h3>
              <p className="text-sm text-muted-foreground">
                Calcolo con CPA, IVA e ritenuta d'acconto
              </p>
            </div>
            <div className="space-y-4">
              {/* Aliquote personalizzabili */}
              <div className="grid gap-4 md:grid-cols-3 p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="cpa" className="text-xs text-foreground">CPA (%)</Label>
                  <Input
                    id="cpa"
                    type="number"
                    value={aliquotaCPA}
                    onChange={(e) => setAliquotaCPA(parseFloat(e.target.value) || 0)}
                    className="h-8 dark:bg-muted dark:border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="iva" className="text-xs text-foreground">IVA (%)</Label>
                  <Input
                    id="iva"
                    type="number"
                    value={aliquotaIVA}
                    onChange={(e) => setAliquotaIVA(parseFloat(e.target.value) || 0)}
                    className="h-8 dark:bg-muted dark:border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ritenuta" className="text-xs text-foreground">Ritenuta (%)</Label>
                  <Input
                    id="ritenuta"
                    type="number"
                    value={aliquotaRitenuta}
                    onChange={(e) => setAliquotaRitenuta(parseFloat(e.target.value) || 0)}
                    className="h-8 dark:bg-muted dark:border-border"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Compenso netto</span>
                  <span className="font-semibold text-foreground">{formatEuro(fatturaResult.compensoNetto)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">+ CPA {aliquotaCPA}%</span>
                  <span className="text-foreground">{formatEuro(fatturaResult.cpa)}</span>
                </div>
                <Separator className="dark:bg-border" />
                <div className="flex justify-between items-center font-medium">
                  <span className="text-foreground">Imponibile</span>
                  <span className="text-foreground">{formatEuro(fatturaResult.imponibile)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">+ IVA {aliquotaIVA}%</span>
                  <span className="text-foreground">{formatEuro(fatturaResult.iva)}</span>
                </div>
                <Separator className="dark:bg-border" />
                <div className="flex justify-between items-center font-semibold text-lg">
                  <span className="text-foreground">Totale con IVA</span>
                  <span className="text-blue-700 dark:text-blue-400">{formatEuro(fatturaResult.totaleConIVA)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">- Ritenuta d'acconto {aliquotaRitenuta}%</span>
                  <span className="text-red-600 dark:text-red-400">-{formatEuro(fatturaResult.ritenutaAcconto)}</span>
                </div>
                <Separator className="border-2 dark:bg-muted" />
                <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
                  <span className="text-xl font-bold text-green-900 dark:text-green-100">NETTO A PAGARE</span>
                  <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {formatEuro(fatturaResult.nettoAPagare)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          {calculationResult.note.length > 0 && (
            <Alert className="dark:bg-background dark:border-border">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-foreground">
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
      <div className="card-g2 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-1">Nota Legale</p>
            <p>
              Le percentuali utilizzate sono indicative e basate sul DM 17/06/2016.
              Per calcoli ufficiali consultare sempre la normativa vigente e verificare
              le tariffe professionali del proprio ordine. Il calcolatore non sostituisce
              la consulenza di un commercialista.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
