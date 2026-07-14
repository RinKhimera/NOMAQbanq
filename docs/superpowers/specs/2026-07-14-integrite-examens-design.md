# Spec — Intégrité & sécurité des examens (campagne C2)

- **Date** : 2026-07-14
- **Statut** : IMPLÉMENTÉ le 2026-07-14 (branche `c2-integrite-examens` sur
  `c1-observabilite`) — revue adversariale design passée, constats A/B/C/D/E/F/G/H/I
  intégrés ; gates verts (check + 950 front + 276 intégration)
- **Branche** : `c2-integrite-examens` sur `c1-observabilite` (touche
  `features/exams/actions.ts` déjà modifié par C1 ; milestone commun C1+C2+C3).
- **Origine** : audit du 2026-07-13 — agent sécurité (🔴 fuite examens) + agent
  data-layer (#1 budget-temps, #2 race save, #3 race updateExam, #5 read non
  borné).

## Problème

Cinq failles dans `features/exams`, toutes vérifiées à la source :

1. **🔴 Fuite du contenu d'examen.** `getExamWithQuestions` (`dal.ts:269`) ne
   pose de garde d'audience que pour `restricted` ; pour `subscribers` il
   renvoie l'énoncé + les options de TOUTES les questions à n'importe quel
   utilisateur authentifié (seul `correctAnswer` masqué). La page de passation
   `evaluation/page.tsx` rend ces questions **sans aucune garde** (elle ne
   redirige que si la participation est déjà `completed`). Un utilisateur gratuit
   qui connaît l'`examId` exfiltre l'examen complet ; un abonné lit les questions
   **avant l'ouverture de la fenêtre**. En creusant : le trou touche aussi
   `restricted` (un membre sans participation peut pré-lire via la page
   evaluation, non gardée).
2. **🔴 Budget-temps contournable.** `finalizeExam` saute le contrôle `TIME_UP`
   quand `isAutoSubmit=true` (`actions.ts:817`) — or ce flag vient du client. Et
   `saveExamAnswer` ne vérifie que la fenêtre de dates de l'examen, jamais
   `startedAt + completionTime`. Sur une fenêtre large (jours) avec budget 83 s/q,
   l'étudiant répond des heures puis finalise avec `isAutoSubmit:true` → score
   complet en temps illimité, indiscernable au leaderboard.
3. **🟠 Race `saveExamAnswer`.** Le check `status = 'in_progress'`
   (`actions.ts:638`) et l'`UPDATE examAnswers` (`:656`) sont séparés : une
   finalisation concurrente peut committer le score entre les deux → réponse
   écrite après, incohérente avec le score affiché.
4. **🟠 Race `updateExam` vs `startExam`.** `startExam` verrouille la ligne
   `user` ; `updateExam` ne verrouille rien sur `exams`. Un étudiant démarre
   (crée la participation) entre le `count` d'`updateExam` (lit 0) et son
   delete+réinsert de `examQuestions` → participation sur l'ancien set, examen
   servi avec le nouveau.
5. **🟠 `loadExamQuestionExplanations` non borné.** `questionIds[]` du client
   sans zod ni cap (`actions.ts:56`) ; pour un admin `authorized = requested`
   (`dal.ts:791`) → `inArray` + `fetchImages` sans limite.

## Principe directeur

L'ancre d'autorisation d'une passation est **`startExam`** : c'est le seul
chemin qui vérifie fenêtre + accès + audience et crée la participation
`in_progress`. Toute la campagne renforce cette invariante : on ne rend/écrit du
contenu d'examen que pour une participation `in_progress` valide, et jamais
au-delà du budget-temps.

## Design

### 1. Fuite du contenu d'examen — livraison conditionnelle + garde DAL

⚠️ **La page evaluation est le GUICHET d'entrée**, pas seulement la salle
d'examen : la liste pousse vers `/evaluation` **sans** participation
(`examen-blanc-client.tsx:447`), et c'est le dialog « Règles importantes » de
cette page qui appelle `startExam` (`evaluation-client.tsx:205-215`). Un gate
`notFound` sur l'absence de participation `in_progress` casserait donc tout
démarrage (constat A de la revue). Le remède conditionne la **livraison des
questions**, pas l'accès à la page.

