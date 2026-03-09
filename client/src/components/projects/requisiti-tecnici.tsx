import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Filter,
  Download,
  FileText,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { getCategoriaById } from "@/lib/dm2016-tavole-ufficiali";
import { getQueryFn } from "@/lib/queryClient";
import * as XLSX from "xlsx";

// ---------- Types ----------
interface RequisitoTecnicoRow {
  projectCode: string;
  projectYear: string;
  projectStatus: string;
  clientName: string;
  codiceDM: string;
  importoOpere: number;
  importoServizio: number;
  prestazioneTipo: string;
  prestazioneLivello: string | null;
  prestazioneDataInizio: string | null;
  prestazioneDataCompletamento: string | null;
}

// ---------- Constants ----------
const MACRO_CATEGORIE = [
  { id: "E", nome: "Edilizia" },
  { id: "S", nome: "Strutture" },
  { id: "IA", nome: "Impianti Meccanici" },
  { id: "IB", nome: "Impianti Elettrici" },
  { id: "V", nome: "Infrastrutture Viarie" },
  { id: "D", nome: "Opere Idrauliche" },
  { id: "T", nome: "Tecnologie ICT" },
  { id: "P", nome: "Paesaggio" },
  { id: "U", nome: "Urbanistica" },
];

const TIPO_PRESTAZIONE_OPTIONS: { value: string; label: string }[] = [
  { value: "progettazione", label: "Progettazione" },
  { value: "dl", label: "Direzione Lavori" },
  { value: "csp", label: "CSP" },
  { value: "cse", label: "CSE" },
  { value: "contabilita", label: "Contabilit\u00e0" },
  { value: "collaudo", label: "Collaudo" },
  { value: "perizia", label: "Perizia" },
  { value: "pratiche", label: "Pratiche" },
];

type SortField =
  | "projectCode"
  | "clientName"
  | "projectYear"
  | "codiceDM"
  | "descrizione"
  | "importoOpere"
  | "importoServizio"
  | "prestazioneTipo"
  | "prestazioneLivello"
  | "prestazioneDataInizio"
  | "prestazioneDataCompletamento";

// ---------- Helpers ----------
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT");
};

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const getMacroFromCode = (codiceDM: string): string => {
  // Macro prefixes can be 1 or 2 chars: E, S, IA, IB, V, D, T, P, U
  if (codiceDM.startsWith("IA")) return "IA";
  if (codiceDM.startsWith("IB")) return "IB";
  return codiceDM.split(".")[0];
};

const getDescription = (codiceDM: string): string =>
  getCategoriaById(codiceDM)?.destinazioneFunzionale || codiceDM;

