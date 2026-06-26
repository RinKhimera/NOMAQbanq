# Revue antagoniste — Migration Convex→Drizzle, phases 5.3 (questions + quiz) & 5.4 (entraînement)

**Date** : 2026-06-22
**Périmètre** : `git diff db3a9ff..HEAD` (7 commits `dbd77c3` → `fe5c65c`)
**Branche** : `migration/drizzle-neon` (jamais déployée) — Neon `develop`
**Méthode** : lecture seule, hostile, chaque trouvaille prouvée par lecture du code. Aucune écriture DB.
**Statut build** : `bun run check` (tsc + eslint --max-warnings 0) → **exit 0** ✅

---

## 1. Tableau des trouvailles (trié par sévérité)

| #   | Sév.              | Fichier:ligne                                                                                                                                | Problème                                                                                                                                                                                                                                                                                                           | Régression ?            |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| F1  | 🔴 HAUTE (impact) | `features/questions/actions.ts:103`, `features/questions/dal.ts:420,343`                                                                     | Moisson publique de la banque : `scoreQuizAnswers` renvoie `correctAnswer`+`explanation`+`references` pour des **ids arbitraires**, sans auth ni liaison à un quiz émis serveur ; `getRandomQuizQuestions` distribue des ids aléatoires. Combinés → exfiltration de toute la banque + explications par un anonyme. | **NON** — parité Convex |
| F2  | 🟠 MOYENNE        | `features/training/actions.ts:104‑128,164`, `db/schema/training.ts:42`                                                                       | Garde « session déjà en cours » + rate-limit + insert **non atomiques** : 2 requêtes concurrentes créent 2 sessions `in_progress` (ou dépassent 10/h).                                                                                                                                                             | **OUI** vs Convex       |
| F3  | 🟠 MOYENNE        | `features/questions/dal.ts:30,111,144`, `db/schema/questions.ts:24`                                                                          | Keyset questions : curseur encodé en **précision ms** (`Date.toISOString`) vs colonne `created_at` en **µs** (`now()`). Lignes créées dans la même ms (import en masse) **sautées** aux frontières de page. Classe du bug H2 (revue 5.2).                                                                          | **OUI** vs Convex       |
| F4  | 🟠 MOYENNE        | `components/admin/question-browser/question-browser-table.tsx:169‑208`, `…/question-browser-context.tsx:104`, `features/questions/dal.ts:97` | Tri par colonne **cassé** : les en-têtes Question/Domaine/Objectif CMC déclenchent `handleSort` mais le DAL ignore `sortBy` et trie **toujours** par `createdAt`. L'indicateur de tri ment.                                                                                                                        | **OUI** (probable)      |
| F5  | 🟡 BASSE          | `features/training/dal.ts:436‑444`, `features/training/actions.ts:263`                                                                       | `isCorrect` exposé par réponse dans le payload **in-progress** + ré-réponse autorisée → la bonne réponse est dérivable par inspection réseau. (`correctAnswer` lui correctement masqué.)                                                                                                                           | NON — parité Convex     |
| F6  | 🟡 BASSE          | `app/(admin)/admin/questions/_components/question-form-page.tsx:231,255`                                                                     | En édition, **retirer toutes les images** n'est pas persisté : `setQuestionImages` n'est appelé que `if (length > 0)`.                                                                                                                                                                                             | Contexte Phase 7        |
| F7  | 🟡 BASSE          | `features/questions/dal.ts:554`, `…/export-questions-button.tsx:204`                                                                         | Export borné à **5000** silencieusement ; le bouton affiche `totalCount`. Banque > 5000 ⇒ export tronqué sans signal.                                                                                                                                                                                              | Dette (≈ accepté)       |
| F8  | ℹ️ INFO           | `app/(marketing)/evaluation/quiz/page.tsx:208`                                                                                               | Quiz public ne passe pas `showCorrectAnswer={false}` → défaut `true`. Sûr **uniquement** parce que le payload n'inclut pas `correctAnswer`. Fragilité.                                                                                                                                                             | NON                     |
| F9  | ℹ️ INFO           | `question-side-panel.tsx:377`                                                                                                                | Copy « définitivement supprimée / irréversible » alors que `deleteQuestion` est un **soft-delete**.                                                                                                                                                                                                                | Préexistant             |
| F10 | ℹ️ INFO           | `tests/integration/training.test.ts:82,223`, `tests/integration/questions-dal.test.ts:93`                                                    | Trous de couverture : gardes non-admin de `saveTrainingAnswer`/`completeTrainingSession` jamais exercées (tests en admin) ; IDOR cross-user non testé ; test keyset utilise des `createdAt` espacés (ne couvre pas F3).                                                                                            | —                       |

