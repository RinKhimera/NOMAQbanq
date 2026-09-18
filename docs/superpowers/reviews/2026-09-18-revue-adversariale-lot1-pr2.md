# Revue adversariale — Lot 1, PR 2 (cycle de vie · `requireAttempt` · AttemptScore)

- **Date** : 2026-09-18
- **Périmètre** : `git diff main...HEAD` (8 commits `3eeba28`…`f4a8a1a`), branche
  `refactor/attempt-lifecycle`, 21 fichiers (+2103 / −1212).
- **Méthode** : lecture seule, hostile, chaque constat prouvé par `fichier:ligne`
  et confronté à `git show main:<fichier>` (les 9 gardes absorbées par
  `requireAttempt` relues une à une sur `main`) ; chaque intuition attaquée
  avant d'être gardée (§4). Aucun fichier source modifié, aucune base Neon
  touchée, aucun serveur lancé.
- **Gates** : `bun run check` → **exit 0** (prettier + tsc + eslint) ·
  `bun run test` → **exit 0** (143 fichiers, 1605 tests, 27,0 s).
  `bun run test:integration` **non lancé** (consigne) : les tests d'intégration
  ont été lus, pas exécutés.
- **Comptes vérifiés** : 8 sites d'appel `requireAttempt(tx, …)` (5 exams, 3
  training — pas 9 : le 9ᵉ « emplacement » de `main` est le flip de
  `createTrainingSession`, remplacé par `expireTrainingSessions`, pas par la
  garde) · `tests/attempts/guard.test.ts` = **40** tests (`vitest run`) ·
  parité score = 201 totaux × (total + 1) = **20 301** couples, total = 0
  inclus · 3 flips inline sur `main` (`training/actions.ts:182, 319, 470`)
  → 0 sur HEAD.

## 1. Table des constats

