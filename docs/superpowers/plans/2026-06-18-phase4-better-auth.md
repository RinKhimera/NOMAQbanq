# Phase 4 — Better Auth (admin roles, guards, re-login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).
> Before writing auth code, verify APIs against the INSTALLED `better-auth` (^1.6.19) — `node_modules/better-auth` / https://www.better-auth.com/docs. Signatures change between versions.

**Goal:** Finish the Better Auth setup on top of the already-built SES email infra: admin plugin + roles, `nextCookies`, database rate limiting, automatic Google account-linking to migrated users, server-side guards, and an **empirically-verified re-login path** for migrated email/password users.

**Architecture:** `lib/auth.ts` gains the `admin` + `nextCookies` plugins, `rateLimit.storage: 'database'`, and `account.accountLinking` (trusted Google). Reads go through a cached `getCurrentSession`; sensitive pages/actions call `requireSession`/`requireRole`. No new DB migration (role/banned/ban_*/rate_limit/impersonated_by already exist from Phase 3b). The SES email config (`sendVerificationEmail`/`sendResetPassword`) is kept as-is.

**Tech Stack:** Better Auth ^1.6.19 (admin plugin) · Drizzle · Next.js 16 · Bun · Neon develop branch (has migrated prod users for empirical testing).

---

## Context already in place (do NOT redo)

- SES email infra: `email/client.ts`, `email/send.ts` (sandbox override via `EMAIL_OVERRIDE_TO`), `email/index.tsx` (`sendVerificationEmail`/`sendResetPassword`).
- `lib/auth.ts` already wires email verification + reset + Google provider (minimal config, no plugins yet).
- `user` table has `role` (pgEnum `user_role`), `banned`, `ban_reason`, `ban_expires`, `username`, `bio`; `session.impersonated_by`; `rate_limit` table — all on `develop`.
- 184 migrated users on develop (4 admins). They have NO `account` rows yet (no OAuth, no credential).

## ⚠️ SES sandbox dependency (cutover)

SES is in **sandbox** → all mail goes to `EMAIL_OVERRIDE_TO`. The real re-login wave (Phase 8 cutover) requires **SES production access approved** first. Flagged here; not blocking Phase 4 (we test with the override inbox).

---

### Task 1: Add admin plugin, nextCookies, rate limiting, account linking

**Files:** Modify `lib/auth.ts`.

- [ ] **Step 1: Verify imports against the installed version** — confirm in `node_modules/better-auth` that `admin` is exported from `better-auth/plugins/admin` and `nextCookies` from `better-auth/next-js`. (Both are used below.)

- [ ] **Step 2: Replace `lib/auth.ts`** (keeps the existing email + Google config, adds plugins/rateLimit/accountLinking):

```ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin } from "better-auth/plugins/admin"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { sendResetPassword, sendVerificationEmail } from "@/email"
import { env } from "@/lib/env/server"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  // Serverless: la table rate_limit (déjà créée) survit aux instances. Actif en prod uniquement.
  rateLimit: { storage: "database" },
  // Rattache automatiquement Google aux users migrés (même email) en préservant leur id.
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPassword({ to: user.email, url })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url })
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(), // ⚠️ DOIT rester le dernier plugin
  ],
})

export type Session = typeof auth.$Infer.Session
```

- [ ] **Step 3: Verify** — `bun run check` (PASS). If tsc complains that the admin plugin can't reconcile the `role` enum column, report it (do not silently change the schema) — Proxéa uses an enum role with this plugin, so this should typecheck.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): admin plugin + roles, nextCookies, db rate limit, Google account linking"
```

---

### Task 2: Auth client (admin plugin + exports)

**Files:** Modify `lib/auth-client.ts`.

- [ ] **Step 1: Replace `lib/auth-client.ts`**:

```ts
import { adminClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [adminClient()],
})

export const { signIn, signOut, signUp, useSession } = authClient
```

- [ ] **Step 2: Verify** — `bun run check` (PASS).

- [ ] **Step 3: Commit**

```bash
git add lib/auth-client.ts
git commit -m "feat(auth): auth client with admin plugin + exports"
```

---

### Task 3: Server session helper + guards

**Files:** Create `lib/dal.ts`, `lib/auth-guards.ts`.

- [ ] **Step 1: Create `lib/dal.ts`** (cached session read; `server-only` lives here per the project pattern — NOT in `db/`):

```ts
import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { auth } from "@/lib/auth"

// Dédupliqué par render via React cache().
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})
```

- [ ] **Step 2: Create `lib/auth-guards.ts`** (redirecting guards for pages/Server Actions + a non-redirecting variant for route handlers):

```ts
import "server-only"

import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/dal"

/** Page/Server Action : redirige vers la connexion si pas de session. */
export async function requireSession() {
  const session = await getCurrentSession()
  if (!session) redirect("/auth/sign-in")
  return session
}

/** Page/Server Action : exige un des rôles ; sinon redirige vers l'accueil membre. */
export async function requireRole(roles: Array<"user" | "admin">) {
  const session = await requireSession()
  const role = (session.user.role ?? "user") as "user" | "admin"
  if (!roles.includes(role)) redirect("/dashboard")
  return session
}

