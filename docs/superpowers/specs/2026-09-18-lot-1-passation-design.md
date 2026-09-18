# Lot 1 — Passation : AttemptClock, ExamPhase, QuizBridge, cycle de vie

Issues : #186 (AttemptClock), #187 (QuizBridge), #188 (cycle de vie, tranche 1),
#189 (ExamPhase(now) et AttemptScore, seuls morceaux repris ici).
Décisions prises en séance de grill le 2026-09-18 ; le glossaire `CONTEXT.md` a
été enrichi au fil de la séance (Tentative, Budget de temps, Crédit de pause,
Grâce, Phase d'examen).

## Livraison

- **PR 1**, branche `refactor/attempt-clock-quiz-bridge` depuis `main` : trois
  commits, un par module (AttemptClock, ExamPhase, QuizBridge). Ils ne
  partagent aucun fichier.
- **PR 2**, branche `refactor/attempt-lifecycle`, ouverte après merge de la
  PR 1 : #188 tranche 1 + AttemptScore + un ADR. La tranche 2 (`Attempt(policy)`
  avec les écritures) est hors lot, à décider dans une issue à part.
- Revue adversariale sur chaque PR ; un scénario e2e après la PR 2 (passation
  d'examen avec pause, reprise, expiration ; session d'entraînement).
- Deux issues à ouvrir, hors lot : `deleteTrainingSession` supprime sur `id`
  seul après une garde de propriété ; `getExamWithQuestions` livre
  `correctAnswer` à un admin par un spread `isAdmin` plutôt que par le verrou.

## AttemptClock — `lib/attempt-clock.ts`

Propriétaire unique de l'arithmétique de temps d'une tentative. `exam-timer.ts`
disparaît (ses formatteurs migrent).

