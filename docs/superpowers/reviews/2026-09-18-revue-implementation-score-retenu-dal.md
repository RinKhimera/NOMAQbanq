# Revue adversariale — score retenu côté DAL (#180, commit `7c2a9e4`)

- **Date** : 2026-09-18
- **Périmètre** : `git diff 34b136a..HEAD` (1 commit, `7c2a9e4`, 30 fichiers)
  sur `fix/score-withheld-and-cleanup`. Réponse aux constats #1–#4 de la revue
  du 2026-09-17 (`2026-09-17-revue-implementation-score-retenu.md`).
- **Méthode** : lecture seule, hostile. Chaque constat est prouvé par une
  référence `fichier:ligne` lue sur la branche ; la parité est établie contre
  `git show 34b136a:<fichier>`. Chaque intuition a été confrontée à une
  tentative de démenti ; celles qui n'ont pas tenu sont en § 5. La
  déqualification Drizzle (Q1) a été tranchée en lisant le dialecte installé
  (`node_modules/drizzle-orm`, 0.45.2), pas de mémoire.
- **Gates** : `bun run check` → **exit 0** (prettier, tsc, eslint) ·
  `bun run test` → **exit 0** (140 fichiers, 1 543 tests). Ni
  `test:integration`, ni `test:e2e`, ni `bun dev` lancés.

## 1. Table des constats

