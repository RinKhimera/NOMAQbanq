# Images d'explication des questions (Feature 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'attacher plusieurs images à l'explication d'une question, gérées comme les images d'énoncé, et affichées uniquement à la correction (dashboard + quiz vitrine), jamais pendant la passation.

**Architecture:** Une colonne discriminante `kind` (`statement`/`explanation`) sur `questionImages` réutilise tout le pipeline d'upload S3. ⚠️ **Bloquant** : toutes les lectures d'images d'énoncé existantes doivent être scopées à `kind='statement'`, sinon les images d'explication fuiteraient dans `images` rendu pendant la passation. Les `explanationImages` voyagent sur le canal de l'explication (lazy examen / eager entraînement / clé de correction vitrine).

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM + Neon, AWS S3 + CloudFront, Tailwind v4 + shadcn/ui, Vitest.

**Spec source :** [`docs/superpowers/specs/2026-06-28-images-explication-questions-design.md`](../specs/2026-06-28-images-explication-questions-design.md)

**Branche :** `feat/refonte-quiz-audience-images`.

> **Dépendance F1 :** l'affichage des `explanationImages` vit dans `<SessionResults>` / `QuestionCard variant="review"` (F1) et dans le canal `explanationImages` de `getExamQuestionExplanations` (préparé en F1). Si F1 n'est pas livrée, F3 peut quand même persister/servir le champ ; l'affichage dashboard atterrit avec F1.

---

## File Structure

**Modifiés :**

- `db/schema/enums.ts` — enum `questionImageKind`.
- `db/schema/questions.ts` — `questionImages.kind` + index ; drop `questionExplanations.imagePath`.
- `lib/storage.ts` — `generateQuestionImageTmpPath`/`finalPathFromTmp` intègrent `kind`.
- `features/questions/schemas.ts` — `kind` dans `setQuestionImagesSchema`.
- `features/questions/actions.ts` — `kind` dans `createQuestionImageUpload` + `setQuestionImages` scopé.
- `features/questions/dal.ts` — `getQuestionById` (deux jeux) ; lectures d'énoncé scopées `kind='statement'` ; `getQuizAnswerKey` (explanationImages).
- `features/exams/dal.ts` — `fetchImages` scopé `statement` ; `getExamQuestionExplanations` (explanationImages).
- `features/training/dal.ts` — `fetchImages` scopé `statement` ; `getTrainingSessionResults` (explanationImages).
- `components/admin/question-image-uploader.tsx` — prop `kind`.
- `app/(admin)/admin/questions/_components/question-form-page.tsx` — deux sections d'upload.

**Créés :**

- `tests/integration/explanation-images.test.ts`.

---

## Task 1 : Schéma `kind` + drop `imagePath`

**Files:**

- Modify: `db/schema/enums.ts`
- Modify: `db/schema/questions.ts`

- [ ] **Step 1 : Enum**

```ts
export const questionImageKind = pgEnum("question_image_kind", [
  "statement",
  "explanation",
])
```

- [ ] **Step 2 : Colonne + index + drop**

Dans `db/schema/questions.ts` : importer `questionImageKind` ; ajouter à `questionImages` :

```ts
kind: questionImageKind("kind").default("statement").notNull(),
```

Ajouter l'index `(questionId, kind)` :

```ts
(t) => [
  index("question_images_question_id_idx").on(t.questionId),
  index("question_images_question_kind_idx").on(t.questionId, t.kind),
],
```

Retirer la ligne `imagePath: text("image_path"), …` de `questionExplanations`.

- [ ] **Step 3 : Générer + inspecter + migrer**

Run: `bun run db:generate` → vérifier `CREATE TYPE question_image_kind`, `ALTER TABLE question_images ADD COLUMN kind … DEFAULT 'statement' NOT NULL`, `DROP COLUMN image_path`. Puis `bun run db:migrate`.

- [ ] **Step 4 : Commit**

```bash
git add db/schema/enums.ts db/schema/questions.ts drizzle/
git commit -m "feat(db): questionImages.kind, drop questionExplanations.imagePath"
```

---

