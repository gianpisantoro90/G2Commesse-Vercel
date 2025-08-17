# G2 Ingegneria - Guida Installazione Windows

## 📋 Requisiti
- Windows 10/11
- Node.js v18+ ([Scarica qui](https://nodejs.org))
- Git ([Scarica qui](https://git-scm.com/download/win))

## 🚀 Installazione Rapida

### Metodo 1: Script Automatico (Raccomandato)
1. Apri **PowerShell come Amministratore**
2. Esegui: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. Vai nella cartella del progetto
4. Esegui: `.\start-windows.ps1`

### Metodo 2: Prompt dei Comandi
1. Apri **Prompt dei Comandi**
2. Vai nella cartella del progetto  
3. Esegui: `start-windows.bat`

### Metodo 3: Manuale
```cmd
# Installa dipendenze
npm install

# Avvia l'applicazione
npx cross-env NODE_ENV=development PORT=3000 npx tsx server/index.ts
```

## 🔧 Risoluzione Problemi

### Errore "Porta già in uso" (EADDRINUSE/ENOTSUP)
**Causa**: La porta 5000 è spesso usata da altri servizi su Windows

**Soluzioni**:
1. **Usa una porta diversa**:
   ```cmd
   set PORT=3001
   npm run dev
   ```

2. **Trova processi sulla porta**:
   ```cmd
   netstat -ano | findstr :5000
   taskkill /PID [NUMERO_PID] /F
   ```

3. **Usa gli script Windows**: Esegui `start-windows.ps1` che trova automaticamente una porta libera

### Errore "NODE_ENV non riconosciuto"
**Soluzione**: Usa `cross-env` (già incluso):
```cmd
npx cross-env NODE_ENV=development tsx server/index.ts
```

### Errore "tsx non trovato"
**Soluzione**: Installa globalmente o usa npx:
```cmd
npm install -g tsx
# oppure
npx tsx server/index.ts
```

## 🌐 Accesso Applicazione
Dopo l'avvio, apri il browser su:
- `http://localhost:3000` (porta predefinita)
- La porta esatta sarà mostrata nel terminale

## 🆘 Supporto
Se i problemi persistono:
1. Verifica la versione Node.js: `node --version` (deve essere v18+)
2. Cancella node_modules: `rmdir /s node_modules` e reinstalla: `npm install`
3. Riavvia Windows e riprova

## 📁 Struttura Progetto
```
G2-Ingegneria/
├── client/          # Frontend React
├── server/          # Backend Express  
├── shared/          # Tipi condivisi
├── start-windows.*  # Script avvio Windows
└── README-WINDOWS.md # Questa guida
```