# Mode tuteur : valider sa réponse puis corriger — design

Date : 2026-06-30 · Branche : `feat/refonte-quiz-audience-images` · Statut : approuvé (design)

## Contexte

Le mode **tuteur** de l'entraînement (`/dashboard/entrainement`) révèle la
correction + l'explication après chaque réponse (le mode **test** ne corrige qu'à
la fin). Un bug récent (l'explication n'était jamais rendue en `variant="exam"`)
a été corrigé : l'explication s'affiche désormais. Mais l'UX reste brute :

1. **Révélation trop hâtive** : cliquer une proposition affiche la correction
   immédiatement, sans laisser à l'utilisateur le temps de confirmer son choix.
2. **Pas d'indication juste/faux** : à la correction, l'utilisateur ne sait pas si
   sa proposition était bonne ou mauvaise — aucun code couleur ne marque son choix
   ni ne souligne la bonne réponse.

Ce design ajoute un **flux en deux temps** (choisir → valider → corriger) et un
**code couleur juste/faux**, en mode tuteur uniquement.

> Dépendance : ce travail s'appuie sur le correctif d'affichage de l'explication en
> `variant="exam"` (rendu de `QuestionExplanation` gardé par
> `isExamVariant && showCorrectAnswer && effectiveExplanation !== undefined`), déjà
> présent dans l'arbre de travail.

## Objectifs

- En tuteur : cliquer une option **sélectionne** (surligne) sans corriger ni
  enregistrer ; un bouton **« Valider ma réponse »** déclenche l'enregistrement et
  la correction.
- À la correction : la bonne réponse est en **vert + ✓**, le choix de l'utilisateur
  s'il est faux en **rouge + ✗**, les autres neutres.
- Après validation : la question est **verrouillée** (plus re-répondable) ;
  navigation Précédent/Suivant toujours possible.

## Non-objectifs (hors périmètre)

- Mode **test** : inchangé (clic = sélection libre, corrections à la fin).
- Mode **examen** (`feedback=deferred`) : inchangé (sélection libre jusqu'à
  « Terminer », corrections après `endDate`).
- Schéma DB, DAL serveur : inchangés. `saveTrainingAnswer` renvoie déjà le `reveal`
  en tuteur ; on ne fait que **différer son appel** au clic sur Valider.
- Images d'explication en passation : restent interdites (invariant anti-triche F3,
  canal réservé à `variant="review"`).
- Forcer la validation avant de passer à la question suivante : **non** — le skip
  reste autorisé (cf. États & cas limites).

## Flux d'interaction (tuteur uniquement)

Le tuteur passe d'un temps (clic = corrige) à **deux temps** :

| Phase | Comportement |
| --- | --- |
| **a. Choix** | Clic sur une option → état « choisi » (bleu, `selected`). **Aucun appel serveur, aucune correction.** L'utilisateur peut changer d'option librement. |
| **b. Validation** | Le bouton **« Valider ma réponse »** est rendu sous les options, actif **dès qu'une option est choisie**. Clic → `saveTrainingAnswer` (enregistre + renvoie `reveal`). |
| **c. Correction** | À la réception du `reveal` : options **verrouillées** (non cliquables), code couleur affiché, explication affichée. Le bouton Valider disparaît. |

Le déclencheur du flux deux-temps est `mode.feedback === "immediate"` (identité du
tuteur — aucun nouveau champ de `QuizMode` requis).

## Code couleur à la correction

Reprend la sémantique de la page résultats (`variant="review"`), appliquée en
passation tuteur en s'appuyant sur `selectedAnswer` (= la réponse de l'utilisateur) :

| Option | Condition | Rendu |
| --- | --- | --- |
| Bonne réponse | `option === correctAnswer` | **vert + ✓** (état `user-correct`) |
| Choix de l'utilisateur, faux | `option === selectedAnswer && option !== correctAnswer` | **rouge + ✗** (état `user-incorrect`) |
| Choix de l'utilisateur, juste | confondu avec la bonne réponse | vert + ✓ |
| Autres | — | neutre (`default`) |

## Architecture & flux de données

Composants concernés (tous côté client, runner unifié quiz) :

### `components/quiz/runner/use-quiz-session.ts` (logique deux-temps)
- Nouvel état local `pendingSelection: Record<string, string>` (qid → option
  choisie mais non validée). **Non** ajouté à `answers` (donc `answeredCount` et le
  navigateur ne comptent pas une question non validée).
- `answerSelect(optionIndex)` :
  - si `mode.feedback === "immediate"` (tuteur) **et** question déjà révélée →
    no-op (verrou) ;
  - si tuteur, sinon → écrit `pendingSelection[qid]` localement (pas d'appel
    serveur) ;
  - sinon (test/examen) → comportement actuel inchangé (optimiste + `onAnswer`).
