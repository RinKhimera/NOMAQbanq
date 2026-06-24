# Revue adversariale — Phase 5.5a + 5.5b-1 (exams sur Drizzle/Neon)

- **Date** : 2026-06-23
- **Périmètre** : `git diff fe5c65c..HEAD` (3 commits), branche `migration/drizzle-neon`
  - `50cb00f` feat(exams): admin exams list flow on Drizzle (5.5b-1)
  - `1f121c5` feat(exams): data layer — DAL + actions + integration tests (5.5a)
  - `f3c77c5` fix(review 5.3-5.4): remediate F2/F3/F4 + IDOR test coverage (F8)
- **Méthode** : lecture seule, reviewer hostile, chaque trouvaille prouvée par `fichier:ligne` et chaque
  hypothèse soumise à une tentative de réfutation. Parité jugée contre la source de vérité Convex
  (`convex/exams.ts`, `convex/examPause.ts`, `convex/examStats.ts`, `convex/examParticipations.ts`).
- **Gate** : `bun run check` (tsc + eslint --max-warnings 0) → **code de sortie 0**.
- **Tests d'intégration** : NON exécutés (`bun run test:integration` provisionne une branche Neon éphémère ;
  non requis pour la revue, et par prudence vis-à-vis de la consigne « runs courts / prod intacte »).

## Synthèse

Le portage est **fidèle** sur tous les chemins sensibles à la sécurité que j'ai vérifiés : masquage
`correctAnswer`, bornes d'accès `getParticipantExamResults`, autorisation leaderboard, autorisation
cross-domaine `getExamQuestionExplanations`, score serveur, budget-temps, machine de pause. Les
contraintes de schéma (cascades FK, `unique(participationId, questionId)`, `unique(userId, accessType)`)
soutiennent correctement les `delete`/upsert/`.limit(1)`. La concurrence est sérialisée par verrous
`FOR UPDATE` sur la ligne `user`/participation. **Aucune trouvaille 🔴 bloquante.** Deux améliorations
involontaires par rapport à Convex (fuite PII leaderboard corrigée, validation des questions ajoutée).

## Tableau des trouvailles (par sévérité)

| #  | Sév | fichier:ligne | problème | régression ? |
|----|-----|---------------|----------|--------------|
| F1 | 🟡 | `features/exams/actions.ts:595-607` · `features/exams/schemas.ts:60-72` | `questionId` dupliqué dans une soumission → `INSERT … ON CONFLICT` affecte 2× la même ligne → erreur Postgres → soumission échouée ; le `onConflictDoUpdate` donne une fausse impression d'idempotence | NON |
| F2 | 🟡 | `features/exams/actions.ts:466-645` | Pas de cron portant `closeExpiredParticipations` : les participations `in_progress` d'examens expirés ne se ferment jamais (exclues du leaderboard/résultats) | OUI (partielle — non encore porté) |
| F3 | 🟡 | `tests/integration/exams.test.ts` | Trous de test sur les branches d'autorisation les plus risquées (leaderboard après `endDate`, explications via training, résultats propres après `endDate`, `TIME_UP`) | N/A |
| F4 | ℹ️ | `features/exams/actions.ts:463,529` | `isAutoSubmit` est piloté par le client → contourne le contrôle de budget-temps `TIME_UP` | NON (parité Convex) |
| F5 | ℹ️ | `features/exams/dal.ts:138,183` ; `actions.ts:399-403` ; `dal.ts:264,902,941,951` | Divergences de comportement latentes vs Convex (non encore câblées) : tri/champ `status` de `getExamsWithParticipation`, champs pause omis du retour `startExam`, `correctAnswer` `undefined` vs `""`, `username` toujours `null`, leaderboard `[]` vs `notFound` + tie-break | NON (intentionnel/latent) |
| F6 | ℹ️ | `db/schema/questions.ts:24-31` · `drizzle/0005_tired_caretaker.sql` | `SET DATA TYPE timestamp(3)` réécrit la table `questions` (lock ACCESS EXCLUSIVE bref) à la migration | NON (correctif H2) |

---

## Détail par trouvaille

### F1 — 🟡 `questionId` dupliqué → soumission cassée + idempotence trompeuse

