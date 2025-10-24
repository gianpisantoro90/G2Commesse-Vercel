# Migrazione Database per Integrazione Email

## Panoramica

Questa migrazione aggiunge campi per l'integrazione email alla tabella `project_communications`.

## Campi Aggiunti

La tabella `project_communications` è stata estesa con i seguenti campi:

```typescript
// ID univoco del messaggio email dal provider
emailMessageId: text("email_message_id")

// Headers completi dell'email (JSON)
emailHeaders: jsonb("email_headers")

// Contenuto email raw (per debugging, opzionale)
emailRaw: text("email_raw")

// Versione HTML dell'email
emailHtml: text("email_html")

// Versione plain text dell'email
emailText: text("email_text")

// Flag: email auto-importata via forwarding?
autoImported: boolean("auto_imported").default(false)

// Risultati analisi AI (JSON)
aiSuggestions: jsonb("ai_suggestions")
// Struttura:
// {
//   projectCode?: string;
//   projectId?: string;
//   confidence: number;
//   extractedData?: {
//     deadlines?: string[];
//     amounts?: string[];
//     actionItems?: string[];
//     keyPoints?: string[];
//   };
//   suggestedTags?: string[];
//   isImportant?: boolean;
//   summary?: string;
// }

// Timestamp importazione automatica
importedAt: timestamp("imported_at")
```

## Esecuzione Migrazione

### Su Ambiente Locale

1. Assicurati che il database sia connesso (verifica `.env`):
   ```bash
   DATABASE_URL=postgresql://...
   ```

2. Esegui il push dello schema:
   ```bash
   npm run db:push
   ```

3. Drizzle Kit mostrerà i cambiamenti proposti:
   ```
   ? Do you want to apply these changes? (y/n)
   ```

4. Conferma con `y`

5. Verifica il risultato:
   ```bash
   npm run db:studio
   ```
   - Naviga su `project_communications`
   - Verifica che i nuovi campi siano presenti

### Su Replit

1. Apri il progetto su Replit

2. Nel terminale Shell, esegui:
   ```bash
   npm run db:push
   ```

3. Conferma i cambiamenti quando richiesto

### Su Produzione

**IMPORTANTE**: Esegui un backup prima della migrazione!

1. Backup database:
   ```bash
   # Se usi Neon.tech
   # Vai su dashboard > Project > Create Branch
   # Oppure:
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. Esegui migrazione:
   ```bash
   npm run db:push
   ```

3. Test post-migrazione:
   - Verifica che l'app si avvii senza errori
   - Controlla che le comunicazioni esistenti siano ancora visibili
   - Prova a creare una nuova comunicazione manuale
   - Prova l'endpoint email test: `POST /api/email/test`

## Compatibilità

### Retrocompatibilità

✅ **Completamente retrocompatibile**

- Tutti i nuovi campi sono **opzionali** (nullable)
- Le comunicazioni esistenti continueranno a funzionare normalmente
- I campi email saranno `null` per le comunicazioni create prima della migrazione

### Comunicazioni Esistenti

Le comunicazioni già presenti nel database:
- Non saranno modificate
- Avranno tutti i campi email impostati a `null`
- Funzioneranno normalmente nell'interfaccia
- Non mostreranno badge "Auto-importata" o informazioni AI

### Rollback

Se necessario, i campi possono essere rimossi eseguendo:

```sql
ALTER TABLE project_communications
DROP COLUMN IF EXISTS email_message_id,
DROP COLUMN IF EXISTS email_headers,
DROP COLUMN IF EXISTS email_raw,
DROP COLUMN IF EXISTS email_html,
DROP COLUMN IF EXISTS email_text,
DROP COLUMN IF EXISTS auto_imported,
DROP COLUMN IF EXISTS ai_suggestions,
DROP COLUMN IF EXISTS imported_at;
```

⚠️ **ATTENZIONE**: Questo eliminerà tutti i dati email importati!

## Verifica Post-Migrazione

### Test SQL

Connettiti al database e verifica:

```sql
-- Verifica presenza nuovi campi
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'project_communications'
  AND column_name IN (
    'email_message_id',
    'email_headers',
    'email_raw',
    'email_html',
    'email_text',
    'auto_imported',
    'ai_suggestions',
    'imported_at'
  );

-- Verifica comunicazioni esistenti (devono avere campi email NULL)
SELECT id, subject, email_message_id, auto_imported
FROM project_communications
LIMIT 5;
```

### Test Applicazione

1. **Avvio app**:
   ```bash
   npm run dev
   ```
   - ✅ L'app si avvia senza errori
   - ✅ Non ci sono errori di schema nel console

2. **Registro Comunicazioni**:
   - ✅ Le comunicazioni esistenti sono visibili
   - ✅ Nessun badge "Auto-importata" su comunicazioni vecchie
   - ✅ È possibile creare nuove comunicazioni manuali

3. **Email Integration**:
   - ✅ Test SMTP: `POST /api/email/test` ritorna success
   - ✅ Invio email funziona e crea comunicazione
   - ✅ Webhook può ricevere payload (testare con Postman/curl)

## Indici Raccomandati (Opzionale)

Per migliorare le performance con grandi volumi di email:

```sql
-- Indice su email_message_id per lookup veloci
CREATE INDEX IF NOT EXISTS idx_email_message_id
ON project_communications(email_message_id)
WHERE email_message_id IS NOT NULL;

-- Indice su auto_imported per filtrare email automatiche
CREATE INDEX IF NOT EXISTS idx_auto_imported
ON project_communications(auto_imported)
WHERE auto_imported = true;

-- Indice su imported_at per ordinamento cronologico email
CREATE INDEX IF NOT EXISTS idx_imported_at
ON project_communications(imported_at DESC)
WHERE imported_at IS NOT NULL;
```

## Stima Spazio

Per 10,000 email importate:
- `emailMessageId`: ~500 KB
- `emailHeaders`: ~5 MB
- `emailHtml`: ~50 MB (varia molto)
- `emailText`: ~10 MB
- `aiSuggestions`: ~2 MB

**Totale stimato**: ~67 MB per 10K email

Considera di:
- Non salvare `emailRaw` (campo più pesante, solo per debug)
- Configurare retention policy (es. eliminare email dopo 1 anno)
- Comprimere campi HTML prima del salvataggio

## Supporto

Se riscontri problemi durante la migrazione:

1. Verifica connessione database: `echo $DATABASE_URL`
2. Controlla log drizzle-kit per errori specifici
3. Esegui backup prima di ritentare
4. In caso di errori persistenti, contatta supporto Neon.tech (se usi Neon)

## Checklist Migrazione

- [ ] Backup database eseguito
- [ ] `.env` configurato correttamente con `DATABASE_URL`
- [ ] `npm run db:push` eseguito con successo
- [ ] Verifica SQL completata - campi presenti
- [ ] App si avvia senza errori
- [ ] Comunicazioni esistenti visibili e funzionanti
- [ ] Nuove comunicazioni possono essere create
- [ ] Test endpoint `/api/email/test` superato
- [ ] (Opzionale) Indici creati per performance