| # | Sév | fichier:ligne | Problème | Régression ? |
|---|-----|---------------|----------|--------------|
| 1 | 🟠 | `features/exams/dal.student.ts:998-1008` · `app/(dashboard)/tableau-de-bord/_components/dashboard-client.tsx:83,67,140` · `dashboard-hero.tsx:37-43` · `next-actions-panel.tsx:151-160` · `examen-blanc-client.tsx:428-441,541-545` · `features/training/dal.ts:273-282` · `entrainement-client.tsx:72,93` · `next-actions-panel.tsx:93-97` | Quand **toutes** les lectures sont retenues, la moyenne retombe à `0` (`coalesce … 0`) alors que le compte (`completedExamsCount`, `totalSessions`) inclut les retenues : le tableau de bord affiche « Score moyen **0 %** », l'anneau à 0, le message « Chaque erreur est une opportunité… », l'action prioritaire « Révisez les domaines faibles », et la page examens « 1 examen passé · **0 réussi** · Score moyen : 0 % ». Déclencheur : le cas **commun** — un étudiant termine son premier examen et sa fenêtre est encore ouverte (nouveau comportement « retenu tant que son propre examen est ouvert »). | **OUI** — sur `34b136a` la moyenne était le vrai score |
| 2 | 🟠 | `app/(dashboard)/tableau-de-bord/_components/recent-activity-feed.tsx:84,154` | `{exam.score}%` rend « **%** » seul (React n'affiche pas `null`) dans une pastille **rouge** (`isPassing = (score ?? 0) >= 60` → faux). Fichier non touché par le commit alors que sa source `getMyRecentExams` passe à `number \| null`. Déclencheur : examen clos dont une question est aussi dans un examen ouvert où l'étudiant participe (le filtre `:37-39` n'affiche que les examens clos aux non-admins). | **OUI** — avant : « 72 % » vert |
| 3 | 🟠 | `features/notifications/cron.ts:64-72,113-119` · `email/templates/exam-results-email.tsx:35` | Le courriel « résultats disponibles » envoyé à la clôture imprime le **score brut** (`Score : 50 %`) et pointe vers la page de résultats qui, elle, retient le score et affiche les compteurs hors différées : l'oracle de #180 par courriel. Contredit `CONTEXT.md` (« lu par aucune surface étudiant »), le message du commit et `data-layer.md` (« Toute lecture étudiant d'un score »). | NON (préexistant) — mais la règle documentée est fausse |
| 4 | 🟠 | `features/training/dal.ts:520,609,585-596` · `features/training/cron.ts:55-63` · `app/(dashboard)/tableau-de-bord/entrainement/[sessionId]/page.tsx:21-26` · `training-session-client.tsx:37-58` | `getTrainingSessionById` sérialise `score` vers un composant client qui ne le lit pas. La page ne redirige que `completed` ; une session **`abandoned` par le cron** porte un score calculé sur toutes les réponses (différées comprises) et arrive dans le payload RSC avec, en mode tuteur, `isCorrect` des réponses non verrouillées → soustraction en un `Ctrl+U`. La réponse à Q6 (« redirige les sessions complétées ») oublie ce statut. | NON (préexistant) |
| 5 | 🟠 | `features/exams/dal.student.ts:909-915,929-932` · `app/(admin)/admin/examens/[id]/_components/exam-leaderboard.tsx:122,145` | Le classement retient le score selon le **lecteur**, pas selon le **propriétaire** : le score exact de A est affiché à tout autre participant B (un ami de cohorte, un second compte). Et pour A lui-même, le tri sur le score brut + le rang affiché donnent l'encadrement `s_dessous ≤ s ≤ s_dessus` ; avec des pourcentages entiers, un écart de 2 ou une égalité rend la valeur **exacte**. | NON (préexistant, le score était affiché) |
| 6 | ℹ️ | `features/training/dal.ts:714` vs `:56-62` et `features/exams/dal.student.ts:641-645` | Jumeau TS/SQL du prédicat : le TS d'entraînement teste `!== null` seul, le SQL et le TS d'examen excluent aussi `''`. Équivalent aujourd'hui (aucun chemin n'écrit `''`, Q2), mais deux définitions à maintenir identiques. | NON |
| 7 | ℹ️ | `tests/integration/dashboard-dal.test.ts:279-284` · `tests/components/` | Aucun test ne couvre « tout retenu » (constat #1) ni le fil d'activité avec `score: null` (#2) ; l'intégration teste la moyenne avec une lecture lisible à côté. Le libellé « de l'examen » (revue précédente #6) reste tel quel. | NON |

## 2. Détail par constat

### 1 — 🟠 Les agrégats retombent à `0 %` quand tout est retenu

**Code.**
- `features/exams/dal.student.ts:998-1001` : `completed = count(*) filter (where status in ('completed','auto_submitted'))` — compte les participations retenues.
- `:1004-1008` : `averageScore = coalesce(round(avg(score) filter (where status in (…) and not exists(…))), 0)` — `avg` sur un ensemble vide → `null` → **0**.
- `dashboard-client.tsx:83` : `stats.completedExamsCount > 0 ? \`${stats.averageScore}%\` : "—"` → « 0 % ». `:67` et `:140` passent la même valeur à `DashboardHero` et `ProgressRing`.
- `dashboard-hero.tsx:37-43` : `getMotivationalMessage(0, true)` → « Chaque erreur est une opportunité d'apprentissage ».
- `next-actions-panel.tsx:151-160` : `completedExamsCount > 0 && averageScore < 60` → action « Révisez les domaines faibles », priorité `high`.
- Page examens, `examen-blanc-client.tsx:428-441` : `scores` exclut les `null`, `passedExams` et `averageScore` en dérivent (`: 0` si vide), mais `totalCompleted` compte tout ; rendu `:512-545` → « 1 examen passé · 0 réussi · Score moyen : 0 % ».
- Entraînement, `features/training/dal.ts:273` (`totalSessions = count(*)`) et `:279-282` (même `coalesce … 0`) ; `entrainement-client.tsx:72,93` affiche `{stats.averageScore}%` dès que `totalSessions > 0` ; `next-actions-panel.tsx:93-97` → « Score moyen : 0 % — Visez 60 %+ ».

**Pourquoi c'est un vrai bug.** Le commit rend un score d'examen retenu *tant que son propre examen est ouvert*. Un étudiant qui termine son **premier** examen voit donc, pendant toute la fenêtre (jours ou semaines), un tableau de bord qui lui annonce 0 % de moyenne, 0 réussi, un anneau vide et une injonction à réviser ses « domaines faibles ». Ce n'est pas un cas limite : c'est le parcours nominal de chaque nouvel inscrit. Le `0` n'est pas une fuite, mais c'est un faux résultat présenté comme un vrai (`0 %` a un sens : « tout faux »).

**Régression ? OUI.** Sur `34b136a`, `averageScore` était `coalesce(round(avg(score) filter (where status in (…))), 0)` sans exclusion : la moyenne était le vrai score de la participation.

**Comment je l'ai prouvé.** `git diff 34b136a..HEAD -- features/exams/dal.student.ts` (hunk `getMyDashboardStats`), `grep -rn "averageScore\|completedExamsCount" app/(dashboard)`, lecture des quatre consommateurs. `tests/integration/dashboard-dal.test.ts:279-284` fixe `completedExamsCount = 2, averageScore = 40` avec une participation lisible à côté : le cas « tout retenu » n'est pas testé.

**Correctif.** Rendre l'absence lisible : `averageScore: number | null` (`null` quand aucune lecture n'est lisible) ou exposer `scoredCount` à côté du compte total ; les composants rendent `null` comme « — » avec `SCORE_WITHHELD_MESSAGE`, le message du hero et l'action « Révisez » se conditionnent sur `averageScore !== null`. Même traitement pour `getTrainingStats` et `userStats` de la page examens (« 0 réussi » → « — »). Ajouter le cas « tout retenu » au test d'intégration et un test de composant.

