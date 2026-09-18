# Revue adversariale — score retenu (#180) + nettoyage (#181)

- **Date** : 2026-09-17
- **Périmètre** : `git diff main...HEAD` (2 commits) sur `fix/score-withheld-and-cleanup`
  — `a7fccc4` (#181 nettoyage) et `34b136a` (#180 score retenu).
- **Méthode** : lecture seule, hostile. Chaque constat est prouvé par une
  référence `fichier:ligne` lue sur la branche (ou `git show main:` pour la
  parité). Chaque intuition a été confrontée à une tentative de démenti ;
  celles qui n'ont pas tenu sont en § 4.
- **Gates** : `bun run check` → **exit 0** (prettier, tsc, eslint) ·
  `bun run test` → **exit 0** (140 fichiers, 1 542 tests). Ni
  `test:integration`, ni `test:e2e`, ni `bun dev` lancés.

## 1. Table des constats

| # | Sév | fichier:ligne | Problème | Régression ? |
|---|-----|---------------|----------|--------------|
| 1 | 🔴 | `app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section.tsx:161,180,189` · `features/training/dal.ts:192-214,298-304` · `app/(dashboard)/tableau-de-bord/examen-blanc/_components/examen-blanc-client.tsx:192,207` | Le score « retenu » sur la page de résultats est **affiché tel quel** sur l'historique, la liste d'examens, le dialogue de suppression et les graphiques, avec le même `id` et le même `N`. L'oracle `score × N / 100 − justes affichées` reste ouvert à un clic de la page. #180 n'est pas fermé ; l'entrée « Score retenu » ajoutée à `CONTEXT.md` (« n'est pas restitué ») décrit un comportement que le code n'a pas. | NON (préexistant) — mais le correctif annoncé ne corrige pas |
| 2 | 🟠 | `app/(dashboard)/tableau-de-bord/entrainement/[sessionId]/resultats/page.tsx:68,76` · `…/examen-blanc/[examId]/resultats/page.tsx:79,87` · `components/quiz/results/session-results.tsx:1,49,637` | `score={score}` est passé aux deux composants `"use client"` **même quand `scoreWithheld` est vrai** : la valeur est sérialisée dans le payload RSC (HTML initial, `Ctrl+U`). Le masquage est purement visuel, à rebours de la convention du verrou (blanchiment côté serveur de `correctAnswer` et `isCorrect`). | NON |
| 3 | 🟠 | `features/training/actions.ts:520` · `app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client.tsx:151-160` · `features/exams/actions.ts:891` | `completeTrainingSession` renvoie `correctCount` (total **différées comprises**) au navigateur à la fin de session ; le client ne l'utilise pas. Onglet Réseau → `correctCount − justes affichées` = différées justes, sans même passer par le score. Idem `finalizeExam` (`correctAnswers`). | NON (préexistant) |
| 4 | 🟡 | `components/quiz/results/session-results.tsx:639,660` · `score-withheld.ts:26-30` · `session-results.tsx:270` | La parité corps/en-tête tient par **convention** (deux expressions à maintenir identiques) et `scoreWithheld` est une prop **optionnelle** à défaut `false` : un appelant qui l'oublie retombe silencieusement sur l'ancien comportement, contrairement à la règle du projet « paramètre requis : un oubli casse la compilation ». | NON |
| 5 | ℹ️ | `components/quiz/results/score-withheld.ts:3-5` · `tests/architecture/loading-conventions.test.ts` | Aucun test d'architecture ne garde l'absence de directive sur ce module. Un futur `"use client"` ferait planter les trois pages à l'exécution (référence client appelée comme fonction), invisible à `tsc` et à la suite unitaire. | NON |
| 6 | ℹ️ | `components/quiz/results/session-results.tsx:344,355` · `score-withheld.ts:7-8` | Sur la page de résultats d'**entraînement**, « Score disponible après la clôture de **l'**examen » ne nomme pas l'examen. Pas une fuite (voir Q7), mais un libellé qui suppose un examen unique. | NON |

## 2. Détail par constat

### 1 — 🔴 Le score retenu est servi ailleurs, avec le même `N`

