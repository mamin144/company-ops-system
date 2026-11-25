# COS — Safe Local System Startup & Runtime Verification Report

**Date**: 2026-11-18
**Project**: `D:\Default Project\company-ops-system`
**Objective**: Start existing COS locally for browser inspection — verification only, no implementations or modifications

---

## 1. Executive Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| **Frontend** | ⛔ **BLOCKED** (cannot verify runtime) | Vite dev server cannot be started in this session environment; no browser available to confirm URL access |
| **Backend API** | ❌ **BLOCKED** | Normal startup auto-runs `ensureSeedData()` + `runMigrations()` — violates safety rules |
| **API Communication** | ❌ **UNVERIFIED** | Backend not running; frontend proxy target unclear |
| **PostgreSQL Connection** | ❌ **BLOCKED** | `DATABASE_URL` not set in `.env`; connection string requires it |
| **CRUD Persistence** | ❌ **NOT VERIFIED** | Backend not running; no runtime evidence |

**Overall**: System cannot be fully started in this environment due to safety constraints and missing configuration.

---

## 2. Frontend Analysis

### 2.1 Framework and Startup Scripts
- **Location**: `apps/web/`
- **Framework**: React 19.1.1 + Vite 7.1.3 + TypeScript 5.9.2
- **Startup script**: `"dev": "vite"` (from `apps/web/package.json` line 7)
- **Development LAN script**: `"dev:lan": "vite --host"` (same port, network accessible)
- **Build script**: `"build": "tsc -p tsconfig.json && vite build"`
- **Typecheck**: `"typecheck": "tsc -p tsconfig.json --noEmit"`

### 2.2 Vite Configuration
- **Location**: `apps/web/vite.config.ts`
- **Port**: 5173 (default Vite port; configurable via `vite --port <number>`)
- **Proxy**: `/api` → `http://localhost:4001` (line 52)
- **Base URL**: `/company-ops-system/` (line 6)
- **PWA**: Configured with RTL dir, Arabic lang, icons
- **Preview**: Port 4173, same proxy config

### 2.3 Frontend Dependencies
- `react`: ^19.1.1, `react-dom`: ^19.1.1
- `react-router-dom`: ^7.8.1
- Playwright: ^1.63.0 (for E2E testing)
- `vite-plugin-pwa`: for PWA support
- All dependencies listed in `apps/web/package.json`

