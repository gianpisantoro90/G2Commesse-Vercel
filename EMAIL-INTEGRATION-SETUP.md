# Integrazione Email - Guida alla Configurazione

## Panoramica

Il sistema di integrazione email consente di:
- **Auto-importare email** ricevute direttamente nelle comunicazioni di progetto
- **Inviare email** dall'applicazione con registrazione automatica
- **Analisi AI** per abbinare automaticamente le email ai progetti corretti
- **Estrarre automaticamente** scadenze, importi e azioni da compiere

## Requisiti

1. Account SendGrid (https://sendgrid.com)
2. Dominio email verificato su SendGrid
3. API Key di SendGrid
4. Accesso al DNS del dominio per configurare l'inbound parse

## Configurazione Step-by-Step

### 1. Creazione Account SendGrid

1. Registrati su https://sendgrid.com
2. Verifica il tuo account email
3. Completa l'onboarding iniziale

### 2. Configurazione API Key

1. Vai su **Settings** > **API Keys** nel dashboard SendGrid
2. Clicca su **Create API Key**
3. Nome: `G2-Commesse-Integration`
4. Permessi: **Full Access** (o almeno: Mail Send, Inbound Parse)
5. Copia la chiave API generata (sarà mostrata una sola volta!)

### 3. Verifica Dominio

1. Vai su **Settings** > **Sender Authentication**
2. Clicca su **Verify a Single Sender** (per test rapido) o **Domain Authentication** (per produzione)
3. Segui le istruzioni per verificare il tuo dominio o email

### 4. Configurazione Inbound Parse

SendGrid Inbound Parse riceve le email inoltrate al tuo dominio e le invia al webhook dell'app.

#### 4.1 Configurazione DNS (Opzione A - Sottodominio dedicato)

1. Vai su **Settings** > **Inbound Parse** > **Add Host & URL**
2. Inserisci:
   - **Subdomain**: `commesse` (es. commesse.tuodominio.it)
   - **Domain**: `tuodominio.it`
   - **Destination URL**: `https://tua-app.replit.dev/api/email/webhook`
   - **Check "Spam Check"**: Opzionale
   - **Check "Send Raw"**: Consigliato

3. SendGrid fornirà un record MX da aggiungere al tuo DNS:
   ```
   Tipo: MX
   Host: commesse
   Valore: mx.sendgrid.net
   Priorità: 10
   ```

4. Aggiungi il record MX nel pannello DNS del tuo provider
5. Attendi propagazione DNS (può richiedere fino a 48h, solitamente 1-2h)

#### 4.2 Email Forwarding (Opzione B - Più semplice per test)

Se non puoi configurare il DNS, usa l'email forwarding:

1. Configura l'Inbound Parse come sopra (punto 2)
2. Nel tuo client email (Gmail, Outlook, etc.), configura un filtro che inoltra automaticamente le email a `commesse@tuodominio.it`
3. Esempio Gmail:
   - Vai su Impostazioni > Inoltro e POP/IMAP
   - Aggiungi indirizzo di inoltro
   - Oppure crea un filtro che inoltra email specifiche

### 5. Variabili d'Ambiente

Aggiungi queste variabili al file `.env` (su Replit: Secrets):

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxx

# Email Settings
EMAIL_FROM=noreply@tuodominio.it
EMAIL_FROM_NAME=G2 Gestione Commesse

# SMTP Settings (per invio email)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxx  # La stessa API key di SendGrid

# Anthropic API (per analisi AI delle email)
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Già presente per altre funzionalità AI
```

### 6. Test Configurazione SMTP

Usa l'endpoint di test per verificare la configurazione:

```bash
curl -X POST https://tua-app.replit.dev/api/email/test \
  -H "Content-Type: application/json"
```

Risposta attesa:
```json
{
  "success": true,
  "message": "SMTP connection successful"
}
```

## Utilizzo

### Invio Email dall'Applicazione

1. Vai su **Registro Comunicazioni**
2. Clicca sui tre puntini (⋮) su una comunicazione email
3. Seleziona **"Invia Email"**
4. Compila destinatario, oggetto e messaggio
5. L'email verrà inviata e registrata automaticamente

### Ricezione Email Automatica

1. Le email ricevute all'indirizzo configurato (`commesse@tuodominio.it`) vengono automaticamente inviate al webhook
2. L'**AI analizza** l'email per identificare:
   - Il progetto correlato (dal codice nell'oggetto o nel corpo)
   - Scadenze menzionate
   - Importi monetari
   - Azioni da compiere
   - Livello di importanza

3. Se la **confidenza è >= 70%**, l'email viene auto-importata:
   - Creata una comunicazione nel registro
   - Inviata notifica in tempo reale
   - Visibile con badge "Auto-importata" e percentuale di confidenza

4. Se la **confidenza è < 70%**, viene solo loggata (non auto-importata) per revisione manuale

### Identificatori di Progetto

Per migliorare il matching automatico, includi nelle email:
- **Codice progetto nell'oggetto**: es. `[G2-2024-001] Richiesta chiarimenti`
- **Nel corpo**: menziona il codice progetto o il nome del cliente
- **In risposta**: rispondi alle email esistenti per mantenere il thread

Esempi di oggetti email riconosciuti:
- `[G2-2024-001] Conferma preventivo`
- `Progetto G2-2024-001 - Domanda tecnica`
- `Re: Commessa Comune di Roma - Aggiornamenti`

## Visualizzazione nel Registro

Le comunicazioni auto-importate mostrano:

### Badge Identificativi
- 🟣 **"Auto-importata (85%)"** - Badge viola con percentuale di confidenza AI
- ⚡ **Icona Zap** - Indica analisi AI

### Informazioni AI
- **Riepilogo**: Sommario generato dall'AI del contenuto email
- **Azioni estratte**: Lista di task identificati (es. "Inviare documentazione entro venerdì")
- **Scadenze**: Date menzionate nell'email
- **Importi**: Cifre monetarie rilevate

### Anteprima Email
- Click su **"Mostra Email"** nel menu (⋮) per vedere la versione HTML originale
- Visualizzazione timestamp di importazione

## Troubleshooting

### Email non vengono ricevute

1. **Verifica DNS**: Controlla che il record MX sia configurato correttamente
   ```bash
   nslookup -type=MX commesse.tuodominio.it
   ```

2. **Verifica webhook URL**: Deve essere HTTPS e accessibile pubblicamente
   - Test: `curl https://tua-app.replit.dev/api/email/webhook`
   - Deve rispondere (anche con errore 400 è ok, significa che è raggiungibile)

3. **Controlla log SendGrid**:
   - Vai su **Activity** nel dashboard SendGrid
   - Cerca le email inviate a `commesse@tuodominio.it`
   - Verifica eventuali errori di delivery

4. **Log applicazione**: Controlla i log del server per errori del webhook

### Email inviate non funzionano

1. **Testa SMTP**: Usa l'endpoint `/api/email/test`
2. **Verifica API Key**: Controlla che `SENDGRID_API_KEY` sia corretta
3. **Email mittente verificata**: L'indirizzo `EMAIL_FROM` deve essere verificato su SendGrid
4. **Quota SendGrid**: Account free ha limiti (100 email/giorno)

### AI non riconosce i progetti

1. **Codici progetto**: Assicurati di usare codici standard nell'oggetto o corpo email
2. **API Anthropic**: Verifica che `ANTHROPIC_API_KEY` sia configurata
3. **Log analisi**: Controlla i log del server per vedere il risultato dell'analisi AI

### Confidenza AI sempre bassa

- Includi codice progetto esplicito: `[CODICE-PROGETTO]`
- Menziona il nome del cliente
- Usa gli stessi termini presenti nella descrizione del progetto
- Rispondi a thread email esistenti invece di crearne di nuovi

## Sicurezza

### Validazione Webhook

Il webhook accetta richieste da qualsiasi fonte. Per produzione, considera:

1. **IP Whitelist**: Limita accesso solo agli IP di SendGrid
   ```javascript
   const SENDGRID_IPS = ['167.89.0.0/17', '167.89.118.0/23', ...];
   ```

2. **Webhook Signature**: SendGrid può firmare le richieste
   - Vai su **Settings** > **Inbound Parse** > **Edit**
   - Abilita "Signed Webhook"
   - Verifica la firma nel webhook

### Privacy Email

- Le email vengono salvate nel database (campo `emailRaw`, `emailHtml`, `emailText`)
- Per GDPR: considera di non salvare `emailRaw` o criptarlo
- Configura retention policy per eliminare vecchie email

### Credenziali

- **NON committare** le API key nel codice
- Usa sempre variabili d'ambiente
- Ruota le API key periodicamente

## Costi

- **SendGrid Free Tier**: 100 email/giorno gratis
- **Essential Plan ($19.95/mese)**: 50,000 email/mese
- **Anthropic Claude**: Analisi AI costa circa $0.001 per email (modello Haiku)

## Funzionalità Future

Possibili miglioramenti:
- [ ] Supporto allegati email
- [ ] Integrazione Gmail API diretta (senza forwarding)
- [ ] Template email predefiniti
- [ ] Risposte automatiche basate su AI
- [ ] Thread email collegati
- [ ] Sincronizzazione bidirezionale con client email

## Supporto

Per problemi o domande:
1. Verifica questa documentazione
2. Controlla i log del server e di SendGrid
3. Testa con l'endpoint `/api/email/test`
4. Consulta la documentazione SendGrid: https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
