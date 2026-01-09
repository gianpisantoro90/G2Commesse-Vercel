# Schema del File di Backup

Documentazione ufficiale dei campi e valori ammessi nel file di backup JSON esportato dal sistema G2 Gestione Commesse.

## Formato del Backup

- **Formato**: JSON
- **Nome file**: `g2-backup-completo-YYYY-MM-DD_timestamp.json`
- **Endpoint**: `GET /api/export`

## Struttura del Backup

```json
{
  "projects": [...],
  "clients": [...],
  "fileRoutings": [...],
  "systemConfig": [...],
  "oneDriveMappings": [...],
  "filesIndex": [...],
  "users": [...],
  "tasks": [...],
  "communications": [...],
  "deadlines": [...],
  "invoices": [...],
  "prestazioni": [...],
  "sal": [...],
  "changelog": [...],
  "budget": [...],
  "resources": [...],
  "filters": [...]
}
```

---

## 1. PROJECTS (Commesse)

| Campo | Tipo | Valori Ammessi | Note |
|-------|------|----------------|------|
| `id` | UUID | - | Identificativo univoco |
| `code` | string | Es: "25GUAROM01" | Codice progetto univoco |
| `client` | string | - | Nome cliente |
| `clientId` | UUID | - | FK a clients |
| `city` | string | - | Citta |
| `object` | string | - | Oggetto abbreviato |
| `oggettoCompleto` | string | - | Oggetto esteso (per CRE) |
| `year` | number | Es: 25 | Anno (ultime 2 cifre) |
| `template` | enum | `"LUNGO"`, `"BREVE"` | Tipo template |
| `status` | enum | `"in corso"`, `"conclusa"`, `"sospesa"` | Stato progetto |
| `tipoRapporto` | enum | `"diretto"`, `"consulenza"`, `"subappalto"`, `"ati"`, `"partnership"` | Tipo rapporto |
| `committenteFinale` | string | - | Nome ente finale (opzionale) |
| `cig` | string | - | Codice Identificativo Gara |
| `numeroContratto` | string | - | Numero contratto/accordo quadro |
| `dataInizioCommessa` | ISO 8601 | - | Data inizio esecuzione |
| `dataFineCommessa` | ISO 8601 | - | Data fine esecuzione |
| `creArchiviato` | boolean | `true`, `false` | CRE firmato archiviato |
| `creDataArchiviazione` | ISO 8601 | - | Data ricezione CRE |
| `fatturato` | boolean | `true`, `false` | Documento fiscale emesso |
| `numeroFattura` | string | - | Numero fattura/nota/parcella |
| `dataFattura` | ISO 8601 | - | Data emissione fattura |
| `importoFatturato` | number | - | Importo fatturato (centesimi) |
| `pagato` | boolean | `true`, `false` | Pagamento ricevuto |
| `dataPagamento` | ISO 8601 | - | Data incasso effettivo |
| `importoPagato` | number | - | Importo pagato (centesimi) |
| `noteFatturazione` | string | - | Note fatturazione/pagamento |
| `createdAt` | ISO 8601 | - | Data creazione |
| `fsRoot` | string | - | Root file system |
| `metadata` | object | - | Vedi sezione metadata |

### Struttura `metadata`

```json
{
  "prestazioni": ["progettazione", "dl", "cse"],
  "livelloProgettazione": ["definitivo", "esecutivo"],
  "classificazioniDM2016": [
    {"codice": "S.04", "importo": 2800000, "importoServizio": 224000}
  ],
  "classeDM2016": "S.04",
  "importoOpere": 2800000,
  "importoServizio": 224000,
  "percentualeParcella": 8
}
```

