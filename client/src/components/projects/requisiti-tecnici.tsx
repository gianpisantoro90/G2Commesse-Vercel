import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Filter, RotateCcw } from "lucide-react";
import { ProjectStatusBadge } from "@/components/ui/status-badge";
import { type Project, type ProjectPrestazioni } from "@shared/schema";
import { getCategoriaById, type CategoriaOpera } from "@/lib/dm2016-tavole-ufficiali";
import { QK } from "@/lib/query-utils";

// Definizione macro-categorie
const MACRO_CATEGORIE = [
  { id: "E", nome: "Edilizia", emoji: "🏗️" },
  { id: "S", nome: "Strutture", emoji: "🏛️" },
  { id: "IA", nome: "Impianti Meccanici", emoji: "⚙️" },
  { id: "IB", nome: "Impianti Elettrici", emoji: "⚡" },
  { id: "V", nome: "Infrastrutture Viarie", emoji: "🛣️" },
  { id: "D", nome: "Opere Idrauliche", emoji: "💧" },
  { id: "T", nome: "Tecnologie ICT", emoji: "💻" },
  { id: "P", nome: "Paesaggio", emoji: "🌳" },
  { id: "U", nome: "Urbanistica", emoji: "🗺️" },
];

// Range di importi predefiniti
const RANGE_IMPORTI = [
  { id: "all", label: "Tutti gli importi", min: 0, max: Infinity },
  { id: "0-100k", label: "€0 - €100.000", min: 0, max: 100000 },
  { id: "100k-500k", label: "€100.000 - €500.000", min: 100000, max: 500000 },
  { id: "500k-1m", label: "€500.000 - €1.000.000", min: 500000, max: 1000000 },
  { id: "1m-5m", label: "€1.000.000 - €5.000.000", min: 1000000, max: 5000000 },
  { id: "5m+", label: "Oltre €5.000.000", min: 5000000, max: Infinity },
];

interface ClassificazioneConCommessa {
  codice: string;
  importo: number;
  importoServizio?: number;
  projectId: string;
  projectCode: string;
  projectClient: string;
  projectStatus: string;
  projectYear: number;
}

interface AggregatedCategory {
  codice: string;
  categoria: CategoriaOpera | undefined;
  commesse: ClassificazioneConCommessa[];
  totaleImportoOpere: number;
  totaleImportoServizi: number;
  numeroCommesse: number;
}

interface AggregatedMacroCategory {
  macroCategoria: typeof MACRO_CATEGORIE[0];
  categorie: AggregatedCategory[];
  totaleImportoOpere: number;
  totaleImportoServizi: number;
  numeroCommesse: number;
  numeroCategorie: number;
}

