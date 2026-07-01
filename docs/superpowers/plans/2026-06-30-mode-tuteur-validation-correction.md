# Mode tuteur : valider → corriger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En mode tuteur, l'utilisateur choisit une réponse, la **valide** explicitement, puis voit la correction (code couleur juste/faux + bonne réponse soulignée + explication), la question étant ensuite verrouillée.

**Architecture:** Flux en deux temps côté client uniquement. Le hook `useQuizSession` met la sélection « en attente » (local) jusqu'à `confirmAnswer()`, qui appelle alors `saveTrainingAnswer` (déjà existant, renvoie le `reveal`). Le runner affiche un bouton « Valider ». La `QuestionCard` colore le choix de l'utilisateur (vert/rouge) en `variant="exam"` quand la révélation est active. Aucun changement DB/DAL/serveur ; le mode test et le mode examen sont inchangés (`mode.feedback === "immediate"` identifie le tuteur).

**Tech Stack:** Next.js 16 / React 19 · Vitest + @testing-library/react (happy-dom) · Playwright (e2e).

**Politique git :** l'utilisateur committe sur demande. Les étapes « Commit » ci-dessous sont indicatives — regrouper par tâche ou en un commit final selon sa préférence, **ne jamais pusher** sans demande.

**Gate (à chaque tâche de code) :** `bun run type-check` puis `bun run lint` (PAS `bun run check`/prettier — CRLF = faux signal). Tests : `bun run test <fichier>`.

**Pré-requis déjà en place :** le correctif d'affichage de l'explication en `variant="exam"` (bloc `QuestionExplanation` gardé par `isExamVariant && showCorrectAnswer && effectiveExplanation !== undefined`) est présent dans l'arbre de travail. Ce plan s'appuie dessus.

---

## File Structure

