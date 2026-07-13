# Suivi robustesse réseau (#98 deploy-skew + #99 N+1 cron) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) `callAction` détecte le deploy-skew (`UnrecognizedActionError`) et affiche un toast central « Recharger » sans retry ; (2) les crons de clôture passent en UPDATE ensembliste (arrondi half-up exact) et la route cron devient séquentielle ; (3) `finalizeExam` / `completeTrainingSession` s'alignent sur cet arrondi exact via `lib/score.ts`.

**Architecture:** Partie #98 : tout vit dans `lib/safe-action.ts` (détection `unstable_isUnrecognizedActionError` de `next/navigation` + toast sonner dédupliqué), zéro churn aux 19 call sites. Partie #99 : `features/exams/cron.ts` et `features/training/cron.ts` remplacent leurs boucles d'UPDATE par un `update().set().from(subquery)` Drizzle unique (garde `status='in_progress'` re-vérifiée dans le WHERE final = même sémantique de concurrence) ; l'arrondi half-up exact du SQL devient la référence et les deux actions JS s'y alignent (`computeScorePercent`, arithmétique entière) ; `app/api/cron/close-expired/route.ts` séquentialise les tâches (une connexion froide au lieu de 3-4).

**Tech Stack:** Next 16.2.10 (App Router), Drizzle 0.45 (node-postgres/Neon), sonner 2, Vitest (happy-dom pour `tests/`, node pour `tests/integration/`), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-12-skew-ux-cron-n-plus-1-design.md` (révisée post-revue adversariale du 2026-07-12)

**Préconditions:** branche fraîche depuis `main` à jour (ex. `fix/suivi-skew-cron`). Les docs spec/plan sont formatés Prettier et le rapport de revue supprimé (faits au triage — sinon `bun run check` échoue avant même tsc). Jamais de push sans accord. Messages de commit sans attribution Claude.

---

### Task 1: #98 — détection skew dans `callAction` (TDD)

**Files:**

- Modify: `lib/safe-action.ts`
- Test: `tests/lib/safe-action.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tests/lib/safe-action.test.ts`, ajouter les mocks EN TÊTE de fichier
(avant les imports existants, hoistés par vitest) et le bloc de tests. Le
prédicat Next est mocké (l'e2e de la Task 3 couvre le vrai) ; `sonner` est
mocké pour asserter le toast :

```ts
import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DEPLOY_SKEW_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  callAction,
} from "@/lib/safe-action"

