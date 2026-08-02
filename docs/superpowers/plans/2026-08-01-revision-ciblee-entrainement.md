# Révision ciblée en entraînement (P1-A) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un étudiant de composer une session d'entraînement à partir de son propre historique — questions ratées, jamais vues, ou marquées — sans jamais divulguer la correction d'un examen encore ouvert.

**Architecture:** Une table neuve `question_bookmarks` (signet durable utilisateur × question) ; un module `features/training/revision.ts` qui calcule le corpus de révision à la volée en une requête SQL (union des historiques entraînement + examens, `DISTINCT ON` pour la dernière tentative) ; `createTrainingSession` accepte un filtre de révision et **borne** le nombre demandé au corpus au lieu de refuser. Le verrou anti-triche des examens ouverts, aujourd'hui appliqué à la révélation, est étendu à la **sélection** du corpus et aux **compteurs**.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + Neon Postgres, zod v4, Vitest (happy-dom + intégration Neon éphémère), Tailwind v4 / shadcn.

**Spec:** `docs/superpowers/specs/2026-08-01-revision-ciblee-entrainement-design.md`

---

## Structure des fichiers

| Fichier                                   | Responsabilité                                                       |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `db/schema/revision.ts` (créer)           | Table `question_bookmarks` (accueillera les notes de P1-B)           |
| `db/schema/index.ts` (modifier)           | Ré-export du nouveau module                                          |
| `features/exams/dal.shared.ts` (modifier) | Source **unique** du verrou : jeu complet + restriction dérivée      |
| `features/training/revision.ts` (créer)   | Corpus de révision : compteurs + tirage (server-only)                |
| `features/training/schemas.ts` (modifier) | Critères de révision, schéma du signet, `MIN_QUESTIONS` conditionnel |
| `features/training/actions.ts` (modifier) | `setQuestionBookmark`, `loadRevisionCounts`, `createTrainingSession` |
| `features/training/dal.ts` (modifier)     | `getBookmarkedQuestionIds` + `bookmarkedIds` sur la vue de session   |
| `training-config-form.tsx` (modifier)     | Puces « Réviser » + compteurs                                        |
| `training-session-client.tsx` (modifier)  | Marquage persistant (fin du no-op `onFlag`)                          |

**Ordre imposé.** Les tâches 4 et 5 se suivent : la 4 construit le corpus **sans** le verrou, la 5 l'ajoute en test-first. Rien n'est exposé entre les deux (aucun appelant avant la tâche 6), mais **elles doivent atterrir dans la même PR** — la 4 seule serait un trou anti-triche.

---

### Task 1: Table `question_bookmarks`

**Files:**

- Create: `db/schema/revision.ts`
- Modify: `db/schema/index.ts`
- Test: `tests/integration/question-bookmarks.test.ts`

- [ ] **Step 1: Write the failing test**

Créer `tests/integration/question-bookmarks.test.ts` :

```ts
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { questionBookmarks, questions, user } from "@/db/schema"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const DOMAIN = `QB-${suffix}`
const qIds = Array.from({ length: 3 }, () => createId())

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT bookmarks",
    email: `qb-${suffix}@test.invalid`,
  })
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `QB Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj QB ${suffix}`,
      domain: DOMAIN,
    })),
  )
})

afterAll(async () => {
  await db
    .delete(questionBookmarks)
    .where(eq(questionBookmarks.userId, USER_ID))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(eq(user.id, USER_ID))
})

describe("table question_bookmarks", () => {
  it("refuse un doublon (utilisateur, question)", async () => {
    await db
      .insert(questionBookmarks)
      .values({ userId: USER_ID, questionId: qIds[0] })

    await expect(
      db.insert(questionBookmarks).values({
        userId: USER_ID,
        questionId: qIds[0],
      }),
    ).rejects.toThrow()
  })

  it("la suppression d'une question emporte ses signets (cascade)", async () => {
    const doomedQuestionId = createId()
    await db.insert(questions).values({
      id: doomedQuestionId,
      question: `QB doomed ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj QB ${suffix}`,
      domain: DOMAIN,
    })
    await db
      .insert(questionBookmarks)
      .values({ userId: USER_ID, questionId: doomedQuestionId })

    await db.delete(questions).where(eq(questions.id, doomedQuestionId))

    const rows = await db
      .select({ id: questionBookmarks.id })
      .from(questionBookmarks)
      .where(eq(questionBookmarks.questionId, doomedQuestionId))
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration -- -t "table question_bookmarks"`
Expected: FAIL — `questionBookmarks` n'est pas exporté de `@/db/schema` (erreur TypeScript / `undefined`).

- [ ] **Step 3: Create the schema module**

Créer `db/schema/revision.ts` :

```ts
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { user } from "./auth"
import { questions } from "./questions"

// Signet durable (utilisateur × question), indépendant des sessions : alimente
// le critère « marquées » du corpus de révision.
//
// `onDelete: cascade` sur `question_id`, à rebours des autres FK vers
// `questions` (toutes en `restrict`) : `deleteQuestion` TENTE le hard delete et
// laisse Postgres arbitrer (23001 → repli en soft delete). En `restrict`, un
// seul signet suffirait à transformer tout hard delete en soft delete.
export const questionBookmarks = pgTable(
  "question_bookmarks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("question_bookmarks_user_question_unique").on(
      t.userId,
      t.questionId,
    ),
    index("question_bookmarks_user_id_idx").on(t.userId),
  ],
)
```

Modifier `db/schema/index.ts` — ajouter la ligne après `export * from "./questions"` :

```ts
export * from "./revision"
```

- [ ] **Step 4: Generate and apply the migration**

Run: `bun run db:generate`
Expected: un nouveau fichier `drizzle/NNNN_*.sql` créé, contenant `CREATE TABLE "question_bookmarks"` avec la contrainte unique et les deux FK.

Run: `bun run db:migrate`
Expected: `migrations applied` sans erreur.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:integration -- -t "table question_bookmarks"`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add db/schema/revision.ts db/schema/index.ts drizzle tests/integration/question-bookmarks.test.ts
git commit -m "feat(revision): table question_bookmarks (signet durable utilisateur x question)"
```

---

### Task 2: Source unique du verrou anti-triche

Le corpus de révision doit exclure les questions verrouillées **avant** le tirage, donc sans liste de candidats à narrower. Plutôt que d'écrire une deuxième requête (deux définitions de la règle = exactement ce que la spec interdit), on extrait le jeu complet et `getOpenExamLockedQuestionIds` en devient une restriction.

**Files:**

- Modify: `features/exams/dal.shared.ts`
- Test: `tests/integration/exam-lock-source.test.ts`

- [ ] **Step 1: Write the failing test**

