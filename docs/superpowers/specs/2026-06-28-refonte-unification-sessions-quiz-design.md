# Refonte & unification de l'expérience de passation et de résultats (examen / entraînement)

**Date** : 2026-06-28
**Statut** : design validé, prêt pour le plan d'implémentation
**Auteur** : brainstorming Samuel + Claude

## Contexte

Le système de passation comporte aujourd'hui **deux contrôleurs clients
quasi parallèles** qui réimplémentent les mêmes concerns sans rien partager :

- [`evaluation-client.tsx`](../../../app/(dashboard)/dashboard/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx) (~945 lignes) : chrono serveur,
  pause à 3 phases avec verrouillage par moitié, persistance localStorage,
  auto-submit.
- [`training-session-client.tsx`](../../../app/(dashboard)/dashboard/entrainement/_components/training-session-client.tsx) (~322 lignes) : feedback immédiat
  (mais non affiché), persistance DB par réponse, pas de chrono.

Les composants de présentation (`QuestionCard`, `QuestionNavigator`,
`SessionToolbar`, `Calculator`, `LabValues`, `FinishDialog`, `SessionHeader`)
sont **déjà** mutualisés via des props `mode`/`accentColor`. Ce qui diverge :
la **logique d'orchestration**, la **forme des réponses**, les **vues de
résultats** (deux composants ~identiques) et plusieurs **décisions produit**
discutables relevées à l'audit.

### Audit — constats clés

**Solide (conservé)** : score recalculé serveur, budget-temps serveur, verrous
de ligne `.for("update")`, re-check d'accès à la soumission, forme-pont
anti-triche (`correctAnswer`/`explanation` omis pendant la passation).

**Problèmes corrigés par cette refonte** :

1. Aucun hook partagé entre les deux flux.
2. Forme des réponses divergente (`Record<string,string>` vs
   `Record<string,{selectedAnswer,isCorrect}>`).
3. Type question dupliqué 3× (`QuestionDoc`, `ExamQuestionView`,
   `TrainingSessionQuestion`).
4. **Code mort** dans [`lib/exam-timer.ts`](../../../lib/exam-timer.ts) :
   `isWithinGracePeriod`, `shouldAutoSubmit`, `calculateScorePercentage`,
   `calculateProgress`, `getAccessibleQuestionRange` ne sont appelés que par
   leurs tests.
5. Point médian incohérent : verrouillage `Math.floor(total/2)` vs `PauseDialog`
   `Math.ceil(total/2)` → off-by-one sur nombre impair.
6. Règle de grâce dupliquée/divergente (lib 30 s/5 s vs serveur `maxMs+5000`
   manuel, aucune borne en auto-submit).
7. « Pas de sauvegarde auto » **contredit** par le localStorage qui restaure —
   anxiogène et fragile (cache vidé / autre appareil = perte).
8. Pause : déclenchée à 50 % du **temps** mais verrouillage par 50 % du
   **nombre** → désynchronisation ; mécanique lourde (3 phases, alerte, fraude).
9. Entraînement : `isCorrect` renvoyé par réponse mais jamais affiché
   (`showCorrectAnswer={false}`) → coût du feedback sans le bénéfice.