---

## 2. Détail des trouvailles

### 🔴 F1 — Moisson publique de la banque (clé de correction + explications pour ids arbitraires)

**Code.**

- `features/questions/actions.ts:103‑126` — `scoreQuizAnswers` : aucune garde, prend `answers[]` (borné `slice(0,50)` par appel mais **appels illimités**), résout via `getQuizAnswerKey`.
- `features/questions/dal.ts:420‑449` — `getQuizAnswerKey(questionIds)` : `SELECT correctAnswer, explanation, references … WHERE id IN (…) AND deletedAt IS NULL`. Renvoie la clé pour **n'importe quel id non supprimé**, sans vérifier que l'id appartient à un quiz réellement servi à l'appelant.
- `features/questions/dal.ts:343‑406` — `getRandomQuizQuestions` : aucune garde, renvoie `_id` de `count` (1..50) questions aléatoires.

**Pourquoi c'est un vrai bug.** Les deux Server Actions sont des endpoints POST publics. Un attaquant anonyme :

1. appelle `loadRandomQuizQuestions({count:50})` en boucle pour énumérer les `_id` (coupon-collector ≈ quelques centaines d'appels pour ~3000 questions) ;
2. appelle `scoreQuizAnswers` avec ces ids (50/appel) pour récupérer `correctAnswer` + `explanation` + `references`.

Soit **~500 requêtes non authentifiées pour exfiltrer l'intégralité de la banque payante + le contenu pédagogique** — le cœur de la propriété intellectuelle vendue. `getRandomQuizQuestions` ne fuite **pas** `correctAnswer` (vérifié : `QuizQuestionView` n'expose pas le champ, le SELECT ne le lit pas) ; la fuite vient de `scoreQuizAnswers`.

**Régression ?** **NON.** Parité fidèle avec `convex/questions.ts:884` (`scoreQuizAnswers` était une `mutation` publique au comportement identique) et `getRandomQuestions:838`. La version Drizzle **améliore** même légèrement (cap `slice(0,50)` absent côté Convex). **Mais l'impact réel reste élevé** et le code a été réécrit dans ce diff → à traiter avant toute bascule publique.

**Correctif suggéré.** Lier le scoring à un **token de quiz émis serveur** (nonce signé listant les ids effectivement servis par `getRandomQuizQuestions`) et ne corriger/révéler que ces ids ; à défaut, rate-limiter par IP **et** ne pas renvoyer `explanation`/`references` pour des ids hors quiz courant.

---

### 🟠 F2 — `createTrainingSession` : check « session en cours » + rate-limit non atomiques

**Code.** `features/training/actions.ts` : rate-limit `:84‑98`, `hasAccess` `:99`, check `existing in_progress` `:105‑128` — **tous hors transaction** ; seule la paire d'`insert` est dans `db.transaction` `:164‑182`. Schéma `db/schema/training.ts:42‑47` : indexes **non uniques** ; aucun index partiel `UNIQUE(user_id) WHERE status='in_progress'`.

**Pourquoi c'est un vrai bug.** En READ COMMITTED, deux appels concurrents (double-clic, 2 onglets, ou appels directs de l'action) lisent tous deux « pas de session en cours » et un compteur < 10, puis insèrent → **2 sessions `in_progress`** simultanées et/ou léger dépassement du rate-limit. Le bouton client est désactivé pendant `isPending` (`training-config-form.tsx:268`), ce qui réduit mais n'élimine pas (le serveur ne protège pas).

**Régression ?** **OUI.** Sous Convex, `check + insert` vivaient dans une mutation sérialisable (OCC) ; un conflit forçait un retry et la 2ᵉ requête voyait la 1ʳᵉ. **Impact limité / auto-correctif** : `getActiveTrainingSession` (`dal.ts:141`) prend `ORDER BY started_at DESC LIMIT 1` (montre la plus récente) ; le prochain `create` abandonne une session expirée ; expiration 24 h. Pas de fuite, dégât borné à l'état propre de l'utilisateur.

**Correctif suggéré.** Index partiel `CREATE UNIQUE INDEX … ON training_sessions(user_id) WHERE status='in_progress'` + gérer la violation comme « déjà une session » ; ou advisory lock / `SELECT … FOR UPDATE` englobant check+insert dans **une seule** transaction.

---