vi.mock("next/navigation", () => ({
  unstable_isUnrecognizedActionError: (err: unknown) =>
    err instanceof Error && err.name === "UnrecognizedActionError",
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})
```

(Le `describe("callAction")` existant est conservé tel quel — seul l'import et
les mocks changent en tête.) Ajouter à la fin du fichier :

```ts
const skewError = () => {
  const e = new Error('Server Action "40dfe0" was not found on the server.')
  e.name = "UnrecognizedActionError"
  return e
}

describe("callAction — deploy skew", () => {
  it("convertit le skew en message dédié, sans jamais retenter", async () => {
    const fn = vi.fn().mockRejectedValue(skewError())
    await expect(callAction(fn, { retries: 2 })).resolves.toEqual({
      success: false,
      error: DEPLOY_SKEW_MESSAGE,
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("affiche le toast central dédupliqué avec l'action Recharger", async () => {
    const fn = vi.fn().mockRejectedValue(skewError())
    await callAction(fn)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      DEPLOY_SKEW_MESSAGE,
      expect.objectContaining({
        id: "deploy-skew",
        duration: Infinity,
        action: expect.objectContaining({ label: "Recharger" }),
      }),
    )
  })

  it("un rejet réseau ordinaire ne déclenche pas le toast central", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(callAction(fn)).resolves.toEqual({
      success: false,
      error: NETWORK_ERROR_MESSAGE,
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun run test tests/lib/safe-action.test.ts`
Expected: FAIL — `DEPLOY_SKEW_MESSAGE` n'est pas exporté (erreur d'import),
les 6 tests existants passent encore une fois l'import corrigé.

- [ ] **Step 3: Implémenter dans `lib/safe-action.ts`**

Remplacer le contenu du fichier par (imports `next/navigation` et `sonner` =
client-safe, l'invariant « aucun import serveur » tient) :

```ts
import { unstable_isUnrecognizedActionError } from "next/navigation"
import { toast } from "sonner"

// Client-safe : aucun import serveur. Convertit les rejets réseau d'un appel
// de Server Action en échec structuré, discriminable par les gardes existants
// (`!res.success` comme `"error" in res`).

export type ActionFailure = { success: false; error: string }

export const NETWORK_ERROR_MESSAGE =
  "Connexion perdue. Vérifiez votre réseau et réessayez."

export const DEPLOY_SKEW_MESSAGE =
  "Une nouvelle version de l'application est disponible. Rechargez la page pour continuer."

const RETRY_DELAY_MS = 1000

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Deploy skew : le bundle périmé POSTe un ID d'action inconnu du nouveau
// serveur — retenter est inutile par construction, seul un rechargement
// répare. Toast émis ICI (exception à « les toasts vivent dans les pages ») :
// plusieurs call sites toastent un message métier hardcodé qui masquerait le
// remède. `id` fixe → dédupliqué, `duration: Infinity` → persiste jusqu'au
// rechargement.
const notifyDeploySkew = () => {
  toast.error(DEPLOY_SKEW_MESSAGE, {
    id: "deploy-skew",
    duration: Infinity,
    action: { label: "Recharger", onClick: () => window.location.reload() },
  })
}

// `retries` est RÉSERVÉ aux actions idempotentes (upserts) : un « Failed to
// fetch » peut survenir alors que la requête a atteint le serveur, le retry
// ré-exécute donc l'action.
export async function callAction<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number },
): Promise<T | ActionFailure> {
  const retries = opts?.retries ?? 0
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (unstable_isUnrecognizedActionError(err)) {
        notifyDeploySkew()
        return { success: false, error: DEPLOY_SKEW_MESSAGE }
      }
      if (attempt < retries) {
        await delay(RETRY_DELAY_MS)
        continue
      }
      return { success: false, error: NETWORK_ERROR_MESSAGE }
    }
  }
}
```

- [ ] **Step 4: Vérifier que tout passe**

Run: `bun run test tests/lib/safe-action.test.ts`
Expected: PASS — 9 tests (6 existants + 3 nouveaux).

- [ ] **Step 5: Gate + commit**

```bash
bun run check
git add lib/safe-action.ts tests/lib/safe-action.test.ts
git commit -m "fix: message dedie + toast Recharger sur deploy-skew (UnrecognizedActionError, jamais de retry)"
```

---

### Task 2: #98 — documenter la règle (et le piège des mocks partiels)

**Files:**

- Modify: `.claude/rules/data-layer.md` (section « Écrans », puce « Appels client de Server Actions »)

- [ ] **Step 1: Compléter la puce `callAction`**

Dans la puce « **Appels client de Server Actions — jamais d'`await` nu** »,
après la phrase sur `{ retries: n }`, insérer :

```markdown
**Deploy skew** : `callAction` détecte `UnrecognizedActionError` (bundle
périmé après déploiement) via `unstable_isUnrecognizedActionError`
(`next/navigation`), ne retente JAMAIS ce cas, renvoie `DEPLOY_SKEW_MESSAGE`
et affiche LUI-MÊME un toast central « Recharger » (id `deploy-skew`,
dédupliqué) — exception assumée à « les toasts vivent dans les pages » :
événement d'infrastructure, plusieurs pages toastent un message métier
hardcodé qui masquerait le remède. Piège tests : un
`vi.mock("next/navigation", …)` PARTIEL dans un test qui fait rejeter une
action via `callAction` doit fournir `unstable_isUnrecognizedActionError`
(ou utiliser `importOriginal`), sinon le rejet frappe le proxy Vitest avec
une erreur cryptique.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/rules/data-layer.md
git commit -m "docs: regle data-layer - gestion deploy-skew centralisee dans callAction"
```

---

### Task 3: #98 — e2e du contrat Next réel

**Files:**

- Create: `e2e/tests/examen-blanc-deploy-skew.spec.ts`
- Modify: `playwright.config.ts` (testMatch `chromium-auth`, après `/examen-blanc-offline\.spec\.ts/`)

- [ ] **Step 1: Écrire le spec e2e**

Modelé sur `examen-blanc-offline.spec.ts` (même seed, même interception),
mais `route.fulfill` renvoie l'en-tête réel `x-nextjs-action-not-found: 1`
(le client Next teste l'en-tête, pas le statut — vérifié dans
`node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js`) :

```ts
import { type APIRequestContext, type Route } from "@playwright/test"
import { expect, test } from "../fixtures/base"

/**
 * Rejoue le scénario Sentry NOMAQBANQ-1B : onglet d'examen ouvert pendant un
 * déploiement → le POST d'action du bundle périmé reçoit
 * `x-nextjs-action-not-found: 1` → le client Next lève
 * `UnrecognizedActionError`. Attendu : toast central « Recharger » persistant,
 * AUCUN retry (même avec `retries: 1` sur saveExamAnswer), rollback vers la
 * réponse persistée, reprise normale une fois l'interception levée.
 */

const SECRET = process.env.E2E_RESET_SECRET
const PREFIX = "[E2E] DeploySkew"

const post = (request: APIRequestContext, data: object) =>
  request.post("/api/e2e", {
    data: { secret: SECRET, ...data },
    failOnStatusCode: false,
  })

const isActionPost = (route: Route) =>
  route.request().method() === "POST" &&
  route.request().url().includes("/evaluation")

let examId = ""

test.describe("Examen Blanc — deploy skew pendant la passation", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 })

  test.beforeAll(async ({ request }) => {
    if (!SECRET) return
    const seed = await post(request, {
      action: "seed-exam",
      title: `${PREFIX} Passation`,
      questionCount: 5,
    })
    examId = (await seed.json()).examId
  })

  test.afterAll(async ({ request }) => {
    if (!SECRET) return
    await post(request, { action: "cleanup", prefix: PREFIX })
  })

  test("skew : toast Recharger, un seul POST, rollback ; levée : la réponse persiste", async ({
    examen,
    page,
    context,
  }) => {
    test.skip(!SECRET, "E2E_RESET_SECRET requis")
    expect(examId).toBeTruthy()

    await examen.goto()
    await examen.clickStartExamById(examId)
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
    await dialog.getByRole("button", { name: "Commencer l'examen" }).click()
    await page.waitForURL(/\/evaluation/, { timeout: 15_000 })
    await examen.acceptWarningOrResume()
    await examen.waitForQuestion(1)

    // Réponse en ligne persistée = valeur attendue du rollback.
    const option0 = page.getByTestId("answer-option-0")
    const option1 = page.getByTestId("answer-option-1")
    await option0.scrollIntoViewIfNeeded()
    const saved = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/evaluation"),
      { timeout: 15_000 },
    )
    await option0.click()
    await expect(option0).toHaveAttribute("data-selected", "true")
    await saved

    // « Déploiement » : le serveur ne reconnaît plus l'ID d'action.
    let intercepted = 0
    await context.route("**/*", (route) => {
      if (!isActionPost(route)) return route.continue()
      intercepted++
      return route.fulfill({
        status: 404,
        headers: { "x-nextjs-action-not-found": "1" },
        body: "",
      })
    })
    await option1.scrollIntoViewIfNeeded()
    await option1.click()

    // Toast central persistant, avec le remède.
    const skewToast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Une nouvelle version de l'application" })
    await expect(skewToast).toBeVisible({ timeout: 10_000 })
    await expect(
      skewToast.getByRole("button", { name: "Recharger" }),
    ).toBeVisible()

    // Pas de retry : le retry réseau (1 s) de saveExamAnswer ne doit PAS
    // s'appliquer au skew — on laisse passer la fenêtre avant de compter.
    await page.waitForTimeout(1_500)
    expect(intercepted).toBe(1)

    // Rollback vers la réponse persistée.
    await expect(option1).not.toHaveAttribute("data-selected", "true")
    await expect(option0).toHaveAttribute("data-selected", "true")

    // Interception levée → le re-clic persiste (parité bundle restaurée).
    await context.unroute("**/*")
    await option1.click()
    await expect(option1).toHaveAttribute("data-selected", "true", {
      timeout: 10_000,
    })
  })
})
```

- [ ] **Step 2: Enregistrer le spec dans le projet `chromium-auth`**

Dans `playwright.config.ts`, ajouter après la ligne
`/examen-blanc-offline\.spec\.ts/,` :

```ts
        /examen-blanc-deploy-skew\.spec\.ts/,
```

- [ ] **Step 3: Lancer le spec ciblé**

Run: `bun run test:e2e e2e/tests/examen-blanc-deploy-skew.spec.ts --reporter=list`
Expected: 1 passed (Playwright démarre le dev server lui-même — ne pas lancer
`bun dev`). Si l'auth flake : supprimer `e2e/.auth/` et relancer.

- [ ] **Step 4: Gate + commit**

Gate e2e = `type-check` + `lint` (règle `.claude/rules/e2e-testing.md` — PAS
`bun run check` pour les tasks e2e) :

```bash
bun run type-check && bun run lint
git add e2e/tests/examen-blanc-deploy-skew.spec.ts playwright.config.ts
git commit -m "test: e2e deploy-skew - en-tete x-nextjs-action-not-found reel, toast Recharger, zero retry"
```

---

### Task 4: #99 — helper `computeScorePercent` + alignement des actions JS (TDD)

L'arrondi half-up **exact** (celui de `round()` SQL numeric, adopté par les
crons en Tasks 5-6) devient la référence. `Math.round((c / t) * 100)` en
float diverge sur les demi-points (23/40 → 57.4999… → 57 au lieu de 58) :
sans cet alignement, un examen auto-soumis (cron) et le même examen soumis
manuellement (`finalizeExam`) différeraient d'un point.

**Files:**

- Create: `lib/score.ts`
- Create: `tests/lib/score.test.ts`
- Modify: `features/exams/actions.ts:829-834` (finalizeExam)
- Modify: `features/training/actions.ts:407-410` (completeTrainingSession)

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/lib/score.test.ts` :

```ts
import { describe, expect, it } from "vitest"
import { computeScorePercent } from "@/lib/score"

describe("computeScorePercent", () => {
  it("0 question → 0", () => {
    expect(computeScorePercent(0, 0)).toBe(0)
  })

  it("cas nominaux", () => {
    expect(computeScorePercent(2, 4)).toBe(50)
    expect(computeScorePercent(1, 3)).toBe(33)
    expect(computeScorePercent(23, 40)).toBe(58) // 57.5 exact — Math.round float donnait 57
    expect(computeScorePercent(40, 40)).toBe(100)
  })

  it("half-up exact pour tout total ≤ 500 (parité avec round() SQL numeric)", () => {
    for (let total = 1; total <= 500; total++) {
      for (let correct = 0; correct <= total; correct++) {
        const hundred = correct * 100
        const remainder = hundred % total
        const base = (hundred - remainder) / total
        const expected = 2 * remainder >= total ? base + 1 : base
        expect(computeScorePercent(correct, total)).toBe(expected)
      }
    }
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun run test tests/lib/score.test.ts`
Expected: FAIL — module `@/lib/score` introuvable.

- [ ] **Step 3: Implémenter `lib/score.ts`**

```ts
// Arrondi half-up EXACT en arithmétique entière — parité stricte avec
// `round(correct * 100.0 / total)` (numeric SQL) des crons de clôture.
// `Math.round((correct / total) * 100)` en float diverge sur les demi-points
// (ex. 23/40 → 57.4999… → 57 au lieu de 58).
export const computeScorePercent = (correct: number, total: number): number =>
  total > 0 ? Math.floor((200 * correct + total) / (2 * total)) : 0
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `bun run test tests/lib/score.test.ts`
Expected: PASS (3 tests, dont le balayage exhaustif).

- [ ] **Step 5: Brancher `finalizeExam`**

Dans `features/exams/actions.ts`, ajouter l'import (groupe `@/`, ordre
Prettier) :

```ts
import { computeScorePercent } from "@/lib/score"
```

puis remplacer :

```ts
const correctAnswers = agg?.correct ?? 0
const totalQuestions = agg?.total ?? 0
const score =
  totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
```

par :

```ts
const correctAnswers = agg?.correct ?? 0
const totalQuestions = agg?.total ?? 0
const score = computeScorePercent(correctAnswers, totalQuestions)
```

- [ ] **Step 6: Brancher `completeTrainingSession`**

Dans `features/training/actions.ts`, ajouter le même import, puis remplacer :

```ts
const correctCount = c?.correct ?? 0
const totalQuestions = s.questionCount
const score =
  totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
```

par :

```ts
const correctCount = c?.correct ?? 0
const totalQuestions = s.questionCount
const score = computeScorePercent(correctCount, totalQuestions)
```

(Aucun autre site de score en JS : `analytics/dal.ts` arrondit des tendances
d'affichage à 1 décimale — hors sujet, ne pas toucher.)

- [ ] **Step 7: Gate + commit**

```bash
bun run check && bun run test
git add lib/score.ts tests/lib/score.test.ts features/exams/actions.ts features/training/actions.ts
git commit -m "fix: score en arithmetique entiere half-up exacte (parite avec l'arrondi SQL des crons)"
```

---

### Task 5: #99 — `features/exams/cron.ts` en UPDATE ensembliste + cas sentinelle 23/40

**Files:**

- Modify: `features/exams/cron.ts` (réécriture complète)
- Modify: `tests/integration/cron-close-expired.test.ts` (seed 40 questions / 23 correctes + assertions)

- [ ] **Step 1: Ajouter le cas sentinelle au test d'intégration (red)**

Dans `tests/integration/cron-close-expired.test.ts` :

1. Après `const pDone = createId()`, ajouter :

```ts
const examHalf = createId()
const pHalf = createId()
const qIdsHalf = Array.from({ length: 40 }, () => createId())
```

2. Dans `beforeAll`, après l'insert des `questions` existant, ajouter :

```ts
await db.insert(questions).values(
  qIdsHalf.map((id, i) => ({
    id,
    question: `QH ${i} ${suffix} ?`,
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectifCmc: `Obj ${suffix}`,
    domain: `CRON-${suffix}`,
  })),
)
```

3. Étendre l'insert des examens et de leurs questions :

```ts
await db
  .insert(exams)
  .values([
    mkExam(examPast, -DAY),
    mkExam(examFuture, DAY),
    mkExam(examHalf, -DAY),
  ])
```

et après l'insert `examQuestions` existant :

```ts
await db.insert(examQuestions).values(
  qIdsHalf.map((questionId, position) => ({
    examId: examHalf,
    questionId,
    position,
  })),
)
```

4. Ajouter la participation au tableau `examParticipations` existant :

```ts
    {
      id: pHalf,
      examId: examHalf,
      userId: U1,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 2 * DAY),
    },
