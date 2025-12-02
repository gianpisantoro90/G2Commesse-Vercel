# Deploy su Vercel + Turso (GRATIS)

Questa guida ti permette di deployare G2 Gestione Commesse a **€0/mese**.

## Stack

- **Frontend**: React PWA su Vercel (gratis)
- **Backend**: Vercel Serverless Functions (gratis)
- **Database**: Turso SQLite Edge (gratis - 9GB)

## Prerequisiti

1. Account [Vercel](https://vercel.com) (gratuito)
2. Account [Turso](https://turso.tech) (gratuito)
3. [Turso CLI](https://docs.turso.tech/cli/introduction) installato

## Step 1: Crea Database Turso

```bash
# Installa Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Crea database
turso db create g2-commesse

# Ottieni URL e token
turso db show g2-commesse --url
turso db tokens create g2-commesse
```

Salva:
- `TURSO_DATABASE_URL`: l'URL che inizia con `libsql://`
- `TURSO_AUTH_TOKEN`: il token generato

## Step 2: Deploy su Vercel

### Opzione A: Via CLI

```bash
# Installa Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

### Opzione B: Via GitHub

1. Pusha il codice su GitHub
2. Vai su [vercel.com/new](https://vercel.com/new)
3. Importa il repository
4. Configura le environment variables (vedi sotto)
5. Deploy!

## Step 3: Configura Environment Variables

Nel dashboard Vercel, vai in **Settings > Environment Variables** e aggiungi:

| Variable | Valore | Note |
|----------|--------|------|
| `TURSO_DATABASE_URL` | `libsql://...` | URL database Turso |
| `TURSO_AUTH_TOKEN` | `eyJ...` | Token Turso |
| `SESSION_SECRET` | `openssl rand -hex 32` | Minimo 32 caratteri |
| `NODE_ENV` | `production` | |

### Opzionali (per funzionalità extra)

| Variable | Per cosa serve |
|----------|----------------|
| `ANTHROPIC_API_KEY` | AI email analysis |
| `MICROSOFT_CLIENT_ID` | OneDrive integration |
| `IMAP_HOST`, `IMAP_USER`, etc. | Email polling |

## Step 4: Inizializza Database

Dopo il primo deploy, inizializza le tabelle:

```bash
# Localmente, con le variabili Turso settate
npm run turso:init
```

## Step 5: Migra i Dati (se hai dati esistenti)

Se hai già dati su Neon/PostgreSQL:

```bash
# Setta entrambe le variabili
export DATABASE_URL="postgresql://..." # Neon
export TURSO_DATABASE_URL="libsql://..." # Turso
export TURSO_AUTH_TOKEN="..."

# Esegui migrazione
npm run db:migrate-turso
```

## Verifica Deploy

1. Vai all'URL del tuo progetto Vercel
2. Dovresti vedere la pagina di login
3. Crea il primo utente admin:
   ```bash
   npm run db:migrate-user
   ```

## Costi

| Servizio | Piano | Costo |
|----------|-------|-------|
| Vercel | Hobby | €0/mese |
| Turso | Starter | €0/mese (9GB) |
| **Totale** | | **€0/mese** |

## Limiti Free Tier

### Vercel Hobby
- 100GB bandwidth/mese
- 100GB-hours serverless
- Unlimited deployments

### Turso Starter
- 9GB storage
- 500M rows read/mese
- 25K databases

Per un'app aziendale interna, questi limiti sono più che sufficienti.

## Troubleshooting

### "Database not available"
- Verifica `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`
- Controlla che il database Turso sia attivo

### "Session error"
- Verifica che `SESSION_SECRET` sia settato (minimo 32 caratteri)

### Build fallisce
- Controlla i log in Vercel dashboard
- Verifica che tutte le dipendenze siano installate

## Supporto

Per problemi, apri un issue su GitHub.
