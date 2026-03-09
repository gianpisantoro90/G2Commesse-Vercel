# Requisiti Tecnici - Filtri Avanzati per Gare - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hierarchical view in requisiti-tecnici with a flat filterable table supporting combined filters for tender participation, with Excel/PDF export.

**Architecture:** New API endpoint joins `prestazione_classificazioni` + `project_prestazioni` + `projects` into flat denormalized rows. Frontend rewrites requisiti-tecnici.tsx with combined filters (all client-side) and export buttons. No new dependencies for Excel (use CSV fallback or lightweight xlsx lib).

**Tech Stack:** React, TanStack Query, shadcn/ui, Drizzle ORM, xlsx (new dep for Excel export)

---

### Task 1: Backend — New endpoint `/api/requisiti-tecnici/full`

**Files:**
- Modify: `server/routes/classificazioni.ts` — add new endpoint
- Modify: `server/storage.ts` — add `getRequisitiTecniciFullData()` to IStorage and DatabaseStorage

**Step 1: Add storage method**

In `server/storage.ts`, add to `IStorage` interface (after `getClassificazioniByProject`):

```typescript
getRequisitiTecniciFullData(): Promise<RequisitoTecnicoRow[]>;
```

Add type near top of file:

```typescript
export interface RequisitoTecnicoRow {
  projectCode: string;
  projectYear: string;
  projectStatus: string;
  clientName: string;
  codiceDM: string;
  importoOpere: number;
  importoServizio: number;
  prestazioneTipo: string;
  prestazioneLivello: string | null;
  prestazioneDataInizio: Date | null;
  prestazioneDataCompletamento: Date | null;
}
```

Implement in `DatabaseStorage`:

```typescript
async getRequisitiTecniciFullData(): Promise<RequisitoTecnicoRow[]> {
  const rows = await db
    .select({
      projectCode: projects.code,
      projectYear: projects.year,
      projectStatus: projects.status,
      clientName: projects.client,
      codiceDM: prestazioneClassificazioni.codiceDM,
      importoOpere: prestazioneClassificazioni.importoOpere,
      importoServizio: prestazioneClassificazioni.importoServizio,
      prestazioneTipo: projectPrestazioni.tipo,
      prestazioneLivello: projectPrestazioni.livelloProgettazione,
      prestazioneDataInizio: projectPrestazioni.dataInizio,
      prestazioneDataCompletamento: projectPrestazioni.dataCompletamento,
    })
    .from(prestazioneClassificazioni)
    .innerJoin(projectPrestazioni, eq(prestazioneClassificazioni.prestazioneId, projectPrestazioni.id))
    .innerJoin(projects, eq(prestazioneClassificazioni.projectId, projects.id))
    .orderBy(projects.code);

  return rows;
}
```

Also add to `MemStorage` (return empty array) and `FallbackStorage` (delegate).

**Step 2: Add route**

In `server/routes/classificazioni.ts`, add before the existing routes:

```typescript
app.get("/api/requisiti-tecnici/full", requireAuth, async (req, res) => {
  try {
    const data = await storage.getRequisitiTecniciFullData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Errore nel recupero dati requisiti tecnici" });
  }
});
```

**Step 3: Verify TypeScript compiles**

Run: `npm run check`
Expected: 0 errors

**Step 4: Commit**

```
feat: add /api/requisiti-tecnici/full endpoint with denormalized data
```

---

### Task 2: Install xlsx dependency

**Step 1: Install**

```bash
npm install xlsx
```

**Step 2: Commit**

```
chore: add xlsx dependency for Excel export
```

---

### Task 3: Frontend — Rewrite requisiti-tecnici.tsx with flat table + filters

**Files:**
- Rewrite: `client/src/components/projects/requisiti-tecnici.tsx`

**Step 1: Rewrite the component**

Replace the entire component. Key sections:

**State — 10 filter states:**
```typescript
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
const [sortField, setSortField] = useState<string>("projectCode");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
```

**Data fetch — new endpoint:**
```typescript
const { data: rows = [], isLoading } = useQuery<RequisitoTecnicoRow[]>({
  queryKey: ["/api/requisiti-tecnici/full"],
});
```

**Filtering — useMemo combining all filters:**
```typescript
const filtered = useMemo(() => {
  return rows.filter(row => {
    // search: match projectCode, clientName, codiceDM
    // macroCategoria: row.codiceDM.split(".")[0]
    // categoriaSpecifica: exact match
    // annoMin/annoMax: parseInt(row.projectYear)
    // importoOpereMin/Max: row.importoOpere
    // importoServiziMin/Max: row.importoServizio
    // tipoPrestazione: array includes row.prestazioneTipo
    // livelloProgettazione: exact match
    // statoCommessa: row.projectStatus
    // dataInizio/dataFine: compare dates
    return true;
  });
}, [rows, ...allFilterDeps]);
```