```

5. Après l'insert des `examAnswers` de `pPast`, ajouter :

```ts
// 40 questions, 23 bonnes réponses → 57.5 exact : sentinelle d'arrondi
// half-up (le float JS donnait 57).
await db.insert(examAnswers).values(
  qIdsHalf.slice(0, 23).map((questionId) => ({
    id: createId(),
    participationId: pHalf,
    questionId,
    selectedAnswer: "A",
    isCorrect: true,
  })),
)
```

6. Dans `afterAll`, élargir la purge des questions :

```ts
await db.delete(questions).where(inArray(questions.id, [...qIds, ...qIdsHalf]))
```

(`examHalf` est déjà couvert par `delete(exams).where(eq(exams.createdBy, U1))`.)

7. Dans le premier test de `closeExpiredExamParticipations`, après les
   assertions sur `pPast`, ajouter :

```ts
const half = await statusOf(pHalf)
expect(half?.status).toBe("auto_submitted")
expect(half?.score).toBe(58) // 23/40 = 57.5 exact → 58 (float JS : 57)
```

Note : contre l'implémentation actuelle (float JS), cette assertion vaut 57 —
c'est le « red » de la réécriture. La vérification rouge/verte se fait en un
seul run d'intégration en Task 8 (une branche Neon éphémère par run — pas de
double exécution).

- [ ] **Step 2: Réécrire le module**

Remplacer le contenu de `features/exams/cron.ts` par :

```ts
import { and, eq, lt, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
} from "@/db/schema"

