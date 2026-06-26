# Phase 2 — Wire Drizzle + Neon (dev-first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Drizzle + Neon foundation (single `pg` Pool client, zod-validated env, ID helper, relocated Better Auth schema) and apply a first migration to the Neon `develop` branch — without converting any application data access yet.

**Architecture:** One module-scope `pg` Pool (`drizzle-orm/node-postgres`) reused across requests (Vercel Fluid Compute); env validated at boot by a pure zod schema; Better Auth schema moved from `lib/` into `db/schema/**` so `drizzle-kit` (glob `./db/schema/**/*.ts`) and the shared client both see it. Migrations run against the **direct** (`DATABASE_URL_UNPOOLED`) connection on the **`develop`** branch only.

**Tech Stack:** Drizzle ORM 0.45 · drizzle-kit 0.31 · `pg` 8.21 · Neon Postgres 18 · Better Auth 1.6 · zod 4 · Vitest 4 · Bun.

---

## Prerequisites (verify before Task 1)

- On git branch `migration/drizzle-neon` (`git branch --show-current`).
- `.env.local` contains, non-empty: `DATABASE_URL` (Neon **pooled**, `-pooler`, **develop** branch), `DATABASE_URL_UNPOOLED` (Neon **direct**, develop branch), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (`http://localhost:3000`). `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` may stay empty until Phase 4.
- **Zscaler/SSL**: before any `drizzle-kit`/Neon command, ensure the corporate root CA is trusted, e.g. (PowerShell) `$env:NODE_EXTRA_CA_CERTS="C:\Users\samuel.pokam\AppData\Roaming\zscaler-root-ca.pem"`. If Neon connections fail with `SELF_SIGNED_CERT_IN_CHAIN`/`unable to get local issuer`, this is the cause.
- Neon `production` branch is protected (out of scope here; do not point any command at it).

## File Structure

| File                                             | Responsibility                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `lib/ids.ts`                                     | Application PK generator (`createId()` → UUID v4). Pure.                                     |
| `lib/env/schema.ts`                              | Pure zod env schema + `loadServerEnv()` (no Next/`server-only` imports).                     |
| `lib/env/server.ts`                              | Boots & caches the validated server env (`export const env`). Server-only by convention.     |
| `db/schema/auth.ts`                              | Better Auth tables (moved from `lib/auth-schema.ts`).                                        |
| `db/schema/index.ts`                             | Schema barrel (`export *`) consumed by the client and Better Auth.                           |
| `db/index.ts`                                    | Single `pg` Pool + `drizzle()` client (`export const db`).                                   |
| `lib/auth.ts`                                    | Better Auth instance — rewired to the shared `db` + `env` (minimal; full config in Phase 4). |
| `drizzle/**`                                     | Generated, versioned migration SQL.                                                          |
| `tests/lib/ids.test.ts`, `tests/lib/env.test.ts` | Unit tests for the pure helpers.                                                             |

> Out of scope for Phase 2 (later phases): domain tables/enums (Phase 3), Better Auth admin plugin + custom user fields + `rate_limit` (Phase 4), per-domain DB test harness (Phase 5).

---

### Task 0: Dependencies & db scripts

**Files:**

- Modify: `package.json` (deps + scripts)

- [ ] **Step 1: Install runtime + tooling deps**

Run:

```bash
bun add @vercel/functions
bun add -d dotenv
```

Expected: `@vercel/functions` in `dependencies`, `dotenv` in `devDependencies`, `bun.lock` updated. (`drizzle-kit`, `zod`, `pg`, `@types/pg` are already present.)

- [ ] **Step 2: Add Drizzle scripts to `package.json`**

In the `"scripts"` block, add:

```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(db): add @vercel/functions, dotenv, and drizzle-kit scripts"
```

---

### Task 1: ID helper (`createId`)

**Files:**

- Create: `lib/ids.ts`
- Test: `tests/lib/ids.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/ids.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { createId } from "@/lib/ids"

describe("createId", () => {
  it("returns a v4 UUID", () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it("returns a unique value on each call", () => {
    expect(createId()).not.toBe(createId())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/lib/ids.test.ts`
Expected: FAIL — cannot resolve `@/lib/ids`.

- [ ] **Step 3: Write the minimal implementation**

`lib/ids.ts`:

```ts
import { randomUUID } from "node:crypto"

/** Application-generated primary key (UUID v4). Used as the `text` PK on every table. */
export const createId = (): string => randomUUID()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/lib/ids.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ids.ts tests/lib/ids.test.ts
git commit -m "feat(db): add createId() UUID helper"
```

---

### Task 2: Env validation (`lib/env`)

**Files:**