// ---------- Component ----------
export default function RequisitiTecnici() {
  // Data fetch
  const { data: rows = [], isLoading, refetch, isFetching } = useQuery<RequisitoTecnicoRow[]>({
    queryKey: ["/api/requisiti-tecnici/full"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Filter states
  const [search, setSearch] = useState("");
  const [macroCategoria, setMacroCategoria] = useState("all");
  const [categoriaSpecifica, setCategoriaSpecifica] = useState("all");
  const [annoMin, setAnnoMin] = useState("");
  const [annoMax, setAnnoMax] = useState("");
  const [importoOpereMin, setImportoOpereMin] = useState("");
  const [importoOpereMax, setImportoOpereMax] = useState("");
  const [importoServiziMin, setImportoServiziMin] = useState("");
  const [importoServiziMax, setImportoServiziMax] = useState("");
  const [tipoPrestazione, setTipoPrestazione] = useState<string[]>([]);
  const [livelloProgettazione, setLivelloProgettazione] = useState("all");
  const [statoCommessa, setStatoCommessa] = useState("all");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("projectCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Distinct specific categories for currently selected macro
  const categorieSpecificheDisponibili = useMemo(() => {
    if (macroCategoria === "all") return [];
    const codes = new Set<string>();
    rows.forEach((r) => {
      if (getMacroFromCode(r.codiceDM) === macroCategoria) {
        codes.add(r.codiceDM);
      }
    });
    return Array.from(codes).sort();
  }, [rows, macroCategoria]);

  // Reset categoriaSpecifica when macro changes
  const handleMacroCategoriaChange = useCallback(
    (val: string) => {
      setMacroCategoria(val);
      setCategoriaSpecifica("all");
    },
    [],
  );

  // Has active filters
  const hasActiveFilters =
    search !== "" ||
    macroCategoria !== "all" ||
    categoriaSpecifica !== "all" ||
    annoMin !== "" ||
    annoMax !== "" ||
    importoOpereMin !== "" ||
    importoOpereMax !== "" ||
    importoServiziMin !== "" ||
    importoServiziMax !== "" ||
    tipoPrestazione.length > 0 ||
    livelloProgettazione !== "all" ||
    statoCommessa !== "all" ||
    dataInizio !== "" ||
    dataFine !== "";

  const resetFilters = useCallback(() => {
    setSearch("");
    setMacroCategoria("all");
    setCategoriaSpecifica("all");
    setAnnoMin("");
    setAnnoMax("");
    setImportoOpereMin("");
    setImportoOpereMax("");
    setImportoServiziMin("");
    setImportoServiziMax("");
    setTipoPrestazione([]);
    setLivelloProgettazione("all");
    setStatoCommessa("all");
    setDataInizio("");
    setDataFine("");
  }, []);

  // Filtering
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Text search
      if (search) {
        const term = search.toLowerCase();
        if (
          !r.projectCode.toLowerCase().includes(term) &&
          !r.clientName.toLowerCase().includes(term) &&
          !r.codiceDM.toLowerCase().includes(term)
        )
          return false;
      }
      // Macro-categoria
      if (macroCategoria !== "all" && getMacroFromCode(r.codiceDM) !== macroCategoria) return false;
      // Categoria specifica
      if (categoriaSpecifica !== "all" && r.codiceDM !== categoriaSpecifica) return false;
      // Anno range
      if (annoMin && r.projectYear < annoMin) return false;
      if (annoMax && r.projectYear > annoMax) return false;
      // Importo Opere range
      if (importoOpereMin && r.importoOpere < parseFloat(importoOpereMin)) return false;
      if (importoOpereMax && r.importoOpere > parseFloat(importoOpereMax)) return false;
      // Importo Servizi range
      if (importoServiziMin && r.importoServizio < parseFloat(importoServiziMin)) return false;
      if (importoServiziMax && r.importoServizio > parseFloat(importoServiziMax)) return false;
      // Tipo prestazione (multi-select)
      if (tipoPrestazione.length > 0 && !tipoPrestazione.includes(r.prestazioneTipo)) return false;
      // Livello progettazione
      if (livelloProgettazione !== "all" && r.prestazioneLivello !== livelloProgettazione)
        return false;
      // Stato commessa
      if (statoCommessa !== "all" && r.projectStatus !== statoCommessa) return false;
      // Date range (overlap semantics)
      if (dataInizio && r.prestazioneDataCompletamento && r.prestazioneDataCompletamento < dataInizio)
        return false;
      if (dataFine && r.prestazioneDataInizio && r.prestazioneDataInizio > dataFine) return false;
      return true;
    });
  }, [
    rows,
    search,
    macroCategoria,
    categoriaSpecifica,
    annoMin,
    annoMax,
    importoOpereMin,
    importoOpereMax,
    importoServiziMin,
    importoServiziMax,
    tipoPrestazione,
    livelloProgettazione,
    statoCommessa,
    dataInizio,
    dataFine,
  ]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "importoOpere":
          cmp = a.importoOpere - b.importoOpere;
          break;
        case "importoServizio":
          cmp = a.importoServizio - b.importoServizio;
          break;
        case "prestazioneDataInizio":
        case "prestazioneDataCompletamento": {
          const va = a[sortField] || "";
          const vb = b[sortField] || "";
          cmp = va.localeCompare(vb);
          break;
        }
        case "descrizione":
          cmp = getDescription(a.codiceDM).localeCompare(getDescription(b.codiceDM));
          break;
        default:
          cmp = String(a[sortField] ?? "").localeCompare(String(b[sortField] ?? ""));
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Summary (from filtered data)
  const summary = useMemo(() => {
    const uniqueProjects = new Set(filtered.map((r) => r.projectCode));
    return {
      commesse: uniqueProjects.size,
      totaleOpere: filtered.reduce((s, r) => s + r.importoOpere, 0),
      totaleServizi: filtered.reduce((s, r) => s + r.importoServizio, 0),
      classificazioni: filtered.length,
    };
  }, [filtered]);

  // Sort handler
  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  // Export Excel
  const exportExcel = useCallback(() => {
    const exportData = sorted.map((r) => ({
      Commessa: r.projectCode,
      Cliente: r.clientName,
      Anno: r.projectYear,
      "Categoria DM": r.codiceDM,
      Descrizione: getCategoriaById(r.codiceDM)?.destinazioneFunzionale || "",
      "Importo Opere (\u20ac)": r.importoOpere || 0,
      "Importo Servizi (\u20ac)": r.importoServizio || 0,
      Prestazione: r.prestazioneTipo,
      Livello: r.prestazioneLivello || "",
      "Data Inizio": r.prestazioneDataInizio
        ? new Date(r.prestazioneDataInizio).toLocaleDateString("it-IT")
        : "",
      "Data Fine": r.prestazioneDataCompletamento
        ? new Date(r.prestazioneDataCompletamento).toLocaleDateString("it-IT")
        : "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requisiti Tecnici");
    XLSX.writeFile(wb, `requisiti-tecnici-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [sorted]);

  // Export PDF (print)
  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  // Tipo prestazione toggle
  const toggleTipoPrestazione = useCallback((value: string) => {
    setTipoPrestazione((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  // Sort header component
  const SortHeader = ({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`p-2 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Active filters summary for print
  const activeFiltersSummary = [
    search && `Ricerca: "${search}"`,
    macroCategoria !== "all" && `Macro: ${macroCategoria}`,
    categoriaSpecifica !== "all" && `Categoria: ${categoriaSpecifica}`,
    annoMin && `Anno da: ${annoMin}`,
    annoMax && `Anno a: ${annoMax}`,
    statoCommessa !== "all" && `Stato: ${statoCommessa}`,
    tipoPrestazione.length > 0 && `Tipo: ${tipoPrestazione.join(", ")}`,
    livelloProgettazione !== "all" && `Livello: ${livelloProgettazione}`,
    dataInizio && `Dal: ${dataInizio}`,
    dataFine && `Al: ${dataFine}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .requisiti-print-area, .requisiti-print-area * { visibility: visible; }
          .requisiti-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .requisiti-no-print { display: none !important; }
          .requisiti-print-header { display: block !important; }
          @page { size: landscape; margin: 10mm; }
          table { font-size: 9px; }
        }
      `}</style>

      <div className="space-y-6 requisiti-print-area">
        {/* Print-only header */}
        <div className="requisiti-print-header hidden">
          <h1 className="text-xl font-bold">G2 Engineering — Requisiti Tecnici</h1>
          {activeFiltersSummary && (
            <p className="text-sm text-gray-600 mt-1">Filtri attivi: {activeFiltersSummary}</p>
          )}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 requisiti-no-print">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Requisiti Tecnici DM 17/06/2016
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tabella classificazioni opere e importi per partecipazione a gare
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 requisiti-no-print">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{summary.commesse}</div>
              <p className="text-sm text-muted-foreground">Commesse trovate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totaleOpere)}
              </div>
              <p className="text-sm text-muted-foreground">Importo Opere Totale</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-teal-600">
                {formatCurrency(summary.totaleServizi)}
              </div>
              <p className="text-sm text-muted-foreground">Importo Servizi Totale</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">{summary.classificazioni}</div>
              <p className="text-sm text-muted-foreground">Classificazioni</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Row 1 */}
        <div className="flex flex-wrap gap-3 items-end requisiti-no-print">
          {/* Ricerca */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-1 block">Ricerca</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Codice, cliente, categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {/* Macro-Categoria */}
          <div className="min-w-[180px]">
            <label className="text-sm font-medium text-foreground mb-1 block">
              Macro-Categoria
            </label>
            <Select value={macroCategoria} onValueChange={handleMacroCategoriaChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                {MACRO_CATEGORIE.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id} - {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Categoria Specifica */}
          <div className="min-w-[180px]">
            <label className="text-sm font-medium text-foreground mb-1 block">
              Categoria Specifica
            </label>
            <Select
              value={categoriaSpecifica}
              onValueChange={setCategoriaSpecifica}
              disabled={macroCategoria === "all"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                {categorieSpecificheDisponibili.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Anno range */}
          <div className="min-w-[90px]">
            <label className="text-sm font-medium text-foreground mb-1 block">Anno da</label>
            <Input
              placeholder="es. 2020"
              value={annoMin}
              onChange={(e) => setAnnoMin(e.target.value)}
            />
          </div>
          <div className="min-w-[90px]">
            <label className="text-sm font-medium text-foreground mb-1 block">Anno a</label>
            <Input
              placeholder="es. 2026"
              value={annoMax}
              onChange={(e) => setAnnoMax(e.target.value)}
            />
          </div>
        </div>

        {/* Toggle advanced filters */}
        <div className="requisiti-no-print">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtri Avanzati
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 ml-1" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-1" />
            )}
          </Button>
        </div>

        {/* Filter Row 2 (advanced) */}
        {showAdvanced && (
          <div className="flex flex-wrap gap-3 items-end requisiti-no-print">
            {/* Importo Opere range */}
            <div className="min-w-[120px]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Imp. Opere min
              </label>
              <Input
                type="number"
                placeholder="0"
                value={importoOpereMin}
                onChange={(e) => setImportoOpereMin(e.target.value)}
              />
            </div>
            <div className="min-w-[120px]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Imp. Opere max
              </label>
              <Input
                type="number"
                placeholder="..."
                value={importoOpereMax}
                onChange={(e) => setImportoOpereMax(e.target.value)}
              />
            </div>
            {/* Importo Servizi range */}
            <div className="min-w-[120px]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Imp. Servizi min
              </label>
              <Input
                type="number"
                placeholder="0"
                value={importoServiziMin}
                onChange={(e) => setImportoServiziMin(e.target.value)}
              />
            </div>
            <div className="min-w-[120px]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Imp. Servizi max
              </label>
              <Input
                type="number"
                placeholder="..."
                value={importoServiziMax}
                onChange={(e) => setImportoServiziMax(e.target.value)}
              />
            </div>
            {/* Tipo Prestazione multi-select */}
            <div className="min-w-[180px]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Tipo Prestazione
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {tipoPrestazione.length === 0
                      ? "Tutti"
                      : `${tipoPrestazione.length} selezionati`}
                    <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  <div className="space-y-1">
                    {TIPO_PRESTAZIONE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={tipoPrestazione.includes(opt.value)}
                          onCheckedChange={() => toggleTipoPrestazione(opt.value)}
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {/* Livello Progettazione */}
            <div className="min-w-[160px]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Livello Progettazione
              </label>
              <Select value={livelloProgettazione} onValueChange={setLivelloProgettazione}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="pfte">PFTE</SelectItem>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                  <SelectItem value="esecutivo">Esecutivo</SelectItem>
                  <SelectItem value="variante">Variante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Stato Commessa */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Stato Commessa
              </label>
              <Select value={statoCommessa} onValueChange={setStatoCommessa}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="in corso">In Corso</SelectItem>
                  <SelectItem value="sospesa">Sospesa</SelectItem>
                  <SelectItem value="conclusa">Conclusa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Date range */}
            <div className="min-w-[140px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Data da</label>
              <Input
                type="date"
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
              />
            </div>
            <div className="min-w-[140px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Data a</label>
              <Input
                type="date"
                value={dataFine}
                onChange={(e) => setDataFine(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Results bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 requisiti-no-print">
          <span className="text-sm text-muted-foreground">
            {filtered.length} classificazioni trovate su {rows.length} totali
          </span>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Filtri
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="w-4 h-4 mr-2" />
              Esporta Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="w-4 h-4 mr-2" />
              Esporta PDF
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <SortHeader field="projectCode" className="text-left">
                  Commessa
                </SortHeader>
                <SortHeader field="clientName" className="text-left">
                  Cliente
                </SortHeader>
                <SortHeader field="projectYear" className="text-center">
                  Anno
                </SortHeader>
                <SortHeader field="codiceDM" className="text-left">
                  Cat. DM
                </SortHeader>
                <SortHeader field="descrizione" className="text-left">
                  Descrizione
                </SortHeader>
                <SortHeader field="importoOpere" className="text-right">
                  Imp. Opere
                </SortHeader>
                <SortHeader field="importoServizio" className="text-right">
                  Imp. Servizi
                </SortHeader>
                <SortHeader field="prestazioneTipo" className="text-left">
                  Prestazione
                </SortHeader>
                <SortHeader field="prestazioneLivello" className="text-left">
                  Livello
                </SortHeader>
                <SortHeader field="prestazioneDataInizio" className="text-center">
                  Data Inizio
                </SortHeader>
                <SortHeader field="prestazioneDataCompletamento" className="text-center">
                  Data Fine
                </SortHeader>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-muted-foreground">
                    Nessun risultato trovato
                  </td>
                </tr>
              ) : (
                sorted.map((r, idx) => (
                  <tr
                    key={`${r.projectCode}-${r.codiceDM}-${r.prestazioneTipo}-${idx}`}
                    className="border-b hover:bg-muted/50"
                  >
                    <td className="p-2 font-mono text-primary whitespace-nowrap">
                      {r.projectCode}
                    </td>
                    <td className="p-2 text-foreground max-w-[200px] truncate">{r.clientName}</td>
                    <td className="p-2 text-center text-muted-foreground">{r.projectYear}</td>
                    <td className="p-2 font-mono whitespace-nowrap">{r.codiceDM}</td>
                    <td className="p-2 text-muted-foreground max-w-[250px] truncate" title={getDescription(r.codiceDM)}>
                      {getDescription(r.codiceDM)}
                    </td>
                    <td className="p-2 text-right font-medium text-green-600 whitespace-nowrap">
                      {formatCurrency(r.importoOpere)}
                    </td>
                    <td className="p-2 text-right text-teal-600 whitespace-nowrap">
                      {formatCurrency(r.importoServizio)}
                    </td>
                    <td className="p-2 whitespace-nowrap">{capitalize(r.prestazioneTipo)}</td>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">
                      {r.prestazioneLivello ? capitalize(r.prestazioneLivello) : ""}
                    </td>
                    <td className="p-2 text-center text-muted-foreground whitespace-nowrap">
                      {formatDate(r.prestazioneDataInizio)}
                    </td>
                    <td className="p-2 text-center text-muted-foreground whitespace-nowrap">
                      {formatDate(r.prestazioneDataCompletamento)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