Créer `tests/integration/exam-lock-source.test.ts` (fixtures autonomes — ce test ne doit dépendre d'aucun autre fichier) :

```ts
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import {
  getOpenExamLockedQuestionIds,
  getUserOpenExamLockedQuestionIds,
} from "@/features/exams/dal.shared"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const OPEN_EXAM_ID = createId()
const CLOSED_EXAM_ID = createId()
// 0-1 = examen ouvert · 2 = examen clos · 3 = hors examen
const qIds = Array.from({ length: 4 }, () => createId())

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT verrou",
    email: `lock-${suffix}@test.invalid`,
  })
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `LOCK Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj LOCK ${suffix}`,
      domain: `LOCK-${suffix}`,
    })),
  )
  await db.insert(exams).values([
    {
      id: OPEN_EXAM_ID,
      title: `LOCK ouvert ${suffix}`,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2099-01-01T00:00:00Z"),
      completionTime: 3600,
      createdBy: USER_ID,
    },
    {
      id: CLOSED_EXAM_ID,
      title: `LOCK clos ${suffix}`,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-02T00:00:00Z"),
      completionTime: 3600,
      createdBy: USER_ID,
    },
  ])
  await db.insert(examQuestions).values([
    { examId: OPEN_EXAM_ID, questionId: qIds[0], position: 0 },
    { examId: OPEN_EXAM_ID, questionId: qIds[1], position: 1 },
    { examId: CLOSED_EXAM_ID, questionId: qIds[2], position: 0 },
  ])
  await db.insert(examParticipations).values([
    {
      id: createId(),
      examId: OPEN_EXAM_ID,
      userId: USER_ID,
      status: "in_progress",
      startedAt: new Date("2026-01-01T01:00:00Z"),
    },
    {
      id: createId(),
      examId: CLOSED_EXAM_ID,
      userId: USER_ID,
      status: "completed",
      startedAt: new Date("2026-01-01T01:00:00Z"),
    },
  ])
})

afterAll(async () => {
  await db
    .delete(examParticipations)
    .where(inArray(examParticipations.examId, [OPEN_EXAM_ID, CLOSED_EXAM_ID]))
  await db
    .delete(examQuestions)
    .where(inArray(examQuestions.examId, [OPEN_EXAM_ID, CLOSED_EXAM_ID]))
  await db
    .delete(exams)
    .where(inArray(exams.id, [OPEN_EXAM_ID, CLOSED_EXAM_ID]))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(eq(user.id, USER_ID))
})

describe("verrou anti-triche — source unique", () => {
  it("le jeu complet ne dépend d'aucune liste de candidats", async () => {
    const all = await getUserOpenExamLockedQuestionIds(USER_ID)

    expect(all.has(qIds[0])).toBe(true)
    expect(all.has(qIds[1])).toBe(true)
    expect(all.has(qIds[2])).toBe(false) // examen clos
    expect(all.has(qIds[3])).toBe(false) // hors examen
  })

  it("la version restreinte est un sous-ensemble du jeu complet", async () => {
    const all = await getUserOpenExamLockedQuestionIds(USER_ID)
    const narrowed = await getOpenExamLockedQuestionIds(USER_ID, [
      qIds[0],
      qIds[3],
    ])

    expect([...narrowed]).toEqual([qIds[0]])
    for (const id of narrowed) expect(all.has(id)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration -- tests/integration/exam-lock-source.test.ts`
Expected: FAIL — `getUserOpenExamLockedQuestionIds` n'est pas exporté de `dal.shared`.

- [ ] **Step 3: Implement**

Dans `features/exams/dal.shared.ts`, remplacer le corps de `getOpenExamLockedQuestionIds` par ceci (garder le commentaire de doc existant au-dessus de la fonction restreinte) :

```ts
/**
 * TOUTES les questions verrouillées pour `userId` : celles d'un examen OUVERT
 * (`endDate` future) où il a une participation, quel que soit son statut.
 *
 * Source unique de la règle. Le corpus de révision s'en sert pour exclure AVANT
 * le tirage : l'appartenance d'une question au lot « mes ratées » est elle-même
 * un oracle sur les réponses de l'examen en cours, même sans voir la clé.
 * Borné par les examens auxquels l'utilisateur participe.
 */
export const getUserOpenExamLockedQuestionIds = async (
  userId: string,
): Promise<Set<string>> => {
  const rows = await db
    .selectDistinct({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .innerJoin(
      examParticipations,
      eq(examParticipations.examId, examQuestions.examId),
    )
    .where(
      and(eq(examParticipations.userId, userId), gt(exams.endDate, new Date())),
    )
  return new Set(rows.map((r) => r.questionId))
}

export const getOpenExamLockedQuestionIds = async (
  userId: string,
  questionIds: string[],
): Promise<Set<string>> => {
  if (questionIds.length === 0) return new Set()
  const locked = await getUserOpenExamLockedQuestionIds(userId)
  return new Set(questionIds.filter((id) => locked.has(id)))
}
```

`inArray` peut devenir un import inutilisé dans ce fichier — le retirer si `bun run lint` le signale.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:integration -- tests/integration/exam-lock-source.test.ts tests/integration/passation-anti-cheat.test.ts tests/integration/exam-runner.test.ts`
Expected: PASS — le nouveau fichier **et** les suites existantes qui exercent la restriction (ce sont elles qui prouvent que son comportement n'a pas bougé).

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add features/exams/dal.shared.ts tests/integration/exam-lock-source.test.ts
git commit -m "refactor(exams): verrou anti-triche - jeu complet comme source unique"
```

---

### Task 3: Signet — action idempotente et lecture

`setQuestionBookmark` prend l'**état voulu**, pas une bascule : `callAction` peut la retenter sans inverser deux fois (une bascule retentée annulerait le marquage).

**Files:**

- Modify: `features/training/schemas.ts`
- Modify: `features/training/actions.ts`
- Modify: `features/training/dal.ts`
- Test: `tests/integration/question-bookmarks.test.ts`

- [ ] **Step 1: Write the failing test**

Ajouter à `tests/integration/question-bookmarks.test.ts` — compléter les imports en tête :

```ts
import { setQuestionBookmark } from "@/features/training/actions"
import { getBookmarkedQuestionIds } from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
```

et le mock (à côté des autres `vi.mock`) :

```ts
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
```

puis, dans `beforeAll`, après l'insertion des questions :

```ts
vi.mocked(getCurrentSession).mockResolvedValue({
  user: { id: USER_ID, role: "admin" },
} as never)
```

et le nouveau bloc de tests :

```ts
describe("setQuestionBookmark", () => {
  it("pose le signet, puis le retire", async () => {
    const posed = await setQuestionBookmark({
      questionId: qIds[1],
      isBookmarked: true,
    })
    expect(posed.success).toBe(true)
    expect(await getBookmarkedQuestionIds([qIds[1]])).toEqual([qIds[1]])

    const removed = await setQuestionBookmark({
      questionId: qIds[1],
      isBookmarked: false,
    })
    expect(removed.success).toBe(true)
    expect(await getBookmarkedQuestionIds([qIds[1]])).toEqual([])
  })

  it("est idempotente : deux poses successives ne cassent rien", async () => {
    await setQuestionBookmark({ questionId: qIds[2], isBookmarked: true })
    const again = await setQuestionBookmark({
      questionId: qIds[2],
      isBookmarked: true,
    })
    expect(again.success).toBe(true)
    expect(await getBookmarkedQuestionIds([qIds[2]])).toEqual([qIds[2]])
  })

  it("refuse proprement une question inexistante", async () => {
    const res = await setQuestionBookmark({
      questionId: "question-qui-n-existe-pas",
      isBookmarked: true,
    })
    expect(res.success).toBe(false)
    expect(res.error).toBe("Question introuvable.")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration -- -t "setQuestionBookmark"`
Expected: FAIL — `setQuestionBookmark` et `getBookmarkedQuestionIds` n'existent pas.

- [ ] **Step 3: Add the schema**

Dans `features/training/schemas.ts`, à la fin du fichier :

```ts
export const setQuestionBookmarkSchema = z.object({
  questionId: z.string().min(1),
  isBookmarked: z.boolean(),
})
export type SetQuestionBookmarkInput = z.infer<typeof setQuestionBookmarkSchema>
```

- [ ] **Step 4: Add the DAL read**

Dans `features/training/dal.ts` — ajouter `questionBookmarks` à l'import depuis `@/db/schema`, puis, après `getTrainingStats` :

```ts
/**
 * Signets de **l'utilisateur courant** parmi `questionIds`. Un admin qui
 * consulte la session d'un étudiant voit donc ses propres signets, pas ceux de
 * l'étudiant : c'est un état personnel, pas une donnée de la session.
 */
export const getBookmarkedQuestionIds = async (
  questionIds: string[],
): Promise<string[]> => {
  const session = await getCurrentSession()
  if (!session?.user || questionIds.length === 0) return []

  const rows = await db
    .select({ questionId: questionBookmarks.questionId })
    .from(questionBookmarks)
    .where(
      and(
        eq(questionBookmarks.userId, session.user.id),
        inArray(questionBookmarks.questionId, questionIds),
      ),
    )
  return rows.map((r) => r.questionId)
}
```

- [ ] **Step 5: Add the action**

Dans `features/training/actions.ts` — ajouter `questionBookmarks` à l'import `@/db/schema`, `getPgErrorCode` à un nouvel import `@/lib/db-errors`, et les types du schéma ; puis, après `saveTrainingAnswer` :

```ts
/**
 * [Auth] Pose ou retire le signet de révision d'une question. Idempotente :
 * l'état voulu est passé en entrée (pas une bascule), donc une reprise réseau
 * de `callAction` ne l'inverse pas. Aucun `revalidatePath` : l'état vit dans le
 * runner côté client.
 */
export const setQuestionBookmark = async (
  input: SetQuestionBookmarkInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const parsed = setQuestionBookmarkSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { questionId, isBookmarked } = parsed.data
  const userId = session.user.id

  try {
    if (isBookmarked) {
      await db
        .insert(questionBookmarks)
        .values({ userId, questionId })
        .onConflictDoNothing()
    } else {
      await db
        .delete(questionBookmarks)
        .where(
          and(
            eq(questionBookmarks.userId, userId),
            eq(questionBookmarks.questionId, questionId),
          ),
        )
    }
    return { success: true }
  } catch (error) {
    // 23503 = FK violation : le client a envoyé un identifiant de question qui
    // n'existe pas. Erreur métier mappée → pas de capture Sentry.
    if (getPgErrorCode(error) === "23503") return fail("Question introuvable.")
    captureServerError("[setQuestionBookmark]", error, { userId })
    return fail("Erreur serveur. Réessayez.")
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun run test:integration -- tests/integration/question-bookmarks.test.ts`
Expected: PASS (5 tests).

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add features/training/schemas.ts features/training/actions.ts features/training/dal.ts tests/integration/question-bookmarks.test.ts
git commit -m "feat(revision): setQuestionBookmark idempotente + lecture des signets"
```

---

### Task 4: Corpus de révision — compteurs et tirage

Le calcul vit dans **une** requête SQL brute par usage. C'est une entorse assumée au tout-query-builder du projet : l'union des deux historiques suivie d'un `DISTINCT ON` n'est pas exprimable proprement avec le builder, et une sous-requête `.as()` mono-table y déqualifie silencieusement ses colonnes (piège déjà rencontré sur ce repo). Tous les fragments restent **paramétrés** via le template `sql` — aucun `sql.raw`, jamais de valeur client concaténée.

**Files:**

- Create: `features/training/revision.ts`
- Modify: `features/training/schemas.ts`
- Test: `tests/integration/revision-corpus.test.ts`

- [ ] **Step 1: Write the failing test**

Créer `tests/integration/revision-corpus.test.ts` :

```ts
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  questionBookmarks,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import {
  getRevisionCounts,
  pickRevisionQuestionIds,
} from "@/features/training/revision"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const OTHER_USER_ID = createId()
const DOMAIN = `RC-${suffix}`
const OBJ = `Obj RC ${suffix}`

// 0 = ratée · 1 = ratée puis réussie · 2 = réussie · 3 = marquée (jamais vue)
// 4 = jamais vue · 5 = ratée par l'AUTRE utilisateur
const qIds = Array.from({ length: 6 }, () => createId())
const SESSION_ID = createId()
const OTHER_SESSION_ID = createId()

const seedSession = async (
  sessionId: string,
  userId: string,
  items: { questionId: string; isCorrect: boolean; answeredAt: Date }[],
) => {
  await db.insert(trainingSessions).values({
    id: sessionId,
    userId,
    status: "completed",
    mode: "test",
    questionCount: items.length,
    startedAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2026-01-02T00:00:00Z"),
  })
  await db.insert(trainingSessionItems).values(
    items.map((it, position) => ({
      sessionId,
      questionId: it.questionId,
      position,
      selectedAnswer: it.isCorrect ? "A" : "B",
      isCorrect: it.isCorrect,
      answeredAt: it.answeredAt,
    })),
  )
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: USER_ID, name: "IT revision", email: `rc-${suffix}@test.invalid` },
    {
      id: OTHER_USER_ID,
      name: "IT revision autre",
      email: `rc-other-${suffix}@test.invalid`,
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `RC Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: OBJ,
      domain: DOMAIN,
    })),
  )

  await seedSession(SESSION_ID, USER_ID, [
    {
      questionId: qIds[0],
      isCorrect: false,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
    {
      questionId: qIds[1],
      isCorrect: false,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
    {
      questionId: qIds[2],
      isCorrect: true,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
  ])
  // Reprise plus tardive de q1 : réussie → elle doit SORTIR des ratées.
  await seedSession(createId(), USER_ID, [
    {
      questionId: qIds[1],
      isCorrect: true,
      answeredAt: new Date("2026-01-05T10:00:00Z"),
    },
  ])
  await seedSession(OTHER_SESSION_ID, OTHER_USER_ID, [
    {
      questionId: qIds[5],
      isCorrect: false,
      answeredAt: new Date("2026-01-01T10:00:00Z"),
    },
  ])

  await db
    .insert(questionBookmarks)
    .values({ userId: USER_ID, questionId: qIds[3] })
})

afterAll(async () => {
  await db
    .delete(questionBookmarks)
    .where(eq(questionBookmarks.userId, USER_ID))
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.userId, [USER_ID, OTHER_USER_ID]))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(inArray(user.id, [USER_ID, OTHER_USER_ID]))
})

describe("corpus de révision", () => {
  it("« ratée » = dernière tentative fausse (une réussite ultérieure la retire)", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["failed"],
      domain: DOMAIN,
      limit: 20,
    })
    expect(ids).toEqual([qIds[0]])
  })

  it("« non vue » = jamais répondue", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["unseen"],
      domain: DOMAIN,
      limit: 20,
    })
    expect([...ids].sort()).toEqual([qIds[3], qIds[4], qIds[5]].sort())
  })

  it("les critères s'unissent en OU", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["failed", "bookmarked"],
      domain: DOMAIN,
      limit: 20,
    })
    expect([...ids].sort()).toEqual([qIds[0], qIds[3]].sort())
  })

  it("borne le tirage à la limite demandée", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["unseen"],
      domain: DOMAIN,
      limit: 2,
    })
    expect(ids).toHaveLength(2)
  })

  it("n'emprunte jamais l'historique d'un autre étudiant", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["failed"],
      domain: DOMAIN,
      limit: 20,
    })
    expect(ids).not.toContain(qIds[5])
  })

  it("les compteurs décrivent le même corpus que le tirage", async () => {
    const counts = await getRevisionCounts(USER_ID, { domain: DOMAIN })
    expect(counts).toEqual({ failed: 1, unseen: 3, bookmarked: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration -- tests/integration/revision-corpus.test.ts`
Expected: FAIL — le module `@/features/training/revision` n'existe pas.

- [ ] **Step 3: Add the criteria to the schema module**

Dans `features/training/schemas.ts`, avant `createTrainingSessionSchema` :

```ts
export const REVISION_CRITERIA = ["failed", "unseen", "bookmarked"] as const
export type RevisionCriterion = (typeof REVISION_CRITERIA)[number]
export const revisionCriterionSchema = z.enum(REVISION_CRITERIA)

export const REVISION_CRITERION_LABELS: Record<RevisionCriterion, string> = {
  failed: "Ratées",
  unseen: "Non vues",
  bookmarked: "Marquées",
}
```

- [ ] **Step 4: Implement the corpus module**

Créer `features/training/revision.ts` :

```ts
import { type SQL, sql } from "drizzle-orm"
import "server-only"
import type { Db } from "@/db"
import { db } from "@/db"
import type { RevisionCriterion } from "./schemas"

// `db` ou une transaction : le tirage doit pouvoir vivre dans la transaction
// qui insère la session.
type Executor = Pick<Db, "execute">

export type RevisionCounts = Record<RevisionCriterion, number>

export type RevisionScope = {
  userId: string
  domain?: string
  objectifsCMCs?: string[]
}

// Historique unifié entraînement + examens de l'utilisateur, réduit à sa
// DERNIÈRE tentative par question. `exam_answers.created_at` vaut « début de la
// tentative » (les lignes sont pré-créées au démarrage de l'examen) : sans
// conséquence, les réponses d'un même examen sont simultanées par nature.
const historyCte = (userId: string): SQL => sql`
  attempts as (
    select i.question_id, i.is_correct, i.answered_at as at
      from training_session_items i
      join training_sessions s on s.id = i.session_id
     where s.user_id = ${userId} and i.selected_answer is not null
    union all
    select a.question_id, a.is_correct, a.created_at as at
      from exam_answers a
      join exam_participations p on p.id = a.participation_id
     where p.user_id = ${userId} and a.selected_answer is not null
  ),
  last_attempt as (
    select distinct on (question_id) question_id, is_correct
      from attempts
     order by question_id, at desc
  ),
  marked as (
    select question_id from question_bookmarks where user_id = ${userId}
    union
    select a.question_id
      from exam_answers a
      join exam_participations p on p.id = a.participation_id
     where p.user_id = ${userId} and a.is_flagged
  )
`

// Le marquage se lit hors agrégat : une question marquée mais jamais répondue
// compte comme marquée.
const CRITERION_PREDICATE: Record<RevisionCriterion, SQL> = {
  failed: sql`q.id in (select question_id from last_attempt where is_correct = false)`,
  bookmarked: sql`q.id in (select question_id from marked)`,
  unseen: sql`not exists (select 1 from attempts a2 where a2.question_id = q.id)`,
}

const corpusWhere = ({ domain, objectifsCMCs }: RevisionScope): SQL => {
  const parts: SQL[] = [sql`q.deleted_at is null`]
  if (domain && domain !== "all") parts.push(sql`q.domain = ${domain}`)

  const objectifs =
    objectifsCMCs?.map((o) => o.trim().toLowerCase()).filter(Boolean) ?? []
  if (objectifs.length > 0) {
    parts.push(
      sql`lower(q.objectif_cmc) in (${sql.join(
        objectifs.map((o) => sql`${o}`),
        sql`, `,
      )})`,
    )
  }
  return sql.join(parts, sql` and `)
}

/** Compteur par critère, sur le corpus filtré (domaine + objectifs). */
export const getRevisionCounts = async (
  userId: string,
  scope: Omit<RevisionScope, "userId"> = {},
): Promise<RevisionCounts> => {
  const res = await db.execute(sql`
    with ${historyCte(userId)}
    select
      (count(*) filter (where ${CRITERION_PREDICATE.failed}))::int as failed,
      (count(*) filter (where ${CRITERION_PREDICATE.unseen}))::int as unseen,
      (count(*) filter (where ${CRITERION_PREDICATE.bookmarked}))::int as bookmarked
      from questions q
     where ${corpusWhere({ userId, ...scope })}
  `)
  // Le cast `::int` est indispensable : sans lui, `count(*)` remonte en bigint,
  // que le driver pg rend en `string`.
  const row = res.rows[0] as Partial<RevisionCounts> | undefined
  return {
    failed: Number(row?.failed ?? 0),
    unseen: Number(row?.unseen ?? 0),
    bookmarked: Number(row?.bookmarked ?? 0),
  }
}

/**
 * Tirage aléatoire dans le corpus de révision. Les critères s'unissent en OU,
 * le tout intersecté avec domaine + objectifs. Renvoie moins que `limit` quand
 * le corpus est plus court — l'appelant démarre avec ce qu'il obtient.
 */
export const pickRevisionQuestionIds = async (
  exec: Executor,
  {
    criteria,
    limit,
    ...scope
  }: RevisionScope & { criteria: RevisionCriterion[]; limit: number },
): Promise<string[]> => {
  const unique = [...new Set(criteria)]
  if (unique.length === 0 || limit <= 0) return []

  const anyCriterion = sql.join(
    unique.map((c) => CRITERION_PREDICATE[c]),
    sql` or `,
  )
  const res = await exec.execute(sql`
    with ${historyCte(scope.userId)}
    select q.id
      from questions q
     where ${corpusWhere(scope)} and (${anyCriterion})
     order by random()
     limit ${limit}
  `)
  return res.rows.map((r) => String(r.id))
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:integration -- tests/integration/revision-corpus.test.ts`
Expected: PASS (6 tests).

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add features/training/revision.ts features/training/schemas.ts tests/integration/revision-corpus.test.ts
git commit -m "feat(revision): corpus de revision (compteurs + tirage) sur historique unifie"
```

---

### Task 5: Anti-triche — exclusion à la sélection ET aux compteurs

**C'est l'invariante centrale de la spec.** Sans elle, un filtre « mes ratées » dit à l'étudiant quelles réponses sont fausses pendant que son examen est encore ouvert — triche directe, sans jamais voir la clé.

**Files:**

- Modify: `features/training/revision.ts`
- Test: `tests/integration/revision-corpus.test.ts`

- [ ] **Step 1: Write the failing test**

Compléter les imports de `tests/integration/revision-corpus.test.ts` :

```ts
import { examParticipations, examQuestions, exams } from "@/db/schema"
```

Déclarer l'identifiant au scope du module, à côté de `SESSION_ID` :

```ts
const OPEN_EXAM_ID = createId()
```

Dans `beforeAll`, après l'insertion du signet, monter un examen OUVERT contenant `qIds[0]` (la ratée) et `qIds[3]` (la marquée), avec une participation de `USER_ID`. `completionTime` est en **secondes** et `createdBy` est obligatoire (FK `restrict` vers `user`) :

```ts
await db.insert(exams).values({
  id: OPEN_EXAM_ID,
  title: `RC examen ouvert ${suffix}`,
  startDate: new Date("2026-01-01T00:00:00Z"),
  endDate: new Date("2099-01-01T00:00:00Z"),
  completionTime: 3600,
  createdBy: USER_ID,
})
await db.insert(examQuestions).values([
  { examId: OPEN_EXAM_ID, questionId: qIds[0], position: 0 },
  { examId: OPEN_EXAM_ID, questionId: qIds[3], position: 1 },
])
await db.insert(examParticipations).values({
  id: createId(),
  examId: OPEN_EXAM_ID,
  userId: USER_ID,
  status: "in_progress",
  startedAt: new Date("2026-01-01T01:00:00Z"),
})
```

Nettoyer dans `afterAll`, **avant** la suppression des questions (`exam_questions` les référence en `restrict`) et avant celle des utilisateurs (`exams.created_by` en `restrict`) :

```ts
await db
  .delete(examParticipations)
  .where(eq(examParticipations.examId, OPEN_EXAM_ID))
await db.delete(examQuestions).where(eq(examQuestions.examId, OPEN_EXAM_ID))
await db.delete(exams).where(eq(exams.id, OPEN_EXAM_ID))
```

Ajouter les deux tests :

```ts
describe("corpus de révision — verrou examen ouvert", () => {
  it("exclut du TIRAGE les questions d'un examen ouvert où l'étudiant participe", async () => {
    const ids = await pickRevisionQuestionIds(db, {
      userId: USER_ID,
      criteria: ["failed", "bookmarked", "unseen"],
      domain: DOMAIN,
      limit: 20,
    })
    expect(ids).not.toContain(qIds[0])
    expect(ids).not.toContain(qIds[3])
  })

  it("exclut aussi des COMPTEURS (sinon le compteur redevient l'oracle)", async () => {
    const counts = await getRevisionCounts(USER_ID, { domain: DOMAIN })
    expect(counts.failed).toBe(0)
    expect(counts.bookmarked).toBe(0)
  })
})
```

Les tests de la tâche 4 restent valides : `qIds[1]`, `qIds[2]`, `qIds[4]`, `qIds[5]` ne sont pas dans l'examen. **Adapter les attentes des tests de la tâche 4** touchées par le verrou : `failed` attend désormais `[]`, `unseen` attend `[qIds[4], qIds[5]]`, l'union OU attend `[]`, et `getRevisionCounts` attend `{ failed: 0, unseen: 2, bookmarked: 0 }`. C'est le comportement voulu : la tâche 4 décrivait un monde sans examen ouvert.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration -- tests/integration/revision-corpus.test.ts`
Expected: FAIL — le tirage contient encore `qIds[0]` et `qIds[3]`, `counts.failed` vaut 1.

- [ ] **Step 3: Implement the exclusion**

Dans `features/training/revision.ts` — importer le verrou :

```ts
import { getUserOpenExamLockedQuestionIds } from "../exams/dal.shared"
```

Étendre `corpusWhere` pour accepter les identifiants verrouillés :

```ts
const corpusWhere = (
  { domain, objectifsCMCs }: RevisionScope,
  lockedIds: string[],
): SQL => {
  const parts: SQL[] = [sql`q.deleted_at is null`]
  if (domain && domain !== "all") parts.push(sql`q.domain = ${domain}`)

  const objectifs =
    objectifsCMCs?.map((o) => o.trim().toLowerCase()).filter(Boolean) ?? []
  if (objectifs.length > 0) {
    parts.push(
      sql`lower(q.objectif_cmc) in (${sql.join(
        objectifs.map((o) => sql`${o}`),
        sql`, `,
      )})`,
    )
  }

  // Verrou anti-triche appliqué à la SÉLECTION, pas seulement à la révélation :
  // l'appartenance d'une question au lot est elle-même un oracle sur les
  // réponses d'un examen encore ouvert.
  if (lockedIds.length > 0) {
    parts.push(
      sql`q.id not in (${sql.join(
        lockedIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
  }
  return sql.join(parts, sql` and `)
}
```

Dans `getRevisionCounts`, avant la requête :

```ts
const lockedIds = [...(await getUserOpenExamLockedQuestionIds(userId))]
```

et passer `corpusWhere({ userId, ...scope }, lockedIds)`.

Dans `pickRevisionQuestionIds`, avant la requête :

```ts
const lockedIds = [...(await getUserOpenExamLockedQuestionIds(scope.userId))]
```

et passer `corpusWhere(scope, lockedIds)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:integration -- tests/integration/revision-corpus.test.ts`
Expected: PASS (8 tests).

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add features/training/revision.ts tests/integration/revision-corpus.test.ts
git commit -m "fix(revision): exclure les questions d'examen ouvert du tirage ET des compteurs"
```

---

### Task 6: `createTrainingSession` accepte un filtre de révision

Deux changements de règles quand un filtre est actif : le nombre demandé est **borné** au corpus (au lieu du refus `NOT_ENOUGH`) et `MIN_QUESTIONS` ne s'applique plus. L'action renvoie le nombre **réel** de questions retenues — sans quoi l'UI annoncerait 20 questions pour une session qui en compte 7.

**Files:**

- Modify: `features/training/schemas.ts`
- Modify: `features/training/actions.ts`
- Test: `tests/integration/revision-corpus.test.ts`

- [ ] **Step 1: Write the failing test**

Ajouter à `tests/integration/revision-corpus.test.ts` (importer `createTrainingSession` et `abandonTrainingSession` depuis `@/features/training/actions`, `getCurrentSession` depuis `@/lib/dal`, et ajouter les mocks `vi.mock("next/cache", …)` et `vi.mock("@/lib/dal", …)` en tête comme dans `training-mode.test.ts`) :

```ts
describe("createTrainingSession en révision", () => {
  it("démarre avec un corpus plus court que demandé, sous MIN_QUESTIONS", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: USER_ID, role: "admin" },
    } as never)

    const res = await createTrainingSession({
      questionCount: 20,
      domain: DOMAIN,
      revisionFilters: ["unseen"],
    })
    expect(res.success).toBe(true)
    if (!res.success) return

    try {
      expect(res.questionCount).toBe(2)
      const items = await db
        .select({ id: trainingSessionItems.id })
        .from(trainingSessionItems)
        .where(eq(trainingSessionItems.sessionId, res.sessionId))
      expect(items).toHaveLength(2)
    } finally {
      await abandonTrainingSession({ sessionId: res.sessionId })
    }
  })

  it("refuse explicitement un corpus vide", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: USER_ID, role: "admin" },
    } as never)

    const res = await createTrainingSession({
      questionCount: 10,
      domain: DOMAIN,
      revisionFilters: ["failed"],
    })
    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error).toContain("Aucune question")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration -- -t "createTrainingSession en révision"`
Expected: FAIL — `revisionFilters` est rejeté par le schéma et `questionCount` n'existe pas sur la réponse.

- [ ] **Step 3: Update the schema**

Dans `features/training/schemas.ts`, remplacer `createTrainingSessionSchema` par :

```ts
export const createTrainingSessionSchema = z
  .object({
    questionCount: z
      .number()
      .int()
      .min(1)
      .max(MAX_QUESTIONS, `Au plus ${MAX_QUESTIONS} questions`),
    domain: z.string().trim().min(1).optional(),
    objectifsCMCs: z.array(z.string().trim().min(1)).max(50).optional(),
    mode: z.enum(["tutor", "test"]).optional().default("test"),
    revisionFilters: z.array(revisionCriterionSchema).max(3).optional(),
  })
  // Le plancher de 5 questions n'a de sens que pour un tirage aléatoire : trois
  // questions ratées font une session de révision légitime.
  .superRefine((value, ctx) => {
    const isRevision = (value.revisionFilters?.length ?? 0) > 0
    if (!isRevision && value.questionCount < MIN_QUESTIONS) {
      ctx.addIssue({
        code: "custom",
        message: `Au moins ${MIN_QUESTIONS} questions`,
        path: ["questionCount"],
      })
    }
  })
```

- [ ] **Step 4: Update the action**

Dans `features/training/actions.ts` :

Importer le tirage :

```ts
import { pickRevisionQuestionIds } from "./revision"
```

Élargir le type de retour :

```ts
export type CreateTrainingSessionResult =
  | { success: true; sessionId: string; questionCount: number }
  | { success: false; error: string }
```

Après la destructuration de `parsed.data`, ajouter `revisionFilters` et le drapeau :

```ts
const { questionCount, domain, objectifsCMCs, mode, revisionFilters } =
  parsed.data
const criteria = revisionFilters ?? []
const isRevision = criteria.length > 0
```

Dans la transaction, remplacer le bloc `avail` + `picked` par :

```ts
let picked: { id: string }[]
if (isRevision) {
  const ids = await pickRevisionQuestionIds(tx, {
    userId,
    criteria,
    domain,
    objectifsCMCs,
    limit: questionCount,
  })
  if (ids.length === 0) throw new Error("EMPTY_REVISION")
  picked = ids.map((id) => ({ id }))
} else {
  const [avail] = await tx
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(questions)
    .where(where)
  if ((avail?.n ?? 0) < questionCount) {
    throw new Error(`NOT_ENOUGH:${avail?.n ?? 0}`)
  }
  picked = await tx
    .select({ id: questions.id })
    .from(questions)
    .where(where)
    .orderBy(sql`random()`)
    .limit(questionCount)
}
```

L'insertion de la session doit porter le nombre **réel** — sinon le score final se calcule sur un dénominateur faux :

```ts
await tx.insert(trainingSessions).values({
  id: sessionId,
  userId,
  status: "in_progress",
  mode,
  domain: domain && domain !== "all" ? domain : null,
  objectifCmc: null,
  questionCount: picked.length,
  startedAt: now,
  expiresAt,
})
```

Le nombre retenu doit être **renvoyé depuis le callback de transaction**, pas capturé dans un `let` extérieur (règle projet : TS ne narrow pas une closure) :

```ts
const selectedCount = await db.transaction(async (tx) => {
  // … verrou de ligne, rate-limit, session active, sélection, inserts …
  return picked.length
})
```

puis, après `revalidatePath` :

```ts
return { success: true, sessionId, questionCount: selectedCount }
```

Enfin, mapper la nouvelle erreur dans le `catch`, à côté de `NOT_ENOUGH` :

```ts
if (error.message === "EMPTY_REVISION") {
  return fail(
    "Aucune question ne correspond à ces critères de révision. Élargissez la sélection.",
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:integration -- tests/integration/revision-corpus.test.ts tests/integration/training.test.ts tests/integration/training-mode.test.ts tests/integration/training-concurrency.test.ts`
Expected: PASS — y compris les tests d'entraînement existants (aucune régression du tirage aléatoire).

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add features/training/schemas.ts features/training/actions.ts tests/integration/revision-corpus.test.ts
git commit -m "feat(revision): createTrainingSession accepte un filtre de revision (borne au corpus)"
```

---

### Task 7: Action de lecture des compteurs

**Files:**

- Modify: `features/training/actions.ts`
- Test: `tests/integration/revision-corpus.test.ts`

- [ ] **Step 1: Write the failing test**

Ajouter à `tests/integration/revision-corpus.test.ts` :

```ts
describe("loadRevisionCounts", () => {
  it("compte pour l'utilisateur de la session, pas celui passé en argument", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: OTHER_USER_ID, role: "user" },
    } as never)

    const counts = await loadRevisionCounts({ domain: DOMAIN })
    expect(counts.failed).toBe(1) // la ratée de l'AUTRE utilisateur (qIds[5])
  })
})
```

Importer `loadRevisionCounts` depuis `@/features/training/actions`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration -- -t "loadRevisionCounts"`
Expected: FAIL — `loadRevisionCounts` n'est pas exporté.