### 2 — 🟠 Le fil d'activité rend « % » dans une pastille rouge

**Code.** `recent-activity-feed.tsx:84` : `const isPassing = (exam.score ?? 0) >= 60` ; `:154` : `{exam.score}%`. Source : `getMyRecentExams` → `score: readableScore(...)` (`dal.student.ts:1069`), type `MyRecentExam.score: number | null` (`:1037`). Le fichier n'est pas dans le diff.

**Pourquoi c'est un vrai bug.** `{null}` ne rend rien en React : la pastille affiche « % » seul, stylée `bg-red-100 text-red-700` (échec). C'est exactement le motif « comparaison `>= 60` sur `null` → À améliorer » anticipé par la revue. Déclencheur : le filtre `:37-39` (`isCompleted && (isAdmin || now >= endDate)`) n'affiche aux non-admins que les examens **clos** ; le score d'un examen clos n'est `null` que si une de ses questions répondues appartient à un examen **ouvert** où l'étudiant participe (réutilisation de questions entre sessions d'examen, cas prévu par le verrou).

**Régression ? OUI.** Sur `34b136a`, la même ligne affichait le vrai score.

**Comment je l'ai prouvé.** `grep -rnE "\.score\b|score:" app components hooks features lib` hors fichiers du diff → seul hit étudiant non traité ; lecture `:30-40, 76-100, 140-160`.

**Correctif.** `formatScore(exam.score)` + style neutre et `title={SCORE_WITHHELD_MESSAGE}` quand `null`, comme `training-history-section.tsx:172-204`.

### 3 — 🟠 Le courriel de résultats envoie le score brut

**Code.** `features/notifications/cron.ts:64-72` sélectionne `score: examParticipations.score` sur les participations des examens clos ; `:113-119` l'envoie via `sendExamResultsEmail` ; `email/templates/exam-results-email.tsx:35` rend `{ label: "Score", value: \`${score} %\` }`. Le `resultUrl` pointe vers `/tableau-de-bord/examen-blanc/{id}/resultats`, page où `getParticipantExamResults` retient le score (`dal.student.ts:636-647`) et où `SessionResults` compte les justes hors différées.

**Pourquoi c'est un vrai bug.** Scénario de #180, à la lettre : examen E1 clos, question Q aussi dans E2 ouvert où l'étudiant participe. À la clôture de E1, le courriel dit « Score : 50 % » ; la page dit « 1 sur 2 réussies » et « Différées 1 » ; `round(50 × 3 / 100) − 1 = 1` → Q est juste. Le cron n'a pas de session : le « lecteur » est l'utilisateur de la ligne, et rien ne lui applique le prédicat.

**Régression ? NON** (préexistant). Mais `CONTEXT.md` (« n'est lu par aucune surface étudiant »), le message du commit (« toutes les surfaces étudiant ») et `data-layer.md` (« Toute lecture étudiant d'un score […] le projette en null ») documentent une règle que ce chemin ne tient pas — le défaut que la revue précédente reprochait déjà à `34b136a`.

**Comment je l'ai prouvé.** `grep -rn score features/notifications email` ; lecture du cron et du template.

**Correctif.** Généraliser `scoreWithheldFor` pour accepter l'identifiant du lecteur en **colonne** (`akl_p.user_id = ${examParticipations.userId}`) et le rôle via `user.role` (`case when role = 'admin' then false else exists(…) end`), puis projeter `readableScore` dans le cron ; le template accepte `score: number | null` et rend « Consultez vos résultats » sans chiffre quand `null`. La même généralisation sert au constat #5.

### 4 — 🟠 Une session abandonnée sérialise son score vers le client

**Code.**
- `features/training/cron.ts:55-63` : `closeExpiredTrainingSessions` pose `status: "abandoned"` **et** `score = round(correct × 100 / questionCount)` sur toutes les réponses, différées comprises.
- `features/training/dal.ts:520` sélectionne `score`, `:609` le renvoie dans `TrainingSessionView.session` ; `:585-596` renvoie `isCorrect` des réponses **non** verrouillées dès que `isTutor` (`revealAnswers = isCompleted || isTutor`).
- `entrainement/[sessionId]/page.tsx:21-26` : redirige seulement `status === "completed"` ; sinon `<TrainingSessionClient initialData={data} />` — composant `"use client"` (`training-session-client.tsx:37-58` affiche « Session expirée » sans lire `score` : `grep score` vide).

**Pourquoi c'est un vrai bug.** Toute prop d'un composant client est dans le flight RSC (`self.__next_f.push`). Mode tuteur : `score × N / 100 − Σ isCorrect` = différées justes, en un `Ctrl+U`. Mode test : répondre uniquement à la question verrouillée, laisser expirer (24 h), revenir sur l'URL → `score ∈ {0, 100/N}` = le bit. C'est le canal que la revue précédente notait en #2 (« masqué à l'affichage et non à la source »), sur une page que Q6 exclut à tort.

**Régression ? NON** (préexistant).

**Comment je l'ai prouvé.** `grep -rn "TrainingSessionView\|getTrainingSessionById" app components` → un seul consommateur ; `grep -n "\.score" training-session-client.tsx` → aucun ; lecture du cron (statut de fermeture `abandoned`).

**Correctif.** Retirer `score` de `TrainingSessionView` (YAGNI : le client ne le lit pas) — un oubli casserait alors la compilation. Même finition pour `ExamSessionView.score` (`dal.student.ts:339,373`), passé en `initialSession` à `EvaluationClient` (`evaluation/page.tsx:53`) ; sans fuite aujourd'hui (voir § 5), mais inutile.

### 5 — 🟠 Le classement retient selon le lecteur, pas selon le propriétaire

**Code.** `dal.student.ts:909-915` : `ownScore = case when user_id = <lecteur> then readableScore(lecteur) else score end` ; `:929-932` : `orderBy(desc(score), asc(completedAt))` sur le score **brut** ; `exam-leaderboard.tsx:122` affiche `index + 1`, `:145` `formatScore(entry.score)`. Accès étudiant : après `endDate`, participant ou accès examen actif (`:876-905`).

**Pourquoi c'est un vrai bug.** Le commentaire `:906-908` raisonne sur le lecteur (« il ne connaît pas leurs réponses ») ; l'oracle dépend du **propriétaire** du score, qui connaît les siennes. Le score exact de A est servi à tout autre lecteur B du classement : un camarade de cohorte (les étudiants préparent l'EACMC en groupe) ou un second compte. Pour A seul, le rang et les voisins donnent `s_dessous ≤ s_A ≤ s_dessus` ; les scores étant des entiers, un écart de 2 (71 / 69) ou une égalité (70 / 70) fixe `s_A` exactement, donc `c = round(s_A × N / 100)` pour `N ≤ 100`, puis `c − justes affichées` sur la page de résultats. Je ne suis pas d'accord avec « l'auteur accepte l'encadrement » : l'encadrement n'est pas la valeur *en général*, mais il l'est souvent, et le canal par autrui le contourne de toute façon.

**Régression ? NON** (avant, le score était affiché à tous, lecteur compris).

**Comment je l'ai prouvé.** Lecture de `getExamLeaderboard` et du composant ; `grep -rn getExamLeaderboard app` → page étudiant `examen-blanc/[examId]/page.tsx:96` (détail après clôture).

**Correctif.** Projeter `null` quand le **propriétaire** est verrouillé, quel que soit le lecteur (généralisation de #3 : `viewer` en colonne `examParticipations.userId` + rôle joint), sauf pour un lecteur admin ; et sortir ces lignes du rang (tri `nulls last` avec rang non affiché, ou section « en attente de clôture »), sinon le tri sur le score brut reste un oracle.

### 6 — ℹ️ Jumeau TS/SQL du prédicat

**Code.** SQL : `selected_answer is not null and selected_answer <> ''` (`training/dal.ts:56-62`, `dal.student.ts:44-49`) ; TS examen : `!== null && !== ""` (`dal.student.ts:641-645`) ; TS entraînement : `!== null` seul (`training/dal.ts:714`).

**Pourquoi.** Équivalent aujourd'hui (Q2 : aucun chemin n'écrit `''`), mais trois expressions pour une règle. Une extraction (`hasStoredAnswer`) ou le retrait de la garde `<> ''` morte aligne les jumeaux.

### 7 — ℹ️ Trous de test et libellé

`tests/integration/dashboard-dal.test.ts:279-284` et `exams.test.ts:900-905` testent la moyenne **avec** une lecture lisible ; aucun test pour « tout retenu » (#1). `tests/components/DashboardHero.test.tsx` est le seul test des composants du tableau de bord ; aucun ne rend `RecentActivityFeed` avec `score: null` (#2). `SCORE_WITHHELD_MESSAGE` (`runner/types.ts:29-30`) garde « de l'examen » (revue précédente #6, non traité).

## 3. Constats de la revue précédente

| # | Statut | Preuve |
|---|--------|--------|
| 1 — score servi ailleurs avec le même `N` | **Partiellement fermé** | Fermé pour les dix lectures visées : `getTrainingHistory` (`training/dal.ts:215-218`), `getTrainingStats` (`:279-282`), `getMyTrainingScoreHistory` (`:361-364, 393-397`), `getTrainingSessionResults` (`:711-730`), `getExamsWithParticipation` (`dal.student.ts:149-152`), `getParticipantExamResults` (`:636-647`), `getExamLeaderboard` (`:909-915`), `getMyDashboardStats` (`:1004-1008`), `getMyRecentExams` (`:1069`), `getMyScoreHistory` (`:1129`) — projection SQL, type de retour et composant vérifiés pour chacune. Reste ouvert : le courriel (#3), la session abandonnée (#4), le classement vu par autrui (#5). |
| 2 — score dans le payload RSC | **Fermé** | `SessionResultsProps.score: number \| null` (`session-results.tsx:50`), `SessionResultsHeaderProps.score` (`:663`) ; les pages passent la valeur DAL (`entrainement/…/resultats/page.tsx:59-60`, `examen-blanc/…/resultats/page.tsx:70-71`, admin `:56-57`), `null` quand retenu (`training/dal.ts:730`, `dal.student.ts:641-647`). Résidu sur une autre page : #4. |
| 3 — `correctCount` renvoyé au navigateur | **Fermé** | `training/actions.ts:436-437, 517` et `exams/actions.ts:766-767, 887` renvoient `{ success: true }` ; les tests lisent la base (`training-actions.test.ts:528-533`, `exams.test.ts:77-88`, `exam-runner.test.ts:240-253`, `training.test.ts:212-221`). |
| 4 — parité par convention, prop optionnelle | **Fermé** | `scoreWithheld` supprimée ; `score: number \| null` **requis** sur les deux composants ; corps `scoreWithheld = score === null \|\| isScoreWithheld(…)` (`:293`), en-tête `score === null` (`:690`) : la même valeur pilote les deux. `isScoreWithheld` reste en ceinture côté composant (`:75-84`) et est testé (`SessionResults.test.tsx:260-271`). |
| 5 — test d'architecture sur la directive | **Sans objet** | Le module `score-withheld.ts` est supprimé ; les pages serveur n'importent plus que des **types** de `runner/types` (`import type`, pages `:7/:8/:8`), voir Q8. |
| 6 — libellé « de l'examen » | **Non traité** | `runner/types.ts:29-30`, inchangé. |

## 4. Faux positifs écartés

| Suspecté | Écarté par |
|---|---|
| **Q1** — corrélation déqualifiée (`i.session_id = "id"`) dans les requêtes mono-table | Drizzle 0.45.2, `pg-core/dialect.js:142-162` : en mono-table, `buildSelection` ne remplace que les `PgColumn` de **premier niveau** des `queryChunks` du champ ; un `SQL` imbriqué est poussé tel quel, et `sql/sql.js:118-128` rend tout `Column` interpolé **qualifié** (`"training_sessions"."id"`). Dans `readableScore`, seul `trainingSessions.score` du `coalesce` est de premier niveau → `"score"`, correct puisque le FROM ne contient que cette table ; `${trainingSessions.id}` vit dans le `SQL` imbriqué `answeredQuestionIds` → qualifié. Les requêtes jointes (`getExamLeaderboard` + `user`, `getMyScoreHistory` + `exams`) ne sont pas mono-table → tout qualifié. Aucune requête n'aliasse `training_sessions`/`exam_participations` dans le FROM ; les alias `akl_*` sont internes à l'`exists`, donc `"exam_participations"."id"` y résout sur la ligne externe. Les tests d'intégration (`exams.test.ts:893-950`) distinguent `null`/`100` sur deux sessions du même utilisateur, ce qu'une corrélation cassée ne pourrait pas produire. |
| **Q2** — une réponse « ni lettre ni vide » compterait d'un côté et pas de l'autre | Écritures : `saveTrainingAnswer` (`training/actions.ts:349-352`) et `saveExamAnswer` (`exams/actions.ts:651, 698`) passent par `z.string().min(1)` (`training/schemas.ts:60`, `exams/schemas.ts:78`) ; `startExam` pré-insère `null` (`exams/actions.ts:558-566`) ; les crons n'écrivent pas `selected_answer` ; `/api/e2e` écrit une option ou la bonne réponse (`route.ts:447-459`). Aucun chemin n'efface une réponse. Un `' '` (accepté par `min(1)`) est stocké, compté « répondu » par le SQL, le TS et le score (`is_correct = false`) — cohérent. |
| **Q3** — un écran ou un courriel affiche `null`/`0` juste après soumission | `/soumis` : `getExamSubmissionSummary` ne sélectionne que `answeredCount`/`flaggedCount` (`dal.student.ts:786-836`) ; `finalizeExam` renvoie `{ success: true }` ; `evaluation-client` et `finish-dialog` ne lisent pas `score` (`grep` vide). Le fil d'activité n'affiche que les examens clos (`:37-39`) → pas « juste après soumission », mais bien le constat #2 dans le cas croisé. Le courriel part à la **clôture**, pas à la soumission → constat #3. |
| **Q4** — `totalSessions`/`completedExamsCount` + moyenne avant/après | La moyenne porte sur le sous-ensemble lisible ; l'étudiant sait lesquelles sont retenues (sablier). `avg_n × n − avg_{n−1} × (n−1)` ne fait intervenir que des scores lisibles. `domainPerformance` exclut les retenues de la moyenne **et** de l'effectif (`training/dal.ts:393-397`) : cohérent. Pas d'oracle — mais le `0` par défaut est le constat #1. |
| Taux de réussite marketing (`features/marketing/dal.ts:57-66`) comme oracle « ≥ 60 » | Global, arrondi à l'entier, publié seulement au-delà de `MIN_COMPLETED_PARTICIPATIONS` (`marketing/lib.ts:14-28`), bruité par les autres passages ; au mieux un bit « ≥ seuil », pas une clé. |
| `analytics/dal.ts:81`, `components/admin/dashboard/activity-feed.tsx:129-140` lisent un score brut | Surfaces admin (`requireRole`), lecteur jamais verrouillé. |
| **Q6** — `ExamSessionView.score` atteint `EvaluationClient` | Oui (`evaluation/page.tsx:53`), mais la page redirige `completed`/`auto_submitted` (`:25-27`) ; en `in_progress` le score vaut `0` depuis `startExam` (`exams/actions.ts:544-550`) et aucun chemin ne remet `in_progress` (`grep 'status: "in_progress"'` → création seule). Pas de fuite ; champ inutile (finition, #4). |
| **Q7** — page admin utilisateur scopée sur l'étudiant | `app/(admin)/admin/utilisateurs/**` et `features/users/dal*.ts` ne lisent aucun `score` (`grep` vide). La page admin de résultats passe `viewerOf(session.user)` = admin (`dal.student.ts:582`) ; le classement admin projette `readableScore(viewerOf(admin))` → `sql\`false\`` → score lisible (`answer-key-lock.ts:168`). |
| **Q8** — un `"use client"` sur `runner/types.ts` casserait une page | Les trois pages serveur n'importent que des **types** (`import type { AnswersMap, QuizQuestion }`, `resultats/page.tsx:7`, `:8`, `:8`) — effacés à la compilation, insensibles à la directive. Les importateurs de valeurs (`SCORE_WITHHELD_MESSAGE`, `KEY_WITHHELD_MESSAGE`) sont tous `"use client"` (`training-history-section`, `examen-blanc-client`, `session-results`, `evaluation-client`, `training-session-client`). Le danger de la revue précédente (#5) tenait à `isScoreWithheld` appelée par les pages ; elle vit désormais dans `session-results.tsx` (client) et les pages ne l'appellent plus. Rien à garder par un test. |
| Parité — un étudiant sans question retenue voit autre chose qu'avant | Historique : sablier seulement si `null`, sinon `${score}%` et mêmes tranches de couleur (`training-history-section.tsx:172-212`) ; dialogue de suppression : `formatScore` → « N % » (`delete-session-dialog.tsx:37-41, 108`) ; graphiques : `filter(isReadable)` ne retire rien, le suffixe « en attente » n'apparaît que si `withheldCount > 0` (`score-evolution-chart-content.tsx:95-97, 162`, `training-score-chart-content.tsx:172-174, 243-244`) ; carte d'examen passé : `formatScore` + mêmes icônes (`examen-blanc-client.tsx:208-236`) ; stats de la page : mêmes formules sur `scores` = tous les scores (`:428-441`) ; classement et tuiles admin : `formatScore`, même arithmétique sans `null` (`exam-section-stats.tsx:12-36`) ; pages de résultats : `score` numérique → rendu identique (`session-results.tsx:293-295`). `getTrainingHistory` : `coalesce(score, 0)` en SQL remplace `r.score ?? 0` ; `getMyRecentExams` : mapping `isCompleted ? (p?.score ?? null) : null` inchangé (`git show 34b136a:…:1045`). |
| Les tests passeraient sans le prédicat | `exams.test.ts:893-950` exige `null` sur la session/participation chevauchant un examen ouvert **et** `100`/`40` sur la voisine lisible ; `dashboard-dal.test.ts:271-284` exige `null` sur examA et `40` sur examB. Un prédicat absent rendrait `40`/`100` partout, un prédicat constant rendrait `null` partout : la paire discrimine. Réserve : le cas « tout retenu » (#1) n'est pas couvert. |
| `Date.now()` ajouté dans un rendu (hydratation) | Aucun : `isReadable`, `formatScore`, `getScoreColor(null)` sont purs ; `now()` n'est que côté SQL. |
| `getTrainingSessionResults` sur une session `abandoned` | `:23` de la fonction renvoie `SESSION_NOT_COMPLETED` pour tout statut ≠ `completed` ; pas de score servi par ce chemin. |

## 5. Réponses aux questions ouvertes

1. **Le prédicat SQL.** Qualifié, dans tous les cas. La déqualification Drizzle ne touche que les colonnes de premier niveau d'un champ `select` en mono-table (`dialect.js:142-162`) ; un `Column` dans un `sql` imbriqué est toujours rendu `"table"."colonne"` (`sql.js:118-128`). `${trainingSessions.id}` / `${examParticipations.id}` sont dans le `SQL` imbriqué `answeredQuestionIds`, donc qualifiés ; les requêtes jointes ne sont pas mono-table. La mémoire du projet vise la sous-requête `.as()` et le SET d'`update().from()`, pas ce motif. Preuve empirique : les tests d'intégration distinguent deux lignes du même utilisateur.
2. **Une réponse vide.** Aucun chemin n'écrit autre chose qu'une chaîne non vide (`min(1)`) ou le `null` de pré-insertion ; pas d'effacement. La garde `<> ''` est morte mais inoffensive. Un `' '` est « répondu » des deux côtés. Seul écart : le jumeau TS d'entraînement omet `!== ""` (ℹ️ #6).
3. **Le score d'examen retenu pendant la fenêtre.** Aucun écran de soumission ne l'affichait (`/soumis` ne lit pas `score`). Mais le **tableau de bord** l'affiche désormais comme `0 %` avec « 0 réussi » et une action « Révisez » (#1, régression) ; le **courriel** de clôture l'imprime en brut (#3) ; et le fil d'activité rend « % » rouge dans le cas croisé (#2).
4. **Les moyennes.** Les agrégats du diff excluent bien les retenues, et `totalSessions`/`completedExamsCount` ne permettent rien de plus (§ 4). Restent des lectures brutes : `recent-activity-feed.tsx:84,154` (#2) et le cron de courriel (#3) ; `dashboard-hero`, `progress-ring`, `next-actions-panel` lisent la moyenne déjà filtrée — c'est son `0` par défaut qui les trompe (#1). Page admin utilisateurs : aucun score.
5. **Le classement.** Oui, il existe des cas exacts (égalité ou écart de 2 entre voisins, pourcentages entiers, `N ≤ 100`) et, plus grave, le score du propriétaire est servi à **tout autre** lecteur : la retenue est indexée sur le mauvais acteur (#5). Je ne confirme pas le résidu comme acceptable.
6. **`getExamSession.score` / `getTrainingSessionById.score`.** Exam : atteint `EvaluationClient` mais vaut `0` par construction (in_progress seul) — inutile, pas dangereux. Entraînement : l'affirmation « redirige les sessions complétées » oublie `abandoned`, statut posé **avec** un score par le cron ; le score arrive dans le payload d'un client qui ne le lit pas (#4). Retirer le champ des deux vues.
7. **Le jumeau admin.** Aucune lecture scopée sur l'étudiant avec le mauvais lecteur : la page admin de résultats et le classement admin passent le lecteur de session (admin) et lisent en clair ; la page admin utilisateurs n'affiche pas de score. Attendu.
8. **`runner/types.ts` sans directive.** Sûr : les pages serveur n'en importent que des types ; toute valeur (`SCORE_WITHHELD_MESSAGE`) est consommée par des modules `"use client"`. Le test d'architecture supprimé n'a plus d'objet — le danger a disparu avec `score-withheld.ts`, pas avec le test.

## 6. Verdict

**NON** — pas en l'état.

Le commit ferme réellement #1 (dix lectures), #2, #3 et #4 de la revue précédente, et le prédicat SQL est correct. Mais il introduit une **régression visible sur le parcours nominal** (#1 : « Score moyen 0 % · 0 réussi · Révisez vos domaines faibles » pendant toute la fenêtre du premier examen) et un rendu cassé (#2), et il documente dans `CONTEXT.md`, `data-layer.md` et le message du commit une règle (« aucune surface étudiant ») que trois canaux contredisent (#3 courriel, #4 payload de session abandonnée, #5 classement vu par autrui).

| Priorité | Correctif |
|---|---|
| Bloquant maintenant | #1 — `averageScore: number \| null` (ou `scoredCount`) sur `getMyDashboardStats`, `getTrainingStats`, `userStats` ; rendu « — » + message ; hero/actions conditionnés ; test « tout retenu » |
| Bloquant maintenant | #2 — `formatScore` + style neutre dans `recent-activity-feed.tsx` |
| Avant merge | #3 + #5 — `scoreWithheldFor` avec lecteur en colonne (`user_id` + rôle joint) ; cron de courriel sans chiffre quand retenu ; classement retenu selon le **propriétaire**, lignes retenues hors rang |
| Avant merge | #4 — retirer `score` de `TrainingSessionView` (et `ExamSessionView`) |
| Avant merge | Si #3/#4/#5 sont reportés : reformuler `CONTEXT.md`, `data-layer.md` et le message du commit (« lectures en app », pas « aucune surface ») et ouvrir les issues |
| Finition | #6 — un seul `hasStoredAnswer` pour les jumeaux TS ; #7 — tests de composants (`RecentActivityFeed`, `DashboardClient` avec `null`), libellé « d'un examen en cours » |

## 7. Confirmations de sécurité opérationnelle

- Lecture seule : `git diff`, `git log`, `git show 34b136a:…`, `grep`, `sed`, `cat`, `gh issue view 180`, lecture de `node_modules/drizzle-orm`. Aucun `checkout`/`stash`/`reset`, aucun fichier source modifié (`git status --short` : seul le rapport de la veille, non suivi, avant celui-ci).
- Commandes exécutées en plus : `bun run check` (exit 0) et `bun run test` (exit 0), journaux dans le scratchpad de session. Ni `bun test`, ni `test:integration`, ni `test:e2e`, ni `bun dev`.
- Aucune base Neon, aucune branche `br-*`, aucun compte Stripe touché ; aucun contenu de `.env*` lu ni imprimé.
- Seul fichier écrit : ce rapport, **non committé**.