### 🟠 F3 — Keyset questions : curseur milliseconde vs `created_at` microseconde (saut de lignes)

**Code.** `features/questions/dal.ts:30‑31` `encodeCursor = base64(createdAt.toISOString() + "|" + id)` (ISO = **ms**) ; prédicat `:111‑127` ; `orderBy (createdAt desc, id desc)` `:144‑160`. Schéma `db/schema/questions.ts:24` : `created_at … defaultNow()` → `now()` Postgres = **microsecondes**. Driver `db/index.ts` : `pg` (node-postgres) parse `timestamptz` en `Date` JS (**ms**, µs perdus en lecture).

**Pourquoi c'est un vrai bug.** Le curseur est construit depuis un `Date` (ms) puis renvoyé comme paramètre ms, alors que la colonne porte des µs. Pour la ligne frontière `B` (created_at `…123456` µs), le curseur stocke `…123` (= `…123000` µs après décodage). Le prédicat page suivante `created_at < …123000 OR (= …123000 AND id < B.id)` :

- exclut bien `B` (pas de **doublon**) ;
- mais **saute** toute ligne `R` créée dans la même ms avec µs ∈ (`…123000`, `…123456`) : `R` trie après `B` (devrait être page suivante) mais ne satisfait ni `<` ni `=`.

Donc des questions sont **invisibles** dans le browser admin (« charger plus ») dès que plusieurs partagent une milliseconde. **Training history est SÛR** : `completed_at` provient de `new Date()` (`completeTrainingSession` `actions.ts:328`) → µs = 0 → round-trip exact.

**Régression ?** **OUI** (Convex paginait avec des curseurs opaques exacts). **Latent / à confirmer** : ne se déclenche qu'avec des `created_at` sub-milliseconde — donc surtout en **import en masse via `defaultNow()`** (boucle serrée → dizaines de lignes/ms) ; la création admin une-à-une est quasi sans risque. Si l'import fixe `created_at` explicitement depuis le `_creationTime` Convex (float ms), µs = 0 → **pas** de risque. Le test `questions-dal.test.ts:93` utilise des `createdAt` espacés d'un jour et ne peut donc pas le détecter.

**Correctif suggéré.** Encoder le curseur avec précision complète (sélectionner la colonne en `extract(epoch …)*1e6` ou son texte ISO µs), **ou** garantir `created_at` en précision ms à l'écriture, **ou** ajouter un tiebreaker strictement monotone indépendant de l'horodatage.

---

### 🟠 F4 — Tri par colonne non fonctionnel dans le QuestionBrowser

**Code.** `components/admin/question-browser/question-browser-table.tsx:169‑208` : 4 en-têtes cliquables (`question`, `domain`, `objectifCMC`, `_creationTime`) appellent `handleSort(field)` → met à jour `filters.sortBy`/`sortOrder` (`question-browser-context.tsx:172‑182`). Mais `queryArgs` (`:104‑115`) **n'envoie que `sortOrder`**, pas `sortBy`. Le DAL `getQuestionsWithFilters` (`features/questions/dal.ts:97‑104,144‑160`) n'a pas de paramètre `sortBy` et ordonne **toujours** par `(createdAt, id)`.

**Pourquoi c'est un vrai bug.** Cliquer « Domaine » / « Objectif CMC » / « Question » affiche la flèche de tri sur la colonne **et** inverse l'ordre… par date de création. Les lignes ne sont jamais triées par la colonne demandée : l'indicateur de tri **ment** à l'admin.

**Régression ?** **OUI (probable).** Le commentaire du DAL (`:91‑96`) dit remplacer « searchIndex + 3 chemins d'index », ce qui suggère un tri multi-champs fonctionnel auparavant. Aucun impact data ; fonctionnalité admin cassée + UI trompeuse.

**Correctif suggéré.** Soit implémenter `sortBy` dans le DAL (whitelist colonne → `orderBy` + keyset cohérent par cette colonne), soit retirer les boutons de tri non supportés (ne garder que « Créée »).

---

### 🟡 F5 — `isCorrect` exposé pendant la session (anti-triche, durcissement)

**Code.** `features/training/dal.ts:436‑444` : la map `answers` inclut `{selectedAnswer, isCorrect}` **même si `status` ≠ completed**. `features/training/actions.ts:257‑263` : `saveTrainingAnswer` renvoie `isCorrect` et **met à jour** l'item (ré-réponse autorisée). Bon point : `correctAnswer` est correctement **omis** in-progress (`dal.ts:433` `...(isCompleted ? {correctAnswer} : {})`), et le navigator ne colore que répondu/non-répondu (`question-navigator.tsx:34`, n'utilise pas `isCorrect`).

