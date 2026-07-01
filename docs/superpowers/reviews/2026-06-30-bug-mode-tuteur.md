# Bug « le mode tuteur ne révèle pas après chaque réponse » — rapport

Date : 2026-06-30 · Branche : `feat/refonte-quiz-audience-images`

## TL;DR

La chaîne de données du `mode` (`tutor`/`test`) est **correcte de bout en bout** :
le formulaire envoie `"tutor"`, la base le stocke, le DAL le re-projette, le client
le mappe en `feedback: "immediate"`, le serveur renvoie bien le `reveal`, et le
runner calcule `showCorrectAnswer={true}` + passe `lazyExplanation` à la
`QuestionCard`.

**La cause racine est le dernier maillon — le rendu.** Dans
`components/quiz/question-card/index.tsx`, le bloc d'explication est gardé par
`isReviewVariant && isExpanded`. Or la passation (examen **et** entraînement) rend
la carte en `variant="exam"`. Donc en mode tuteur, l'explication révélée n'est
**jamais** affichée — `variant="exam"` ignore purement `lazyExplanation`.

---

## 1. Repro (prouvée par test rouge ciblé)

Au lieu d'un run navigateur (la suite e2e mute la base Neon de dev), repro par un
test composant ciblé qui rejoue exactement ce que le runner passe à la `QuestionCard`
en tuteur après une réponse :

```tsx
render(
  <QuestionCard
    variant="exam" // ← le runner rend toujours variant="exam"
    question={mockQuestion}
    selectedAnswer="Lyon"
    showCorrectAnswer={true} // ← isCurrentRevealed=true en tuteur
    lazyExplanation="Paris est la capitale de la France."
    lazyReferences={["Atlas géographique, p.12"]}
  />,
)
```

- **Attendu** : la bonne réponse surlignée **et** l'explication + références visibles
  immédiatement.
