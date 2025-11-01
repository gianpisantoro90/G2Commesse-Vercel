import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calculator, FileText, Copy, Check } from "lucide-react";
import {
  CATEGORIE_DM143,
  calcolaParcelDM2016,
  calcolaFattura,
  formatEuro,
  PARAMETRI_PRESTAZIONI_Q,
  type ParcellaInputDM2016,
  type ParcellaResultDM2016,
  type FatturaCalculation
} from "@/lib/parcella-calculator-dm2016";

type WizardStep = 'categoria' | 'prestazioni' | 'calcolo' | 'risultato';

export default function ParcellaCalculator() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('categoria');
  const [copied, setCopied] = useState(false);

  // Dati input
  const [importoOpere, setImportoOpere] = useState<number>(0);
  const [categoria, setCategoria] = useState<string>('E');
  const [articolazione, setArticolazione] = useState<string>('01');
  const [complessita, setComplessita] = useState<'bassa' | 'media' | 'alta'>('media');

  // Prestazioni selezionate (usando codici Q)
  const [prestazioni, setPrestazioni] = useState<{ [key: string]: boolean }>({});

  // Opzioni aggiuntive
  const [bimObbligatorio, setBimObbligatorio] = useState(false);
  const [incrementoBIM, setIncrementoBIM] = useState(25);
  const [speseAccessorie, setSpeseAccessorie] = useState(true);

  // Risultati
  const [risultatoParcella, setRisultatoParcella] = useState<ParcellaResultDM2016 | null>(null);
  const [risultatoFattura, setRisultatoFattura] = useState<FatturaCalculation | null>(null);

  // Parametri fattura
  const [aliquotaCPA, setAliquotaCPA] = useState(4);
  const [aliquotaIVA, setAliquotaIVA] = useState(22);
  const [aliquotaRitenuta, setAliquotaRitenuta] = useState(20);

  const handlePrestazioneToggle = (key: string) => {
    setPrestazioni(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }));
  };

  const handleCalcola = () => {
    const input: ParcellaInputDM2016 = {
      importoOpere,
      categoria,
      articolazione,
      gradoComplessita: complessita,
      prestazioni,
      opzioni: {
        bimObbligatorio,
        incrementoBIM,
        speseAccessorie
      }
    };

    const risultato = calcolaParcelDM2016(input);
    setRisultatoParcella(risultato);

    const fattura = calcolaFattura(
      risultato.compensoTotale,
      aliquotaCPA,
      aliquotaIVA,
      aliquotaRitenuta
    );
    setRisultatoFattura(fattura);

    setCurrentStep('risultato');
  };

  const handleReset = () => {
    setCurrentStep('categoria');
    setImportoOpere(0);
    setCategoria('E');
    setArticolazione('01');
    setComplessita('media');
    setPrestazioni({});
    setBimObbligatorio(false);
    setIncrementoBIM(25);
    setSpeseAccessorie(true);
    setRisultatoParcella(null);
    setRisultatoFattura(null);
  };

  const handleCopyRiepilogo = () => {
    if (!risultatoParcella || !risultatoFattura) return;

    const testo = `
CALCOLO PARCELLA PROFESSIONALE - DM 143/2013

${risultatoParcella.note.join('\n')}

PRESTAZIONI RICHIESTE:
${Object.values(risultatoParcella.compensi).map(c =>
  `- ${c.prestazione}: ${c.percentuale.toFixed(2)}% = ${formatEuro(c.importo)}`
).join('\n')}

COMPENSO TOTALE: ${formatEuro(risultatoParcella.compensoTotale)}

FATTURA:
Compenso netto: ${formatEuro(risultatoFattura.compensoNetto)}
CPA (${aliquotaCPA}%): ${formatEuro(risultatoFattura.cpa)}
Imponibile: ${formatEuro(risultatoFattura.imponibile)}
IVA (${aliquotaIVA}%): ${formatEuro(risultatoFattura.iva)}
Totale con IVA: ${formatEuro(risultatoFattura.totaleConIVA)}
Ritenuta d'acconto (${aliquotaRitenuta}%): ${formatEuro(risultatoFattura.ritenutaAcconto)}
NETTO A PAGARE: ${formatEuro(risultatoFattura.nettoAPagare)}
    `.trim();

    navigator.clipboard.writeText(testo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoriaSelezionata = CATEGORIE_DM143[categoria as keyof typeof CATEGORIE_DM143];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            Calcolatore Parcella Professionale
          </h2>
          <p className="text-gray-600 mt-1 font-mono text-sm">
            CP = ∑(V × G × Q × P) | DM 17/06/2016 + D.Lgs. 36/2023
          </p>
        </div>
        {currentStep === 'risultato' && (
          <Button onClick={handleReset} variant="outline">
            Nuovo Calcolo
          </Button>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2">
        {['categoria', 'prestazioni', 'calcolo', 'risultato'].map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <div className={`flex-1 h-2 rounded-full ${
              currentStep === step ? 'bg-secondary' :
              index < ['categoria', 'prestazioni', 'calcolo', 'risultato'].indexOf(currentStep) ? 'bg-secondary/50' : 'bg-gray-200'
            }`} />
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Step 1: Categoria e Importo */}
          {currentStep === 'categoria' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">1. Seleziona Categoria e Importo Opere</h3>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <Label htmlFor="importoOpere">Importo Opere (€) *</Label>
                    <Input
                      id="importoOpere"
                      type="number"
                      value={importoOpere || ''}
                      onChange={(e) => setImportoOpere(parseFloat(e.target.value) || 0)}
                      placeholder="es. 500000"
                      className="text-lg font-semibold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="categoria">Categoria Opera *</Label>
                    <Select value={categoria} onValueChange={(v) => {
                      setCategoria(v);
                      setArticolazione('01');
                    }}>
                      <SelectTrigger id="categoria">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIE_DM143).map(([key, cat]) => (
                          <SelectItem key={key} value={key}>
                            {key} - {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoriaSelezionata && (
                      <p className="text-xs text-gray-600 mt-1">{categoriaSelezionata.descrizione}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="articolazione">Articolazione / Fascia di Importo *</Label>
                  <Select value={articolazione} onValueChange={setArticolazione}>
                    <SelectTrigger id="articolazione">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriaSelezionata && Object.entries(categoriaSelezionata.articolazioni).map(([key, desc]) => (
                        <SelectItem key={key} value={key}>
                          {categoria}.{key} - {desc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-4">
                  <Label htmlFor="complessita">Grado di Complessità (parametro G) *</Label>
                  <Select value={complessita} onValueChange={(v: any) => setComplessita(v)}>
                    <SelectTrigger id="complessita">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bassa">🟢 Bassa - Opera semplice (G≈0.90)</SelectItem>
                      <SelectItem value="media">🟡 Media - Complessità standard (G≈1.00)</SelectItem>
                      <SelectItem value="alta">🔴 Alta - Opera complessa (G≈1.15)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Il parametro G moltiplica il compenso base secondo Tavola Z-1
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setCurrentStep('prestazioni')}
                  disabled={importoOpere <= 0}
                >
                  Avanti: Seleziona Prestazioni
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Prestazioni */}
          {currentStep === 'prestazioni' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">2. Seleziona Prestazioni</h3>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('categoria')}>
                  Indietro
                </Button>
              </div>

              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {/* Raggruppa prestazioni per tipo */}
                  {[
                    { gruppo: 'progettazione', titolo: '📐 PROGETTAZIONE', icona: '📐' },
                    { gruppo: 'direzione', titolo: '👷 DIREZIONE E COORDINAMENTO', icona: '👷' },
                    { gruppo: 'sicurezza', titolo: '🛡️ SICUREZZA', icona: '🛡️' },
                    { gruppo: 'collaudo', titolo: '✅ COLLAUDI E VERIFICHE', icona: '✅' },
                    { gruppo: 'altro', titolo: '📋 ALTRE PRESTAZIONI', icona: '📋' }
                  ].map(({ gruppo, titolo }) => {
                    const prestazioniGruppo = Object.entries(PARAMETRI_PRESTAZIONI_Q).filter(
                      ([_, p]) => p.gruppo === gruppo
                    );

                    if (prestazioniGruppo.length === 0) return null;

                    return (
                      <div key={gruppo}>
                        <h4 className="font-semibold text-sm text-gray-700 mb-3">{titolo}</h4>
                        <div className="space-y-2">
                          {prestazioniGruppo.map(([codice, prestazione]) => (
                            <label key={codice} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={prestazioni[codice] || false}
                                onChange={() => handlePrestazioneToggle(codice)}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium">{prestazione.descrizione}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {codice}
                                  </Badge>
                                  <span className="text-xs text-gray-600">
                                    Q = {prestazione.Q.toFixed(3)}
                                  </span>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('categoria')}>
                  Indietro
                </Button>
                <Button
                  onClick={() => setCurrentStep('calcolo')}
                  disabled={Object.values(prestazioni).filter(Boolean).length === 0}
                >
                  Avanti: Parametri Fattura
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Parametri Fattura e Opzioni */}
          {currentStep === 'calcolo' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">3. Opzioni di Calcolo e Fatturazione</h3>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('prestazioni')}>
                  Indietro
                </Button>
              </div>

              {/* Opzioni Calcolo */}
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <h4 className="font-semibold text-sm">Opzioni Calcolo Compenso</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="spese-accessorie" className="text-sm font-medium">
                      Includi Spese Accessorie
                    </Label>
                    <p className="text-xs text-gray-600">
                      10-25% del compenso base (secondo DM 17/06/2016)
                    </p>
                  </div>
                  <input
                    id="spese-accessorie"
                    type="checkbox"
                    checked={speseAccessorie}
                    onChange={(e) => setSpeseAccessorie(e.target.checked)}
                    className="w-5 h-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="bim-toggle" className="text-sm font-medium">
                      Metodologia BIM Obbligatoria
                    </Label>
                    <p className="text-xs text-gray-600">
                      Incremento compenso (D.Lgs. 36/2023 - Nuovo Codice Appalti)
                    </p>
                  </div>
                  <input
                    id="bim-toggle"
                    type="checkbox"
                    checked={bimObbligatorio}
                    onChange={(e) => setBimObbligatorio(e.target.checked)}
                    className="w-5 h-5"
                  />
                </div>

                {bimObbligatorio && (
                  <div>
                    <Label htmlFor="incremento-bim">Incremento BIM (%)</Label>
                    <Input
                      id="incremento-bim"
                      type="number"
                      value={incrementoBIM}
                      onChange={(e) => setIncrementoBIM(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="5"
                      className="max-w-xs"
                    />
                    <p className="text-xs text-gray-500 mt-1">Incremento indicativo: 20-30%</p>
                  </div>
                )}
              </div>

              {/* Parametri Fattura */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Parametri Fatturazione</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="cpa">Aliquota CPA (%)</Label>
                    <Input
                      id="cpa"
                      type="number"
                      value={aliquotaCPA}
                      onChange={(e) => setAliquotaCPA(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Cassa Previdenziale (di solito 4%)</p>
                  </div>

                  <div>
                    <Label htmlFor="iva">Aliquota IVA (%)</Label>
                    <Input
                      id="iva"
                      type="number"
                      value={aliquotaIVA}
                      onChange={(e) => setAliquotaIVA(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Di solito 22%</p>
                  </div>

                  <div>
                    <Label htmlFor="ritenuta">Ritenuta d'Acconto (%)</Label>
                    <Input
                      id="ritenuta"
                      type="number"
                      value={aliquotaRitenuta}
                      onChange={(e) => setAliquotaRitenuta(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Di solito 20%</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('prestazioni')}>
                  Indietro
                </Button>
                <Button onClick={handleCalcola} className="bg-secondary hover:bg-secondary/90">
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcola Parcella
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Risultato */}
          {currentStep === 'risultato' && risultatoParcella && risultatoFattura && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Risultato Calcolo</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRiepilogo}
                  className="gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiato!' : 'Copia Riepilogo'}
                </Button>
              </div>

              {/* Formula e Parametri */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-blue-700 mb-2">Formula Parametrica</p>
                      <p className="text-2xl font-bold font-mono text-blue-900">
                        CP = ∑(V × G × Q × P)
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-blue-700">V - Importo Opere</p>
                        <p className="font-bold text-blue-900">{formatEuro(risultatoParcella.importoBase)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">G - Complessità</p>
                        <p className="font-bold text-blue-900">{risultatoParcella.parametroG.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">P - Parametro Base</p>
                        <p className="font-bold text-blue-900">{risultatoParcella.parametroP.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700">Prestazioni</p>
                        <p className="font-bold text-blue-900">{risultatoParcella.prestazioni.length}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dettagli Calcolo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dettagli Calcolo</CardTitle>
                  <CardDescription>Passaggi della formula parametrica</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
                      {risultatoParcella.dettagliCalcolo.passaggi.join('\n')}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Prestazioni Calcolate */}
              <Card>
                <CardHeader>
                  <CardTitle>Compensi per Prestazione</CardTitle>
                  <CardDescription>{risultatoParcella.prestazioni.length} prestazioni selezionate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {risultatoParcella.prestazioni.map((prest, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="font-medium">{prest.descrizione}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {prest.codice}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            Q = {prest.Q.toFixed(3)}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({prest.percentualeEffettiva.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                      <div className="font-bold text-lg text-green-700">
                        {formatEuro(prest.compenso)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Riepilogo Totali */}
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-green-900">Compenso Base</span>
                    <span className="text-xl font-bold text-green-900">{formatEuro(risultatoParcella.compensoBase)}</span>
                  </div>

                  {risultatoParcella.incrementoBIM && (
                    <div className="flex justify-between items-center text-blue-700">
                      <span className="text-sm">+ Incremento BIM ({incrementoBIM}%)</span>
                      <span className="font-semibold">{formatEuro(risultatoParcella.incrementoBIM)}</span>
                    </div>
                  )}

                  {risultatoParcella.speseAccessorie && (
                    <div className="flex justify-between items-center text-blue-700">
                      <span className="text-sm">
                        + Spese Accessorie ({((risultatoParcella.speseAccessorie / risultatoParcella.compensoBase) * 100).toFixed(1)}%)
                      </span>
                      <span className="font-semibold">{formatEuro(risultatoParcella.speseAccessorie)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xl font-bold text-green-900">COMPENSO TOTALE</span>
                    <span className="text-3xl font-bold text-green-900">{formatEuro(risultatoParcella.compensoTotale)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Note */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="space-y-1 text-sm">
                    {risultatoParcella.note.map((nota, i) => (
                      <p key={i} className="text-amber-900">{nota}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Calcolo Fattura */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Calcolo Fattura
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Compenso netto:</span>
                    <span className="font-semibold">{formatEuro(risultatoFattura.compensoNetto)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>CPA ({aliquotaCPA}%):</span>
                    <span className="font-semibold">{formatEuro(risultatoFattura.cpa)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Imponibile:</span>
                    <span>{formatEuro(risultatoFattura.imponibile)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>IVA ({aliquotaIVA}%):</span>
                    <span className="font-semibold">{formatEuro(risultatoFattura.iva)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Totale con IVA:</span>
                    <span>{formatEuro(risultatoFattura.totaleConIVA)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Ritenuta d'acconto ({aliquotaRitenuta}%):</span>
                    <span className="font-semibold">-{formatEuro(risultatoFattura.ritenutaAcconto)}</span>
                  </div>
                  <Separator className="border-2" />
                  <div className="flex justify-between text-xl font-bold text-green-600">
                    <span>NETTO A PAGARE:</span>
                    <span>{formatEuro(risultatoFattura.nettoAPagare)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleReset}>
                  Nuovo Calcolo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
