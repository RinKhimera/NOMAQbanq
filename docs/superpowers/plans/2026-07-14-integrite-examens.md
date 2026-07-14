# Intégrité & sécurité des examens (C2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fermer 5 failles d'intégrité/sécurité des examens : fuite du contenu (subscribers + restricted), budget-temps contournable via `isAutoSubmit`, race `saveExamAnswer` vs finalize, race `updateExam` vs `startExam`, read `loadExamQuestionExplanations` non borné.

**Architecture:** ancre d'autorisation = `startExam` (seul à créer une participation `in_progress` après vérif fenêtre+accès+audience). On renforce cette invariante : gate participation sur la page de passation + garde `hasAccess` dans le DAL (fuite), garde budget-temps + UPDATE atomique dans `saveExamAnswer`, verrou `FOR UPDATE` commun sur la ligne `exams` (updateExam/startExam), cap zod (explications). Aucun changement de modèle ni de leaderboard.

**Tech Stack:** Next.js 16 · Drizzle/Neon · Vitest (frontend `bun run test` + intégration `bun run test:integration`, branche Neon éphémère ~70-125 s).

**Spec:** `docs/superpowers/specs/2026-07-14-integrite-examens-design.md`

**Préambule (une fois) :** branche sur C1 (pas main) :

```bash
git checkout c1-observabilite
git checkout -b c2-integrite-examens
```

**Règles projet :** commits conventionnels, aucune attribution Claude. `bun run test` (jamais `bun test`). Concurrence = `db.transaction` + `FOR UPDATE` ou UPDATE gardé (READ COMMITTED ne sérialise pas les checks applicatifs). Reads bornés. Erreurs métier mappées → `fail(...)` SANS `captureServerError`.

**Coût des tests d'intégration :** chaque `bun run test:integration` provisionne/détruit une branche Neon. Les tâches écrivent leurs tests d'intégration mais NE les lancent qu'au **checkpoint final (Task 6)** en un seul run. Par tâche : `bunx tsc --noEmit` + `bunx eslint <fichiers>` + tests frontend ciblés.

---

### Task 1: #5 — Cap zod sur `loadExamQuestionExplanations`

**Files:**

- Modify: `features/exams/schemas.ts` (nouveau schéma), `features/exams/actions.ts:56-61` (`loadExamQuestionExplanations`)
- Test: `tests/features/exam-explanations-cap.test.ts` (nouveau, frontend)

- [ ] **Step 1: Write the failing test**

```ts
// tests/features/exam-explanations-cap.test.ts
import { describe, expect, it } from "vitest"
import { MAX_EXAM_QUESTIONS } from "@/features/exams/schemas"
import { loadExamQuestionExplanationsSchema } from "@/features/exams/schemas"

describe("loadExamQuestionExplanationsSchema", () => {
  it("accepte 1 à MAX_EXAM_QUESTIONS ids", () => {
    expect(loadExamQuestionExplanationsSchema.safeParse(["a"]).success).toBe(
      true,
    )
    expect(
      loadExamQuestionExplanationsSchema.safeParse(
        Array(MAX_EXAM_QUESTIONS).fill("a"),
      ).success,
    ).toBe(true)
  })
  it("refuse 0 id et > MAX_EXAM_QUESTIONS ids", () => {
    expect(loadExamQuestionExplanationsSchema.safeParse([]).success).toBe(false)
    expect(
      loadExamQuestionExplanationsSchema.safeParse(
        Array(MAX_EXAM_QUESTIONS + 1).fill("a"),
      ).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/features/exam-explanations-cap.test.ts`
Expected: FAIL — `loadExamQuestionExplanationsSchema` n'existe pas.

- [ ] **Step 3: Add schema**

Dans `features/exams/schemas.ts` (après les autres schémas) — cap =
`MAX_EXAM_QUESTIONS` (constante existante `:6`, = 500), PAS 100 : « Tout déplier »
en résultats (`session-results.tsx:232`) envoie tous les ids d'un examen en UN
appel ; un cap < taille réelle (≤500 schéma / ≤230 formulaire) → `[]` silencieux
→ explications définitivement vides.

```ts
export const loadExamQuestionExplanationsSchema = z
  .array(z.string())
  .min(1)
  .max(MAX_EXAM_QUESTIONS)
```

- [ ] **Step 4: Guard the action**

Dans `features/exams/actions.ts`, `loadExamQuestionExplanations` :