- **Réel (avant fix)** : l'assertion `getByText("Paris")` a bien la classe
  `bg-green-50 border-green-400` (le **surlignage** de la bonne réponse fonctionne),
  puis le test échoue sur `getByTestId("explanation-content")` → **l'explication est
  absente du DOM**. C'est le « rien ne se révèle » rapporté : le signal dominant
  (explication) manque, et le feedback de réponse restant est si discret (pas
  d'icône ✓, la mauvaise réponse non marquée en rouge) qu'il se lit comme « aucune
  correction par question ».

```
FAIL  tests/components/QuestionCard.test.tsx > … révèle … l'explication
  > 180 | expect(screen.getByTestId("explanation-content")).toBeInTheDocument()
  Unable to find an element by: [data-testid="explanation-content"]
```

## 2. Cause racine (`fichier:ligne`)

`components/quiz/question-card/index.tsx:489-510` (avant fix) :

```tsx
<AnimatePresence>
  {isReviewVariant && isExpanded && (        // ← garde : SEULEMENT variant="review"
    <div className="mt-4">
      {effectiveExplanation !== undefined ? (
        <QuestionExplanation … />
      ) : ( /* skeleton */ )}
    </div>
  )}
</AnimatePresence>
```

`isReviewVariant = variant === "review"`. Le runner d'entraînement rend
`variant="exam"` (`components/quiz/runner/quiz-runner.tsx:210`) en passant pourtant
`showCorrectAnswer={isCurrentRevealed}` et `lazyExplanation={…}`
(`quiz-runner.tsx:219-231`). Comme `isReviewVariant === false` en passation, le bloc
d'explication n'est **jamais monté**, quelles que soient les props de révélation.

Le reste de la chaîne est sain (vérifié ligne par ligne) :

| Maillon         | Fichier:ligne                             | Valeur réelle                                                         |
| --------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Radio tuteur    | `training-config-form.tsx:328-331`        | `value="tutor"` ✓                                                     |
| Submit          | `training-config-form.tsx:101`            | `mode: trainingMode` ✓                                                |
| Zod             | `features/training/schemas.ts:15`         | `z.enum(["tutor","test"])` ✓                                          |
| Insert          | `features/training/actions.ts:178`        | `mode` inséré ✓                                                       |
| Enum/colonne DB | `db/schema/enums.ts:34`, `training.ts:25` | `pgEnum(... ["tutor","test"])`, stocke `"tutor"` ✓                    |
| DAL             | `features/training/dal.ts:503,580`        | re-projette `mode: s.mode` ✓                                          |
| Client → mode   | `training-session-client.tsx:81,105`      | `isTutor` → `feedback:"immediate"` ✓                                  |
| Action réponse  | `features/training/actions.ts:300-318`    | renvoie `reveal` quand `s.mode==="tutor"` ✓                           |
| onAnswer        | `training-session-client.tsx:123-132`     | propage `reveal` ✓                                                    |
| Hook            | `use-quiz-session.ts:180-191`             | `setRevealed` quand `feedback==="immediate"` ✓                        |
| Runner          | `quiz-runner.tsx:148,219`                 | `isCurrentRevealed=true` → `showCorrectAnswer` ✓                      |
| **Rendu**       | **`question-card/index.tsx:489`**         | **explication gardée `variant="review"` → jamais rendue en `exam` ✗** |

## 3. Correctif minimal

Rendre l'explication en `variant="exam"` quand la révélation est active. La garde
`showCorrectAnswer` (pilotée par le runner, vraie **uniquement** si
`mode.feedback==="immediate"`) garantit qu'aucune fuite n'a lieu en examen ni en
entraînement test. Pas d'images d'explication ici (canal réservé à la correction,
`variant="review"` — invariant anti-triche F3 préservé).

```diff
 <AnimatePresence>
   {isReviewVariant && isExpanded && (
     <div className="mt-4"> … </div>
   )}
+
+  {/* Passation tuteur : correction + explication après chaque réponse. */}
+  {isExamVariant &&
+    showCorrectAnswer &&
+    effectiveExplanation !== undefined && (
+      <div className="mt-4">
+        <QuestionExplanation
+          explanation={effectiveExplanation}
+          references={effectiveReferences}
+        />
+      </div>
+    )}
 </AnimatePresence>
```

Pourquoi c'est la **cause** et pas le symptôme : le surlignage de la bonne réponse
(`getAnswerState:59`) marche déjà en `exam` ; il ne manquait que le rendu de
l'explication. On répare au point exact où la donnée de révélation était jetée.

## 4. Trou de test

Pourquoi tout était vert malgré le bug :

- `tests/integration/training-mode.test.ts` — teste **uniquement la couche serveur**
  (`saveTrainingAnswer` renvoie `reveal`, `getTrainingSessionById` expose
  `correctAnswer`/`isCorrect`). Ne monte **jamais** de `QuestionCard` → aveugle à un
  bug de rendu. (Et la donnée serveur étant correcte, ces tests ne pouvaient pas
  échouer.)
- `tests/components/QuestionCard.test.tsx` — le bloc « Variant: exam » couvrait clic,
  état sélectionné, drapeau, anti-triche images — mais **jamais** la combinaison
  `showCorrectAnswer + lazyExplanation`. L'explication n'était testée qu'en
  `variant="review"`. Le chemin « explication en exam » était entièrement non couvert.
- `e2e/tests/entrainement.spec.ts` — **zéro** occurrence de tuteur/explication/reveal :
  le mode tuteur n'était pas exercé en e2e.
- `e2e/tests/resultats-entrainement.spec.ts` — teste la page **résultats**
  (`variant="review"`), pas la révélation par-question en session.

Test de non-régression ajouté (`tests/components/QuestionCard.test.tsx`, bloc
« Variant: exam ») :

- **`mode tuteur : révèle la bonne réponse ET l'explication …`** — rouge avant le
  fix, vert après (assertion `explanation-content` + texte + références).
- **`mode test : ne révèle PAS l'explication … (showCorrectAnswer=false)`** — verrou
  anti-fuite : feedback différé → aucune correction visible en passation.

> Suivi recommandé (hors scope du fix) : un cas e2e tuteur dans
> `entrainement.spec.ts` (répondre Q1 → assert `explanation-content` visible),
> puisque la garde de bout en bout n'est couverte par aucun e2e.

## 5. Résultats du gate

- `bun run test tests/components/QuestionCard.test.tsx` → **12/12** ✓ (rouge→vert)
- `bun run test tests/components/quiz …QuestionCard…` → **186/186** ✓ (aucune régression)
- `bun run type-check` → ✓
- `bun run lint` → ✓ (les warnings SonarLint `typescript:Sxxxx` sont IDE-only, hors gate)
