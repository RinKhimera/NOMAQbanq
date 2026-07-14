# Observabilité & gestion d'erreurs backend (C1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rendre visibles dans Sentry les exceptions serveur aujourd'hui avalées (catch fallback des Server Actions, error boundaries de segment, crons), sans bruit métier ni PII, + corriger le bug 23505 `updateProfile`.

**Architecture:** deux petits helpers `lib/` (`captureServerError` pour la capture centralisée, `getPgErrorCode` pour l'unwrap `.cause` pg), puis remplacement mécanique des `logDev`/blocs inline dans `features/*/actions.ts`, ajout de `Sentry.captureException` dans les 3 boundaries, instrumentation des catch d'isolation des crons. Aucun changement de comportement utilisateur ni de config Sentry.

**Tech Stack:** Next.js 16 · `@sentry/nextjs` (déjà installé) · Vitest (projet frontend, `bun run test`).

**Spec:** `docs/superpowers/specs/2026-07-14-observabilite-erreurs-design.md`

**Préambule (une fois) :** on est sur `main` → créer la branche, puis formater
les docs de campagne (la revue a montré qu'ils cassent le gate Prettier —
constat #4) :

```bash
git checkout -b c1-observabilite
bunx prettier --write docs/superpowers/specs/2026-07-14-observabilite-erreurs-design.md docs/superpowers/plans/2026-07-14-observabilite-erreurs.md docs/superpowers/reviews/2026-07-14-observabilite-erreurs-plan-review.md 2>/dev/null || true
```

(Le rapport de revue est jetable — il sera supprimé, pas committé.)

**Règles projet à respecter :** commits conventionnels, JAMAIS d'attribution Claude. `bun run test` (jamais `bun test`). Commentaires = pourquoi non-évident seulement, pas de narration.

---

### Task 1: `lib/db-errors.ts` — `getPgErrorCode`

**Files:**

- Create: `lib/db-errors.ts`
- Test: `tests/lib/db-errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/db-errors.test.ts
import { describe, expect, it } from "vitest"
import { getPgErrorCode, isPgUniqueViolation } from "@/lib/db-errors"

describe("getPgErrorCode", () => {
  it("lit le code au premier niveau", () => {
    expect(getPgErrorCode({ code: "23505" })).toBe("23505")
  })

  it("remonte la chaîne cause (forme DrizzleQueryError → DatabaseError pg)", () => {
    const err = Object.assign(new Error("query failed"), {
      cause: Object.assign(new Error("db"), { cause: { code: "23001" } }),
    })
    expect(getPgErrorCode(err)).toBe("23001")
  })

  it("renvoie undefined sans code dans la chaîne", () => {
    expect(getPgErrorCode(new Error("boom"))).toBeUndefined()
    expect(getPgErrorCode(null)).toBeUndefined()
    expect(getPgErrorCode("string")).toBeUndefined()
  })

  it("ignore un code non-string", () => {
    expect(getPgErrorCode({ code: 23505 })).toBeUndefined()
  })

  it("borne le parcours à 5 niveaux (pas de boucle infinie sur cycle)", () => {
    const cyclic: { cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(getPgErrorCode(cyclic)).toBeUndefined()

    let deep: unknown = { code: "23505" }
    for (let i = 0; i < 6; i++) deep = { cause: deep }
    expect(getPgErrorCode(deep)).toBeUndefined()
  })
})

describe("isPgUniqueViolation", () => {
  it("détecte 23505 enveloppé", () => {
    expect(isPgUniqueViolation({ cause: { code: "23505" } })).toBe(true)
    expect(isPgUniqueViolation({ cause: { code: "23503" } })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/lib/db-errors.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db-errors'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/db-errors.ts
/**
 * Drizzle enveloppe l'erreur pg (DrizzleQueryError → cause = DatabaseError),
 * parfois sur plusieurs niveaux : on remonte la chaîne `cause` (bornée) jusqu'au
 * premier `code` SQLSTATE. Source de vérité unique — ne pas retester `error.code`
 * en surface dans les actions (branche morte, cf. bug updateProfile 23505).
 */
export const getPgErrorCode = (error: unknown): string | undefined => {
  let cur: unknown = error
  for (let i = 0; i < 5 && cur; i++) {
    if (typeof cur === "object" && "code" in cur) {
      const code = (cur as { code?: unknown }).code
      if (typeof code === "string") return code
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return undefined
}

export const isPgUniqueViolation = (error: unknown): boolean =>
  getPgErrorCode(error) === "23505"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/lib/db-errors.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/db-errors.ts tests/lib/db-errors.test.ts
git commit -m "feat(observabilite): helper getPgErrorCode (unwrap cause pg borné)"
```

---

### Task 2: `lib/observability.ts` — `captureServerError`

**Files:**

- Create: `lib/observability.ts`
- Test: `tests/lib/observability.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/observability.test.ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { captureServerError } from "@/lib/observability"

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ captureException }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  captureException.mockClear()
})

describe("captureServerError", () => {
  it("hors prod : console.error, pas de Sentry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    captureServerError("[test]", new Error("boom"))
    expect(spy).toHaveBeenCalledOnce()
    expect(captureException).not.toHaveBeenCalled()
  })

  it("en prod : console.error + Sentry avec tag action et userId", () => {
    vi.stubEnv("NODE_ENV", "production")
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("boom")
    captureServerError("[finalizeExam]", err, { userId: "u1" })
    expect(spy).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { action: "[finalizeExam]" },
      user: { id: "u1" },
      extra: undefined,
    })
  })

  it("en prod sans contexte : pas d'objet user, detail dans extra", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("boom")
    captureServerError("[cron]", err, { detail: "participation p1" })
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { action: "[cron]" },
      user: undefined,
      extra: { detail: "participation p1" },
    })
  })

  it("inclut detail dans la ligne console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("boom")
    captureServerError("[notif:resultats]", err, { detail: "participation p1" })
    expect(spy).toHaveBeenCalledWith("[notif:resultats] participation p1", err)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/lib/observability.test.ts`
Expected: FAIL — `Cannot find module '@/lib/observability'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/observability.ts
import * as Sentry from "@sentry/nextjs"
import "server-only"

/**
 * Capture d'une exception INATTENDUE côté serveur (catch fallback générique
 * des Server Actions, tâches cron). Les erreurs métier mappées (TIME_UP,
 * ACCESS_EXPIRED, zod, 23505 username…) sont du flux de contrôle : elles ne
 * passent JAMAIS ici — c'est ce qui garde le signal Sentry exploitable.
 *
 * `tag` doit rester statique (cardinalité des tags Sentry) ; les ids
 * dynamiques vont dans `detail` (→ extra). Contexte léger uniquement : pas
 * de payload (PII) dans les événements.
 */
export const captureServerError = (
  tag: string,
  error: unknown,
  context?: { userId?: string; detail?: string },
) => {
  console.error(context?.detail ? `${tag} ${context.detail}` : tag, error)
  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      tags: { action: tag },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.detail ? { detail: context.detail } : undefined,
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/lib/observability.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/observability.ts tests/lib/observability.test.ts
git commit -m "feat(observabilite): captureServerError (Sentry en prod, tag statique, sans PII)"
```

---

### Task 3: `features/users/actions.ts` — fix 23505 + capture

**Files:**

- Modify: `features/users/actions.ts:157-170` (updateProfile), `:228-233` (createAvatarUpload), `:267-273` (confirmAvatarUpload), et tout autre bloc `NODE_ENV !== "production"` du fichier (vérifier par grep — il peut y en avoir au-delà des 3 recensés)
- Test: `tests/features/users-actions-errors.test.ts` (nouveau)

- [ ] **Step 1: Write the failing test**

Le test unitaire mocke la chaîne Drizzle. `server-only` est déjà stubbé par le setup du projet frontend. Mocks module-level requis (les imports de `features/users/actions.ts` tirent env/S3/auth) :

```ts
// tests/features/users-actions-errors.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { setAccountPassword, updateProfile } from "@/features/users/actions"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    limitFn: vi.fn<() => Promise<unknown[]>>(async () => []),
    updateWhere: vi.fn<() => Promise<unknown>>(async () => undefined),
    setPassword: vi.fn<() => Promise<unknown>>(async () => undefined),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: mocks.limitFn }) }),
    }),
    update: () => ({ set: () => ({ where: mocks.updateWhere }) }),
  },
}))
vi.mock("@/db/schema", () => ({ user: {}, session: {} }))
vi.mock("@/features/users/dal", () => ({}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { setPassword: mocks.setPassword } },
}))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "u1", role: "user" } })),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/aws", () => ({ createPresignedUpload: vi.fn() }))
vi.mock("@/lib/cdn", () => ({
  cdnUrl: (p: string) => p,
  avatarStoragePathFromImageValue: () => null,
}))
vi.mock("@/lib/storage", () => ({
  generateAvatarPath: vi.fn(),
  getExtensionFromMimeType: vi.fn(),
  isStorageConfigured: () => false,
  tryDeleteFromStorage: vi.fn(),
  validateImageFile: vi.fn(),
}))
vi.mock("@/lib/upload-rate-limit", () => ({ consumeUploadRateLimit: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

const VALID = { name: "Sam", username: "sam_p", bio: "" }

beforeEach(() => {
  mocks.captureServerError.mockClear()
  mocks.limitFn.mockResolvedValue([]) // pré-check unicité : username libre
})

describe("updateProfile — catch fallback", () => {
  it("23505 enveloppé (course post pré-check) → « déjà pris », PAS de capture Sentry", async () => {
    mocks.updateWhere.mockRejectedValueOnce(
      Object.assign(new Error("query failed"), { cause: { code: "23505" } }),
    )
    const res = await updateProfile(VALID)
    expect(res).toEqual({
      success: false,
      error: "Ce nom d'utilisateur est déjà pris !",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → message neutre + captureServerError(tag, err, userId)", async () => {
    const boom = new Error("connexion perdue")
    mocks.updateWhere.mockRejectedValueOnce(boom)
    const res = await updateProfile(VALID)
    expect(res).toEqual({ success: false, error: "Erreur serveur. Réessayez." })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[updateProfile]",
      boom,
      { userId: "u1" },
    )
  })
})

describe("setAccountPassword — catch filtré APIError (revue #5)", () => {
  it("APIError Better Auth (métier) → message, PAS de capture", async () => {
    const { APIError } = await import("better-auth/api")
    mocks.setPassword.mockRejectedValueOnce(
      new APIError("BAD_REQUEST", { message: "password already set" }),
    )
    const res = await setAccountPassword({ newPassword: "motdepasse123" })
    expect(res).toEqual({
      success: false,
      error: "Impossible de définir le mot de passe.",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → même message + capture", async () => {
    const boom = new Error("Better Auth down")
    mocks.setPassword.mockRejectedValueOnce(boom)
    const res = await setAccountPassword({ newPassword: "motdepasse123" })
    expect(res).toEqual({
      success: false,
      error: "Impossible de définir le mot de passe.",
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[setAccountPassword]",
      boom,
      { userId: "u1" },
    )
  })
})
```

Note exécutant : si le module tire un import non listé ici (le fichier peut avoir bougé), l'erreur au run le nommera — ajouter le `vi.mock` correspondant, façade minimale.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/features/users-actions-errors.test.ts`
Expected: FAIL — le cas 23505 renvoie « Erreur serveur. Réessayez. » (branche morte actuelle : `error.code` testé en surface, or l'erreur est enveloppée)

- [ ] **Step 3: Implement — updateProfile**

Dans `features/users/actions.ts`, remplacer le catch de `updateProfile` (lignes ~157-170) :

```ts
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return { success: false, error: "Ce nom d'utilisateur est déjà pris !" }
    }
    captureServerError("[updateProfile]", error, { userId: session.user.id })
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
```

Imports à ajouter en tête de fichier :

```ts
import { isPgUniqueViolation } from "@/lib/db-errors"
import { captureServerError } from "@/lib/observability"
```

- [ ] **Step 4: Implement — autres blocs du fichier**

Grep de contrôle : `grep -n 'NODE_ENV !== "production"' features/users/actions.ts`
Pour CHAQUE bloc restant (recensés : `createAvatarUpload` ~229, `confirmAvatarUpload` ~268), appliquer la transformation :

```ts
// AVANT
if (process.env.NODE_ENV !== "production") {
  console.error("[nomAction]", error)
}
// APRÈS (userId si une variable userId / session.user.id est en scope, sinon omettre)
captureServerError("[nomAction]", error, { userId })
```

Le grep doit ensuite renvoyer **0 occurrence** dans ce fichier.

**Cas spécial `setAccountPassword` (~:352-359, revue #5)** : catch actuellement
NU (aucun log — invisible au grep NODE_ENV). `auth.api.setPassword` throw aussi
des `APIError` Better Auth métier → capture filtrée :

```ts
import { APIError } from "better-auth/api"
```

```ts
  } catch (error) {
    if (!(error instanceof APIError)) {
      captureServerError("[setAccountPassword]", error, {
        userId: authSession.user.id,
      })
    }
    return { success: false, error: "Impossible de définir le mot de passe." }
  }
```

(Attention : dans cette fonction le retour de `requireSession()` n'est pas
capturé dans une variable aujourd'hui — la fonction commence par
`await requireSession()`. La capturer : `const authSession = await requireSession()`.)

- [ ] **Step 5: Run tests**

Run: `bun run test tests/features/users-actions-errors.test.ts`
Expected: PASS (2 tests)
Puis suite complète : `bun run test`
Expected: PASS (aucune régression — attention aux tests existants qui assertaient un `console.error`)

- [ ] **Step 6: Commit**

```bash
git add features/users/actions.ts tests/features/users-actions-errors.test.ts
git commit -m "fix(users): doublon username 23505 détecté sous course + capture Sentry des erreurs inattendues"
```

---

### Task 4: `features/{exams,training,questions}/actions.ts` — remplacer `logDev`

**Files:**

- Modify: `features/exams/actions.ts` (déf `logDev` :45-47 + 12 appels), `features/training/actions.ts` (déf :36-38 + 6 appels), `features/questions/actions.ts` (déf :51-53 + 8 appels, + refactor `isForeignKeyViolation` :311-327)

- [ ] **Step 1: Transformation mécanique par fichier**

Pour chacun des 3 fichiers :

1. Supprimer la définition locale de `logDev`.
2. Ajouter `import { captureServerError } from "@/lib/observability"`.
3. Lister les appels : `grep -n "logDev(" features/exams/actions.ts` (idem training, questions).
4. Chaque `logDev("[tag]", error)` devient `captureServerError("[tag]", error, { userId })` — `userId` seulement si une variable `userId` ou `session.user.id` existe dans la fonction englobante (c'est le cas de presque toutes ; les actions admin-only sans binding → omettre le 3ᵉ argument).

Invariant à préserver (spec §Principe) : ces appels sont TOUS dans des catch fallback génériques — ne PAS ajouter de capture aux branches d'erreurs métier mappées (`map[error.message]`, FK 23001/23503…).

- [ ] **Step 2: Refactor `isForeignKeyViolation` (questions)**

Dans `features/questions/actions.ts`, remplacer le corps (:313-327) par un wrapper sur le helper partagé (conserver le commentaire existant sur 23001/23503 et la Set) :

```ts
import { getPgErrorCode } from "@/lib/db-errors"

const FK_VIOLATION_CODES = new Set(["23001", "23503"])

const isForeignKeyViolation = (error: unknown): boolean => {
  const code = getPgErrorCode(error)
  return code !== undefined && FK_VIOLATION_CODES.has(code)
}
```

- [ ] **Step 3: Vérifier l'éradication**

Run: `grep -rn "logDev" features/`
Expected: 0 résultat.

- [ ] **Step 4: Run gates**

Run: `bun run test` puis `bunx tsc --noEmit && bunx eslint features/exams/actions.ts features/training/actions.ts features/questions/actions.ts`
Expected: PASS / 0 erreur. (Des tests existants mockant `console.error` autour de ces actions peuvent casser — les adapter en mockant `@/lib/observability`.)

- [ ] **Step 5: Commit**

```bash
git add features/exams/actions.ts features/training/actions.ts features/questions/actions.ts
git commit -m "feat(observabilite): capture Sentry des catch fallback exams/training/questions (remplace logDev)"
```

---

### Task 5: `features/payments/actions.ts` — 6 blocs inline

**Files:**

- Modify: `features/payments/actions.ts:154-157, 225-228, 279-282, 383-386, 425-428, 459-461`

- [ ] **Step 1: Transformation mécanique (5 blocs sur 6)**

Même règle que Task 3 Step 4 pour `recordManualPayment`, `updateManualTransaction`, `deleteManualTransaction`, `createStripeCheckout`, `createCustomerPortal`. Ajouter l'import `captureServerError`. Chemin d'argent → passer `{ userId }` partout où le binding existe.

- [ ] **Step 2: Cas spécial `verifyStripeCheckout` (:411-429, revue #2) — PAS mécanique**

Le `sessionId` vient du paramètre d'URL `?session_id=` (contrôlable/périmable
par l'utilisateur) : `stripe.checkout.sessions.retrieve` throw
`resource_missing` sur tout id invalide, et le catch mappe déjà ça au message
métier « Session non trouvée ou invalide » (le même que le garde anti-IDOR).
C'est un faux fallback — une capture mécanique enverrait à Sentry chaque visite
de la page succès avec un id bidon. Transformation :

```ts
// Helper local en tête de fichier (duck-check — évite d'importer les classes
// d'erreur Stripe pour un seul code)
const isStripeResourceMissing = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "resource_missing"
```

```ts
  } catch (error) {
    if (!isStripeResourceMissing(error)) {
      captureServerError("[verifyStripeCheckout]", error, {
        userId: session.user.id,
      })
    }
    return { success: false, error: "Session non trouvée ou invalide" }
  }
```

Test (ajouter à `tests/features/payments-actions-errors.test.ts`, nouveau —
mêmes mocks que Task 3 adaptés aux imports de `features/payments/actions.ts` ;
mocker `@/lib/stripe` `getStripe` pour faire rejeter `retrieve`) :

```ts
it("session_id invalide (resource_missing) → message métier, PAS de capture", async () => {
  mocks.retrieve.mockRejectedValueOnce(
    Object.assign(new Error("No such checkout.session"), {
      code: "resource_missing",
    }),
  )
  const res = await verifyStripeCheckout("cs_bidon")
  expect(res).toEqual({
    success: false,
    error: "Session non trouvée ou invalide",
  })
  expect(mocks.captureServerError).not.toHaveBeenCalled()
})

it("erreur Stripe inattendue → même message + capture", async () => {
  const boom = new Error("Stripe API down")
  mocks.retrieve.mockRejectedValueOnce(boom)
  const res = await verifyStripeCheckout("cs_x")
  expect(res).toEqual({
    success: false,
    error: "Session non trouvée ou invalide",
  })
  expect(mocks.captureServerError).toHaveBeenCalledWith(
    "[verifyStripeCheckout]",
    boom,
    { userId: "u1" },
  )
})
```

Contrôle : `grep -n 'NODE_ENV !== "production"' features/payments/actions.ts` → 0 occurrence.

- [ ] **Step 3: Run gates**

Run: `bun run test` et `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add features/payments/actions.ts tests/features/payments-actions-errors.test.ts
git commit -m "feat(observabilite): capture Sentry des catch fallback payments (resource_missing exclu)"
```

---

### Task 6: Error boundaries de segment → Sentry

**Files:**

- Modify: `app/error.tsx`, `app/(dashboard)/error.tsx`, `app/(admin)/error.tsx`
- Test: `tests/components/error-boundaries.test.tsx` (nouveau)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/error-boundaries.test.tsx
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DashboardError from "@/app/(dashboard)/error"

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ captureException }))

describe("error boundaries de segment", () => {
  it("remonte l'erreur à Sentry au montage", () => {
    const error = Object.assign(new Error("crash rendu"), { digest: "d1" })
    render(<DashboardError error={error} reset={() => {}} />)
    expect(captureException).toHaveBeenCalledWith(error)
  })
})
```

(Si l'import du composant via l'alias `@/app/(dashboard)/error` pose problème de résolution des parenthèses dans le glob Vitest, utiliser un import relatif `../../app/(dashboard)/error`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/components/error-boundaries.test.tsx`
Expected: FAIL — `captureException` jamais appelé.

- [ ] **Step 3: Implement (3 fichiers, même patch)**

Dans `app/error.tsx`, `app/(dashboard)/error.tsx`, `app/(admin)/error.tsx` :

```tsx
import * as Sentry from "@sentry/nextjs"
```

et dans le `useEffect` existant :

```tsx
useEffect(() => {
  // Doublon SSR voulu : crash serveur = event onRequestError (vraie stack)
  // + cet event digest ; crash client = cet event seul. Ne pas retirer.
  Sentry.captureException(error)
  console.error("Dashboard Error:", error) // ligne existante conservée (libellé propre à chaque fichier)
}, [error])
```

UI strictement inchangée. (`global-error.tsx` reste tel quel — il capture déjà.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/components/error-boundaries.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/error.tsx "app/(dashboard)/error.tsx" "app/(admin)/error.tsx" tests/components/error-boundaries.test.tsx
git commit -m "fix(observabilite): les error boundaries de segment remontent a Sentry"
```

---

### Task 7: Crons & webhook Stripe — rendre visibles les échecs isolés

**Files:**

- Modify: `app/api/cron/close-expired/route.ts:52-91` (helper `run` + appels), `features/notifications/cron.ts:83-91, 153-155`, `features/users/cron.ts:42-44`, `app/api/stripe/webhook/route.ts:38-41, 77-82, 110-113`

- [ ] **Step 1: `close-expired` — catch d'isolation, tag PAR tâche (revue #6)**

Les tags Sentry sont filtrables/alertables, `extra` non — un tag statique par
tâche (cardinalité 5) permet d'alerter par tâche. Le helper `run` prend le tag
en argument (le comportement isolation + `failed=true` + 500 final est
inchangé) :

```ts
const run = async <T>(
  label: string,
  tag: string,
  task: () => Promise<T>,
  empty: T,
): Promise<T> => {
  try {
    return await task()
  } catch (error) {
    failed = true
    captureServerError(tag, error, { detail: label })
    return empty
  }
}
```

Et les 5 appels :

```ts
const examParticipations = await run(
  "clôture examens",
  "[cron:exams]",
  closeExpiredExamParticipations,
  { closedCount: 0 },
)
const trainingSessions = await run(
  "clôture entraînements",
  "[cron:trainings]",
  closeExpiredTrainingSessions,
  { closedCount: 0 },
)
const anonymizedAccounts = await run(
  "anonymisation",
  "[cron:anonymize]",
  anonymizeExpiredDeletedAccounts,
  { anonymizedCount: 0 },
)
const quizRateLimitCleanup = await run(
  "purge rate-limit quiz",
  "[cron:quiz-rl]",
  cleanupQuizRateLimits,
  { deletedCount: 0 },
)
// (l'appel notifications existant, après les clôtures :)
const notifications = await run(
  "notifications",
  "[cron:notifications]",
  sendPendingNotifications,
  { examResultsSent: 0, accessRemindersSent: 0 },
)
```

Import : `import { captureServerError } from "@/lib/observability"`.

- [ ] **Step 2: `features/users/cron.ts` — isolation par ligne de l'anonymisation (revue #3)**

Le catch poison-row (:42-44) n'est jamais vu par le `run()` de la route (la
fonction retourne normalement) — une panne RGPD persistante resterait
invisible. Remplacer le `console.error` (comportement d'isolation inchangé,
conserver le commentaire résilience existant) :

```ts
    } catch (error) {
      captureServerError("[cron:anonymize]", error, { detail: `user ${id}` })
    }
```

Import : `import { captureServerError } from "@/lib/observability"`.
(`user ${id}` = id technique, pas de PII — cohérent avec `participation ${id}`.)

- [ ] **Step 3: Webhook Stripe (revue #1 — l'exclusion du scope initial reposait sur une prémisse fausse)**

`onRequestError` ne se déclenche QUE pour les exceptions que Next capture
lui-même ; ce handler catche puis RETOURNE une `Response` 500 → aucun événement
Sentry aujourd'hui. Instrumenter `app/api/stripe/webhook/route.ts` en conservant
STRICTEMENT les réponses HTTP (le 500 → retry Stripe est le contrat) :

Catch de configuration (:38-41) :

```ts
  } catch (error) {
    captureServerError("[stripe:webhook]", error, { detail: "configuration" })
    return new Response("Server configuration error", { status: 500 })
  }
```

Branche `not_found` (:77-82) — transaction fantôme = vraie anomalie
(cf. audit #81), le 200 est conservé (rejouer ne la fera pas apparaître) :

```ts
if (result.status === "not_found") {
  captureServerError(
    "[stripe:webhook]",
    new Error("aucune transaction pour la session Stripe"),
    { detail: `session ${checkoutSession.id}` },
  )
}
```

Catch de traitement (:110-113) :

```ts
  } catch (error) {
    captureServerError("[stripe:webhook]", error, { detail: event.type })
    return new Response("Webhook handler error", { status: 500 })
  }
```

Le catch de signature invalide (:52-57) reste SANS capture (entrée forgeable
par n'importe qui → bruit) — `console.error` existant conservé.

Import : `import { captureServerError } from "@/lib/observability"`.

- [ ] **Step 4: `notifications/cron.ts` — 2 catch best-effort**

Remplacer les deux `console.error` (marqueur conservé, boucle continue — inchangé ; conserver le commentaire best-effort existant) :

```ts
    } catch (error) {
      captureServerError("[notif:resultats]", error, {
        detail: `participation ${r.participationId}`,
      })
    }