```ts
export const loadExamQuestionExplanations = async (
  questionIds: string[],
): Promise<QuestionExplanationView[]> => {
  await requireSession()
  const parsed = loadExamQuestionExplanationsSchema.safeParse(questionIds)
  if (!parsed.success) return []
  return getExamQuestionExplanations(parsed.data)
}
```

Ajouter `loadExamQuestionExplanationsSchema` à l'import depuis `./schemas`.

- [ ] **Step 5: Run test + lint**

Run: `bun run test tests/features/exam-explanations-cap.test.ts` → PASS
Run: `bunx tsc --noEmit && bunx eslint features/exams/actions.ts features/exams/schemas.ts` → 0 erreur

- [ ] **Step 6: Commit**

```bash
git add features/exams/schemas.ts features/exams/actions.ts tests/features/exam-explanations-cap.test.ts
git commit -m "fix(exams): borne l'entrée de loadExamQuestionExplanations (cap MAX_EXAM_QUESTIONS)"
```

---

### Task 2: #1 — Fuite du contenu d'examen (livraison conditionnelle + garde DAL + paywall)

⚠️ **La page evaluation est le GUICHET d'entrée** (revue constat A) : la liste y
navigue SANS participation (`examen-blanc-client.tsx:447`) et c'est le dialog
« Règles » de cette page qui appelle `startExam` (`evaluation-client.tsx:205`).
Un gate `notFound` sur l'absence de participation casserait tout démarrage. On
conditionne la **livraison des questions**, pas l'accès à la page.

**Files:**

- Modify: `features/exams/dal.ts` (`getExamWithQuestions`, branche subscribers), `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/page.tsx`, `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx`, `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/page.tsx` (paywall, constat E)
- Test: `tests/integration/exam-audience.test.ts` (étendre)

- [ ] **Step 1: Write the failing integration tests**

Ajouter à `tests/integration/exam-audience.test.ts` (réutiliser les helpers de seed du fichier — examens subscribers + user sans accès) :

```ts
describe("getExamWithQuestions — anti-fuite subscribers (C2)", () => {
  it("renvoie null pour un utilisateur SANS accès exam actif", async () => {
    // seed : exam subscribers + user sans userAccess 'exam'
    // (adapter aux helpers existants du fichier)
    const view = await getExamWithQuestions(subscribersExamId)
    expect(view).toBeNull()
  })
  it("renvoie les questions pour un abonné avec accès actif", async () => {
    const view = await getExamWithQuestions(subscribersExamId)
    expect(view?.questions.length).toBeGreaterThan(0)
  })
})
```