10. Soumission d'examen → éjection vers la liste, sans écran de confirmation.
11. Anti-fraude « théâtral » (toast changement d'onglet, `beforeunload`) sans
    aucun enregistrement serveur → faux sentiment de surveillance. *(Hors
    périmètre de décision pour l'instant ; documenté.)*

## Objectif

Une **seule expérience de passation et de résultats**, réutilisée pour examen et
entraînement, où les différences ne sont plus que des **données de
configuration** — tout en simplifiant le flux (décisions produit ci-dessous) et
en gardant intactes les garanties serveur.

## Décisions de conception (validées)

| #  | Sujet                          | Choix retenu                                                                                                  |
| -- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| D1 | Persistance examen             | **Sauvegarde serveur par réponse** (comme l'entraînement). Suppression localStorage + avertissement.         |
| D2 | Pause examen                   | **Pause de repos unique, plafonnée** à `pauseDurationMinutes` : le chrono gèle, **aucun verrouillage**.       |
| D3 | Lecture pendant la pause       | **Overlay bloquant plein écran** masque énoncé + navigateur ; serveur refuse les réponses tant que `pauseStartedAt` non-null. |
| D4 | Feedback entraînement          | **Choix tuteur / test à la création.** Tuteur = révélation après chaque réponse ; test = correction à la fin. |
| D5 | Fin d'examen                   | **Écran de confirmation** « Soumis ✓ — résultats le {endDate} ». Masquage jusqu'à clôture conservé.           |
| D6 | Architecture                   | **A — Hook headless + coquille présentationnelle + descripteur de mode.**                                     |
| D7 | Ambition visuelle              | **Coquille unifiée + refonte visuelle cohérente** avec le design system existant (tokens, shadcn, accents).   |
| D8 | Périmètre écrans               | **4 écrans cœur + entrées de flux** (démarrage examen, config entraînement) + écran de confirmation.          |

Une fois D1–D3 appliquées, les divergences s'effondrent :

| Capacité     | Examen                       | Entraînement                 | Unification |
| ------------ | ---------------------------- | ---------------------------- | ----------- |
| Persistance  | par réponse (serveur)        | par réponse (serveur)        | identique   |
| Navigation   | libre                        | libre                        | identique   |
| Chrono       | compte à rebours + auto-submit | aucun                      | drapeau     |
| Pause        | repos optionnel              | aucune                       | drapeau     |
| Feedback     | différé                      | tuteur (immédiat) / test     | drapeau     |
| Accent       | bleu                         | émeraude                     | drapeau     |

## Architecture front (Approche A)

### Structure des modules

```
components/quiz/
  runner/
    quiz-runner.tsx       # coquille présentationnelle réutilisée partout
    use-quiz-session.ts   # hook headless : toute la logique, zéro UI
    use-exam-timer.ts     # sous-hook chrono (compte à rebours + auto-submit + pause)
    types.ts              # QuizMode, QuizQuestion, AnswerState (types canoniques)
  question-card/          # existant — étendu pour la révélation inline (tuteur)
  session/                # existant — header / navigator / toolbar / finish-dialog réutilisés
  results/
    session-results.tsx   # résultats UNIFIÉS (examen étudiant + admin + entraînement)
```

Les pages produit deviennent de **fins wrappers** qui montent
`<QuizRunner config={…} onAnswer={…} onFlag={…} onFinish={…} />`.

### Types canoniques

```ts
type QuizQuestion = {
  _id: string; question: string; options: string[]
  images?: { url: string; storagePath: string; order: number }[]
  domain?: string; objectifCMC?: string
  // révélés UNIQUEMENT quand autorisé (tuteur en direct, ou correction)
  correctAnswer?: string; explanation?: string; references?: string[]
  // images d'explication (cf. Feature 3) — révélées avec l'explication, jamais pendant la passation
  explanationImages?: { url: string; storagePath: string; order: number }[]
}
type AnswerState = { selected: string; isCorrect?: boolean }
type AnswersMap  = Record<string /*questionId*/, AnswerState>
```

`isCorrect` n'est présent côté client que lorsqu'il est **autorisé** : mode
tuteur en direct, ou écrans de résultats. Jamais pendant un examen ni un
entraînement en mode test.

### Descripteur de mode

```ts
type QuizMode = {
  kind: "exam" | "training"
  accent: "blue" | "emerald"
  timer: { serverStartTime: number; totalSeconds: number } | null  // examen seul
  pause: "rest" | null                                             // repos, sans verrou
  feedback: "deferred" | "immediate"                              // tuteur = immediate
  showMeta: boolean                                               // badges domaine/objectif (off en examen)
  labels: { title: string; finishCta: string }
  backUrl: string
}
```

- **Examen** : `timer` actif, `pause: "rest"` si `exam.enablePause`,
  `feedback: "deferred"`, `showMeta: false`, accent bleu.
- **Entraînement** : `timer: null`, `pause: null`,
  `feedback = session.mode === "tutor" ? "immediate" : "deferred"`, accent
  émeraude.

### `useQuizSession(config)` — logique headless, testable

Possède : index courant, `AnswersMap`, set de flags, navigation
(préc/suiv/aller-à), bascule flag, **sélection de réponse** (appelle `onAnswer`
injecté → save serveur ; intègre la révélation renvoyée seulement en mode
immédiat), état du dialogue de fin, **raccourcis clavier** (← → F) et visibilité
du FAB.

Le chrono est délégué à `useExamTimer`, **branché uniquement si `config.timer`** :
un **seul `setInterval`** (vs deux aujourd'hui), gère pause/reprise (cumul) et
déclenche l'auto-submit à 0.

Interface d'injection :

```ts
onAnswer(questionId, selected): Promise<
  | { ok: true; reveal?: { correctAnswer; explanation; references } }
  | { ok: false; error: string }
>
onFlag(questionId, isFlagged): Promise<void>
onFinish(opts: { isAutoSubmit: boolean }): Promise<{ ok: boolean; redirectTo?: string }>
```

`reveal` n'est renvoyé qu'en `feedback: "immediate"`.

### `<QuizRunner>` — coquille présentationnelle

Assemble les composants partagés existants. Layout desktop :

```
┌─────────────────────────────────────────────────────────────┐
│ ← Retour | Titre | progression ●●●○○ |  [⏱ 58:12]            │  ⏱/pause si mode l'exige
│                          calc · lab · [pause] ·  Terminer     │
├──────────────────────────────────────────┬──────────────────┤
│  QuestionCard                             │ QuestionNavigator │
│   énoncé · image · options                │  grille répondu/  │
│   ▸ révélation inline si feedback immédiat│  marqué/courant   │
│  ← Précédent  ·  ⚐ Marquer  ·  Suivant →  │                   │
└──────────────────────────────────────────┴──────────────────┘
   FAB mobile : calc · valeurs labo · ↑ haut · navigateur
```

- **Révélation inline** (mode tuteur) : après réponse, l'option correcte est
  surlignée, la réponse choisie marquée juste/fausse, et un panneau explication
  s'ouvre. Réutilise le rendu de la variante `review` de `QuestionCard`, en
  direct.
- **Overlay de pause (D3)** : quand `pauseStartedAt` est actif, un overlay
  bloquant plein écran recouvre **toute** la zone (énoncé + navigateur), affiche
  le compte à rebours de pause (plafonné à `pauseDurationMinutes`) + bouton
  « Reprendre ». Le chrono principal est gelé. Aucun contenu de question lisible.

### `<SessionResults>` — résultats unifiés

Un seul composant pour **examen-étudiant, examen-admin, entraînement**. Props :

- récap : score %, justes / faux / non-répondues, `accent`, (temps passé si dispo)
- liste de révision : réutilise `QuestionCard variant="review"`
- `loadExplanations` injecté (lazy) — `loadExamQuestionExplanations` pour
  l'examen, équivalent training pour l'entraînement
- `participant?` : carte identité (vue admin)
- filtre « erreurs seulement » + `ResultsQuestionNavigator`
- **images d'explication** (Feature 3) : si `question.explanationImages` présent, les
  afficher dans la révision (jamais pendant la passation). Concerne aussi le rendu
  `review` de `QuestionCard`.

Remplace et supprime `ParticipantExamResultsView` et `TrainingResultsClient`.

> **Dépendance** : la spec
> [`2026-06-28-images-explication-questions-design.md`](2026-06-28-images-explication-questions-design.md)
> (Feature 3) ajoute `explanationImages` à la forme-pont des questions. Les deux
> features sont découplées : si Feature 3 n'est pas encore livrée, le champ est
> simplement absent (optionnel).

### Écrans d'entrée & confirmation (périmètre D8)

- **Démarrage examen** : carte de règles redessinée et **simplifiée** —
  l'avertissement « pas de sauvegarde / rafraîchir = perte » disparaît (D1).
  Règles : « session unique · chrono serveur (continue au rechargement) ·
  auto-soumission à 0 · pause repos disponible » (si activée).
- **Config entraînement** : champs existants rafraîchis + **bascule mode
  tuteur / test** (D4).
- **Confirmation post-examen (D5)** : route
  `app/(dashboard)/dashboard/examen-blanc/[examId]/soumis/` — Server Component +
  petit DAL (répondues, marquées, `exam.endDate`) → « Soumis ✓ — résultats
  disponibles le {endDate} ».

## Backend / données

### A. Examen — persistance par réponse + finalisation

Alignement sur le modèle `trainingSessionItems` (une ligne par question,
pré-créée, `selectedAnswer` nullable).

- **`startExam`** : crée la participation **et pré-crée une ligne `examAnswers`
  par question** (`selectedAnswer` null, `isCorrect` false). Permet de persister
  flag *et* réponse même sur une question non répondue.
- **`saveExamAnswer({ examId, questionId, selectedAnswer })`** *(nouveau)* :
  garde + accès, participation `in_progress`, **refus si `pauseStartedAt`
  non-null** (D3), calcule `isCorrect` serveur, met à jour la ligne — **ne
  renvoie jamais `isCorrect`** (anti-triche).
- **`saveExamFlag({ examId, questionId, isFlagged })`** *(nouveau)* : met à jour
  `isFlagged`. Les flags survivent au rafraîchissement.
- **`finalizeExam({ examId, isAutoSubmit })`** *(remplace
  `submitExamAnswers`)* : verrou de ligne participation, `in_progress` →
  `completed`/`auto_submitted`, **score depuis les lignes en base**
  (`count(*) filter (where is_correct)` / total), validation budget-temps
  (grâce manuelle ; auto-submit non borné). Plus de payload de réponses, plus de
  dédup, plus de check anti-fraude pause.

➡️ `submitExamAnswers` et sa machinerie disparaissent.

### B. Pause — repos qui gèle le chrono (D2/D3)

- **Schéma `examParticipations`** : **retirer** `pausePhase`, `isPauseCutShort`,
  `pauseEndedAt`. **Garder** `pauseStartedAt` (non-null = en pause) et
  `totalPauseDurationMs` (cumul soustrait du budget). Garder `exams.enablePause`
  + `exams.pauseDurationMinutes`.
- **`pauseExam`** : si `in_progress`, pas en pause, et pause non encore utilisée
  (`totalPauseDurationMs = 0`) → `pauseStartedAt = now`. **Une seule pause.**
- **`resumeExam`** :
  `totalPauseDurationMs += min(now − pauseStartedAt, pauseDurationMinutes×60_000)`
  puis `pauseStartedAt = null`. La pause peut être écourtée, ou s'auto-termine à
  `pauseDurationMinutes`.
- Supprimer : déclenchement auto 50 %, verrouillage par moitié,
  `startPause`/`resumeFromPause` (phases), `PauseApproachingAlert`, helpers de
  verrouillage de `lib/exam-timer.ts`.

### C. Entraînement — mode tuteur / test (D4)

- **Schéma `trainingSessions`** : ajout colonne `mode` (`'tutor' | 'test'`).
- **`createTrainingSession`** : `mode` dans le schéma zod + bascule formulaire.
- **`saveTrainingAnswer`** : en **tuteur**, renvoie aussi la révélation
  (`correctAnswer`, `explanation`, `references`) ; en **test**, renvoie seulement
  `success` (pas même `isCorrect` → le navigateur ne colore pas pendant la
  session).
- **DAL `getTrainingSessionById`** : à la reprise d'une session **tuteur**,
  renvoie la révélation pour les items déjà répondus (déjà vus par l'étudiant) ;
  en **test**, aucune révélation avant complétion. Nouvelle frontière
  anti-triche, intentionnelle.

### D. Écran de confirmation (D5)

Nouvelle route `examen-blanc/[examId]/soumis/`. `finalizeExam` y redirige au lieu
de la liste. Résultats toujours masqués jusqu'à `endDate` (logique existante de
la page `resultats`).

### E. Migration Drizzle (`bun run db:generate` → `db:migrate`)

1. `trainingSessions.mode` enum, **défaut `'test'`** (rétro-compat).
2. `examAnswers.selectedAnswer` → **nullable** ; `isCorrect` → défaut `false`
   (lignes pré-créées non répondues).
3. **Drop** `examParticipations.pausePhase`, `isPauseCutShort`, `pauseEndedAt`.

Participations/examens *en cours* pendant le déploiement = cas-bord rare ; les
colonnes droppées ne concernent que la mécanique de pause abandonnée.

### F. Nettoyage / suppressions

- [`lib/exam-storage.ts`](../../../lib/exam-storage.ts) (localStorage).
- Helpers morts + helpers de verrouillage de `lib/exam-timer.ts` (ne garder que
  ce qui sert : `calculateTimeRemaining`, `formatExamTime`, `isTimeRunningOut`,
  `isTimeCritical`).
- `components/quiz/pause-approaching-alert.tsx` ; simplification de
  `pause-dialog.tsx` (overlay de repos, sans phases).
- `ParticipantExamResultsView` + `TrainingResultsClient` (fusionnés dans
  `<SessionResults>`).
- Composants quiz « anciens/inutilisés » repérés à l'audit
  (`question-navigation.tsx`, `quiz-results.tsx`) — à confirmer non-référencés
  avant suppression.

## Gestion des erreurs / cas limites

- **Reprise d'examen en cours** : le serveur fait foi (chrono recalculé depuis
  `startedAt − totalPauseDurationMs`). Si expiré à la reprise → `finalizeExam`
  auto. Les réponses sont déjà en base (D1) — plus de relecture localStorage.
- **Sauvegarde concurrente** : `saveExamAnswer`/`saveExamFlag` ciblent une ligne
  unique `(participationId, questionId)` ; `finalizeExam` prend le verrou de
  ligne participation et vérifie le statut → soumission unique préservée.
- **Réponse pendant la pause** : refus serveur + overlay client (D3).
- **Off-by-one point médian** : disparaît avec la suppression du verrouillage.
- **Accès payant expiré en cours** : re-vérifié à `finalizeExam` (comportement
  conservé).

## Tests

- **Unitaires** (`tests/`) : `useExamTimer` (pause/reprise/cumul/auto-submit),
  `useQuizSession` (navigation, flags, intégration `onAnswer`/révélation), purs
  helpers restants de `lib/exam-timer.ts`.
- **Intégration** (`tests/integration/`, branche Neon éphémère) :
  `saveExamAnswer` (anti-révélation + refus en pause), `finalizeExam` (score
  serveur, budget-temps), `pauseExam`/`resumeExam` (plafond), `createTraining`
  + `saveTrainingAnswer` (révélation tuteur vs test). Respecter l'ordre FK au
  cleanup (`examAnswers`/`trainingSessionItems` avant `questions`).
- **E2E** (`e2e/`) : conserver les `data-testid` (`answer-option-{index}`,
  `btn-next`, `btn-previous`, `btn-flag`, `btn-finish`) sur la nouvelle coquille ;
  scénarios examen (chrono via `page.clock`, pause, auto-submit, confirmation) et
  entraînement (tuteur révèle, test ne révèle pas).

## Hors périmètre (YAGNI)

- Mode chronométré pour l'entraînement.
- Anti-fraude réel (enregistrement serveur des changements d'onglet) — documenté
  comme dette, pas décidé.
- Pauses multiples / configurables au-delà d'une seule pause plafonnée.
- Refonte des listes, pages détail et leaderboard (périmètre D8).

## Risques

- **Migration de `examAnswers`** : passer `selectedAnswer` en nullable touche une
  table avec données. Migration additive (nullable + défaut) → sûre. Le code de
  scoring doit traiter `selectedAnswer null` = non répondu.
- **Volume de pré-création** : jusqu'à ~230 lignes `examAnswers` à `startExam` —
  un seul INSERT groupé, négligeable (l'entraînement fait déjà ce pattern).
- **Frontière anti-triche tuteur** : bien cantonner la révélation au mode tuteur
  dans la DAL (revue ciblée recommandée).