- [ ] **Step 3: Implement**

Dans `features/training/actions.ts`, à la suite de `loadAvailableObjectifsCMC` :

```ts
/** [Auth] Compteurs de révision de l'utilisateur courant (formulaire). */
export const loadRevisionCounts = async (args: {
  domain?: string
  objectifsCMCs?: string[]
}): Promise<RevisionCounts> => {
  const session = await requireSession()
  return getRevisionCounts(session.user.id, args)
}
```

Compléter l'import du module de révision :

```ts
import {
  type RevisionCounts,
  getRevisionCounts,
  pickRevisionQuestionIds,
} from "./revision"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:integration -- -t "loadRevisionCounts"`
Expected: PASS.

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add features/training/actions.ts tests/integration/revision-corpus.test.ts
git commit -m "feat(revision): action loadRevisionCounts (compteurs du formulaire)"
```

---

### Task 8: Formulaire — puces « Réviser » et compteurs

**Décision d'UI, écart assumé avec la spec §5** : le curseur **n'est pas** borné par les compteurs. L'union de plusieurs critères n'est pas la somme de leurs compteurs (une question peut être à la fois ratée et marquée) — un plafond client mentirait. Les compteurs sont indicatifs, le serveur borne, et le toast annonce le nombre réel renvoyé par l'action.

**Files:**

- Modify: `app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form.tsx`
- Test: `tests/components/TrainingConfigForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Créer `tests/components/TrainingConfigForm.test.tsx` :

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TrainingConfigForm } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form"
import { motionMockFactory } from "@/tests/helpers/motion-mock"