Note exécutant : le DAL lit la session via `getCurrentSession` (mockée dans le harnais d'intégration comme les autres tests du fichier — repérer le pattern `mockSession`/`setTestUser` déjà utilisé). Le `hasAccess("exam")` lit `userAccess` : seeder/ne pas seeder la ligne selon le cas.

- [ ] **Step 2: Run to verify failure**

Run: `bun run test:integration exam-audience` (au checkpoint final ; ici, revue de code du diff attendu). Le 1er test doit échouer AVANT le fix (subscribers sans accès reçoit actuellement les questions).

- [ ] **Step 3: DAL — garde subscribers**

Dans `features/exams/dal.ts`, `getExamWithQuestions`, la garde d'audience (après le `if (!isAdmin && exam.audienceType === "restricted") { … }`) : ajouter la branche subscribers.

```ts
if (!isAdmin && exam.audienceType === "subscribers") {
  // Symétrique startExam/saveExamAnswer : l'abonnement actif EST l'autorisation
  // pour un examen subscribers. Anti-fuite du texte des questions à un
  // utilisateur sans entitlement (la fenêtre de dates est gardée par les
  // appelants : page evaluation via participation in_progress, page détail via
  // isClosed).
  if (!(await hasAccess("exam"))) return null
}
```

Import : `import { hasAccess } from "../payments/dal"` (vérifier qu'il n'est pas déjà importé dans dal.ts ; sinon l'ajouter).

- [ ] **Step 4: Page evaluation — livraison conditionnelle des questions**

Réécrire `evaluation/page.tsx` : la page reste accessible sans participation
(guichet d'entrée), mais ne livre les questions QUE si `in_progress`. État
actuel : elle fetch `getExamWithQuestions` PUIS `Promise.all([getExamSession,
getExamAnswersForParticipation])` et redirige seulement si completed. Nouvelle
version :

```tsx
export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = await params

  const session = await getExamSession(examId)

  // Déjà soumis → résumé (UX conservée, évite un examen re-jouable).
  if (session?.status === "completed" || session?.status === "auto_submitted") {
    redirect(`/tableau-de-bord/examen-blanc/${examId}/soumis`)
  }

  const data = await getExamWithQuestions(examId)
  // Non-abonné (DAL → null) : renvoyé vers la carte paywall de la page détail.
  if (!data) redirect(`/tableau-de-bord/examen-blanc/${examId}`)

  // Invariante anti-fuite : les questions ne partent dans le payload RSC que
  // pour une participation in_progress (créée par startExam, seul à vérifier
  // fenêtre+accès+audience). Sans participation → écran de démarrage sans
  // questions ; le client fait router.refresh() après startExam pour les
  // recevoir. Ferme subscribers, restricted ET le pré-fetch pré-fenêtre.
  const inProgress = session?.status === "in_progress"
  const initialAnswersRaw = inProgress
    ? await getExamAnswersForParticipation(examId)
    : []

  return (
    <EvaluationClient
      examId={examId}
      exam={{
        title: data.exam.title,
        completionTime: data.exam.completionTime,
        enablePause: data.exam.enablePause,
        pauseDurationMinutes: data.exam.pauseDurationMinutes,
      }}
      questions={inProgress ? data.questions : []}
      initialSession={session}
      initialAnswersRaw={initialAnswersRaw}
    />
  )
}
```

(Trade-off assumé : on fetch `getExamWithQuestions` même hors `in_progress` pour
récupérer les métadonnées de l'écran de démarrage — coût serveur existant, mais
les questions ne partent PLUS dans le payload. Un lecteur de méta léger serait
une optimisation future, hors scope.)

- [ ] **Step 5: Client — `router.refresh()` après `startExam`**

Dans `evaluation-client.tsx`, `handleStartExam` (après `startExam` réussi) :
aujourd'hui il fait `setServerStartTime` + `setShowWarningDialog(false)` mais la
page ne renvoyait pas de questions au 1er rendu (elles y étaient déjà). Puisque
la page ne les livre plus qu'en `in_progress`, ajouter `router.refresh()` pour
que le Server Component les relivre (l'état client — `serverStartTime`, dialog
fermé — est préservé au travers du refresh) :

```tsx
setServerStartTime(result.startedAt ?? null)
setShowWarningDialog(false)
toast.success("Examen démarré - Bonne chance !")
router.refresh()
```

- [ ] **Step 6: Page détail — paywall au lieu de 404 (constat E)**

Dans `[examId]/page.tsx`, la garde DAL renvoyant `null` pour un non-abonné, un
`notFound()` sec régresse le tunnel d'achat. Récupérer la session AVANT le check
null, et pour un non-admin rendre la carte paywall existante quand `data` est
`null` (ne PAS `notFound`). État actuel : `const data = await
getExamWithQuestions(examId); if (!data) notFound()` PUIS `const session = await
getCurrentSession()`. Réordonner :

```tsx
const session = await getCurrentSession()
const isAdmin = session?.user?.role === "admin"

const data = await getExamWithQuestions(examId)
if (!data) {
  // Non-admin + null = pas d'accès (ou examen confidentiel) → carte paywall,
  // pas un 404 sec (préserve le tunnel d'achat). Admin ne voit null que si
  // l'examen n'existe pas.
  if (isAdmin) notFound()
  return <ExamAccessDeniedCard />
}
```

Extraire le JSX de la carte « Accès non autorisé » actuelle (lignes ~39-73) en
un petit composant local `ExamAccessDeniedCard` (ou l'inliner dans le `return`
ci-dessus), réutilisé par le bloc de garde existant `if (!isAdmin && (!isClosed
|| !examAccess))`. Le message générique « Vous devez avoir un accès exam actif »
convient au cas dominant (non-abonné d'un examen subscribers).

- [ ] **Step 7: Lint + commit**

Run: `bunx tsc --noEmit && bunx eslint features/exams/dal.ts "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/page.tsx" "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx" "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/page.tsx"` → 0 erreur

```bash
git add features/exams/dal.ts "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/page.tsx" "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx" "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/page.tsx" tests/integration/exam-audience.test.ts
git commit -m "fix(exams): ferme la fuite du contenu d'examen (livraison conditionnelle + garde hasAccess + paywall préservé)"
```

---

### Task 3: #2 + #3 — `saveExamAnswer` : budget-temps + transaction anti-race

**Files:**

- Modify: `features/exams/actions.ts` (`saveExamAnswer`)
- Test: `tests/integration/exam-runner.test.ts` (étendre)

- [ ] **Step 1: Write the failing integration tests**

Ajouter à `tests/integration/exam-runner.test.ts` (réutiliser le seed d'examen + participation in_progress du fichier). Tests DÉTERMINISTES (pas d'assertion d'ordre sur `Promise.all`, flaky — constat D) :

```ts
it("saveExamAnswer refuse une réponse au-delà du budget-temps (TIME_UP) et ne la persiste pas", async () => {
  // seed participation in_progress avec startedAt reculé au-delà de
  // completionTime + SAVE_GRACE (ex. startedAt = now - (completionTime*1000 + 60_000))
  const res = await saveExamAnswer({ examId, questionId, selectedAnswer: "A" })
  expect(res).toEqual({ success: false, error: "Temps écoulé." })
  // la réponse reste nulle en base (relire examAnswers)
  const [row] = await db
    .select({ selectedAnswer: examAnswers.selectedAnswer })
    .from(examAnswers)
    .where(
      and(
        eq(examAnswers.participationId, participationId),
        eq(examAnswers.questionId, questionId),
      ),
    )
  expect(row?.selectedAnswer).toBeNull()
})

it("attaque #2 bout-en-bout : réponse hors-temps refusée puis finalize isAutoSubmit tardif → score ne l'inclut pas", async () => {
  // startedAt reculé au-delà du budget ; participation in_progress
  const save = await saveExamAnswer({ examId, questionId, selectedAnswer correctAnswer })
  expect(save.success).toBe(false) // TIME_UP
  const fin = await finalizeExam({ examId, isAutoSubmit: true })
  expect(fin.success).toBe(true)
  // la réponse hors-temps n'a jamais été comptée
  expect(fin.correctAnswers).toBe(0)
})

it("race déterministe : finalize PUIS save → save refusé (session plus active)", async () => {
  const fin = await finalizeExam({ examId, isAutoSubmit: false })
  expect(fin.success).toBe(true)
  // sous le verrou participation, save re-lit un statut terminal → refus propre
  const save = await saveExamAnswer({ examId, questionId, selectedAnswer: "A" })
  expect(save).toEqual({
    success: false,
    error: "Cette session d'examen n'est plus active.",
  })
})
```

Note exécutant : adapter les noms de champs de retour de `finalizeExam` (`correctAnswers`/`score`) à la signature réelle (`actions.ts:845` renvoie `{ score, correctAnswers, totalQuestions }`). Corriger la coquille `selectedAnswer correctAnswer` → `selectedAnswer: correctAnswer` (la bonne réponse, pour prouver qu'elle N'est PAS comptée).

- [ ] **Step 2: Constante + étendre le SELECT exam (hors transaction)**

Constante en tête de fichier (près de `SECONDS_PER_QUESTION`/`resolvePause` ;
NB `MAX_PAUSE_MINUTES` est importé de `schemas.ts`, pas défini ici) :

```ts
const SAVE_GRACE_MS = 10_000
```

Étendre le SELECT exam de `saveExamAnswer` avec `completionTime` :

```ts
const [exam] = await db
  .select({
    startDate: exams.startDate,
    endDate: exams.endDate,
    audienceType: exams.audienceType,
    completionTime: exams.completionTime,
  })
  .from(exams)
  .where(eq(exams.id, examId))
  .limit(1)
```

(`pauseDurationMinutes` inutile : la pause ACTIVE interdit déjà l'écriture — cf.
Step 3 — donc le budget n'a besoin que du cumul figé `totalPauseDurationMs`.)

- [ ] **Step 3: Transaction + verrou participation (race #3) englobant budget + écriture**

Une sous-requête `EXISTS` ne sérialise PAS contre un `finalizeExam` en vol
(READ COMMITTED — constat C). Fermeture complète : verrou de ligne sur la
participation (idiome AGENTS.md), même ligne que `finalizeExam:777`. Réécrire le
bloc de `saveExamAnswer` depuis le SELECT participation actuel (`:620`) jusqu'au
`return { success: true }` (`:666`). La lecture immuable de la question
(appartenance + bonne réponse) reste HORS transaction ; le SELECT participation,
la garde statut/pause, le budget-temps et l'UPDATE passent DANS la transaction.

```ts
// Question immuable (appartenance + bonne réponse) : hors transaction.
const [q] = await db
  .select({ correctAnswer: questions.correctAnswer })
  .from(examQuestions)
  .innerJoin(questions, eq(questions.id, examQuestions.questionId))
  .where(
    and(
      eq(examQuestions.examId, examId),
      eq(examQuestions.questionId, questionId),
    ),
  )
  .limit(1)
if (!q) return fail("Cette question ne fait pas partie de l'examen.")
const isCorrect = q.correctAnswer === selectedAnswer

// Verrou participation englobant check-statut + budget + écriture : sérialise
// avec finalizeExam (qui verrouille la même ligne) → aucune écriture après le
// score (race #3). Budget-temps gardé À L'ÉCRITURE — anti-triche : finalize
// saute TIME_UP quand isAutoSubmit=true (flag client). Narrowing : renvoyer
// la valeur DEPUIS le callback (pas de let capturé — AGENTS.md).
const outcome = await db.transaction(async (tx) => {
  const [p] = await tx
    .select({
      id: examParticipations.id,
      status: examParticipations.status,
      startedAt: examParticipations.startedAt,
      totalPauseDurationMs: examParticipations.totalPauseDurationMs,
      pauseStartedAt: examParticipations.pauseStartedAt,
    })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, userId),
      ),
    )
    .for("update")
    .limit(1)
  if (!p) return { ok: false as const, msg: "Participation introuvable." }
  if (p.status !== "in_progress")
    return {
      ok: false as const,
      msg: "Cette session d'examen n'est plus active.",
    }
  if (p.pauseStartedAt)
    return {
      ok: false as const,
      msg: "Réponse impossible pendant la pause.",
    }

  // Pause ACTIVE déjà exclue → pauseMs = cumul figé uniquement (pas de
  // branche pauseStartedAt : elle serait morte ici — constat H).
  if (!isAdmin && p.startedAt) {
    const pauseMs = p.totalPauseDurationMs ?? 0
    const elapsed = now - p.startedAt.getTime() - pauseMs
    if (elapsed > exam.completionTime * 1000 + SAVE_GRACE_MS)
      return { ok: false as const, msg: "Temps écoulé." }
  }

  await tx
    .update(examAnswers)
    .set({ selectedAnswer, isCorrect })
    .where(
      and(
        eq(examAnswers.participationId, p.id),
        eq(examAnswers.questionId, questionId),
      ),
    )
  return { ok: true as const }
})

if (!outcome.ok) return fail(outcome.msg)
return { success: true } // never return isCorrect (anti-cheat)
```

(L'UPDATE n'a plus besoin de garde `EXISTS` : sous le verrou, le statut
`in_progress` est déjà re-vérifié et ne peut pas changer avant le commit. La
ligne `examAnswers` existe — pré-créée par `startExam` — donc pas de
`updated.length === 0` à gérer.)

- [ ] **Step 4: Lint + commit**

Run: `bunx tsc --noEmit && bunx eslint features/exams/actions.ts` → 0 erreur
Run: `bun run test` (frontend, non-régression) → PASS

```bash
git add features/exams/actions.ts tests/integration/exam-runner.test.ts
git commit -m "fix(exams): budget-temps serveur à l'écriture + transaction anti-race sur saveExamAnswer"
```

---

### Task 4: #4 — Verrou commun `updateExam` / `startExam`

**Files:**

- Modify: `features/exams/actions.ts` (`updateExam`, `startExam`)
- Test: `tests/integration/exams.test.ts` (étendre : race)

- [ ] **Step 1: Write the failing integration test**

Ajouter à `tests/integration/exams.test.ts` :

```ts
it("updateExam et startExam concurrents ne produisent pas de participation sur un set remplacé", async () => {
  // seed exam SANS participation, avec set Q1..Qn ; nouveau set Q1'..Qm'
  const [upd, start] = await Promise.all([
    updateExam({ id: examId /* … nouveau questionIds … */ }),
    startExam({ examId }),
  ])
  // invariant : si start a créé une participation, ses examAnswers correspondent
  // AU set effectivement servi (pas un mélange ancien/nouveau).
  // Vérifier : les questionId de examAnswers == set courant de examQuestions.
})
```

- [ ] **Step 2: `startExam` — verrou sur la ligne exams**

Dans la transaction de `startExam`, AJOUTER un `FOR UPDATE` sur la ligne exams. Aujourd'hui le SELECT exam (`actions.ts` ~443) n'a pas de verrou ; le remplacer :

```ts
const [exam] = await tx
  .select({
    startDate: exams.startDate,
    endDate: exams.endDate,
    audienceType: exams.audienceType,
  })
  .from(exams)
  .where(eq(exams.id, examId))
  .for("update")
  .limit(1)
```

(Le verrou `FOR UPDATE user` existant reste — ordre déterministe : exams après user ; garder cet ordre identique dans updateExam pour éviter tout deadlock croisé. updateExam ne verrouille pas `user`, donc pas de cycle.)

- [ ] **Step 3: `updateExam` — verrou sur la ligne exams**

Le SELECT exam en tête de transaction (`actions.ts:211`) : ajouter `.for("update")` :

```ts
const [exam] = await tx
  .select({ id: exams.id })
  .from(exams)
  .where(eq(exams.id, id))
  .for("update")
  .limit(1)
if (!exam) throw new Error("NOT_FOUND")
```

- [ ] **Step 4: Lint + commit**

Run: `bunx tsc --noEmit && bunx eslint features/exams/actions.ts` → 0 erreur

```bash
git add features/exams/actions.ts tests/integration/exams.test.ts
git commit -m "fix(exams): verrou FOR UPDATE commun sur la ligne examen (updateExam vs startExam)"
```

---

### Task 5: Documentation du pattern

**Files:**

- Modify: `.claude/rules/e2e-testing.md` OU `.claude/rules/data-layer.md` (selon le scope — la garde participation/budget est backend → `data-layer.md`)

- [ ] **Step 1: Documenter l'invariante**

Ajouter à `.claude/rules/data-layer.md` (section Server Actions ou une note examens) :

```markdown
- **Passation d'examen — invariante d'accès** : le contenu des questions n'est
  rendu/écrit que pour une participation `in_progress` (créée par `startExam`,
  seul à vérifier fenêtre+accès+audience). La page evaluation gate sur
  `in_progress` ; `getExamWithQuestions` re-garde `hasAccess("exam")` pour
  `subscribers` (défense en profondeur). Budget-temps anti-triche gardé À
  L'ÉCRITURE (`saveExamAnswer` refuse au-delà de `startedAt + completionTime +
grâce`), pas seulement à la finalisation (`isAutoSubmit` vient du client).
```

- [ ] **Step 2: Commit**

```bash
git add .claude/rules/data-layer.md
git commit -m "docs(exams): invariante passation (participation in_progress + budget à l'écriture)"
```

---

### Task 6: Checkpoint final — intégration + gates complets

- [ ] **Step 1: Formater les docs de campagne**

```bash
bunx prettier --write docs/superpowers/specs/2026-07-14-integrite-examens-design.md docs/superpowers/plans/2026-07-14-integrite-examens.md
```

- [ ] **Step 2: `bun run check`**

Run: `bun run check`
Expected: exit 0 (prettier + tsc + eslint).

- [ ] **Step 3: Suite frontend**

Run: `bun run test`
Expected: PASS (aucune régression).

- [ ] **Step 4: Intégration (un seul run — branche Neon)**

Run: `bun run test:integration`
Expected: PASS. Cibler surtout `exam-audience`, `exam-runner`, `exams`,
`passation-anti-cheat`. En cas d'échec des tests anti-triche existants dû à la
nouvelle garde `hasAccess` subscribers : vérifier que le seed du test donne bien
un `userAccess` 'exam' actif à l'utilisateur non-admin (sinon le DAL renvoie
`null` — comportement voulu, adapter le seed du test, PAS le code).

- [ ] **Step 5: Statut spec + commit final**

Passer le statut du spec à « implémenté » :

```bash
git add docs/superpowers/specs/2026-07-14-integrite-examens-design.md docs/superpowers/plans/2026-07-14-integrite-examens.md
git commit -m "docs(exams): spec/plan C2 + statut implémenté"
```

---

## Critères de done (rappel spec)

1. Utilisateur sans participation `in_progress` → page evaluation `notFound` ; DAL subscribers sans accès → `null`.
2. Réponse au-delà du budget-temps refusée et non persistée (quel que soit `isAutoSubmit`).
3. Réponse concurrente à une finalisation refusée (UPDATE gardé).
4. `updateExam`/`startExam` concurrents → participation cohérente avec le set servi.
5. `loadExamQuestionExplanations` borné à 100 ids.
6. `bun run check` + `bun run test` + `bun run test:integration` verts.