- `confirmAnswer()` (nouveau, tuteur) : lit `pendingSelection[qid]` ; si absent →
  no-op ; sinon appelle `callbacks.onAnswer(qid, pending)`. Sur succès avec
  `reveal` → `setRevealed`, écrit `answers[qid] = { selected, isCorrect }`, purge
  `pendingSelection[qid]`. Sur échec → toast (déjà géré dans `onAnswer`),
  `pendingSelection` conservé pour réessai.
- Expose : `pendingSelection` (ou la valeur pour la question courante),
  `confirmAnswer`, et un dérivé `canConfirm` (tuteur + option choisie + non
  révélée).

### `components/quiz/runner/quiz-runner.tsx` (UI Valider + verrou)
- `selectedAnswer` passé à la `QuestionCard` = la réponse validée si révélée, sinon
  la `pendingSelection` de la question courante.
- Rend le bouton **« Valider ma réponse »** (`data-testid="btn-validate-answer"`)
  quand `mode.feedback === "immediate"` **et** question non révélée **et** une
  option est choisie. Au clic → `session.confirmAnswer()`.
- Passe à la `QuestionCard` : `showCorrectAnswer={isCurrentRevealed}` (déjà le cas)
  et un verrou (`disabled`) quand la question courante est révélée.
- Mode examen : aucun bouton Valider, aucun verrou par-question — inchangé.

### `components/quiz/question-card/index.tsx` (couleur + verrou)
- `getAnswerState` : ajouter une branche « révélé » qui, **quand
  `showCorrectAnswer` est vrai** (et hors review), colore via `selectedAnswer`
  comme la branche review : bonne réponse → `user-correct`, choix faux →
  `user-incorrect`. (Aujourd'hui l'exam révélé ne donne que `correct` sur la bonne
  réponse et `selected` sur le choix faux.)
- Icônes : étendre `showCheckIcon`/`showXIcon` au cas exam révélé (✓ sur la bonne
  réponse, ✗ sur le choix faux) — par symétrie avec review.
- Verrou : quand révélé (ou prop `disabled`), les options ne sont plus
  interactives.

### `components/quiz/question-card/answer-option.tsx`
- Probablement aucun changement : les états `user-correct`/`user-incorrect` et les
  props `showCheckIcon`/`showXIcon` existent déjà.

## États & cas limites

- **Skip sans valider** : autorisé. « Suivant » reste indépendant du bouton Valider
  (choix d'UI retenu) ; une question non validée reste non répondue, on peut y
  revenir. Pas de piège.
- **Rechargement de page** : les questions **déjà validées** se ré-affichent
  verrouillées + corrigées (hydratation via `initialRevealed`, déjà fournie par le
  DAL `getTrainingSessionById`). Une `pendingSelection` non validée est locale →
  perdue au reload (acceptable : rien n'a été envoyé au serveur).
- **Retour sur une question validée** : affichée verrouillée + corrigée (depuis
  `revealed`), non re-répondable.
- **Dernière question** : après validation, le bouton de navigation « Terminer »
  s'affiche comme aujourd'hui.
- **Échec réseau de la validation** : la sélection en attente est conservée, un
  toast invite à réessayer (réutilise le `onAnswer` actuel).

## Stratégie de test

- **Composant** (`tests/components/QuestionCard.test.tsx`) : en `variant="exam"` +
  révélé, la bonne réponse a le rendu vert/✓, le choix faux le rendu rouge/✗ ;
  options non interactives (verrou). Conserver les tests anti-triche images.
- **Hook** (`tests/components/quiz/…` ou nouveau `use-quiz-session.test.tsx`) :
  en tuteur, `answerSelect` ne révèle pas et n'appelle pas `onAnswer` ;
  `confirmAnswer` appelle `onAnswer` une fois et révèle ; après révélation,
  `answerSelect` est un no-op (verrou). En test/examen, `answerSelect` appelle
  `onAnswer` immédiatement (non-régression).
- **E2E** (`e2e/tests/entrainement.spec.ts`) : session tuteur → choisir une option
  (pas de correction visible) → `btn-validate-answer` → `explanation-content`
  visible + couleurs juste/faux. (La suite mute la base Neon de dev → un seul
  fichier ciblé.)

## Fichiers touchés (récap)

- `components/quiz/runner/use-quiz-session.ts` — logique deux-temps (`pendingSelection`, `confirmAnswer`).
- `components/quiz/runner/quiz-runner.tsx` — bouton Valider, câblage sélection/verrou.
- `components/quiz/question-card/index.tsx` — code couleur juste/faux + verrou en exam révélé.
- `components/quiz/question-card/answer-option.tsx` — ajustements mineurs éventuels.
- Tests : composant, hook, e2e (ci-dessus).

## Gate

`bun run type-check` + `bun run lint` (pas `bun run check`/prettier — CRLF =
faux signal). Tests ciblés via `bun run test <fichier>` ; e2e ciblé via
`bun run test:e2e e2e/tests/entrainement.spec.ts` (un seul fichier).