const {
  push,
  toastError,
  toastSuccess,
  createTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
} = vi.hoisted(() => ({
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  createTrainingSession: vi.fn(),
  loadAvailableObjectifsCMC: vi.fn(),
  loadRevisionCounts: vi.fn(),
}))

vi.mock("motion/react", () => motionMockFactory)
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))
vi.mock("@/features/training/actions", () => ({
  createTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
}))

const props = {
  domains: [{ domain: "Cardiologie", count: 120 }],
  totalQuestions: 3000,
  objectifs: [{ objectif: "Obj A", count: 40 }],
}

describe("TrainingConfigForm — révision", () => {
  it("affiche les compteurs de révision", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs: props.objectifs })
    loadRevisionCounts.mockResolvedValue({
      failed: 7,
      unseen: 812,
      bookmarked: 3,
    })

    render(<TrainingConfigForm {...props} />)

    await waitFor(() => {
      expect(screen.getByTestId("revision-failed")).toHaveTextContent("7")
    })
    expect(screen.getByTestId("revision-bookmarked")).toHaveTextContent("3")
  })

  it("transmet les critères cochés à la création de session", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs: props.objectifs })
    loadRevisionCounts.mockResolvedValue({
      failed: 7,
      unseen: 812,
      bookmarked: 3,
    })
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s1",
      questionCount: 7,
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())

    await userEvent.click(screen.getByTestId("revision-failed"))
    await userEvent.click(
      screen.getByRole("button", { name: /Commencer l'entraînement/i }),
    )

    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ revisionFilters: ["failed"] }),
      )
    })
    // Le toast annonce le nombre RÉEL renvoyé par le serveur, pas la demande.
    expect(toastSuccess).toHaveBeenCalledWith(
      "Session créée !",
      expect.objectContaining({ description: expect.stringContaining("7") }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/components/TrainingConfigForm.test.tsx`
Expected: FAIL — `loadRevisionCounts` n'est pas importé par le composant, `revision-failed` introuvable.

- [ ] **Step 3: Implement**

Dans `training-config-form.tsx` :

Compléter les imports :

```ts
import {
  createTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
} from "@/features/training/actions"
import {
  REVISION_CRITERIA,
  REVISION_CRITERION_LABELS,
  type RevisionCriterion,
} from "@/features/training/schemas"
```

Ajouter l'état, sous `trainingMode` :

```ts
const [revisionFilters, setRevisionFilters] = useState<RevisionCriterion[]>([])
const [revisionCounts, setRevisionCounts] = useState<
  Record<RevisionCriterion, number>
>({ failed: 0, unseen: 0, bookmarked: 0 })
const [isCountsLoading, startCountsLoad] = useTransition()
```

Charger les compteurs sur le même modèle que les objectifs (même dépendance de domaine ; `setState` uniquement dans le callback de transition) :

```ts
useEffect(() => {
  startCountsLoad(async () => {
    try {
      const counts = await loadRevisionCounts({
        domain: selectedDomain === "all" ? undefined : selectedDomain,
        objectifsCMCs:
          selectedObjectifs.length > 0 ? selectedObjectifs : undefined,
      })
      setRevisionCounts(counts)
    } catch {
      // Compteurs indisponibles : les puces resteraient à 0 en silence, ce qui
      // ferait croire à un historique vide.
      toast.error(
        "Impossible de charger vos compteurs de révision. Vérifiez votre réseau.",
      )
    }
  })
}, [selectedDomain, selectedObjectifs])
```

Ajouter la bascule :

```ts
const toggleRevisionFilter = (criterion: RevisionCriterion) =>
  setRevisionFilters((current) =>
    current.includes(criterion)
      ? current.filter((c) => c !== criterion)
      : [...current, criterion],
  )
```

Transmettre le filtre et annoncer le nombre réel, dans `submitAction` :

```ts
const result = await createTrainingSession({
  questionCount,
  domain: selectedDomain === "all" ? undefined : selectedDomain,
  objectifsCMCs: selectedObjectifs.length > 0 ? selectedObjectifs : undefined,
  mode: trainingMode,
  revisionFilters: revisionFilters.length > 0 ? revisionFilters : undefined,
})

if (!result.success) {
  toast.error("Erreur", { description: result.error })
  return null
}

toast.success("Session créée !", {
  description: `${result.questionCount} questions sélectionnées`,
})
```

Insérer le bloc d'UI entre le sélecteur d'objectifs CMC et le mode d'entraînement :

```tsx
{
  /* Filtres de révision */
}
;<div className="space-y-3">
  <div className="flex items-center gap-2">
    <Target className="h-4 w-4 text-gray-500" />
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      Réviser (optionnel)
    </label>
  </div>

  <div className="flex flex-wrap gap-2">
    {REVISION_CRITERIA.map((criterion) => {
      const isActive = revisionFilters.includes(criterion)
      return (
        <button
          key={criterion}
          type="button"
          data-testid={`revision-${criterion}`}
          aria-pressed={isActive}
          onClick={() => toggleRevisionFilter(criterion)}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
            isActive
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "border-gray-200 bg-white/60 text-gray-700 hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
          )}
        >
          <span>{REVISION_CRITERION_LABELS[criterion]}</span>
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {isCountsLoading ? "…" : revisionCounts[criterion]}
          </span>
        </button>
      )
    })}
  </div>

  {revisionFilters.length > 0 && (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      La session prendra jusqu&apos;à {questionCount} questions parmi celles qui
      correspondent — moins s&apos;il y en a moins.
    </p>
  )}
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/components/TrainingConfigForm.test.tsx`
Expected: PASS (2 tests).

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form.tsx" tests/components/TrainingConfigForm.test.tsx
git commit -m "feat(revision): puces de revision + compteurs dans le formulaire d'entrainement"
```