```

```ts
    } catch (error) {
      captureServerError("[notif:acces]", error, { detail: `accès ${r.accessId}` })
    }
```

- [ ] **Step 5: Test du catch webhook (capture + 500 conservé)**

Nouveau `tests/features/stripe-webhook-errors.test.ts` — vérifie le contrat du
catch de traitement (le contrat HTTP complet reste la cible de la campagne C3) :

```ts
import { describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/stripe/webhook/route"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    completeStripeTransaction: vi.fn(),
    constructEventAsync: vi.fn(),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/features/payments/stripe", () => ({
  completeStripeTransaction: mocks.completeStripeTransaction,
  failStripeTransaction: vi.fn(),
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mocks.constructEventAsync },
  }),
  getStripeWebhookSecret: () => "whsec_test",
}))

const request = () =>
  new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: "{}",
  })

describe("webhook Stripe — catch de traitement", () => {
  it("échec de fulfillment → captureServerError + 500 (retry Stripe conservé)", async () => {
    const boom = new Error("Neon down")
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_status: "paid",
          payment_intent: "pi_1",
          amount_total: 100,
          currency: "cad",
        },
      },
    })
    mocks.completeStripeTransaction.mockRejectedValueOnce(boom)

    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      boom,
      { detail: "checkout.session.completed" },
    )
  })
})
```

Run: `bun run test tests/features/stripe-webhook-errors.test.ts`
Expected: PASS. (Si un import du route handler tire un module non mocké, même
règle que Task 3 : l'erreur le nommera, ajouter le `vi.mock` façade.)

- [ ] **Step 6: Adapter les tests cron existants si besoin**

`tests/integration/notifications-cron.test.ts` (et tout test frontend mockant ces modules) : la revue a vérifié qu'AUCUN test n'asserte les `console.error` actuels — si ça a bougé, repointer sur le nouveau libellé (`captureServerError` fait toujours un `console.error` : `[notif:resultats] participation X`).

Run: `bun run test` (frontend). Les tests d'intégration ne tournent PAS dans cette task (coûteux) — ils seront lancés une fois au checkpoint final.

- [ ] **Step 7: Commit**

```bash
git add app/api/cron/close-expired/route.ts features/notifications/cron.ts features/users/cron.ts app/api/stripe/webhook/route.ts tests/features/stripe-webhook-errors.test.ts
git commit -m "feat(observabilite): capture Sentry des echecs isoles (crons, anonymisation RGPD, webhook Stripe)"
```

---

### Task 8: Documentation des patterns + gates finaux

**Files:**

- Modify: `.claude/rules/data-layer.md` (section Server Actions)
- Modify: `docs/superpowers/specs/2026-07-14-observabilite-erreurs-design.md` (statut)

- [ ] **Step 1: Documenter la convention dans data-layer.md**

Ajouter à la section Server Actions de `.claude/rules/data-layer.md` :

```markdown
- **Catch fallback = `captureServerError`** (`lib/observability.ts`) : tag
  statique + `{ userId }` si en scope — JAMAIS de payload (PII). Réservé aux
  exceptions inattendues : les erreurs métier mappées (zod, TIME_UP,
  ACCESS_EXPIRED, 23505 username…) `return fail(...)` sans capture. Codes pg :
  `getPgErrorCode`/`isPgUniqueViolation` (`lib/db-errors.ts`) — ne JAMAIS
  tester `error.code` en surface (Drizzle enveloppe dans `cause`).