- Create: `lib/env/schema.ts`, `lib/env/server.ts`
- Test: `tests/lib/env.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/env.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { loadServerEnv, stripEmpty } from "@/lib/env/schema"

const valid = {
  DATABASE_URL: "postgresql://u:p@host/db",
  DATABASE_URL_UNPOOLED: "postgresql://u:p@host/db",
  BETTER_AUTH_SECRET: "a-secret-value",
  BETTER_AUTH_URL: "http://localhost:3000",
}

describe("stripEmpty", () => {
  it("turns empty strings into undefined", () => {
    expect(stripEmpty({ A: "", B: "x" })).toEqual({ A: undefined, B: "x" })
  })
})

describe("loadServerEnv", () => {
  it("parses a valid environment", () => {
    expect(loadServerEnv(valid).DATABASE_URL).toBe(valid.DATABASE_URL)
  })

  it("throws when a required var is missing", () => {
    const { BETTER_AUTH_SECRET: _omitted, ...rest } = valid
    expect(() => loadServerEnv(rest)).toThrow(/BETTER_AUTH_SECRET/)
  })

  it("treats an empty string as missing", () => {
    expect(() => loadServerEnv({ ...valid, BETTER_AUTH_URL: "" })).toThrow(
      /BETTER_AUTH_URL/,
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/lib/env.test.ts`
Expected: FAIL — cannot resolve `@/lib/env/schema`.

- [ ] **Step 3: Write the schema**

`lib/env/schema.ts`:

```ts
import { z } from "zod"

/** '' (present but empty) counts as absent. */
export const stripEmpty = (
  source: Record<string, string | undefined>,
): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(source)) out[k] = v === "" ? undefined : v
  return out
}

const required = (label: string) =>
  z.string({ error: `${label} : requise mais manquante ou vide` })
const requiredUrl = (label: string) =>
  z.url({ error: `${label} : URL invalide ou manquante` })

export const buildServerSchema = () =>
  z.object({
    DATABASE_URL: required("DATABASE_URL"), // pooled (runtime)
    DATABASE_URL_UNPOOLED: required("DATABASE_URL_UNPOOLED"), // direct (migrations)
    BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: requiredUrl("BETTER_AUTH_URL"),
    // Filled in Phase 4 (Better Auth Google provider); optional until then.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  })

const formatError = (e: z.ZodError) =>
  `❌ Variables d'environnement invalides :\n` +
  e.issues.map((i) => `  • ${i.message}`).join("\n")

export type ServerEnv = z.infer<ReturnType<typeof buildServerSchema>>

