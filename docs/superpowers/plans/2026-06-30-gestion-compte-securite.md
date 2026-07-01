# Gestion du compte & sécurité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter les pages `/dashboard/profil` et `/admin/profil` d'un centre de gestion d'authentification moderne : lier/délier Google, définir/changer un mot de passe (y compris pour un compte Google-only), statut de vérification email, appareils connectés, et suppression de compte avec délai de grâce 30 jours.

**Architecture:** On s'appuie sur les briques natives de **Better Auth v1.6.20** (`setPassword`, `linkSocial`, `unlinkAccount`, `sendVerificationEmail`, garde `FAILED_TO_UNLINK_LAST_ACCOUNT`). Les **lectures** (méthodes de connexion, sessions) passent par des DAL `server-only` self-scoped qui ne renvoient **aucun secret** (`token`, `password`, tokens OAuth). Les **révocations** et la **suppression** sont des Server Actions Drizzle gardées. La suppression est un soft-delete réversible (`user.deletedAt`) → réactivation à la reconnexion via `databaseHooks` → anonymisation par un cron après 30 j (`user.anonymizedAt`).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Drizzle ORM + Neon · Better Auth · shadcn/ui + react-hook-form + zod · sonner · motion/react · Vitest (happy-dom + intégration Neon éphémère).

**Spec:** [docs/superpowers/specs/2026-06-30-gestion-compte-securite-design.md](../specs/2026-06-30-gestion-compte-securite-design.md)

**Contrainte git (IMPORTANT) :** branche partagée `dev-2` (une autre session y travaille). **Chaque commit ne stage QUE les fichiers listés dans son `git add`** — jamais `git add -A`/`git add .`. Ne jamais toucher aux fichiers `docs/**/pagination-*` (autre session).

---

## File Structure

**Backend (créés)**
- `features/users/lib/user-agent.ts` — parse léger `userAgent` → libellé lisible (pur, testable).
- `features/users/lib/account-deletion.ts` — constante `DELETION_GRACE_MS` + `isGraceExpired()` (pur).
- `features/users/cron.ts` — `anonymizeExpiredDeletedAccounts()`.

**Backend (modifiés)**
- `features/users/dal.ts` — ajoute `getLoginMethods()`, `getUserSessions()`.
- `features/users/actions.ts` — ajoute `revokeUserSession()`, `revokeOtherUserSessions()`, `deleteMyAccount()`.
- `schemas/auth.ts` — ajoute `deleteAccountSchema`.
- `lib/auth.ts` — ajoute `databaseHooks.session.create.before/after` (grâce suppression).
- `app/api/cron/close-expired/route.ts` — câble le balayage d'anonymisation.
- `lib/auth-errors.ts` — message FR pour « email déjà existant » (edge case E1).

**Frontend (créés)**
- `app/(dashboard)/dashboard/profil/_components/profile-login-methods.tsx`
- `app/(dashboard)/dashboard/profil/_components/profile-password.tsx`
- `app/(dashboard)/dashboard/profil/_components/profile-sessions.tsx`
- `app/(dashboard)/dashboard/profil/_components/profile-danger-zone.tsx`
- `app/compte-supprime/page.tsx` — page publique d'adieu (hors garde de session).

**Frontend (modifiés)**
- `app/(dashboard)/dashboard/profil/page.tsx` — rend les nouveaux composants.
- `app/(admin)/admin/profil/page.tsx` — idem.
- `app/(dashboard)/dashboard/profil/_components/profile-security.tsx` — **supprimé** (remplacé par login-methods + password).

**Tests (créés)**
- `tests/users/user-agent.test.ts` (unit)
- `tests/users/account-deletion.test.ts` (unit)
- `tests/integration/users-account.test.ts` (DAL + actions + cron)
- `tests/users/profile-login-methods.test.tsx`
- `tests/users/profile-sessions.test.tsx`
- `tests/users/profile-danger-zone.test.tsx`

**Docs/règles (modifiés)**
- `.claude/rules/data-layer.md` — acte l'exception de lecture self-scoped de `account`/`session`.

---

## Phase 1 — Backend socle : helpers, lectures DAL, révocation de sessions

### Task 1 : Helper de parse User-Agent

**Files:**
- Create: `features/users/lib/user-agent.ts`
- Test: `tests/users/user-agent.test.ts`

- [ ] **Step 1 : Test qui échoue**

```ts
// tests/users/user-agent.test.ts
import { describe, expect, it } from "vitest"
import { describeUserAgent } from "@/features/users/lib/user-agent"

describe("describeUserAgent", () => {
  it("renvoie un libellé de repli si vide", () => {
    expect(describeUserAgent(null)).toBe("Appareil inconnu")
    expect(describeUserAgent("")).toBe("Appareil inconnu")
  })

  it("détecte Chrome sur Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    expect(describeUserAgent(ua)).toBe("Chrome · Windows")
  })

  it("détecte Edge (pas Chrome) et Safari sur macOS", () => {
    expect(describeUserAgent("... Chrome/120 Edg/120 ...")).toContain("Edge")
    const safari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    expect(describeUserAgent(safari)).toBe("Safari · macOS")
  })

  it("détecte Firefox sur Linux et Safari sur iOS", () => {
    expect(describeUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Firefox/120.0")).toBe(
      "Firefox · Linux",
    )
    expect(
      describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ... Safari/604.1"),
    ).toBe("Safari · iOS")
  })
})
```

- [ ] **Step 2 : Lancer le test → échoue**

Run: `bun run test user-agent`
Expected: FAIL (`describeUserAgent` introuvable).

- [ ] **Step 3 : Implémenter**

```ts
// features/users/lib/user-agent.ts
// Parse léger d'un User-Agent en libellé lisible « Navigateur · Système ».
// Sans dépendance externe. L'ordre des tests compte (Edge/Opera contiennent
// "Chrome" ; Chrome contient "Safari").
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Appareil inconnu"

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navigateur"

  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "système inconnu"

  return `${browser} · ${os}`
}
```

- [ ] **Step 4 : Lancer le test → passe**

Run: `bun run test user-agent`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add features/users/lib/user-agent.ts tests/users/user-agent.test.ts
git commit -m "feat(users): helper de parse User-Agent pour la liste d'appareils"
```

---

### Task 2 : DAL — `getLoginMethods` et `getUserSessions`

**Files:**
- Modify: `features/users/dal.ts`
- Test: `tests/integration/users-account.test.ts`

- [ ] **Step 1 : Test d'intégration qui échoue**

```ts
// tests/integration/users-account.test.ts
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { account, session, user } from "@/db/schema"
import { getLoginMethods, getUserSessions } from "@/features/users/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({ requireSession: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const userId = createId()
const currentSessionId = createId()
const otherSessionId = createId()

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Compte Test",
    email: `account-${userId}@test.invalid`,
    emailVerified: true,
  })
  await db.insert(account).values([
    { id: createId(), userId, providerId: "credential", accountId: userId, password: "hash" },
    { id: createId(), userId, providerId: "google", accountId: "google-sub-123" },
  ])
  await db.insert(session).values([
    {
      id: currentSessionId,
      userId,
      token: `tok-${currentSessionId}`,
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: "1.2.3.4",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
    },
    {
      id: otherSessionId,
      userId,
      token: `tok-${otherSessionId}`,
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: "5.6.7.8",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Firefox/120.0",
    },
  ])
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id: userId, email: `account-${userId}@test.invalid` },
    session: { id: currentSessionId },
  } as never)
})

afterAll(async () => {
  // Enfants avant parent (FK).
  await db.delete(session).where(eq(session.userId, userId))
  await db.delete(account).where(eq(account.userId, userId))
  await db.delete(user).where(eq(user.id, userId))
})

