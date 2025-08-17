# G2 Ingegneria - Sistema Gestione Commesse (Versione Locale)

## 📋 Caratteristiche Principali

✅ **Persistenza Dati Locale** - I dati sono salvati in file JSON nella cartella `data/`  
✅ **Nessun Database Richiesto** - Funziona senza connessioni esterne  
✅ **Codici Commessa Automatici** - Formato: YY + CLIENT(3) + CITY(3) + NN  
✅ **Templates Progetti** - LUNGO (complessi) e BREVE (semplici)  
✅ **Rinominazione File** - Aggiunta automatica prefissi commessa  
✅ **Interfaccia Italiana** - Completamente localizzata  

## 🚀 Avvio Rapido

### Opzione 1: Avvio Automatico (Windows)
```batch
# Doppio click su:
start-local.bat
```

### Opzione 2: Avvio Manuale
```bash
# Installa dipendenze (solo la prima volta)
npm install

# Avvia in modalità locale
npm run dev
# oppure
NODE_ENV=local npm run dev
```

L'applicazione sarà disponibile su: **http://localhost:5000**

## 📁 Struttura Dati Locali

```
G2-Ingegneria/
├── data/                    # Cartella dati (creata automaticamente)
│   ├── projects.json        # Lista commesse
│   ├── clients.json         # Anagrafica clienti
│   ├── file-routings.json   # Routing file AI
│   └── system-config.json   # Configurazioni sistema
├── client/                  # Frontend React
├── server/                  # Backend Express
├── shared/                  # Tipi TypeScript condivisi
└── start-local.bat         # Script avvio Windows
```

## 💾 Gestione Dati

### Backup Manuale
Copia l'intera cartella `data/` per fare il backup di tutti i progetti e clienti.

### Ripristino
Sostituisci la cartella `data/` con quella del backup per ripristinare i dati.

### Reset Completo
Elimina la cartella `data/` per iniziare da zero (l'app la ricreerà automaticamente).

## 🎯 Formato Codici Commessa

**Struttura**: `YYCLICIT`  
- **YY**: Anno (2 cifre)
- **CLI**: Cliente (3 caratteri)  
- **CIT**: Città (3 caratteri)
- **NN**: Numero progressivo (2 cifre)

**Esempi**:
- `25INVMIL01` - Anno 25, Investire, Milano, #01
- `25COMROM02` - Anno 25, Comune, Roma, #02

## 📂 Template Progetti

### LUNGO - Progetti Complessi
- 01_DOCUMENTI_GENERALI
- 02_PROGETTAZIONE (ARC, STR, IM, IE, IS, REL, CME, SIC)
- 03_CALCOLI
- 04_ELABORATI_GRAFICI
- 05_CORRISPONDENZA
- 06_VERBALI
- 07_SOPRALLUOGHI
- 08_VARIANTI
- 09_PARCELLA
- 10_INCARICO

### BREVE - Progetti Semplici
- CONSEGNA
- ELABORAZIONI
- MATERIALE_RICEVUTO
- SOPRALLUOGHI

## 🔧 Risoluzione Problemi

### L'app non si avvia
1. Verifica che Node.js sia installato: `node --version`
2. Installa dipendenze: `npm install`
3. Controlla che la porta 5000 sia libera

### I dati scompaiono
- ✅ **RISOLTO**: Ora i dati sono persistenti in `data/`
- Se il problema persiste, verifica i permessi della cartella `data/`

### Errori di permessi cartelle
Su Windows, esegui il terminale come Amministratore

### Reset configurazione
Elimina `data/system-config.json` per resettare le impostazioni

## 📋 Requisiti Sistema

- **Node.js**: v18 o superiore
- **Sistema**: Windows 10/11, macOS, Linux
- **RAM**: Minimo 4GB
- **Spazio**: 500MB per l'applicazione + spazio dati progetti

## 🆘 Supporto

Per problemi tecnici:
1. Controlla i log nella console
2. Verifica la cartella `data/` esista e sia scrivibile
3. Riavvia l'applicazione con `start-local.bat`

## 📊 Vantaggi Versione Locale

✅ **Nessuna connessione internet richiesta**  
✅ **Dati sempre sotto controllo locale**  
✅ **Velocità massima (no latenza rete)**  
✅ **Privacy totale (dati non escono dal PC)**  
✅ **Backup semplice (copia cartella)**