| Fichier                                           | Responsabilité                                                                     | Action               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| `components/quiz/runner/use-quiz-session.ts`      | Logique deux-temps (pending + confirm), verrou                                     | Modifier             |
| `components/quiz/runner/quiz-runner.tsx`          | Bouton « Valider », dérivation sélection, câblage                                  | Modifier             |
| `components/quiz/question-card/index.tsx`         | Code couleur juste/faux + icônes ✓/✗ en exam révélé (gate défensif `isExamReveal`) | Modifier             |
| `app/(marketing)/evaluation/quiz/page.tsx`        | Durcissement vitrine publique : `showCorrectAnswer={false}` (anti-fuite, revue #1) | Modifier             |
| `components/quiz/question-card/answer-option.tsx` | États/icônes (déjà présents)                                                       | **Aucun changement** |
| `tests/components/quiz/use-quiz-session.test.tsx` | Tests du hook (deux temps, verrou, non-régression test mode)                       | Créer                |
| `tests/components/QuestionCard.test.tsx`          | Tests couleur juste/faux en exam révélé                                            | Modifier             |
| `e2e/pages/entrainement.page.ts`                  | POM : `selectMode`, `validateAnswer`                                               | Modifier             |
| `e2e/tests/entrainement.spec.ts`                  | Test e2e tuteur (valider → correction + couleur)                                   | Modifier             |

---

## Task 1 : Logique deux-temps dans `useQuizSession`

**Files:**

- Modify: `components/quiz/runner/use-quiz-session.ts`
- Test: `tests/components/quiz/use-quiz-session.test.tsx` (create)

- [ ] **Step 1 : Écrire le test du hook (échec attendu)**

Créer `tests/components/quiz/use-quiz-session.test.tsx` :

```tsx
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { QuizMode, QuizQuestion } from "@/components/quiz/runner/types"
import { useQuizSession } from "@/components/quiz/runner/use-quiz-session"

const questions: QuizQuestion[] = [
  { _id: "q1", question: "Q?", options: ["A", "B", "C", "D"] },
]

const tutorMode: QuizMode = {
  kind: "training",
  accent: "emerald",
  timer: null,
  pause: null,
  feedback: "immediate",
  showMeta: false,
  labels: { title: "Entraînement", finishCta: "Terminer" },
  backUrl: "/dashboard/entrainement",
}

const makeCallbacks = (onAnswer: ReturnType<typeof vi.fn>) => ({
  onAnswer,
  onFlag: vi.fn().mockResolvedValue(undefined),
  onFinish: vi.fn().mockResolvedValue({ ok: true }),
})

const renderTutor = (onAnswer: ReturnType<typeof vi.fn>, mode = tutorMode) =>
  renderHook(() =>
    useQuizSession({
      questions,
      initialAnswers: {},
      mode,
      callbacks: makeCallbacks(onAnswer),
    }),
  )

describe("useQuizSession — mode tuteur (deux temps)", () => {
  it("answerSelect met en attente sans révéler ni appeler onAnswer", async () => {
    const onAnswer = vi.fn()
    const { result } = renderTutor(onAnswer)

    await act(async () => {
      await result.current.answerSelect(0)
    })

    expect(onAnswer).not.toHaveBeenCalled()
    expect(result.current.revealed).toEqual({})
    expect(result.current.pendingSelection).toEqual({ q1: "A" })
    expect(result.current.answers.q1).toBeUndefined()
  })

  it("confirmAnswer appelle onAnswer une fois et révèle la correction", async () => {
    const onAnswer = vi.fn().mockResolvedValue({
      ok: true,
      reveal: {
        correctAnswer: "A",
        explanation: "Parce que A.",
        references: [],
      },
    })
    const { result } = renderTutor(onAnswer)

    await act(async () => {
      await result.current.answerSelect(0)
    })
    await act(async () => {
      await result.current.confirmAnswer()
    })

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith("q1", "A")
    expect(result.current.revealed.q1).toEqual({
      correctAnswer: "A",
      explanation: "Parce que A.",
      references: [],
    })
    expect(result.current.answers.q1).toEqual({
      selected: "A",
      isCorrect: true,
    })
    expect(result.current.pendingSelection.q1).toBeUndefined()
  })

  it("verrou : answerSelect est un no-op après révélation", async () => {
    const onAnswer = vi.fn().mockResolvedValue({
      ok: true,
      reveal: { correctAnswer: "A", explanation: "", references: [] },
    })
    const { result } = renderTutor(onAnswer)

    await act(async () => {
      await result.current.answerSelect(0)
    })
    await act(async () => {
      await result.current.confirmAnswer()
    })
    await act(async () => {
      await result.current.answerSelect(1) // tente de changer après validation
    })

    expect(result.current.answers.q1.selected).toBe("A")
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it("mode test (deferred) : answerSelect enregistre immédiatement", async () => {
    const onAnswer = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderTutor(onAnswer, {
      ...tutorMode,
      feedback: "deferred",
    })

    await act(async () => {
      await result.current.answerSelect(0)
    })

    expect(onAnswer).toHaveBeenCalledWith("q1", "A")
    expect(result.current.answers.q1.selected).toBe("A")
    expect(result.current.revealed).toEqual({})
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `bun run test tests/components/quiz/use-quiz-session.test.tsx`
Expected: FAIL (`result.current.pendingSelection` / `confirmAnswer` n'existent pas encore — `undefined`).

- [ ] **Step 3 : Ajouter l'état `pendingSelection` et le dérivé `isImmediate`**

Dans `components/quiz/runner/use-quiz-session.ts`, après le state `revealed` (≈ ligne 91), ajouter :

```ts
const [pendingSelection, setPendingSelection] = useState<
  Record<string, string>
>({})
```

Et après `const currentQuestion = questions[currentIndex]` (≈ ligne 111), ajouter :

```ts
const isImmediate = mode.feedback === "immediate"
```

- [ ] **Step 4 : Remplacer `answerSelect` par la version deux-temps**

Remplacer tout le bloc `answerSelect` (`const answerSelect = useCallback(...)`, ≈ lignes 153-194) par :

```ts
const answerSelect = useCallback(
  async (optionIndex: number) => {
    if (!currentQuestion) return
    const qid = currentQuestion._id
    const selected = currentQuestion.options[optionIndex]
    if (!selected) return

    // Tuteur (feedback immédiat) = deux temps : sélectionner ne fait que
    // mettre un choix « en attente » localement. Rien n'est enregistré ni
    // révélé avant confirmAnswer(). Une fois révélée, la question est
    // verrouillée (on ne peut plus changer de réponse).
    if (isImmediate) {
      if (revealed[qid]) return
      setPendingSelection((p) => ({ ...p, [qid]: selected }))
      return
    }

    // Test / examen (feedback différé) : enregistrement immédiat, pas de
    // révélation par-question. Mise à jour optimiste + rollback si échec.
    const prev = answers[qid]
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], selected } }))

    const res = await callbacks.onAnswer(qid, selected)
    if (!res.ok) {
      setAnswers((a) => {
        const next = { ...a }
        if (prev === undefined) {
          delete next[qid]
        } else {
          next[qid] = prev
        }
        return next
      })
    }
  },
  [currentQuestion, answers, callbacks, isImmediate, revealed],
)

