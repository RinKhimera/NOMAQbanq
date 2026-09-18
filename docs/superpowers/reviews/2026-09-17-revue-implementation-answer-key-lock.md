# Revue adversariale — implémentation `AnswerKeyLock`

## 1. En-tête

- **Date** : 2026-09-17
- **Périmètre** : `git diff main...HEAD` sur la branche `refactor/answer-key-lock`
  (4 commits `b60c641` → `dcedb38`, 38 fichiers, +1275/−482). Source de vérité
  comportementale : `main` (`git show main:<fichier>`).
- **Méthode** : lecture seule, hostile ; chaque constat est prouvé par une
  référence `fichier:ligne` et une commande rejouable ; chaque soupçon a d'abord
  subi une tentative de réfutation (section 4). Règles relues : `AGENTS.md`,
  `.claude/rules/data-layer.md` (modifié dans le diff), `e2e-testing.md`,
  `loading-ui.md`, `CONTEXT.md`.
- **Gate** :
  - `bun run check` (prettier + tsc + eslint `--max-warnings 0`) → **exit 0**
  - `bun run test` (vitest) → **exit 0** — 140 fichiers, 1540 tests, 32,8 s
  - `bun run test:integration` **NON lancé** (contrainte : branche Neon). Les
    tests d'intégration modifiés (`exam-lock-source`, `revision-corpus`,
    `questions-quiz-dal`, `training`, `training-mode`) sont donc relus, pas
    exécutés ici ; la mémoire de session de l'auteur les annonce verts (397).

## 2. Tableau des constats