**Pourquoi c'est (faiblement) un bug.** Un utilisateur peut, par réponses successives à la même question, lire `isCorrect` (toast/état/réseau) jusqu'à tomber juste → dérive la bonne réponse sans qu'elle soit jamais explicitement renvoyée. L'UI ne l'affiche pas, mais le payload/retour le contient.

**Régression ?** **NON** (parité Convex ; `saveTrainingAnswer` renvoyait déjà `isCorrect`). **Durcissement** : omettre `isCorrect` du payload `getTrainingSessionById` quand `status` ≠ completed (symétrie avec `correctAnswer`).

---

### 🟡 F6 — « Supprimer toutes les images » non persisté en édition

**Code.** `app/(admin)/admin/questions/_components/question-form-page.tsx:231‑233` (create) et `:255‑264` (edit) : `setQuestionImages` n'est appelé que `if (imagePayload.length > 0)`. Or la DAL gère parfaitement `images: []` (`actions.ts:296‑304` : `delete` puis insert conditionnel ; schéma `setQuestionImagesSchema` sans `min`).

**Pourquoi c'est un bug.** En édition, vider la liste d'images puis enregistrer **ne supprime pas** les lignes existantes (l'action n'est jamais déclenchée). On ne peut pas retirer la dernière image via le formulaire.

**Régression ?** Contexte Phase 7 (uploaders neutralisés) → impact actuel faible. **Correctif** : appeler `setQuestionImages` aussi avec `[]` en mode édition (ou diff vs état initial).

---

### 🟡 F7 — Export borné à 5000 sans avertissement

`features/questions/dal.ts:554‑598` : `.limit(5000)`, sans pagination. Le bouton affiche `stats.totalCount` (`export-questions-button.tsx:204`). Si la banque dépasse 5000, l'export est **tronqué silencieusement** alors que l'admin croit tout exporter. ~3000 aujourd'hui → OK. **Correctif** : journaliser/avertir en cas de troncature, ou paginer l'export. (Borne explicitement listée comme « connue » côté axes — signalé pour traçabilité.)

---

### ℹ️ F8 / F9 — Fragilités mineures

- **F8** `evaluation/quiz/page.tsx:208‑214` : `showCorrectAnswer` non passé → défaut `true` (`question-card/index.tsx:144`). Sûr uniquement car le payload public n'a pas `correctAnswer` (`getAnswerState` compare alors à `undefined`). Passer `showCorrectAnswer={false}` explicitement (defense-in-depth).
- **F9** `question-side-panel.tsx:377‑380` : « définitivement supprimée / irréversible » pour un **soft-delete** (`actions.ts:240`). Trompeur, sans impact data (peut-être voulu côté UX).

---

### ℹ️ F10 — Validité / couverture des tests d'intégration

Les tests **tournent vraiment contre Postgres** (seul `getCurrentSession`/`requireRole` mockés) et les assertions sont réelles (non tautologiques) — notamment l'anti-triche `getTrainingSessionById` (`training.test.ts:115‑119`, `:163‑167`) et `scoreQuizAnswers` qui **démontre** la moisson F1 (`questions-quiz-dal.test.ts:114‑135`, ids arbitraires acceptés). Trous identifiés :