let cache: ServerEnv | undefined
export const loadServerEnv = (
  source: Record<string, string | undefined> = process.env,
): ServerEnv => {
  if (cache && source === process.env) return cache
  const result = buildServerSchema().safeParse(stripEmpty(source))
  if (!result.success) throw new Error(formatError(result.error))
  if (source === process.env) cache = result.data
  return result.data
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/lib/env.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the server boot module**

`lib/env/server.ts`:

```ts
// NE PAS importer ce fichier depuis un composant 'use client'.
import { loadServerEnv } from "./schema"

export const env = loadServerEnv()
```

- [ ] **Step 6: Commit**

```bash
git add lib/env/schema.ts lib/env/server.ts tests/lib/env.test.ts
git commit -m "feat(env): zod-validated server env (fails boot on missing vars)"
```

---

### Task 3: Relocate the Better Auth schema into `db/schema/**`

**Files:**

- Move: `lib/auth-schema.ts` → `db/schema/auth.ts`
- Create: `db/schema/index.ts`
- Modify: `lib/auth.ts:5` (import path)

- [ ] **Step 1: Move the schema file (preserve history)**

Run:

```bash
git mv lib/auth-schema.ts db/schema/auth.ts
```

Expected: `db/schema/auth.ts` exists, `lib/auth-schema.ts` gone. Content unchanged (the 4 tables + relations).

- [ ] **Step 2: Create the schema barrel**

`db/schema/index.ts`:

```ts
export * from "./auth"
```

- [ ] **Step 3: Fix the import in `lib/auth.ts`**

In `lib/auth.ts`, replace:

```ts
import * as schema from "./auth-schema"
```

with:

```ts
import * as schema from "@/db/schema"
```

- [ ] **Step 4: Verify type-check passes**

Run: `bun run type-check`
Expected: PASS (no unresolved `./auth-schema`).

- [ ] **Step 5: Commit**

```bash
git add db/schema/auth.ts db/schema/index.ts lib/auth.ts
git commit -m "refactor(db): move Better Auth schema into db/schema and add barrel"
```

---

### Task 4: Single DB client (`db/index.ts`)

**Files:**

- Create: `db/index.ts`

- [ ] **Step 1: Write the client**

`db/index.ts`:

```ts
import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env/server"
import * as schema from "./schema"

// One pool created at module scope, reused across requests (Vercel Fluid Compute).
// Use the POOLED (-pooler) connection string for the runtime.
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 })

// On Vercel, let the runtime drain idle connections before suspending an instance.
if (process.env.VERCEL) attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
export type Db = typeof db
```

- [ ] **Step 2: Verify type-check passes**

Run: `bun run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add db/index.ts
git commit -m "feat(db): single pg Pool drizzle client (Vercel Fluid Compute)"
```

---

### Task 5: Rewire `lib/auth.ts` to the shared client (minimal)

**Files:**

- Modify: `lib/auth.ts` (full file)

> Minimal Phase-2 wiring only: shared `db`, `baseURL` from env. The admin plugin, email verification, `nextCookies()`, and `rate_limit` are Phase 4.

- [ ] **Step 1: Replace the file contents**

`lib/auth.ts`:

```ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { env } from "@/lib/env/server"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
})

export type Session = typeof auth.$Infer.Session
```

- [ ] **Step 2: Verify check passes**

Run: `bun run check`
Expected: PASS (tsc + eslint, 0 warning).

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "refactor(auth): use shared db client and env baseURL"
```

---

### Task 6: Generate & apply the first migration to `develop`

**Files:**

- Create: `drizzle/0000_*.sql` + `drizzle/meta/**` (generated)

- [ ] **Step 1: Generate the migration from the schema**

Run: `bun run db:generate`
Expected: a new `drizzle/0000_<name>.sql` is created containing `CREATE TABLE "user" | "session" | "account" | "verification"` and the FKs/indexes from `db/schema/auth.ts`.

- [ ] **Step 2: Review the generated SQL**

Open `drizzle/0000_*.sql`. Confirm: 4 tables, `account.user_id`/`session.user_id` FKs `ON DELETE cascade`, `user.email` unique, `session.token` unique. No `DROP TABLE` of unrelated objects.

- [ ] **Step 3: Apply to the `develop` branch**

Ensure `DATABASE_URL_UNPOOLED` points at **develop**, then run: `bun run db:migrate`
Expected: applies cleanly, prints the applied migration name, no errors. (If SSL error → set `NODE_EXTRA_CA_CERTS`, see Prerequisites.)

- [ ] **Step 4: Verify the tables exist on `develop`**

Verify via the Neon MCP `run_sql` tool against project `lucky-waterfall-33371811`, branch `develop` (`br-restless-morning-ad4uyo3t`):

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

Expected rows include: `account`, `session`, `user`, `verification` (+ drizzle's `__drizzle_migrations`).

- [ ] **Step 5: Commit**

```bash
git add drizzle/
git commit -m "feat(db): first migration (Better Auth tables) applied to develop"
```

---

### Task 7: Phase gate — build + check + tests green

**Files:** none (verification only)

- [ ] **Step 1: Full type-check + lint**

Run: `bun run check`
Expected: PASS (0 errors, 0 warnings).

- [ ] **Step 2: Unit tests**

Run: `bun run test`
Expected: PASS, including the new `tests/lib/ids.test.ts` and `tests/lib/env.test.ts`.

- [ ] **Step 3: Production build (validates env wiring + db module load)**

Run: `bun run build`
Expected: build succeeds. `next build` loads `.env.local`, so `lib/env/server.ts` boots with the required vars present. (If it fails with "Variables d'environnement invalides", a required var is missing/empty in `.env.local`.)

- [ ] **Step 4: Tag the phase completion commit (no code change)**

```bash
git commit --allow-empty -m "chore(migration): Phase 2 complete — Drizzle + Neon wired on develop"
```

---

## Self-Review

**1. Spec coverage (spec §10, Phase 2 row).** Phase 2 requires: `db/index.ts` (pg Pool) → Task 4 ✅ · env zod → Task 2 ✅ · `drizzle.config.ts` → already present, consumed in Task 6 ✅ · move auth schema → `db/schema/` → Task 3 ✅ · first migration on `develop` → Task 6 ✅ · `build` ok gate → Task 7 ✅. ID helper (spec §4 convention, D8) → Task 1 ✅. Test DB infra (spec §9) is intentionally deferred to Phase 5; Phase 2 ships only pure-function unit tests — noted in File Structure. No Phase-2 spec requirement is unaddressed.

**2. Placeholder scan.** No "TBD"/"add error handling"/"similar to". Every code step shows full file content. ✅

**3. Type/name consistency.** `createId` (Task 1) — used nowhere in Phase 2 yet (domain tables are Phase 3), consistent. `loadServerEnv`/`stripEmpty`/`env` (Task 2) consumed by `db/index.ts` (Task 4) and `lib/auth.ts` (Task 5) — names match. `db` exported from `db/index.ts` (Task 4) imported as `@/db` in Task 5 — match. `* as schema from "@/db/schema"` barrel (Task 3) consumed in Tasks 4 & 5 — match. ✅

**4. Gotchas covered.** Zscaler SSL (Prerequisites), `develop`-only target (Prerequisites + Task 6), pooled vs unpooled (`DATABASE_URL` for client, `DATABASE_URL_UNPOOLED` for migrations) ✅. PgBouncer prepared-statement caveat is not triggered in Phase 2 (no `.prepare()` usage).
