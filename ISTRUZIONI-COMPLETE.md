# 🚀 G2 INGEGNERIA - MANUALE DI AVVIO

## ⚡ AVVIO RAPIDO

**Per avviare il sistema:**
1. Doppio click su `G2-START.bat`
2. Attendere 10-15 secondi
3. Il browser si aprirà automaticamente su http://localhost:5000

## 🎯 FUNZIONALITÀ PRINCIPALI

### Sistema Completo di Gestione Commesse
- **Dashboard completa** - Panoramica progetti e statistiche in tempo reale
- **Gestione progetti** - Creazione, modifica, eliminazione con codici automatici
- **Template autentici G2** - Strutture cartelle LUNGO e BREVE originali
- **Auto-routing intelligente** - AI per organizzazione automatica file
- **File System API** - Spostamento reale dei file nelle cartelle di destinazione
- **Persistenza database** - Dati salvati permanentemente su PostgreSQL

### Caratteristiche Tecniche
- **Logo G2 autentico** - Branding ufficiale G2 Ingegneria
- **Codici commessa YY+SIGLA+CITTÀ+NN** - Formato standardizzato G2
- **Stati progetto** - In Corso, Conclusa, Sospesa con badge colorati
- **Scansione ricorsiva** - Rinomina file in tutte le sottocartelle
- **Template completi** - LUNGO con 10 sezioni, BREVE con 4 sezioni essenziali

## 🔧 REQUISITI SISTEMA

### Minimi
- **Windows 10/11** o **macOS** o **Linux**
- **Node.js 18+** (installazione automatica se mancante)
- **2GB RAM disponibili**
- **200MB spazio disco**
- **Browser moderno** (Chrome, Firefox, Edge, Safari)

### Per funzionalità complete
- **File System Access API** - Chrome/Edge per spostamento file diretto
- **Connessione internet** - Per AI routing e aggiornamenti database

## ⚙️ CONFIGURAZIONE AUTOMATICA

Il file `G2-START.bat` gestisce automaticamente:
- **Controllo Node.js** - Verifica versione installata
- **Installazione dipendenze** - NPM install se necessario
- **Creazione directory dati** - Cartella `data/` per persistenza locale
- **Rilevamento porta** - Usa PORT ambiente o default 5000
- **Avvio server** - Express + Vite development server
- **Apertura browser** - Automatica dopo 3 secondi

## 🗄️ PERSISTENZA DATI

### Database PostgreSQL (Produzione)
- **Connessione Neon** - Database cloud per ambiente produzione
- **Backup automatico** - Gestito da Neon Database
- **Sincronizzazione** - Dati condivisi tra sessioni

### Storage Locale (Sviluppo)
- **File JSON** - Backup in cartella `data/` per sviluppo locale
- **Progetti persistenti** - Mantenuti tra riavvii applicazione
- **Clienti persistenti** - Registry clienti permanente

## 📁 STRUTTURA PROGETTO PULITA

```
G2-Ingegneria/
├── G2-START.bat           # 🚀 FILE PRINCIPALE DI AVVIO
├── client/                # 💻 Frontend React + TypeScript
├── server/                # 🔧 Backend Express + API
├── shared/                # 📋 Schemi database condivisi
├── attached_assets/       # 🖼️ Logo e template di riferimento
├── templates/             # 📂 Strutture cartelle LUNGO/BREVE
├── data/                  # 💾 Dati persistenti (creata automaticamente)
├── package.json           # 📦 Dipendenze Node.js
└── replit.md             # 📖 Documentazione tecnica

Rimossi file obsoleti:
- ❌ AVVIA-*.bat (multipli script ridondanti)
- ❌ README-*.md (manuali obsoleti)
- ❌ start-*.* (script alternativi non più necessari)
- ❌ MODELLI*.zip (sostituiti da templates/)
```

## 🚀 TEMPLATE CARTELLE

### LUNGO (Progetti Complessi)
```
1_CONSEGNA/
2_PERMIT/
3_PROGETTO/
├── ARC/                   # Architettonico
├── CME/                   # Impianti elettrici
├── CRONO_CAPITOLATI_MANUT/
├── IE/                    # Impianti elettrici
├── IM/                    # Impianti meccanici
├── IS/                    # Impianti speciali
├── REL/                   # Relazioni
├── SIC/                   # Sicurezza
├── STR/                   # Strutturale
└── X_RIF/                 # Riferimenti

4_MATERIALE_RICEVUTO/
5_CANTIERE/
├── 0_PSC_FE/              # Piano sicurezza
└── IMPRESA/
    ├── CONTRATTO/
    ├── CONTROLLI/
    └── DOCUMENTI/

6_VERBALI_NOTIFICHE_COMUNICAZIONI/
├── COMUNICAZIONI/
├── NP/                    # Notifiche preliminari
├── ODS/                   # Osservazioni
└── VERBALI/

7_SOPRALLUOGHI/
8_VARIANTI/
9_PARCELLA/
10_INCARICO/
```

### BREVE (Progetti Semplici)
```
CONSEGNA/
ELABORAZIONI/
MATERIALE_RICEVUTO/
SOPRALLUOGHI/
```

## ⚠️ RISOLUZIONE PROBLEMI

### Il browser non si apre
1. Aprire manualmente http://localhost:5000
2. Verificare che il server sia avviato (messaggio "G2 Ingegneria avviato con successo!")

### Porta già in uso
- Il sistema rileva automaticamente la porta e libera 5000
- Se persiste: riavviare computer o usare G2-START.bat

### Node.js mancante
1. Scaricare da https://nodejs.org (versione LTS)
2. Installare e riavviare
3. Eseguire nuovamente G2-START.bat

### File non si spostano
- Usare Chrome o Edge per File System Access API completo
- In altri browser: scaricamento + spostamento manuale

## 🔄 AGGIORNAMENTI

Il sistema è completo e testato. Per supporto tecnico:
- Verificare versioni: Node.js 18+, Browser aggiornato
- Controllare log nella console del G2-START.bat
- Memoria disponibile: minimo 2GB RAM

## 📞 SUPPORTO

Sistema sviluppato per G2 Ingegneria con:
- Autenticazione logo e template ufficiali
- Integrazione completa File System API
- Database PostgreSQL per produzione
- Interfaccia completamente italiana

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