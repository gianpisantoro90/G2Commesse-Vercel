# Deployment su Replit - Note Importanti

## Configurazione Attuale

Questa applicazione è **deployata su Replit**. Quando si effettuano modifiche al codice, prestare attenzione ai seguenti aspetti:

## ⚠️ Checklist Pre-Modifica

### 1. Package.json
- ✅ Non rimuovere i plugin Replit:
  - `@replit/vite-plugin-cartographer`
  - `@replit/vite-plugin-runtime-error-modal`
- ✅ Verificare che gli script siano compatibili:
  - `build`: deve usare `vite build` + `esbuild`
  - `start`: deve usare `cross-env NODE_ENV=production`
  - `dev`: deve usare `cross-env NODE_ENV=development`

### 2. Variabili d'Ambiente
Le seguenti variabili devono essere configurate su Replit (Secrets):
- `DATABASE_URL` - Connessione Neon Database
- `SESSION_SECRET` - Chiave sessione
- `ANTHROPIC_API_KEY` - API Claude (se usata)
- `ONEDRIVE_CLIENT_ID` - OAuth Microsoft
- `ONEDRIVE_CLIENT_SECRET` - OAuth Microsoft
- `ONEDRIVE_REDIRECT_URI` - Callback URL
- Altre variabili custom dell'app

### 3. Build Process
- ✅ Il comando `npm run build` deve completare senza errori
- ✅ Non aggiungere dipendenze che richiedono compilazione nativa complessa
- ✅ Verificare che le dipendenze TypeScript siano in `devDependencies`

### 4. Runtime
- ✅ Node.js version compatibile (verificare su Replit)
- ✅ Porta di ascolto configurabile via `PORT` env var
- ✅ Non hardcodare `localhost` - usare `0.0.0.0` per il binding

### 5. Database
- ✅ Usare Neon Database (PostgreSQL serverless)
- ✅ Le migrazioni devono essere eseguite manualmente
- ✅ Schema Drizzle deve essere sincronizzato con `db:push`

### 6. File Statici
- ✅ Build di Vite genera file in `dist/`
- ✅ Express serve i file statici correttamente
- ✅ PWA assets e manifest sono inclusi nel build

## 🚫 Cosa NON Fare

1. **Non modificare** il file `.replit` senza testare
2. **Non rimuovere** `cross-env` (necessario per Windows/Linux compatibility)
3. **Non usare** path assoluti hardcodati
4. **Non committare** file `.env` con secrets
5. **Non aggiungere** dipendenze con binari nativi complessi

## ✅ Best Practices

1. **Testare localmente** prima del push
2. **Verificare il build** con `npm run build`
3. **Controllare le dipendenze** prima di aggiungerle
4. **Documentare** nuove variabili d'ambiente
5. **Usare** feature flag per modifiche rischiose

## 📋 Deploy Workflow

1. Modifiche locali
2. `npm run build` - verifica build
3. `git add` + `git commit`
4. `git push` - push su GitHub
5. Replit auto-deploy (se configurato)
6. Verificare l'app su Replit

## 🔧 Troubleshooting Comuni

### Build Fails
- Verificare errori TypeScript
- Controllare dipendenze mancanti
- Verificare che tutti i file siano committati

### Runtime Errors
- Verificare variabili d'ambiente su Replit
- Controllare log del server
- Verificare connessione database

### Database Issues
- Controllare `DATABASE_URL` su Replit
- Eseguire `db:push` se schema è cambiato
- Verificare connessione Neon Database

---

**RICORDA**: Ogni modifica deve essere testata considerando l'ambiente Replit!