1. **Tout en admin** (`training.test.ts:82` `beforeEach(asAdmin)`) → l'admin bypasse rate-limit **et** `hasAccess` ; les gardes d'accès non-admin de `saveTrainingAnswer`/`completeTrainingSession` ne sont **jamais** exercées. Seule la création non-admin est couverte (`:223`, bon point).
2. **IDOR cross-user non testé** : toutes les sessions appartiennent au même `USER_ID` ; le prédicat `s.userId !== session.user.id` (writes) n'est jamais déclenché avec un user différent → une régression de propriété passerait inaperçue.
3. **Keyset** : `questions-dal.test.ts:93` espace les `createdAt` d'un jour → ne couvre pas F3 (collision sub-ms). Faux sentiment de robustesse.
4. **Actions** mockent `requireRole`/`requireSession` (la garde elle-même n'est pas testée ici — acceptable si testée ailleurs sur le helper).

---

## 3. Faux positifs écartés (soupçonnés puis disculpés)

- **Bypass admin en lecture de session d'autrui** (`dal.ts:402,505`) — **intentionnel** ; les écritures (`save`/`complete`/`abandon`/`delete`) restent **strictement** owner-only (pas d'`OR admin`). Asymétrie cohérente.
- **Lectures training ne re-vérifient pas `hasAccess`** — voulu : revoir ses sessions passées même après expiration d'accès ; seules les écritures gardent `hasAccess` (`actions.ts:99,236,305`). La page landing gate déjà (`entrainement/page.tsx:17`).
- **Absence de `deletedAt IS NULL` dans les jointures de session** (`getTrainingSessionById`/`Results`) — **correct** : une question historique soft-deleted doit rester visible (FK `restrict` garantit la ligne). À l'inverse, `createTrainingSession`/`getRandom`/`getQuizAnswerKey` filtrent bien `deletedAt` (ne pas servir/scorer une question supprimée).
- **Ponts de type `as never` / `as unknown as Doc<"questions">`** (`training-session-client.tsx:231`, `evaluation/quiz/page.tsx:210`, `training-results-client.tsx:348`) — **runtime sûr** : `QuestionCard` ne lit `correctAnswer` que sous `showCorrectAnswer`/review ; en mode passation `correctAnswer` est `undefined` et jamais affiché (pas de crash, pas de fuite). Forme `images:{url,storagePath,order}` alignée avec `QuestionImageGallery`.
- **Transactions `createQuestion`/`updateQuestion`** (`actions.ts:158‑180,197‑226`) — rollback correct (`throw Q_NOT_FOUND` → annule l'insert/update) ; soft-delete respecté (`isNull(deletedAt)` sur l'update) ; refine `correctAnswer ∈ options` (`schemas.ts:18‑29`) ; upsert explication (`onConflictDoUpdate`).
- **`deleteAllTrainingSessions`** (`actions.ts:417‑441`) — scoping `userId = session` + exclut `in_progress` (pas d'effacement de session active, pas d'IDOR).
- **`hasAccess(type, userId)`** (`payments/dal.ts:74‑93`) — bypass admin **borné** à l'utilisateur de session ; avec `userId` cible, interroge l'entitlement réel (pas de bypass sur le rôle de la cible).
- **`getRandomQuizQuestions` fuit-il `correctAnswer` ?** — **NON** (champ ni sélectionné ni exposé). Confirmé par `questions-quiz-dal.test.ts:77‑83`.
- **`completeTrainingSession` score** — `count(*) filter (where is_correct)` / `questionCount` × 100 arrondi (`actions.ts:309‑324`) ; cohérent avec l'affichage résultats (`session.score`).

---

## 4. Verdict

**Empilable pour 5.5 ? — OUI.** Aucun bug **bloquant nouvellement introduit** dans le contrôle d'accès : les gardes (`requireRole`/`requireSession`/ownership) sont solides, l'anti-triche `correctAnswer`/`explanation` est correctement masqué en cours de session, le typecheck/lint passe. La 5.5 peut se construire dessus.

**Correctifs à planifier (non bloquants pour empiler, mais avant bascule publique) :**

| Priorité                          | Correctif                                                                                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Avant tout déploiement public** | **F1** — empêcher la moisson de la banque (token de quiz signé + rate-limit ; ne pas renvoyer `explanation`/`references` pour ids hors quiz).                                                                                                                               |
| Avant cutover prod                | **F2** — index partiel unique `in_progress` par user (atomicité). **F3** — précision µs du curseur keyset questions (ou garantir `created_at` ms ; **confirmer la stratégie d'import**). **F4** — tri par colonne (implémenter `sortBy` ou retirer les en-têtes trompeurs). |
| Polish / durcissement             | F5 (omettre `isCorrect` in-progress), F6 (clear images), F7 (signal troncature export), F8 (showCorrectAnswer explicite), F9 (copy soft-delete), F10 (tests non-admin + IDOR + keyset µs).                                                                                  |

---

## 5. Confirmations de sécurité opérationnelle

- ✅ `bun run check` lancé → **exit 0** (`tsc --noEmit && eslint --max-warnings 0`).
- ✅ Branche Neon **`production` (`br-blue-moon-adhu1l69`) non touchée** — aucune connexion DB, aucune migration, aucune écriture.
- ✅ `bun run test:integration` **non lancé** (aucune branche Neon éphémère créée).
- ✅ **Aucun fichier modifié** hors ce rapport ; contenu de `.env.local` jamais lu ni imprimé.
- ✅ Revue **lecture seule** : seuls des `Read`/`Grep`/`git diff`/`bun run check` ont été exécutés.
