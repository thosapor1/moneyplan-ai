# MoneyPlan AI — Architecture Guide (Clean Architecture, Junior-Friendly)

This project is being refactored toward **Clean Architecture** so it’s easier to:
- find code quickly,
- test business logic without the UI,
- change infrastructure (Supabase / IndexedDB / storage) with minimal impact,
- onboard junior developers safely.

> Goal: **dependencies point inward**  
> UI → Application → Domain  
> Infrastructure plugs in from the outside.

---

## 1) Big picture

### Layers (from outside to inside)

1. **Presentation** (`src/presentation/**`, plus Next routes in `app/**`)
   - React components, UI helpers, view-specific formatting
   - Reads user input, renders output
   - Calls application services/use-cases (not Supabase directly, ideally)

2. **Application** (`src/application/**`)
   - “What the app does” (workflows / use-cases)
   - Orchestrates domain rules + ports (interfaces)
   - No browser APIs, no Supabase imports

3. **Domain** (`src/domain/**`)
   - “Business rules” (pure calculations, entities/value types)
   - No Next/React, no Supabase, no IndexedDB, no `window`

4. **Infrastructure** (`src/infrastructure/**`)
   - “How we talk to the world”
   - Supabase client + queries, IndexedDB offline DB, localStorage, browser event bus, network status, etc.
   - Implements **ports** defined by application layer

---

## 2) Project layout (current)

Key directories:

- `app/**`  
  Next.js App Router pages/layout. This is the entry point for UI routes.

- `components/**`  
  Shared React components.

- `src/domain/**`  
  Pure logic:
  - `src/domain/finance/finance.ts`
  - `src/domain/period/period.ts`
  - `src/domain/forecast/forecast.ts`

- `src/application/**`  
  Use-cases / orchestration:
  - `src/application/sync/**` (ports + coordinator)

- `src/infrastructure/**`  
  External integrations:
  - `src/infrastructure/supabase/supabase.ts` (client + helpers)
  - `src/infrastructure/offline/offline-db.ts` (IndexedDB)
  - `src/infrastructure/storage/local-settings.ts` (localStorage)
  - `src/infrastructure/sync/**` (adapters + sync composition root)

- `lib/**`  
  **Compatibility layer** (legacy imports).  
  Most files in `lib/` are now **re-export shims** to the new `src/**` modules.
  - You should avoid adding new logic to `lib/**`.

---

## 3) Rules of thumb (for junior devs)

### ✅ Where should I put new code?

#### If it is **pure calculation / business rule**
Put it in **Domain**:
- `src/domain/...`
- No imports from `next/*`, `react`, `@supabase/*`, or browser globals.

Examples:
- budget calculations
- date/period calculations
- forecasting math

#### If it is a **workflow** (multi-step action)
Put it in **Application**:
- `src/application/...`
- Define interfaces (ports) for anything external (DB, auth, storage, network)
- Depends on domain modules

Examples:
- “Sync offline data when user comes back online”
- “Create transaction then update dashboard state”

#### If it talks to **Supabase / IndexedDB / localStorage / window / navigator**
Put it in **Infrastructure**:
- `src/infrastructure/...`
- Implement the port defined by application

Examples:
- Supabase queries
- IndexedDB read/write
- emitting `window` events
- `navigator.onLine` checks

#### If it returns **React nodes**, uses **Tailwind**, or is UI-only
Put it in **Presentation**:
- `src/presentation/...` (or `components/**`)
- Examples:
  - category icon render helpers
  - view formatting functions

---

## 4) Dependency direction (must not break)

### Allowed imports

- `src/domain/**`  
  ✅ can import: other domain modules, TypeScript utilities  
  ❌ must not import: `react`, `next/*`, `@supabase/*`, `window`, `localStorage`, IndexedDB

- `src/application/**`  
  ✅ can import: domain, application ports/types  
  ❌ must not import: Supabase client, IndexedDB, browser globals, React