```

- [ ] **Step 2: Gates complets**

```bash
bun run check          # prettier + tsc + eslint
bun run test           # suite frontend complète
bun run test:integration  # UNE seule fois (branche Neon éphémère, ~70 s) — payments/notifications/users touchés
```

Expected: tout vert. En cas d'échec d'un test d'intégration sur le libellé des logs cron → adapter le test (Task 7 Step 3), pas le code.

- [ ] **Step 3: Vérification globale d'éradication**

```bash
grep -rn "logDev" features/ app/
grep -rn 'NODE_ENV !== "production"' features/*/actions.ts
```

Expected: 0 résultat aux deux.

- [ ] **Step 4: Supprimer le rapport de revue jetable**

```bash
rm docs/superpowers/reviews/2026-07-14-observabilite-erreurs-plan-review.md
```

(Constats déjà triés et intégrés au spec/plan — le rapport ne se committe pas.)

- [ ] **Step 5: Statut spec + commit final**

Passer le statut du spec à « implémenté » et committer (docs déjà formatés au
préambule ; re-vérifier avec `bun run format:check` sinon `bun run format`) :

```bash
git add .claude/rules/data-layer.md docs/superpowers/specs/2026-07-14-observabilite-erreurs-design.md docs/superpowers/plans/2026-07-14-observabilite-erreurs.md
git commit -m "docs(observabilite): convention captureServerError dans data-layer.md + spec/plan C1"
```

---

## Critères de done (rappel spec)

1. Exception inattendue dans un catch fallback → événement Sentry en prod (tag + userId), message utilisateur neutre inchangé.
2. Crash de rendu `(dashboard)`/`(admin)`/racine → événement Sentry.
3. Erreur métier mappée → AUCUN événement (test Task 3 le verrouille).
4. Doublon username sous course → « déjà pris » (test Task 3).
5. `logDev` + blocs inline disparus (Task 8 Step 3).
6. `bun run check` + `bun run test` + `bun run test:integration` verts.