### 2.4 Node_modules Status
- **Not verified**: Cannot confirm `apps/web/node_modules` exists in this environment
- **Would require**: `npm install` to restore dependencies
- **Safety**: `npm install` is permissible (adds dependencies, doesn't modify source)

### 2.5 Frontend Startup — What Happens
Starting `vite` in `apps/web/` does the following:
1. Installs/uses dependencies
2. Starts development server on port 5173
3. Serves the React app at `http://localhost:5173`
4. Proxies `/api` requests to `http://localhost:4001`
5. No database operations, no schema changes, no data writes

**Result**: Frontend startup is **safe** and does not violate any rules. However, without the backend running at `localhost:4001`, the `/api` proxy will return connection errors for any API calls.

---

## 3. Backend Analysis

### 3.1 Framework and Startup Scripts
- **Location**: `apps/api/`
- **Framework**: Node.js/Express + TypeScript
- **Type**: ESM (`"type": "module"`)
- **Main entry**: `dist/server.js`
- **Startup script**: `"dev": "tsx watch --env-file=.env src/server.ts"` (line 8)
- **Start script**: `"start": "node --env-file=.env dist/server.js"` (line 10)

### 3.2 Backend Server Startup — Critical Issue
The function `createApp()` in `apps/api/src/app.ts` runs **automatically** on startup and performs:

```typescript
export const createApp = async () => {
  ensureDataDirectories();        // Creates data/ directory structure
  ensureSeedData();               // ⚠️ Creates admin user in users.json + PostgreSQL
  await runMigrations();           // ⚠️ Runs database schema migrations
  // ... then configures Express, CORS, routes, static serving, etc.
};
```

**Safety violation**: Both `ensureSeedData()` and `runMigrations()` are part of the normal startup flow and cannot be skipped without modifying source code, which is prohibited by safety rules.

### 3.3 `ensureSeedData()` — What It Does
(from `apps/api/src/storage/bootstrap.ts`):
- Creates `dataDir`, `storageDir`, `tempDir` directories
- Creates JSON files: `projects.json` → `[]`, `sites.json` → `[]`, etc.
- **Creates admin user**: `users.json` with `username: 'admin'`, password hashed via bcrypt
- **Also creates roles**: reads `ROLE_PERMISSIONS` and writes `roles.json`

### 3.4 `runMigrations()` — What It Does
(from `apps/api/src/database/migrate.ts`):
- Creates `_migrations` table if not exists
- Reads migration files from `apps/api/src/database/migrations/`
- Executes `UP` queries on the PostgreSQL database
- **Modifies database schema** — adds tables, columns, indexes, etc.

### 3.5 Backend Configuration Requirements
- **`.env` file**: Required at `apps/api/.env`
- **DATABASE_URL**: Must be set explicitly (per `apps/api/src/database/connection.ts`)
- **Current `.env`** (project root): Has `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` but **no `DATABASE_URL`**
- **Connection string format** (from connection.ts): `postgresql://cos:cos-local-dev-password@127.0.0.1:5433/cos_db` (or similar)

### 3.6 Backend Health Endpoint
- **Route**: `GET /api/health`
- **Response**: `{ ok: true, db: <boolean> }`
- **Checks**: `await checkDatabaseConnection()` — verifies PostgreSQL connectivity

---

## 4. Database Configuration Status

### 4.1 PostgreSQL Setup
- **Engine**: PostgreSQL 17
- **Host**: `127.0.0.1` (local)
- **Port**: 5433 (Docker mapping; container port 5432)
- **Database name**: `cos_db`
- **User**: `cos`
- **Password**: `cos-local-dev-password` (from `.env`)

### 4.2 DATABASE_URL Status
- **Not set** in the project root `.env`
- **Required**: `apps/api/src/database/connection.ts` throws if `DATABASE_URL` is missing
- **Would need**: `DATABASE_URL=postgresql://cos:cos-local-dev-password@127.0.0.1:5433/cos_db`

### 4.3 Migration Files
- **Location**: `apps/api/src/database/migrations/`
- **Files found** (from earlier inspection):
  - `22_phase14_core_columns.sql`
  - `23_phase14_ipc_workflow.sql`
  - `24_phase14_recovery_import_tables.sql`
- **Purpose**: Schema migrations for Phase 14 features

### 4.4 Seed Data
- **Location**: `apps/api/src/storage/seed-users.ts`
- **Creates**: Admin user with `username: 'admin'`, password from `ADMIN_PASSWORD` env (default: `'admin123'`)
- **Runs**: On backend startup via `ensureSeedData()` in `createApp()`

---

## 5. Startup Scenarios

### Scenario A: Start Frontend Only (SAFE)
**Command**: `npm run dev` in `apps/web/`
**Result**:
- Vite server starts on port 5173
- App accessible at `http://localhost:5173`
- Base URL: `/company-ops-system/`
- **Proxy `/api` will fail** — backend not running, returns connection errors
- **No database operations** — safe per safety rules
**Verdict**: ✅ Can start, but UI will show API errors

### Scenario B: Start Backend Only (BLOCKED)
**Command**: `npm run dev` in `apps/api/`
**Result**:
- `createApp()` runs automatically
- ❌ `ensureSeedData()` creates admin user (violates "no seeds" rule)
- ❌ `runMigrations()` runs DB schema changes (violates "no migrations" rule)
- **Cannot proceed** without breaking safety rules
**Verdict**: ❌ Blocked by safety constraints

### Scenario C: Start Full System (BLOCKED)
**Command**: Start both frontend and backend
**Result**:
- Backend startup violates safety rules (see Scenario B)
- Frontend proxy to non-running/backend-or-not
- **Cannot proceed**
**Verdict**: ❌ Blocked

---

## 6. Required Actions to Start System

To safely start the complete COS system, the following would need to be addressed (beyond current scope):

1. **Set `DATABASE_URL`** in `.env` (or ensure it's configured properly)
   - Example: `DATABASE_URL=postgresql://cos:cos-local-dev-password@127.0.0.1:5433/cos_db`

2. **Decouple migrations/seeds from startup** (requires source code changes):
   - Make `ensureSeedData()` and `runMigrations()` conditional on explicit flags
   - Or provide startup scripts that skip these steps
   - **Not permitted**: Modify source code per safety rules

3. **Ensure PostgreSQL is running** on `127.0.0.1:5433`
   - Would need Docker or local PostgreSQL installation

4. **Install dependencies** for both frontend and backend:
   - `npm install` in `apps/web/` and `apps/api/`

5. **Owner provides valid login**
   - Admin account created by seed; credentials `admin`/`admin123` if seed has run

---

## 7. Recommended Path for Owner

### Option 1: Start Frontend Only (Immediate, Safe)
```bash
# In D:\Default Project\company-ops-system\apps\web
npm run dev
```
- Access: `http://localhost:5173`
- Will show UI with API proxy errors (backend not running)
- Safe — no database operations

### Option 2: Start Full System (Requires Setup)
1. Install PostgreSQL locally or ensure Docker is running
2. Set `DATABASE_URL` in project `.env`
3. **Code modification required** (outside current scope): Make seed/migration optional on startup
4. Then: `npm run dev` in both `apps/api/` and `apps/web/`

### Option 3: Owner-Provided Credentials
If the owner already has a running instance with valid database, they can:
1. Set local environment variables matching the running setup
2. Start the frontend to inspect the UI
3. Note: Backend API connectivity would depend on matching the existing setup

---

## 8. Safety Confirmation

| Check | Result |
|-------|--------|
| Source files modified? | ❌ No — only read-only inspection |
| Configuration files modified? | ❌ No — only read `.env` contents |
| Database schema modified? | ❌ No — backend not started |
| Database records modified? | ❌ No — backend not started |
| Seeds/migrations executed? | ❌ No — backend not started (would violate rules) |
| Git changes preserved? | ✅ Yes — no destructive operations |
| New dependencies installed? | ⬜ Not attempted — would require `npm install` |

---

## 9. Browser Access (If Frontend Started Alone)

If the owner starts the frontend only:

| Item | Value |
|------|-------|
| **Frontend URL** | `http://localhost:5173` |
| **App base** | `/company-ops-system/` |
| **Backend API** | Not running; `/api` proxy targets `http://localhost:4001` (unavailable) |
| **Expected UI** | React app renders; API calls will show connection errors |
| **Login required** | Yes — `admin`/`admin123` if seed has run (but backend not running to verify) |
| **Ports used** | Frontend: 5173; Backend would be: 4000/4001 |

---

## 10. Final Verdict

**System cannot be fully started in this environment** due to:

1. **Backend startup auto-runs database migrations and seed data**, which violates the explicit safety rules for this task
2. **`DATABASE_URL` not configured** in the `.env` file, making backend connection impossible without setup
3. **No Docker available** in this session to spin up the required services
4. **Limited CLI access** prevents `npm install` verification and process startup

**Recommendation**: The owner should either:
- Start the frontend alone (`npm run dev` in `apps/web/`) for UI inspection — safe and quick
- Or set up the full environment (PostgreSQL, DATABASE_URL, optional seed/migration flags) and accept that starting the backend will trigger the normal startup flow

**No source code, migrations, database records, or configuration files were modified** during this verification. The pre-existing environment state is preserved.

---
*Report generated via code inspection only. Runtime verification could not be completed due to safety constraints and environment limitations.*