| #   | Sév | fichier:ligne                                                                                   | problème                                                                                                                                                                                            | régression ? |
| --- | --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | 🟠  | `components/quiz/results/session-results.tsx:337-341` · `features/training/actions.ts:499-520`  | Le **score** (et `correctCount`) est un agrégat calculé sur `isCorrect` **y compris les questions à clé retenue** ; combiné aux compteurs qui les excluent, il rend le bit `isCorrect` retenu : `score × N / 100 − justes visibles = nombre de « différées » justes`. Et le texte « X sur N questions réussies » devient faux dès qu'une différée est juste. | NON          |
| 2   | 🟡  | `app/(marketing)/evaluation/quiz/page.tsx:126` · `components/quiz/question-navigation.tsx:65`   | Le canal **quiz public** ne porte pas `keyWithheld` : une question retenue arrive avec `correctAnswer: ""` et est rendue **« Incorrect »** (✗ rouge, explication vide) par `QuestionCard`/`QuestionNavigation`, et comptée fausse dans `score/questions.length`. Contredit la règle ajoutée dans `data-layer.md` (« un lecteur qui dérive un compteur de `isCorrect` doit d'abord lire `keyWithheld` »). | NON          |
| 3   | 🟡  | `tests/features/training-dal.test.ts:92` · `tests/features/exams-dal-student.test.ts:99`        | Les doubles de `lockFor` dans les tests DAL ignorent leurs arguments et aucun `toHaveBeenCalledWith` ne vérifie que le **lecteur transmis est `viewerOf(session.user)`** (et pas, p. ex., l'utilisateur cible d'un admin). Une inversion de lecteur dans `getParticipantExamResults`/`getTrainingSessionById`/`getTrainingSessionResults`/`getExamQuestionExplanations` passerait la suite frontend. | —            |
| 4   | ℹ️  | `.claude/rules/data-layer.md:64-69` · `features/exams/dal.student.ts:618` · `features/training/dal.ts:622,728` | La règle affirme que `Lock.reveal` « décide quels champs blanchir ». En réalité le blanchiment d'`isCorrect` reste chez **trois appelants** via `lock.has(...)`, et `getExamQuestionExplanations`/`scoreQuizAnswers`/`saveTrainingAnswer` filtrent aussi par `has`. Signature documentée `reveal(row, niveau)` ≠ réelle `reveal(questionId, row, level)`. | —            |
| 5   | ℹ️  | `components/quiz/results/session-results.tsx:150-156`                                           | `SessionResults` demande encore les explications (`loadExplanations`) d'une question `keyWithheld` au dépliage : aller-retour inutile, le serveur la filtre et la carte affiche la notice de toute façon.                                           | NON          |

Aucun constat 🔴 : aucune fuite de clé nouvelle, aucun canal déverrouillé,
aucune frontière d'auth modifiée. Le portage `main → module` est fidèle canal par
canal (preuves en section 4).

## 3. Détail par constat

### #1 🟠 — Le score est un canal d'agrégat hors verrou ; « X sur N réussies » ment

**Code**

- `components/quiz/results/session-results.tsx:337` affiche `{summary.score}%`
  (score DB) et `:341` affiche `{summary.correct} sur {questions.length} questions réussies`
  où `summary.correct` **exclut** les différées (`:212-221`).
- `features/training/actions.ts:499-501` : `correctCount = count(*) filter (where isCorrect)`
  sur **tous** les items, `score = computeScorePercent(correctCount, total)` ;
  `:520` renvoie `{ score, correctCount, totalQuestions }` au client.
- `features/exams/actions.ts:869-891` : même agrégat pour `finalizeExam`.
- `features/training/actions.ts:492` (historique) et `features/training/dal.ts:237,378,535,662`
  exposent `score` par session.
- `lib/score.ts:5` : arrondi half-up entier — pour `N ≤ 100`, `correct` est
  récupérable exactement depuis `score`.

**Pourquoi c'est un vrai bug**
Déclencheur concret : étudiant participant à E1 (ouvert) ; session d'entraînement
de 5 questions dont Q ∈ E1 ; il répond juste à Q et à une autre, faux aux 3 autres.
Page de résultats : `40 %`, « **1 sur 5** questions réussies », 1 juste, 3 fausses,
1 différée. (a) Le texte est faux (2 réussies). (b) `40 × 5 / 100 = 2 ≠ 1` ⇒ la
différée est juste ⇒ `selectedAnswer` + « juste » = **la clé de Q**, exactement ce
que `isCorrect: null` (`dal.student.ts:617-618`) et `{ selectedAnswer }` seul
(`training/dal.ts:622`) visent à cacher. Avec `k` différées on obtient leur nombre
de justes ; plusieurs sessions (min. 5 questions, `features/training/schemas.ts:19-23`)
suffisent à isoler chaque bit. La règle projet (mémoire P1-A, `data-layer.md`)
dit explicitement « un agrégat est un canal de lecture » ; le score en est un.

**Régression ?** NON. Sur `main` le score était identique, la différée était
comptée « fausse » mais **identifiable** (✗ sans option verte, explication jamais
chargée) : la soustraction fonctionnait déjà. Le diff la rend seulement plus lisible.

**Comment je l'ai prouvé**
`sed -n 330,345p components/quiz/results/session-results.tsx` ;
`sed -n 495,521p features/training/actions.ts` ; `cat lib/score.ts` ;
`git show main:components/quiz/results/session-results.tsx | grep -n "sur {"`.

**Correctif suggéré** (hors PR, issue à ouvrir — ce n'est pas le sujet du refactor) :
tant que `summary.withheld > 0`, (i) libeller « X sur N − withheld corrigées » ou
masquer la ligne, (ii) afficher le score comme **provisoire** (« recalculé à la
clôture ») — ou, plus radical, calculer le score stocké **hors questions retenues
à la complétion** et le recalculer par cron à la clôture de l'examen. Décision
produit ; la première option suffit à retirer l'oracle si l'on masque aussi le
pourcentage (sinon il reste dérivable).

### #2 🟡 — Quiz public : `keyWithheld` ne va pas jusqu'à l'UI, la retenue est rendue « Incorrect »

**Code**

- `features/questions/actions.ts:166-170` : `lockFor("anonymous", answeredIds)` puis
  `getQuizAnswerKey(answeredIds.filter(!lock.has))` → une question retenue
  **n'a pas d'entrée** dans `questionResults` (conservé de `main`).
- `app/(marketing)/evaluation/quiz/page.tsx:122-131` : `correctAnswer: scored?.correctAnswer ?? ""`,
  aucun `keyWithheld` posé (fichier **hors diff**).
- `components/quiz/question-card/index.tsx:52-58` (review, `userAnswer` défini) :
  `isCorrectAnswer = option === ""` est faux pour toute option (`schemas.ts:7-8`
  impose `min(1)`), donc `isUserAnswer && !isCorrectAnswer` → `"user-incorrect"` ;
  `:236-252` statut « Incorrect ».
- `components/quiz/question-navigation.tsx:65` : `userAnswer === question.correctAnswer`
  → « Incorrect » ; `components/quiz/quiz-results.tsx` : `score/questions.length`
  sur les questions **servies**, pas corrigées.

**Pourquoi c'est un vrai bug** L'objectif déclaré du commit `2b4aa44` est
qu'une réponse retenue soit « ni juste ni fausse » ; la règle ajoutée dans
`data-layer.md:74-76` généralise à « tout lecteur qui dérive un compteur de
`isCorrect` ». Le quiz public, seul canal anonyme, viole les deux. Cas rare
(examen ouvert pendant l'heure de vie du jeton, `features/questions/quiz-token.ts:13`)
mais reproductible.

**Régression ?** NON — comportement identique sur `main`, et la mémoire de
session note « quiz public inchangé » comme décision. Je conteste la décision :
le coût est ~5 lignes (`keyWithheld: !scored` dans le `merged`, puis lecture dans
`QuestionNavigation`).

**Comment je l'ai prouvé** `git diff main...HEAD --stat -- "app/(marketing)"`
(vide) ; lecture des lignes citées.

**Correctif suggéré** Dans `page.tsx:122-131`, poser `keyWithheld: scored ? undefined : true`
(le type `QuestionDoc` l'accepte déjà) ; dans `question-navigation.tsx:55-75`
ajouter la branche `question.keyWithheld` avant le test `===` ; dans
`quiz-results.tsx` prendre `totalQuestions = result.totalQuestions` (déjà renvoyé).

### #3 🟡 — Tests DAL : le lecteur transmis à `lockFor` n'est jamais asserté

**Code** `tests/features/training-dal.test.ts:90-96` et
`tests/features/exams-dal-student.test.ts:97-103` : `lockFor: vi.fn(async () => AnswerKeyLock.fromIds(mocks.lockedIds.current))`
— la fonction ignore `viewer` et `candidates`, et `grep -n "toHaveBeenCalledWith" …| grep -i lock`
ne renvoie rien dans ces deux fichiers. À l'inverse, `tests/features/training-actions.test.ts`
et `questions-actions.test.ts` **le font** (`expect(mocks.lockFor).toHaveBeenCalledWith({ id: "u1", role: "admin" }, ["q1"])`).

**Pourquoi c'est un vrai trou** `getParticipantExamResults(examId, userId)` a deux
utilisateurs en jeu (session et cible) ; `getTrainingSessionById` a `s.userId` et
`session.user.id`. Passer le mauvais (`lockFor({ id: userId, role: "user" }, …)`)
verrouillerait un admin sur les examens de l'étudiant inspecté, ou pire,
déverrouillerait un étudiant si l'on passait le rôle de la cible. Aucun test
frontend ne le verrait ; seule l'intégration `training.test.ts` (non lancée ici)
couvre `getTrainingSessionById` avec le vrai `lockFor`.

**Régression ?** — (couverture). Sur `main`, `getOpenExamLockedQuestionIds` était
mocké de la même façon, sans assertion d'arguments non plus.

**Correctif suggéré** Un `expect(lockFor).toHaveBeenCalledWith({ id: "u1", role: "user" }, ["q1","q2"])`
dans chacun des quatre tests DAL, plus un cas « admin inspecte u2 » asserté
`{ id: "adm", role: "admin" }` dans `exams-dal-student` — vérifier aussi que
`candidates` est la liste des questions de la session et non `[]`.

### #4 ℹ️ — `data-layer.md` sur-promet ce que `reveal` blanchit

**Code** `.claude/rules/data-layer.md:64-69` : « `Lock.reveal(row, niveau)` … c'est
lui qui décide quels champs blanchir et pose `keyWithheld` ». Réel :
`reveal(questionId, row, level)` (`answer-key-lock.ts:76-80`) ne couvre que
`correctAnswer/explanation/references/explanationImages`. `isCorrect` est blanchi
par les appelants : `dal.student.ts:618`, `training/dal.ts:622`, `training/dal.ts:728`
(`lock.has(...) ? … : …`) ; `dal.student.ts:706`, `questions/actions.ts:169`,
`training/actions.ts:355-357` filtrent par `has`. Le module est donc « seule
définition de qui est verrouillé », pas encore « de ce qui est blanchi ».

**Correctif suggéré** Reformuler la règle (« `has` pour `isCorrect`, `reveal` pour
la correction ») ou étendre l'objet (`lock.answer(questionId, { selectedAnswer, isCorrect })`)
— finition, pas bloquant.

### #5 ℹ️ — Requête d'explications inutile pour une question retenue

`session-results.tsx:150-156` envoie `loadExplanations(toLoad)` pour tout id
déplié ; pour une question `keyWithheld`, `getExamQuestionExplanations` la retire
(`dal.student.ts:706`) et la carte rend `KeyWithheldNotice` sans lire
`explanationsMap`. Filtrer `!q.keyWithheld` dans `expandedQuestionIds` épargne
une Server Action (facturée, cf. règle Usage Vercel).

## 4. Faux positifs écartés

| Suspecté                                                                                                                   | Écarté par                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Injection SQL via `viewer.id` dans `excludeLocked`                                                                          | `answer-key-lock.ts:143` interpole `${viewer.id}` dans un `sql\`\`` Drizzle → placeholder. Prouvé par `tests/questions/answer-key-lock.test.ts:179-187` (`user_id = $1`, `params: ["u1"]`). `viewer.id` vient de la session, jamais du client.                                                                                                                                                  |
| Collision d'alias `akl_*` avec les requêtes appelantes                                                                      | `revision.ts:36-70` n'utilise que `i`, `s`, `a`, `p`, `a2`, `q` et les CTE `attempts`/`last_attempt`/`marked` — aucune ne s'appelle `exams`, `exam_questions` ni `exam_participations`, donc pas de shadowing des tables nommées en dur dans `answer-key-lock.ts:146-148`. `getRandomQuizQuestions` (`questions/dal.ts:433-443`) n'aliase pas `questions` ; `sql\`${questions.id}\`` rend `"questions"."id"`. |
| `lockFor` : le builder `openExamQuestions` est partagé entre les deux branches (mutation Drizzle)                          | `answer-key-lock.ts:115-125` : une seule branche du ternaire s'exécute par appel ; le builder n'est jamais réutilisé après `await`.                                                                                                                                                                                                                                                             |
| `lockFor` non borné (Q2)                                                                                                    | Toutes les listes de candidats sont bornées en amont : `loadExamQuestionExplanationsSchema` `.max(MAX_EXAM_QUESTIONS=500)` (`exams/schemas.ts:95-98`), `scoreQuizAnswersSchema` `.max(10)` (`questions/schemas.ts:69-76`), items de session ≤ `MAX_QUESTIONS` (`training/schemas.ts:19-23`), questions d'examen ≤ 500. `requested` est dédupliqué (`dal.student.ts:659`).                        |
| Régression admin sur un canal de révélation                                                                                 | `git show main:features/training/dal.ts` : `role === "admin" ? new Set() : getOpenExamLockedQuestionIds(...)` ×2, `dal.student.ts` : `isAdmin ? new Set() : …`, `training/actions.ts` : `if (role !== "admin") { … }`. `lockFor` (`answer-key-lock.ts:104-106`) court-circuite l'admin de la même façon. Parité exacte.                                                                        |
| `getRandomQuizQuestions` déverrouillé                                                                                       | `main` : `notExists(select 1 from exam_questions join exams where question_id = questions.id and end_date > now())` ; HEAD : `excludeLocked("anonymous", …)` = même prédicat (`answer-key-lock.ts:144-151`, branche anonyme sans jointure participation).                                                                                                                                       |
| Le corpus de révision perd une exclusion                                                                                    | `main` : `q.id not in (<ids de getUserOpenExamLockedQuestionIds(userId)>)` où ce jeu = questions d'examens ouverts avec participation ; HEAD : `not exists (… join exam_participations akl_p on … user_id = $1 … end_date > now())` corrélé — même ensemble, `NOT IN` ↔ `NOT EXISTS` équivalents (pas de NULL possible, `question_id` NOT NULL). Le seul écart est le bypass admin, **voulu** (#1). |
| `getTrainingSessionById` révèle plus qu'avant                                                                               | `main` : `revealAnswer = (isCompleted \|\| (isTutor && selected !== null)) && !locked` ; HEAD : `mayReveal ? lock.reveal(...) : {}` (`training/dal.ts:598,612`) — mêmes conditions, `reveal` renvoie `{keyWithheld}` quand verrouillé (`answer-key-lock.ts:81`). `answers[...]` : `revealAnswers && !lock.has` inchangé (`:622`).                                                                |
| Spread `{ ...i, explanationImages }` réintroduit `selectedAnswer`/`isCorrect` dans la forme-pont (Q7)                       | `reveal` construit un objet neuf à partir de champs nommés (`answer-key-lock.ts:82-89`) ; `questionsView` (`training/dal.ts:709-720`) liste ses champs explicitement puis spread le **retour** de `reveal`, pas `i`. Test `training-dal.test.ts` (« retient la correction… ») asserte `not.toHaveProperty("correctAnswer")`.                                                                     |
| `viewerOf` classe mal un rôle (Q6)                                                                                          | `answer-key-lock.ts:24-30` : tout ce qui n'est pas exactement `"admin"` devient `"user"` (direction sûre = verrouillé). Cohérent avec `lib/auth-guards.ts:15` (`(role ?? "user") as "user" \| "admin"`) et avec tous les `session.user.role === "admin"` du projet. Rôles composés Better Auth (`"admin,user"`) seraient aussi refusés par `requireRole` → pas de divergence.                       |
| `option === question.correctAnswer` marque une option avec `""`/`undefined` (Q8)                                            | `keyWithheld` force `isCorrectAnswer = false` (`question-card/index.tsx:514-516`) ; sans marqueur, `""` ne peut égaler aucune option (`schemas.ts:7-8`, `min(1)`) et `undefined` non plus. Le seul rendu fautif est le ✗ du quiz public (constat #2), pré-existant.                                                                                                                             |
| Question « validée » côté client sans réponse enregistrée (Q3)                                                              | `use-quiz-session.ts:296-320` : `revealed[qid]` n'est posé qu'après `res.ok` ; `onAnswer` (`training-session-client.tsx:117-137`) ne renvoie `ok` qu'après `saveTrainingAnswer` succès, qui a déjà écrit (`training/actions.ts:349-352`) avant de tester le verrou (`:355`). Inverse (sauvée, réseau perdu) : `pending` conservé, re-validation idempotente, rechargement hydraté en `keyWithheld`. |
| `initialRevealed` marque des questions verrouillées **non répondues** en tuteur                                              | `training/dal.ts:598` : `mayReveal` exige `selectedAnswer !== null` hors session complétée, donc `keyWithheld` n'est posé que sur des questions répondues. Session complétée : même comportement que `main` (toutes révélées).                                                                                                                                                                  |
| Oracle de composition d'examen via `totalQuestions` du quiz public (Q5)                                                     | Le delta ne dit que « une des 10 questions servies est entrée dans un examen ouvert pendant l'heure du jeton ». L'exclusion à la sélection (`getRandomQuizQuestions`) rend déjà cette appartenance observable à tout anonyme en échantillonnant le tirage avant/après ouverture — canal identique sur `main`. Aucune clé ne transite.                                                             |
| Anciennes fonctions encore appelées                                                                                         | `rg getOpenExamLockedQuestionIds\|getUserOpenExamLockedQuestionIds\|getOpenExamQuestionIds\|resolveRevisionLock` : occurrences uniquement dans `docs/superpowers/{specs,plans,reviews,handoffs}` datés (artefacts historiques), aucune dans `features/`, `app/`, `components/`, `tests/`, `e2e/`, `scripts/`.                                                                                     |
| Import circulaire `question-card → runner/types`                                                                            | `components/quiz/runner/types.ts` n'importe rien (`head -12`).                                                                                                                                                                                                                                                                                                                                 |
| Décalage d'horloge `new Date()` (JS, `lockFor`) vs `now()` (SQL, `excludeLocked`)                                            | Deux évaluations distinctes existaient déjà sur `main` (`gt(exams.endDate, new Date())` vs `sql\`now()\``). L'écart Vercel/Neon est de l'ordre de la milliseconde ; la fenêtre d'examen est en heures.                                                                                                                                                                                             |
| Leak via `data-state="withheld"`, classes ambre, `title=`                                                                   | Ils encodent « retenue », déjà affiché en clair ; jamais la clé ni `isCorrect`.                                                                                                                                                                                                                                                                                                                 |
| Le verrou ne couvre pas un accès à l'examen **avant** `startExam`                                                            | Pré-existant et voulu (participation « tout statut », `CONTEXT.md` : « un participant est verrouillé sur ses examens ouverts ») ; hors périmètre du refactor.                                                                                                                                                                                                                                  |

## 5. Réponses aux questions ouvertes

1. **`excludeLocked` en SQL brut** — Pas de collision : les alias `akl_q/akl_e/akl_p`
   sont uniques dans les deux contextes (voir faux positifs). La corrélation est
   sur la colonne passée par l'appelant (`sql\`q.id\`` / `sql\`${questions.id}\``),
   inlinée telle quelle, donc toujours la ligne courante du `FROM` externe.
   `viewer.id` est **lié en placeholder** (`$1`, prouvé par
   `tests/questions/answer-key-lock.test.ts:185-186`), jamais interpolé.
   Fragilité résiduelle (non bloquante) : les tables sont nommées en dur ; une
   future CTE nommée `exams` chez un appelant les masquerait en silence.
   D'accord avec le choix.

2. **`lockFor` borné par `candidates`** — Aucun appelant ne passe de liste non
   bornée : `requested` ≤ 500 (`loadExamQuestionExplanationsSchema`), quiz ≤ 10,
   sessions ≤ `MAX_QUESTIONS`, examens ≤ 500. Le `SELECT DISTINCT` est borné par
   `inArray`. D'accord.

3. **Marqueur posé seulement si l'appelant pouvait révéler** — Cohérent : en
   tuteur, une question verrouillée **non répondue** n'a ni clé ni marqueur, et
   c'est correct — la répondre déclenche `saveTrainingAnswer` qui renvoie
   `{ keyWithheld: true }` (`training/actions.ts:355-357`) → `revealed` +
   `answers[qid] = { selected }` (`use-quiz-session.ts:311-317`). Après
   rechargement, `mayReveal` est vrai (répondue) → `keyWithheld` → hydratation
   identique (`training-session-client.tsx:88-98`). Pas d'état « validée sans
   enregistrement » ni l'inverse (preuve en faux positifs). D'accord.

4. **`SessionResults` calcule seul ses compteurs** — Le calcul est correct et à
   parité avec les trois pages supprimées (mêmes règles `selected` vide/null =
   non répondu). Mais **la divergence score/compteurs est trompeuse ET
   oracle** (constat #1) : « 1 sur 5 questions réussies » est faux dès qu'une
   différée est juste, et `score × N / 100 − correct` rend le bit retenu. Pas
   d'accord avec « acceptable » ; pas une régression, mais à traiter avant que
   l'affichage « différée » ne rende l'oracle évident. Cas où « X sur N réussies »
   est faux : toute différée juste.

5. **Quiz public retire silencieusement** — Oui, c'était déjà le cas sur `main`
   (`getOpenExamQuestionIds` + même filtre). Le delta `totalQuestions` n'ajoute
   rien à l'oracle d'appartenance qu'offre déjà l'exclusion à la sélection. En
   revanche l'UI publique rend la retenue « Incorrect » (constat #2) — je
   recommande de porter `keyWithheld` là aussi, c'est le seul canal où le
   marqueur s'arrête avant l'écran.

6. **`viewerOf` et rôle inattendu** — Aucun chemin ne classe mal : `null`,
   `undefined`, chaîne inconnue, rôle composé → `"user"` (verrouillé). Le seul
   cas « déverrouillé » est la chaîne exacte `"admin"`, identique à `requireRole`
   et aux comparaisons `=== "admin"` du reste du code. Les tests DAL ne
   vérifient toutefois pas **quel** lecteur est transmis (constat #3).

7. **Spread `{ ...i, explanationImages }` dans `getTrainingSessionResults`** —
   Sûr : `reveal` retourne un objet neuf de champs nommés ; `questionsView`
   spread le retour, pas `i` ; `answers` blanchit `isCorrect` par `has`. Vérifié
   aussi sur `getParticipantExamResults` (`...lock.reveal(i.questionId, i, "key")`).

8. **`option === question.correctAnswer` avec `""`/`undefined`** — Impossible de
   marquer une option à tort : `keyWithheld` court-circuite (`index.tsx:514-516`) ;
   sans marqueur, `""` et `undefined` n'égalent aucune option (`min(1)`). Le
   seul rendu fautif est le ✗ sur la réponse de l'utilisateur dans le quiz
   public (`""` + pas de marqueur) — constat #2, pré-existant.

## 6. Verdict

**Peut-on ouvrir la PR vers `main` et merger tel quel ? OUI.** Aucun point
bloquant : pas de fuite nouvelle, pas de canal déverrouillé, parité prouvée sur
les 8 lecteurs (`getTrainingSessionById`, `getTrainingSessionResults`,
`saveTrainingAnswer`, `getParticipantExamResults`, `getExamQuestionExplanations`,
`scoreQuizAnswers`, `getRandomQuizQuestions`, corpus de révision ×2), gates
verts, anciennes fonctions sans appelant vivant. Les deux constats de fond
(#1, #2) sont **pré-existants** et sortent du périmètre d'un refactor ; ils
méritent une issue chacun plutôt qu'un ajout à cette PR.

| Priorité             | Correctif                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bloquant maintenant  | — (rien)                                                                                                                                         |
| Avant merge          | #3 asserter `lockFor` `toHaveBeenCalledWith(viewerOf(session.user), ids)` dans les 4 tests DAL (10 min) · #4 corriger la phrase de `data-layer.md` (`has` pour `isCorrect`, signature réelle de `reveal`) |
| Finition (issues)    | #1 score provisoire / « X sur N corrigées » quand `withheld > 0` (décision produit, oracle à fermer) · #2 `keyWithheld` sur le quiz public (`page.tsx` + `question-navigation.tsx` + `totalQuestions`) · #5 ne pas demander l'explication d'une question retenue |

Recommandation complémentaire : lancer `bun run test:integration` avant
l'ouverture de la PR — c'est la seule exécution réelle du SQL de `excludeLocked`
et de `lockFor` (les tests unitaires ne vérifient que le rendu du fragment).

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule** : aucune modification de fichier source ; le seul fichier
  écrit est ce rapport. Non committé.
- **Neon intact** : aucun outil MCP Neon, aucun script de migration, aucun
  `test:integration`, aucun `bun dev`, aucun `test:e2e`.
- **Secrets** : aucun `.env*` lu ni affiché.
- **Commandes exécutées** : `git diff main...HEAD` (stat + contenu), `git show`,
  `git log`, `rg`/`grep`, `sed -n`, `bun run check` (exit 0), `bun run test`
  (exit 0). Sorties des gates conservées dans le scratchpad de session
  (`check.log`, `test.log`).