// ---- Confirm (mode tuteur uniquement) ----

const confirmAnswer = useCallback(async () => {
  if (!currentQuestion) return
  const qid = currentQuestion._id
  if (revealed[qid]) return // déjà validée
  const selected = pendingSelection[qid]
  if (!selected) return

  const res = await callbacks.onAnswer(qid, selected)
  if (!res.ok) return // toast géré dans onAnswer ; on garde le pending pour réessai

  if (res.reveal) {
    const reveal = res.reveal
    setRevealed((r) => ({ ...r, [qid]: reveal }))
    setAnswers((a) => ({
      ...a,
      [qid]: { selected, isCorrect: selected === reveal.correctAnswer },
    }))
    setPendingSelection((p) => {
      const next = { ...p }
      delete next[qid]
      return next
    })
  }
}, [currentQuestion, revealed, pendingSelection, callbacks])
```

> Note : l'ancien bloc `if (res.reveal && mode.feedback === "immediate")` à l'intérieur d'`answerSelect` est **supprimé** (la révélation passe désormais par `confirmAnswer`). C'est le changement de comportement voulu.

- [ ] **Step 5 : Exposer `pendingSelection` et `confirmAnswer`**

Dans le type `UseQuizSessionResult`, après `revealed: Record<string, QuizRevealPayload>` (≈ ligne 43), ajouter :

```ts
// Sélection en attente (mode tuteur : choisie mais pas encore validée)
pendingSelection: Record<string, string>
// Valide la sélection en attente de la question courante (mode tuteur)
confirmAnswer: () => Promise<void>
```

Dans l'objet `return { ... }` (≈ lignes 300-322), ajouter après `revealed,` :

```ts
    pendingSelection,
    confirmAnswer,
```

- [ ] **Step 6 : Lancer le test, vérifier le succès**

Run: `bun run test tests/components/quiz/use-quiz-session.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7 : Gate**

Run: `bun run type-check` puis `bun run lint`
Expected: aucun échec.

- [ ] **Step 8 : Commit**

```bash
git add components/quiz/runner/use-quiz-session.ts tests/components/quiz/use-quiz-session.test.tsx
git commit -m "feat(quiz): mode tuteur en deux temps (sélection en attente + confirmAnswer)"
```

---

## Task 2 : Code couleur juste/faux dans `QuestionCard` (exam révélé)