## Task 2 : Chemins S3 namespacés par `kind`

**Files:**

- Modify: `lib/storage.ts`

- [ ] **Step 1 : `generateQuestionImageTmpPath` prend `kind`**

```ts
export const generateQuestionImageTmpPath = (
  questionId: string,
  kind: "statement" | "explanation",
  index: number,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `tmp/questions/${questionId}/${kind}/${Date.now()}-${index}.${cleanExt}`
}
```

`finalPathFromTmp` reste inchangé (strip `tmp/` → `questions/{id}/{kind}/…`). La garde de préfixe `questions/${questionId}/` (utilisée dans `setQuestionImages`) couvre toujours les deux kinds (sous-dossier). `generateQuestionImagePath` (non-tmp) peut être laissé tel quel (non utilisé dans le flux principal) ou aligné de la même façon si appelé.

- [ ] **Step 2 : Compiler** — Run: `bunx tsc --noEmit` → erreurs dans `actions.ts` (appel à `generateQuestionImageTmpPath`), corrigées en Task 3.

- [ ] **Step 3 : Commit** — `git add lib/storage.ts && git commit -m "feat(storage): chemin tmp namespacé par kind"`

---

## Task 3 : `setQuestionImages` + `createQuestionImageUpload` scopés par `kind`

**Files:**

- Modify: `features/questions/schemas.ts`
- Modify: `features/questions/actions.ts`
- Test: `tests/integration/explanation-images.test.ts`

- [ ] **Step 1 : Tests (échec attendu)**

Créer `tests/integration/explanation-images.test.ts` :

```ts
import { and, eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import { questionImages } from "@/db/schema"
import { setQuestionImages } from "@/features/questions/actions"

describe("setQuestionImages scopé par kind", () => {
  it("sauver statement ne supprime pas explanation", async () => {
    const { adminId, questionId } = await seedQuestion()
    await asUser(adminId, async () => {
      await setQuestionImages({
        questionId,
        kind: "explanation",
        images: [
          {
            storagePath: `questions/${questionId}/explanation/0.jpg`,
            order: 0,
          },
        ],
      })
      await setQuestionImages({
        questionId,
        kind: "statement",
        images: [
          { storagePath: `questions/${questionId}/statement/0.jpg`, order: 0 },
        ],
      })
    })
    const rows = await db
      .select()
      .from(questionImages)
      .where(eq(questionImages.questionId, questionId))
    expect(rows.filter((r) => r.kind === "explanation")).toHaveLength(1)
    expect(rows.filter((r) => r.kind === "statement")).toHaveLength(1)
  })
})
```

> Note : en intégration, on passe des `storagePath` déjà finaux (`questions/{id}/{kind}/…`) → pas de copie S3 réelle requise (le code conserve les chemins déjà finaux).

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test:integration -- explanation-images` → FAIL (`kind` inconnu).

- [ ] **Step 3 : Schéma** — dans `features/questions/schemas.ts`, ajouter à `setQuestionImagesSchema` :

```ts
kind: z.enum(["statement", "explanation"]).default("statement"),
```

- [ ] **Step 4 : `setQuestionImages` scopé** — dans `features/questions/actions.ts` :
  - déstructurer `kind` de `parsed.data` ;
  - la garde de préfixe devient `questions/${questionId}/${kind}/` ;
  - le `old`-query filtre `and(eq(questionImages.questionId, questionId), eq(questionImages.kind, kind))` ;
  - le `delete` filtre de même `(questionId, kind)` ;
  - l'`insert` ajoute `kind` à chaque ligne ;
  - le calcul `newPaths`/cleanup reste, mais ne concerne que les chemins du `kind` courant (puisque `old` est filtré).

```ts
const finalPrefix = `questions/${questionId}/${kind}/`
// …
const old = await tx
  .select({ storagePath: questionImages.storagePath })
  .from(questionImages)
  .where(
    and(
      eq(questionImages.questionId, questionId),
      eq(questionImages.kind, kind),
    ),
  )
await tx
  .delete(questionImages)
  .where(
    and(
      eq(questionImages.questionId, questionId),
      eq(questionImages.kind, kind),
    ),
  )
