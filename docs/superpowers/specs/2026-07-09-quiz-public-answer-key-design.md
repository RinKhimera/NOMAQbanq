# Spec — Verrouiller la clé de réponse du quiz marketing public (#91)

**Date** : 2026-07-09
**Statut** : validé (brainstorming) ; revue adversariale design du 2026-07-09
triée — architecture confirmée, 5 correctifs d'exécution intégrés (exclusion
coverage, écran d'échec dérivé au rendu, cleanup de test, formatage des docs en
Task 0, purge e2e de `quiz_rate_limits`), oracle d'appartenance documenté en
menace résiduelle
**Issue** : #91 (P0 sécurité)

## Contexte

Le quiz d'évaluation marketing (`app/(marketing)/evaluation/quiz/page.tsx`,
page publique, aucun compte) est servi par deux Server Actions volontairement
sans garde (`features/questions/actions.ts`) :

- `loadRandomQuizQuestions` → `getRandomQuizQuestions`
  (`features/questions/dal.ts`) : tire des questions aléatoires **dans toute
  la banque** (~3000 QCM, pas de pool démo), clamp `1..50` ;
- `scoreQuizAnswers` → `getQuizAnswerKey` (`features/questions/dal.ts:522`) :
  renvoie `correctAnswer` + `explanation` + `references` + images
  d'explication pour un lot de `questionId` **arbitraires** (seul filtre :
  `deletedAt IS NULL`), borné à 50 par appel, **appels illimités**.