> **⚠️ Garde-fou anti-fuite (revue #1)** : un 3ᵉ consommateur `variant="exam"` existe — la
> vitrine publique `app/(marketing)/evaluation/quiz/page.tsx:212` rend `<QuestionCard
variant="exam">` **sans `showCorrectAnswer`** (→ défaut `true`, `types.ts:170`) et **sans
> `correctAnswer`** (forme DAL publique). La révélation tuteur ne doit donc PAS se déclencher
> sur la seule base de `showCorrectAnswer` : on la conditionne aussi à la **présence d'un
> `correctAnswer`** (`!!question.correctAnswer`). Sans ça, la vitrine marquerait le choix de
> l'utilisateur en rouge/✗ à chaque clic. Défense en profondeur : on passe AUSSI
> `showCorrectAnswer={false}` explicitement sur la vitrine.

**Files:**

- Modify: `components/quiz/question-card/index.tsx`
- Modify: `app/(marketing)/evaluation/quiz/page.tsx` (durcissement vitrine)
- Test: `tests/components/QuestionCard.test.tsx`

- [ ] **Step 1 : Mettre à jour le test fix-1 + ajouter les nouveaux tests (échec attendu)**

**1a.** Dans `tests/components/QuestionCard.test.tsx`, dans le test existant « mode tuteur : révèle la bonne réponse ET l'explication », la bonne réponse passe de l'état `correct` à `user-correct`. Remplacer son assertion :

```tsx
      // AVANT
      const parisContainer = screen.getByText("Paris").closest("div")
      expect(parisContainer).toHaveClass("bg-green-50", "border-green-400")
      // APRÈS
      const parisContainer = screen.getByText("Paris").closest("div")
      expect(parisContainer).toHaveClass("bg-green-100", "border-green-500")
```

**1b.** Ajouter, dans le `describe("Variant: exam", ...)`, ces trois tests :

```tsx
it("mode tuteur révélé : bonne réponse en vert (✓), mauvais choix en rouge (✗)", () => {
  render(
    <QuestionCard
      variant="exam"
      question={mockQuestion} // correctAnswer = "Paris"
      selectedAnswer="Lyon" // l'utilisateur s'est trompé
      showCorrectAnswer={true}
      lazyExplanation="Paris est la capitale de la France."
    />,
  )

  // Bonne réponse (Paris) → état user-correct (vert)
  const paris = screen.getByText("Paris").closest("div")
  expect(paris).toHaveClass("bg-green-100", "border-green-500")

  // Choix de l'utilisateur, faux (Lyon) → état user-incorrect (rouge)
  const lyon = screen.getByText("Lyon").closest("div")
  expect(lyon).toHaveClass("bg-red-100", "border-red-500")
})

it("mode tuteur révélé : choix correct → la bonne réponse choisie est en vert", () => {
  render(
    <QuestionCard
      variant="exam"
      question={mockQuestion}
      selectedAnswer="Paris" // bonne réponse choisie
      showCorrectAnswer={true}
      lazyExplanation="Paris est la capitale de la France."
    />,
  )

  const paris = screen.getByText("Paris").closest("div")
  expect(paris).toHaveClass("bg-green-100", "border-green-500")
})

it("variant exam SANS correctAnswer (vitrine) : aucune révélation malgré showCorrectAnswer par défaut", () => {
  render(
    <QuestionCard
      variant="exam"
      question={{ ...mockQuestion, correctAnswer: "" }}
      selectedAnswer="Lyon"
      // showCorrectAnswer omis → défaut true ; sans correctAnswer, PAS de révélation
    />,
  )

  // Aucune explication, et le choix reste "selected" (bleu), pas "user-incorrect" (rouge)
  expect(screen.queryByTestId("explanation-content")).not.toBeInTheDocument()
  const lyon = screen.getByText("Lyon").closest("div")
  expect(lyon).toHaveClass("bg-blue-50", "border-blue-400")
  expect(lyon).not.toHaveClass("bg-red-100")
})
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `bun run test tests/components/QuestionCard.test.tsx`
Expected: FAIL — « Paris » a l'état `correct` (`bg-green-50 border-green-400`) et non `user-correct` ; « Lyon » est `selected` au lieu de `user-incorrect`. (Le test « vitrine » passe déjà, c'est un garde-fou.)

- [ ] **Step 3 : Généraliser `getAnswerState` (branche « exam révélé »)**

Dans `components/quiz/question-card/index.tsx`, remplacer la fonction `getAnswerState` (≈ lignes 40-69) par :

```tsx
const getAnswerState = (
  option: string,
  selectedAnswer: string | null | undefined,
  correctAnswer: string,
  showCorrectAnswer: boolean,
  userAnswer?: string | null,
  isReviewMode?: boolean,
  isExamReveal?: boolean,
): AnswerState => {
  const isCorrectAnswer = option === correctAnswer

  // Review mode with user answer (page résultats)
  if (isReviewMode && userAnswer !== undefined) {
    const isUserAnswer = option === userAnswer
    if (isCorrectAnswer) return "user-correct"
    if (isUserAnswer && !isCorrectAnswer) return "user-incorrect"
    return "default"
  }

  // Révélation tuteur en passation (variant exam) : on colore le choix de
  // l'utilisateur comme en review (vert = bonne réponse, rouge = choix faux).
  if (isExamReveal) {
    const isUserAnswer = selectedAnswer != null && option === selectedAnswer
    if (isCorrectAnswer) return "user-correct"
    if (isUserAnswer && !isCorrectAnswer) return "user-incorrect"
    return "default"
  }

  // Default/admin mode showing correct answer
  if (showCorrectAnswer && option === correctAnswer) {
    return "correct"
  }

  // Sélection sans révélation (examen en cours / tuteur en attente)
  if (selectedAnswer !== undefined && option === selectedAnswer) {
    return "selected"
  }

  return "default"
}
```

- [ ] **Step 4 : Définir `isExamReveal` (gate défensif) + l'utiliser pour l'explication**

Dans le corps du composant `QuestionCard`, juste après les booléens de variant (≈ lignes 235-237 : `isReviewVariant`/`isExamVariant`/`isDefaultVariant`), ajouter :

```tsx
// Révélation tuteur en passation : seulement si on montre la correction ET
// qu'on dispose réellement de la bonne réponse. Le `!!question.correctAnswer`
// protège la vitrine publique (variant="exam", showCorrectAnswer défaut true,
// mais SANS correctAnswer) — sinon le choix serait marqué faux à tort.
const isExamReveal =
  isExamVariant && showCorrectAnswer && !!question.correctAnswer
```

Puis remplacer la condition du bloc d'explication ajouté précédemment (≈ le bloc `{isExamVariant && showCorrectAnswer && effectiveExplanation !== undefined && (...)}` dans l'`<AnimatePresence>`) par :

```tsx
{
  /* Passation tuteur : explication après validation (gate défensif). */
}
{
  isExamReveal && effectiveExplanation !== undefined && (
    <div className="mt-4">
      <QuestionExplanation
        explanation={effectiveExplanation}
        references={effectiveReferences}
      />
    </div>
  )
}
```

- [ ] **Step 5 : Câbler `isExamReveal` au point de rendu des options**

Dans le `.map((option, index) => { ... })` des options (≈ lignes 445-480), utiliser la const `isExamReveal` **déjà définie au Step 4** (ne PAS la recalculer par option). Remplacer le corps du `.map` par :

```tsx
{
  question.options.map((option, index) => {
    const state = getAnswerState(
      option,
      selectedAnswer,
      question.correctAnswer,
      showCorrectAnswer,
      userAnswer,
      isReviewVariant,
      isExamReveal,
    )

    const isCorrectAnswer = option === question.correctAnswer
    const isUserAnswer = option === userAnswer
    const isSelectedOption = selectedAnswer != null && option === selectedAnswer

    return (
      <AnswerOption
        key={index}
        option={option}
        index={index}
        state={state}
        onClick={
          isExamVariant && onAnswerSelect
            ? () => onAnswerSelect(index)
            : undefined
        }
        disabled={disabled}
        showCheckIcon={
          (isReviewVariant && isCorrectAnswer) ||
          (isDefaultVariant && showCorrectAnswer && isCorrectAnswer) ||
          (isExamReveal && isCorrectAnswer)
        }
        showXIcon={
          (isReviewVariant && isUserAnswer && !isCorrectAnswer) ||
          (isExamReveal && isSelectedOption && !isCorrectAnswer)
        }
        compact={isDefaultVariant}
      />
    )
  })
}
```

> Le verrou (impossible de changer après validation) est **comportemental** : le hook `answerSelect` est un no-op une fois la question révélée (Task 1). On garde donc les options cliquables (testid `answer-option-{i}` préservé) sans les griser (`disabled` reste réservé à ses usages existants).

- [ ] **Step 6 : Durcir la vitrine publique (revue #1)**

Dans `app/(marketing)/evaluation/quiz/page.tsx`, au rendu de la `QuestionCard` (≈ lignes 212-218), ajouter `showCorrectAnswer={false}` (intention explicite : la vitrine ne révèle jamais en passation) :

```tsx
<QuestionCard
  variant="exam"
  question={currentQ as unknown as QuestionCardQuestion}
  selectedAnswer={currentAnswer}
  onAnswerSelect={handleAnswerSelect}
  showCorrectAnswer={false}
  showImage={true}
/>
```

- [ ] **Step 7 : Lancer les tests, vérifier le succès**

Run: `bun run test tests/components/QuestionCard.test.tsx`
Expected: PASS (tout le fichier : tests révélation tuteur, garde-fou vitrine, anti-triche images, variant review).

- [ ] **Step 8 : Gate**

Run: `bun run type-check` puis `bun run lint`
Expected: aucun échec.

- [ ] **Step 9 : Commit**

```bash
git add components/quiz/question-card/index.tsx app/\(marketing\)/evaluation/quiz/page.tsx tests/components/QuestionCard.test.tsx
git commit -m "feat(quiz): code couleur juste/faux en correction tuteur (variant exam) + garde-fou vitrine"
```

---

## Task 3 : Bouton « Valider » + câblage dans le runner

**Files:**

- Modify: `components/quiz/runner/quiz-runner.tsx`

- [ ] **Step 1 : Importer `Button` et l'icône**

Dans `components/quiz/runner/quiz-runner.tsx`, remplacer la ligne d'import lucide (≈ ligne 3) :

```tsx
import { CircleCheckBig, FileText } from "lucide-react"
```

Et ajouter `Button` dans le groupe `@/`, **à sa place alphabétique** — après le bloc `@/components/quiz/*` (dernier : `…/session/session-toolbar`, ≈ ligne 14) et avant `@/hooks/*` (l'ordre prettier trie le groupe `@/` alphabétiquement : `components/quiz/*` < `components/ui/*` < `hooks/*`) :

```tsx
import { Button } from "@/components/ui/button"
```

- [ ] **Step 2 : Dériver la sélection courante et injecter la bonne réponse révélée**

Remplacer la dérivation `selectedAnswer` (≈ lignes 154-156) par (inclut la sélection en attente du tuteur) :

```tsx
const selectedAnswer = currentQuestion
  ? (session.answers[currentQuestion._id]?.selected ??
    session.pendingSelection[currentQuestion._id] ??
    null)
  : null
```

Juste après `const isCurrentRevealed = ...` (≈ ligne 148), ajouter la question « augmentée » qui porte la bonne réponse issue du `reveal`. **Indispensable** : la question mappée au montage ne contient `correctAnswer` que pour les questions déjà répondues à l'arrivée (anti-triche DAL) ; pour une question validée _pendant_ la session, `correctAnswer` n'est connu que via `session.revealed`. Sans cette injection, le code couleur ne sait pas quelle option est la bonne → aucune option en vert et le choix de l'utilisateur passe en rouge à tort.

```tsx
// La question mappée au montage ne porte pas correctAnswer pour les questions
// répondues en cours de session (anti-triche DAL) ; on l'injecte depuis le
// reveal serveur pour que QuestionCard puisse colorer la bonne réponse.
const currentQuestionForCard =
  currentQuestion && currentReveal
    ? { ...currentQuestion, correctAnswer: currentReveal.correctAnswer }
    : currentQuestion
```

Puis, dans le JSX de la carte (≈ ligne 209), remplacer `question={currentQuestion as never}` par `question={currentQuestionForCard as never}`.

- [ ] **Step 3 : Garde anti double-clic + bouton « Valider ma réponse »**

**3a.** Ajouter un état `isConfirming` et un handler dans `QuizRunnerInner` (par ex. à côté des autres `useState`, ≈ ligne 56-69) pour empêcher un double `saveTrainingAnswer` si l'utilisateur clique deux fois avant que la révélation n'arrive (constat revue 🟡) :

```tsx
const [isConfirming, setIsConfirming] = useState(false)

const handleConfirmAnswer = async () => {
  if (isConfirming) return
  setIsConfirming(true)
  try {
    await session.confirmAnswer()
  } finally {
    setIsConfirming(false)
  }
}
```

**3b.** Dans le JSX, entre la fermeture du bloc `</AnimatePresence>` de la carte (≈ ligne 235) et le commentaire `{/* Navigation buttons */}` (≈ ligne 237), insérer :

```tsx
{
  /* Mode tuteur : valider sa réponse révèle la correction.
                    Visible seulement quand une option est choisie et que la
                    question n'est pas encore révélée. */
}
{
  mode.feedback === "immediate" &&
    currentQuestion &&
    !isCurrentRevealed &&
    session.pendingSelection[currentQuestion._id] !== undefined && (
      <Button
        onClick={() => void handleConfirmAnswer()}
        disabled={isConfirming}
        data-testid="btn-validate-answer"
        size="lg"
        className="bg-linear-to-r w-full gap-2 from-emerald-600 to-teal-600 shadow-md hover:from-emerald-700 hover:to-teal-700"
      >
        <CircleCheckBig className="h-4 w-4" />
        Valider ma réponse
      </Button>
    )
}
```

- [ ] **Step 4 : Gate**

Run: `bun run type-check` puis `bun run lint`
Expected: aucun échec.

- [ ] **Step 5 : Re-vérifier les tests composant (non-régression)**

Run: `bun run test tests/components/quiz tests/components/QuestionCard.test.tsx`
Expected: PASS (aucune régression sur le runner / la carte).

- [ ] **Step 6 : Commit**

```bash
git add components/quiz/runner/quiz-runner.tsx
git commit -m "feat(quiz): bouton « Valider ma réponse » en mode tuteur"
```

---

## Task 4 : E2E tuteur (valider → correction + couleur)

**Files:**

- Modify: `e2e/pages/entrainement.page.ts`
- Modify: `e2e/tests/entrainement.spec.ts`

- [ ] **Step 1 : Ajouter les méthodes POM**

Dans `e2e/pages/entrainement.page.ts`, ajouter ces méthodes dans la classe (après `selectAnswer`, ≈ ligne 84) :

```ts
  /** Sélectionne le mode d'entraînement dans le formulaire de config. */
  async selectMode(mode: "tutor" | "test") {
    await this.page.locator(`label[for="mode-${mode}"]`).click()
  }

  /** Valide la réponse en attente (mode tuteur) → révèle la correction. */
  async validateAnswer() {
    await this.page.getByTestId("btn-validate-answer").click()
  }