| Campo | Tipo | Valori Ammessi | Stato |
|-------|------|----------------|-------|
| `prestazioni` | string[] | `"progettazione"`, `"dl"`, `"csp"`, `"cse"`, `"contabilita"`, `"collaudo"`, `"perizia"`, `"pratiche"` | Attivo |
| `livelloProgettazione` | string[] | `"pfte"`, `"definitivo"`, `"esecutivo"`, `"variante"` | Attivo |
| `classificazioniDM2016` | object[] | Vedi sotto | Attivo |
| `classeDM2016` | string | Es: "S.04", "E.22" | DEPRECATED |
| `importoOpere` | number | Centesimi | DEPRECATED |
| `importoServizio` | number | Centesimi | Attivo |
| `percentualeParcella` | number | 0-100 | Attivo |

### Struttura `classificazioniDM2016[]`

```json
{
  "codice": "S.04",
  "importo": 2800000,
  "importoOpere": 2800000,
  "importoServizio": 224000
}
```

| Campo | Tipo | Note |
|-------|------|------|
| `codice` | string | Codice DM 17/06/2016 (es: E.22, S.04, IA.03) |
| `importo` | number | Importo opere (centesimi) |
| `importoOpere` | number | Alias di importo (opzionale) |
| `importoServizio` | number | Importo servizio professionale (opzionale) |

---

## 2. CLIENTS (Clienti)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `sigla` | string | Univoca |
| `name` | string | Ragione sociale |
| `partitaIva` | string | - |
| `codiceFiscale` | string | - |
| `formaGiuridica` | string | Es: SRL, SPA, Ditta individuale, Ente pubblico |
| `indirizzo` | string | - |
| `cap` | string | - |
| `city` | string | - |
| `provincia` | string | - |
| `email` | string | - |
| `telefono` | string | - |
| `pec` | string | - |
| `codiceDestinatario` | string | Codice SDI |
| `nomeReferente` | string | - |
| `ruoloReferente` | string | - |
| `emailReferente` | string | - |
| `telefonoReferente` | string | - |
| `note` | string | - |
| `projectsCount` | number | - |
| `createdAt` | ISO 8601 | - |

---

## 3. PROJECT_PRESTAZIONI (Prestazioni)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects |
| `tipo` | enum | `"progettazione"`, `"dl"`, `"csp"`, `"cse"`, `"contabilita"`, `"collaudo"`, `"perizia"`, `"pratiche"` |
| `livelloProgettazione` | enum | `"pfte"`, `"definitivo"`, `"esecutivo"`, `"variante"` (solo se tipo=progettazione) |
| `descrizione` | string | - |
| `stato` | enum | `"da_iniziare"`, `"in_corso"`, `"completata"`, `"fatturata"`, `"pagata"` |
| `dataInizio` | ISO 8601 | - |
| `dataCompletamento` | ISO 8601 | - |
| `dataFatturazione` | ISO 8601 | - |
| `dataPagamento` | ISO 8601 | - |
| `importoPrevisto` | number | Centesimi |
| `importoFatturato` | number | Centesimi |
| `importoPagato` | number | Centesimi |
| `note` | string | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 4. PROJECT_INVOICES (Fatture)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects |
| `salId` | UUID | FK a sal (opzionale) |
| `prestazioneId` | UUID | FK a prestazioni |
| `tipoFattura` | enum | `"unica"`, `"acconto"`, `"sal"`, `"saldo"` |
| `numeroFattura` | string | Univoco |
| `dataEmissione` | ISO 8601 | - |
| `importoNetto` | number | Centesimi |
| `cassaPrevidenziale` | number | Centesimi (4%) |
| `importoIVA` | number | Centesimi |
| `importoTotale` | number | Centesimi |
| `importoParcella` | number | Centesimi |
| `aliquotaIVA` | number | Percentuale (es: 22) |
| `ritenuta` | number | Centesimi |
| `stato` | enum | `"emessa"`, `"pagata"`, `"parzialmente_pagata"`, `"scaduta"` |
| `scadenzaPagamento` | ISO 8601 | - |
| `dataPagamento` | ISO 8601 | - |
| `note` | string | - |
| `attachmentPath` | string | Path OneDrive |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 5. PROJECT_SAL (Stati Avanzamento Lavori)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects |
| `numero` | number | Progressivo |
| `descrizione` | string | - |
| `percentualeAvanzamento` | number | 0-100 |
| `importoLavori` | number | Centesimi |
| `importoContabilizzato` | number | Centesimi |
| `dataEmissione` | ISO 8601 | - |
| `dataApprovazione` | ISO 8601 | - |
| `stato` | enum | `"bozza"`, `"emesso"`, `"approvato"`, `"fatturato"` |
| `note` | string | - |
| `attachments` | JSON array | `[{name, size}]` |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 6. COMMUNICATIONS (Comunicazioni)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects (nullable) |
| `type` | enum | `"email"`, `"pec"`, `"raccomandata"`, `"telefono"`, `"meeting"`, `"nota_interna"` |
| `direction` | enum | `"incoming"`, `"outgoing"`, `"internal"` |
| `subject` | string | - |
| `body` | string | - |
| `recipient` | string | - |
| `sender` | string | - |
| `isImportant` | boolean | - |
| `communicationDate` | ISO 8601 | - |
| `tags` | string[] | - |
| `attachments` | object[] | `[{name, size}]` |
| `createdBy` | string | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |
| `emailMessageId` | string | - |
| `emailHeaders` | object | - |
| `emailHtml` | string | - |
| `emailText` | string | - |
| `autoImported` | boolean | - |
| `aiSuggestions` | object | - |
| `aiSuggestionsStatus` | object | - |
| `aiTasksStatus` | object | - |
| `aiDeadlinesStatus` | object | - |
| `importedAt` | ISO 8601 | - |