---

### Task 9: Runner — marquage persistant

**Files:**

- Modify: `features/training/dal.ts`
- Modify: `app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client.tsx`
- Test: `tests/integration/training.test.ts`, `tests/components/quiz/TrainingSessionClient.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Ajouter à `tests/integration/training.test.ts` (importer `questionBookmarks` et `setQuestionBookmark`) :

```ts
it("la vue de session expose les signets de l'utilisateur", async () => {
  const created = await createTrainingSession({
    questionCount: 5,
    domain: DOMAIN,
  })
  expect(created.success).toBe(true)
  if (!created.success) return

  try {
    const before = await getTrainingSessionById(created.sessionId)
    const questionId = before!.questions[0]._id
    await setQuestionBookmark({ questionId, isBookmarked: true })

    const after = await getTrainingSessionById(created.sessionId)
    expect(after!.bookmarkedIds).toContain(questionId)
  } finally {
    await abandonTrainingSession({ sessionId: created.sessionId })
    await db
      .delete(questionBookmarks)
      .where(eq(questionBookmarks.userId, USER_ID))
  }
})
```

Le fichier fournit déjà `USER_ID`, `DOMAIN` et le helper `asAdmin()` — appeler `asAdmin()` en tête du test, comme les autres cas du fichier. Ajouter `questionBookmarks` à l'import `@/db/schema` et le supprimer dans l'`afterAll` du fichier, **avant** la suppression des questions.

- [ ] **Step 2: Write the failing component test**

Créer `tests/components/quiz/TrainingSessionClient.test.tsx` :

```tsx
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrainingSessionClient } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client"

