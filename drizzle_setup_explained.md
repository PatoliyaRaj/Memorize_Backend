# Drizzle ORM — Production Setup Explained
**NeuroLearn Backend: PostgreSQL + Supabase Hybrid**

---

## What Was Fixed (7 Critical Issues)

### Bug 1 — Wrong Driver (`pg` → `postgres`)

| | Before | After |
|---|---|---|
| **Package** | `pg` (node-postgres) | `postgres` (postgres-js) |
| **Drizzle import** | `drizzle-orm/node-postgres` | `drizzle-orm/postgres-js` |

**Why this matters:**  
Drizzle's official docs say to use `postgres-js` for Supabase. The `pg` driver works for direct connections but causes issues with Supabase's Transaction Pooler mode. `postgres-js` is also lighter, faster, and the package Drizzle is most tested with.

---

### Bug 2 — Missing `prepare: false` (CRITICAL PRODUCTION CRASH)

```typescript
// BEFORE — would crash in Supabase Transaction Pool mode
const client = postgres(connectionString)

// AFTER — correct
const client = postgres(connectionString, {
  prepare: !isSupabase  // false for Supabase, true for local
})
```

**Why this matters:**  
Supabase's **Transaction Pooler** (port 6543) does NOT support PostgreSQL prepared statements. If `prepare: true` (the default), every query that postgres-js tries to prepare will throw:
```
ERROR: prepared statement "s1" already exists
```
This crashes production silently for many queries. Now it auto-detects the strategy and disables `prepare` only for Supabase.

---

### Bug 3 — `ensureSchemaCompatibility` Anti-Pattern (Dangerous)

The original `connection.ts` had raw `ALTER TABLE` and `CREATE TABLE IF NOT EXISTS` SQL running on **every server startup**:

```typescript
// BEFORE (BAD) — in connection.ts
const ensureSchemaCompatibility = async (client) => {
  await client.query('CREATE TABLE IF NOT EXISTS public.users (...)')
  await client.query('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ...')
  // ... 20+ raw SQL statements running EVERY boot
}
```

**Problems with this:**
1. It **bypasses Drizzle entirely** — migrations happen outside version control
2. `ALTER TABLE` on every boot adds 200-500ms startup time
3. It creates **schema drift** between the Drizzle schema file and real DB
4. If two server instances start simultaneously, you get race conditions
5. It made the `nodes` table have the wrong schema (old columns, not matching the plan)

**Fix:** Deleted entirely. Schema is managed by `npm run db:migrate` or `npm run db:push`. One command, tracked in version control.

---

### Bug 4 — `drizzle-orm` in `devDependencies` (Runtime Package)

```json
// BEFORE (WRONG)
"devDependencies": {
  "drizzle-orm": "^0.45.2"  // ❌ This is a RUNTIME dependency
}

// AFTER (CORRECT)
"dependencies": {
  "drizzle-orm": "^0.45.2"  // ✅
}
```

In production, `npm install --production` skips `devDependencies`. Your app would crash immediately in prod because Drizzle wouldn't be installed.

---

### Bug 5 — `drizzle.config.ts` Using Old `satisfies Config` Pattern

```typescript
// BEFORE (old pattern — satisfies is less type-safe)
export default { ... } satisfies Config;

// AFTER (official current pattern)
import { defineConfig } from 'drizzle-kit'
export default defineConfig({ ... });
```

`defineConfig` gives better autocompletion and catches errors at the config level before any migration runs.

---

### Bug 6 — Schemas Were Wrong / Old

The entire `users` table had `firstName`, `lastName`, `age`, `isActive` — which is a generic starter schema, not the NeuroLearn schema from your plan. The `nodes` table had `Id`, `Links`, `ImageUrl` (PascalCase, no `playlistId`, no `masteryLevel`).

**Fix:** Complete rewrite of all schemas to match the 15-table plan exactly.

---

### Bug 7 — `ignoreDeprecations: "6.0"` in tsconfig.json

```json
// BEFORE (causes TypeScript compile error)
"ignoreDeprecations": "6.0"

// AFTER — removed
```

This is not a valid TypeScript compiler option in the current version, causing `tsc --noEmit` to fail with error `TS5103`.

---

## How the Hybrid Setup Works

```
┌─────────────────────────────────────────────────────────────┐
│                     DB_STRATEGY env var                      │
│                                                              │
│   "local"    →  POSTGRES_URL  (localhost:5432)              │
│                 prepare: true  (prepared statements OK)      │
│                 SSL: disabled                                │
│                                                              │
│   "supabase" →  SUPABASE_DB_URL  (pooler.supabase.com:6543) │
│                 prepare: false  (Transaction pool, REQUIRED) │
│                 SSL: { rejectUnauthorized: false }           │
│                                                              │
│   "fallback" →  try local first, use supabase if no local   │
└─────────────────────────────────────────────────────────────┘
```

