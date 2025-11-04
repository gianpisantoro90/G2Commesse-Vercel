# 📋 Checklist Sviluppo G2 Gestione Commesse

## ⚠️ REMINDER CRITICI PRIMA DI OGNI MODIFICA

### 🔴 **IMPORTANTE - DATABASE IN PRODUZIONE**
- ✋ Il database **Neon PostgreSQL** è in **PRODUZIONE**
- ✋ `npm run db:push` modifica **DIRETTAMENTE** il database live
- ✋ Ogni `git push` viene **automaticamente deployato su Replit**

---

## ✅ CHECKLIST PRE-MODIFICA

### Prima di Modificare il Database
- [ ] **Backup del database** se la modifica è critica
- [ ] **Testare la migration localmente** prima
- [ ] **Solo aggiunte di colonne NULLABLE** per retrocompatibilità
- [ ] **Mai cancellare/modificare colonne esistenti** senza strategia di migrazione
- [ ] **Verificare che i dati esistenti** non vengano corrotti

### Prima di Modificare il Codice
- [ ] **Testare localmente** su `http://localhost:5000`
- [ ] **Verificare login** funzionante
- [ ] **Testare le funzionalità modificate**
- [ ] **Controllare la console** per errori
- [ ] **Verificare che le modifiche siano retrocompatibili**

### Prima di Git Push
- [ ] **Eseguire `npm run build`** (anche se da errore PWA, controllare che non ci siano errori di compilazione)
- [ ] **Verificare che tutti i test passino** (se presenti)
- [ ] **Rivedere le modifiche** con `git diff`
- [ ] **Commit message descrittivo** con tutte le modifiche
- [ ] **Ricordare che il push = deploy su Replit**

---

## 🗄️ DATABASE - Neon PostgreSQL

### Informazioni Connessione
- **Provider**: Neon (Serverless PostgreSQL)
- **Ambiente**: PRODUZIONE
- **DATABASE_URL**: `postgresql://neondb_owner:npg_n96VBGmHADqv@ep-crimson-rice-a4zlezg2.us-east-1.aws.neon.tech/neondb?sslmode=require`

### Comandi Database
```bash
npm run db:push        # ⚠️ Applica modifiche DIRETTAMENTE in produzione
npm run db:studio      # Apre Drizzle Studio per visualizzare/modificare dati
```

### Best Practices Database
1. **Aggiunte Safe**: Solo nuove colonne NULLABLE
2. **Modifiche Rischiose**: Rinominare/Cancellare colonne (serve migration strategy)
3. **Sempre Testare**: Prima in locale, poi in produzione
4. **Backup**: Esportare dati prima di modifiche importanti

---

## 🚀 DEPLOYMENT - Replit

### Processo Automatico
1. `git push` su GitHub
2. Replit rileva le modifiche
3. Rebuild automatico
4. Deploy in produzione

### Verifica Post-Deploy
- [ ] Controllare che l'app sia **raggiungibile**
- [ ] Verificare **login** funzionante
- [ ] Testare le **nuove funzionalità**
- [ ] Controllare i **log di Replit** per errori
- [ ] Verificare che **OneDrive** sia connesso (se necessario)

---

## 📁 STRUTTURA PROGETTO

### File Critici da Non Modificare Senza Attenzione
- `shared/schema.ts` - Schema database (ogni modifica va pushata)
- `server/db.ts` - Configurazione connessione database
- `drizzle.config.ts` - Configurazione Drizzle ORM
- `.env` - Variabili d'ambiente (MAI committare)

### Modifiche Safe
- `client/src/components/**` - Componenti React
- `client/src/pages/**` - Pagine
- `server/routes.ts` - Endpoint API (attenzione a breaking changes)
- `server/lib/**` - Librerie server

---

## 🔐 AUTENTICAZIONE

### Sistema Multi-Utente
- **Sessioni**: Express-session con PostgreSQL store
- **Rate Limiting**: 5 tentativi login / 15 minuti
- **Password**: Hashed con bcrypt
- **Cookie**: Secure, HttpOnly, SameSite

### Utenti Default
- Gestiti tramite database
- Creare con: `npm run db:migrate-user`

---

## 📊 TABELLE DATABASE PRINCIPALI

### `projects` - Commesse
- Codice, Cliente, Città, Oggetto, Anno, Template
- Fatturazione: fatturato, numeroFattura, dataFattura, importoFatturato
- Pagamenti: pagato, dataPagamento, importoPagato
- OneDrive: fsRoot, metadata

