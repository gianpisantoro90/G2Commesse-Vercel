# Script PowerShell per avviare G2 Ingegneria su Windows
Write-Host "=== G2 Ingegneria - Sistema Gestione Commesse ===" -ForegroundColor Cyan
Write-Host "Controllo dipendenze..." -ForegroundColor Yellow

# Verifica Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRORE: Node.js non trovato. Scarica da https://nodejs.org" -ForegroundColor Red
    Read-Host "Premi Enter per uscire"
    exit 1
}

# Verifica npm
try {
    $npmVersion = npm --version
    Write-Host "npm: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRORE: npm non trovato" -ForegroundColor Red
    Read-Host "Premi Enter per uscire"
    exit 1
}

# Installa dipendenze se necessario
if (-not (Test-Path "node_modules")) {
    Write-Host "Installazione dipendenze..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRORE: Installazione fallita" -ForegroundColor Red
        Read-Host "Premi Enter per uscire"
        exit 1
    }
}

# Trova porta disponibile
$port = 3000
do {
    $portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($portInUse) {
        $port++
        if ($port -gt 3010) {
            Write-Host "ERRORE: Nessuna porta disponibile" -ForegroundColor Red
            Read-Host "Premi Enter per uscire"
            exit 1
        }
    }
} while ($portInUse)

Write-Host ""
Write-Host "Avvio server su porta $port..." -ForegroundColor Green
Write-Host "URL: http://localhost:$port" -ForegroundColor Cyan
Write-Host "Premi Ctrl+C per fermare" -ForegroundColor Yellow
Write-Host ""

# Configura variabili ambiente
$env:NODE_ENV = "development"
$env:PORT = $port

# Avvia applicazione
npx tsx server/index.ts