/** Route handler : renvoie la session ou null (ne redirige PAS — pour répondre 401/403). */
export async function getSessionForRoute() {
  return getCurrentSession()
}
```

- [ ] **Step 3: Verify** — `bun run check` (PASS). If `session.user.role` is not typed (admin plugin not surfacing it), report the exact type error.

- [ ] **Step 4: Commit**

```bash
git add lib/dal.ts lib/auth-guards.ts
git commit -m "feat(auth): cached session helper + requireSession/requireRole guards"
```

---

### Task 4: Empirically verify the re-login path on develop (SPIKE)

**Files:** Create a throwaway `scripts/verify-relogin.ts` (deleted after, or kept as a manual tool).

> This resolves the only open unknown (B5): does `resetPassword` create a credential `account` for a migrated email/password user who has none? We test it against a REAL migrated user on develop.

- [ ] **Step 1: Pick a migrated test user** — via Neon MCP `run_sql` (branch develop), choose a non-admin migrated user email, e.g.:
```sql
SELECT email FROM "user" WHERE role = 'user' ORDER BY created_at LIMIT 1;
```
Confirm it has NO account row: `SELECT count(*) FROM account WHERE user_id = (SELECT id FROM "user" WHERE email = '<email>');` → expect 0.

- [ ] **Step 2: Trigger + complete a password reset programmatically** — create `scripts/verify-relogin.ts`:

```ts
import { config } from "dotenv"

config({ path: ".env.local" })

import { auth } from "@/lib/auth"

const email = process.argv[2]
if (!email) throw new Error("usage: bun run scripts/verify-relogin.ts <email>")

async function main() {
  // 1. Demande de reset (envoie l'email vers EMAIL_OVERRIDE_TO en sandbox).
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: "/auth/reset-password" },
  })
  console.log(`[1] requestPasswordReset OK pour ${email}`)
  console.log(
    "[2] Récupère le token : SELECT identifier, value FROM verification ORDER BY created_at DESC LIMIT 3; (via MCP), puis relance avec le token en 2e arg.",
  )

  const token = process.argv[3]
  if (!token) {
    console.log("[info] pas de token fourni — étape 1 seulement.")
    process.exit(0)
  }
  // 3. Reset effectif.
  await auth.api.resetPassword({
    body: { newPassword: "Test-Relogin-1234!", token },
  })
  console.log("[3] resetPassword OK")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 3: Run step 1** — `bun run scripts/verify-relogin.ts <email>`. Expected: no throw (or a clear error if reset requires a pre-existing credential). The reset email lands in the `EMAIL_OVERRIDE_TO` inbox.

- [ ] **Step 4: Fetch the token** — via Neon MCP `run_sql` (develop): `SELECT identifier, value, expires_at FROM verification ORDER BY created_at DESC LIMIT 3;` — find the reset token for the test user.

- [ ] **Step 5: Run step 3** — `bun run scripts/verify-relogin.ts <email> <token>`. Then check via MCP whether a credential account now exists:
```sql
SELECT provider_id, (password IS NOT NULL) AS has_password
FROM account WHERE user_id = (SELECT id FROM "user" WHERE email = '<email>');
```

- [ ] **Step 6: DECISION + record outcome**
  - **If a `credential` account with `has_password = true` was created** → ✅ migrated email users can self-serve "forgot password". No backfill needed. Document this in `docs/superpowers/specs/2026-06-17-convex-to-drizzle-neon-migration-design.md` §6 (replace the B5 "à vérifier" note with the confirmed behavior).
  - **If reset FAILED / no credential created** → add **Task 4b** (below) to backfill passwordless credential accounts during the cutover, and update §6 accordingly.

- [ ] **Step 7: Commit the finding** (and the script if kept):

```bash
git add scripts/verify-relogin.ts docs/superpowers/specs/2026-06-17-convex-to-drizzle-neon-migration-design.md
git commit -m "test(auth): verify migrated email-user password-reset path on develop"
```

#### Task 4b (CONDITIONAL — only if Step 6 found reset fails without a credential)

Backfill a passwordless `credential` account for every migrated user so "forgot password" works. Add to `scripts/import-from-convex.ts` (or a new `scripts/backfill-credentials.ts`): for each `user`, insert `account { id: createId(), userId: u.id, accountId: u.id, providerId: "credential", password: null, createdAt, updatedAt }` with `onConflictDoNothing`. Run on develop, re-verify Step 5.

---

### Task 5: Phase gate

**Files:** none (verification only).

- [ ] **Step 1:** `bun run check` → PASS.
- [ ] **Step 2:** `bun run test` → PASS (existing suite unaffected; auth has no new unit tests this phase).
- [ ] **Step 3:** `bun run build` → PASS (the auth route + plugins compile).
- [ ] **Step 4:** Tag completion:
```bash
git commit --allow-empty -m "chore(migration): Phase 4 complete — Better Auth roles/guards + verified re-login"
```

---

## Self-Review

**1. Spec coverage (spec §6 + audit B5).** admin plugin + roles → Task 1 ✅; nextCookies (last) ✅; rate limit database ✅; Google account-linking to migrated users → Task 1 (doc-confirmed) ✅; guards + non-redirecting route variant → Task 3 ✅; email/password re-login empirically verified → Task 4 ✅ (+ conditional 4b). SES email infra kept as-is. SES sandbox cutover dependency flagged.

**2. No new migration.** role/banned/ban_*/username/bio/impersonated_by/rate_limit all created in Phase 3b — confirmed on develop. Task 1 changes config only.

**3. Placeholder scan.** Full code for auth.ts/auth-client.ts/dal.ts/auth-guards.ts/verify-relogin.ts. Task 4b is explicitly conditional on the Task 4 outcome (a real decision branch, not a vague TODO). ✅

**4. Deferred to later phases.** Sign-in/sign-up UI replacing Clerk (Phase 5); proxy.ts route protection (Phase 8); SES production access (Phase 8 cutover); fine-grained `requirePermission`/AC (only if a real need appears — YAGNI).

**5. Risk.** The single unknown (reset-for-credential-less-users) is isolated into Task 4 and tested on real data before anything depends on it; Task 4b is the ready fallback.