**Sorting — useMemo on filtered:**
```typescript
const sorted = useMemo(() => {
  return [...filtered].sort((a, b) => {
    // sort by sortField, handle string/number/date
  });
}, [filtered, sortField, sortDir]);
```

**Summary cards — computed from filtered data:**
```typescript
const summary = useMemo(() => ({
  commesse: new Set(filtered.map(r => r.projectCode)).size,
  importoOpere: filtered.reduce((s, r) => s + (r.importoOpere || 0), 0),
  importoServizi: filtered.reduce((s, r) => s + (r.importoServizio || 0), 0),
  classificazioni: filtered.length,
}), [filtered]);
```

**Layout structure:**
```
<div>
  {/* Summary cards (4) — use summary computed above */}
  {/* Filter row 1: search | macro | categoria | anno min-max */}
  {/* Toggle "Filtri avanzati" */}
  {/* Filter row 2 (collapsible): importo opere min-max | importo servizi min-max | tipo prestazione | livello | stato commessa | date range */}
  {/* Results bar: count | reset | export excel | export pdf */}
  {/* Table with sortable headers */}
</div>
```

**Table columns:**
| Commessa | Cliente | Anno | Cat. DM | Descrizione | Imp. Opere | Imp. Servizi | Prestazione | Livello | Data Inizio | Data Fine |

Each header clickable to sort. Use `getCategoriaById(codiceDM)?.destinazioneFunzionale` for description column.

**Multi-select for tipo prestazione:** Use checkboxes in a dropdown (Popover + Checkbox from shadcn).

**Step 2: Verify it builds**

Run: `npm run check`

**Step 3: Commit**

```
feat: rewrite requisiti-tecnici with flat table and combined filters
```

---

### Task 4: Frontend — Excel export

**Files:**
- Modify: `client/src/components/projects/requisiti-tecnici.tsx` — add export function

**Step 1: Add export function**

```typescript
import * as XLSX from 'xlsx';

const exportExcel = () => {
  const exportData = sorted.map(r => ({
    'Commessa': r.projectCode,
    'Cliente': r.clientName,
    'Anno': r.projectYear,
    'Categoria DM': r.codiceDM,
    'Descrizione': getCategoriaById(r.codiceDM)?.destinazioneFunzionale || '',
    'Importo Opere (€)': r.importoOpere || 0,
    'Importo Servizi (€)': r.importoServizio || 0,
    'Prestazione': r.prestazioneTipo,
    'Livello': r.prestazioneLivello || '',
    'Data Inizio': r.prestazioneDataInizio ? new Date(r.prestazioneDataInizio).toLocaleDateString('it-IT') : '',
    'Data Fine': r.prestazioneDataCompletamento ? new Date(r.prestazioneDataCompletamento).toLocaleDateString('it-IT') : '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Requisiti Tecnici');
  XLSX.writeFile(wb, `requisiti-tecnici-${new Date().toISOString().slice(0,10)}.xlsx`);
};
```

Wire to "Esporta Excel" button.

**Step 2: Commit**

```
feat: add Excel export to requisiti tecnici
```

---

### Task 5: Frontend — PDF export

**Files:**
- Modify: `client/src/components/projects/requisiti-tecnici.tsx` — add PDF export via print

**Step 1: Add PDF export using browser print**

No new dependency. Use `window.print()` with a print-specific CSS class that hides filters and formats the table.

```typescript
const exportPDF = () => {
  window.print();
};
```

Add CSS in the component or a `@media print` block:
- Hide filters, buttons, sidebar
- Show only table with header "G2 Engineering — Requisiti Tecnici" and active filters summary
- Page landscape orientation

**Step 2: Commit**

```
feat: add PDF export (print) to requisiti tecnici
```

---

### Task 6: Type sharing + cleanup

**Files:**
- Create: `shared/types/requisiti-tecnici.ts` — shared type for RequisitoTecnicoRow
- Modify: `server/storage.ts` — import from shared
- Modify: `client/src/components/projects/requisiti-tecnici.tsx` — import from shared

**Step 1: Create shared type file**

```typescript
export interface RequisitoTecnicoRow {
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
```

**Step 2: Run full checks**

```bash
npm run check
```

**Step 3: Test manually on localhost**
- Verify all 10 filters work in combination
- Verify summary cards update with filters
- Verify sort on each column
- Verify Excel export downloads correct data
- Verify PDF print shows formatted table

**Step 4: Commit and push**

```
feat: complete requisiti tecnici advanced filters for tender participation
git push origin main && git push vercel main
```