**Code.**
- Historique d'entraînement : `training-history-section.tsx:180` affiche
  `{session.score}%`, `:189` affiche `{session.questionCount} questions`, `:161`
  navigue vers `/tableau-de-bord/entrainement/${session.id}/resultats` — la
  page qui, elle, retient le score et affiche « X sur M questions réussies »
  (`session-results.tsx:355`). Source : `getTrainingHistory`
  (`features/training/dal.ts:192` `score: trainingSessions.score`, `:214`).
- Graphique dashboard : `getMyTrainingScoreHistory` renvoie
  `{ sessionId, score, questionCount }` par session (`features/training/dal.ts:298-304`,
  `:345`), rendu par `training-score-chart-content.tsx:90`.
- Dialogue de suppression : `delete-session-dialog.tsx:106,115` (score + N).
- Examens : la carte « passé » affiche « Votre score {score}% »
  (`examen-blanc-client.tsx:207`) et `{exam.questionCount} questions` (`:192`) ;
  `getMyScoreHistory` (`features/exams/dal.student.ts:1079`) et
  `recent-activity-feed.tsx:154`, `score-evolution-chart-content.tsx:60`.
- Le score en base inclut bien les réponses différées : `saveTrainingAnswer`
  calcule `isCorrect` contre la clé quel que soit le verrou
  (`features/training/actions.ts:349-352`), et les quatre chemins de scoring
  agrègent `count(*) filter (where is_correct)` sans exclusion (Q2).

