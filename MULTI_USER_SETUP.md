# Sistema Multi-Utente - Istruzioni Setup

## 🎯 Panoramica

È stato implementato un sistema di gestione utenti multilivello con due ruoli:
- **Amministratori (admin)**: Accesso completo a tutte le funzionalità
- **Utilizzatori (user)**: Accesso limitato a funzionalità specifiche

## 📋 Permessi per Ruolo

### 👑 Amministratori
- ✅ **Dashboard**: Visualizzazione completa (pannello economico, statistiche, progetti recenti, stato OneDrive)
- ✅ **Gestione**: Accesso a tutte le sezioni
  - Nuova Commessa
  - Commesse
  - Clienti
  - Risorse
  - KPI
  - Calcolatore Parcella
  - Scadenze
  - Comunicazioni
- ✅ **Auto-Routing**: Accesso completo
- ✅ **OneDrive Browser**: Accesso completo
- ✅ **Sistema**: Accesso completo (Gestione Utenti, Storage, AI Config, OneDrive Config)

### 👤 Utilizzatori
- ✅ **Dashboard**: Solo progetti recenti e stato OneDrive
- ✅ **Gestione**: Solo 3 sezioni
  - Commesse (visualizzazione/modifica)
  - Scadenze
  - Comunicazioni
- ❌ **Auto-Routing**: Non accessibile
- ❌ **OneDrive Browser**: Non accessibile
- ❌ **Sistema**: Non accessibile

## 🚀 Istruzioni Deployment su Replit

### 1. Push del Database Schema

Dopo il deploy su Replit, esegui questo comando per creare la tabella users nel database:

```bash
npm run db:push
```

Questo comando creerà la tabella `users` nel database PostgreSQL di Neon.

### 2. Migrazione Utente Iniziale

Per creare l'utente amministratore iniziale dal tuo account attuale (AUTH_USERNAME/AUTH_PASSWORD), esegui:

```bash
npm run db:migrate-user
```

Questo script:
- Legge le credenziali da `AUTH_USERNAME` e `AUTH_PASSWORD` nelle variabili d'ambiente
- Crea un utente admin nel database con quelle credenziali
- L'hash della password viene generato automaticamente con bcrypt

**Output atteso:**
```
🔄 Starting user migration...
📋 Found credentials for user: [tuo_username]
🔐 Hashing password...
👤 Creating admin user...
✅ SUCCESS! Admin user created:
   - Username: [tuo_username]
   - Email: [tuo_username]@g2ingegneria.local
   - Full Name: [Tuo_username]
   - Role: admin
   - Active: true

🎉 You can now login with your existing credentials!
```

### 3. Login e Gestione Utenti

1. **Accedi** all'applicazione con le tue credenziali esistenti
2. Vai su **Sistema → Utenti** (tab in alto a sinistra)
3. Clicca su **"+ Nuovo Utente"** per aggiungere altri utenti
4. Compila il form:
   - Username (es: mario.rossi)
   - Nome Completo (es: Mario Rossi)
   - Email
   - Password (minimo 8 caratteri)
   - Ruolo (Amministratore o Utilizzatore)
   - Utente attivo (checkbox)

### 4. (Opzionale) Rimuovere Credenziali Legacy

Dopo aver creato gli utenti nel database, puoi **opzionalmente** rimuovere le variabili d'ambiente `AUTH_USERNAME` e `AUTH_PASSWORD` dal file `.env` o dalle secrets di Replit.

**IMPORTANTE**: Il sistema mantiene un fallback alle variabili d'ambiente per retrocompatibilità, quindi puoi lasciarle se preferisci.

## 🔐 Sicurezza

Il sistema include le seguenti misure di sicurezza:

- ✅ Password hashate con bcrypt (10 rounds)
- ✅ Sessioni sicure con express-session
- ✅ Rate limiting su login (5 tentativi ogni 15 minuti)
- ✅ Sessioni rigenerazione per prevenire session fixation
- ✅ Cookie httpOnly e sameSite strict
- ✅ Validazione input con Zod
- ✅ Separazione ruoli con middleware

## 🎨 Nuove Funzionalità UI

### Visualizzazione Utente nell'Header
- Avatar con iniziale del nome
- Nome completo
- Ruolo (Amministratore/Utilizzatore)

### Pagina Gestione Utenti (Solo Admin)
- Lista completa utenti con ruolo e stato
- Creazione nuovi utenti
- Modifica ruolo utenti (da user ad admin e viceversa)
- Attivazione/disattivazione utenti
- Eliminazione utenti (non puoi eliminare te stesso)

### Filtri Visibilità
- Navigazione principale filtrata per ruolo
- Tab e sezioni nascoste per utilizzatori
- Dashboard semplificata per utilizzatori

## 🛠️ Comandi Disponibili

```bash
# Push schema database (crea tabella users)
npm run db:push

# Migra utente iniziale da env vars
npm run db:migrate-user

# Sviluppo
npm run dev

# Build produzione
npm run build

# Start produzione
npm run start

# Type checking
npm run check
```

## 📝 Note Tecniche

### Struttura Database
La tabella `users` ha la seguente struttura:
- `id` (UUID, primary key)
- `username` (text, unique, not null)
- `email` (text, unique, not null)
- `full_name` (text, not null)
- `password_hash` (text, not null)
- `role` ('admin' | 'user', default 'user')
- `active` (boolean, default true)
- `created_at` (timestamp, auto)
- `updated_at` (timestamp, auto)

### Endpoint API Nuovi
- `GET /api/users` - Lista utenti (admin only)
- `POST /api/users` - Crea utente (admin only)
- `PUT /api/users/:id` - Modifica utente (admin only)
- `DELETE /api/users/:id` - Elimina utente (admin only)
- `POST /api/users/change-password` - Cambio password (tutti)

### Modifiche Login
- Login ora supporta database-first authentication
- Fallback automatico a env vars per retrocompatibilità
- Sessione include: userId, username, fullName, role

## ❓ Troubleshooting

### "Cannot find module 'drizzle-kit'"
Esegui: `npm install` per installare tutte le dipendenze

### "DATABASE_URL not set"
Assicurati che la variabile d'ambiente `DATABASE_URL` sia configurata su Replit (dovrebbe essere già presente)

### "User already exists"
Lo script di migrazione controlla se l'utente esiste già. Se esiste, salta la migrazione.

### Login non funziona dopo migrazione
Verifica che:
1. La tabella users sia stata creata (`npm run db:push`)
2. L'utente sia stato migrato (`npm run db:migrate-user`)
3. Le credenziali siano corrette

## 📞 Support

Per problemi o domande, controlla:
1. I log del server per errori specifici
2. La console browser (F12) per errori frontend
3. Lo stato del database su Neon console

---

**Implementato da**: Claude Code
**Data**: $(date)
**Branch**: claude/implement-user-roles-011CUY3LL9mAkvCDdcjbGcvV