export default function RequisitiTecnici() {
  // Filtri
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [macroCategoriaFilter, setMacroCategoriaFilter] = useState<string>("all");
  const [rangeImportoFilter, setRangeImportoFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Stato espansione
  const [expandedMacro, setExpandedMacro] = useState<string[]>([]);
  const [expandedCategorie, setExpandedCategorie] = useState<string[]>([]);

  // Fetch progetti
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: QK.projects,
  });

  // Estrai tutte le classificazioni con i dati della commessa
  const tutteClassificazioni = useMemo(() => {
    const classificazioni: ClassificazioneConCommessa[] = [];

    projects.forEach((project) => {
      const metadata = project.metadata as ProjectPrestazioni | null;
      if (metadata?.classificazioniDM2016?.length) {
        metadata.classificazioniDM2016.forEach((classif) => {
          classificazioni.push({
            codice: classif.codice,
            importo: classif.importo || 0,
            importoServizio: classif.importoServizio || 0,
            projectId: project.id,
            projectCode: project.code,
            projectClient: project.client,
            projectStatus: project.status,
            projectYear: project.year,
          });
        });
      }
    });

    return classificazioni;
  }, [projects]);

  // Applica filtri
  const classificazioniFiltrate = useMemo(() => {
    const rangeSelezionato = RANGE_IMPORTI.find(r => r.id === rangeImportoFilter) || RANGE_IMPORTI[0];

    return tutteClassificazioni.filter((c) => {
      // Filtro stato
      if (statusFilter !== "all" && c.projectStatus !== statusFilter) return false;

      // Filtro macro-categoria
      if (macroCategoriaFilter !== "all") {
        const macroDelCodice = c.codice.split(".")[0];
        if (macroDelCodice !== macroCategoriaFilter) return false;
      }

      // Filtro range importo
      if (rangeImportoFilter !== "all") {
        if (c.importo < rangeSelezionato.min || c.importo > rangeSelezionato.max) return false;
      }

      // Filtro ricerca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!c.projectCode.toLowerCase().includes(term) &&
            !c.projectClient.toLowerCase().includes(term) &&
            !c.codice.toLowerCase().includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [tutteClassificazioni, statusFilter, macroCategoriaFilter, rangeImportoFilter, searchTerm]);

  // Aggrega per macro-categoria
  const aggregatoPerMacroCategoria = useMemo(() => {
    const aggregato: AggregatedMacroCategory[] = [];

    MACRO_CATEGORIE.forEach((macro) => {
      const classificazioniMacro = classificazioniFiltrate.filter((c) => {
        const macroDelCodice = c.codice.split(".")[0];
        return macroDelCodice === macro.id;
      });

      if (classificazioniMacro.length === 0) {
        aggregato.push({
          macroCategoria: macro,
          categorie: [],
          totaleImportoOpere: 0,
          totaleImportoServizi: 0,
          numeroCommesse: 0,
          numeroCategorie: 0,
        });
        return;
      }

      // Raggruppa per categoria specifica
      const categorieMap = new Map<string, AggregatedCategory>();

      classificazioniMacro.forEach((c) => {
        if (!categorieMap.has(c.codice)) {
          categorieMap.set(c.codice, {
            codice: c.codice,
            categoria: getCategoriaById(c.codice),
            commesse: [],
            totaleImportoOpere: 0,
            totaleImportoServizi: 0,
            numeroCommesse: 0,
          });
        }
        const cat = categorieMap.get(c.codice)!;
        cat.commesse.push(c);
        cat.totaleImportoOpere += c.importo;
        cat.totaleImportoServizi += c.importoServizio || 0;
        cat.numeroCommesse += 1;
      });

      const categorie = Array.from(categorieMap.values()).sort((a, b) =>
        b.totaleImportoOpere - a.totaleImportoOpere
      );

      // Conta commesse uniche per macro-categoria
      const commesseUniche = new Set(classificazioniMacro.map(c => c.projectId));

      aggregato.push({
        macroCategoria: macro,
        categorie,
        totaleImportoOpere: categorie.reduce((sum, c) => sum + c.totaleImportoOpere, 0),
        totaleImportoServizi: categorie.reduce((sum, c) => sum + c.totaleImportoServizi, 0),
        numeroCommesse: commesseUniche.size,
        numeroCategorie: categorie.length,
      });
    });

    return aggregato.sort((a, b) => b.totaleImportoOpere - a.totaleImportoOpere);
  }, [classificazioniFiltrate]);

  // Totali globali
  const totaliGlobali = useMemo(() => {
    const commesseUniche = new Set(classificazioniFiltrate.map(c => c.projectId));
    return {
      totaleImportoOpere: classificazioniFiltrate.reduce((sum, c) => sum + c.importo, 0),
      totaleImportoServizi: classificazioniFiltrate.reduce((sum, c) => sum + (c.importoServizio || 0), 0),
      numeroCommesse: commesseUniche.size,
      numeroClassificazioni: classificazioniFiltrate.length,
    };
  }, [classificazioniFiltrate]);

  // Handlers
  const toggleMacro = (id: string) => {
    setExpandedMacro((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCategoria = (codice: string) => {
    setExpandedCategorie((prev) =>
      prev.includes(codice) ? prev.filter((x) => x !== codice) : [...prev, codice]
    );
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setMacroCategoriaFilter("all");
    setRangeImportoFilter("all");
    setSearchTerm("");
  };

  const hasActiveFilters = statusFilter !== "all" || macroCategoriaFilter !== "all" ||
                           rangeImportoFilter !== "all" || searchTerm !== "";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Requisiti Tecnici
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Riepilogo delle categorie opere e importi accumulati (DM 17/06/2016)
          </p>
        </div>
      </div>

      {/* Filtri */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ricerca */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Ricerca
              </label>
              <Input
                placeholder="Codice, cliente, categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Stato commessa */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Stato Commessa
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="in corso">In Corso</SelectItem>
                  <SelectItem value="sospesa">Sospesa</SelectItem>
                  <SelectItem value="conclusa">Conclusa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Macro-categoria */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Macro-Categoria
              </label>
              <Select value={macroCategoriaFilter} onValueChange={setMacroCategoriaFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  {MACRO_CATEGORIE.map((macro) => (
                    <SelectItem key={macro.id} value={macro.id}>
                      {macro.emoji} {macro.id} - {macro.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Range importo */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Range Importo Opere
              </label>
              <Select value={rangeImportoFilter} onValueChange={setRangeImportoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_IMPORTI.map((range) => (
                    <SelectItem key={range.id} value={range.id}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Pulisci filtri
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riepilogo Totale */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {totaliGlobali.numeroCommesse}
            </div>
            <p className="text-sm text-muted-foreground">Commesse</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totaliGlobali.totaleImportoOpere)}
            </div>
            <p className="text-sm text-muted-foreground">Importo Opere</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totaliGlobali.totaleImportoServizi)}
            </div>
            <p className="text-sm text-muted-foreground">Importo Servizi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">
              {totaliGlobali.numeroClassificazioni}
            </div>
            <p className="text-sm text-muted-foreground">Classificazioni</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabella Macro-Categorie */}
      <Card>
        <CardHeader>
          <CardTitle>Riepilogo per Categoria</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {aggregatoPerMacroCategoria.map((macro) => (
              <div key={macro.macroCategoria.id}>
                {/* Riga Macro-Categoria */}
                <div
                  onClick={() => toggleMacro(macro.macroCategoria.id)}
                  className={`flex items-center justify-between p-4 hover:bg-muted cursor-pointer transition-colors ${
                    macro.numeroCommesse === 0 ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {expandedMacro.includes(macro.macroCategoria.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-2xl">{macro.macroCategoria.emoji}</span>
                    <div>
                      <div className="font-semibold text-foreground">
                        {macro.macroCategoria.id} - {macro.macroCategoria.nome}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {macro.numeroCommesse} commesse · {macro.numeroCategorie} categorie
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">
                      {formatCurrency(macro.totaleImportoOpere)}
                    </div>
                    <div className="text-sm text-blue-600">
                      Servizi: {formatCurrency(macro.totaleImportoServizi)}
                    </div>
                  </div>
                </div>

                {/* Dettaglio Categorie */}
                {expandedMacro.includes(macro.macroCategoria.id) && (
                  <div className="bg-muted/50 border-t border-border">
                    {macro.categorie.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Nessuna commessa in questa categoria
                      </div>
                    ) : (
                      macro.categorie.map((cat) => (
                        <div key={cat.codice}>
                          {/* Riga Categoria Specifica */}
                          <div
                            onClick={() => toggleCategoria(cat.codice)}
                            className="flex items-center justify-between p-3 pl-12 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              {expandedCategorie.includes(cat.codice) ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <div>
                                <div className="font-medium text-foreground">
                                  {cat.codice}
                                  {cat.categoria && (
                                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                                      {cat.categoria.descrizione}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {cat.numeroCommesse} commesse
                                  {cat.categoria && ` · G = ${cat.categoria.G}`}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-green-600 text-sm">
                                {formatCurrency(cat.totaleImportoOpere)}
                              </div>
                              <div className="text-xs text-blue-600">
                                {formatCurrency(cat.totaleImportoServizi)}
                              </div>
                            </div>
                          </div>

                          {/* Dettaglio Commesse */}
                          {expandedCategorie.includes(cat.codice) && (
                            <div className="bg-background border-t border-border">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border bg-muted">
                                    <th className="text-left p-2 pl-16 font-medium text-muted-foreground">
                                      Commessa
                                    </th>
                                    <th className="text-left p-2 font-medium text-muted-foreground">
                                      Cliente
                                    </th>
                                    <th className="text-center p-2 font-medium text-muted-foreground">
                                      Anno
                                    </th>
                                    <th className="text-center p-2 font-medium text-muted-foreground">
                                      Stato
                                    </th>
                                    <th className="text-right p-2 font-medium text-muted-foreground">
                                      Importo Opere
                                    </th>
                                    <th className="text-right p-2 pr-4 font-medium text-muted-foreground">
                                      Importo Servizi
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cat.commesse.map((c, idx) => (
                                    <tr
                                      key={`${c.projectId}-${idx}`}
                                      className="border-b border-border hover:bg-muted/50"
                                    >
                                      <td className="p-2 pl-16 font-mono text-primary">
                                        {c.projectCode}
                                      </td>
                                      <td className="p-2 text-foreground">
                                        {c.projectClient}
                                      </td>
                                      <td className="p-2 text-center text-muted-foreground">
                                        {c.projectYear}
                                      </td>
                                      <td className="p-2 text-center">
                                        <ProjectStatusBadge status={c.projectStatus as "in corso" | "conclusa" | "sospesa"} />
                                      </td>
                                      <td className="p-2 text-right font-medium text-green-600">
                                        {formatCurrency(c.importo)}
                                      </td>
                                      <td className="p-2 pr-4 text-right text-blue-600">
                                        {formatCurrency(c.importoServizio || 0)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Nota informativa */}
      <div className="text-sm text-muted-foreground text-center">
        I dati sono aggregati dalle classificazioni DM 17/06/2016 inserite nelle singole commesse.
        <br />
        Per modificare le classificazioni, accedi alla scheda della commessa e modifica le prestazioni/DM2016.
      </div>
    </div>
  );
}