if (planned.length > 0) {
  await tx.insert(questionImages).values(
    planned.map((p) => ({
      questionId,
      kind,
      storagePath: p.finalPath,
      position: p.order,
    })),
  )
}
```

- [ ] **Step 5 : `createQuestionImageUpload` prend `kind`** — ajouter `kind: "statement" | "explanation"` à l'input (défaut `"statement"`), le valider, et le passer à `generateQuestionImageTmpPath(questionId, kind, imageIndex, ext)`.

- [ ] **Step 6 : Lancer (succès)** — Run: `bun run test:integration -- explanation-images` → PASS.

- [ ] **Step 7 : Commit** — `git add features/questions/schemas.ts features/questions/actions.ts tests/integration/explanation-images.test.ts && git commit -m "feat(questions): setQuestionImages/upload scopés par kind"`

---

## Task 4 : ⚠️ Scoper toutes les lectures d'énoncé à `kind='statement'` (BLOQUANT #1)

**Files:**

- Modify: `features/exams/dal.ts` (`fetchImages:60`)
- Modify: `features/training/dal.ts` (`fetchImages:98`)
- Modify: `features/questions/dal.ts` (`getRandomQuizQuestions:369`, `getQuestionById` images:256)
- Modify: `features/questions/dal.ts` (comptes/filtres ADMIN : `hasImagesSubquery`/`noImagesSubquery:49-60`, comptage `getQuestionsWithFilters:165-180`, `getQuestionStatsEnriched:499-512`, `getQuestionsForExport:598-613`)
- Test: `tests/integration/explanation-images.test.ts`

- [ ] **Step 1 : Test (échec attendu)** — vérifier qu'une image `explanation` n'apparaît jamais dans `images` d'énoncé :

```ts
it("les lectures d'énoncé ne remontent que kind=statement", async () => {
  const { adminId, questionId } = await seedQuestion()
  await asUser(adminId, async () => {
    await setQuestionImages({
      questionId,
      kind: "statement",
      images: [
        { storagePath: `questions/${questionId}/statement/0.jpg`, order: 0 },
      ],
    })
    await setQuestionImages({
      questionId,
      kind: "explanation",
      images: [
        { storagePath: `questions/${questionId}/explanation/0.jpg`, order: 0 },
      ],
    })
  })
  const q = (await getRandomQuizQuestions({ count: 50 })).find(
    (x) => x._id === questionId,
  )
  expect(q?.images).toHaveLength(1)
  expect(q?.images[0].storagePath.includes("/statement/")).toBe(true)
})
```

- [ ] **Step 2 : Lancer (échec)** — FAIL (remonte 2 images).

- [ ] **Step 3 : Scoper `fetchImages` (exams + training)** — ajouter un paramètre `kind` (défaut `"statement"`) et filtrer :

```ts
const fetchImages = async (
  questionIds: string[],
  kind: "statement" | "explanation" = "statement",
) => {
  if (questionIds.length === 0) return new Map<string, ExamImageView[]>() // (TrainingImageView côté training)
  const rows = await db
    .select({
      questionId: questionImages.questionId,
      storagePath: questionImages.storagePath,
      position: questionImages.position,
    })
    .from(questionImages)
    .where(
      and(
        eq(questionImages.kind, kind),
        inArray(questionImages.questionId, questionIds),
      ),
    )
    .orderBy(asc(questionImages.position))
  return groupImages(rows)
}
```

Importer `and`, `eq` si nécessaire. Les appels existants (`fetchImages(ids)`) restent corrects (défaut `statement`).

- [ ] **Step 4 : Scoper `getRandomQuizQuestions` et `getQuestionById` (images d'énoncé)** — ajouter `eq(questionImages.kind, "statement")` à la clause `where` de la requête d'images dans `getRandomQuizQuestions` (`features/questions/dal.ts:369`) et dans `getQuestionById` (le `select` des `imgs`, ligne ~256).

- [ ] **Step 4b : Scoper les comptes/filtres ADMIN à `statement` (revue #7)** — sinon `imageCount`/`hasImages`/stats conflateraient les images d'explication. Ajouter `eq(questionImages.kind, "statement")` à : `hasImagesSubquery`/`noImagesSubquery` (`:49-60`), le `select` de comptage de `getQuestionsWithFilters` (`:165-180`), le `count(distinct …)` de `getQuestionStatsEnriched` (`:499-512`), et le comptage de `getQuestionsForExport` (`:598-613`). Décision : ces compteurs reflètent les **images d'énoncé** (sens admin actuel).

- [ ] **Step 4c : Étendre le test (verrouillage #7)** — dans `explanation-images.test.ts`, vérifier qu'une question n'ayant QUE des images `explanation` a `imageCount = 0` dans `getQuestionsWithFilters` et n'est PAS comptée dans `withImagesCount` (`getQuestionStatsEnriched`), tandis qu'une image `statement` l'est.

- [ ] **Step 5 : Lancer (succès)** — Run: `bun run test:integration -- explanation-images` → PASS.

- [ ] **Step 6 : Commit** — `git add features/exams/dal.ts features/training/dal.ts features/questions/dal.ts tests/integration/explanation-images.test.ts && git commit -m "fix(quiz): lectures d'énoncé scopées kind=statement (anti-fuite, revue #1)"`

---

## Task 5 : Canal `explanationImages` (admin + correction + vitrine)

**Files:**

- Modify: `features/questions/dal.ts` (`getQuestionById`, `getQuizAnswerKey`)
- Modify: `features/exams/dal.ts` (`getExamQuestionExplanations`)
- Modify: `features/training/dal.ts` (`getTrainingSessionResults`)
- Test: `tests/integration/explanation-images.test.ts`

- [ ] **Step 1 : Tests (échec attendu)** — `getQuestionById` renvoie `explanationImages` (kind=explanation) à part ; `getExamQuestionExplanations` et `getQuizAnswerKey` incluent `explanationImages` ; `getTrainingSessionResults` aussi.

- [ ] **Step 2 : Lancer (échec)** — FAIL.

- [ ] **Step 3 : `getQuestionById`** — ajouter au type `QuestionDetail` `explanationImages: QuestionImageView[]` et charger les lignes `kind='explanation'` (requête analogue au `imgs` d'énoncé, filtrée `kind='explanation'`).

- [ ] **Step 4 : Helper de lecture explication** — dans `features/questions/dal.ts`, un helper interne `fetchExplanationImages(questionIds): Map<string, {url,storagePath,order}[]>` (filtre `kind='explanation'`, `cdnUrl`). L'utiliser dans `getQuizAnswerKey` : ajouter `explanationImages: string→[]` au type `QuizAnswerKey` et peupler.

- [ ] **Step 5 : `getExamQuestionExplanations`** — peupler `explanationImages` (déjà ajouté au type en F1, vide) via `fetchExplanationImages`. Vérifier que `loadExamQuestionExplanations` propage.

- [ ] **Step 6 : `getTrainingSessionResults`** — ajouter `explanationImages` à `TrainingSessionQuestion` (optionnel) et le peupler dans `questionsView` (session complétée) via une lecture `kind='explanation'`.

- [ ] **Step 7 : Lancer (succès)** — Run: `bun run test:integration -- explanation-images` → PASS.

- [ ] **Step 8 : Commit** — `git add features/ tests/integration/explanation-images.test.ts && git commit -m "feat(quiz): explanationImages sur le canal explication (admin/correction/vitrine)"`

---

## Task 6 : Étendre le test anti-triche paramétré (revue)

**Files:**

- Modify: `tests/integration/passation-anti-cheat.test.ts` (créé en F1) ou créer si F1 non livrée

- [ ] **Step 1 : Ajouter `explanationImages` aux champs interdits** — pour une question avec des images d'explication, vérifier qu'`explanationImages` est **absent** des questions renvoyées en passation (`getExamWithQuestions` non-admin, `getTrainingSessionById` mode test) et que `images` ne contient aucune image `explanation`.

- [ ] **Step 2 : Lancer** — Run: `bun run test:integration -- passation-anti-cheat` → PASS.

- [ ] **Step 3 : Commit** — `git add tests/integration/passation-anti-cheat.test.ts && git commit -m "test: anti-triche couvre explanationImages et images statement"`

---

## Task 7 : Éditeur admin — deux sections d'upload

**Files:**

- Modify: `components/admin/question-image-uploader.tsx`
- Modify: `app/(admin)/admin/questions/_components/question-form-page.tsx`

- [ ] **Step 1 : Prop `kind` sur l'uploader** — ajouter `kind?: "statement" | "explanation"` (défaut `"statement"`) à `QuestionImageUploaderProps` et le passer à `createQuestionImageUpload({ questionId, kind, imageIndex, … })`. Le reste du composant est inchangé (les `storagePath` reviennent déjà namespacés depuis le presign).

- [ ] **Step 2 : Deux sections dans le formulaire** — dans `question-form-page.tsx`, dupliquer l'état/section d'images : `statementImages` (existant, `kind="statement"`) et `explanationImages` (`kind="explanation"`). Au save, appeler `setQuestionImages` **deux fois** (un par `kind`). Au chargement (édition), `getQuestionById` fournit `images` (statement) et `explanationImages` — mapper chacun via `cdnUrl`. Libellés : « Images de l'énoncé » / « Images de l'explication ».

- [ ] **Step 3 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur.

- [ ] **Step 4 : Commit** — `git add components/admin/question-image-uploader.tsx app/(admin)/admin/questions/ && git commit -m "feat(admin): upload d'images d'explication (section dédiée)"`

---

## Task 8 : Affichage à la correction

**Files:**

- Modify: `components/quiz/results/session-results.tsx` (F1) **ou** la vue de résultats existante si F1 non livrée
- Modify: vue de correction du quiz vitrine (composant marketing consommant `scoreQuizAnswers`)

- [ ] **Step 1 : Dashboard** — dans `<SessionResults>` / `QuestionCard variant="review"`, afficher `question.explanationImages` sous le texte d'explication (grille d'images, `next/image` + `cdnUrl` déjà appliqué côté DAL). Aucun affichage en `variant="exam"`.

- [ ] **Step 2 : Vitrine** — dans la vue de correction marketing, afficher `explanationImages` de la clé de correction sous l'explication.

- [ ] **Step 3 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur. Vérifier visuellement (ou E2E) qu'aucune image d'explication n'apparaît pendant la passation.

- [ ] **Step 4 : Commit** — `git add components/quiz/ app/(marketing)/ && git commit -m "feat(quiz): affichage des images d'explication à la correction"`

---

## Task 9 : Vérification finale

- [ ] **Step 1 :** Run: `bun run check && bun run test && bun run test:integration` → tout vert.
- [ ] **Step 2 :** Nettoyage `afterAll` : supprimer `questionImages` (cascade via `questions`) — respecter l'ordre FK.
- [ ] **Step 3 : Commit** des ajustements éventuels.

---

## Self-Review (effectuée)

- **Couverture spec :** modèle `kind` + drop imagePath (T1) · chemins namespacés (T2) · upload/setImages scopés (T3) · **anti-fuite lectures d'énoncé #1 (T4)** · canal explication admin/correction/vitrine #4 (T5) · test anti-triche étendu (T6) · UI deux sections (T7) · affichage correction + vitrine D2 (T8).
- **Placeholders :** corps de tests « … » (T5-step1) décrivent un scénario précis reproduisant le pattern de T3/T4 (code complet fourni). T8 renvoie aux composants de F1 à étendre (un champ optionnel à rendre).
- **Cohérence des types :** `kind` (`"statement" | "explanation"`) identique partout (schéma, storage, actions, DAL) ; `explanationImages` aligné sur la forme `{url,storagePath,order}` (= `QuizImageView`/`QuizImage` de F1) dans tous les canaux.
- **Dépendance F1 :** T5 (canal `getExamQuestionExplanations`) et T8 (affichage `<SessionResults>`) supposent F1 ; notes explicites pour le cas où F1 n'est pas encore livrée.
