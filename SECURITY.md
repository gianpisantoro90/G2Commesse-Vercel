# Security Implementation Guide

## Modifiche di Sicurezza Implementate

Questa applicazione ha implementato le seguenti misure di sicurezza critiche secondo le best practices OWASP e le linee guida di sicurezza moderne.

---

## 1. Session Management Sicura

### Implementato:
- **Session Secret obbligatorio**: Minimo 32 caratteri, generato con `crypto.randomBytes(32)`
- **Session ID rinominato**: Da `connect.sid` a `sessionId` per oscurare la tecnologia
- **Session timeout ridotto**: Da 24 ore a 30 minuti
- **Session regeneration**: Nuovo session ID dopo ogni login (previene session fixation)
- **Cookie sicuri**:
  - `httpOnly: true` - Previene XSS
  - `sameSite: 'strict'` - Previene CSRF
  - `secure: true` in produzione - Solo HTTPS
  - `rolling: true` - Estende sessione ad ogni richiesta

### File modificati:
- `server/index.ts` (linee 52-65)
- `server/routes.ts` (linee 97-114)

---

## 2. Rate Limiting

### Implementato:
- **Login rate limiting**: Max 5 tentativi ogni 15 minuti per IP
- **API rate limiting**: Max 100 richieste/minuto per IP
- **Upload rate limiting**: (da implementare) Max 20 upload/ora

### File modificati:
- `server/index.ts` (linee 40-47)
- `server/routes.ts` (linee 9-17, 66)

---

## 3. Security Headers (Helmet)

### Implementato:
- **Content Security Policy (CSP)**
- **HSTS** - Force HTTPS (1 anno)
- **X-Content-Type-Options: nosniff**
- **X-Frame-Options: deny** (previene clickjacking)
- **Referrer-Policy**: strict-origin-when-cross-origin

### File modificati:
- `server/index.ts` (linee 17-38)

---

## 4. Logging Sicuro

### Implementato:
- **Nessun logging di credenziali**
- **Nessun logging di dati sensibili** (token, API keys)
- **Endpoint sensibili protetti**: `/api/auth/login`, `/api/auth/logout`, ecc.
- **Logging condizionale**: Dettagli solo in development, messaggi generici in production

### File modificati:
- `server/index.ts` (linee 67-108)
- `server/routes.ts` (linea 84-86)

---

## 5. Error Handling Sicuro

### Implementato:
- **Nessun stack trace in produzione**
- **Messaggi generici per errori 5xx** in produzione
- **Logging dettagliato server-side**
- **Timestamp su tutti gli errori**

### File modificati:
- `server/index.ts` (linee 113-136)

---

## 6. Environment Variables

### Configurazione richiesta:

```bash
# .env.local

# Authentication (OBBLIGATORIO)
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_strong_password_min_12_chars

# Session Secret (OBBLIGATORIO - min 32 caratteri)
# Genera con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your_generated_secret_here

# Environment
NODE_ENV=local  # o 'production'
PORT=3000
```

### Generare SESSION_SECRET sicuro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. Password Policy (da implementare)

### Raccomandazioni per implementazione futura:

```typescript
import bcrypt from 'bcrypt';

// Hashing password
const hashedPassword = await bcrypt.hash(password, 10);

// Validazione password
const passwordSchema = z.string()
  .min(12, 'Minimo 12 caratteri')
  .regex(/[A-Z]/, 'Almeno una maiuscola')
  .regex(/[a-z]/, 'Almeno una minuscola')
  .regex(/[0-9]/, 'Almeno un numero')
  .regex(/[^A-Za-z0-9]/, 'Almeno un simbolo');
```

---

## Checklist Pre-Produzione

Prima di deployare in produzione, verificare:

- [ ] `SESSION_SECRET` configurato (min 32 caratteri)
- [ ] `AUTH_PASSWORD` forte (min 12 caratteri, mix caratteri)
- [ ] `NODE_ENV=production` impostato
- [ ] HTTPS abilitato (certificato SSL valido)
- [ ] Rate limiting configurato
- [ ] Logging configurato senza dati sensibili
- [ ] Backup regolari del database
- [ ] Monitoraggio errori attivo (es. Sentry)
- [ ] Firewall configurato
- [ ] File `.env.local` nel `.gitignore`

---

## Testing Sicurezza

### Test locali:

```bash
# 1. Verifica TypeScript compilation
npx tsc --noEmit

# 2. Testa vulnerabilità dipendenze
npm audit

# 3. Fix vulnerabilità automatiche
npm audit fix

# 4. Testa rate limiting login
# Esegui 6 tentativi di login rapidi - il 6° deve fallire con 429

# 5. Verifica security headers
curl -I http://localhost:3000
# Controlla presenza:
# - Strict-Transport-Security
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
```

### Vulnerabilità risolte:

✅ **CRITICAL-1**: Hardcoded credentials → Spostate in `.env` con warning
✅ **CRITICAL-2**: Session insicura → Session sicura con regeneration
✅ **CRITICAL-3**: Logging credenziali → Rimosso completamente
✅ **HIGH-4**: CSRF mancante → `sameSite: 'strict'` implementato
✅ **HIGH-5**: Rate limiting mancante → Implementato su login e API
✅ **MEDIUM-9**: Security headers mancanti → Helmet configurato

---

## Riferimenti

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)

---

## Support

Per problemi di sicurezza, contattare: security@g2ingegneria.com

**Ultimo aggiornamento**: 2025-10-17