export type CloseExpiredParticipationsResult = { closedCount: number }

/**
 * Ferme les participations `in_progress` dont l'examen est terminé (`endDate < now`),
 * en calculant le score à partir des réponses enregistrées. Appelé par la route cron
 * Vercel.
 *
 * - UNE requête ensembliste (UPDATE … FROM sous-requête bornée à 500) : pas de
 *   N+1, une seule connexion du pool.
 * - Garde `status='in_progress'` re-vérifiée dans le WHERE final : sous READ
 *   COMMITTED la condition est réévaluée sur la version verrouillée de la ligne
 *   → une soumission concurrente gagne, pas de clobber.
 * - Arrondi `round()` numeric = half-up EXACT — la référence du projet ;
 *   `finalizeExam` s'aligne via `computeScorePercent` (lib/score.ts).
 * - Statut de fermeture = `auto_submitted` (parité Convex).
 */
export async function closeExpiredExamParticipations(): Promise<CloseExpiredParticipationsResult> {
  const now = new Date()

  const scored = db
    .select({
      id: examParticipations.id,
      correct:
        sql<number>`(select count(*) filter (where ${examAnswers.isCorrect})
        from ${examAnswers}
        where ${examAnswers.participationId} = ${examParticipations.id})`.as(
          "correct",
        ),
      total: sql<number>`(select count(*)
        from ${examQuestions}
        where ${examQuestions.examId} = ${examParticipations.examId})`.as(
        "total",
      ),
    })
    .from(examParticipations)
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .where(
      and(eq(examParticipations.status, "in_progress"), lt(exams.endDate, now)),
    )
    .limit(500)
    .as("scored")

  const closed = await db
    .update(examParticipations)
    .set({
      status: "auto_submitted",
      score: sql`case when ${scored.total} > 0
        then round(${scored.correct} * 100.0 / ${scored.total})::int
        else 0 end`,
      completedAt: now,
    })
    .from(scored)
    .where(
      and(
        eq(examParticipations.id, scored.id),
        eq(examParticipations.status, "in_progress"),
      ),
    )
    .returning({ id: examParticipations.id })

  return { closedCount: closed.length }
}
```

(`processedCount` supprimé — consommé nulle part, vérifié route + tests.)

- [ ] **Step 3: Gate types/lint**

Run: `bun run check`
Expected: PASS (aucun consommateur de `processedCount`).

- [ ] **Step 4: (pas de commit — commit groupé #99 en Task 8 après l'intégration)**

---

### Task 6: #99 — `features/training/cron.ts` en UPDATE ensembliste

**Files:**

- Modify: `features/training/cron.ts` (réécriture complète)

- [ ] **Step 1: Réécrire le module**

```ts
import { and, eq, lt, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { trainingSessionItems, trainingSessions } from "@/db/schema"

export type CloseExpiredTrainingResult = { closedCount: number }

/**
 * Ferme les sessions d'entraînement `in_progress` expirées (`expiresAt < now`,
 * TTL 24h), score = % d'items corrects sur `questionCount`. Appelé par la route
 * cron Vercel.
 *
 * - UNE requête ensembliste (UPDATE … FROM sous-requête bornée à 100), garde
 *   `status='in_progress'` re-vérifiée dans le WHERE final (idem cron examens) :
 *   pas de clobber d'une complétion concurrente.
 * - Arrondi `round()` numeric = half-up EXACT (référence projet, cf. lib/score.ts).
 * - Statut de fermeture = `abandoned` (parité Convex).
 */
export async function closeExpiredTrainingSessions(): Promise<CloseExpiredTrainingResult> {
  const now = new Date()

  const scored = db
    .select({
      id: trainingSessions.id,
      questionCount: trainingSessions.questionCount,
      correct:
        sql<number>`(select count(*) filter (where ${trainingSessionItems.isCorrect})
        from ${trainingSessionItems}
        where ${trainingSessionItems.sessionId} = ${trainingSessions.id})`.as(
          "correct",
        ),
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, "in_progress"),
        lt(trainingSessions.expiresAt, now),
      ),
    )
    .limit(100)
    .as("scored")

  const closed = await db
    .update(trainingSessions)
    .set({
      status: "abandoned",
      score: sql`case when ${scored.questionCount} > 0
        then round(${scored.correct} * 100.0 / ${scored.questionCount})::int
        else 0 end`,
      completedAt: now,
    })
    .from(scored)
    .where(
      and(
        eq(trainingSessions.id, scored.id),
        eq(trainingSessions.status, "in_progress"),
      ),
    )
    .returning({ id: trainingSessions.id })

  return { closedCount: closed.length }
}
```

- [ ] **Step 2: Gate types/lint**

Run: `bun run check`
Expected: PASS.

---

### Task 7: #99 — route cron séquentielle

**Files:**

- Modify: `app/api/cron/close-expired/route.ts:41-52`

- [ ] **Step 1: Remplacer le `Promise.all` par une séquence**

Remplacer :

```ts
const [
  examParticipations,
  trainingSessions,
  anonymizedAccounts,
  quizRateLimitCleanup,
] = await Promise.all([
  closeExpiredExamParticipations(),
  closeExpiredTrainingSessions(),
  anonymizeExpiredDeletedAccounts(),
  cleanupQuizRateLimits(),
])
```

par :

```ts
// Séquentiel volontairement (Sentry NOMAQBANQ-17) : en parallèle sur un
// pool froid, chaque tâche ouvre sa propre connexion Neon (3-4 handshakes
// de ~100 ms) — le détecteur N+1 flaggait cette rafale. En séquence, la
// première connexion est réutilisée ; un cron de fond n'a pas de latence
// à optimiser.
const examParticipations = await closeExpiredExamParticipations()
const trainingSessions = await closeExpiredTrainingSessions()
const anonymizedAccounts = await anonymizeExpiredDeletedAccounts()
const quizRateLimitCleanup = await cleanupQuizRateLimits()
```

Le reste du handler (dont `sendPendingNotifications()` APRÈS les clôtures, et
la forme de la réponse JSON) est inchangé.

- [ ] **Step 2: Gate types/lint**

Run: `bun run check`
Expected: PASS.

---

### Task 8: #99 — vérification intégration + commit groupé

**Files:** aucun nouveau — exécution des tests.

- [ ] **Step 1: Suite d'intégration (branche Neon éphémère)**

Run: `bun run test:integration`
Expected: PASS, en particulier `cron-close-expired.test.ts` — assertions
existantes inchangées (2/4 = 50, `auto_submitted`/`abandoned`, idempotence,
« laisse les autres ») + le cas sentinelle `pHalf` → score 58 ;
`notifications-cron.test.ts` (garde anti-double-envoi intacte — chemins non
touchés) ; `exam-runner.test.ts`/`training.test.ts` (scores nominaux
inchangés par l'alignement d'arrondi — divergence uniquement sur les
demi-points float, absents des fixtures).

- [ ] **Step 2: Commit groupé #99**

```bash
git add features/exams/cron.ts features/training/cron.ts "app/api/cron/close-expired/route.ts" tests/integration/cron-close-expired.test.ts
git commit -m "perf: cron close-expired - clotures en UPDATE ensembliste et taches sequentielles (N+1 pg-pool.connect)"
```

---

### Task 9: gates finaux

- [ ] **Step 1: Suites complètes**

```bash
bun run check
bun run test
```

Expected: PASS (le seuil de coverage CI reste au-dessus de 80 % —
`lib/score.ts` est couvert à 100 % par son test unit).

- [ ] **Step 2: E2E ciblés (les deux specs réseau)**

Run: `bun run test:e2e e2e/tests/examen-blanc-offline.spec.ts e2e/tests/examen-blanc-deploy-skew.spec.ts --reporter=list`
Expected: 2 passed — l'offline prouve que le chemin réseau ordinaire (retry +
toast métier) n'a pas régressé avec la détection skew en amont.

- [ ] **Step 3: Fin de branche**

Proposer à l'utilisateur : revue d'implémentation adversariale
(`/adversarial-review-prompt`, session séparée), puis push + PR vers `main`
(#98 + #99 en `Closes`). Après déploiement : résoudre NOMAQBANQ-1B et
NOMAQBANQ-17 dans Sentry et surveiller la récidive.