- `src/infrastructure/**`  
  ✅ can import: application ports, domain types, external SDKs  
  ✅ can use: browser APIs (in browser-only modules)  
  ⚠️ should remain thin; avoid business logic here

- `app/**`, `components/**`, `src/presentation/**`  
  ✅ can import: application services/use-cases, domain helpers if truly UI needs them  
  ⚠️ try to avoid importing infrastructure directly (we’re migrating toward app → application)

---

## 5) The “lib/” directory policy

`lib/**` exists to keep the app stable during refactor.

### ✅ What `lib/**` should contain
- Re-exports to `src/**`
- Small backwards-compatible wrappers (temporary)

### ❌ What `lib/**` should NOT contain
- New business logic
- New infrastructure logic
- Complex services

If you need to implement something new, add it to `src/domain`, `src/application`, or `src/infrastructure`, then re-export from `lib/` only if necessary.

---

## 6) Example: Sync flow (offline → online)

### Application layer
- `src/application/sync/ports/sync-ports.ts`  
  Defines what the sync use-case needs:
  - session
  - offline store
  - backend persistence
  - network status
  - optional event bus

- `src/application/sync/sync-coordinator.ts`  
  Orchestrates the workflow:
  - checks online
  - prevents concurrent runs
  - waits for session with retries
  - syncs transactions/profile/forecasts
  - marks items as synced
  - emits `sync-complete`

### Infrastructure layer
- `src/infrastructure/sync/supabase-auth-session.ts`  
  Implements session retrieval via Supabase.

- `src/infrastructure/sync/supabase-backend-sync.ts`  
  Implements backend persistence via Supabase tables.

- `src/infrastructure/sync/offline-store-adapter.ts`  
  Wraps IndexedDB `offlineDB` as an application port.

- `src/infrastructure/sync/window-sync-event-bus.ts`  
  Emits `window` events for UI notifications.

- `src/infrastructure/sync/sync-service.ts`  
  Composition root: wires everything together and manages browser listeners.

### UI layer
- `components/ServiceWorkerRegistration.tsx` listens for:
  - `sync-complete` events to show a banner

---

## 7) Testing guidance

- Prefer testing **Domain** and **Application** because they are deterministic.
- Domain tests: pure functions (fast, no mocks).
- Application tests: mock ports (offline store, backend, auth) and assert orchestration behavior.
- Infrastructure tests are optional and usually heavier (integration-style).

---

## 8) Adding a new feature (recommended steps)

1. **Start in domain**: define the calculation/model you need (pure)
2. **Add application use-case**: define ports needed and orchestrate steps
3. **Add infrastructure adapters**: implement the ports (Supabase/IndexedDB/etc)
4. **Wire it up**: composition root (in infrastructure) exports a stable API
5. **UI calls application**: keep React components thin

---

## 9) Glossary

- **Use-case**: a user-facing action/workflow (application layer)
- **Port**: an interface defined by application layer describing what it needs
- **Adapter**: an infrastructure implementation of a port
- **Composition root**: where you create concrete implementations and wire dependencies together

---

## 10) Quick “Where does this go?” checklist

- Does it use `window`, `navigator`, `localStorage`, IndexedDB? → `src/infrastructure/**`
- Does it import `@supabase/supabase-js` or call `.from('table')`? → `src/infrastructure/**`
- Is it a multi-step process that coordinates several things? → `src/application/**`
- Is it pure math / classification / forecasting? → `src/domain/**`
- Does it return React components / icons / JSX? → `src/presentation/**` or `components/**`

---

## 11) Current migration status

✅ Domain moved: finance / period / forecast  
✅ Infrastructure moved: supabase / offline-db / local settings / sync adapters  
✅ `lib/**` mostly converted to re-export shims  
➡️ Next suggested: gradually update imports in `app/**` and `components/**` to import from `src/**` directly (optional, incremental)

---