### `clients` - Clienti (AGGIORNATA)
- **Base**: sigla, name, projectsCount, createdAt
- **Anagrafica**: partitaIva, codiceFiscale, formaGiuridica
- **Indirizzo**: indirizzo, cap, city, provincia
- **Contatti**: email, telefono, pec
- **Amministrazione**: codiceDestinatario (SDI)
- **Referente**: nomeReferente, ruoloReferente, emailReferente, telefonoReferente
- **Altro**: note

### `onedrive_mappings` - Mappature OneDrive
- projectCode, oneDriveFolderId, oneDriveFolderName, oneDriveFolderPath

### `users` - Utenti Sistema
- username, email, fullName, passwordHash, role, active

---

## 🧪 TESTING

### Test Locali
```bash
npm run dev          # Server sviluppo
npm run build        # Build produzione (controlla errori)
npm test             # Esegui test (se presenti)
```

### Aree Critiche da Testare
- [ ] **Login/Logout**
- [ ] **Creazione nuova commessa**
- [ ] **Modifica cliente** (form con 4 tab)
- [ ] **Sincronizzazione conteggi** clienti
- [ ] **OneDrive** (se configurato)
- [ ] **Calcolo parcelle** DM 2016
- [ ] **Fatturazione** e pagamenti

---

## 🐛 DEBUGGING

### Log Files
- **Browser Console**: Errori client-side
- **Terminal Server**: `npm run dev` mostra log server
- **Replit Logs**: Console Replit per produzione

### Errori Comuni
1. **"Database connection failed"**: Verificare DATABASE_URL
2. **"OneDrive not connected"**: Normale in locale (serve REPL_IDENTITY)
3. **"Authentication failed"**: Verificare sessioni e cookie
4. **"Projects count mismatch"**: Usare "Sincronizza" in tabella clienti

---

## 🔄 SYNC & BACKUP

### Sincronizzazione Conteggi Clienti
```
Endpoint: POST /api/clients/sync-counts
UI: Pulsante "🔄 Sincronizza" in tabella clienti
```

### Backup Dati
- Esportare da Neon Console: https://console.neon.tech
- Oppure da Drizzle Studio: `npm run db:studio`

---

## 📝 NOTE AGGIUNTIVE

### Template Cartelle Commesse
- **LUNGO**: 10 cartelle principali con sottocartelle (progetti complessi)
- **BREVE**: 4 cartelle base (progetti semplici)
- Definiti in: `client/src/lib/file-system.ts`

### Calcolo Parcelle
- **DM 17/06/2016**: Calcolo ufficiale tariffe professionali ingegneria
- File: `client/src/lib/parcella-calculator-dm2016.ts`
- Tavole ufficiali: `client/src/lib/dm2016-tavole-ufficiali.ts`

### OneDrive Integration
- Configurazione: Pannello Sistema > OneDrive
- Root folder: Impostare cartella radice commesse
- Auto-routing: AI per instradamento automatico file

---

## 🚨 IN CASO DI EMERGENZA

### Rollback Veloce
```bash
git log --oneline -5           # Vedi ultimi commit
git revert HEAD                # Annulla ultimo commit
git push                       # Deploy rollback
```

### Database Corrotto
1. Accedere a Neon Console
2. Restore da backup più recente
3. O eseguire query di fix manualmente

### Server Down
1. Controllare Replit Console
2. Verificare log errori
3. Restart manuale se necessario
4. Controllare DATABASE_URL valida

---

## ✨ BEST PRACTICES

1. **Commit Frequenti**: Piccole modifiche incrementali
2. **Branch per Feature**: Usa branch per modifiche grosse
3. **Test Prima di Push**: Sempre testare localmente
4. **Messaggi Descrittivi**: Commit message chiari
5. **Documentare Modifiche**: Aggiorna questo file se necessario
6. **Retrocompatibilità**: Mantieni sempre compatibilità con dati esistenti
7. **Security First**: Mai committare credenziali o secret
8. **User Experience**: Testa sempre dal punto di vista utente

---

## 📞 CONTATTI & RISORSE

### Documentazione
- Neon PostgreSQL: https://neon.tech/docs
- Drizzle ORM: https://orm.drizzle.team
- React Query: https://tanstack.com/query
- Replit: https://replit.com/

### Repository
- GitHub: https://github.com/gianpisantoro90/G2GestioneCommesse

---

**Ultimo Aggiornamento**: 2025-11-04
**Versione**: 1.0.0
