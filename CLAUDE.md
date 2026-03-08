# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

G2 Gestione Commesse is a full-stack project/commission management system for G2 Engineering (Italian). It features AI-powered email processing, OneDrive integration, billing automation, CRE document generation, and project tracking.

## Commands

```bash
npm run dev              # Start dev server (Express + Vite HMR) on port 5000
npm run build            # Production build (Vite frontend + esbuild server)
npm run start            # Run production build
npm run check            # TypeScript type checking (tsc --noEmit)
npm run db:push          # Push Drizzle schema changes to PostgreSQL
npm test                 # Run Vitest in watch mode
npm run test:ui          # Vitest interactive UI
npm run test:coverage    # Single run with coverage report
```

Run a single test file: `npx vitest run client/src/lib/__tests__/retry-utils.test.ts`

## Architecture

### Monorepo Structure

- **`client/`** - React 18 frontend (Vite build, served from `dist/public`)
- **`server/`** - Express.js API backend (esbuild to `dist/index.js`)
- **`shared/`** - Shared types and Drizzle ORM schema (`schema.ts` is the single source of truth for DB types)
- **`migrations/`** - Drizzle Kit SQL migrations
- **`api/`** - Vercel serverless function entry points

### Path Aliases (in tsconfig.json and vite.config.ts)

- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`

### Backend

**Entry**: `server/index.ts` → Express app with Vite middleware in dev, static serving in prod.

**Routes**: `server/routes.ts` (~3600 lines) — all API endpoints in one file, organized by domain (auth, projects, clients, billing, communications, AI, OneDrive, CRE, etc.).

**Storage layer**: `server/storage.ts` — implements `IStorage` interface over Drizzle ORM. All DB access goes through this abstraction. There is also a `MemStorage` in-memory implementation.

**Database**: PostgreSQL via Neon serverless (`server/db.ts`). Alternative Turso/SQLite backend in `server/db-turso.ts`. Schema defined in `shared/schema.ts` using Drizzle ORM with `drizzle-zod` for automatic Zod insert schemas.

**Services** (in `server/lib/`):
- `email-service.ts` / `email-poller.ts` — IMAP polling + SMTP sending
- `ai-email-analyzer.ts` — Claude/DeepSeek AI for email analysis and project routing
- `onedrive-service.ts` — Microsoft Graph API integration with LUNGO/BREVE folder templates
- `billing-automation.ts` — Prestazioni sync, invoicing alerts, payment tracking
- `cre-generator.ts` — DOCX generation for Certificazione di Buona Esecuzione
- `notification-service.ts` — In-app + WebSocket notifications
- `logger.ts` — Structured logging with sensitive data redaction

**Middleware**: Helmet (CSP/HSTS), CORS, rate limiting (5/15min on login, 100/min on API), express-session with 30-min rolling cookies, centralized error handler (`server/middleware/error-handler.ts`) using custom `AppError` class.

**Auth**: Session-based with bcryptjs password hashing. Roles: `admin` and `user`. Middleware: `requireAuth`, `requireAdmin`.

### Frontend

**Router**: Wouter (lightweight, not React Router). Flat routing in `App.tsx`.

**State management**: TanStack React Query for server state (query keys map directly to API URLs, e.g. `queryKey: ["/api/projects"]`). Local state via React hooks. Persistent client state via `useLocalStorage`/`useEncryptedLocalStorage`/IndexedDB hooks.

**API calls**: `apiRequest(method, url, data)` in `client/src/lib/queryClient.ts` — wraps fetch with `credentials: "include"` for session cookies.

**UI components**: shadcn/ui (Radix UI + Tailwind CSS). Component files in `client/src/components/ui/`. Brand primary color: teal `#1B5B5A`.

**Pages**: `client/src/pages/` — Dashboard, LoginPage, ToDoPage, revisione-ai (AI review).

**Components**: Feature-organized in `client/src/components/` — `dashboard/`, `projects/`, `ai-review/`, `onedrive/`, `layout/`, `notifications/`, `system/`, `todo/`.

**Custom hooks**: `client/src/hooks/` — `useAuth`, `useNotifications` (WebSocket), `useOneDriveSync`, `useTheme`, `useMobile`, `useLocalStorage`, etc.

### Key Conventions

- All monetary amounts stored as **double precision** values in **euro** in the database
- Italian language used for domain terms (commessa, prestazione, fattura, pagamento, CRE, CIG, etc.)
- Zod schemas for all API input validation; types generated from Drizzle schema via `drizzle-zod`
- `shared/schema.ts` exports both table definitions and insert schemas — modify this file when changing the DB structure
- Project templates: `LUNGO` (complex 25+ folder structure) and `BREVE` (simple 4-folder structure) for OneDrive
- ESM throughout (`"type": "module"` in package.json)
- No ESLint/Prettier configured; TypeScript strict mode is the primary code quality check

### Deployment

- **Platform**: Vercel (uses `build:vercel` script, single serverless function in `api/index.js`)
- **Database**: Neon PostgreSQL (serverless, `DATABASE_URL` env var)
- **Cron Jobs**: Vercel Cron — `/api/cron/notifications` (every 15 min), `/api/cron/billing` (hourly), protected by `CRON_SECRET`
- **OneDrive**: OAuth2 client_credentials flow via `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`
- **Notifications**: Client-side polling (30s interval), no WebSocket in production
- `db:push` applies schema changes directly to the production Neon PostgreSQL database — use with caution
- Dev mode (`npm run dev`) still supports WebSocket notifications and background timers