**Pourquoi c'est un vrai bug.** Le déclencheur est exactement celui de #180 :
l'étudiant lit `67 %` et `3 questions` dans l'historique, ouvre la session,
lit « 1 sur 2 questions réussies » et une tuile « Différées 1 » :
`round(67 × 3 / 100) = 2` justes au total, 1 affichée → la différée est juste.
Le tirage aléatoire d'entraînement **n'exclut pas** les questions verrouillées
(`features/training/actions.ts:199-212`, pas d'`excludeLocked` ; seul le corpus
de révision l'applique, `:188-191`), donc l'étudiant peut rejouer une session
filtrée par domaine jusqu'à retomber sur la question, une option à la fois.
La branche ne change rien à ces surfaces (`git diff main...HEAD` ne touche ni
`training/dal.ts` côté historique, ni `dal.student.ts`, ni ces composants).

**Régression ?** NON — préexistant sur `main`. Mais le commit s'intitule
« fix … (#180) » et `CONTEXT.md:57-63` affirme désormais que le score « n'est
pas restitué tant que l'examen n'est pas clos » : c'est faux pour cinq surfaces.
Le glossaire documente une règle que le code ne tient pas, ce que la règle
« vérifier avant d'affirmer » du projet proscrit.

**Comment je l'ai prouvé.** `grep -rn "\.score" app components` puis lecture
de chaque hit ; `sed -n 155,195p training-history-section.tsx` ;
`sed -n 296,312p features/training/dal.ts` ; `sed -n 180,225p features/training/actions.ts`
(absence d'`excludeLocked` dans le tirage aléatoire).

**Correctif suggéré.** Le « score retenu » doit être une propriété **du
serveur**, pas de la page :
1. Un prédicat SQL `exists (select 1 from training_session_items i join
   exam_questions … join exam_participations … where i.session_id = s.id and
   i.selected_answer is not null and e.end_date > now() and p.user_id = s.user_id)`
   (même forme que `excludeLocked`, `answer-key-lock.ts:137-152`), exposé par
   le module du verrou (ex. `scoreWithheldFor(viewer, sessionIdColumn)`), et son
   jumeau sur `exam_participations`.
2. `getTrainingHistory`, `getMyTrainingScoreHistory`, `getTrainingSessionResults`,
   `getParticipantExamResults`, `getMyScoreHistory`, la liste d'examens et le
   fil d'activité renvoient `score: number | null` (null = retenu) ; les
   agrégats (`getTrainingStats.averageScore`, `domainPerformance`,
   `getMyDashboardStats`) **excluent** les sessions retenues — sinon
   `avg_n × n − avg_{n−1} × (n−1)` redonne le score de la dernière session.
3. Les composants rendent l'état « retenu » quand `score === null`.

Si ce périmètre est jugé trop large pour cette branche : **rétrograder le
commit** en « restitution partielle » (message + `CONTEXT.md`), laisser #180
ouverte avec la liste ci-dessus, et ne pas la fermer à la PR.

### 2 — 🟠 Le score retenu transite quand même dans le payload RSC

**Code.** `session-results.tsx:1` (`"use client"`) ; `SessionResultsProps.score:
number` (`:49`) et `SessionResultsHeaderProps.score: number` (`:637`). Les pages
passent `score={score}` sans condition : entraînement `:68` (en-tête) et `:76`
(corps) ; examen `:79` et `:87` ; admin `:74`. Le `scoreWithheld` calculé à
`:61` / `:72` ne conditionne que la prop booléenne, jamais la valeur.

**Pourquoi c'est un vrai bug.** Toute prop d'un composant client est sérialisée
dans le flight RSC inliné dans le HTML (`self.__next_f.push`). Un étudiant fait
`Ctrl+U`, cherche `"score":`, et obtient la valeur que l'écran lui cache ; puis
la même soustraction qu'en #1. Le verrou blanchit `correctAnswer` **côté
serveur** (`answer-key-lock.ts:81`) et `isCorrect` **côté serveur**
(`features/training/dal.ts:683-685`, `dal.student.ts:618`) précisément pour que
rien ne transite ; ce correctif est le seul maillon du verrou qui masque à
l'affichage et non à la source.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture des trois pages et des deux signatures ;
`grep -n "score={score}"` sur `app/`. Pas de serveur lancé (interdit) : la
preuve est structurelle (prop d'un module `"use client"`).

**Correctif suggéré.** `score: number | null` sur les deux composants, et les
pages passent `scoreWithheld ? null : score` (ou mieux : la DAL renvoie déjà
`null`, cf. #1). Le corps dérive alors `scoreWithheld` de `score === null`,
ce qui règle aussi #4. Le même raisonnement vaut pour `session.score` que
`getTrainingSessionById` renvoie à la passation (`features/training/dal.ts:576`).

### 3 — 🟠 `correctCount` total renvoyé au navigateur à la fin de session

**Code.** `features/training/actions.ts:492-520` : `correctCount` =
`count(*) filter (where is_correct)` sur **tous** les items, puis
`return { success: true, score, correctCount, totalQuestions }`. Consommateur :
`training-session-client.tsx:151-160`, qui ne lit que `success` / `error`.
Même forme dans `finalizeExam` (`features/exams/actions.ts:878-891`).

**Pourquoi c'est un vrai bug.** La réponse de la Server Action est lisible dans
l'onglet Réseau. `correctCount` inclut les différées, la page de résultats
affiche les justes hors différées : la différence est le nombre de différées
justes — plus direct que le score, sans arrondi. C'est le même canal que #180
sous une autre forme. Pour l'examen, l'effet est différé (résultats visibles
après clôture), mais le nombre est conservé par quiconque l'a noté.

**Régression ?** NON (préexistant).

**Comment je l'ai prouvé.** `sed -n 430,525p features/training/actions.ts` ;
`sed -n 140,162p training-session-client.tsx` ; `grep -rn correctCount app components hooks`
→ aucun usage client.

**Correctif suggéré.** Ne renvoyer que `{ success: true }` (YAGNI : le client
redirige vers la page de résultats). Si un test s'appuie sur `score` dans la
réponse, le faire lire la base.

### 4 — 🟡 Parité par convention et prop optionnelle

**Code.** Corps : `scoreWithheld = summary.withheld > 0` (`session-results.tsx:270`),
`withheld` compté sur `hasSelected(entry) && !!q.keyWithheld` (`:197-198,220`).
En-tête : `isScoreWithheld` = `some(q.keyWithheld === true && hasSelected(answers[q._id]))`
(`score-withheld.ts:26-30`), reçu via `scoreWithheld?: boolean` à défaut `false`
(`:639,660`).

**Pourquoi c'est un vrai défaut.** Aujourd'hui les deux expressions sont
équivalentes (voir Q1). Mais rien ne l'impose : le composant ne consomme pas
`isScoreWithheld`, et le test « reflète exactement la condition du composant »
(`SessionResults.test.tsx:257-271`) teste la fonction seule sur trois fixtures,
pas la coïncidence avec le rendu. Et la prop optionnelle contredit la règle
`data-layer.md` adoptée pour `viewer` (« un oubli casse la compilation au lieu
du silence ») : un quatrième appelant de `SessionResultsHeader` qui oublie la
prop affiche trophée/cible sur un score retenu, sans erreur.

**Régression ?** NON.

**Correctif suggéré.** Soit `scoreWithheld` requis, soit (préféré) le corps
appelle `isScoreWithheld(questions, answers)` et l'en-tête reçoit
`score: number | null` (cf. #2) — la parité devient structurelle et la prop
booléenne disparaît.

### 5 — ℹ️ Rien ne garde l'absence de directive sur `score-withheld.ts`

**Code.** `score-withheld.ts:3-5` (commentaire d'intention) ;
`tests/architecture/loading-conventions.test.ts` ne couvre que les conventions
de chargement. Les trois pages (Server Components) appellent la fonction.

**Pourquoi.** Un `"use client"` ajouté par réflexe (le fichier vit sous
`components/`) transforme l'export en référence client ; l'appel dans la page
lève à l'exécution. `tsc` ne le voit pas, la suite unitaire ne rend pas les
pages, l'e2e seul le verrait.

**Correctif suggéré.** Un cas dans `tests/architecture/` : lire
`components/quiz/results/score-withheld.ts` et `components/quiz/runner/types.ts`
et affirmer l'absence de `"use client"` (même mécanique que `loading-conventions`).

### 6 — ℹ️ Libellé « de l'examen » sur l'entraînement

**Code.** `SCORE_WITHHELD_MESSAGE` (`score-withheld.ts:7-8`) rendu à
`session-results.tsx:344`, `title={KEY_WITHHELD_MESSAGE}` à `:340`.

**Pourquoi.** Un étudiant inscrit à deux examens ouverts ne sait pas lequel
retient. Produit, pas sécurité (Q7). Une variante « d'un examen en cours » ou
le titre de l'examen (le verrou ne le renvoie pas aujourd'hui) lèverait
l'ambiguïté.

## 3. Faux positifs écartés

| Suspecté | Écarté par |
|---|---|
| Corps et en-tête divergent sur une forme de `QuizQuestion`/`AnswersMap` (Q1) | `keyWithheld?: true` (`runner/types.ts:19`) ; les pages recopient `q.keyWithheld` depuis `lock.reveal` (`answer-key-lock.ts:81`, `{ keyWithheld: true }` ou rien) ; `AnswerState.selected: string` ; les pages n'insèrent une entrée que si `selectedAnswer` est non vide (`entrainement/…/page.tsx:52`, `examen-blanc/…/page.tsx:63`). `!!x` et `x === true` coïncident sur `true | undefined`, `hasSelected` est partagé. Aucune divergence possible sans cast. |
| Une non-réponse pèse autrement selon le chemin de scoring (Q2) | Lignes pré-insérées pour toutes les questions : `examAnswers` à `startExam` (`exams/actions.ts:558-566`, `selectedAnswer: null, isCorrect: null`), `trainingSessionItems` à la création (`training/actions.ts:227`). Numérateur `count(*) filter (where is_correct)` (NULL non compté) et dénominateur = total des questions dans les quatre chemins : `training/actions.ts:490-501` (`questionCount`), `exams/actions.ts:866-878` (`count(*)` des lignes = questions), `exams/cron.ts:30-62` (`count(*) from exam_questions`), `training/cron.ts:27-60` (`questionCount`). Une différée sans réponse ne dépend pas de la clé → ne pas la retenir est correct. |
| `#181` cache un changement de comportement | `git grep` sur `main` (`app features lib components hooks scripts e2e tests`) : `getSessionForRoute`, `isValidAmount`, `calculateTimeRemaining` n'ont que leur définition et leurs tests ; `TrainingImageView`/`groupImages`/`fetchImages` de `main:features/training/dal.ts:56-127` sont identiques à `features/exams/dal.shared.ts:11-53` (tri `asc(position)`, `kind = "statement"` par défaut, seul le nom du type diffère) ; `getActiveExamAccessCount` (`main:dal.admin.ts:169-181`) et `getExamsStats` (`dal.admin.ts:151-156`) ont le même prédicat `accessType = 'exam' and expiresAt > now`, le même `requireRole(["admin"])`, et le `now` ne diffère que de l'ordre de la microseconde. `admin-exams-client.tsx:18-90` consomme `eligibleCount` inchangé. |
| Un admin consultant ses propres résultats d'un examen ouvert serait verrouillé (Q6) | `getParticipantExamResults` passe `viewerOf(session.user)` (`dal.student.ts:582`), donc le **lecteur** est l'utilisateur de session, pas `userId` ; `lockFor` renvoie `AnswerKeyLock.none()` pour un admin (`answer-key-lock.ts:104-106`) ; `isAdmin` saute le test `endDate` (`:488`). L'admin voit sa clé et son score, comme prévu par « un admin jamais ». |
| Le message « après la clôture de l'examen » révèle qu'une question est dans un examen ouvert (Q7) | Cette information est déjà exposée depuis #179 par le marqueur `keyWithheld` envoyé au client, la tuile « Différées » (`session-results.tsx:414-432`, même `title`) et le statut « Correction différée » de `QuestionCard` (`question-card/index.tsx:245-251`). Le verrou blanchit la **clé**, pas le fait d'être verrouillé ; et une participation est requise pour être verrouillé (`answer-key-lock.ts:118-125`), donc l'étudiant a déjà vu les questions de cet examen. Pas de fuite nouvelle. |
| Canal résiduel sur la page dérivé du `score` (Q3) | « Erreurs (N) » = `incorrect + unanswered` (`session-results.tsx:497`), navigateur = `isCorrect/isAnswered/isWithheld` par réponse (`:227-235`, `results-question-navigator.tsx:23-41`), `QuestionCard` compare `userAnswer` à `correctAnswer` blanchi (`question-card/index.tsx:213-251`). Rien ne lit `score` hors pourcentage, badge, barre, dégradé, icône — tous neutralisés. Le seul résidu est le payload (#2). |
| Les tests passeraient sans le fix | `queryByTestId("score-progress").not.toBeInTheDocument()` passerait sur `main` (testid inexistant), mais le même test exige `getByTestId("score-withheld")` (absent sur `main`) et le jumeau exige la présence de `score-progress` : la paire discrimine. Les tests d'en-tête lisent `data-status`, inexistant sur `main`. |
| Mismatch d'hydratation (`loading-ui.md`) | Le nouveau code est pur (`isScoreWithheld`, `SCORE_STATUS_STYLES`) ; aucun `Date.now()` ni état client ajouté. |
| Le quiz public serait affecté | `app/(marketing)/evaluation/quiz/page.tsx:230` rend `QuizResults`, pas `SessionResults` ; « les trois pages » est exact (`grep -rln SessionResults app`). |
| `now` passé à `getExamsStats` vs `new Date()` de la fonction retirée | Même requête, `cache()` par requête dans les deux cas ; l'écart est infra-milliseconde et non observable. |

## 4. Réponses aux questions ouvertes

1. **Parité de la condition.** Équivalentes à l'exécution, preuve en § 3
   (types + construction des `answers` par les pages). Mais la parité est
   **par convention** et le test ne compare pas au rendu (#4). Je recommande
   de la rendre structurelle en supprimant la prop booléenne au profit d'un
   `score: number | null` venu du serveur (#2).
2. **Différée sans réponse.** Vérifié sur les quatre chemins : lignes
   pré-insérées, `count(*) filter (where is_correct)` ignore NULL, dénominateur
   = total des questions partout (`questionCount` en entraînement, `count(*)`
   des lignes = `count(*) from exam_questions` en examen puisque les lignes
   sont créées au démarrage). Une différée sans réponse ne dépend pas de la clé.
   La justification tient.
3. **Canaux restants.** À l'écran : aucun (§ 3). Dans le payload : **oui**,
   `score` est sérialisé pour les deux composants client quel que soit
   `scoreWithheld` (#2). Ce n'est pas acceptable dans un projet dont le verrou
   blanchit à la source ; c'est un vrai constat, pas une nuance.
4. **Surfaces hors page.** La conclusion « oracle impossible » est **fausse** :
   l'oracle n'a pas besoin que la surface montre les compteurs, il lui suffit
   de montrer le score et `N` pour un `id` que la page de résultats complète
   avec les justes affichées. C'est le cas de l'historique d'entraînement, du
   dialogue de suppression, du graphique de scores, de la carte d'examen passé
   et de `getMyScoreHistory` (#1). La session d'une seule question existe
   (révision : `MIN_QUESTIONS` levé, `schemas.ts:29-38`), mais le corpus de
   révision exclut les verrouillées ; le tirage aléatoire (≥ 5) ne les exclut
   pas et suffit.
5. **Module sans directive.** Sûr aujourd'hui : imports de types uniquement,
   fonction pure, présente dans les deux graphes sans effet de bord (le même
   schéma vaut déjà pour `runner/types.ts` et `KEY_WITHHELD_MESSAGE`). Next
   inclut le module dans le bundle client et dans le graphe serveur ; il n'y a
   rien à dédupliquer. Aucun test ne garde la directive (#5).
6. **Admin.** Confirmé : le lecteur est l'utilisateur de session
   (`dal.student.ts:582`), un admin n'est jamais verrouillé
   (`answer-key-lock.ts:104-106`), y compris sur ses propres résultats d'un
   examen ouvert (`:488` saute `endDate` pour lui).
7. **Message sur l'entraînement.** Pas une fuite : le fait qu'une question soit
   retenue est déjà exposé par #179, et le verrou n'a jamais prétendu le cacher
   (il retient la clé). Défaut de produit mineur (#6, ℹ️) : « l'examen » sans
   nom quand plusieurs sont ouverts.

## 5. Verdict

**NON** — pas en l'état comme correctif de #180.

- `a7fccc4` (#181) est **prêt** : cinq retraits purement mécaniques, vérifiés.
- `34b136a` (#180) neutralise l'affichage mais **pas le canal** : le score
  reste servi par l'historique, la liste d'examens, les graphiques et le
  payload RSC de la page elle-même. L'oracle décrit dans l'issue est encore
  ouvert à un clic, et `CONTEXT.md` affirme le contraire.

Deux sorties possibles, à trancher par la session demandeuse :
- **(a) Compléter** : porter « score retenu » côté serveur (prédicat SQL dans
  le module du verrou, `score: number | null` sur toutes les lectures, agrégats
  excluant les sessions retenues), puis pousser.
- **(b) Rétrograder** : reformuler le commit et `CONTEXT.md` en « restitution
  partielle sur la page de résultats », ne pas fermer #180, lister les canaux
  restants dans l'issue. Mergeable, honnête, mais sans valeur de sécurité.

| Priorité | Correctif |
|---|---|
| Bloquant maintenant | #1 — score retenu côté serveur sur toutes les lectures (ou rétrograder le commit et `CONTEXT.md`) |
| Bloquant maintenant | #2 — ne pas sérialiser `score` quand retenu (`number \| null`) |
| Avant merge | #3 — retirer `correctCount`/`correctAnswers`/`score` des réponses de `completeTrainingSession` et `finalizeExam` |
| Avant merge | #4 — parité structurelle (le corps dérive de la même source que l'en-tête ; prop requise ou supprimée) |
| Finition | #5 — test d'architecture sur l'absence de directive |
| Finition | #6 — libellé « d'un examen en cours » |

## 6. Confirmations de sécurité opérationnelle

- Lecture seule : `git diff`, `git log`, `git show main:…`, `git grep`, `sed`,
  `grep`, `gh issue view`. Aucun `checkout`/`stash`/`reset`, aucun fichier
  source modifié (`git status` propre avant ce rapport).
- Commandes exécutées en plus : `bun run check` (exit 0) et `bun run test`
  (exit 0). Ni `bun test`, ni `test:integration`, ni `test:e2e`, ni `bun dev`.
- Aucune base Neon, aucune branche `br-*`, aucun compte Stripe touché ; aucun
  contenu de `.env*` lu ni imprimé.
- Seul fichier écrit : ce rapport, **non committé**.