### Two Supabase Connection URLs

Supabase provides two types of connections:

| URL type | Port | Use for | Drizzle setting |
|---|---|---|---|
| **Direct** | 5432 | `drizzle-kit` migrations | `prepare: true` |
| **Transaction Pooler** | 6543 | Running app in production | `prepare: false` |

> **Rule:** Always use port **5432** for `db:push` / `db:migrate` commands.  
> Always use port **6543** for the running server (high concurrency, pooled).

---

## How Migration Flow Works

### Development (local PostgreSQL)

```bash
# 1. Change schema in src/db/schemas/users.ts

# 2. Preview what SQL Drizzle will generate (read-only)
npm run db:studio

# 3a. Push directly to local DB (no migration file, fast iteration)
npm run db:push

# 3b. OR: Generate a migration file (for production deployments)
npm run db:generate
# → creates drizzle/0001_xxx.sql

# 4. Apply the migration to local DB
npm run db:migrate
```

### Production (Supabase cloud)

```bash
# Set strategy to supabase
DB_STRATEGY=supabase

# Apply migrations to Supabase cloud
npm run db:migrate
```

> **Never use `db:push` in production** — it compares current schema and pushes directly, which can be destructive. Always use `db:generate` → `db:migrate` for production to have an auditable migration history.

---

## Schema Architecture (15 Tables)

```
users (auth identity)
  └── user_profiles (learning preferences, sleep schedule)
  └── baskets (broad field: "Computer Science")
        └── subjects (module: "Operating Systems")
              └── playlists (unit: "Unit 1 — Processes")
                    └── nodes (concept: "Deadlock") ← XY Flow canvas node
                          └── node_details (theory, refs, images — LAZY LOADED)
                          └── cards (FSRS flashcards, 1–5 per node)
                                └── card_states (FSRS state per user per card)
                                └── reviews (immutable audit trail)

nodes ──── edges ──── nodes  (can cross playlists, is_cross_playlist flag)

users
  └── study_sessions (one per study block)
  └── sleep_logs (nightly sleep data)
  └── pulse_queues (daily study queue generated by cron)
```

---

## Key Drizzle Patterns Used

### 1. Type-safe queries (no raw SQL)

```typescript
import { getDb } from '@/db';
import { nodes } from '@/db/schemas';
import { eq } from 'drizzle-orm';

// Fully typed — TypeScript knows the return type exactly
const db = getDb();
const result = await db
  .select()
  .from(nodes)
  .where(eq(nodes.playlistId, playlistId));
// result: Node[] — inferred from schema
```

### 2. Inferred types (no duplicate type definitions)

```typescript
// From schema — auto-generated
export type Node = typeof nodes.$inferSelect;    // SELECT result
export type NewNode = typeof nodes.$inferInsert; // INSERT input
```

### 3. Relations (Drizzle relational query)

```typescript
// Query node with its details and cards in one call
const node = await db.query.nodes.findFirst({
  where: eq(nodes.id, nodeId),
  with: {
    details: true,
    cards: true,
  },
});
```

### 4. Transactions (for atomic operations like card review)

```typescript
await db.transaction(async (tx) => {
  await tx.update(cardStates).set(updatedState).where(eq(cardStates.cardId, cardId));
  await tx.insert(reviews).values(reviewData);
});
```

---

## Sync vs Async DB Getter

```typescript
// server.ts — startup (async, initializes connection)
await initializeDatabase();

// route handlers / services (sync, safe after startup)
import { getDb } from '@/db';

export class SomeService {
  static async doSomething() {
    const db = getDb(); // ← throws if called before initializeDatabase()
    return await db.select().from(users);
  }
}
```

> **Rule:** Call `initializeDatabase()` once at startup in `server.ts`. Use `getDb()` everywhere else. Never call `getDatabase()` (async) in hot paths — it's only for lazy contexts.

---

## File Summary

| File | Purpose |
|---|---|
| `src/db/config.ts` | Reads env vars, resolves strategy and connection string |
| `src/db/connection.ts` | Creates postgres-js client + Drizzle instance, singleton |
| `src/db/schema.ts` | Re-exports all schemas (single import for Drizzle Kit) |
| `src/db/schemas/users.ts` | **All 15 tables** with relations and TypeScript types |
| `src/db/schemas/shared.ts` | `auditColumns` (createdAt, updatedAt with timezone) |
| `src/db/index.ts` | Public API surface — import from here everywhere |
| `drizzle.config.ts` | Drizzle Kit config (migration folder, schema path, dialect) |
| `drizzle/` | Auto-generated SQL migration files |