const { setQuestionBookmark, runnerProps } = vi.hoisted(() => ({
  setQuestionBookmark: vi.fn(),
  runnerProps: { current: null as Record<string, unknown> | null },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("@/features/training/actions", () => ({
  saveTrainingAnswer: vi.fn(),
  completeTrainingSession: vi.fn(),
  setQuestionBookmark,
}))
// Le runner complet (timers, Radix, motion) est hors sujet : on capture ses props.
vi.mock("@/components/quiz/runner/quiz-runner", () => ({
  QuizRunner: (props: Record<string, unknown>) => {
    runnerProps.current = props
    return <div data-testid="runner-stub" />
  },
}))

const initialData = {
  session: {
    id: "s1",
    questionCount: 1,
    status: "in_progress" as const,
    mode: "test" as const,
    domain: null,
    startedAt: 0,
    completedAt: null,
    expiresAt: Date.now() + 3_600_000,
    score: null,
  },
  questions: [
    {
      _id: "q1",
      _creationTime: 0,
      question: "Q1 ?",
      options: ["A", "B"],
      objectifCMC: "Obj",
      domain: "Cardiologie",
      images: [],
    },
  ],
  answers: {},
  bookmarkedIds: ["q1"],
  isExpired: false,
}

describe("TrainingSessionClient — marquage", () => {
  it("hydrate les signets et persiste la bascule", async () => {
    setQuestionBookmark.mockResolvedValue({ success: true })

    render(<TrainingSessionClient sessionId="s1" initialData={initialData} />)

    const props = runnerProps.current as {
      initialFlags: Set<string>
      callbacks: {
        onFlag: (id: string, flagged: boolean) => Promise<{ ok: boolean }>
      }
    }
    expect(props.initialFlags.has("q1")).toBe(true)

    const res = await props.callbacks.onFlag("q1", false)
    expect(res.ok).toBe(true)
    expect(setQuestionBookmark).toHaveBeenCalledWith({
      questionId: "q1",
      isBookmarked: false,
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun run test -- tests/components/quiz/TrainingSessionClient.test.tsx`
Expected: FAIL — `bookmarkedIds` n'existe pas sur le type, `initialFlags` est `undefined`.

- [ ] **Step 4: Expose the bookmarks from the DAL**

Dans `features/training/dal.ts`, ajouter le champ au type :

```ts
export type TrainingSessionView = {
  session: {/* inchangé */}
  questions: TrainingSessionQuestion[]
  answers: TrainingAnswerRecord
  /** Signets de l'utilisateur courant parmi les questions de la session. */
  bookmarkedIds: string[]
  isExpired: boolean
} | null
```

Dans `getTrainingSessionById`, joindre la lecture existante des images et du verrou :

```ts
const [imgMap, lockedIds, bookmarkedIds] = await Promise.all([
  fetchImages(sessionQuestionIds),
  session.user.role === "admin"
    ? new Set<string>()
    : getOpenExamLockedQuestionIds(session.user.id, sessionQuestionIds),
  getBookmarkedQuestionIds(sessionQuestionIds),
])
```

et l'ajouter au retour, à côté de `answers` :

```ts
return {
  session: {/* inchangé */},
  questions: questionsView,
  answers,
  bookmarkedIds,
  isExpired: s.expiresAt.getTime() < Date.now(),
}
```

- [ ] **Step 5: Wire the runner**

Dans `training-session-client.tsx`, compléter l'import des actions :

```ts
import {
  completeTrainingSession,
  saveTrainingAnswer,
  setQuestionBookmark,
} from "@/features/training/actions"
```

Remplacer le no-op :

```ts
onFlag: async (questionId, isFlagged) => {
  const res = await callAction(
    () => setQuestionBookmark({ questionId, isBookmarked: isFlagged }),
    { retries: 1 }, // état voulu (pas une bascule) → reprise sans effet de bord
  )
  if (!res.success) {
    toast.error("Marquage non enregistré, réessayez.")
    return { ok: false }
  }
  return { ok: true }
},
```

et hydrater le runner :

```tsx
<QuizRunner
  questions={mappedQuestions}
  initialAnswers={initialAnswers}
  initialFlags={new Set(initialData.bookmarkedIds)}
  initialRevealed={initialRevealed}
  mode={mode}
  callbacks={callbacks}
/>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun run test -- tests/components/quiz/TrainingSessionClient.test.tsx`
Expected: PASS.

Run: `bun run test:integration -- tests/integration/training.test.ts`
Expected: PASS.

Run: `bun run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add features/training/dal.ts "app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client.tsx" tests/integration/training.test.ts tests/components/quiz/TrainingSessionClient.test.tsx
git commit -m "feat(revision): marquage persistant dans le runner d'entrainement"
```

---

### Task 10: Règle documentée et clôture

**Files:**

- Modify: `.claude/rules/data-layer.md`
- Modify: `docs/superpowers/specs/2026-08-01-revision-ciblee-entrainement-design.md`

- [ ] **Step 1: Document the invariant**

Dans `.claude/rules/data-layer.md`, à la suite du paragraphe « Passation d'examen — invariante d'accès », ajouter :

```markdown
- **Révision ciblée — le verrou s'applique à la SÉLECTION** : tout canal qui
  compose un lot de questions à partir de l'historique d'un étudiant (corpus de
  révision : `features/training/revision.ts`) DOIT retrancher
  `getUserOpenExamLockedQuestionIds` — du lot **et** des compteurs affichés.
  Masquer la correction ne suffit pas : l'appartenance d'une question au lot
  « mes ratées » dit déjà « tu t'es trompé », donc triche pendant qu'un examen
  est ouvert, sans jamais voir la clé. `getOpenExamLockedQuestionIds` n'est
  qu'une restriction du même jeu — une seule définition de la règle.
```

- [ ] **Step 2: Update the spec status and the UI decision**

Dans l'en-tête du spec, remplacer la ligne de statut par :

```markdown
- **Statut** : IMPLÉMENTÉ le 2026-08-01 (branche `feat/p1-qbank-engagement`)
```

Dans la section « 5. UI », remplacer « Le curseur de nombre se borne au corpus filtré. » par :

```markdown
Les compteurs sont **indicatifs** : le curseur n'est pas plafonné par eux, car
l'union de plusieurs critères n'est pas la somme de leurs compteurs (une même
question peut être ratée **et** marquée) — un plafond client mentirait. Le
serveur borne au corpus et `createTrainingSession` renvoie le nombre réellement
retenu, que le toast annonce.
```

Dans la section « 4. Server Actions », remplacer le nom `toggleQuestionBookmark(questionId)` par :

```markdown
- `setQuestionBookmark({ questionId, isBookmarked })` — prend l'**état voulu**
  et non une bascule, ce qui la rend idempotente : `callAction` peut la retenter
  sans inverser deux fois le marquage. Renvoie le succès et rien d'autre.
```

- [ ] **Step 3: Run the full gates**

Run: `bun run check`
Expected: exit 0.

Run: `bun run test`
Expected: PASS, couverture ≥ 80 %.

Run: `bun run test:integration`
Expected: PASS (suite complète).

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/data-layer.md docs/superpowers/specs/2026-08-01-revision-ciblee-entrainement-design.md
git commit -m "docs(revision): invariante verrou a la selection + statut du spec"
```

---

## Vérification manuelle avant revue

À faire dans le navigateur (serveur de dev lancé par l'utilisateur), une fois les dix tâches passées :

1. `/tableau-de-bord/entrainement` — les trois puces affichent des compteurs cohérents ; changer de domaine les met à jour.
2. Cocher « Ratées » avec un historique de 3 échecs, demander 20 questions : la session démarre avec 3, et le toast annonce 3.
3. Dans une session, marquer une question, quitter, revenir : le marquage est toujours là.
4. **Le test qui compte** : participer à un examen blanc **ouvert**, rater volontairement une question, puis retourner à l'entraînement — le compteur « Ratées » ne doit **pas** l'inclure, et aucun filtre ne doit la faire apparaître. Après la clôture de l'examen, elle réapparaît.
