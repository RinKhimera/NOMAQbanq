# Refonte & unification passation/résultats (Feature 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unifier l'expérience de passation (examen + entraînement) et de résultats derrière une coquille `<QuizRunner>` unique pilotée par un hook headless et un descripteur de mode, tout en appliquant les décisions d'audit (persistance serveur par réponse, pause de repos, mode tuteur/test, écran de confirmation).

**Architecture:** Backend d'abord (persistance par réponse + finalisation + pause simplifiée + mode entraînement), puis la couche front partagée (`useQuizSession` + `useExamTimer` + `<QuizRunner>`), puis les résultats unifiés (`<SessionResults>`), les écrans d'entrée/confirmation, le cutover et le nettoyage. Les divergences examen/entraînement deviennent des données de `QuizMode`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM + Neon Postgres, Better Auth, Tailwind v4 + shadcn/ui, Vitest (happy-dom + integration node), Playwright. Bun pour tout (`bun run …`).

**Spec source :** [`docs/superpowers/specs/2026-06-28-refonte-unification-sessions-quiz-design.md`](../specs/2026-06-28-refonte-unification-sessions-quiz-design.md)

**Branche :** `feat/refonte-quiz-audience-images` (déjà créée — ne pas travailler sur `main`).

---

## ⚠️ Pré-requis bloquant (ordonnancement — § G de la spec)

La pré-création des lignes `examAnswers` au démarrage + le `finalizeExam` qui lit
le score en base **cassent les participations `in_progress` en vol** au moment du
déploiement (aucune ligne `examAnswers` → score 0). **Avant** d'appliquer la
migration en production : drainer les participations `in_progress`
(auto-soumission) ou choisir une fenêtre sans examen actif. Voir **Task C7**.

---

## File Structure

**Backend (Phase A) — modifiés :**
- `db/schema/enums.ts` — ajout enum `trainingMode`.
- `db/schema/training.ts` — colonne `mode`.
- `db/schema/exams.ts` — `examAnswers.selectedAnswer` nullable + `isCorrect` nullable ; drop colonnes pause obsolètes de `examParticipations`.
- `features/exams/schemas.ts` — `saveExamAnswerSchema`, `saveExamFlagSchema`, `finalizeExamSchema` ; retrait de `submitExamAnswersSchema`.
- `features/exams/actions.ts` — `saveExamAnswer`, `saveExamFlag`, `finalizeExam`, `pauseExam`, `resumeExam` ; `startExam` pré-crée les réponses ; retrait de `submitExamAnswers`/`startPause`/`resumeFromPause`.
- `features/exams/dal.ts` — `ExamSessionView` simplifié ; `QuestionExplanationView` (canal explication).
- `features/training/schemas.ts` — `mode` dans `createTrainingSessionSchema`.
- `features/training/actions.ts` — `createTrainingSession` (mode) ; `saveTrainingAnswer` (révélation tuteur).
- `features/training/dal.ts` — `getTrainingSessionById` masque `isCorrect` hors tuteur ; révélation tuteur des items répondus.

**Backend (Phase A) — créés :**
- `tests/integration/exam-runner.test.ts` — saveExamAnswer/saveExamFlag/finalizeExam/pause.
- `tests/integration/training-mode.test.ts` — mode tuteur/test + anti-fuite.
- `tests/integration/passation-anti-cheat.test.ts` — test paramétré anti-triche.

**Front partagé (Phase B) — créés :**
- `components/quiz/runner/types.ts` — `QuizMode`, `QuizQuestion`, `AnswerState`, `AnswersMap`.
- `components/quiz/runner/use-exam-timer.ts` — sous-hook chrono.
- `components/quiz/runner/use-quiz-session.ts` — hook headless.
- `components/quiz/runner/quiz-runner.tsx` — coquille présentationnelle.
- `tests/components/quiz/use-quiz-session.test.ts`, `tests/components/quiz/use-exam-timer.test.ts`.

**Front partagé (Phase B) — modifiés :**
- `app/(dashboard)/dashboard/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx` — devient un fin wrapper de `<QuizRunner>`.
- `app/(dashboard)/dashboard/entrainement/_components/training-session-client.tsx` — idem.

**Résultats & écrans (Phase C) — créés :**
- `components/quiz/results/session-results.tsx` — résultats unifiés.
- `app/(dashboard)/dashboard/examen-blanc/[examId]/soumis/page.tsx` + `_components/confirmation-client.tsx`.

**Résultats & écrans (Phase C) — supprimés :**
- `lib/exam-storage.ts`, `components/quiz/pause-approaching-alert.tsx`, helpers morts de `lib/exam-timer.ts`, `components/quiz/results/participant-exam-results-view.tsx`, `app/(dashboard)/dashboard/entrainement/_components/training-results-client.tsx`.
- ⚠️ **NE PAS** supprimer `components/quiz/quiz-results.tsx` (utilisé par la vitrine).

---

# PHASE A — Schéma & backend