describe("getLoginMethods", () => {
  it("indique mot de passe + Google liés et email vérifié, sans secret", async () => {
    const methods = await getLoginMethods()
    expect(methods).not.toBeNull()
    expect(methods?.hasPassword).toBe(true)
    expect(methods?.google.linked).toBe(true)
    expect(methods?.emailVerified).toBe(true)
    // Aucun secret ne doit fuiter dans la forme retournée.
    expect(JSON.stringify(methods)).not.toContain("hash")
  })
})

describe("getUserSessions", () => {
  it("liste les sessions, marque la courante, sans exposer de token", async () => {
    const sessions = await getUserSessions()
    expect(sessions).toHaveLength(2)
    const current = sessions.find((s) => s.isCurrent)
    expect(current?.id).toBe(currentSessionId)
    expect(current?.deviceLabel).toBe("Chrome · Windows")
    // Jamais de token dans le retour.
    expect(JSON.stringify(sessions)).not.toContain("tok-")
    expect(sessions.every((s) => !("token" in s))).toBe(true)
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test:integration users-account`
Expected: FAIL (`getLoginMethods`/`getUserSessions` introuvables).

- [ ] **Step 3 : Ajouter les imports manquants dans `features/users/dal.ts`**

Modifier le bloc d'import des tables (actuellement `features/users/dal.ts:20-27`) pour ajouter `account` et `session` :

```ts
import {
  account,
  examParticipations,
  exams,
  products,
  session,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import { describeUserAgent } from "@/features/users/lib/user-agent"
```

- [ ] **Step 4 : Ajouter les deux lectures (à la suite de `getCurrentUser`, ~ligne 72)**

```ts
export type LoginMethods = {
  hasPassword: boolean
  google: { linked: boolean; linkedAt: Date | null }
  emailVerified: boolean
}

// Méthodes de connexion de l'utilisateur courant. Lit `account` (providerId + date
// seulement — JAMAIS password/accessToken/refreshToken/idToken/scope) et
// `user.emailVerified`. Self-scoped : filtré sur la session courante.
export const getLoginMethods = cache(async (): Promise<LoginMethods | null> => {
  const authSession = await getCurrentSession()
  if (!authSession?.user) return null
  const uid = authSession.user.id

  const rows = await db
    .select({ providerId: account.providerId, createdAt: account.createdAt })
    .from(account)
    .where(eq(account.userId, uid))

  const [u] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, uid))
    .limit(1)

  const google = rows.find((r) => r.providerId === "google")
  return {
    hasPassword: rows.some((r) => r.providerId === "credential"),
    google: { linked: Boolean(google), linkedAt: google?.createdAt ?? null },
    emailVerified: u?.emailVerified ?? false,
  }
})

// Formateur de date fixe (fuseau Québec) → chaîne stable serveur/client, pas de
// mismatch d'hydratation. Défini au scope module (pas dans un rendu React).
const SESSION_DATE_FMT = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
})

export type UserSession = {
  id: string
  deviceLabel: string
  ipAddress: string | null
  lastActiveLabel: string
  isCurrent: boolean
}

// Sessions ACTIVES (non expirées) de l'utilisateur courant. Colonnes NON-secrètes
// uniquement — JAMAIS `session.token`. `isCurrent` par comparaison de l'id à la
// session courante. Dates pré-formatées serveur (fuseau fixe) → pas de mismatch
// d'hydratation. Borné à 50.
export const getUserSessions = cache(async (): Promise<UserSession[]> => {
  const authSession = await getCurrentSession()
  if (!authSession?.user) return []
  const currentId = authSession.session.id

  const rows = await db
    .select({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      updatedAt: session.updatedAt,
    })
    .from(session)
    .where(
      and(
        eq(session.userId, authSession.user.id),
        gt(session.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(session.updatedAt))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    deviceLabel: describeUserAgent(r.userAgent),
    ipAddress: r.ipAddress,
    lastActiveLabel: SESSION_DATE_FMT.format(r.updatedAt),
    isCurrent: r.id === currentId,
  }))
})
```

- [ ] **Step 5 : Lancer → passe**

Run: `bun run test:integration users-account`
Expected: PASS (2 tests).

- [ ] **Step 6 : Commit**

```bash
git add features/users/dal.ts tests/integration/users-account.test.ts
git commit -m "feat(users): DAL getLoginMethods + getUserSessions (self-scoped, sans secret)"
```

---

### Task 3 : Actions — révocation de sessions

**Files:**
- Modify: `features/users/actions.ts`
- Test: `tests/integration/users-account.test.ts` (ajout d'un `describe`)

- [ ] **Step 1 : Ajouter le test (dans le même fichier)**

Ajouter en tête l'import de l'action et de la table, puis le `describe`. Imports à ajouter :

```ts
import { revokeOtherUserSessions, revokeUserSession } from "@/features/users/actions"
import { requireSession } from "@/lib/auth-guards"
```

`requireSession` doit être mocké pour renvoyer la session courante. Ajouter dans `beforeAll`, après le mock de `getCurrentSession` :

```ts
vi.mocked(requireSession).mockResolvedValue({
  user: { id: userId, email: `account-${userId}@test.invalid` },
  session: { id: currentSessionId },
} as never)
```

Puis le bloc de test :

```ts
describe("revokeUserSession", () => {
  it("refuse de révoquer la session courante", async () => {
    const res = await revokeUserSession(currentSessionId)
    expect(res.success).toBe(false)
  })

  it("révoque une autre session appartenant à l'utilisateur", async () => {
    const res = await revokeUserSession(otherSessionId)
    expect(res.success).toBe(true)
    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.id, otherSessionId), eq(session.userId, userId)))
    expect(rows).toHaveLength(0)
  })

  it("ne révoque pas la session d'un autre utilisateur (IDOR)", async () => {
    const strangerId = createId()
    const strangerSession = createId()
    await db.insert(user).values({
      id: strangerId,
      name: "Étranger",
      email: `stranger-${strangerId}@test.invalid`,
    })
    await db.insert(session).values({
      id: strangerSession,
      userId: strangerId,
      token: `tok-${strangerSession}`,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const res = await revokeUserSession(strangerSession)
    expect(res.success).toBe(true) // action « succès » mais aucune ligne touchée
    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.id, strangerSession))
    expect(rows).toHaveLength(1) // toujours présente
    await db.delete(session).where(eq(session.userId, strangerId))
    await db.delete(user).where(eq(user.id, strangerId))
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test:integration users-account`
Expected: FAIL (actions introuvables).

- [ ] **Step 3 : Implémenter dans `features/users/actions.ts`**

Ajouter aux imports existants (`features/users/actions.ts:3-6`) :

```ts
import { session as sessionTable, user } from "@/db/schema"
```

(`and`, `eq`, `ne` sont déjà importés ; `requireSession` déjà importé ; `user` est déjà importé — ne pas le dupliquer, ajouter seulement `session as sessionTable`.)

Puis, à la fin du fichier :

```ts
export type AccountActionResult = { success: boolean; error?: string }

// Révoque UNE session de l'utilisateur courant (déconnexion d'un appareil).
// Garde d'appartenance (user_id) → anti-IDOR. Interdit la session courante
// (utiliser la déconnexion normale).
export const revokeUserSession = async (
  sessionId: string,
): Promise<AccountActionResult> => {
  const authSession = await requireSession()
  if (sessionId === authSession.session.id) {
    return {
      success: false,
      error: "Vous ne pouvez pas révoquer votre session courante ici.",
    }
  }
  await db
    .delete(sessionTable)
    .where(
      and(
        eq(sessionTable.id, sessionId),
        eq(sessionTable.userId, authSession.user.id),
      ),
    )
  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}

// Déconnecte tous les autres appareils (garde la session courante).
export const revokeOtherUserSessions =
  async (): Promise<AccountActionResult> => {
    const authSession = await requireSession()
    await db
      .delete(sessionTable)
      .where(
        and(
          eq(sessionTable.userId, authSession.user.id),
          ne(sessionTable.id, authSession.session.id),
        ),
      )
    revalidatePath("/dashboard/profil")
    revalidatePath("/admin/profil")
    return { success: true }
  }
```

- [ ] **Step 4 : Lancer → passe**

Run: `bun run test:integration users-account`
Expected: PASS.

- [ ] **Step 5 : `bun run check` puis commit**

```bash
bun run check
git add features/users/actions.ts tests/integration/users-account.test.ts
git commit -m "feat(users): actions revokeUserSession + revokeOtherUserSessions (gardées)"
```

---

## Phase 2 — Suppression de compte (backend)

### Task 4 : Helper de grâce + schéma + action `deleteMyAccount`

**Files:**
- Create: `features/users/lib/account-deletion.ts`
- Test: `tests/users/account-deletion.test.ts`
- Modify: `schemas/auth.ts`
- Modify: `features/users/actions.ts`
- Test: `tests/integration/users-account.test.ts` (ajout)

- [ ] **Step 1 : Test unitaire du helper (échoue)**

```ts
// tests/users/account-deletion.test.ts
import { describe, expect, it } from "vitest"
import {
  DELETION_GRACE_MS,
  isGraceExpired,
} from "@/features/users/lib/account-deletion"

describe("isGraceExpired", () => {
  const now = Date.UTC(2026, 5, 30)
  it("false si pas de suppression programmée", () => {
    expect(isGraceExpired(null, now)).toBe(false)
  })
  it("false dans la fenêtre de grâce", () => {
    const d = new Date(now - (DELETION_GRACE_MS - 1000))
    expect(isGraceExpired(d, now)).toBe(false)
  })
  it("true une fois la grâce dépassée", () => {
    const d = new Date(now - (DELETION_GRACE_MS + 1000))
    expect(isGraceExpired(d, now)).toBe(true)
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test account-deletion`
Expected: FAIL.

- [ ] **Step 3 : Implémenter le helper**

```ts
// features/users/lib/account-deletion.ts
// Fenêtre de grâce avant anonymisation définitive d'un compte supprimé.
export const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000

// Vrai si la suppression douce (`deletedAt`) a dépassé la fenêtre de grâce.
export function isGraceExpired(
  deletedAt: Date | null | undefined,
  now: number,
): boolean {
  if (!deletedAt) return false
  return now - deletedAt.getTime() >= DELETION_GRACE_MS
}
```

- [ ] **Step 4 : Lancer → passe**

Run: `bun run test account-deletion`
Expected: PASS.

- [ ] **Step 5 : Ajouter `deleteAccountSchema` dans `schemas/auth.ts`** (à la fin du fichier)

```ts
export const deleteAccountSchema = z.object({
  confirmEmail: emailField,
})

export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>
```

- [ ] **Step 6 : Test d'intégration de l'action (dans `tests/integration/users-account.test.ts`)**

Ajouter l'import :

```ts
import { deleteMyAccount } from "@/features/users/actions"
```

Puis le `describe` (place-le AVANT le describe `getLoginMethods`/`getUserSessions` OU crée un utilisateur dédié pour ne pas perturber les autres tests — ici on crée un user isolé) :

```ts
describe("deleteMyAccount", () => {
  it("refuse si l'email de confirmation ne correspond pas", async () => {
    const res = await deleteMyAccount({ confirmEmail: "mauvais@test.invalid" })
    expect(res.success).toBe(false)
  })

  it("pose deletedAt, supprime les sessions, sans anonymiser", async () => {
    // Re-crée une session courante (les tests précédents ont pu en supprimer).
    await db
      .insert(session)
      .values({
        id: currentSessionId,
        userId,
        token: `tok-${currentSessionId}`,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .onConflictDoNothing()

    const res = await deleteMyAccount({
      confirmEmail: `account-${userId}@test.invalid`,
    })
    expect(res.success).toBe(true)

    const [u] = await db
      .select({
        deletedAt: user.deletedAt,
        anonymizedAt: user.anonymizedAt,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    expect(u?.deletedAt).not.toBeNull()
    expect(u?.anonymizedAt).toBeNull() // pas encore anonymisé
    expect(u?.email).toBe(`account-${userId}@test.invalid`) // email intact pendant la grâce

    const sess = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, userId))
    expect(sess).toHaveLength(0) // déconnecté partout
  })
})
```

> Note : `deleteMyAccount` marque `userId` comme supprimé — place ce `describe` **en dernier** pour ne pas casser les tests DAL qui supposent l'utilisateur actif.

- [ ] **Step 7 : Implémenter `deleteMyAccount` dans `features/users/actions.ts`**

Ajouter l'import du schéma :

```ts
import { deleteAccountSchema } from "@/schemas/auth"
```

Compléter l'import `drizzle-orm` existant (actuellement `and, eq, ne`) avec `isNull` et `sql` :

```ts
import { and, eq, isNull, ne, sql } from "drizzle-orm"
```

Puis, à la fin du fichier :

```ts
// Suppression douce du compte courant (grâce 30 j). Confirmation par saisie de
// l'email. Pose `deletedAt`, supprime toutes les sessions (déconnexion partout).
// L'anonymisation définitive est faite plus tard par le cron. La reconnexion dans
// la fenêtre de grâce réactive le compte (voir lib/auth.ts databaseHooks).
export const deleteMyAccount = async (input: {
  confirmEmail: string
}): Promise<AccountActionResult> => {
  const authSession = await requireSession()

  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  if (
    parsed.data.confirmEmail.trim().toLowerCase() !==
    authSession.user.email.toLowerCase()
  ) {
    return { success: false, error: "L'adresse courriel ne correspond pas." }
  }

  // Garde « dernier admin » : ne pas laisser le seul admin restant se supprimer
  // (sinon l'app se retrouve sans administrateur).
  if (authSession.user.role === "admin") {
    const [row] = await db
      .select({ others: sql<number>`count(*)::int` })
      .from(user)
      .where(
        and(
          eq(user.role, "admin"),
          isNull(user.deletedAt),
          ne(user.id, authSession.user.id),
        ),
      )
    if (!row?.others) {
      return {
        success: false,
        error:
          "Vous êtes le dernier administrateur : impossible de supprimer ce compte.",
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, authSession.user.id))
    await tx
      .delete(sessionTable)
      .where(eq(sessionTable.userId, authSession.user.id))
  })

  return { success: true }
}
```

- [ ] **Step 8 : Lancer → passe, `check`, commit**

Run: `bun run test account-deletion && bun run test:integration users-account`
Expected: PASS.

```bash
bun run check
git add features/users/lib/account-deletion.ts tests/users/account-deletion.test.ts schemas/auth.ts features/users/actions.ts tests/integration/users-account.test.ts
git commit -m "feat(users): suppression douce du compte (grâce 30 j) + confirmation email"
```

---

### Task 5 : Cron d'anonymisation + câblage

**Files:**
- Create: `features/users/cron.ts`
- Modify: `app/api/cron/close-expired/route.ts`
- Test: `tests/integration/users-account.test.ts` (ajout)

- [ ] **Step 1 : Test d'intégration (échoue)**

Ajouter l'import :

```ts
import { anonymizeExpiredDeletedAccounts } from "@/features/users/cron"
import { DELETION_GRACE_MS } from "@/features/users/lib/account-deletion"
```

Puis un `describe` avec un utilisateur dédié (supprimé depuis > 30 j) :

```ts
describe("anonymizeExpiredDeletedAccounts", () => {
  it("anonymise les comptes supprimés hors grâce et purge leurs accounts", async () => {
    const oldId = createId()
    await db.insert(user).values({
      id: oldId,
      name: "Vieux Supprimé",
      email: `old-${oldId}@test.invalid`,
      deletedAt: new Date(Date.now() - (DELETION_GRACE_MS + 86400000)),
    })
    await db.insert(account).values({
      id: createId(),
      userId: oldId,
      providerId: "google",
      accountId: "sub-old",
    })

    const res = await anonymizeExpiredDeletedAccounts()
    expect(res.anonymizedCount).toBeGreaterThanOrEqual(1)

    const [u] = await db
      .select({
        name: user.name,
        email: user.email,
        anonymizedAt: user.anonymizedAt,
      })
      .from(user)
      .where(eq(user.id, oldId))
      .limit(1)
    expect(u?.name).toBe("Utilisateur supprimé")
    expect(u?.email).toBe(`deleted-${oldId}@deleted.invalid`)
    expect(u?.anonymizedAt).not.toBeNull()

    const accs = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, oldId))
    expect(accs).toHaveLength(0) // secrets OAuth purgés

    await db.delete(user).where(eq(user.id, oldId))
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test:integration users-account`
Expected: FAIL (`anonymizeExpiredDeletedAccounts` introuvable).

- [ ] **Step 3 : Implémenter `features/users/cron.ts`**

```ts
// features/users/cron.ts
import { and, eq, isNull, lt } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { account, user } from "@/db/schema"
import { DELETION_GRACE_MS } from "@/features/users/lib/account-deletion"

export type AnonymizeResult = { anonymizedCount: number }

// Anonymise définitivement les comptes soft-supprimés dont la grâce (30 j) est
// dépassée : scrub PII (nom/email/username/bio/image), purge des lignes `account`
// (tokens OAuth / hash de mot de passe). `id` conservé → intégrité de l'historique.
// Borné à 500 par run (AGENTS.md : reads bornés).
export async function anonymizeExpiredDeletedAccounts(): Promise<AnonymizeResult> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_MS)

  const expired = await db
    .select({ id: user.id })
    .from(user)
    .where(and(lt(user.deletedAt, cutoff), isNull(user.anonymizedAt)))
    .limit(500)

  let anonymizedCount = 0
  for (const { id } of expired) {
    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          name: "Utilisateur supprimé",
          email: `deleted-${id}@deleted.invalid`,
          username: null,
          bio: null,
          image: null,
          anonymizedAt: new Date(),
        })
        .where(eq(user.id, id))
      await tx.delete(account).where(eq(account.userId, id))
    })
    anonymizedCount++
  }

  return { anonymizedCount }
}
```

- [ ] **Step 4 : Câbler dans `app/api/cron/close-expired/route.ts`**

Ajouter l'import (avec les deux existants, en respectant l'ordre alphabétique) :

```ts
import { closeExpiredExamParticipations } from "@/features/exams/cron"
import { closeExpiredTrainingSessions } from "@/features/training/cron"
import { anonymizeExpiredDeletedAccounts } from "@/features/users/cron"
```

Remplacer le bloc `Promise.all` + log (lignes 39-54) par :

```ts
    const [examParticipations, trainingSessions, anonymizedAccounts] =
      await Promise.all([
        closeExpiredExamParticipations(),
        closeExpiredTrainingSessions(),
        anonymizeExpiredDeletedAccounts(),
      ])

    if (
      examParticipations.closedCount > 0 ||
      trainingSessions.closedCount > 0 ||
      anonymizedAccounts.anonymizedCount > 0
    ) {
      console.log(
        `[cron close-expired] examens fermés=${examParticipations.closedCount} ` +
          `sessions fermées=${trainingSessions.closedCount} ` +
          `comptes anonymisés=${anonymizedAccounts.anonymizedCount}`,
      )
    }

    return Response.json({
      examParticipations,
      trainingSessions,
      anonymizedAccounts,
    })
```

- [ ] **Step 5 : Lancer → passe, check, commit**

Run: `bun run test:integration users-account`
Expected: PASS.

```bash
bun run check
git add features/users/cron.ts app/api/cron/close-expired/route.ts tests/integration/users-account.test.ts
git commit -m "feat(users): cron d'anonymisation des comptes supprimés (grâce 30 j)"
```

---

### Task 6 : Hooks Better Auth — blocage hors grâce + réactivation

**Files:**
- Modify: `lib/auth.ts`

> Les hooks Better Auth sont difficiles à tester unitairement de façon isolée
> (ils dépendent du runtime auth). La logique pure (`isGraceExpired`) est déjà
> testée (Task 4). Ici on câble ; la vérification se fait via `bun run check` +
> validation manuelle en E2E plus tard.

- [ ] **Step 1 : Ajouter les imports en tête de `lib/auth.ts`**

```ts
import { eq } from "drizzle-orm"
import { user as userTable } from "@/db/schema"
import { isGraceExpired } from "@/features/users/lib/account-deletion"
```

- [ ] **Step 2 : Ajouter `databaseHooks` dans l'objet `betterAuth({ ... })`**

Insérer, juste après le bloc `account: { ... }` (ligne ~29), avant `user: {` :

```ts
  // Suppression douce (grâce 30 j) :
  //  - before : bloque la connexion d'un compte dont la grâce est expirée
  //    (en attente d'anonymisation par le cron).
  //  - after  : réactive (efface deletedAt) un compte supprimé qui se reconnecte
  //    DANS la fenêtre de grâce → « se reconnecter annule la suppression ».
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [u] = await db
            .select({ deletedAt: userTable.deletedAt })
            .from(userTable)
            .where(eq(userTable.id, session.userId))
            .limit(1)
          if (u?.deletedAt && isGraceExpired(u.deletedAt, Date.now())) {
            return false // abandon de la création de session
          }
        },
        after: async (session) => {
          const [u] = await db
            .select({ deletedAt: userTable.deletedAt })
            .from(userTable)
            .where(eq(userTable.id, session.userId))
            .limit(1)
          if (u?.deletedAt) {
            await db
              .update(userTable)
              .set({ deletedAt: null })
              .where(eq(userTable.id, session.userId))
          }
        },
      },
    },
  },