Deux attaques (issue #91) :

1. **Anti-triche** : pendant la fenêtre d'un examen ouvert (`endDate > now`),
   POSTer les IDs des questions de l'examen à `scoreQuizAnswers` renvoie la
   clé complète — contournement direct de l'invariant #86/#93
   (`getOpenExamLockedQuestionIds` verrouille tous les canaux authentifiés,
   mais pas ce canal public).
2. **Scraping** : par lots de 50 sans rate-limit, la banque entière (l'actif
   principal) se siphonne clé comprise en ~60 requêtes (+ énumération des ids
   par coupon-collector sur `loadRandomQuizQuestions`).

**Usage légitime observé** (page.tsx) : 1 appel `loadRandomQuizQuestions({
count: 10 })` au montage + 1 appel `scoreQuizAnswers` à la soumission ;
« Recommencer » recharge la page. Le quiz dure ~200 s.

## Portée

Trois mesures complémentaires, plus deux durcissements annexes :

1. **Jeton signé** : `scoreQuizAnswers` ne score que les questions réellement
   servies par `loadRandomQuizQuestions` (liaison HMAC stateless).
2. **Exclusion examens ouverts** : au tirage (SQL) **et** au scoring
   (re-vérification) — variante anonyme du verrou de `features/exams/dal.ts`.
3. **Rate-limit IP** des deux actions publiques (nouvelle table
   `quiz_rate_limits` + helper calqué sur `lib/upload-rate-limit.ts`).
4. Annexes : clamp du tirage réduit à `1..10` ; le client remplace le loader
   infini par un message d'erreur générique quand le serveur refuse.

**Hors scope** : CAPTCHA/BotID, pool de questions démo dédié, généralisation
de `upload_rate_limits`, protection contre un scraping distribué « au rythme
du produit » (résiduel assumé, voir « Menace résiduelle »).

## 1. Jeton de quiz signé

Nouveau module serveur `features/questions/quiz-token.ts`
(`import "server-only"`, `node:crypto`, zéro dépendance) :

```
signQuizToken(questionIds: string[]): string
verifyQuizToken(token: string): Set<string> | null
```

- **Payload** : `{ v: 1, ids: [ids triés], exp }` (`exp` = epoch ms,
  TTL **1 h** — le quiz légitime dure ~200 s, marge ×18).
- **Format** : `base64url(JSON payload) + "." + base64url(signature)`.
- **Signature** : HMAC-SHA256, clé = `env.BETTER_AUTH_SECRET`
  (`lib/env/server.ts`, déjà obligatoire, min 32 caractères — pas de nouvelle
  variable d'env), message = `"quiz-answer-key:" + payloadB64` (séparation de
  domaine : un HMAC forgé pour un autre usage du même secret ne peut pas être
  rejoué ici, et inversement).
- **Vérification** : format 2 segments → recalcul HMAC → `timingSafeEqual`
  (après garde de longueur) → parse JSON → `v === 1`, `exp > Date.now()`,
  `ids` = tableau de strings de longueur ≤ 10. Tout échec → `null`, sans
  distinction de cause.

### Changement d'API des deux actions

```
loadRandomQuizQuestions({ count, domain? })
  → { questions: QuizQuestionView[]; token: string | null }

scoreQuizAnswers({ answers, token })  // token requis
  → QuizScore  (shape inchangée)
```

- `token` est `null` quand `questions` est vide (rate-limit ou banque vide).
- `scoreQuizAnswers` ne score que l'**intersection** `answers ∩ ids du
jeton`. Jeton absent / invalide / expiré → `QuizScore` vide
  (`{ score: 0, totalQuestions: 0, questionResults: [] }`), **sans erreur
  levée ni message différencié** : pas d'oracle sur la raison du refus.
- Validation zod des **deux** entrées publiques (nouveau, dans
  `features/questions/schemas.ts`) : pour le scoring, `answers` borné à 10
  éléments (`questionId` string 1..64, `selectedAnswer` string ≤ 500 ou
  null), `token` string 1..2048 ; pour le tirage, `count` entier et `domain`
  string ≤ 100 optionnel (sans zod, `count: "abc"` → `LIMIT NaN` → 500 après
  consommation du slot). Entrée invalide → `QuizScore` vide / bundle vide.

## 2. Exclusion des questions d'examens ouverts

### Variante anonyme du verrou

Dans `features/exams/dal.ts`, à côté de `getOpenExamLockedQuestionIds`
(qui joint la participation d'un utilisateur — inutilisable ici, l'appelant
est anonyme) :

```
getOpenExamQuestionIds(questionIds: string[]): Promise<Set<string>>
```

Même requête sans la jointure participation : parmi `questionIds`, celles
figurant dans **au moins un examen ouvert** (`exams.endDate > now`), tous
utilisateurs confondus. Une question à la fois dans un examen clos et un
examen ouvert est **verrouillée** (l'examen ouvert prime — pattern témoin
« clos seul » de `tests/integration/exams.test.ts`).

### Au tirage (SQL)

`getRandomQuizQuestions` ajoute au `WHERE` un `NOT EXISTS` (sous-requête
`exam_questions ⋈ exams` avec `endDate > now`). L'exclusion doit être dans le
SQL — pas en post-filtrage — pour que `ORDER BY random() LIMIT n` rende
quand même `n` questions corrigeables. Le quiz marketing reste donc complet
(10 questions avec correction) même pendant un examen.

### Au scoring (re-vérification)

`scoreQuizAnswers` appelle `getOpenExamQuestionIds` sur les ids retenus et
**omet** les questions verrouillées des `questionResults` (même comportement
qu'une clé absente aujourd'hui). Nécessaire malgré l'exclusion au tirage : le
jeton vit 1 h, un examen peut **ouvrir** entre l'émission et la soumission.
Défense en profondeur alignée sur #86/#93 : aucun canal ne sert la clé
pendant la fenêtre.

Conséquence UX assumée (cas rare : examen ouvert pendant les ~200 s du
quiz) : ces questions disparaissent de la correction ; si toutes le sont,
l'écran résultats affiche le message générique d'expiration (voir § Client).

## 3. Rate-limit IP des actions publiques

### Table `quiz_rate_limits`

Dans `db/schema/ops.ts` (+ migration Drizzle via `bun run db:generate`) :

| Colonne       | Type                                         |
| ------------- | -------------------------------------------- |
| `id`          | text PK (`createId()`)                       |
| `key`         | text — hash HMAC de l'IP (jamais l'IP brute) |
| `action`      | text `$type<"load" \| "score">()`            |
| `count`       | integer                                      |
| `windowStart` | timestamptz                                  |

Contrainte `UNIQUE(key, action)`. Pas de FK (appelant anonyme) —
`upload_rate_limits` (FK `user_id`) reste intact.

### Helper `lib/quiz-rate-limit.ts`

- `consumeQuizRateLimit(key, action)` : copie du pattern
  `consumeUploadRateLimit` (fenêtre glissante **1 h**, `INSERT …
onConflictDoNothing` puis `SELECT … FOR UPDATE`, consommation atomique
  AVANT le travail — résistant au TOCTOU et aux appels qui échouent ensuite).
  Limite : **30/h par IP et par action** (légitime = 1 load + 1 score par
  tentative ; marge pour NAT partagés — classes, campus).
- `getClientIpKey()` : `await headers()` → premier élément de
  `x-forwarded-for` (posé par Vercel), sinon `x-real-ip`, sinon `"unknown"`
  (bucket partagé fail-closed, assumé). La clé stockée est
  `HMAC-SHA256(BETTER_AUTH_SECRET, "quiz-ip:" + ip)` tronqué — pas d'adresse
  IP en clair en base (pseudonymisation ; le brute-force IPv4 est déjoué par
  le secret, contrairement à un simple SHA-256).
- `cleanupQuizRateLimits()` : `DELETE … WHERE window_start < now - 24 h`,
  appelé dans le cron existant `app/api/cron/close-expired/route.ts`
  (`Promise.all`) — la table ne croît pas sans borne.

### Application

- `loadRandomQuizQuestions` : consomme `load` en entrée ; refus →
  `{ questions: [], token: null }`.
- `scoreQuizAnswers` : consomme `score` en entrée (avant vérification du
  jeton) ; refus → `QuizScore` vide.

### E2E et dev local (revue 2026-07-09, constat #5)

En local (pas de proxy), toutes les requêtes tombent dans le MÊME bucket IP →
la suite Playwright existante `e2e/tests/evaluation-quiz.spec.ts` (5 loads +
1 score par run) épuiserait 30/h en ~6 runs. Correctif : l'action `reset-exam`
de `app/api/e2e/route.ts` (appelée par `global.setup.ts` en setup ET teardown)
purge intégralement `quiz_rate_limits` (table de compteurs éphémères, base de
dev uniquement — la route répond 404 en prod). Documenté dans
`.claude/rules/e2e-testing.md`.

### Coverage CI

`lib/quiz-rate-limit.ts` est couvert par les tests d'intégration uniquement
(I/O DB, non testable en happy-dom) → l'ajouter au `coverage.exclude` de
`vitest.config.ts`, comme `lib/upload-rate-limit.ts` (même justification). La
marge CI est fine (Functions 81,13 % pour un seuil de 80 %) : sans exclusion,
la CI de la PR tomberait.

## 4. Client (`app/(marketing)/evaluation/quiz/page.tsx`)

- Stocke `{ questions, token }` du load ; renvoie `token` au scoring.
- **Correctif du loader infini** : aujourd'hui `questions.length === 0`
  affiche le spinner pour toujours. Distinguer « chargement » (`null`) de
  « chargé vide » → écran « Le quiz est momentanément indisponible.
  Réessayez plus tard. » + bouton Réessayer (reload). Message identique quel
  que soit le refus (rate-limit, banque vide) — pas d'oracle.
- **Résultats vides** : si `scoreQuizAnswers` rend `totalQuestions === 0`
  alors que le quiz avait des questions → écran « Session expirée —
  recommencez le quiz. » + bouton Recommencer (reload). Couvre jeton expiré,
  rate-limit score, verrouillage total par un examen ouvert entre-temps.
- Correction partielle (certaines questions verrouillées, pas toutes) : les
  manquantes gardent le fallback actuel (`correctAnswer: ""`) — assumé, cas
  rare et borné à la fenêtre d'examen.

## Séquence de `scoreQuizAnswers` (récapitulatif)

1. `safeParse` zod → invalide : `QuizScore` vide.
2. `consumeQuizRateLimit(ipKey, "score")` → refus : vide.
3. `verifyQuizToken(token)` → `null` : vide.
4. `answers` ∩ ids du jeton (et dédup par `questionId`).
5. `getOpenExamQuestionIds(ids)` → retirer les verrouillées.
6. `getQuizAnswerKey(ids restants)` → scorer (logique actuelle).

## Menace résiduelle (assumée)

- Un attaquant patient peut toujours jouer le produit honnêtement : 30
  tirages/h × 10 questions, scorer ce qu'on lui sert → ~300 clés/h/IP au
  mieux, coupon-collector ⇒ plusieurs dizaines d'heures par IP pour la
  banque entière ; multipliable par botnet. Accepté : le but de #91 est de
  fermer l'oracle arbitraire et la fuite d'examen, pas d'atteindre du
  DRM parfait.
- `"unknown"` (aucun header IP) est un bucket partagé de 30/h — en pratique
  Vercel pose toujours `x-forwarded-for`.
- **Oracle d'appartenance** (revue 2026-07-09, constat #6) : un porteur de
  jeton valide peut re-scorer son lot pendant 1 h et déduire, d'une question
  qui **disparaît** de la correction, qu'elle vient d'entrer dans un examen
  ouvert — il apprend un fragment de **composition** d'examen (jamais la
  clé). Portée : uniquement les examens qui OUVRENT pendant la vie d'un
  jeton, sur les ~10 ids du lot (≈ 10/3000 par question). Assumé :
  l'alternative (`QuizScore` vide dès qu'UN id est verrouillé) dégraderait
  le cas légitime pour un gain marginal.

## Tests

### Unitaires (`tests/`, happy-dom — `server-only` déjà stubé par vitest)

`tests/questions/quiz-token.test.ts` (mock `@/lib/env/server` avec un secret
de test) : aller-retour sign/verify ; insensibilité à l'ordre des ids ;
expiration ; payload altéré ; signature altérée ; chaînes malformées
(segments manquants, base64 invalide, JSON invalide) ; `v` inconnu ; > 10
ids refusés.

### Intégration (`tests/integration/`, branche Neon éphémère)

Étendre `questions-quiz-dal.test.ts` (+ fixtures examens ouvert/clos, pattern
de `exams.test.ts` ; mock `next/headers` pour piloter l'IP par test ;
cleanup `quiz_rate_limits` et tables examens dans l'ordre des FK) :

- **Tirage** : question d'un examen ouvert jamais servie ; témoin « examen
  clos seul » servie ; clamp `count: 50` → ≤ 10.
- **Scoring** : jeton valide → clé servie pour une question hors examen
  (quiz marketing fonctionnel — critère d'acceptation) ; ids hors jeton
  omis ; jeton absent/falsifié/expiré → `QuizScore` vide ; question passée
  dans un examen **ouvert après émission** du jeton → omise ; le test
  existant qui démontrait la moisson (ids arbitraires acceptés) passe RED
  puis est inversé en garde.
- **Rate-limit** : 31ᵉ appel refusé (même IP) ; IP différente non affectée ;
  fenêtre expirée → reset (`windowStart` vieilli en DB) ;
  `cleanupQuizRateLimits` purge les lignes > 24 h.

## Fichiers touchés

| Fichier                                        | Changement                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `features/questions/quiz-token.ts`             | nouveau — sign/verify HMAC                                                               |
| `features/questions/schemas.ts`                | + `scoreQuizAnswersSchema`                                                               |
| `features/questions/actions.ts`                | `loadRandomQuizQuestions` (bundle + rate-limit), `scoreQuizAnswers` (séquence ci-dessus) |
| `features/questions/dal.ts`                    | `getRandomQuizQuestions` : `NOT EXISTS` examens ouverts + clamp `1..10`                  |
| `features/exams/dal.ts`                        | + `getOpenExamQuestionIds` (variante anonyme)                                            |
| `db/schema/ops.ts`                             | + table `quizRateLimits`                                                                 |
| `db/migrations/*` (généré)                     | migration `quiz_rate_limits`                                                             |
| `lib/quiz-rate-limit.ts`                       | nouveau — consume + ipKey + cleanup                                                      |
| `app/api/cron/close-expired/route.ts`          | + `cleanupQuizRateLimits()`                                                              |
| `app/api/e2e/route.ts`                         | `reset-exam` purge `quiz_rate_limits` (suite e2e non flakée)                             |
| `.claude/rules/e2e-testing.md`                 | note purge rate-limit quiz dans `reset-exam`                                             |
| `vitest.config.ts`                             | + `lib/quiz-rate-limit.ts` au `coverage.exclude`                                         |
| `app/(marketing)/evaluation/quiz/page.tsx`     | jeton + écrans d'erreur (loader infini corrigé)                                          |
| `tests/questions/quiz-token.test.ts`           | nouveau                                                                                  |
| `tests/integration/questions-quiz-dal.test.ts` | étendu (fixtures examens, jeton, rate-limit)                                             |

## Critères d'acceptation (issue #91)

- [ ] Pendant la fenêtre d'un examen ouvert, `scoreQuizAnswers` ne renvoie ni
      clé ni explication pour les questions de cet examen (tirage + scoring).
- [ ] Les deux actions publiques sont rate-limitées (30/h/IP/action).
- [ ] Tests d'intégration : question d'examen ouvert exclue du scoring ;
      question hors examen toujours servie.
- [ ] `bun run check` et `bun run test` passent (jamais `bun test`).