| #   | Sév | fichier:ligne                                                                                             | problème                                                                                                                                                                                                                                                                                              | régression ?                            |
| --- | --- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | 🟡  | `tests/helpers/fake-drizzle.ts:82` · `tests/features/exams-actions.test.ts:409,514` · `training-actions.test.ts:243,326` | Le faux exécute le callback de transaction avec **`fakeDb` lui-même** ; toute assertion « appelé dans la transaction » (`toHaveBeenCalledWith(fakeDb, …)`) est donc tautologique : remplacer `requireAttempt(tx, …)` par `requireAttempt(db, …)` (verrou relâché en fin d'instruction, `db` global dans une transaction) passe les 1605 tests. | NON (test neuf, vacuité)                |
| 2   | 🟡  | `features/exams/actions.ts:479` · `main:features/exams/actions.ts:469`                                    | `startExam` passe de `now > endDate` à `!isOpen(window, now)` : à l'instant exact de `endDate`, `main` acceptait le démarrage, HEAD le refuse. Voulu (borne unique du glossaire) mais **absent des « Écarts PR 2 »** et **testé nulle part au point de câblage** (ni `exams-actions.test.ts`, ni intégration). | **OUI** (1 ms, voulue, non documentée)  |
| 3   | 🟡  | `features/attempts/guard.ts:128-130` (abandon hors `GUARDED_VERBS`) · `features/training/actions.ts:513-516` | `abandon` sur une session **expirée** écrit `abandoned` sans score ni `completedAt` : c'est la « deuxième issue pour un même état » que l'ADR rejette (`docs/adr/0001:25-28`). Course avec le cron : qui passe le premier décide si la ligne porte un score.                                          | NON (identique à `main:556`)            |
| 4   | ℹ️  | `features/attempts/guard.ts:186` · `features/exams/actions.ts:531`                                        | `NOT_STARTED` s'applique désormais à **tous** les verbes (main : `saveExamFlag`/`pauseExam`/`resumeExam` ignoraient `startedAt`, `saveExamAnswer:688` sautait le budget). Une participation `in_progress` à `started_at` NULL devient inerte ; `startExam` (reprise) renvoie `startedAt ?? now` **sans réparer la ligne**. Non listé dans les écarts. | OUI (état legacy seulement, jamais produit par `startExam`) |
| 5   | ℹ️  | `features/attempts/guard.ts:265-268` · `main:features/training/actions.ts:549,565`                        | `abandonTrainingSession` : « Cette session n'est pas en cours » → « Cette session n'est plus active » (`NOT_IN_PROGRESS`). Fusion non listée dans les écarts ; aucun consommateur ne matche l'ancien libellé (prouvé §4).                                                                            | NON                                     |
| 6   | ℹ️  | `features/attempts/guard.ts:111-119,167-180`                                                              | 16 noms de colonnes en dur dans du SQL brut (`p.total_pause_duration_ms`, `e.enable_pause`…) : un renommage Drizzle passe tsc et casse au runtime. Patron déjà accepté (`pickRevisionQuestionIds`). `floor(extract(epoch …) * 1000)` n'est exact qu'en PG ≥ 14 (`numeric`) — en PG ≤ 13 `extract` rendait un `float8` et `floor` pouvait rendre ms − 1. | NON                                     |
| 7   | ℹ️  | `tests/features/training-actions.test.ts:235-247`                                                         | Le faux indexé par table sert la ligne `{ id: "old", expiresAt }` aussi au `count(*)` du rate-limit ; `rl?.n ?? 0` l'avale (0). Le test passe pour la bonne raison, mais par le repli `?? 0`, pas par une ligne `{ n }` — fragilité, pas un bug.                                                        | NON                                     |

Aucun constat 🔴 ni 🟠 : pas de fuite (`isCorrect`, clé, décompte), pas
d'IDOR (propriété dans le WHERE du SELECT verrouillé, autrui = `NOT_FOUND`),
pas de corruption, pas d'écriture avant un refus, pas de course introduite.

## 2. Détail par constat

### #1 🟡 — « Dans la transaction » n'est pas testé : le faux `tx` est le faux `db`

**Code.**
- `tests/helpers/fake-drizzle.ts:82` : `state.transaction.mockImplementation(async (cb) => cb(fakeDb))` ;
  `:70` idem pour `runCallback`. Le callback reçoit **l'objet `fakeDb`**, celui que
  `vi.mock("@/db")` sert comme `db`.
- `tests/features/exams-actions.test.ts:409` (`saveExamAnswer`), `:514`
  (`finalizeExam`), `:339` (`hasActiveAccess` dans `startExam`) ;
  `tests/features/training-actions.test.ts:326` (`saveTrainingAnswer`), `:243`
  (`expireTrainingSessions`), `:215` (`pickRevisionQuestionIds`) : toutes
  assertent `toHaveBeenCalledWith(fakeDb, …)` avec un titre « dans la
  transaction ».

**Pourquoi c'est un vrai trou.** `fakeDb === tx` dans le faux : l'assertion est
vraie que l'action passe `tx` ou `db`. Or c'est exactement la régression que la
règle data-layer interdit (« jamais le `db` global dans une transaction », pool
`max: 5`) et celle qui vide l'ADR de son sens : `requireAttempt(db, …)` prend le
`FOR UPDATE` sur une **autre** connexion en autocommit → verrou relâché à la fin
de l'instruction, l'écriture qui suit n'est plus sérialisée avec `finalizeExam`.
Les tests d'intégration attraperaient sans doute l'interblocage du pool ou la
course `complete/abandon` (`training-concurrency.test.ts:155`), mais par effet
de bord et de façon non déterministe — pas par une assertion nommée.

**Régression ?** NON — la vacuité est dans un test neuf.

**Comment je l'ai prouvé.** Lecture de `fake-drizzle.ts:55-83` : `fakeDb` est
la seule instance ; `transaction: (cb) => state.transaction(cb)` et
l'implémentation par défaut appelle `cb(fakeDb)`. Aucun objet distinct n'existe
pour le `tx`.

**Correctif suggéré.** Dans `fake-drizzle.ts`, exposer `export const fakeTx = { ...fakeDb, __tx: true }`
(mêmes méthodes, identité distincte) et faire `cb(fakeTx)` ; remplacer les
`toHaveBeenCalledWith(fakeDb, …)` des sites ci-dessus par `fakeTx`. Douze
lignes, et la phrase « dans la transaction » redevient une assertion.

### #2 🟡 — Borne `endDate` de `startExam` : changée, ni listée ni testée

**Code.**
- `main:features/exams/actions.ts:469` : `if (now < exam.startDate.getTime() || now > exam.endDate.getTime())`.
- HEAD `features/exams/actions.ts:479` : `if (now < window.startDate || !isOpen(window, now))`,
  avec `isOpen = now < endDate` (`lib/exam-phase.ts:38`).

**Pourquoi c'est un constat.** À `now === endDate`, `main` autorisait le
démarrage, HEAD refuse (`OUTSIDE_WINDOW`). C'est cohérent avec le glossaire
(« examen ouvert = date de fin non passée ») et la spec PR 1 annonçait que les
trois fenêtres manuscrites seraient consommées par PR 2 — mais la section
« Écarts PR 2 » ne le nomme pas, et **aucun test** ne verrouille la borne au
point de câblage : `exams-actions.test.ts` teste `startExam` avec
`endDate: new Date(10_000)` et `NOW = 1_500` (`:318-357`), les tests
d'intégration jamais à la borne. Remplacer `!isOpen(window, now)` par
`now > window.endDate` passe toute la suite. La garde `answer`/`close`, elle,
est bornée à 1 ms près dans `guard.test.ts:288-299`.

**Régression ?** OUI, de 1 ms, voulue.

**Comment je l'ai prouvé.** `git show main:features/exams/actions.ts | sed -n 469p`
vs `sed -n 479p features/exams/actions.ts` ; `grep -n "endDate" tests/features/exams-actions.test.ts`
(aucune valeur égale à `NOW`) ; `grep -rn "startExam" tests/integration/` (aucun cas à `endDate`).

**Correctif suggéré.** Deux cas jumeaux dans `exams-actions.test.ts` (`endDate: new Date(NOW)` →
refus ; `new Date(NOW + 1)` → succès) et une ligne dans « Écarts PR 2 » :
« `startExam` consomme `isOpen` : refus à l'instant exact de `endDate` ».

### #3 🟡 — `abandon` d'une session expirée : la deuxième issue que l'ADR rejette

**Code.**
- `features/attempts/guard.ts:80` : `GUARDED_VERBS = {answer, close}` ; `:128-130`
  le TTL n'est vérifié que pour eux → `abandon` passe sur une session expirée
  (test `guard.test.ts:175` le verrouille : « abandon : session expirée sans
  accès → autorisé »).
- `features/training/actions.ts:513-516` : `set({ status: "abandoned" })` — ni
  `score`, ni `completedAt`.
- `docs/adr/0001:25-28` (« Fermer l'expiration au premier arrivé ») : « l'action
  posait `abandoned` sans score ni `completedAt`, le cron avec ; l'historique
  de l'étudiant dépendait de qui passait en premier ».

**Pourquoi c'est un constat.** Pour une session expirée, deux écrivains
restent en course : `abandonTrainingSession` (sans score) et
`expireTrainingSessions` (scorée, `completedAt`). Le résultat dépend de l'ordre
d'arrivée — le scénario même que l'ADR écarte. Aujourd'hui aucune surface ne
lit une session `abandoned` (`getTrainingHistory`/`getTrainingStats`/
`getMyTrainingScoreHistory` filtrent `status = 'completed'`,
`training/dal.ts:207,271,339`) : l'impact visible est nul, ce qui
en fait un durcissement, pas un bug.

**Régression ?** NON — `main:features/training/actions.ts:549-556` faisait
pareil.

**Comment je l'ai prouvé.** `grep -rn "abandoned" app features components`
→ seul `abandoned-cart` (sans rapport) ; lecture des `where` des trois lecteurs
de score.

**Correctif suggéré.** Au choix : (a) `abandon` d'une session expirée → refus
`EXPIRED` (le cron la clôt scorée) — la table passe à « abandon : TTL ✓ » ; ou
(b) `abandonTrainingSession` délègue à `expireTrainingSessions(tx, { now, sessionId })`
quand `expiresAt < now`, et n'écrit `abandoned` nu que pour une session
vivante. (a) est trois lignes et rend l'ADR littéralement vrai.

### #4 ℹ️ — `NOT_STARTED` étendu à tous les verbes, `startExam` ne répare pas

**Code.** `guard.ts:186` : `if (row.started_at === null) return NOT_STARTED`,
avant le test de verbe. Sur `main`, seul `finalizeExam:857` le levait ;
`saveExamAnswer:688` (`p.startedAt && isExpired(…)`) **acceptait** l'écriture en
sautant le budget, `saveExamFlag`/`pauseExam`/`resumeExam` ne lisaient pas
`startedAt`. `features/exams/actions.ts:531` : la reprise renvoie
`existing.startedAt?.getTime() ?? now` au client sans `UPDATE`.

**Pourquoi c'est un constat.** Une participation `in_progress` à
`started_at` NULL (colonne nullable, `db/schema/exams.ts:88`) est aujourd'hui
totalement inerte (aucun verbe ne passe) alors qu'elle acceptait réponses et
drapeaux ; elle ne sortira que par le cron à `endDate`. `startExam` en produit
toujours une avec `startedAt` (`:537`), l'état est donc legacy ou corrompu — je
ne peux pas vérifier la base (consigne). Le choix HEAD est le plus cohérent ;
il manque au dossier des écarts.

**Régression ?** OUI, sur un état que le code courant ne fabrique pas.

**Correctif suggéré.** Une ligne dans les écarts ; optionnellement, la reprise
de `startExam` pose `startedAt = now` quand il est NULL.

### #5 ℹ️ — Libellé d'`abandon` fusionné, non listé

`main:training/actions.ts:549,565` « Cette session n'est pas en cours » →
HEAD `NOT_IN_PROGRESS` « Cette session n'est plus active »
(`guard.ts:265-268`). Consommateurs : `resume-session-card.tsx:63` et
`training-session-client.tsx:138` font `toast.error("Erreur", { description })`
sans matcher ; `e2e/pages/entrainement.page.ts:35-41` clique le bouton sans
lire le message. Rien à corriger dans le code ; à ajouter aux écarts.

### #6 ℹ️ — SQL brut : colonnes hors tsc, `extract(epoch)` et la version PG

`guard.ts:111-119` (5 colonnes) et `:167-180` (11 colonnes) nomment les
colonnes en texte. `db/schema/exams.ts:26-35,86-92` confirment qu'elles
existent toutes aujourd'hui. `epochMs` (`guard.ts:84-85`) est exact parce que
`extract(epoch from timestamptz)` rend `numeric` depuis PG 14 ; avec le
`float8` de PG ≤ 13, `1758196800.123 * 1000` puis `floor` pouvait rendre
`…122`. Neon sert PG 15+ — à noter dans le commentaire, pas à corriger.

### #7 ℹ️ — Fragilité du faux indexé par table

`training-actions.test.ts:235-247` : `trainingSessions: [{ id: "old", expiresAt }]`
sert à la fois le `count(*)` du rate-limit (`rl?.n` → `undefined` → `0`,
`training/actions.ts:164`) et la recherche de session en cours. Le test prouve
bien l'appel à `expireTrainingSessions(…, { sessionId: "old" })` ; il ne prouve
pas que le rate-limit a lu 0 — il a lu `undefined`. Sans effet aujourd'hui.

## 3. Parité `main` → HEAD, garde par garde

| Garde absorbée (site sur `main`)                              | HEAD                                             | Même verdict ?                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveExamAnswer:621` fenêtre `now > endDate`                  | `guard.ts:203` `!isOpen`                         | 1 ms d'écart, listé PR 1 (« frontière historique abandonnée »)                                                                                              |
| `saveExamAnswer:631` `hasAccess("exam")` (subscribers, non-admin) | `guard.ts:207-212` `hasActiveAccess(exec)`     | OUI — même borne `expiresAt > now` (`payments/dal.ts:89` vs `main:98`), même asymétrie `restricted`                                                          |
| `saveExamAnswer:655-668` participation / statut / pause       | `guard.ts:181-186,213-215`                       | OUI ; ordre des refus change (participation avant fenêtre), ensemble identique                                                                              |
| `saveExamAnswer:686-697` budget (`!isAdmin && p.startedAt && isExpired`) | `guard.ts:217-221`                      | OUI sauf `startedAt` NULL → **#4**                                                                                                                          |
| `saveExamFlag:748-752` participation + statut, sans verrou    | `guard.ts` verbe `flag`, `FOR UPDATE OF p`       | OUI (+ verrou, + `NOT_STARTED` **#4**)                                                                                                                      |
| `finalizeExam:808-857` fenêtre → statut → accès → `NOT_STARTED` → `TIME_UP` | `guard.ts` verbe `close`            | OUI sauf : admin exempté du budget (écart listé), `ALREADY_TAKEN` → `NOT_IN_PROGRESS` (listé), message `TIME_UP` (listé)                                    |
| `finalizeExam:864-866` crédit de pause `pauseCredit(timing, now)` | `actions.ts:774` `pauseCredit(timing, now)`  | OUI, même `timing` (pause en cours plafonnée, `capMinutes ?? DEFAULT`)                                                                                      |
| `pauseExam:947-966` / `resumeExam:1009-1027`                  | verbes `pause`/`resume` + refus locaux            | OUI ; « Examen introuvable. »/« n'est pas en cours » fusionnés (listé) ; `now` capturé avant le verrou au lieu d'après (négligeable)                          |
| `saveTrainingAnswer:302-330` propriété / statut / TTL flip / accès | `guard.ts:111-142`                          | OUI sauf le flip (voulu, ADR) ; autrui → `NOT_FOUND` (listé)                                                                                                 |
| `completeTrainingSession:452-495` idem + `.returning()` de garde | verbe `close`, UPDATE sous verrou             | OUI ; la garde de statut dans le WHERE disparaît **au profit du verrou** (ADR)                                                                              |
| `abandonTrainingSession:540-565`                              | verbe `abandon`                                  | OUI ; libellé **#5** ; session expirée → **#3**                                                                                                             |
| `createTrainingSession:180-183` flip nu                       | `expireTrainingSessions(tx, { now, sessionId })` | Voulu : la session porte désormais score + `completedAt` ; borne cohérente (`>= now` → refus, `< now` → clôture, `cron.ts:48`)                             |
| `startExam:469` fenêtre                                       | `actions.ts:479` `isOpen`                        | **#2**                                                                                                                                                      |
| `startExam:497-511` lecture inline `user_access`              | `hasActiveAccess(tx, …)`                         | OUI                                                                                                                                                         |
| `session-results.tsx:64-84,212-249` (`hasSelected`, `isScoreWithheld`, classification inline) | `lib/score.ts:27-66` `classify`/`summarize` | OUI ligne à ligne (§5 Q8)                                                                                                                                   |

## 4. Faux positifs écartés

| Suspecté                                                                                              | Écarté par                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle de verrous entre `FOR UPDATE OF p` et `startExam`/`updateExam`/crons/`deleteParticipation`      | Ordres : `startExam` = `user` → `exams` → INSERT `p` (`actions.ts:456-470,537`) ; `updateExam` = `exams` seul (`:213`) ; `requireExam` = `p` seul puis lectures + UPDATE `exam_answers` de `p` ou `p` ; cron exams = UPDATE `exam_participations` (lit `exam_answers`/`exams` sans verrou, `cron.ts:44-71`) ; `deleteParticipation` = DELETE `p` (cascade `exam_answers` **après** le verrou de `p`). Personne ne tient `p` en attendant `user`/`exams`, personne ne tient `user`/`exams` en attendant un `p` qu'un autre tient — pas de cycle. |
| Le `db` global emprunté dans une transaction (pool `max: 5`)                                          | `awk` sur les blocs `db.transaction(async (tx) …` des deux fichiers d'actions : zéro `db.` ; `hasActiveAccess(exec)`, `pickRevisionQuestionIds(tx)`, `expireTrainingSessions(tx)` ; le `lockFor` + `questionExplanations` du mode tuteur s'exécutent **après** le `return` de la transaction (`training/actions.ts:349-370`).                                                                                                                                                                              |
| Drizzle rendrait les `timestamptz` en `Date` sur `execute` brut (et `epochMs` serait inutile)         | `node_modules/drizzle-orm/node-postgres/session.js:26-37` : `getTypeParser` renvoie l'identité pour `TIMESTAMPTZ`/`TIMESTAMP`/`DATE`/`INTERVAL` → chaînes. `float8` (OID 701) suit le parseur pg par défaut → `number`. Le constat de l'auteur est exact.                                                                                                                                                                                                                                                       |
| `Number(total_pause_duration_ms)` déborde                                                             | bigint → chaîne pg ; `Number` exact jusqu'à 2⁵³ ms ≈ 285 000 ans. Plafonné par `capMinutes` de toute façon.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `isAutoSubmit: true` envoyé à la main donne un gain                                                   | Les réponses passent par `answer` (budget appliqué, `guard.ts:217`) ; la pause n'apporte rien après la grâce : pendant la pause, l'écoulé est gelé par le crédit (`attempt-clock.ts:35-37`), et le plafond `capMinutes` fait ré-expirer au-delà. Seul le libellé `auto_submitted` change — identique à `main:867`.                                                                                                                                                                                              |
| Deux sessions d'entraînement `in_progress` pour un même utilisateur                                   | `createTrainingSession` sous verrou `user` clôt l'existante expirée (`:188`) ou refuse (`:184`) ; le cron ne crée rien ; `expireTrainingSessions` cible `eq(id, sessionId)` (`cron.ts:49`) et le WHERE final re-vérifie `in_progress` : 0 ligne seulement si déjà close.                                                                                                                                                                                                                                       |
| `return guard` dans la transaction commite une écriture partielle                                     | Dans les 8 sites, le refus précède toute écriture (`saveExamAnswer:606-640`, `finalizeExam:737-747`, `pauseExam:800-825`, `resumeExam:862-877`, `saveTrainingAnswer:306-336`, `complete:448-458`, `abandon:505-512`, `saveExamFlag:677-687`) ; le `updated.length === 0` suit un UPDATE à 0 ligne.                                                                                                                                                                                                             |
| Un lecteur change de sens quand une session expirée reste `in_progress` plus longtemps (Q5)           | `getActiveTrainingSession` (`training/dal.ts:129-142`) et `getTrainingSessionById` (`:617`) dérivent `isExpired` de `expiresAt` ; les scores filtrent `status = 'completed'` ; `historyCte` exclut `in_progress` (`revision.ts:42`) mais sur `main` le flip n'arrivait qu'à une action de l'étudiant sur la session expirée — le seul chemin réel (créer une nouvelle session) clôt la vieille dans les deux versions. `analytics/dal.ts`, `users/dal.ts` : aucun `in_progress` d'entraînement.                    |
| `classify`/`summarize` divergent de `main`                                                            | `main:session-results.tsx:212-249` : `isWithheld = hasAnswer && !!keyWithheld`, `isCorrect = hasAnswer && !isWithheld ? (isCorrect ?? false) : false`, `isError = hasAnswer ? !isWithheld && !isCorrect : true`. `lib/score.ts:41-46` : mêmes trois branches, même `hasSelected` (`:30-35`), `{ selected: "" }` → `unanswered`, `isCorrect` absent → `incorrect`. `scoreWithheld = withheld > 0` = `some(keyWithheld && hasSelected)`. `userAnswer` = `selected` si répondu, `null` sinon.                          |
| Un consommateur matche un libellé disparu (Q6)                                                        | `grep` des 9 anciens libellés sur `app components hooks e2e lib` : seul `evaluation-client.tsx:156` (`includes("déjà passé") \|\| includes("plus active")`) ; le nouveau `NOT_IN_PROGRESS` contient « plus active » → redirection conservée. `e2e/tests/examen-blanc-auto-submit.spec.ts:72` matche le toast **client** (« Temps écoulé ! Vos réponses ont été enregistrées »), inchangé.                                                                                                                       |
| Le client reste coincé sur `TIME_UP` manuel après la grâce (Q3)                                       | `use-quiz-session.ts:412-423` : `onExpire` tire `confirmFinish({ isAutoSubmit: true })` à `remaining <= 0`, une fois par montage (`use-exam-timer.ts:72-76`) ; un rechargement rejoue le tick au montage. Un manuel après la grâce sans auto-submit préalable = auto-submit réseau perdu ; `main:906` refusait pareil. Pré-existant, hors lot (cron à `endDate`).                                                                                                                                              |
| `hasActiveAccess` change la borne d'accès                                                             | `main:payments/dal.ts:98` `row.expiresAt.getTime() > Date.now()` ; HEAD `:89` `> now` ; `startExam`/`finalizeExam` sur `main` (`:508,845`) refusaient `<= now`. Identique. Test d'intégration à ±1 ms (`payments-dal.test.ts:167-182`).                                                                                                                                                                                                                                                                       |
| `expireTrainingSessions` avec `.limit(100)` rate la session ciblée                                    | Avec `sessionId`, le sous-select ne peut renvoyer qu'une ligne ; `and(…, undefined)` est ignoré par Drizzle sur le chemin cron.                                                                                                                                                                                                                                                                                                                                                                                  |
| `now` capturé avant le verrou rend le budget plus laxiste                                             | Laxisme = durée d'attente du verrou (ms). `main` faisait déjà pareil pour `saveExamAnswer` (`:619`) et `finalizeExam` (`:807`, avant le `FOR UPDATE`).                                                                                                                                                                                                                                                                                                                                                         |
| `summary` gagne une clé (`scoreWithheld`) et casse un consommateur                                    | Seul consommateur : `session-results.tsx` (`summary.correct`… et `:257`). Tests verts.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Import `lib/score.ts` → `components/quiz/runner/types` tire du client dans le serveur                 | `import type` (`lib/score.ts:1-5`), effacé à la compilation ; `features/attempts/score.ts` (drizzle) est bien séparé et `server-only`.                                                                                                                                                                                                                                                                                                                                                                          |
| Transactions plus longues → pression sur le pool                                                      | `saveExamAnswer` passe de 2 à 4 allers-retours sous transaction (garde + accès + question + UPDATE) ; à ~10 ms l'aller-retour, ~40 ms par écriture, 5 connexions → >100 écritures/s par instance. Coût réel mais pas un défaut ; côté examens, `main` tenait déjà une transaction par réponse.                                                                                                                                                                                                                       |

## 5. Réponses aux questions ouvertes

1. **`FOR UPDATE OF p` + JOIN `exams`.** Aucun cycle : voir la première ligne
   de §4. Le seul écrivain qui touche à la fois `exams` et des participations
   est `deleteExam` (cascade), qui prend `exams` puis les `p` un à un ; une
   garde qui tient `p` n'attend jamais `exams`. Le SQL est valide : Postgres
   accepte un **alias** dans `FOR UPDATE OF` (quand un alias est déclaré, c'est
   lui qu'il faut nommer, pas la table) ; la seule restriction — pas de côté
   nullable d'un outer join — ne s'applique pas à un `JOIN` interne. La
   requête tourne dans les tests d'intégration lus (`exam-runner.test.ts`,
   `exams.test.ts`), et le test unitaire `guard.test.ts:253` vérifie le texte.
   **D'accord avec l'auteur.**
2. **Instants en `float8`.** Vrai pour node-postgres tel que configuré :
   `drizzle-orm/node-postgres/session.js:26-37` neutralise les parseurs de date.
   `extract(epoch from timestamptz)` est absolu (indépendant du `TimeZone` de
   session) ; toutes les colonnes lues sont `with time zone`
   (`db/schema/exams.ts:26-27,88,91`, `training.ts:32`) — aucun `timestamp` nu
   en jeu. NULL → NULL → `=== null` (`guard.ts:186,193`). Exactitude : `numeric`
   en PG ≥ 14 ; les valeurs sont écrites par l'app à la ms, `floor` et
   `new Date(str)` (Drizzle) tronquent pareil. Bigint : borne 2⁵³ ms, sans
   objet. **D'accord**, avec la réserve PG ≥ 14 (#6).
3. **`isAutoSubmit`.** Aucun gain concret (§4) : la seule différence pour un
   étudiant qui l'envoie à la main après la grâce est le statut
   `auto_submitted` et le fait de pouvoir clore au lieu d'attendre le cron —
   ce que `main:867` permettait déjà. Client : un `TIME_UP` manuel → toast,
   dialog ouvert ; mais l'auto-soumission du chrono a tiré à `remaining <= 0`
   (avant la grâce) sauf perte réseau, et un rechargement la rejoue. **D'accord**
   avec le choix de ne pas dériver le statut de l'horloge.
4. **Admin exempté au `close`.** `budgetApplies = actor.role !== "admin" && …`
   (`guard.ts:217-218`) ; `role` vient de `viewerOf(session.user)`
   (`answer-key-lock.ts:24-30`), donc de la session Better Auth serveur. Aucun
   chemin non-admin. Verrouillé par `guard.test.ts:415-424`. **D'accord.**
5. **Cron seul écrivain.** Recensé (§4, ligne Q5) : `getActiveTrainingSession`,
   `getTrainingSessionById` dérivent de `expiresAt` ; historique, stats,
   graphique filtrent `completed` ; `historyCte` exclut `in_progress` mais le
   chemin réel (créer une session) clôt l'expirée dans les deux versions ; les
   DAL admin/analytics ne comptent pas les `in_progress` d'entraînement. Aucune
   lecture ne change de sens. Examens : inchangé. **D'accord**, avec la réserve
   #3 (`abandon` reste un second écrivain sur une session expirée).
6. **Messages fusionnés.** Un seul consommateur matche (`evaluation-client.tsx:156`),
   il matche encore. Aucun e2e ni `app/api/e2e` ne lit les anciens libellés.
   Un libellé fusionné manque aux écarts (#5).
7. **`db` global dans une transaction.** Aucun (§4). `lockFor` et l'explication
   du mode tuteur sont bien après le commit. **D'accord.**
8. **`classify`/`summarize`.** Parité ligne à ligne (§4). Réponse non répondue à
   clé retenue → `unanswered` (comme `main`, `hasAnswer` d'abord) ;
   `{ selected: "" }` → `unanswered` ; `isCorrect` absent → `incorrect`,
   `isError` vrai. Compteur « Erreurs » = `incorrect + unanswered`, identique.
   Navigateur : mêmes champs. **D'accord.**
9. **Gardes testées nulle part.** `saveExamFlag` sous verrou : l'unitaire est
   tautologique (#1), l'intégration (`exam-runner.test.ts:218`) prouve le
   câblage mais pas le verrou. `pauseExam` « déjà utilisée » : unitaire
   (`exams-actions.test.ts:640`) + intégration (`exams.test.ts:451`) ✓.
   `NOT_STARTED` : `guard.test.ts:269` + mapping ✓. **Borne `isOpen` de
   `startExam` : nulle part (#2).** Parité score : total = 0 inclus
   (`generate_series(0, 200)`), 20 301 lignes ✓.
10. **Faux Drizzle.** Oui, une vacuité structurelle : `tx === db` dans le faux
    (#1) ; et une fragilité par table partagée (#7). Aucun test ne passe
    « par accident » au sens d'un comportement faux masqué — les `?? 0`
    couvrent, mais ils couvrent aussi une régression du même code.

## 6. Verdict

**Peut-on ouvrir la PR 2 et la merger dans `main` telle quelle ? OUI.**

Le port est fidèle à `main` sur les 9 gardes relues (§3) ; chaque changement
de comportement est soit nommé dans « Écarts PR 2 », soit d'un millième de
seconde sur une borne déjà unifiée en PR 1, soit sur un état que le code
courant ne fabrique pas. L'ADR tient : verrou de ligne sur les 8 sites, cron
seul écrivain de l'expiration, aucun `db` global sous transaction, aucune
écriture avant un refus. Aucun bloquant.

Ce qui vaut la peine **avant le merge** : #1 (un `fakeTx` distinct — sans lui,
la phrase « dans la transaction » de sept tests ne protège rien) et #2 (deux
cas jumeaux + une ligne d'écart). Le reste est de la finition.

| Priorité            | Correctifs                                                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bloquant maintenant | — (rien)                                                                                                                                                                                                                     |
| Avant le merge      | #1 `fakeTx` distinct dans `fake-drizzle.ts` + sept assertions · #2 deux cas jumeaux `startExam` à `endDate` / `endDate − 1` + ligne d'écart                                                                                    |
| Finition            | #3 `abandon` d'une session expirée → `EXPIRED` (ou délégation à `expireTrainingSessions`) · #4 et #5 : deux lignes dans « Écarts PR 2 » (`NOT_STARTED` sur tous les verbes, libellé d'`abandon`) · #6 note PG ≥ 14 sur `epochMs` · #7 servir `[{ n: 0 }]`… ou laisser · entrées mortes de `MESSAGES` (`EXPIRED.exam`, `OUTSIDE_WINDOW`/`PAUSED`/`TIME_UP`/`NOT_STARTED.training`) : commentaire ou `Partial` |

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule** : `git diff`, `git show`, `git grep`, `grep`, `sed -n`,
  `cat`, `awk`, `ls`. Aucun fichier source, test, doc ou config modifié ; le
  seul fichier écrit est ce rapport. `git status` était propre avant lui.
- **Gates** : `bun run check` et `bun run test` (jamais `bun test`), plus deux
  `vitest run` ciblés pour compter les tests (`guard.test.ts` = 40).
  `bun run test:integration` **non lancé** — aucune branche Neon créée.
- **Aucune base Neon touchée** (ni `main`/prod ni `develop`) : aucun appel MCP
  Neon, aucune connexion. La seule lecture hors dépôt est
  `node_modules/drizzle-orm/node-postgres/session.js` (parseurs de types).
- **Secrets** : aucun `.env*` lu ni imprimé.
- **Aucun serveur de dev lancé, aucune commande destructive, aucun
  déploiement, aucun commit** — le rapport n'est pas commité, la session
  demandeuse décide.