```

> `db` est déjà importé dans `lib/auth.ts`. On importe `user as userTable` pour ne
> pas heurter d'éventuelles collisions de nom locales.

- [ ] **Step 3 : Vérifier + commit**

Run: `bun run check`
Expected: exit 0.

```bash
git add lib/auth.ts
git commit -m "feat(auth): hooks de suppression (blocage hors grâce + réactivation à la reconnexion)"
```

---

## Phase 3 — UI : méthodes de connexion, mot de passe, vérification email

### Task 7 : Composant `ProfileLoginMethods`

**Files:**
- Create: `app/(dashboard)/dashboard/profil/_components/profile-login-methods.tsx`
- Test: `tests/users/profile-login-methods.test.tsx`

- [ ] **Step 1 : Test qui échoue**

```tsx
// tests/users/profile-login-methods.test.tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileLoginMethods } from "@/app/(dashboard)/dashboard/profil/_components/profile-login-methods"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
}))

describe("ProfileLoginMethods", () => {
  it("propose de définir un mot de passe pour un compte Google-only", () => {
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: false,
          google: { linked: true, linkedAt: new Date() },
          emailVerified: true,
        }}
        email="a@b.com"
        googleEnabled
        profilePath="/dashboard/profil"
      />,
    )
    expect(screen.getByTestId("login-method-set-password")).toBeInTheDocument()
    expect(screen.getByText(/Vérifié/i)).toBeInTheDocument()
  })

  it("propose de lier Google et affiche non vérifié + renvoi", () => {
    render(
      <ProfileLoginMethods
        methods={{
          hasPassword: true,
          google: { linked: false, linkedAt: null },
          emailVerified: false,
        }}
        email="a@b.com"
        googleEnabled
        profilePath="/dashboard/profil"
      />,
    )
    expect(screen.getByTestId("login-method-google-link")).toBeInTheDocument()
    expect(screen.getByTestId("login-method-resend-verification")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test profile-login-methods`
Expected: FAIL.

- [ ] **Step 3 : Implémenter le composant**

```tsx
// app/(dashboard)/dashboard/profil/_components/profile-login-methods.tsx
"use client"

import { IconBrandGoogle, IconKey, IconMail, IconPlugConnected } from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LoginMethods } from "@/features/users/dal"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"

type Props = {
  methods: LoginMethods
  email: string
  googleEnabled: boolean
  profilePath: string
  onSetPassword?: () => void // ouvre le formulaire « définir un mot de passe »
}

export const ProfileLoginMethods = ({
  methods,
  email,
  googleEnabled,
  profilePath,
  onSetPassword,
}: Props) => {
  const [busy, setBusy] = useState(false)

  const linkGoogle = async () => {
    setBusy(true)
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: profilePath,
    })
    if (error) {
      toast.error(mapAuthError(error).message)
      setBusy(false)
    }
    // Succès → redirection OAuth déclenchée par Better Auth.
  }

  const unlinkGoogle = async () => {
    setBusy(true)
    const { error } = await authClient.unlinkAccount({ providerId: "google" })
    setBusy(false)
    if (error) {
      const code = (error as { code?: string }).code
      // unlinkAccount exige une session « fraîche » (freshAge défaut = 24 h).
      if (code === "SESSION_NOT_FRESH") {
        toast.error(
          "Pour des raisons de sécurité, reconnectez-vous puis réessayez de délier ce compte.",
        )
        return
      }
      // Dernier moyen de connexion : garde native de Better Auth.
      if (code === "FAILED_TO_UNLINK_LAST_ACCOUNT") {
        toast.error(
          "Définissez d'abord un mot de passe pour ne pas perdre l'accès.",
        )
        return
      }
      toast.error(mapAuthError(error).message)
      return
    }
    toast.success("Compte Google délié")
    location.reload()
  }

  const resendVerification = async () => {
    setBusy(true)
    const { error } = await authClient.sendVerificationEmail({ email })
    setBusy(false)
    if (error) {
      toast.error(mapAuthError(error).message)
      return
    }
    toast.success("Email de vérification envoyé")
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
      <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <IconPlugConnected className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-semibold text-gray-900 dark:text-white">
            Méthodes de connexion
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {/* Email + vérification */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <IconMail className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{email}</p>
              {methods.emailVerified ? (
                <Badge variant="secondary" className="mt-1">Vérifié</Badge>
              ) : (
                <Badge variant="destructive" className="mt-1">Non vérifié</Badge>
              )}
            </div>
          </div>
          {!methods.emailVerified && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={resendVerification}
              data-testid="login-method-resend-verification"
            >
              Renvoyer l'email
            </Button>
          )}
        </div>

        {/* Mot de passe */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <IconKey className="h-5 w-5 text-gray-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Mot de passe {methods.hasPassword ? "défini" : "non défini"}
            </p>
          </div>
          {!methods.hasPassword && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSetPassword}
              data-testid="login-method-set-password"
            >
              Définir un mot de passe
            </Button>
          )}
        </div>

        {/* Google */}
        {googleEnabled && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <IconBrandGoogle className="h-5 w-5 text-gray-500" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Google {methods.google.linked ? "connecté" : "non connecté"}
              </p>
            </div>
            {methods.google.linked ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={unlinkGoogle}
                data-testid="login-method-google-unlink"
              >
                Délier
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={linkGoogle}
                data-testid="login-method-google-link"
              >
                Lier Google
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4 : Lancer → passe**

Run: `bun run test profile-login-methods`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add app/(dashboard)/dashboard/profil/_components/profile-login-methods.tsx tests/users/profile-login-methods.test.tsx
git commit -m "feat(profil): composant méthodes de connexion (Google, mot de passe, vérif email)"
```

---

### Task 8 : Composant `ProfilePassword` (change + set)

**Files:**
- Create: `app/(dashboard)/dashboard/profil/_components/profile-password.tsx`

> Extraction du formulaire de mot de passe de l'ancien `profile-security.tsx`, avec
> deux modes : `change` (a un mot de passe → `authClient.changePassword`, champ
> « actuel » présent) et `set` (Google-only → **Server Action** `setAccountPassword`,
> pas de champ « actuel »).
>
> ⚠️ **F1 (revue)** : `setPassword` de Better Auth est un endpoint **SERVER-ONLY**
> (`createAuthEndpoint.serverOnly`, `node_modules/better-auth/dist/api/routes/update-user.mjs:185`)
> → **absent de `authClient`**. On l'appelle via `auth.api.setPassword` depuis une
> Server Action gardée.

- [ ] **Step 0 : Server Action `setAccountPassword` dans `features/users/actions.ts`**

Ajouter les imports (en respectant l'ordre : `@/` avant `@/lib`, `next/*` groupé) :

```ts
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
```

Puis, à la fin du fichier :

```ts
// Définit un mot de passe pour un compte SANS mot de passe (Google-only) → ajoute
// un login email/mot de passe. `setPassword` est server-only côté Better Auth : on
// l'appelle via auth.api depuis cette action gardée. `sensitiveSessionMiddleware`
// (pas `freshSessionMiddleware`) → pas d'exigence de session « fraîche ».
export const setAccountPassword = async (input: {
  newPassword: string
}): Promise<AccountActionResult> => {
  await requireSession()

  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return {
      success: false,
      error: "Le mot de passe doit contenir entre 8 et 128 caractères.",
    }
  }

  try {
    await auth.api.setPassword({
      body: { newPassword: input.newPassword },
      headers: await headers(),
    })
  } catch {
    return { success: false, error: "Impossible de définir le mot de passe." }
  }

  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}
```

- [ ] **Step 1 : Implémenter le composant (pas de test dédié — couvert via l'intégration UI/E2E ; logique triviale au-dessus de méthodes déjà éprouvées)**

```tsx
// app/(dashboard)/dashboard/profil/_components/profile-password.tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { IconKey } from "@tabler/icons-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { setAccountPassword } from "@/features/users/actions"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"
import {
  type ChangePasswordFormValues,
  type ResetPasswordFormValues,
  changePasswordSchema,
  resetPasswordSchema,
} from "@/schemas/auth"

type Props = { mode: "change" | "set" }

export const ProfilePassword = ({ mode }: Props) => {
  if (mode === "set") return <SetPasswordForm />
  return <ChangePasswordForm />
}

const SetPasswordForm = () => {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    const res = await setAccountPassword({ newPassword: values.password })
    if (!res.success) {
      toast.error(res.error ?? "Impossible de définir le mot de passe")
      return
    }
    toast.success("Mot de passe défini — vous pouvez désormais vous connecter par email")
    form.reset()
    location.reload()
  }

  return (
    <PasswordCard title="Définir un mot de passe">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <PasswordField form={form} name="password" label="Nouveau mot de passe" testId="set-new-password" />
          <PasswordField form={form} name="confirmPassword" label="Confirmer le mot de passe" testId="set-confirm-password" />
          <SubmitButton pending={form.formState.isSubmitting} label="Définir le mot de passe" testId="set-password-submit" />
        </form>
      </Form>
    </PasswordCard>
  )
}

const ChangePasswordForm = () => {
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    })
    if (error) {
      toast.error(mapAuthError(error).message)
      return
    }
    toast.success("Mot de passe modifié avec succès")
    form.reset()
  }

  return (
    <PasswordCard title="Modifier le mot de passe">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <PasswordField form={form} name="currentPassword" label="Mot de passe actuel" testId="security-current-password" autoComplete="current-password" />
          <PasswordField form={form} name="newPassword" label="Nouveau mot de passe" testId="security-new-password" />
          <PasswordField form={form} name="confirmPassword" label="Confirmer le nouveau mot de passe" testId="security-confirm-password" />
          <SubmitButton pending={form.formState.isSubmitting} label="Modifier le mot de passe" testId="security-submit" />
        </form>
      </Form>
    </PasswordCard>
  )
}

// --- sous-composants partagés ---

const PasswordCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
    <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
      <CardTitle className="flex items-center gap-3 text-lg">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
          <IconKey className="h-5 w-5 text-white" />
        </div>
        <span className="font-display font-semibold text-gray-900 dark:text-white">{title}</span>
      </CardTitle>
    </CardHeader>
    <CardContent className="p-6">{children}</CardContent>
  </Card>
)

// `form` et `name` typés en `any` local pour rester générique aux 2 schémas ;
// react-hook-form valide au runtime via le resolver zod.
const PasswordField = ({
  form,
  name,
  label,
  testId,
  autoComplete = "new-password",
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  name: string
  label: string
  testId: string
  autoComplete?: string
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }: { field: object }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input type="password" autoComplete={autoComplete} placeholder="••••••••" data-testid={testId} {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)

const SubmitButton = ({ pending, label, testId }: { pending: boolean; label: string; testId: string }) => (
  <Button
    type="submit"
    variant="outline"
    disabled={pending}
    className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/40"
    data-testid={testId}
  >
    <IconKey className="mr-2 h-4 w-4" />
    {pending ? "En cours..." : label}
  </Button>
)
```

- [ ] **Step 2 : Vérifier le typage**

Run: `bun run check`
Expected: exit 0. Si ESLint refuse le `any`, garder le commentaire `eslint-disable-next-line` déjà présent.

- [ ] **Step 3 : Commit**

```bash
git add app/(dashboard)/dashboard/profil/_components/profile-password.tsx
git commit -m "feat(profil): composant mot de passe (modifier + définir pour Google-only)"
```

---

### Task 9 : Câbler les pages profil (dashboard + admin) & supprimer l'ancien `ProfileSecurity`

**Files:**
- Modify: `app/(dashboard)/dashboard/profil/page.tsx`
- Modify: `app/(admin)/admin/profil/page.tsx`
- Delete: `app/(dashboard)/dashboard/profil/_components/profile-security.tsx`

> `ProfileLoginMethods` a besoin d'ouvrir le formulaire « définir un mot de passe ».
> On introduit un petit wrapper client `ProfileAccountSection` qui compose
> login-methods + password et gère l'état d'ouverture, pour éviter de remonter
> l'état dans le Server Component.

- [ ] **Step 1 : Créer le wrapper `ProfileAccountSection`**

Create: `app/(dashboard)/dashboard/profil/_components/profile-account-section.tsx`

```tsx
"use client"

import { useState } from "react"
import type { LoginMethods } from "@/features/users/dal"
import { ProfileLoginMethods } from "./profile-login-methods"
import { ProfilePassword } from "./profile-password"

type Props = {
  methods: LoginMethods
  email: string
  googleEnabled: boolean
  profilePath: string
}

export const ProfileAccountSection = ({ methods, email, googleEnabled, profilePath }: Props) => {
  // Google-only : le formulaire « définir » n'apparaît qu'à la demande.
  const [showSetPassword, setShowSetPassword] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <ProfileLoginMethods
        methods={methods}
        email={email}
        googleEnabled={googleEnabled}
        profilePath={profilePath}
        onSetPassword={() => setShowSetPassword(true)}
      />
      {methods.hasPassword ? (
        <ProfilePassword mode="change" />
      ) : (
        showSetPassword && <ProfilePassword mode="set" />
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Modifier `app/(dashboard)/dashboard/profil/page.tsx`**

Remplacer intégralement par :

```tsx
import { getAccessStatus } from "@/features/payments/dal"
import { getCurrentUser, getLoginMethods, getUserSessions } from "@/features/users/dal"
import { env } from "@/lib/env/server"
import { ProfileAccountSection } from "./_components/profile-account-section"
import { ProfileDangerZone } from "./_components/profile-danger-zone"
import { ProfileHeader } from "./_components/profile-header"
import { ProfilePersonalInfo } from "./_components/profile-personal-info"
import { ProfilePreferences } from "./_components/profile-preferences"
import { ProfileSessions } from "./_components/profile-sessions"
import { ProfileSubscriptionCard } from "./_components/profile-subscription-card"

export default async function ProfilPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil introuvable</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Impossible de charger votre profil. Veuillez réessayer.
          </p>
        </div>
      </div>
    )
  }

  const [accessStatus, methods, sessions] = await Promise.all([
    getAccessStatus(),
    getLoginMethods(),
    getUserSessions(),
  ])
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      <ProfileHeader user={currentUser} />
      <ProfilePersonalInfo user={currentUser} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {methods && (
          <ProfileAccountSection
            methods={methods}
            email={currentUser.email}
            googleEnabled={googleEnabled}
            profilePath="/dashboard/profil"
          />
        )}
        <ProfileSubscriptionCard accessStatus={accessStatus} />
      </div>

      <ProfileSessions sessions={sessions} />
      <ProfilePreferences />
      <ProfileDangerZone email={currentUser.email} />
    </div>
  )
}
```

- [ ] **Step 3 : Modifier `app/(admin)/admin/profil/page.tsx`**

Remplacer intégralement par :

```tsx
import { getCurrentUser, getLoginMethods, getUserSessions } from "@/features/users/dal"
import { env } from "@/lib/env/server"
import { ProfileAccountSection } from "@/app/(dashboard)/dashboard/profil/_components/profile-account-section"
import { ProfileDangerZone } from "@/app/(dashboard)/dashboard/profil/_components/profile-danger-zone"
import { ProfileHeader } from "@/app/(dashboard)/dashboard/profil/_components/profile-header"
import { ProfilePersonalInfo } from "@/app/(dashboard)/dashboard/profil/_components/profile-personal-info"
import { ProfilePreferences } from "@/app/(dashboard)/dashboard/profil/_components/profile-preferences"
import { ProfileSessions } from "@/app/(dashboard)/dashboard/profil/_components/profile-sessions"

export default async function AdminProfilPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil introuvable</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Impossible de charger votre profil. Veuillez réessayer.
          </p>
        </div>
      </div>
    )
  }

  const [methods, sessions] = await Promise.all([getLoginMethods(), getUserSessions()])
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      <ProfileHeader user={currentUser} />
      <ProfilePersonalInfo user={currentUser} />
      {methods && (
        <ProfileAccountSection
          methods={methods}
          email={currentUser.email}
          googleEnabled={googleEnabled}
          profilePath="/admin/profil"
        />
      )}
      <ProfileSessions sessions={sessions} />
      <ProfilePreferences />
      <ProfileDangerZone email={currentUser.email} />
    </div>
  )
}
```

- [ ] **Step 4 : Supprimer l'ancien composant**

```bash
git rm app/(dashboard)/dashboard/profil/_components/profile-security.tsx
```

> Vérifier qu'aucun autre fichier n'importe `ProfileSecurity` :
> `grep -rn "profile-security" app/ tests/` → doit être vide après suppression.

- [ ] **Step 5 : Vérifier + commit**

> `ProfileSessions` et `ProfileDangerZone` sont créés aux Tasks 10-11 ; ce commit
> **ne compile pas seul**. Faire les Tasks 10 et 11 AVANT de lancer `check`/commit,
> OU committer les 3 ensemble. Recommandation : enchaîner Tasks 9→10→11 puis un
> seul `bun run check` et 3 commits successifs (les fichiers ne se chevauchent pas).

```bash
bun run check
git add "app/(dashboard)/dashboard/profil/_components/profile-account-section.tsx" "app/(dashboard)/dashboard/profil/page.tsx" "app/(admin)/admin/profil/page.tsx"
git commit -m "feat(profil): câble méthodes de connexion + mot de passe dans les pages profil"
```

---

## Phase 4 — UI : appareils connectés

### Task 10 : Composant `ProfileSessions`

**Files:**
- Create: `app/(dashboard)/dashboard/profil/_components/profile-sessions.tsx`
- Test: `tests/users/profile-sessions.test.tsx`

- [ ] **Step 1 : Test qui échoue**

```tsx
// tests/users/profile-sessions.test.tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileSessions } from "@/app/(dashboard)/dashboard/profil/_components/profile-sessions"

const revokeUserSession = vi.fn().mockResolvedValue({ success: true })
const revokeOtherUserSessions = vi.fn().mockResolvedValue({ success: true })
vi.mock("@/features/users/actions", () => ({
  revokeUserSession: (...a: unknown[]) => revokeUserSession(...a),
  revokeOtherUserSessions: (...a: unknown[]) => revokeOtherUserSessions(...a),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const base = {
  ipAddress: "1.2.3.4",
  lastActiveLabel: "30 juin 2026, 12:00",
}

describe("ProfileSessions", () => {
  it("marque la session courante et n'affiche pas son bouton révoquer", () => {
    render(
      <ProfileSessions
        sessions={[
          { id: "cur", deviceLabel: "Chrome · Windows", isCurrent: true, ...base },
          { id: "oth", deviceLabel: "Firefox · Linux", isCurrent: false, ...base },
        ]}
      />,
    )
    expect(screen.getByText(/Cet appareil/i)).toBeInTheDocument()
    expect(screen.queryByTestId("session-revoke-cur")).not.toBeInTheDocument()
    expect(screen.getByTestId("session-revoke-oth")).toBeInTheDocument()
  })

  it("appelle revokeUserSession au clic", async () => {
    render(
      <ProfileSessions
        sessions={[{ id: "oth", deviceLabel: "Firefox · Linux", isCurrent: false, ...base }]}
      />,
    )
    fireEvent.click(screen.getByTestId("session-revoke-oth"))
    expect(revokeUserSession).toHaveBeenCalledWith("oth")
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test profile-sessions`
Expected: FAIL.

- [ ] **Step 3 : Implémenter**

```tsx
// app/(dashboard)/dashboard/profil/_components/profile-sessions.tsx
"use client"

import { IconDeviceLaptop, IconLogout } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserSession } from "@/features/users/dal"
import { revokeOtherUserSessions, revokeUserSession } from "@/features/users/actions"

export const ProfileSessions = ({ sessions }: { sessions: UserSession[] }) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const hasOthers = sessions.some((s) => !s.isCurrent)

  const revokeOne = async (id: string) => {
    setBusy(true)
    const res = await revokeUserSession(id)
    setBusy(false)
    if (!res.success) {
      toast.error(res.error ?? "Échec de la révocation")
      return
    }
    toast.success("Appareil déconnecté")
    router.refresh()
  }

  const revokeOthers = async () => {
    setBusy(true)
    const res = await revokeOtherUserSessions()
    setBusy(false)
    if (!res.success) {
      toast.error(res.error ?? "Échec")
      return
    }
    toast.success("Autres appareils déconnectés")
    router.refresh()
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
            <IconDeviceLaptop className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-semibold text-gray-900 dark:text-white">Appareils connectés</span>
        </CardTitle>
        {hasOthers && (
          <Button size="sm" variant="outline" disabled={busy} onClick={revokeOthers} data-testid="session-revoke-others">
            <IconLogout className="mr-2 h-4 w-4" />
            Déconnecter les autres
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-6">
        {sessions.length === 0 && (
          <p className="text-sm text-gray-500">Aucune session active.</p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{s.deviceLabel}</p>
                {s.isCurrent && <Badge variant="secondary">Cet appareil</Badge>}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {s.ipAddress ?? "IP inconnue"} · actif le {s.lastActiveLabel}
              </p>
            </div>
            {!s.isCurrent && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => revokeOne(s.id)} data-testid={`session-revoke-${s.id}`}>
                Déconnecter
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4 : Lancer → passe**

Run: `bun run test profile-sessions`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add app/(dashboard)/dashboard/profil/_components/profile-sessions.tsx tests/users/profile-sessions.test.tsx
git commit -m "feat(profil): liste des appareils connectés + révocation"
```

---

## Phase 5 — UI : zone de danger (suppression) + page d'adieu

### Task 11 : Composant `ProfileDangerZone` + page publique `/compte-supprime`

**Files:**
- Create: `app/(dashboard)/dashboard/profil/_components/profile-danger-zone.tsx`
- Create: `app/compte-supprime/page.tsx`
- Test: `tests/users/profile-danger-zone.test.tsx`

- [ ] **Step 1 : Test qui échoue**

```tsx
// tests/users/profile-danger-zone.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileDangerZone } from "@/app/(dashboard)/dashboard/profil/_components/profile-danger-zone"

const deleteMyAccount = vi.fn().mockResolvedValue({ success: true })
vi.mock("@/features/users/actions", () => ({
  deleteMyAccount: (...a: unknown[]) => deleteMyAccount(...a),
}))
const signOut = vi.fn().mockResolvedValue({})
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: () => signOut() } }))
const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }))

describe("ProfileDangerZone", () => {
  it("désactive la suppression tant que l'email saisi ne correspond pas", () => {
    render(<ProfileDangerZone email="a@b.com" />)
    fireEvent.click(screen.getByTestId("danger-open-delete"))
    const confirm = screen.getByTestId("danger-confirm-delete") as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByTestId("danger-confirm-email"), { target: { value: "a@b.com" } })
    expect(confirm.disabled).toBe(false)
  })

  it("supprime puis déconnecte et redirige", async () => {
    render(<ProfileDangerZone email="a@b.com" />)
    fireEvent.click(screen.getByTestId("danger-open-delete"))
    fireEvent.change(screen.getByTestId("danger-confirm-email"), { target: { value: "a@b.com" } })
    fireEvent.click(screen.getByTestId("danger-confirm-delete"))
    await waitFor(() => expect(deleteMyAccount).toHaveBeenCalledWith({ confirmEmail: "a@b.com" }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/compte-supprime"))
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test profile-danger-zone`
Expected: FAIL.

- [ ] **Step 3 : Implémenter le composant**

```tsx
// app/(dashboard)/dashboard/profil/_components/profile-danger-zone.tsx
"use client"

import { IconAlertTriangle } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deleteMyAccount } from "@/features/users/actions"
import { authClient } from "@/lib/auth-client"

export const ProfileDangerZone = ({ email }: { email: string }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase()

  const onDelete = async () => {
    if (!matches) return
    setBusy(true)
    const res = await deleteMyAccount({ confirmEmail })
    if (!res.success) {
      setBusy(false)
      toast.error(res.error ?? "Suppression impossible")
      return
    }
    await authClient.signOut()
    router.replace("/compte-supprime")
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-red-200 shadow-sm dark:border-red-900/50">
      <CardHeader className="block border-b border-red-100 bg-red-50/50 px-6 py-4 dark:border-red-900/50 dark:bg-red-950/20">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
            <IconAlertTriangle className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-semibold text-red-700 dark:text-red-400">Zone de danger</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          La suppression désactive votre compte immédiatement. Vous avez{" "}
          <strong>30 jours</strong> pour le réactiver en vous reconnectant ; passé
          ce délai, vos données personnelles sont définitivement anonymisées.
        </p>

        {!open ? (
          <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)} data-testid="danger-open-delete">
            Supprimer mon compte
          </Button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-red-200 p-4 dark:border-red-900/50">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Saisissez votre adresse courriel pour confirmer :
            </label>
            <Input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              data-testid="danger-confirm-email"
            />
            <div className="flex gap-2">
              <Button variant="destructive" disabled={!matches || busy} onClick={onDelete} data-testid="danger-confirm-delete">
                {busy ? "Suppression..." : "Supprimer définitivement"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4 : Créer la page d'adieu (publique — hors garde de session)**

```tsx
// app/compte-supprime/page.tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Compte supprimé — NOMAQbanq" }

export default function CompteSupprimePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Votre compte a été désactivé
      </h1>
      <p className="max-w-md text-gray-600 dark:text-gray-400">
        Vous avez 30 jours pour le réactiver : reconnectez-vous simplement avec vos
        identifiants avant la fin du délai. Passé cette date, vos données
        personnelles seront définitivement anonymisées.
      </p>
      <Button asChild>
        <Link href="/auth/sign-in">Se reconnecter</Link>
      </Button>
    </main>
  )
}
```

- [ ] **Step 5 : Lancer les tests UI de la phase, check, commit**

Run: `bun run test profile-danger-zone`
Expected: PASS.

```bash
bun run check
git add "app/(dashboard)/dashboard/profil/_components/profile-danger-zone.tsx" "app/compte-supprime/page.tsx" tests/users/profile-danger-zone.test.tsx
git commit -m "feat(profil): zone de danger (suppression 30 j) + page d'adieu"
```

> **Après Tasks 9-10-11**, lancer un `bun run check` global et vérifier que les
> pages profil compilent (tous les composants importés existent), puis committer le
> câblage de la Task 9 (Step 5) si ce n'est pas déjà fait.

---

## Phase 6 — Edge case inscription + mise à jour des règles

### Task 12 : (E1) Confirmer / affiner le message « email déjà existant »

> **E1 est DÉJÀ géré** (constat post-revue) : `mapAuthError` mappe déjà
> `USER_ALREADY_EXISTS` **et** `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` vers un
> message FR **neutre** ([lib/auth-errors.ts:50-59](../../lib/auth-errors.ts) :
> « Ce courriel ne peut pas être utilisé pour créer un compte. Essayez de vous
> connecter. »), et `sign-up-form.tsx` l'affiche déjà via `mapAuthError` (+ bouton
> « Continuer avec Google »). **Ne pas régresser ce message vers une imposition
> « Google » (F3).** Cette tâche est donc une simple confirmation, avec un
> raffinement de libellé **optionnel**.

**Files:**
- Modify (optionnel) : `lib/auth-errors.ts`

- [ ] **Step 1 : Confirmer le comportement existant**

Vérifier `lib/auth-errors.ts:50-59` (mapping neutre présent) et que
`app/(auth)/auth/sign-up/_components/sign-up-form.tsx` affiche bien
`mapAuthError(signUpError)`. Si le message actuel convient → **E1 satisfait, passer
la tâche** (ne rien committer).

- [ ] **Step 2 (optionnel) : affiner le libellé**

Si on veut aussi orienter vers la réinitialisation, remplacer UNIQUEMENT la chaîne
de message (ne PAS toucher aux `code` matchés) :

```ts
// old
message:
  "Ce courriel ne peut pas être utilisé pour créer un compte. Essayez de vous connecter.",
// new
message:
  "Un compte existe déjà avec cette adresse. Essayez de vous connecter, ou de réinitialiser votre mot de passe.",
```

- [ ] **Step 3 : Si modifié → vérifier + commit**

```bash
bun run check
git add lib/auth-errors.ts
git commit -m "feat(auth): affine le message FR quand l'email existe déjà à l'inscription"
```

---

### Task 13 : Mise à jour de la règle data-layer + revue finale

**Files:**
- Modify: `.claude/rules/data-layer.md`

- [ ] **Step 1 : Amender la section « PII / frontière serveur-client »**

Dans le bullet qui affirme « Les tables Better Auth `account`/`session` ne sont
lues par aucun DAL métier », ajouter la nuance :

```md
- **Exception self-scoped (gestion de compte)** : `getLoginMethods` /
  `getUserSessions` (`features/users/dal.ts`) lisent `account` (`providerId`,
  `createdAt`) et `session` (`ipAddress`, `userAgent`, timestamps, `id`)
  UNIQUEMENT pour l'utilisateur de la session courante, et NE sélectionnent
  JAMAIS `token`, `password`, ni les tokens OAuth. Afficher à l'utilisateur ses
  propres appareils est un affichage volontaire (comme l'activity feed).
```

- [ ] **Step 2 : Revue de couverture finale**

Run: `bun run check && bun run test && bun run test:integration users-account`
Expected: tout PASS, exit 0. Vérifier la couverture (seuil 75 %).

- [ ] **Step 3 : Commit**

```bash
git add .claude/rules/data-layer.md
git commit -m "docs(rules): acte la lecture self-scoped account/session pour la gestion de compte"
```

---

## Notes d'implémentation

- **F1 — `setPassword` server-only** : appelé via la Server Action
  `setAccountPassword` (`auth.api.setPassword`), JAMAIS `authClient.setPassword`
  (qui n'existe pas : endpoint `serverOnly`).
- **F2 — session « fraîche » pour délier** : `unlinkAccount` exige
  `freshSessionMiddleware` (freshAge défaut = 24 h, non overridé). Le composant
  gère l'erreur `SESSION_NOT_FRESH` par un message FR invitant à se reconnecter.
  **Échappatoire zéro-friction** (si la reconnexion forcée est jugée trop lourde) :
  ajouter `session: { freshAge: 0 }` dans `lib/auth.ts` — désactive l'exigence de
  fraîcheur pour TOUS les endpoints sensibles (unlink, deleteUser, changeEmail).
  Tradeoff sécurité : à trancher avec le propriétaire ; par défaut on garde la
  fraîcheur et on gère l'erreur.
- **F4 — sessions actives** : la DAL filtre `expiresAt > now` (pas d'appareil
  expiré listé comme actif) et pré-formate les dates côté serveur (fuseau
  `America/Toronto`) → aucun mismatch d'hydratation.
- **Réactivation silencieuse** : le hook `after` efface `deletedAt` à la
  reconnexion, sans bandeau « compte réactivé » dédié (simplification vs spec §7.2 —
  passer un flag du hook au client demanderait un canal supplémentaire). La page
  d'adieu explique la marche à suivre. Un bandeau explicite reste une amélioration
  future optionnelle.
- **Suppression = `getCurrentUser` renvoie `null`** dès que `deletedAt` est posé
  (le DAL filtre `isNull(user.deletedAt)`), donc la page profil montre « Profil
  introuvable » entre l'action et le `signOut`. Le `router.replace("/compte-supprime")`
  suivant masque cet intermédiaire.
- **Google non configuré** : `googleEnabled=false` masque toute l'UI de liaison —
  aucun bouton mort.
- **Ordre des tests d'intégration** : le `describe` `deleteMyAccount` marque
  l'utilisateur partagé comme supprimé → le garder en dernier (ou utiliser un user
  isolé) pour ne pas casser les lectures DAL.

## Self-Review (fait à l'écriture)

- **Couverture spec** : E1 (Task 12), E2 (natif, documenté), E3 (`setPassword`,
  Tasks 7-8), E4 (`linkSocial`, Task 7), E5 (garde native + message, Task 7), E6
  (renvoi vérif, Task 7), E7 (flux existant, inchangé) ✅. Appareils (Tasks 2-3, 10),
  suppression grâce (Tasks 4-6, 11) ✅.
- **Types cohérents** : `LoginMethods`/`UserSession` définis en Task 2 et
  réutilisés tels quels dans les composants (Tasks 7, 10) et pages (Task 9) ✅.
  `AccountActionResult` défini Task 3, réutilisé Task 4 ✅.
- **Pas de placeholder** : tout le code des steps est concret. Seul `lib/auth-errors.ts`
  (Task 12) exige de lire la forme existante avant l'ajout — étape explicite fournie.

**Corrections post-revue adversariale (2026-06-30)** intégrées : F1 (setPassword →
Server Action), F2 (fraîcheur unlink gérée + échappatoire freshAge), F3 (message E1
neutre), F4 (filtre sessions expirées + dates fuseau fixe), durcissements
(`mapAuthError` FR, `server-only` cron, garde dernier admin).
```