```

- [ ] **Step 2 : Ajouter le test e2e tuteur**

Dans `e2e/tests/entrainement.spec.ts`, ajouter ce test à l'intérieur du `test.describe("Entrainement — session complete", ...)` (par ex. après le `journey complet`, ≈ ligne 98) :

```ts
test("mode tuteur : valider révèle la correction et le code couleur", async ({
  page,
}) => {
  await entrainement.goto()
  if (!(await entrainement.hasAccess())) test.skip()

  await entrainement.waitForForm()
  await entrainement.setQuestionCount(5)
  await entrainement.selectMode("tutor")
  await entrainement.startSession()
  await entrainement.waitForQuestion(1, 5)

  // Choisir une option : aucune correction tant qu'on n'a pas validé.
  await entrainement.selectAnswer(0)
  await expect(page.getByTestId("explanation-content")).toBeHidden()
  await expect(page.getByTestId("btn-validate-answer")).toBeVisible()

  // Valider → correction + explication + code couleur.
  await entrainement.validateAnswer()
  await expect(page.getByTestId("explanation-content")).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByTestId("btn-validate-answer")).toBeHidden()
  // Exactement une bonne réponse surlignée en vert (état user-correct).
  await expect(
    page.locator('[data-testid^="answer-option-"] .border-green-500'),
  ).toHaveCount(1)
})
```

- [ ] **Step 3 : Lancer UNIQUEMENT ce fichier e2e**

> ⚠️ La suite e2e mute la base Neon de dev. Ne lancer QUE ce fichier.

Run: `bun run test:e2e e2e/tests/entrainement.spec.ts`
Expected: PASS (le nouveau test + les tests existants du fichier). Si « Executable doesn't exist » : `bunx playwright install chromium`.

- [ ] **Step 4 : Commit**

```bash
git add e2e/pages/entrainement.page.ts e2e/tests/entrainement.spec.ts
git commit -m "test(e2e): mode tuteur — valider révèle correction + code couleur"
```

---

## Task 5 : Gate final + récap

**Files:** aucun (vérification).

- [ ] **Step 1 : Type-check + lint**

Run: `bun run type-check` puis `bun run lint`
Expected: aucun échec.

- [ ] **Step 2 : Tests composant ciblés**

Run: `bun run test tests/components/quiz tests/components/QuestionCard.test.tsx`
Expected: PASS (hook + carte + runner).

- [ ] **Step 3 : Récapituler à l'utilisateur**

Résumer : flux deux-temps (choisir → Valider → corriger), code couleur juste/faux, verrou comportemental, mode test/examen inchangés. Lister les fichiers touchés et les résultats du gate. Ne pas pusher sans demande.

---

## Self-Review (auteur du plan)

- **Couverture spec** :
  - Validation avant correction → Task 1 (`pendingSelection` + `confirmAnswer`) + Task 3 (bouton). ✓
  - Code couleur juste/faux + bonne réponse soulignée → Task 2 (`getAnswerState` exam révélé + icônes) **+ Task 3 Step 2** (injection de `correctAnswer` depuis le `reveal` : sans elle, la carte ignore quelle option est la bonne pour une question répondue en session). ✓
  - Verrouillage après validation → Task 1 (no-op d'`answerSelect` quand révélé). ✓
  - Mode test/examen inchangés → Task 1 (branche `deferred` identique) + tests de non-régression. ✓
  - Anti-triche F3 (pas d'images d'explication en passation) → inchangé (le bloc exam ne passe pas `explanationImages`). ✓
  - **Anti-fuite vitrine `/evaluation/quiz` (revue #1)** → Task 2 : `isExamReveal` exige `!!question.correctAnswer` (la vitrine n'en a pas) + `showCorrectAnswer={false}` explicite + test garde-fou. ✓
  - Skip autorisé / reload / retour question → comportement préservé (pending local, `initialRevealed` hydraté). ✓
  - Double-clic « Valider » (revue 🟡) → Task 3 Step 3a : garde `isConfirming` + `disabled`. ✓
- **Placeholders** : aucun (code complet à chaque étape).
- **Cohérence des types** : `pendingSelection: Record<string,string>` et `confirmAnswer: () => Promise<void>` définis dans `UseQuizSessionResult` (Task 1) et consommés dans le runner (Task 3) ; `isExamReveal` défini **une fois dans le corps du composant** (Task 2 Step 4) et réutilisé par le bloc explication ET le `.map` des options. Classes CSS asserties (`bg-green-100/border-green-500`, `bg-red-100/border-red-500`, `bg-blue-50/border-blue-400`) = exactement les `stateStyles` de `user-correct`/`user-incorrect`/`selected` dans `answer-option.tsx`. ✓
- **Constats revue traités** : #1 (fuite vitrine) → gate `!!correctAnswer` + `showCorrectAnswer={false}` + test ; #2 (test fix-1 cassé) → Task 2 Step 1a met à jour l'assertion `correct`→`user-correct` ; 🟡 double-clic → Step 3a ; ℹ️ ordre d'import → Step 1 corrigé. Non-régression e2e journey (mode test par défaut) → confirmée par la revue. ✓