> **⚠️ Note commits (gate `bun run check` = 0 erreur — revue #5) :** les tâches
> A1→A8 forment une migration **interdépendante**. Ne committer une tâche que si
> `bun run check` (tsc + eslint) passe ; sinon **regrouper** les commits
> interdépendants en un seul commit vert. Les `Expected: erreurs uniquement dans …`
> signalent des états transitoires à NE PAS committer isolément. En particulier,
> le retrait de `submitExamAnswers` (A5) et `startPause`/`resumeFromPause` (A6)
> **doit** s'accompagner de la migration des tests existants (**Task A10**) dans
> le même changement, sinon la CI reste rouge.

## Task A1 : Migration de schéma

**Files:**
- Modify: `db/schema/enums.ts`
- Modify: `db/schema/training.ts:24`
- Modify: `db/schema/exams.ts:86-89,115-116`

- [ ] **Step 1 : Ajouter l'enum `trainingMode`**

Dans `db/schema/enums.ts`, après `trainingStatus` :

```ts
export const trainingMode = pgEnum("training_mode", ["tutor", "test"])
```

- [ ] **Step 2 : Ajouter la colonne `mode` à `trainingSessions`**

Dans `db/schema/training.ts`, importer l'enum et ajouter la colonne après `status` :

```ts
import { trainingMode, trainingStatus } from "./enums"
// …
    status: trainingStatus("status").notNull(),
    mode: trainingMode("mode").default("test").notNull(),
```

- [ ] **Step 3 : Simplifier `examParticipations` et `examAnswers`**

Dans `db/schema/exams.ts` :
- Retirer l'import `examPausePhase` et les colonnes `pausePhase`, `pauseEndedAt`, `isPauseCutShort` de `examParticipations` (garder `pauseStartedAt` et `totalPauseDurationMs`).
- Rendre `examAnswers.selectedAnswer` et `examAnswers.isCorrect` nullables (lignes pré-créées non répondues) :

```ts
    selectedAnswer: text("selected_answer"),       // null tant que non répondu
    isCorrect: boolean("is_correct"),              // null tant que non répondu
```

> `examPausePhase` reste défini dans `enums.ts` tant que la migration de drop n'est pas appliquée ; le retirer de `enums.ts` une fois la migration générée si plus aucun usage.

- [ ] **Step 4 : Générer la migration**

Run: `bun run db:generate`
Expected: un nouveau fichier SQL sous `drizzle/` contenant `CREATE TYPE … training_mode`, `ALTER TABLE training_sessions ADD COLUMN mode`, `ALTER TABLE exam_answers ALTER COLUMN selected_answer DROP NOT NULL` (+ `is_correct`), `ALTER TABLE exam_participations DROP COLUMN pause_phase, …`.

- [ ] **Step 5 : Inspecter le SQL généré**

Ouvrir le fichier de migration et vérifier : `mode` a `DEFAULT 'test' NOT NULL` ; les `DROP COLUMN` ciblent bien `pause_phase`, `pause_ended_at`, `is_pause_cut_short` ; aucun `DROP` involontaire.

- [ ] **Step 6 : Appliquer sur la base de dev**

Run: `bun run db:migrate`
Expected: migration appliquée sans erreur.

- [ ] **Step 7 : Commit**

```bash
git add db/schema/enums.ts db/schema/training.ts db/schema/exams.ts drizzle/
git commit -m "feat(db): mode entraînement, examAnswers nullable, drop colonnes pause obsolètes"
```

---

## Task A2 : Schémas zod des actions examen

**Files:**
- Modify: `features/exams/schemas.ts`

- [ ] **Step 1 : Remplacer `submitExamAnswersSchema` par les nouveaux schémas**

Retirer `submitExamAnswersSchema` + `SubmitExamAnswersInput`. Ajouter :

```ts
export const saveExamAnswerSchema = z.object({
  examId: z.string().min(1),
  questionId: z.string().min(1),
  selectedAnswer: z.string().min(1),
})
export type SaveExamAnswerInput = z.infer<typeof saveExamAnswerSchema>

export const saveExamFlagSchema = z.object({
  examId: z.string().min(1),
  questionId: z.string().min(1),
  isFlagged: z.boolean(),
})
export type SaveExamFlagInput = z.infer<typeof saveExamFlagSchema>

export const finalizeExamSchema = z.object({
  examId: z.string().min(1),
  isAutoSubmit: z.boolean().optional(),
})
export type FinalizeExamInput = z.infer<typeof finalizeExamSchema>
```

- [ ] **Step 2 : Vérifier la compilation des types**

Run: `bunx tsc --noEmit`
Expected: erreurs UNIQUEMENT dans `features/exams/actions.ts` (références à `submitExamAnswersSchema`) — corrigées en A4. Pas d'autre régression de type.

- [ ] **Step 3 : Commit**

```bash
git add features/exams/schemas.ts
git commit -m "feat(exams): schémas saveExamAnswer/saveExamFlag/finalizeExam"
```

---

## Task A3 : `startExam` pré-crée les lignes `examAnswers`

**Files:**
- Modify: `features/exams/actions.ts:361-459` (fonction `startExam`)
- Test: `tests/integration/exam-runner.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)**

Créer `tests/integration/exam-runner.test.ts` (suivre l'en-tête/imports de `tests/integration/exams.test.ts` existant pour le setup de branche Neon + seed) :

```ts
import { and, eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import { examAnswers, examParticipations } from "@/db/schema"
import { startExam } from "@/features/exams/actions"
// + helpers de seed: createUser, grantExamAccess, createExamWithQuestions, asUser (mock session)

describe("startExam pré-création", () => {
  it("crée une ligne examAnswers (selectedAnswer null) par question", async () => {
    const { userId, examId, questionIds } = await seedExam({ questionCount: 3 })
    await asUser(userId, async () => {
      const res = await startExam({ examId })
      expect(res.success).toBe(true)
    })
    const [p] = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(eq(examParticipations.examId, examId))
    const rows = await db
      .select()
      .from(examAnswers)
      .where(eq(examAnswers.participationId, p.id))
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.selectedAnswer === null)).toBe(true)
  })
})
```

- [ ] **Step 2 : Lancer le test (échec)**

Run: `bun run test:integration -- exam-runner`
Expected: FAIL — `rows` vide (pas de pré-création).

- [ ] **Step 3 : Implémenter la pré-création**

Dans `startExam`, à l'intérieur de la transaction, juste après `tx.insert(examParticipations).values({…})` (branche création) :

```ts
const examQs = await tx
  .select({ questionId: examQuestions.questionId })
  .from(examQuestions)
  .where(eq(examQuestions.examId, examId))
if (examQs.length > 0) {
  await tx.insert(examAnswers).values(
    examQs.map((q) => ({
      participationId,
      questionId: q.questionId,
      selectedAnswer: null,
      isCorrect: null,
      isFlagged: false,
    })),
  )
}
```

Retirer `pausePhase` de l'insert de participation (la colonne n'existe plus) ; le résultat retourné ne porte plus `pausePhase`.

- [ ] **Step 4 : Lancer le test (succès)**

Run: `bun run test:integration -- exam-runner`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add features/exams/actions.ts tests/integration/exam-runner.test.ts
git commit -m "feat(exams): startExam pré-crée les lignes examAnswers"
```

---

## Task A4 : `saveExamAnswer` + `saveExamFlag`

