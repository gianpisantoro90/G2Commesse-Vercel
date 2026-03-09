# Requisiti Tecnici - Filtri Avanzati per Gare

## Obiettivo
Filtrare classificazioni DM 17/06/2016 combinando criteri richiesti dai bandi di gara, con export Excel/PDF.

## Approccio
Client-side: nuovo endpoint API restituisce dati denormalizzati (classificazioni + prestazioni + progetto), filtri combinabili istantanei lato frontend. Dataset piccolo (~500 prestazioni, ~50 classificazioni).

## Dati per riga risultato
```
projectCode, projectYear, projectStatus, clientName,
codiceDM, descrizioneDM, importoOpere, importoServizio,
prestazioneTipo, prestazioneLivello,
prestazioneDataInizio, prestazioneDataCompletamento
```

## Filtri (tutti combinabili)

| Filtro | Tipo | Campo |
|--------|------|-------|
| Ricerca testo | Input | codice commessa, cliente, codice DM |
| Macro-categoria DM | Select | codice DM → prefisso (E, S, IA...) |
| Categoria specifica | Select dipendente | codice DM (E.22, S.05...) |
| Anno commessa | Range min-max | project.year |
| Importo opere | Input min-max | classificazione.importoOpere |
| Importo servizi | Input min-max | classificazione.importoServizio |
| Tipo prestazione | Multi-select | prestazione.tipo |
| Livello progettazione | Select | prestazione.livelloProgettazione |
| Stato commessa | Select | project.status |
| Periodo prestazione | Date range da-a | prestazione.dataInizio / dataCompletamento |

## Layout UX

### Header
Contatori riassuntivi dinamici (si aggiornano con i filtri): commesse, importo opere totale, importo servizi totale.

### Barra filtri
- Riga 1 (sempre visibile): Ricerca | Macro-categoria | Categoria specifica | Anno (da-a)
- Riga 2 (collassabile "Filtri avanzati"): Importo opere min-max | Importo servizi min-max | Tipo prestazione | Livello | Stato commessa | Periodo prestazione (date)
- Riga 3: Contatore risultati filtrati | Reset filtri | Esporta Excel | Esporta PDF

### Tabella risultati (flat, sostituisce la vista gerarchica)
Colonne: Commessa | Cliente | Anno | Categoria DM | Descrizione | Importo Opere | Importo Servizi | Prestazione | Livello | Data Inizio | Data Fine
- Ordinabile per ogni colonna
- Toggle raggruppamento per categoria DM

## Export
- **Excel (.xlsx)**: tabella completa con filtri nel nome file
- **PDF**: layout tabellare con intestazione G2 Engineering e filtri attivi

## Endpoint API
`GET /api/requisiti-tecnici/full` — restituisce classificazioni con JOIN su prestazioni e progetti. Campi: projectCode, projectYear, projectStatus, clientName, codiceDM, importoOpere, importoServizio, prestazioneTipo, prestazioneLivello, prestazioneDataInizio, prestazioneDataCompletamento.