**Primaire — `evaluation/page.tsx`** : la page reste accessible sans
participation. On récupère `getExamSession(examId)` d'abord :

- `completed`/`auto_submitted` → `redirect('…/soumis')` (comportement actuel
  conservé) ;
- `in_progress` → fetch `getExamWithQuestions` + `getExamAnswersForParticipation`
  et livrer les questions ;
- sinon (pas de participation) → rendre `EvaluationClient` avec **`questions=[]`**
  (métadonnées légères pour l'écran de démarrage, AUCUNE question dans le payload
  RSC).

**Client — `evaluation-client.tsx`** : après un `startExam` réussi, ajouter
`router.refresh()` pour que le Server Component re-livre les questions (désormais
`in_progress`). L'état client (`serverStartTime`, dialog fermé) est préservé au
travers du refresh (App Router). Nouvelle invariante : **pas de participation
`in_progress` ⇒ aucune question dans le payload RSC** — ferme la fuite pour
`subscribers`, `restricted` ET le cas pré-fenêtre (car `startExam` garde
fenêtre+accès+audience).

**Défense en profondeur — `getExamWithQuestions`** : pour un non-admin sur un
examen `subscribers`, exiger `hasAccess("exam")` (entitlement actif). Symétrique
avec `startExam` (`actions.ts:475-493`) ; branche `restricted` inchangée. Un
utilisateur sans accès reçoit `null`.

- **Régression E évitée — page détail** : `getExamWithQuestions` renvoyant `null`
  pour un non-abonné, la page détail (`[examId]/page.tsx`) doit rendre la **carte
  paywall** (« Vous devez avoir un accès exam actif ») quand le DAL renvoie
  `null`, PAS `notFound()` — sinon un non-abonné qui suit un lien reçoit un 404
  sec (régression du tunnel d'achat). Les pages admin bypassent (admin).
- **Consommateurs cachés vérifiés** (revue) : evaluation (livraison
  conditionnelle ci-dessus), `[examId]/page.tsx` (détail — paywall préservé), 2
  pages admin (bypass). Tous les personas non-admin des tests d'intégration ont
  un `userAccess` 'exam' seedé → la garde ne casse aucun test existant.

### 2. Budget-temps — garde à l'écriture + finalize

**Primaire — `saveExamAnswer`** : rejeter la réponse quand
`now > startedAt + completionTime·1000 + pauseMs + GRACE`. La pause ACTIVE
interdisant déjà l'écriture (`pauseStartedAt` non nul → `fail`), `pauseMs` = le
cumul figé `totalPauseDurationMs` uniquement (pas de branche pause active — elle
serait morte, constat H). Nécessite d'AJOUTER au SELECT : `exams.completionTime`
et `examParticipations.{startedAt, totalPauseDurationMs}`. `GRACE` = 10 000 ms
(latence réseau du dernier envoi ; distinct du +5 s de finalize). Nouvelle erreur
mappée « Temps écoulé. » (métier, PAS capturée).

**Défense en profondeur — `finalizeExam`** : conserver le recalcul serveur
d'`elapsed` (déjà présent). Comme les réponses hors-temps ne persistent plus, un
`finalizeExam` forgé `isAutoSubmit:true` tardif ne finalise que les réponses
dans les temps → aucun gonflement de score.

### 3. Race `saveExamAnswer` — transaction + verrou participation

Une sous-requête `EXISTS` ne suffit PAS (constat C) : sous READ COMMITTED elle
lit la dernière version committée et ne se met pas en file derrière le
`FOR UPDATE` d'un `finalizeExam` **en vol** → une réponse peut encore committer
entre l'agrégat de score et le commit de finalize. Fermeture complète (idiome
AGENTS.md « verrou de ligne englobant check + écriture ») : envelopper le SELECT
participation + la garde budget-temps + l'`UPDATE examAnswers` dans
`db.transaction`, avec `SELECT … FROM exam_participations … .for("update")` sur
la ligne participation. `finalizeExam` verrouille déjà cette même ligne
(`actions.ts:777`) → les deux se sérialisent : si finalize gagne, le save re-lit
un statut terminal sous le verrou et refuse (« Cette session d'examen n'est plus
active. »). Les lectures immuables (exam, question/correctAnswer) restent hors
transaction.