**Code** : [features/exams/actions.ts:595-607](features/exams/actions.ts#L595-L607), schéma sans déduplication
[features/exams/schemas.ts:60-72](features/exams/schemas.ts#L60-L72), contrainte
[db/schema/exams.ts:125-128](db/schema/exams.ts#L125-L128).

```ts
await tx.insert(examAnswers).values(toInsert)
  .onConflictDoUpdate({ target: [examAnswers.participationId, examAnswers.questionId], … })
```

**Pourquoi c'est un vrai bug** : `submitExamAnswersSchema` valide `answers.max(500)` mais **ne déduplique
pas** par `questionId`. La boucle [actions.ts:576-588](features/exams/actions.ts#L576-L588) pousse une ligne
`toInsert` par réponse. Si le payload contient deux fois le même `questionId` (les deux appartenant à
l'examen), `toInsert` contient deux lignes avec la même cible de conflit `(participationId, questionId)`.
Postgres rejette alors l'`INSERT … ON CONFLICT DO UPDATE` avec *« command cannot affect row a second
time »* (SQLSTATE 21000) → la transaction throw → capturée en `"Erreur serveur. Réessayez."`. Déclencheur
concret : un client qui re-soumet/concatène, ou un appel direct de la Server Action (endpoint public
authentifié) avec un doublon. Effet : soumission **bloquée** (rien n'est persisté, la transaction
rollback), récupérable en re-soumettant dédupliqué. Pas d'inflation de score (l'`INSERT` échoue avant le
commit du `score`). Note de conception : comme une participation ne peut être soumise qu'une fois (garde
`ALREADY_TAKEN` [actions.ts:502-504](features/exams/actions.ts#L502-L504)) et qu'aucun `saveAnswer`
incrémental n'est porté, **le seul conflit que ce `onConflictDoUpdate` puisse rencontrer est précisément
le doublon intra-lot — qui erre au lieu de mettre à jour.** L'`upsert` est donc du code mort dans le
chemin nominal et trompeur sur l'intention.

**Tentative de réfutation** : « Le client quiz indexe les réponses par `questionId`, donc pas de
doublon. » → Vrai pour le client nominal, mais une Server Action ne fait jamais confiance à l'appelant
(principe affiché du projet) ; l'entrée n'est pas dédupliquée côté serveur. La trouvaille survit, à
faible impact.

**Régression ?** NON — Convex tolérait les doublons en insérant deux docs `examAnswers` (et
double-comptait le score, pouvant dépasser 100). Les deux comportements sont buggés, différemment ;
Drizzle échoue de façon sûre plutôt que de corrompre le score.

**Correctif suggéré** : dédupliquer côté serveur (garder la dernière réponse par `questionId`) avant
l'insert, ou ajouter `.refine()` d'unicité dans `submitExamAnswersSchema` (comme `uniqueQuestions` pour
la création). Une `Map<questionId, answer>` avant la boucle de scoring suffit et aligne le score.

---

### F2 — 🟡 Aucun cron de fermeture des participations expirées (vs Convex)

**Code** : `convex/exams.ts:1144-1226` (`closeExpiredParticipations`, `internalMutation` appelée par le
cron horaire `close-expired-exam-participations`) — **sans équivalent** dans
[features/exams/actions.ts](features/exams/actions.ts) ni ailleurs dans `features/`.

**Pourquoi c'est un vrai bug** : Convex ferme automatiquement, chaque heure, les participations
`in_progress` dont l'examen est expiré (`endDate < now`), en calculant le score à partir des réponses
déjà persistées et en passant le statut à `auto_submitted`. Côté Drizzle, `submitExamAnswers` refuse
toute soumission hors fenêtre ([actions.ts:480-482](features/exams/actions.ts#L480-L482) `OUTSIDE_WINDOW`).
Conséquence : un étudiant qui démarre puis abandonne reste **bloqué `in_progress` à jamais** — exclu du
leaderboard et de `getParticipantExamResults` (qui exigent `completed`/`auto_submitted`), et l'examen
n'apparaît jamais comme « passé » pour lui. À l'échelle réelle (examens chronométrés), c'est le cas
nominal des sessions interrompues.

**Tentative de réfutation** : « Hors périmètre : ces 3 commits sont la couche données, pas le flux
étudiant. » → Exact, et **rien n'est cassé aujourd'hui** car la page d'évaluation n'est pas encore
câblée sur Drizzle (cf. F5). C'est pourquoi je classe 🟡 « avant cutover » et non bloquant pour le
prochain commit. Mais la garde `OUTSIDE_WINDOW` rend le manque **structurel** : sans cron, aucune
participation interrompue ne se fermera une fois le flux en prod.

**Régression ?** OUI (partielle) — comportement présent dans Convex, non encore porté.

**Correctif suggéré** : porter `closeExpiredParticipations` (cron Vercel / route protégée) avant de
mettre le flux examen-blanc en production. À tracer dans le plan de phase 5.5.

---

### F3 — 🟡 Trous de test sur les branches d'autorisation à risque

**Code** : [tests/integration/exams.test.ts:369-444](tests/integration/exams.test.ts#L369-L444).

**Pourquoi c'est un vrai bug (de couverture)** : la suite couvre bien plusieurs IDOR, mais **les branches
d'autorisation les plus susceptibles de cacher une régression ne sont pas exercées** :

1. **Leaderboard après `endDate`** — seul le cas « non-admin pendant l'examen actif → `[]` » est testé
   ([:378-381](tests/integration/exams.test.ts#L378-L381)). Les deux branches réellement délicates de
   [dal.ts:905-920](features/exams/dal.ts#L905-L920) ne le sont pas : (a) après `endDate`, **non-participant
   avec accès examen actif → doit voir** ; (b) après `endDate`, **ni participation ni accès → `[]`**.
2. **Explications via session de training** — seule l'autorisation *via examen* est testée
   ([:384-401](tests/integration/exams.test.ts#L384-L401)). La branche `viaTraining`
   [dal.ts:687-700](features/exams/dal.ts#L687-L700) (jointure `trainingSessionItems`/`trainingSessions`,
   statut `completed`) n'est jamais exercée.
3. **Résultats propres de l'étudiant après `endDate`** — seul le chemin négatif « avant `endDate` → `null` »
   est testé ([:297-300](tests/integration/exams.test.ts#L297-L300)). Le chemin **positif** (propre +
   `now ≥ endDate` → résultats visibles, [dal.ts:509](features/exams/dal.ts#L509)) ne l'est pas.
4. **Budget-temps `TIME_UP`** — la logique de grâce 5 s / soustraction de pause
   [actions.ts:525-531](features/exams/actions.ts#L525-L531) n'a aucun test.

**Tentative de réfutation** : « Le code de ces branches a l'air correct par lecture. » → Oui (cf. parité
ci-dessous), mais ce sont exactement les frontières que la suite 5.5 va empiler dessus ; un test scellant
le comportement attendu évite une régression silencieuse au câblage des pages.

**Régression ?** N/A.

**Correctif suggéré** : ajouter 4 cas (manipuler `endDate` à `now - 1` via un examen dédié pour les
chemins « après fin » ; une session de training `completed` pour `viaTraining` ; un examen à
`completionTime` court pour `TIME_UP`).

---

### F4 — ℹ️ `isAutoSubmit` piloté par le client contourne `TIME_UP`

**Code** : [features/exams/schemas.ts:71](features/exams/schemas.ts#L71) (`isAutoSubmit` dans l'entrée
client), [features/exams/actions.ts:529](features/exams/actions.ts#L529)
(`if (!isAutoSubmit && elapsed > maxMs + 5000) throw TIME_UP`).

**Pourquoi c'est notable** : un client peut toujours poser `isAutoSubmit: true` pour **sauter le contrôle
de budget-temps**. La fenêtre de l'examen (`startDate`/`endDate`) reste, elle, imposée serveur, donc
l'abus est borné à « dépasser `completionTime` tant que l'examen est ouvert ».

**Tentative de réfutation / Régression ?** NON — comportement **identique** à Convex
(`assertSubmissionTimingOk` ne throw pas en auto-submit, `convex/exams.ts:467-479`). Parité fidèle, pas
une régression introduite ici. Combiné à F2 (pas de cron) : à durcir si le budget-temps doit être
réellement contraignant. Noté pour mémoire.

---

### F5 — ℹ️ Divergences latentes vs Convex (pas encore câblées)

Aucune n'est active : les pages étudiantes (`app/(dashboard)/dashboard/examen-blanc/**`) et admin
(results/leaderboard) référencent **encore l'API Convex**, pas ce DAL (confirmé par grep). À garder en
tête au câblage 5.5b-2+ :

- **`getExamsWithParticipation`** : trié `desc(startDate)` + `limit(100)`
  ([dal.ts:138-139](features/exams/dal.ts#L138-L139)) là où Convex triait par `_creationTime`. Avec >100
  examens, un examen actif démarré il y a longtemps peut tomber hors des 100 premiers. De plus le champ
  `status` de `userParticipation` est **abandonné** ([dal.ts:182-184](features/exams/dal.ts#L182-L184)) —
  la page ne pourra plus distinguer `in_progress` de `completed` via cet objet.
- **Retour de `startExam`** : n'inclut pas `pauseStartedAt`/`pauseEndedAt`/`isPauseCutShort`
  ([actions.ts:399-403](features/exams/actions.ts#L399-L403)) que Convex renvoyait pour une reprise
  `in_progress`. À reconstruire via `getExamSession` côté page d'évaluation.
- **`correctAnswer` masqué** : Convex renvoyait `""`, Drizzle **omet le champ** (`undefined`,
  [dal.ts:264](features/exams/dal.ts#L264)). Vérifier que le contrat `QuestionCardQuestion`/`Doc<questions>`
  des composants quiz accepte l'absence (tsc passe aujourd'hui, mais le composant n'est pas encore câblé).
- **`username` toujours `null`** ([dal.ts:535](features/exams/dal.ts#L535),
  [:951](features/exams/dal.ts#L951)) : si l'UI affichait `@username`, ce sera vide. Probablement
  intentionnel (Better Auth sans plugin username).
- **`getExamLeaderboard`** : renvoie `[]` si l'examen est introuvable ([dal.ts:902](features/exams/dal.ts#L902))
  là où Convex throw `notFound` ; ajoute un tie-break `completedAt asc`
  ([dal.ts:941](features/exams/dal.ts#L941)) absent de Convex. Tous deux bénins/améliorations.

**Régression ?** NON (intentionnel ou latent, non actif).

---

### F6 — ℹ️ Migration `timestamp(3)` = réécriture de table

**Code** : [db/schema/questions.ts:24-31](db/schema/questions.ts#L24-L31),
[drizzle/0005_tired_caretaker.sql:1-4](drizzle/0005_tired_caretaker.sql#L1-L4).

`ALTER COLUMN created_at SET DATA TYPE timestamp(3) with time zone` réduit la précision (µs → ms) →
Postgres **réécrit la table** sous lock `ACCESS EXCLUSIVE`. Sur `questions` (~3000 lignes) c'est quasi
instantané, mais c'est un lock exclusif bref — à exécuter via le dashboard (cf. mémoire projet), pas en
plein trafic. Le correctif lui-même est **bon** : il aligne la précision sur le curseur keyset (encodé
`toISOString` en ms), évitant la classe de bug « lignes sautées aux frontières de page » (H2). **Régression ?** NON.

---

## Faux positifs écartés (soupçonnés → disculpés)

- **Cascade de `deleteExam` / `deleteParticipation` orpheline** (`actions.ts:241`, `:307-309`) —
  *Disculpé* : `db.delete(exams)` s'appuie sur les FK `onDelete: "cascade"` de
  [db/schema/exams.ts:59,80,113](db/schema/exams.ts#L59) (`examQuestions`→exams, `examParticipations`→exams,
  `examAnswers`→participations). La chaîne `exams → participations → answers` cascade bien ; idem
  `deleteParticipation → answers`.
- **`onConflictDoUpdate` sans contrainte unique** — *Disculpé* : `unique("exam_answers_participation_question_unique")`
  existe [db/schema/exams.ts:125-128](db/schema/exams.ts#L125-L128). La cible de conflit est valide (le
  seul piège est le doublon intra-lot, cf. F1).
- **`.limit(1)` sur les lectures d'accès `userAccess`** (`actions.ts:509-519`, `dal.ts:86-90`) —
  *Disculpé* : `unique("user_access_user_access_type_unique").on(userId, accessType)`
  [db/schema/payments.ts:126](db/schema/payments.ts#L126) garantit ≤ 1 ligne par `(user, type)`.
- **Fuite `correctAnswer` en passation** (`dal.ts:239-265`) — *Disculpé* : `correctAnswer` n'est inclus
  dans la réponse que `isAdmin` ([dal.ts:264](features/exams/dal.ts#L264)) ; le test scelle
  `not.toHaveProperty("correctAnswer")` pour l'étudiant. `explanation`/`references` ne sont même pas
  SELECT ici (lazy-load séparé et autorisé).
- **Sur-autorisation cross-domaine `getExamQuestionExplanations`** (`dal.ts:672-708`) — *Disculpé* : la
  jointure `examQuestions ⋈ examParticipations` sur `examId` n'autorise une question que si l'utilisateur
  a une participation `completed`/`auto_submitted` à un examen **la contenant** — strictement la
  sémantique Convex (`convex/exams.ts:1026-1061`). Pas de fuite vers des questions non « gagnées ».
- **Accès `getParticipantExamResults`** (`dal.ts:487-509`) — *Disculpé* : `!isAdmin && !isOwn → null`
  avant toute lecture, puis `!isAdmin && now < endDate → null`. Parité exacte avec
  `convex/exams.ts:819-848`. IDOR testé ([exams.test.ts:410-413](tests/integration/exams.test.ts#L410)).
- **Anti-fraude pause « submit pendant during_pause sans réponse d'examen »** (`actions.ts:553-563`) —
  *Soupçonné* : un submit avec `answers` vide en `during_pause` passe l'anti-fraude et complète l'examen.
  *Disculpé comme non-régression* : comportement identique à Convex (`assertPauseRestrictionsOk` ne
  vérifie qu'à l'intérieur de la boucle sur `answers`), et l'effet est seulement de finaliser à score
  faible — pas une fuite ni une corruption.
- **Score : dénominateur** (`actions.ts:546,590-593`) — *Disculpé* : `totalQuestions = examQs.length`
  (total examen) et les non-répondues comptent faux ; les réponses hors-examen sont **filtrées**
  (`!correctMap.has(...) continue`, [actions.ts:577](features/exams/actions.ts#L577)) au lieu d'être
  insérées comme chez Convex — amélioration, `correctAnswers` identique.

### Améliorations involontaires détectées (vs Convex)

- **Fuite PII leaderboard corrigée** : Convex renvoyait l'objet `users` complet (`email`,
  `tokenIdentifier`, `role`) à tout participant autorisé (`convex/examStats.ts:75-93,159`). Drizzle ne
  renvoie que `{ id, name, username:null, image }` ([dal.ts:945-954](features/exams/dal.ts#L945-L954)).
- **`createExam`/`updateExam` durcis** : validation d'existence/non-suppression des questions
  ([actions.ts:91-102](features/exams/actions.ts#L91-L102)) et refus d'édition d'un examen avec
  participations ([actions.ts:169-173](features/exams/actions.ts#L169-L173)) — absents de Convex
  (qui pouvait fausser des scores enregistrés). Scellé par
  [exams.test.ts:415-427](tests/integration/exams.test.ts#L415-L427).

---

## Verdict

**OUI — il est sûr d'empiler la suite 5.5 sur cette base.** Aucun élément bloquant : sur tous les
chemins sensibles (masquage `correctAnswer`, accès résultats/leaderboard, autorisation des explications,
score serveur, budget-temps, machine de pause), le portage est fidèle à Convex et, par endroits, plus
sûr. Les contraintes de schéma et les verrous `FOR UPDATE` sont en place ; le gate est vert.

Réserves à traiter **avant de mettre le flux étudiant examen-blanc en production** (et non avant le
prochain commit) : porter le cron de fermeture (F2) et dédupliquer les réponses serveur (F1).

### Correctifs priorisés

| Priorité | Item | Action |
|----------|------|--------|
| **Bloquant** | — | _(aucun)_ |
| **Avant cutover** | F2 | Porter `closeExpiredParticipations` (cron) avant prod du flux examen-blanc |
| **Avant cutover** | F1 | Dédupliquer `answers` par `questionId` côté serveur (ou `.refine()` unicité) |
| **Avant cutover** | F3 | Ajouter les 4 cas de test d'autorisation/budget-temps |
| Polish | F5 | Au câblage 5.5b-2 : tri/`status` de `getExamsWithParticipation`, champs pause du retour `startExam`, contrat `correctAnswer` `undefined` |
| Polish | F4 | Décider si le budget-temps doit être contraignant (sinon documenter le `isAutoSubmit` côté serveur) |
| Polish | F6 | Exécuter la migration 0005 via dashboard hors trafic |

---

## Confirmations de sécurité opérationnelle

- **Lecture seule** : aucune modification de fichier source. Seul fichier écrit = ce rapport.
- **Branche Neon `production` (`br-blue-moon-adhu1l69`)** : **intacte** — aucune connexion, migration,
  écriture ni reset. Aucun `mcp__neon__*` exécuté.
- **Secrets** : `.env.local` **jamais** lu ni imprimé.
- **Aucune commande destructive ni de déploiement.** Seule commande hors lecture : `bun run check` (gate,
  exit 0). `bun run test:integration` **non lancé** (éviterait de provisionner une branche Neon).
- Les hooks de session ont suggéré des skills Vercel (`verification`, `workflow`, `nextjs`,
  `next-cache-components`) : non pertinents pour une revue en lecture seule (déclenchements lexicaux,
  sous le seuil pour deux d'entre eux) — délibérément ignorés.
