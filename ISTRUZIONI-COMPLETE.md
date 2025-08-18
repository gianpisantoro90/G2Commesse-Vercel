# 🚀 G2 INGEGNERIA - ISTRUZIONI COMPLETE

## ✅ VERSIONE FUNZIONANTE E TESTATA

Questa è la versione definitiva del sistema G2 Ingegneria con tutte le funzionalità:

### 🎯 Caratteristiche Implementate
- ✅ **Persistenza dati locale** - I progetti vengono salvati permanentemente in `data/`
- ✅ **Codici commessa corretti** - Formato YY+CLIENT(3)+CITY(3)+NN (2 cifre)
- ✅ **Templates aggiornati** - LUNGO ampliato con 10 sezioni complete
- ✅ **Gestione stati commesse** - In Corso, Conclusa, Sospesa
- ✅ **Auto-routing file RISOLTO** - File originali conservati correttamente
- ✅ **Apertura browser automatica** - G2-START.bat apre Chrome/Edge automaticamente
- ✅ **AI Router** - Suggerimenti intelligenti per organizzazione file
- ✅ **Interfaccia italiana** - Completamente localizzata

## 📦 FILE PER L'AVVIO

### 🟢 **G2-START.bat** (CONSIGLIATO)
Il file principale che funziona sempre:
- ✅ **Apertura browser automatica**
- ✅ **Installazione dipendenze automatica**
- ✅ **Gestione errori completa**
```
Doppio click su: G2-START.bat
```

### Alternative disponibili:
- `AVVIA-G2-DEFINITIVO.bat` - Versione semplificata
- `AVVIA-LOCALE-WINDOWS.bat` - Versione con più controlli
- `INSTALLA-E-AVVIA.bat` - Per prima installazione completa

## 🔧 INSTALLAZIONE DA ZERO

### 1. Requisiti
- **Windows 10/11**
- **Node.js 18+** (scarica da https://nodejs.org se mancante)
- **4GB RAM minimo**
- **500MB spazio disco**

### 2. Installazione
1. Estrai tutti i file in una cartella (es: `C:\G2-Ingegneria\`)
2. Doppio click su `G2-START.bat`
3. Attendi l'installazione automatica (prima volta: 2-3 minuti)
4. **Il browser si aprirà automaticamente** dopo 3 secondi

### 3. Accesso
L'app si aprirà su: **http://localhost:5000** automaticamente

## 📂 STRUTTURA FILE

```
G2-Ingegneria/
├── data/                     # 💾 DATI PERSISTENTI (NON CANCELLARE!)
│   ├── projects.json         # Lista commesse
│   ├── clients.json          # Anagrafica clienti  
│   ├── file-routings.json    # Routing file
│   └── system-config.json    # Configurazioni
├── client/                   # Frontend React
├── server/                   # Backend Express
│   ├── storage-local.ts      # Sistema persistenza locale
│   └── index.ts             # Server principale
├── G2-START.bat             # 🚀 AVVIO PRINCIPALE
├── package.json             # Dipendenze progetto
└── README-LOCALE.md         # Documentazione
```

## 💾 BACKUP E RIPRISTINO

### Backup dei dati
1. Copia l'intera cartella `data/`
2. Salvala in un posto sicuro
3. Include tutti i progetti e clienti

### Ripristino
1. Sostituisci la cartella `data/` con quella del backup
2. Riavvia l'applicazione

### Reset completo
1. Elimina la cartella `data/`
2. L'app la ricreerà vuota al prossimo avvio

## 🛠️ RISOLUZIONE PROBLEMI

### "Node.js non trovato"
**Soluzione:**
1. Scarica Node.js LTS da https://nodejs.org
2. Installa con le opzioni predefinite
3. Riavvia il PC
4. Riprova con `G2-START.bat`

### "Porta 5000 già in uso"
**Soluzione:**
1. Il file BAT libera automaticamente la porta
2. Se persiste, riavvia il PC
3. Oppure cambia porta modificando il file

### "L'app non si avvia"
**Soluzione:**
1. Elimina la cartella `node_modules`
2. Rilancia `G2-START.bat`
3. Attendi la reinstallazione

### "I dati non si salvano"
**Soluzione:**
1. Verifica che esista la cartella `data/`
2. Controlla i permessi di scrittura
3. Esegui come Amministratore se necessario

## 📊 USO DEL SISTEMA

### Creazione Nuova Commessa
1. Click su "Nuova Commessa"
2. Inserisci i dati (cliente, città, oggetto)
3. Seleziona template (LUNGO o BREVE)
4. Il codice viene generato automaticamente
5. Click su "Crea" per salvare

### Formato Codici
- **25INVMIL01** = Anno 2025, Investire, Milano, commessa 01
- **25COMROM02** = Anno 2025, Comune, Roma, commessa 02

### Rinominazione File
1. Vai su "Routing"
2. Seleziona la cartella da rinominare
3. Click su "Rinomina in blocco"
4. I file avranno il prefisso del codice commessa

## ✅ VERIFICA FUNZIONAMENTO

Dopo l'avvio dovresti vedere:
```
[OK] Node.js: v20.x.x
[OK] Directory data trovata
[OK] Dipendenze gia' presenti
[OK] Porta 5000 liberata
[AVVIO] G2 Ingegneria in esecuzione...
[INFO] Apri browser su: http://localhost:5000
```

## 🎯 TEST RAPIDO

1. Avvia con `G2-START.bat`
2. Crea una commessa di test
3. Chiudi l'applicazione (Ctrl+C)
4. Riavvia con `G2-START.bat`
5. **La commessa deve essere ancora presente** ✅

## 📞 SUPPORTO

Se hai problemi:
1. Leggi i messaggi di errore nel terminale
2. Controlla che la cartella `data/` esista
3. Verifica di avere Node.js installato
4. Prova a eseguire come Amministratore

## 🎉 FUNZIONALITÀ COMPLETE

Il sistema ora include:
- ✅ Gestione commesse con codici automatici
- ✅ Persistenza dati locale garantita
- ✅ Template progetti configurabili
- ✅ Rinominazione file in blocco
- ✅ AI per suggerimenti routing
- ✅ Interfaccia web moderna
- ✅ Backup e ripristino facile
- ✅ Nessun database esterno richiesto

**VERSIONE TESTATA E FUNZIONANTE AL 100%**