---

## 7. TASKS (Attivita)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `title` | string | - |
| `description` | string | - |
| `notes` | string | - |
| `projectId` | UUID | FK a projects (opzionale) |
| `assignedToId` | UUID | FK a users |
| `createdById` | UUID | FK a users |
| `priority` | enum | `"low"`, `"medium"`, `"high"` |
| `status` | enum | `"pending"`, `"in_progress"`, `"completed"`, `"cancelled"` |
| `dueDate` | ISO 8601 | (opzionale) |
| `completedAt` | ISO 8601 | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 8. DEADLINES (Scadenze)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects |
| `title` | string | - |
| `description` | string | - |
| `dueDate` | ISO 8601 | - |
| `priority` | enum | `"low"`, `"medium"`, `"high"`, `"urgent"` |
| `status` | enum | `"pending"`, `"completed"`, `"overdue"`, `"cancelled"` |
| `type` | enum | `"general"`, `"deposito"`, `"collaudo"`, `"scadenza_assicurazione"`, `"milestone"` |
| `notifyDaysBefore` | number | - |
| `completedAt` | ISO 8601 | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 9. PROJECT_BUDGET (Budget)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects (unique) |
| `budgetOreTotale` | number | - |
| `oreConsuntivate` | number | - |
| `costiConsulenze` | number | Centesimi |
| `costiRilievi` | number | Centesimi |
| `altriCosti` | number | Centesimi |
| `costiTotali` | number | Centesimi |
| `ricaviPrevisti` | number | Centesimi |
| `ricaviEffettivi` | number | Centesimi |
| `note` | string | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 10. PROJECT_RESOURCES (Risorse)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects |
| `userName` | string | - |
| `userEmail` | string | - |
| `role` | enum | `"progettista"`, `"dl"`, `"csp"`, `"cse"`, `"collaudatore"`, `"tecnico"` |
| `oreAssegnate` | number | - |
| `oreLavorate` | number | - |
| `costoOrario` | number | Centesimi |
| `isResponsabile` | boolean | - |
| `dataInizio` | ISO 8601 | - |
| `dataFine` | ISO 8601 | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 11. PROJECT_CHANGELOG (Storico)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects |
| `action` | enum | `"created"`, `"updated"`, `"deleted"`, `"status_changed"` |
| `field` | string | Es: "status", "metadata.prestazioni" |
| `oldValue` | string/JSON | - |
| `newValue` | string/JSON | - |
| `description` | string | - |
| `userId` | UUID | - |
| `userName` | string | - |
| `createdAt` | ISO 8601 | - |