**Files:**
- Modify: `features/exams/actions.ts`
- Test: `tests/integration/exam-runner.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

Ajouter à `exam-runner.test.ts` :

```ts
describe("saveExamAnswer", () => {
  it("met à jour la ligne et ne renvoie JAMAIS isCorrect", async () => {
    const { userId, examId, questionIds, correctByQid } = await seedExam({ questionCount: 2 })
    await asUser(userId, async () => {
      await startExam({ examId })
      const res = await saveExamAnswer({
        examId,
        questionId: questionIds[0],
        selectedAnswer: correctByQid[questionIds[0]],
      })
      expect(res).toEqual({ success: true }) // pas de champ isCorrect
    })
    const [row] = await db.select().from(examAnswers)
      .where(eq(examAnswers.questionId, questionIds[0]))
    expect(row.selectedAnswer).toBe(correctByQid[questionIds[0]])
    expect(row.isCorrect).toBe(true) // calculé serveur, stocké
  })

  it("refuse une réponse pendant la pause", async () => {
    const { userId, examId, questionIds } = await seedExam({ questionCount: 2, enablePause: true })
    await asUser(userId, async () => {
      await startExam({ examId })
      await pauseExam({ examId })
      const res = await saveExamAnswer({ examId, questionId: questionIds[0], selectedAnswer: "x" })
      expect(res.success).toBe(false)
    })
  })
})
```

- [ ] **Step 2 : Lancer (échec)**

Run: `bun run test:integration -- exam-runner`
Expected: FAIL — `saveExamAnswer`/`pauseExam` non définis.

- [ ] **Step 3 : Implémenter `saveExamAnswer`**

Dans `features/exams/actions.ts` :

```ts
export const saveExamAnswer = async (
  input: SaveExamAnswerInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  const parsed = saveExamAnswerSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, selectedAnswer } = parsed.data

  try {
    if (!isAdmin && !(await hasAccess("exam"))) return fail("Votre accès aux examens a expiré.")

    const now = Date.now()
    const [exam] = await db
      .select({ startDate: exams.startDate, endDate: exams.endDate })
      .from(exams).where(eq(exams.id, examId)).limit(1)
    if (!exam) return fail("Examen introuvable.")
    if (now < exam.startDate.getTime() || now > exam.endDate.getTime())
      return fail("L'examen n'est pas disponible à cette période.")

    const [p] = await db
      .select({ id: examParticipations.id, status: examParticipations.status, pauseStartedAt: examParticipations.pauseStartedAt })
      .from(examParticipations)
      .where(and(eq(examParticipations.examId, examId), eq(examParticipations.userId, userId)))
      .limit(1)
    if (!p) return fail("Participation introuvable.")
    if (p.status !== "in_progress") return fail("Cette session d'examen n'est plus active.")
    if (p.pauseStartedAt) return fail("Réponse impossible pendant la pause.")

    const [q] = await db
      .select({ correctAnswer: questions.correctAnswer })
      .from(examQuestions)
      .innerJoin(questions, eq(questions.id, examQuestions.questionId))
      .where(and(eq(examQuestions.examId, examId), eq(examQuestions.questionId, questionId)))
      .limit(1)
    if (!q) return fail("Cette question ne fait pas partie de l'examen.")

    const isCorrect = q.correctAnswer === selectedAnswer
    const updated = await db
      .update(examAnswers)
      .set({ selectedAnswer, isCorrect })
      .where(and(eq(examAnswers.participationId, p.id), eq(examAnswers.questionId, questionId)))
      .returning({ id: examAnswers.id })
    // ⚠️ 0 ligne = pas de ligne pré-créée (participation héritée / cutover sauté) → échec explicite,
    // pas de faux succès silencieux (revue #8).
    if (updated.length === 0) return fail("Réponse non enregistrée (session incohérente).")

    return { success: true } // ⚠️ ne JAMAIS renvoyer isCorrect (anti-triche)
  } catch (error) {
    logDev("[saveExamAnswer]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
```

- [ ] **Step 4 : Implémenter `saveExamFlag`**

```ts
export const saveExamFlag = async (
  input: SaveExamFlagInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const parsed = saveExamFlagSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, isFlagged } = parsed.data
  try {
    const [p] = await db
      .select({ id: examParticipations.id, status: examParticipations.status })
      .from(examParticipations)
      .where(and(eq(examParticipations.examId, examId), eq(examParticipations.userId, session.user.id)))
      .limit(1)
    if (!p) return fail("Participation introuvable.")
    if (p.status !== "in_progress") return fail("Cette session d'examen n'est plus active.")
    const updated = await db
      .update(examAnswers)
      .set({ isFlagged })
      .where(and(eq(examAnswers.participationId, p.id), eq(examAnswers.questionId, questionId)))
      .returning({ id: examAnswers.id })
    if (updated.length === 0) return fail("Marquage non enregistré (session incohérente).")
    return { success: true }
  } catch (error) {
    logDev("[saveExamFlag]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
```

- [ ] **Step 5 : Lancer (succès partiel)**

Run: `bun run test:integration -- exam-runner`
Expected: le test `saveExamAnswer` PASS ; le test « refuse pendant la pause » échoue encore (pauseExam défini en A6). C'est attendu — il passera après A6.

- [ ] **Step 6 : Commit**

```bash
git add features/exams/actions.ts tests/integration/exam-runner.test.ts
git commit -m "feat(exams): saveExamAnswer (anti-révélation) + saveExamFlag"
```

---

## Task A5 : `finalizeExam` (remplace `submitExamAnswers`)

**Files:**
- Modify: `features/exams/actions.ts` (retirer `submitExamAnswers`, ajouter `finalizeExam`)
- Test: `tests/integration/exam-runner.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)**

```ts
describe("finalizeExam", () => {
  it("calcule le score depuis les lignes en base", async () => {
    const { userId, examId, questionIds, correctByQid } = await seedExam({ questionCount: 4 })
    await asUser(userId, async () => {
      await startExam({ examId })
      await saveExamAnswer({ examId, questionId: questionIds[0], selectedAnswer: correctByQid[questionIds[0]] })
      await saveExamAnswer({ examId, questionId: questionIds[1], selectedAnswer: correctByQid[questionIds[1]] })
      await saveExamAnswer({ examId, questionId: questionIds[2], selectedAnswer: "mauvaise" })
      const res = await finalizeExam({ examId })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.correctAnswers).toBe(2)
        expect(res.totalQuestions).toBe(4)
        expect(res.score).toBe(50)
      }
    })
    const [p] = await db.select({ status: examParticipations.status, score: examParticipations.score })
      .from(examParticipations).where(eq(examParticipations.examId, examId))
    expect(p.status).toBe("completed")
    expect(p.score).toBe(50)
  })
})
```

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test:integration -- exam-runner` → FAIL (`finalizeExam` non défini).

- [ ] **Step 3 : Implémenter `finalizeExam` et supprimer `submitExamAnswers`**

```ts
export type FinalizeExamResult =
  | { success: true; score: number; correctAnswers: number; totalQuestions: number }
  | { success: false; error: string }

export const finalizeExam = async (
  input: FinalizeExamInput,
): Promise<FinalizeExamResult> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  const parsed = finalizeExamSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, isAutoSubmit } = parsed.data

  try {
    const result = await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({ startDate: exams.startDate, endDate: exams.endDate, completionTime: exams.completionTime })
        .from(exams).where(eq(exams.id, examId)).limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const now = Date.now()
      if (now < exam.startDate.getTime() || now > exam.endDate.getTime()) throw new Error("OUTSIDE_WINDOW")

      const [p] = await tx
        .select({
          id: examParticipations.id, status: examParticipations.status,
          startedAt: examParticipations.startedAt,
          pauseStartedAt: examParticipations.pauseStartedAt,
          totalPauseDurationMs: examParticipations.totalPauseDurationMs,
        })
        .from(examParticipations)
        .where(and(eq(examParticipations.examId, examId), eq(examParticipations.userId, userId)))
        .for("update").limit(1)
      if (!p) throw new Error("NOT_FOUND_PART")
      if (p.status === "completed" || p.status === "auto_submitted") throw new Error("ALREADY_TAKEN")
      if (p.status !== "in_progress") throw new Error("NOT_IN_PROGRESS")

      // Accès payant re-vérifié (parité avec l'ancien submit). [F2 raffinera pour les examens restreints.]
      if (!isAdmin) {
        const [acc] = await tx.select({ expiresAt: userAccess.expiresAt }).from(userAccess)
          .where(and(eq(userAccess.userId, userId), eq(userAccess.accessType, "exam"))).limit(1)
        if (!acc || acc.expiresAt.getTime() <= now) throw new Error("ACCESS_EXPIRED")
      }

      // Pause encore ouverte au moment de finaliser → on la clôt (cumul plafonné).
      let pauseMs = p.totalPauseDurationMs ?? 0
      if (p.pauseStartedAt) pauseMs += now - p.pauseStartedAt.getTime()

      if (!p.startedAt) throw new Error("NOT_STARTED")
      const elapsed = now - p.startedAt.getTime() - pauseMs
      if (!isAutoSubmit && elapsed > exam.completionTime * 1000 + 5000) throw new Error("TIME_UP")

      const [agg] = await tx
        .select({
          correct: sql<number>`count(*) filter (where ${examAnswers.isCorrect})`.mapWith(Number),
          total: sql<number>`count(*)`.mapWith(Number),
        })
        .from(examAnswers).where(eq(examAnswers.participationId, p.id))
      const correctAnswers = agg?.correct ?? 0
      const totalQuestions = agg?.total ?? 0
      const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

      await tx.update(examParticipations).set({
        status: isAutoSubmit ? "auto_submitted" : "completed",
        score, completedAt: new Date(now),
        pauseStartedAt: null, totalPauseDurationMs: pauseMs,
      }).where(eq(examParticipations.id, p.id))

      return { score, correctAnswers, totalQuestions }
    })
    return { success: true, ...result }
  } catch (error) {
    if (error instanceof Error) {
      const map: Record<string, string> = {
        NOT_FOUND: "Examen introuvable.", OUTSIDE_WINDOW: "L'examen n'est pas disponible à cette période.",
        NOT_FOUND_PART: "Participation introuvable.", ALREADY_TAKEN: "Vous avez déjà passé cet examen.",
        NOT_IN_PROGRESS: "Cette session d'examen n'est plus active.",
        ACCESS_EXPIRED: "Votre accès aux examens a expiré.", NOT_STARTED: "L'examen n'a pas encore été démarré.",
        TIME_UP: "Temps écoulé ! La soumission n'a pas pu être traitée à temps.",
      }
      const msg = map[error.message]
      if (msg) return fail(msg)
    }
    logDev("[finalizeExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
```

Supprimer entièrement `submitExamAnswers` et `SubmitExamResult`.

- [ ] **Step 4 : Lancer (succès)** — Run: `bun run test:integration -- exam-runner` → le test finalize PASS.

- [ ] **Step 5 : Commit**

```bash
git add features/exams/actions.ts tests/integration/exam-runner.test.ts
git commit -m "feat(exams): finalizeExam (score depuis la base), retrait de submitExamAnswers"
```

---

## Task A6 : `pauseExam` / `resumeExam` (remplacent les phases)

**Files:**
- Modify: `features/exams/actions.ts` (retirer `startPause`/`resumeFromPause`, ajouter `pauseExam`/`resumeExam`)
- Test: `tests/integration/exam-runner.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

```ts
describe("pause", () => {
  it("une seule pause autorisée ; resume cumule la durée", async () => {
    const { userId, examId } = await seedExam({ questionCount: 2, enablePause: true, pauseDurationMinutes: 15 })
    await asUser(userId, async () => {
      await startExam({ examId })
      const r1 = await pauseExam({ examId })
      expect(r1.success).toBe(true)
      const r2 = await pauseExam({ examId }) // déjà en pause
      expect(r2.success).toBe(false)
      const r3 = await resumeExam({ examId })
      expect(r3.success).toBe(true)
      const r4 = await pauseExam({ examId }) // pause déjà utilisée
      expect(r4.success).toBe(false)
    })
    const [p] = await db.select({ pauseStartedAt: examParticipations.pauseStartedAt, total: examParticipations.totalPauseDurationMs })
      .from(examParticipations).where(eq(examParticipations.examId, examId))
    expect(p.pauseStartedAt).toBeNull()
    expect(p.total).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test:integration -- exam-runner` → FAIL.

- [ ] **Step 3 : Implémenter `pauseExam` / `resumeExam`**

```ts
export const pauseExam = async ({ examId }: { examId: string }): Promise<{ success: boolean; error?: string; pauseStartedAt?: number; pauseDurationMinutes?: number }> => {
  const session = await requireSession()
  if (!examId) return fail("Examen requis")
  try {
    return await db.transaction(async (tx) => {
      const [exam] = await tx.select({ enablePause: exams.enablePause, pauseDurationMinutes: exams.pauseDurationMinutes })
        .from(exams).where(eq(exams.id, examId)).limit(1)
      if (!exam) return fail("Examen introuvable.")
      if (!exam.enablePause) return fail("La pause n'est pas activée pour cet examen.")
      const [p] = await tx.select({ id: examParticipations.id, status: examParticipations.status, pauseStartedAt: examParticipations.pauseStartedAt, total: examParticipations.totalPauseDurationMs })
        .from(examParticipations).where(and(eq(examParticipations.examId, examId), eq(examParticipations.userId, session.user.id))).for("update").limit(1)
      if (!p) return fail("Participation introuvable.")
      if (p.status !== "in_progress") return fail("L'examen n'est pas en cours.")
      if (p.pauseStartedAt) return fail("Vous êtes déjà en pause.")
      if ((p.total ?? 0) > 0) return fail("La pause a déjà été utilisée.")
      const now = Date.now()
      await tx.update(examParticipations).set({ pauseStartedAt: new Date(now) }).where(eq(examParticipations.id, p.id))
      return { success: true as const, pauseStartedAt: now, pauseDurationMinutes: exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES }
    })
  } catch (error) {
    logDev("[pauseExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

export const resumeExam = async ({ examId }: { examId: string }): Promise<{ success: boolean; error?: string; totalPauseDurationMs?: number }> => {
  const session = await requireSession()
  if (!examId) return fail("Examen requis")
  try {
    return await db.transaction(async (tx) => {
      const [exam] = await tx.select({ pauseDurationMinutes: exams.pauseDurationMinutes }).from(exams).where(eq(exams.id, examId)).limit(1)
      if (!exam) return fail("Examen introuvable.")
      const [p] = await tx.select({ id: examParticipations.id, status: examParticipations.status, pauseStartedAt: examParticipations.pauseStartedAt, total: examParticipations.totalPauseDurationMs })
        .from(examParticipations).where(and(eq(examParticipations.examId, examId), eq(examParticipations.userId, session.user.id))).for("update").limit(1)
      if (!p) return fail("Participation introuvable.")
      if (p.status !== "in_progress") return fail("L'examen n'est pas en cours.")
      if (!p.pauseStartedAt) return fail("Vous n'êtes pas en pause.")
      const now = Date.now()
      const capMs = (exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES) * 60 * 1000
      const elapsed = Math.min(now - p.pauseStartedAt.getTime(), capMs)
      const total = (p.total ?? 0) + elapsed
      await tx.update(examParticipations).set({ pauseStartedAt: null, totalPauseDurationMs: total }).where(eq(examParticipations.id, p.id))
      return { success: true as const, totalPauseDurationMs: total }
    })
  } catch (error) {
    logDev("[resumeExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
```

Supprimer `startPause`, `resumeFromPause`, leurs types, et l'import `examPausePhase` devenu inutile dans `actions.ts`.

- [ ] **Step 4 : Lancer (succès)** — Run: `bun run test:integration -- exam-runner` → tous les tests pause + le test « refuse pendant la pause » (A4) PASS.

- [ ] **Step 5 : Commit**

```bash
git add features/exams/actions.ts tests/integration/exam-runner.test.ts
git commit -m "feat(exams): pauseExam/resumeExam (repos plafonné), retrait des phases de pause"
```

---

## Task A7 : `ExamSessionView` simplifié + canal explication

**Files:**
- Modify: `features/exams/dal.ts` (`ExamSessionView` + `getExamSession`, `QuestionExplanationView`)

- [ ] **Step 1 : Simplifier `ExamSessionView` et `getExamSession`**

Remplacer le type et le mapping (retirer `pausePhase`/`pauseEndedAt`/`isPauseCutShort`) :

```ts
export type ExamSessionView = {
  participationId: string
  status: "in_progress" | "completed" | "auto_submitted"
  startedAt: number | null
  completedAt: number | null
  score: number
  isPaused: boolean
  pauseStartedAt: number | null
  totalPauseDurationMs: number
} | null
```

Dans `getExamSession`, retirer les colonnes droppées du `select` et mapper :

```ts
return {
  participationId: p.id, status: p.status,
  startedAt: p.startedAt?.getTime() ?? null,
  completedAt: p.completedAt?.getTime() ?? null,
  score: p.score,
  isPaused: p.pauseStartedAt != null,
  pauseStartedAt: p.pauseStartedAt?.getTime() ?? null,
  totalPauseDurationMs: p.totalPauseDurationMs ?? 0,
}
```

Supprimer le type `PauseStatusView` (et la fonction associée si présente) devenu inutile.

- [ ] **Step 2 : Ajouter `explanationImages` au canal explication examen**

Repérer `QuestionExplanationView` et `getExamQuestionExplanations` (≈ ligne 660). **Ajout purement additif** (revue #6) : ne PAS modifier l'optionalité des champs existants (`references` reste tel quel), ajouter UNIQUEMENT `explanationImages` :

```ts
export type QuestionExplanationView = {
  // …champs existants inchangés (questionId, explanation, references)…
  explanationImages: { url: string; storagePath: string; order: number }[] // [F3 le peuplera ; vide tant que F3 absente]
}
```

Dans `getExamQuestionExplanations`, ajouter `explanationImages: []` à chaque entrée renvoyée (le peuplement réel arrive en Feature 3 ; ici on prépare le canal) **sans toucher au mapping existant** (notamment le `references ?? …` ≈ ligne 735 — ne pas introduire de `?? undefined`). Vérifier que `loadExamQuestionExplanations` (actions) propage le champ. Lancer `bunx tsc --noEmit` : l'ajout ne doit créer **aucune** nouvelle erreur dans `dal.ts`.

- [ ] **Step 3 : Compiler**

Run: `bunx tsc --noEmit`
Expected: erreurs UNIQUEMENT dans les clients qui consomment `ExamSessionView.pausePhase` (corrigés en Phase B). Noter les fichiers.

- [ ] **Step 4 : Commit**

```bash
git add features/exams/dal.ts
git commit -m "feat(exams): ExamSessionView sans phases + canal explanationImages (vide)"
```

---

## Task A8 : Entraînement — mode tuteur/test (action + DAL anti-fuite)

**Files:**
- Modify: `features/training/schemas.ts` (ajout `mode`)
- Modify: `features/training/actions.ts` (`createTrainingSession`, `saveTrainingAnswer`)
- Modify: `features/training/dal.ts:476-557` (`getTrainingSessionById`)
- Test: `tests/integration/training-mode.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

Créer `tests/integration/training-mode.test.ts` :

```ts
describe("mode entraînement", () => {
  it("tuteur : saveTrainingAnswer révèle correctAnswer + explanation", async () => {
    const { userId } = await seedUserWithTrainingAccess()
    await asUser(userId, async () => {
      const c = await createTrainingSession({ questionCount: 2, mode: "tutor" })
      expect(c.success).toBe(true)
      const view = await getTrainingSessionById(c.sessionId)
      const q = view!.questions[0]
      const res = await saveTrainingAnswer({ sessionId: c.sessionId, questionId: q._id, selectedAnswer: q.options[0] })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(typeof res.isCorrect).toBe("boolean")
        expect(typeof res.reveal?.correctAnswer).toBe("string")
      }
    })
  })

  it("test : getTrainingSessionById in_progress ne renvoie PAS isCorrect", async () => {
    const { userId } = await seedUserWithTrainingAccess()
    await asUser(userId, async () => {
      const c = await createTrainingSession({ questionCount: 2, mode: "test" })
      const v0 = await getTrainingSessionById(c.sessionId)
      const q = v0!.questions[0]
      await saveTrainingAnswer({ sessionId: c.sessionId, questionId: q._id, selectedAnswer: q.options[0] })
      const v1 = await getTrainingSessionById(c.sessionId)
      expect(v1!.answers[q._id]?.selectedAnswer).toBeDefined()
      expect(v1!.answers[q._id]?.isCorrect).toBeUndefined() // ⚠️ pas de fuite en mode test
    })
  })
})
```

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test:integration -- training-mode` → FAIL.

- [ ] **Step 3 : Ajouter `mode` au schéma de création**

Dans `features/training/schemas.ts`, ajouter au schéma `createTrainingSessionSchema` :

```ts
mode: z.enum(["tutor", "test"]).default("test"),
```

- [ ] **Step 4 : Persister `mode` à la création**

Dans `createTrainingSession` (`features/training/actions.ts`), récupérer `mode` de `parsed.data` et l'ajouter à l'`insert(trainingSessions).values({ … mode, … })`.

- [ ] **Step 5 : Révélation tuteur dans `saveTrainingAnswer`**

Étendre le type de retour et la logique :

```ts
export type SaveTrainingAnswerResult =
  | { success: true; isCorrect: boolean; reveal?: { correctAnswer: string; explanation: string; references: string[] } }
  | { success: false; error: string }
```

Après le calcul de `isCorrect` et l'update de l'item, charger le `mode` de la session (déjà disponible si on l'ajoute au premier `select`). Si `mode === "tutor"`, charger l'explication et renvoyer `reveal` :

```ts
if (sessionMode === "tutor") {
  const [expl] = await db.select({ explanation: questionExplanations.explanation, references: questionExplanations.references })
    .from(questionExplanations).where(eq(questionExplanations.questionId, questionId)).limit(1)
  return { success: true, isCorrect, reveal: { correctAnswer: item.correctAnswer, explanation: expl?.explanation ?? "", references: expl?.references ?? [] } }
}
return { success: true, isCorrect } // mode test : pas de reveal (mais isCorrect renvoyé pour pilotage interne — NON affiché)
```

> Note : en mode test, le client n'utilise pas `isCorrect` pour colorer (cf. Phase B). La fuite à corriger est côté **DAL de reprise** (Step 6), pas ici.

- [ ] **Step 6 : Corriger la fuite `isCorrect` dans `getTrainingSessionById` (#5)**

Dans `getTrainingSessionById` (`features/training/dal.ts`), ajouter `mode` au `select` de la session, puis conditionner la révélation. Remplacer la construction de `answers` (lignes ≈532-540) :

```ts
const reveal = s.status === "completed" || s.mode === "tutor"
const answers: TrainingAnswerRecord = {}
for (const i of items) {
  if (i.selectedAnswer !== null) {
    answers[i.questionId] = reveal
      ? { selectedAnswer: i.selectedAnswer, isCorrect: i.isCorrect ?? false }
      : { selectedAnswer: i.selectedAnswer } // mode test in_progress : pas d'isCorrect
  }
}
```

Mettre `TrainingAnswerRecord` en `isCorrect` optionnel :

```ts
export type TrainingAnswerRecord = Record<string, { selectedAnswer: string; isCorrect?: boolean }>
```

**⚠️ Révélation PAR ITEM (revue #3)** : en mode tuteur sur session `in_progress`,
révéler `correctAnswer`/`explanation`/`explanationImages` dans `questionsView`
**uniquement pour les questions répondues** — sinon on fuite les bonnes réponses
des questions **non encore répondues**. Construire un set des questions répondues
et gater par item :

```ts
const answeredIds = new Set(items.filter((i) => i.selectedAnswer !== null).map((i) => i.questionId))
// reveal niveau session si complété ; sinon, en tuteur, reveal par item répondu UNIQUEMENT
const canRevealItem = (qid: string) => s.status === "completed" || (s.mode === "tutor" && answeredIds.has(qid))
// dans le map questionsView :
//   ...(canRevealItem(i.questionId) ? { correctAnswer: i.correctAnswer, explanation: …, references: … } : {})
```

En mode test `in_progress` : masquage complet (aucun `correctAnswer`/`explanation`).

- [ ] **Step 6b : Test anti-fuite tuteur (revue #3)**

Ajouter à `training-mode.test.ts` : session **tuteur** `in_progress`, répondre à la
question 0 seulement, puis `getTrainingSessionById` → la question 0 expose
`correctAnswer`, mais la question 1 (non répondue) **n'expose PAS** `correctAnswer`.

```ts
it("tuteur in_progress : ne révèle correctAnswer que pour les questions répondues", async () => {
  const { userId } = await seedUserWithTrainingAccess()
  await asUser(userId, async () => {
    const c = await createTrainingSession({ questionCount: 2, mode: "tutor" })
    const v0 = await getTrainingSessionById(c.sessionId)
    await saveTrainingAnswer({ sessionId: c.sessionId, questionId: v0!.questions[0]._id, selectedAnswer: v0!.questions[0].options[0] })
    const v1 = await getTrainingSessionById(c.sessionId)
    expect(v1!.questions[0].correctAnswer).toBeDefined()
    expect(v1!.questions[1].correctAnswer).toBeUndefined() // non répondue → pas de fuite
  })
})
```

- [ ] **Step 7 : Lancer (succès)** — Run: `bun run test:integration -- training-mode` → PASS.

- [ ] **Step 8 : Commit**

```bash
git add features/training/schemas.ts features/training/actions.ts features/training/dal.ts tests/integration/training-mode.test.ts
git commit -m "feat(training): mode tuteur/test + correctif fuite isCorrect (revue #5)"
```

---

## Task A9 : Test paramétré anti-triche (couvre #5, prépare #1)

**Files:**
- Test: `tests/integration/passation-anti-cheat.test.ts`

- [ ] **Step 1 : Écrire le test**

Un test paramétré qui démarre une passation (examen ; entraînement mode test) et vérifie qu'aucun des champs sensibles n'atteint le « client » via les DAL/actions de passation :

```ts
const SENSITIVE = ["correctAnswer", "explanation", "references", "isCorrect", "explanationImages"] as const

describe("anti-triche passation", () => {
  it("examen : getExamWithQuestions (non-admin) ne révèle aucun champ sensible", async () => {
    const { userId, examId } = await seedExam({ questionCount: 3 })
    await asUser(userId, async () => {
      const view = await getExamWithQuestions(examId)
      for (const q of view!.questions)
        for (const k of SENSITIVE) expect((q as Record<string, unknown>)[k]).toBeUndefined()
    })
  })

  it("entraînement mode test : aucun champ sensible avant complétion", async () => {
    const { userId } = await seedUserWithTrainingAccess()
    await asUser(userId, async () => {
      const c = await createTrainingSession({ questionCount: 3, mode: "test" })
      const v = await getTrainingSessionById(c.sessionId)
      for (const q of v!.questions)
        for (const k of SENSITIVE) expect((q as Record<string, unknown>)[k]).toBeUndefined()
      // answers : isCorrect absent (vérifié en A8) ; ici on confirme côté questions
    })
  })
})
```

- [ ] **Step 2 : Lancer** — Run: `bun run test:integration -- passation-anti-cheat`
Expected: PASS (les DAL masquent déjà ces champs en passation).

- [ ] **Step 3 : Commit**

```bash
git add tests/integration/passation-anti-cheat.test.ts
git commit -m "test: garde anti-triche paramétrée (passation examen + entraînement test)"
```

> **Feature 3** étendra ce test avec `kind='statement'`/`explanationImages`.

---

## Task A10 : Audit & migration des tests existants (⚠️ bloquant CI — revue #1)

**Files:**
- Modify: `tests/integration/exams.test.ts` (+ tout fichier référençant des symboles supprimés)

> **Doit accompagner A5/A6** (mêmes commits ou immédiatement après) : `bun run check`
> et `bun run test:integration` ne doivent jamais rester rouges.

- [ ] **Step 1 : Auditer les références aux symboles supprimés**

Rechercher (Grep) dans `tests/**` : `submitExamAnswers`, `startPause`,
`resumeFromPause`, `getPauseStatus`, `pausePhase`, `isPauseCutShort`,
`pauseEndedAt`, `isQuestionAccessible`, `shouldTriggerPause`, `exam-storage`,
`ParticipantExamResultsView`, `TrainingResultsClient`. Lister tous les fichiers
touchés (la revue a identifié au moins `tests/integration/exams.test.ts:23-26,38,244-368`).

- [ ] **Step 2 : Migrer `tests/integration/exams.test.ts` vers la nouvelle API**

Remplacer les scénarios `submitExamAnswers`/pause-phases par : `saveExamAnswer` →
`finalizeExam` (score serveur) ; `pauseExam`/`resumeExam` (repos plafonné). Retirer
les tests des phases supprimées (`before_pause`/`during_pause`/verrouillage). Les
nouveaux scénarios existent déjà dans `exam-runner.test.ts` (A3–A6) — ici on
**nettoie/aligne** l'ancien fichier (pas de duplication : fusionner ou supprimer
les cas obsolètes).

- [ ] **Step 3 : Test de compat « participation héritée » (revue #8 / cutover)**

Ajouter un cas simulant une participation **antérieure** (insérer une
`examParticipation` + des `examAnswers` **clairsemées**, sans pré-création) :
`finalizeExam` calcule le score depuis les lignes existantes (pas de plantage) ;
`saveExamAnswer` sur une question **sans** ligne pré-créée renvoie `success:false`
(0 ligne mise à jour) au lieu d'un faux succès.

- [ ] **Step 4 : Vérifier vert**

Run: `bun run check && bun run test:integration`
Expected: 0 erreur ; tous les tests verts.

- [ ] **Step 5 : Commit**

```bash
git add tests/integration/
git commit -m "test: migration des tests examen vers saveExamAnswer/finalizeExam/pause (revue #1) + compat héritée"
```

---

# PHASE B — Coquille partagée (hook + runner)

## Task B1 : Types canoniques

**Files:**
- Create: `components/quiz/runner/types.ts`

- [ ] **Step 1 : Écrire les types**

```ts
export type QuizImage = { url: string; storagePath: string; order: number }

export type QuizQuestion = {
  _id: string
  question: string
  options: string[]
  images?: QuizImage[]
  domain?: string
  objectifCMC?: string
  // révélés UNIQUEMENT quand autorisé (tuteur en direct, ou correction)
  correctAnswer?: string
  explanation?: string
  references?: string[]
  explanationImages?: QuizImage[] // cf. Feature 3
}

export type AnswerState = { selected: string; isCorrect?: boolean }
export type AnswersMap = Record<string, AnswerState>

export type QuizMode = {
  kind: "exam" | "training"
  accent: "blue" | "emerald"
  timer: { serverStartTime: number; totalSeconds: number } | null
  pause: "rest" | null
  feedback: "deferred" | "immediate"
  showMeta: boolean
  labels: { title: string; finishCta: string }
  backUrl: string
}

export type QuizRevealPayload = { correctAnswer: string; explanation: string; references: string[] }

export type QuizCallbacks = {
  onAnswer: (questionId: string, selected: string) => Promise<{ ok: true; reveal?: QuizRevealPayload } | { ok: false; error: string }>
  onFlag: (questionId: string, isFlagged: boolean) => Promise<void>
  onFinish: (opts: { isAutoSubmit: boolean }) => Promise<{ ok: boolean; redirectTo?: string }>
  onPause?: () => Promise<{ ok: boolean }>
  onResume?: () => Promise<{ ok: boolean }>
}
```

- [ ] **Step 2 : Commit** — `git add components/quiz/runner/types.ts && git commit -m "feat(quiz): types canoniques du runner"`

---

## Task B2 : `useExamTimer`

**Files:**
- Create: `components/quiz/runner/use-exam-timer.ts`
- Test: `tests/components/quiz/use-exam-timer.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)** — utiliser `vi.useFakeTimers()` :

```ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useExamTimer } from "@/components/quiz/runner/use-exam-timer"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it("décompte et déclenche onExpire à 0", () => {
  const onExpire = vi.fn()
  const start = Date.now()
  const { result } = renderHook(() => useExamTimer({ serverStartTime: start, totalSeconds: 2, isPaused: false, totalPauseDurationMs: 0, onExpire }))
  expect(result.current.remainingMs).toBeGreaterThan(0)
  act(() => { vi.advanceTimersByTime(2100) })
  expect(result.current.remainingMs).toBe(0)
  expect(onExpire).toHaveBeenCalledTimes(1)
})

it("gelé quand isPaused", () => {
  const start = Date.now()
  const { result, rerender } = renderHook(({ p }) => useExamTimer({ serverStartTime: start, totalSeconds: 100, isPaused: p, totalPauseDurationMs: 0, onExpire: vi.fn() }), { initialProps: { p: true } })
  const before = result.current.remainingMs
  act(() => { vi.advanceTimersByTime(3000) })
  expect(result.current.remainingMs).toBe(before) // figé
})
```

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test -- use-exam-timer` → FAIL.

- [ ] **Step 3 : Implémenter** — un seul `setInterval`, calcul `remaining = totalSeconds*1000 - (now - serverStartTime - totalPauseDurationMs)` ; quand `isPaused`, ne pas avancer (clamp à la dernière valeur calculée hors pause) ; déclenche `onExpire` une seule fois à 0. Pas de `Date.now()` dans le rendu (le calcul vit dans l'effet). Exposer `{ remainingMs, isRunningOut, isCritical }` (réutiliser `isTimeRunningOut`/`isTimeCritical` de `lib/exam-timer.ts`).

- [ ] **Step 4 : Lancer (succès)** — Run: `bun run test -- use-exam-timer` → PASS.

- [ ] **Step 5 : Commit** — `git add components/quiz/runner/use-exam-timer.ts tests/components/quiz/use-exam-timer.test.ts && git commit -m "feat(quiz): useExamTimer (un seul tick, pause)"`

---

## Task B3 : `useQuizSession`

**Files:**
- Create: `components/quiz/runner/use-quiz-session.ts`
- Test: `tests/components/quiz/use-quiz-session.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)**

```ts
it("answerSelect persiste et applique la révélation en mode immédiat", async () => {
  const onAnswer = vi.fn().mockResolvedValue({ ok: true, reveal: { correctAnswer: "B", explanation: "e", references: [] } })
  const { result } = renderHook(() => useQuizSession({
    questions: [{ _id: "q1", question: "?", options: ["A", "B"] }],
    initialAnswers: {}, mode: { kind: "training", feedback: "immediate", /* … */ } as never,
    callbacks: { onAnswer, onFlag: vi.fn(), onFinish: vi.fn() },
  }))
  await act(async () => { await result.current.answerSelect(1) })
  expect(onAnswer).toHaveBeenCalledWith("q1", "B")
  expect(result.current.answers["q1"]).toEqual({ selected: "B", isCorrect: true })
  expect(result.current.revealed["q1"]).toBeTruthy()
})

it("navigation bornée + toggle flag", () => { /* goNext/goPrevious/goTo + toggleFlag */ })
```

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test -- use-quiz-session` → FAIL.

- [ ] **Step 3 : Implémenter le hook** — inputs : `{ questions, initialAnswers, initialFlags, mode, callbacks }`. État : `currentIndex`, `answers: AnswersMap` (init depuis `initialAnswers`), `flagged: Set<string>` (init depuis **`initialFlags`** — réhydratation des flags persistés, revue #2), `revealed: Record<string, QuizRevealPayload>`, `finishDialogOpen`, `isSubmitting`. Handlers : `goNext/goPrevious/goTo` (bornés), `toggleFlag` (appelle `callbacks.onFlag`), `answerSelect(index)` (appelle `onAnswer` ; en succès met à jour `answers` ; si `reveal` et `mode.feedback==="immediate"`, stocke dans `revealed` et pose `isCorrect`), `requestFinish/confirmFinish` (appelle `onFinish` dans une transition). Raccourcis clavier (← → F) via `useEffect`. Exposer aussi `answeredCount`, `currentQuestion`. Si `mode.timer`, composer `useExamTimer` et exposer son état + brancher `onExpire → confirmFinish({isAutoSubmit:true})`.

- [ ] **Step 4 : Lancer (succès)** — Run: `bun run test -- use-quiz-session` → PASS.

- [ ] **Step 5 : Commit** — `git add components/quiz/runner/use-quiz-session.ts tests/components/quiz/use-quiz-session.test.ts && git commit -m "feat(quiz): useQuizSession (logique headless)"`

---

## Task B4 : `<QuizRunner>` (coquille)

**Files:**
- Create: `components/quiz/runner/quiz-runner.tsx`

- [ ] **Step 1 : Implémenter la coquille** — composant client qui prend `{ questions, initialAnswers, mode, callbacks }`, appelle `useQuizSession`, et assemble les composants partagés existants. **Porter la mise en page** depuis `evaluation-client.tsx` (lignes 526-734 : `SessionHeader` + colonne question + `QuestionNavigator` + `SessionToolbar` + `FinishDialog`), en remplaçant :
  - le timer/pause conditionnés par `mode.timer`/`mode.pause` ;
  - l'**overlay de pause** plein écran (réutiliser `pause-dialog.tsx` simplifié) affiché quand `mode.pause` et `session.isPaused`, recouvrant énoncé **et** navigateur (#D3) ;
  - `QuestionCard` reçoit `variant="exam"` + (si `mode.feedback==="immediate"` et question révélée) les props de révélation (`showCorrectAnswer` + `lazyExplanation` depuis `revealed[qid]`) ;
  - `SessionHeader.config` dérivé de `mode` (accent, showTimer, etc.).
  - Wrapper `CalculatorProvider` conservé.

- [ ] **Step 2 : Smoke test** — Run: `bunx tsc --noEmit` → la coquille compile. (Tests de rendu couverts par les wrappers en B5/B6 + E2E en C.)

- [ ] **Step 3 : Commit** — `git add components/quiz/runner/quiz-runner.tsx && git commit -m "feat(quiz): coquille QuizRunner"`

---

## Task B5 : Brancher l'examen sur `<QuizRunner>`

**Files:**
- Modify: `app/(dashboard)/dashboard/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx`
- Modify: `.../evaluation/page.tsx` (props éventuelles : `initialAnswers`)

- [ ] **Step 1 : Réduire `evaluation-client.tsx` à un wrapper** — construire `mode: QuizMode` (kind exam, accent blue, `timer` depuis `serverStartTime`+`completionTime`, `pause` = `enablePause ? "rest" : null`, `feedback: "deferred"`, `showMeta:false`), mapper `questions` (ExamQuestionView → QuizQuestion) et `initialAnswers` (depuis la participation : lire les `examAnswers` déjà saisies — exposer une DAL `getExamAnswersForParticipation` renvoyant `{questionId, selectedAnswer, isFlagged}` SANS `isCorrect`), construire **`initialFlags`** = `Set` des `questionId` où `isFlagged` (réhydratation des flags — revue #2) et le passer à `<QuizRunner>`/`useQuizSession`, et passer les callbacks :
  - `onAnswer` → `saveExamAnswer` (renvoie `{ ok:true }`, jamais de reveal) ;
  - `onFlag` → `saveExamFlag` ;
  - `onFinish` → `finalizeExam` → `redirectTo` = `/dashboard/examen-blanc/${examId}/soumis` ;
  - `onPause`/`onResume` → `pauseExam`/`resumeExam`.
  Conserver l'écran d'avertissement de démarrage (Task C5 le redessine) ; au montage, si pas de participation → afficher l'avertissement → `startExam`.

- [ ] **Step 2 : Ajouter la DAL `getExamAnswersForParticipation`** dans `features/exams/dal.ts` (colonnes `questionId, selectedAnswer, isFlagged` ; **jamais** `isCorrect`), gardée par session/propriété.

- [ ] **Step 3 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint`
Expected: 0 erreur. Les références à `submitExamAnswers`/`startPause`/localStorage doivent avoir disparu de ce fichier.

- [ ] **Step 4 : Commit** — `git add app/(dashboard)/dashboard/examen-blanc/ features/exams/dal.ts && git commit -m "feat(exam): passation via QuizRunner (persistance serveur, pause repos)"`

---

## Task B6 : Brancher l'entraînement sur `<QuizRunner>`

**Files:**
- Modify: `app/(dashboard)/dashboard/entrainement/_components/training-session-client.tsx`

- [ ] **Step 1 : Réduire au wrapper** — `mode` (kind training, accent emerald, `timer:null`, `pause:null`, `feedback = session.mode === "tutor" ? "immediate" : "deferred"`, `showMeta:false`), `initialAnswers` depuis `initialData.answers` (forme `{selected, isCorrect?}`), callbacks :
  - `onAnswer` → `saveTrainingAnswer` → mapper `{ ok:true, reveal: res.reveal }` (reveal présent seulement en tuteur) ;
  - `onFlag` → no-op serveur (flags entraînement restent locaux) ou persistance si souhaitée — garder le comportement actuel (local) ;
  - `onFinish` → `completeTrainingSession` → `redirectTo` = `/dashboard/entrainement/${sessionId}/results`.

- [ ] **Step 2 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur.

- [ ] **Step 3 : Commit** — `git add app/(dashboard)/dashboard/entrainement/ && git commit -m "feat(training): passation via QuizRunner (mode tuteur/test)"`

---

# PHASE C — Résultats, écrans, cutover, nettoyage

## Task C1 : `<SessionResults>` unifié

**Files:**
- Create: `components/quiz/results/session-results.tsx`

- [ ] **Step 1 : Implémenter** — props : `{ accent, summary: { score, correct, incorrect, unanswered }, questions: QuizQuestion[], answers: AnswersMap, loadExplanations?: (ids: string[]) => Promise<…>, participant?: { name; email; image } }`. Porter le rendu depuis `participant-exam-results-view.tsx` (récap + liste `QuestionCard variant="review"` + filtre « erreurs seulement » + `ResultsQuestionNavigator`) ; afficher `explanationImages` sous l'explication si présent ; carte participant si `participant`.

- [ ] **Step 1b : ⚠️ Compat données historiques** — le composant **doit** traiter de façon identique « pas d'entrée dans `answers` pour une question » ET « `selected` absent/null » comme **« non répondu »**. Raison : les participations **antérieures** à cette refonte n'ont de ligne `examAnswers` que pour les questions répondues (l'ancien `startExam` ne pré-créait pas les lignes), alors que les nouvelles en ont une par question. Les deux cas doivent rendre exactement le même affichage « non répondu ». Ajouter un test de rendu avec un `answers` clairsemé (certaines questions absentes) → comptage non-répondues correct + navigateur cohérent.

- [ ] **Step 2 : Brancher résultats examen** (`.../resultats/page.tsx` + admin `.../results/[userId]/page.tsx`) et **résultats entraînement** (`.../entrainement/[sessionId]/results/page.tsx`) sur `<SessionResults>`. Pour l'examen, `loadExplanations` = `loadExamQuestionExplanations` (lazy, désormais avec `explanationImages`).

- [ ] **Step 3 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur.

- [ ] **Step 4 : Commit** — `git add components/quiz/results/session-results.tsx app/(dashboard)/ app/(admin)/ && git commit -m "feat(quiz): SessionResults unifié (examen/admin/entraînement)"`

---

## Task C2 : Écran de confirmation post-examen

**Files:**
- Create: `app/(dashboard)/dashboard/examen-blanc/[examId]/soumis/page.tsx`
- Create: `.../soumis/_components/confirmation-client.tsx`

- [ ] **Step 1 : Implémenter** — Server Component qui lit (DAL gardée) `{ examTitle, answeredCount, flaggedCount, endDate, status }` de la participation de l'utilisateur ; si pas de participation complétée → `redirect` vers la liste. Le client affiche « Examen soumis ✓ », le récap, « Résultats disponibles le {endDate formatée} », bouton retour liste. Ajouter une DAL `getExamSubmissionSummary(examId)`.

- [ ] **Step 2 : Vérifier** — Run: `bunx tsc --noEmit` → 0 erreur.

- [ ] **Step 3 : Commit** — `git add app/(dashboard)/dashboard/examen-blanc/[examId]/soumis/ features/exams/dal.ts && git commit -m "feat(exam): écran de confirmation post-soumission"`

---

## Task C3 : Mode tuteur/test dans le formulaire de config entraînement

**Files:**
- Modify: `app/(dashboard)/dashboard/entrainement/_components/training-config-form.tsx`

- [ ] **Step 1 : Ajouter la bascule** — un contrôle radio/segmented « Mode tuteur / Mode test » (explication courte de chaque), inclus dans la soumission `createTrainingSession({ … mode })`. Défaut `test`.

- [ ] **Step 2 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur.

- [ ] **Step 3 : Commit** — `git add app/(dashboard)/dashboard/entrainement/_components/training-config-form.tsx && git commit -m "feat(training): choix mode tuteur/test à la création"`

---

## Task C4 : `pause-dialog` simplifié (overlay de repos) + retrait alerte

**Files:**
- Modify: `components/quiz/pause-dialog.tsx`
- Delete: `components/quiz/pause-approaching-alert.tsx`

- [ ] **Step 1 : Simplifier `pause-dialog.tsx`** — overlay plein écran bloquant : compte à rebours de pause (plafonné à `pauseDurationMinutes`, auto-resume à 0 via `onResume`), bouton « Reprendre », message de repos. Retirer toute notion de phases/midpoint.

- [ ] **Step 2 : Supprimer `pause-approaching-alert.tsx`** et ses imports.

- [ ] **Step 3 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur.

- [ ] **Step 4 : Commit** — `git add -A components/quiz/ && git commit -m "feat(quiz): overlay de pause de repos, retrait alerte d'approche"`

---

## Task C5 : Écran de démarrage examen redessiné (règles à jour)

**Files:**
- Modify: `app/(dashboard)/dashboard/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx` (bloc d'avertissement)

- [ ] **Step 1 : Mettre à jour les règles** — retirer « pas de sauvegarde / rafraîchir = perte » ; nouvelles règles : « session unique · chrono serveur (continue au rechargement) · auto-soumission à 0 · pause repos disponible » (si `enablePause`). Vérifier qu'aucun libellé ne décrit l'ancienne mécanique de pause (revue #7).

- [ ] **Step 2 : Vérifier** — Run: `bun run lint` → 0 erreur ; grep manuel `verrouill|moitié|phase` dans le dossier examen → aucun texte obsolète.

- [ ] **Step 3 : Commit** — `git add app/(dashboard)/dashboard/examen-blanc/ && git commit -m "feat(exam): écran de démarrage avec règles à jour"`

---

## Task C6 : Nettoyage (suppressions)

**Files:**
- Delete: `lib/exam-storage.ts`
- Delete: `components/quiz/results/participant-exam-results-view.tsx`
- Delete: `app/(dashboard)/dashboard/entrainement/_components/training-results-client.tsx`
- Modify: `lib/exam-timer.ts` (helpers morts)

- [ ] **Step 1 : Vérifier l'absence de références** — Run: `bun run lint` puis rechercher (Grep) `exam-storage`, `ParticipantExamResultsView`, `TrainingResultsClient`, `PausePhase`, `isQuestionAccessible`, `shouldTriggerPause` → 0 référence hors fichiers à supprimer.

- [ ] **Step 2 : Supprimer les fichiers** listés et purger de `lib/exam-timer.ts` : `isWithinGracePeriod`, `shouldAutoSubmit`, `calculateScorePercentage`, `calculateProgress`, `getAccessibleQuestionRange`, `isQuestionAccessible`, `shouldTriggerPause`, `calculatePauseTimeRemaining`, `isPauseExpired`, `formatPauseTime`, `questionsUntilPause`, `isApproachingPause`, type `PausePhase`. **Garder** `calculateTimeRemaining`, `formatExamTime`, `isTimeRunningOut`, `isTimeCritical`. Mettre à jour `tests/lib/exam-timer.test.ts` (retirer les tests des helpers supprimés). **NE PAS** toucher `components/quiz/quiz-results.tsx` (vitrine, #8).

- [ ] **Step 3 : Vérifier** — Run: `bun run check` (tsc + eslint) → 0 erreur ; `bun run test` → vert.

- [ ] **Step 4 : Commit** — `git add -A && git commit -m "chore(quiz): suppression localStorage, helpers morts, vues résultats fusionnées"`

---

## Task C7 : Procédure de cutover (sessions en vol) — § G

**Files:**
- Create: `docs/superpowers/runbooks/2026-06-28-cutover-refonte-quiz.md`

- [ ] **Step 1 : Rédiger le runbook de déploiement** — documenter, dans l'ordre : (1) communiquer/fermer la fenêtre des examens actifs OU choisir un créneau sans examen `in_progress` ; (2) **drainer** les participations `in_progress` restantes — script/SQL d'auto-soumission (passer `status='auto_submitted'`, `score=0` ou calculé selon réponses disponibles) ; (3) appliquer la migration (Task A1) ; (4) déployer le code. Inclure la requête de détection : `select count(*) from exam_participations where status='in_progress'` à exécuter AVANT migration.

- [ ] **Step 2 : Commit** — `git add docs/superpowers/runbooks/ && git commit -m "docs: runbook cutover sessions d'examen en vol"`

> Ce runbook est exécuté **au déploiement**, pas pendant le dev. Il existe pour que la bascule ne perde aucune donnée (revue #2).

---

## Task C8 : E2E + vérification finale

**Files:**
- Modify: `e2e/tests/` (scénarios examen + entraînement)

- [ ] **Step 1 : Mettre à jour/écrire les E2E** — conserver les `data-testid` (`answer-option-{index}`, `btn-next`, `btn-previous`, `btn-flag`, `btn-finish`) sur `<QuizRunner>`. Scénarios : examen (démarrage → réponses persistées au rechargement → pause overlay masque l'énoncé → auto-submit via `page.clock` → écran de confirmation) ; entraînement tuteur (révélation après réponse) vs test (pas de révélation avant la fin).

- [ ] **Step 2 : Lancer toute la suite** — Run: `bun run check && bun run test && bun run test:integration`
Expected: tout vert (couverture ≥ seuil).

- [ ] **Step 3 : Lancer les E2E** — Run: `bun run test:e2e`
Expected: scénarios passation/résultats verts.

- [ ] **Step 4 : Commit** — `git add e2e/ && git commit -m "test(e2e): passation/résultats sur la coquille unifiée"`

---

## Self-Review (effectuée)

- **Couverture spec :** D1 persistance (A3/A4/B5) · D2/D3 pause+overlay (A1/A6/A7/B4/C4) · D4 tuteur/test (A8/B6/C3) · D5 confirmation (A7/C2) · D6 hook+coquille+résultats (B1-B4/C1) · D7 visuel (B4/C1/C5) · D8 périmètre (B5/B6/C1/C2/C3/C5). Constats revue : #2 cutover (C7 + bandeau pré-requis) · #4 canal explication (A7/C1) · #5 isCorrect (A8) · #7 textes pause (C5) · #8 quiz-results conservé (C6) · #1/anti-triche (A9, étendu en F3).
- **Placeholders :** les corps JSX volumineux (B4/C1) renvoient explicitement aux fichiers source à porter avec les diffs précisés — instruction concrète, pas un TODO. Toute la logique backend et les hooks sont en code complet.
- **Cohérence des types :** `QuizMode`/`QuizQuestion`/`AnswerState`/`AnswersMap`/`QuizCallbacks` (B1) sont consommés tels quels en B3/B4/B5/B6/C1 ; `TrainingAnswerRecord.isCorrect` rendu optionnel (A8) cohérent avec `AnswerState.isCorrect?`.
- **Dépendances inter-features :** `finalizeExam` (A5) et le canal `explanationImages` (A7) sont les points sur lesquels F2 et F3 se branchent.