### 4. Race `updateExam` vs `startExam` — verrou commun

`SELECT id FROM exams WHERE id = ? FOR UPDATE` en TÊTE des deux transactions
(avant toute lecture de participations/questions). Verrou commun sur la ligne
d'examen → les deux se sérialisent. `updateExam` verrouille aujourd'hui la ligne
qu'il lit déjà (`:211`) mais SANS `FOR UPDATE` ; `startExam` verrouille `user`,
pas `exams`. On aligne les deux sur la ligne `exams`.

### 5. `loadExamQuestionExplanations` — cap zod

Schéma `z.array(z.string()).min(1).max(MAX_EXAM_QUESTIONS)` dans l'action wrapper
(dédup gardée par le DAL via `new Set`). **Cap = `MAX_EXAM_QUESTIONS` (500), PAS
100** (constat B) : un examen peut avoir jusqu'à 500 questions (schéma) / 230
(formulaire admin), et « Tout déplier » (`session-results.tsx:232`) envoie tous
les ids en UN appel ; un cap trop bas → `[]` silencieux + ids marqués chargés →
explications définitivement vides. Le cap reste un garde-fou anti-abus
(`inArray` de 500 borné). Entrée hors bornes → `[]` (refus silencieux, parité
`scoreQuizAnswersSchema`).

## Hors scope (YAGNI)

- Contrat HTTP complet du webhook, scoring, découpage `exams/dal.ts` (→ C6/C3).
- Pas de changement du modèle d'audience ni du leaderboard.
- Pas de re-vérification `hasAccess` dans le DAL pour `restricted` (l'audience
  EST l'autorisation — inchangé).

## Tests (intégration Neon, sauf cap = frontend)

- **Fuite (DAL)** : free user → `getExamWithQuestions` (subscribers) = `null` ;
  abonné avec accès → questions.
- **Fuite (livraison)** : la page evaluation ne livre pas de questions sans
  participation `in_progress` (assertion au niveau du Server Component / props :
  `questions=[]` sans participation ; peuplées avec `in_progress`). Les deux
  audiences.
- **Budget-temps** : `saveExamAnswer` au-delà de `startedAt + completionTime +
GRACE` → `TIME_UP`, réponse non persistée ; dans les temps → OK.
- **Attaque #2 bout-en-bout** : réponse hors-temps refusée PUIS
  `finalizeExam({ isAutoSubmit: true })` tardif → le score final N'inclut PAS la
  réponse hors-temps (le scénario d'attaque complet).
- **Race save-vs-finalize (déterministe)** : `finalizeExam` PUIS `saveExamAnswer`
  → save refusé (« session incohérente »). Éviter l'assertion d'ordre sur un
  `Promise.all` (flaky, constat D) ; si concurrence testée, asserter l'invariant
  final `score ≡ computeScorePercent(réponses comptées)`.
- **Race updateExam-vs-startExam** : `Promise.all` → invariant : si une
  participation est créée, ses `examAnswers` correspondent au set effectivement
  servi (pas de mélange ancien/nouveau).
- **Cap zod (frontend)** : schéma accepte 1..500, refuse 0 et 501.
- **Non-régression** : `passation-anti-cheat`, `exam-audience`, `exam-runner`,
  `exams` verts + e2e `examen-blanc*` (la livraison conditionnelle ne doit PAS
  casser le démarrage — vérifier ou adapter les POMs).

## Critères de succès

1. Un utilisateur sans participation `in_progress` ne reçoit AUCUNE question dans
   le payload RSC de la page de passation (mais peut toujours démarrer l'examen).
2. Une réponse enregistrée au-delà du budget-temps est refusée et non persistée,
   quel que soit `isAutoSubmit`.
3. Une réponse concurrente à une finalisation ne s'écrit pas après le score.
4. `updateExam` et `startExam` concurrents ne produisent jamais une participation
   sur un set de questions remplacé.
5. `loadExamQuestionExplanations` borne l'entrée à 100 ids.
6. Gates verts : `bun run check`, `bun run test`, `bun run test:integration`.