---

## 12. USERS (Utenti)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `username` | string | Univoco |
| `email` | string | Univoco |
| `fullName` | string | - |
| `passwordHash` | string | - |
| `role` | enum | `"admin"`, `"user"` |
| `active` | boolean | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 13. SYSTEM_CONFIG (Configurazione)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `key` | string | Univoca |
| `value` | JSON | Oggetto complesso |
| `updatedAt` | ISO 8601 | - |

---

## 14. FILE_ROUTINGS (Routing File)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectId` | UUID | FK a projects |
| `fileName` | string | - |
| `fileType` | string | - |
| `suggestedPath` | string | - |
| `actualPath` | string | - |
| `confidence` | number | 0-100 |
| `method` | enum | `"ai"`, `"rules"`, `"learned"` |
| `createdAt` | ISO 8601 | - |

---

## 15. ONEDRIVE_MAPPINGS (Mappature OneDrive)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `projectCode` | string | FK a projects.code |
| `oneDriveFolderId` | string | - |
| `oneDriveFolderName` | string | - |
| `oneDriveFolderPath` | string | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 16. FILES_INDEX (Indice File)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `driveItemId` | string | ID OneDrive |
| `name` | string | - |
| `path` | string | - |
| `size` | number | Byte |
| `mimeType` | string | - |
| `lastModified` | ISO 8601 | - |
| `projectCode` | string | FK a projects.code |
| `parentFolderId` | string | - |
| `isFolder` | boolean | - |
| `webUrl` | string | - |
| `downloadUrl` | string | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## 17. SAVED_FILTERS (Filtri Salvati)

| Campo | Tipo | Valori Ammessi |
|-------|------|----------------|
| `id` | UUID | - |
| `name` | string | - |
| `description` | string | - |
| `filterConfig` | JSON | Configurazione filtri |
| `isDefault` | boolean | - |
| `userId` | UUID | - |
| `createdAt` | ISO 8601 | - |
| `updatedAt` | ISO 8601 | - |

---

## Classificazioni DM 17/06/2016

### EDILIZIA (E.xx)

| Codice | Descrizione |
|--------|-------------|
| E.01 | Insediamenti produttivi agricoltura-industria-artigianato semplici |
| E.02 | Edifici industriali con corredi tecnici complessi |
| E.03 | Ostelli, Pensioni, Ristoranti, Motel, negozi, mercati semplici |
| E.04 | Alberghi, Villaggi turistici, Centri commerciali complessi |
| E.05 | Edifici, pertinenze, autorimesse semplici |
| E.06 | Edilizia residenziale privata e pubblica di tipo corrente |
| E.07 | Edifici residenziali di tipo pregiato |
| E.08 | Sedi ASL, Ambulatori, Asili, Scuole |
| E.09 | Scuole secondarie grandi, Case di cura |
| E.10 | Poliambulatori, Ospedali, Universita, Istituti ricerca |
| E.11 | Padiglioni esposizioni, opere cimiteriali, campi sportivi semplici |
| E.12 | Campi sportivi complessi, Palestre, piscine coperte |
| E.13 | Biblioteca, Cinema, Teatro, Museo, Chiese, Palasport, Stadio |
| E.14 | Edifici provvisori a servizio di caserme |
| E.15 | Caserme con corredi tecnici correnti |
| E.16 | Sedi Uffici, Tribunali, Penitenziari, Caserme complesse |
| E.17 | Verde ed opere di arredo urbano semplici, Campeggi |
| E.18 | Arredamenti standard, Giardini, Parchi gioco, Piazze |
| E.19 | Arredamenti singolari, Parchi urbani, Riqualificazione paesaggistica |
| E.20 | Manutenzione straordinaria, ristrutturazione edifici esistenti |
| E.21 | Restauro edifici di interesse storico artistico |
| E.22 | Restauro conservativo edifici storici vincolati |

