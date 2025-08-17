# 🚀 Come Avviare G2 Ingegneria in Locale

## ✅ Soluzioni per il Problema dello Script che si Chiude

Il problema è risolto! Ora hai **4 diversi modi** per avviare la versione locale:

### 🎯 Opzione 1: AVVIO RAPIDO (Consigliato)
```
Doppio click su: AVVIA-G2-LOCALE.bat
```
**Vantaggi:**
- Interfaccia grafica migliorata
- Controlli automatici di sistema  
- Messaggi di errore chiari
- Non si chiude mai inaspettatamente

### 🔧 Opzione 2: Script Completo
```  
Doppio click su: start-local-simple.bat
```
**Vantaggi:**
- Controllo completo delle dipendenze
- Installazione automatica se necessario
- Diagnostica avanzata errori
- Creazione automatica cartella `data/`

### ⚡ Opzione 3: Avvio Veloce
```
Doppio click su: start-local.cmd
```
**Vantaggi:**
- Avvio ultra-rapido
- Interfaccia colorata
- Perfetto se tutto è già installato

### 💻 Opzione 4: Manuale (Terminale)
```bash
# Apri Prompt dei Comandi nella cartella del progetto
set NODE_ENV=local
npx tsx server/index.ts
```

## 🔍 Perché si Chiudeva Prima?

Il problema era:
1. **Variabile ambiente sbagliata** - Usava `development` invece di `local`
2. **Mancanza gestione errori** - Si chiudeva subito se c'erano problemi
3. **Nessun feedback** - Non mostrava cosa stava succedendo
4. **Directory mancante** - Non creava la cartella `data/`

## ✅ Cosa è Stato Risolto

- ✅ **Modalità locale attivata** - `NODE_ENV=local` impostato correttamente
- ✅ **Storage persistente** - I dati ora si salvano in `data/`  
- ✅ **Gestione errori** - Script non si chiude più inaspettatamente
- ✅ **Feedback visivo** - Mostra stato e messaggi chiari
- ✅ **Auto-creazione cartelle** - Crea `data/` automaticamente
- ✅ **Controlli sistema** - Verifica Node.js e dipendenze

## 🛠️ Se Ancora Non Funziona

### Problema: "Node.js non trovato"
**Soluzione:**
1. Scarica Node.js da: https://nodejs.org/
2. Installa la versione LTS (Long Term Support)  
3. Riavvia il computer
4. Riprova con uno degli script

### Problema: "Porta 5000 occupata"
**Soluzione:**
1. Apri Gestione Attività (Ctrl+Shift+Esc)
2. Cerca processi "node" o "tsx" e terminali  
3. Oppure riavvia il computer
4. Riprova

### Problema: "Permessi negati"
**Soluzione:**
1. Click destro sullo script → "Esegui come amministratore"
2. Oppure sposta la cartella del progetto in `C:\G2-Ingegneria\`
3. Assicurati che Windows Defender non blocchi l'app

### Problema: "Dipendenze mancanti"
**Soluzione:**
1. Apri Prompt dei Comandi nella cartella progetto
2. Digita: `npm install`
3. Attendi il completamento
4. Riprova con gli script

## 📂 Struttura Dati Locale

Dopo il primo avvio, vedrai:
```
G2-Ingegneria/
├── data/                    # 📁 I tuoi dati (IMPORTANTE!)
│   ├── projects.json        # Lista commesse  
│   ├── clients.json         # Clienti
│   ├── file-routings.json   # Routing file
│   └── system-config.json   # Configurazioni
└── AVVIA-G2-LOCALE.bat     # 🚀 Script di avvio
```

## 💾 Backup dei Dati

Per fare backup:
1. Copia l'intera cartella `data/`
2. Salvala in un posto sicuro
3. Per ripristinare, sostituisci la cartella `data/`

## 🎯 Verifica Funzionamento

Dopo l'avvio, dovresti vedere:
```
✅ Node.js trovato
✅ Directory 'data' creata  
🚀 Avvio G2 Ingegneria in modalità locale...
📁 I dati saranno salvati in: C:\...\data
🌐 L'app sarà disponibile su: http://localhost:5000
```

Vai su **http://localhost:5000** e crea un progetto di test per verificare che i dati persistano anche dopo aver chiuso e riaperto l'app!

## 🆘 Supporto Urgente

Se nessuna soluzione funziona:
1. Fai screenshot dell'errore
2. Controlla se hai Windows 10/11
3. Verifica spazio libero su disco (minimo 1GB)
4. Prova a spostare il progetto in `C:\G2-Ingegneria\`