- `now` est **toujours un paramètre**, jamais lu dans le module (règle
  d'hydratation `initialNow`, NOMAQBANQ-13).
- Entrées dans les **unités stockées**, nommées : `startedAt` (ms),
  `budgetSeconds`, `pauseCreditMs`, `pauseStartedAt` (ms ou null),
  `pauseCapMinutes`. Les conversions vivent dans le module ; plus aucun
  `* 60 * 1000` chez les appelants.
- Surface : `remainingMs` (clampé dans `[0, budget]`, crédit de pause inclus,
  pause en cours créditée et plafonnée), `isExpired` (au-delà du budget plus
  la grâce), `pauseCredit` (cumul + pause en cours plafonnée ; `resumeExam`,
  `finalizeExam`), `pauseRemainingMs` (décompte du dialogue), `zone`
  (`normal | warning | critical`, seuils 10 et 5 min), `formatExamTime`,
  `formatPauseTime`.
- **Une seule grâce**, `GRACE_MS = 10_000`. Le `+5000` de la finalisation et
  `SAVE_GRACE_MS` avaient la même cause (latence entre les deux horloges).
  L'auto-soumission reste exemptée du budget.
- Absorbe : `use-exam-timer.ts`, les trois blocs de `features/exams/actions.ts`
  (`saveExamAnswer`, `finalizeExam`, `resumeExam`), `pause-dialog.tsx` (qui
  s'ancre aussi sur `initialNow` : il peut être rendu au premier rendu), les
  seuils recopiés dans `finish-dialog.tsx`, les quatre littéraux `15` client
  (import de `DEFAULT_PAUSE_MINUTES`), le `83` de la route e2e.
- Hors lot : l'arrondi `ceil` (admin) vs `floor` (étudiant) de la durée en
  minutes, bug d'affichage à trancher à part ; le cron de clôture qui ferme sur
  `endDate` seulement (cas de `expireBatch`, tranche 2 de #188).
- Tests : la formule en unitaires (`tests/lib/attempt-clock.test.ts`) ; **un
  seul** test d'intégration antidaté conservé (`exam-runner.test.ts`) comme
  preuve que la garde est câblée à l'écriture ; `use-exam-timer.test.ts` ne
  garde que tick, one-shot d'expiration, gel en pause et hydratation ;
  `PauseDialog.test.tsx` cesse de mocker l'horloge.

## ExamPhase — `lib/exam-phase.ts`

- `phaseOf(exam, now): ExamStatus` pour l'affichage (enum UI inchangé :
  `active | upcoming | completed | inactive`).
- `isOpen(exam, now)` = date de fin non passée : le prédicat du glossaire
  (« Examen ouvert »), utilisé par la visibilité des résultats.
- `partition(exams, now)` (liste étudiante), `visibility(phase, viewer)`
  (« résultats seulement après `endDate` pour un non-admin », trois copies).
- `now` obligatoire, sans défaut. `lib/exam-status.ts` ne garde que la
  config de badges.

## QuizBridge

- **Un seul type** `QuizQuestion`, possédé par `components/quiz/runner/types.ts`
  et importé en `import type` par les DAL (premier import `features → components`
  du dépôt, effacé à la compilation) :

  ```ts
  type QuizQuestion = {
    _id: string; question: string; options: string[]
    domain: string; objectifCMC: string; images: QuizImage[]
  } & Revealed<QuizImage>
  ```

  Champs d'énoncé requis, `_creationTime` supprimé (aucun consommateur), partie
  révélée = type de retour du verrou (`Revealed`). `QuestionDoc`,
  `QuestionCardQuestion`, `SessionQuestion`, `TrainingSessionQuestion`,
  `ExamQuestionView`, `QuizQuestionView`, `QuizRevealPayload` et les quatre
  types image disparaissent.
- Les conventions `_id` restent (le renommage est une issue à part, trivial
  une fois le mappeur unique en place).
- `features/questions/quiz-bridge.ts` (`server-only`) : `toQuizQuestion(row,
  lock, level)`, `toAnswersMap(rows, lock)`, `fetchImages`, `groupImages`
  (dérivation CDN). `features/exams/dal.shared.ts` disparaît ; les deux
  regroupements d'images à la main de `features/questions/dal.ts` passent par
  là. Les DAL renvoient `QuizQuestion[]` ; les six mappings des pages tombent ;
  les cinq `as never` et le `as unknown as` disparaissent.
- La règle `.claude/rules/data-layer.md` qui prescrit `as never` est réécrite.

## Cycle de vie — PR 2, `features/attempts/guard.ts` (nouveau domaine)

- `requireAttempt(exec, { kind, ref, actorId, now, verb, isAutoSubmit? })`
  sous **verrou de ligne** sur la tentative pour toute écriture ; l'exécuteur
  est celui de la transaction (patron `pickRevisionQuestionIds`). La garde de
  statut dans le WHERE des UPDATE disparaît : le verrou est la discipline.
- Table de politique par verbe (la table est la spécification, une ligne = un
  test) :

  | verbe   | fenêtre/TTL | accès | pause    | budget                 |
  | ------- | ----------- | ----- | -------- | ---------------------- |
  | answer  | ✓           | ✓     | interdit | appliqué               |
  | close   | ✓           | ✓     | crédité  | appliqué sauf auto-submit |
  | flag    | –           | –     | permis   | –                      |
  | pause   | –           | –     | (local)  | –                      |
  | resume  | –           | –     | (local)  | –                      |
  | abandon | –           | –     | permis   | –                      |

- Refus par **code** (`NOT_FOUND · NOT_IN_PROGRESS · NOT_STARTED · EXPIRED ·
  OUTSIDE_WINDOW · ACCESS_EXPIRED · PAUSED · TIME_UP`), messages français
  centralisés `refusalMessage(code, kind)`. Propriété dans le WHERE du SELECT
  verrouillé : une tentative d'autrui répond `NOT_FOUND`. Les trois formes de
  retour des actions ne sont pas unifiées (chantier client).
- **Le cron est le seul écrivain de la clôture par expiration** (il score).
  Les flips inline de `saveTrainingAnswer` et `completeTrainingSession`
  disparaissent (refus `EXPIRED`, aucune écriture) ; `createTrainingSession`
  libère la place via le même écrivain scoré que le cron.
- `hasActiveAccess(exec, { userId, type, now })` dans `features/payments`,
  `hasAccess()` devient son enrobage sur `db`. L'asymétrie d'audience reste
  (`restricted` : la participation vaut autorisation).
- `setQuestionBookmark` est hors sujet (signet global, aucune tentative).
- **AttemptScore** : `scoreSql(correct, total)` dans `lib/score.ts` partagé par
  les deux crons ; test de parité exhaustif (`generate_series`, `total ≤ 200`)
  sur branche Neon ; `summarize(questions, answers)` remplace le jumeau client
  `isScoreWithheld`. Compteurs seulement s'il existe deux consommateurs.
- Tests : unitaires du module avec faux exécuteur ; tests features réduits au
  succès et au mapping code → message ; faux Drizzle extrait dans
  `tests/helpers/` ; tests d'intégration conservés comme preuve de câblage.
- **Un ADR** : verrou de ligne sur la tentative et cron seul écrivain de la
  clôture (difficile à défaire, surprenant, arbitré).

## Écarts constatés à l'implémentation de la PR 1 (2026-09-18)

- `QuizRevealPayload` ne disparaît pas : c'est le contrat du retour de
  `onAnswer` (correction complète garantie, ou clé retenue). Il est désormais
  dérivé de `Revealed` (`Required<Pick<…>>`), donc ne peut plus diverger.
- `features/exams/dal.shared.ts` survit, réduit à `countQuestionsByExam`
  (partagé par les DAL admin et étudiant d'exams, sans rapport avec le pont).
- `toAnswersMap` est reporté : les DAL livrent encore leurs réponses sous
  leur forme propre (`selectedAnswer`) et les pages les projettent en
  `AnswersMap` (`selected`). Ce n'est pas une règle du verrou mais un nom de
  clé, et l'unifier traverse les tests d'intégration ; à prendre avec
  AttemptScore en PR 2 si `summarize` en a besoin.
- La seconde issue prévue (spread `isAdmin` de `getExamWithQuestions`) est
  absorbée : la clé n'est jointe que sur `revealKey`, pour un admin, par le
  mappeur. L'issue #191 couvre le DELETE de `deleteTrainingSession`.
- `isOpen(exam, now)` = `now < endDate`, la borne du verrou SQL
  (`end_date > now()`) ; `phaseOf` passe à « terminé » au même instant. La
  frontière historique « encore actif à l'instant exact de fin » est
  abandonnée pour n'avoir qu'une définition d'« ouvert ».
- Les trois fenêtres `now < startDate || now > endDate` écrites à la main
  dans `startExam` / `saveExamAnswer` / `finalizeExam` restent : c'est la
  garde « fenêtre » de `requireAttempt` (PR 2), qui consommera `phaseOf`.
- Périphérie ajoutée : `lib/clock.ts` (`currentTimeMs`, trois copies) et
  `hooks/use-clock.ts` (ancre + tick, quatre surfaces).