### STRUTTURE (S.xx)

| Codice | Descrizione |
|--------|-------------|
| S.01 | Strutture c.a. non soggette ad azioni sismiche |
| S.02 | Strutture muratura/legno/metallo non sismiche |
| S.03 | Strutture in cemento armato con verifiche strutturali |
| S.04 | Strutture muratura, legno, metallo con verifiche strutturali |
| S.05 | Strutture speciali (dighe, gallerie, opere sotterranee) |
| S.06 | Opere strutturali di notevole importanza costruttiva |

### IMPIANTI MECCANICI/ELETTRICI (IA.xx)

| Codice | Descrizione |
|--------|-------------|
| IA.01 | Impianti idrici, sanitari, fognature domestiche |
| IA.02 | Impianti riscaldamento, climatizzazione |
| IA.03 | Impianti elettrici standard, illuminazione, antincendio |
| IA.04 | Impianti elettrici complessi, cablaggi strutturati |

### IMPIANTI INDUSTRIALI (IB.xx)

| Codice | Descrizione |
|--------|-------------|
| IB.04 | Depositi e discariche senza trattamento |
| IB.05 | Impianti industrie molitorie, alimentari, legno |
| IB.06 | Impianti industria chimica, siderurgici |
| IB.07 | Impianti complessi con rischi rilevanti |
| IB.08 | Linee elettriche, reti trasmissione |
| IB.09 | Centrali idroelettriche ordinarie |
| IB.10 | Impianti termoelettrici, elettrometallurgia |
| IB.11 | Campi fotovoltaici, Parchi eolici |
| IB.12 | Micro centrali, Impianti termoelettrici complessi |

### INFRASTRUTTURE MOBILITA (V.xx)

| Codice | Descrizione |
|--------|-------------|
| V.01 | Manutenzione viabilita ordinaria |
| V.02 | Strade, ferrovie ordinarie, piste ciclabili |
| V.03 | Viabilita speciale, impianti teleferici, piste aeroportuali |

### IDRAULICA (D.xx)

| Codice | Descrizione |
|--------|-------------|
| D.01 | Opere navigazione interna e portuali |
| D.02 | Bonifiche e irrigazioni a deflusso naturale |
| D.03 | Bonifiche con sollevamento meccanico |
| D.04 | Acquedotti e fognature semplici |
| D.05 | Acquedotti e fognature complessi |

### TECNOLOGIE ICT (T.xx)

| Codice | Descrizione |
|--------|-------------|
| T.01 | Sistemi informativi, data center |
| T.02 | Reti telecomunicazione, videosorveglianza |
| T.03 | Sistemi elettronici, automazione, robotica |

### PAESAGGIO/AMBIENTE (P.xx)

| Codice | Descrizione |
|--------|-------------|
| P.01 | Sistemazione naturalistica o paesaggistica |
| P.02 | Interventi del verde |
| P.03 | Recupero e riqualificazione ambientale |
| P.04 | Sfruttamento cave e torbiere |
| P.05 | Miglioramento filiera forestale |
| P.06 | Miglioramento fondiario agrario |

### TERRITORIO/URBANISTICA (U.xx)

| Codice | Descrizione |
|--------|-------------|
| U.01 | Valorizzazione filiere agroalimentari |
| U.02 | Valorizzazione filiera naturalistica |
| U.03 | Pianificazione |

---

## Note Tecniche

- **Valori monetari**: sempre in **centesimi** (10000 = 100,00 EUR)
- **Timestamp**: formato **ISO 8601** (es: `2025-09-25T10:18:07.432Z`)
- **UUID**: identificativi univoci per tutti i record
- **FK**: Foreign Key (riferimento ad altra tabella)
- **Totale entita**: 17
- **Totale campi**: ~150

---

## Changelog

| Data | Versione | Note |
|------|----------|------|
| 2025-01-09 | 1.0 | Documentazione iniziale con correzione discrepanze |
