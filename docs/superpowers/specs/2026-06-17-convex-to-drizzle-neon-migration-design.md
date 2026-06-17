# Migration Convex → Better Auth + Drizzle + Neon — Design & plan

> Statut : **spec révisée après audit défensif (code-vérifié), en attente de relecture finale**.
> Aucun code applicatif n'est écrit avant approbation. Branche git dédiée, migration strangler.
>
> Date : 2026-06-17 · Stack cible : Next.js 16 (App Router) · React 19 · Better Auth · Drizzle ORM ·
> Neon Postgres (projet `Nomaqbanq`, pg 18) · Vercel (Fluid Compute) · Bunny CDN · Stripe.

## 1. Objectif

Sortir de Convex vers une stack **requête/réponse possédée** (SQL réel, migrations versionnées) en
**profitant de la migration pour rationaliser l'architecture des données**. Exigences fortes :

1. **Relations propres** (FK réelles, pas d'`array of IDs` dans des documents).
2. **Pas de « gros documents »** : une lecture de liste ne charge jamais les colonnes lourdes
   (explications, images).

Migration **incrémentale (strangler)** : Convex reste vivant jusqu'à la bascule finale ; on retire
`convex/` à la toute fin.

## 2. Décisions actées

| # | Sujet | Décision |
|---|---|---|
| D1 | Méthodes d'auth Clerk | **Google OAuth + email/mot de passe** |
| D2 | Hébergement | **Vercel** (Fluid Compute) + **Neon** |
| D3 | Agrégats | **COUNT/EXISTS indexés** → suppression des 3 tables d'agrégats (+ cache sur hot paths publics) |
| D4 | Degré de redesign | **Redesign sélectif** (normaliser, splitter, drop agrégats) |
| D5 | Driver DB | **Un seul `pg` Pool (node-postgres)** au scope module (Vercel Fluid Compute) ; HTTP driver écarté |
| D6 | Participation examen | **`UNIQUE(exam_id, user_id)`** (dédupliquer avant d'appliquer la contrainte) |
| D7 | Soft-delete | **users** (soft-delete + anonymisation) · **questions** (archivage soft) · **exams** (`is_active`) |
| D8 | IDs | **Réutiliser l'`_id` Convex comme PK `text`** → FK migrées sans id-map |
| D9 | Entraînement | **Refait en 2 tables** : `training_sessions` + `training_session_items` (items créés au démarrage) ; sessions `in_progress` **abandonnées** à la bascule (non migrées) |
| D10 | Bascule | **Fenêtre de maintenance finale** + **dev-first** : tout sur la branche Neon `develop`, puis `production` une fois validé |

## 3. Architecture cible

### 3.1 Stack, driver, branches Neon

- **Un seul client DB** `db/index.ts` : `drizzle-orm/node-postgres` + `pg.Pool({ max: 5 })` au scope
  module, réutilisé entre requêtes (Vercel Fluid Compute réutilise les instances). Sert **lectures
  (DAL)**, **écritures (Server Actions)** et **Better Auth**. `db.transaction(...)` natif.
- Sur Vercel : `attachDatabasePool(pool)` (`@vercel/functions`).
- **Deux URLs Neon** : `DATABASE_URL` **poolée** (`-pooler`) pour le runtime ; `DATABASE_URL_UNPOOLED`
  **directe** pour `drizzle-kit` + scripts d'import.
- ⚠️ **Gotcha PgBouncer** : la connexion poolée (mode transaction) casse les **prepared statements
  nommés** → éviter `db.prepare()` sur le client poolé (sinon utiliser la connexion directe).
- **Branches Neon (dev-first)** : développement et import de répétition sur **`develop`**
  (`br-restless-morning-ad4uyo3t`) ; **`production`** (`br-blue-moon-adhu1l69`, défaut) **à protéger**
  et intouchée jusqu'à la bascule. Branche de restauration créée juste avant la bascule (instant
  restore ; penser à étendre la rétention d'historique, 6 h par défaut).
- **Zscaler/SSL** : `NODE_EXTRA_CA_CERTS` vers `zscaler-root-ca.pem` avant les commandes Neon/drizzle-kit.

### 3.2 Pagination

Les curseurs Convex sont opaques → **keyset pagination** dans la DAL (clé composite
`(created_at, id)` pour départager les ex æquo ; `_creationTime` n'est plus disponible comme tri
implicite). Offset acceptable pour les petites listes admin.

### 3.3 Structure de fichiers

```
db/
  index.ts                 # client pg Pool unique (+ attachDatabasePool)
  schema/
    enums.ts · auth.ts · questions.ts · exams.ts · training.ts · payments.ts · ops.ts
drizzle/                   # migrations versionnées
lib/
  auth.ts · auth-client.ts · auth-guards.ts · permissions.ts
  env/server.ts            # validation env (zod)
  ids.ts                   # createId()
  dal/                     # Data Access Layer (server-only) — lectures
app/
  api/auth/[...all]/route.ts
  api/webhooks/stripe/route.ts
  api/upload/{avatar,question-image}/route.ts
  api/cron/{close-expired-exams,close-expired-training}/route.ts
  actions/                 # Server Actions ('use server') — écritures
scripts/import-from-convex.ts
proxy.ts                   # Next 16 (ex-middleware)
vercel.json | vercel.ts    # déclaration des crons
```

> ⚠️ Le CLI Better Auth a généré le schéma dans `lib/auth-schema.ts` mais `drizzle.config.ts` pointe
> sur `./db/schema/**`. **Action** : déplacer → `db/schema/auth.ts` + corriger l'import de `lib/auth.ts`.

## 4. Schéma cible (Drizzle / Postgres)

PK `text` (= `_id` Convex réutilisé) · `snake_case` mappé `camelCase` TS · `created_at`/`updated_at`
partout · FK réelles avec `onDelete` explicite · **toutes les lectures de listes projettent les
colonnes** (jamais `SELECT *`).

### 4.1 Enums (`db/schema/enums.ts`)

`user_role`(admin,user) · `product_code`(exam_access, training_access, exam_access_promo,
training_access_promo, premium_access) · `access_type`(exam,training) ·
`transaction_type`(stripe,manual) · `transaction_status`(pending,completed,failed) ·
`currency`(CAD,XAF) · `exam_participation_status`(in_progress,completed,auto_submitted) ·
`exam_pause_phase`(before_pause,during_pause,after_pause) ·
`training_status`(in_progress,completed,abandoned) · `upload_type`(avatar,question-image)

### 4.2 Auth (`db/schema/auth.ts`) — Better Auth, étendu

**`user`** (réutilise `_id`) — `id` PK · `name` · `email` (unique) · `email_verified` · `image?` ·
**`role`** (user_role, défaut `user`) · `banned?` · `ban_reason?` · `ban_expires?` · `username?`
(unique) · `bio?` · `avatar_storage_path?` · **`deleted_at?`** · **`anonymized_at?`** · `created_at` ·
`updated_at`. Index : email (unique), username (unique), role.
- `role`/`banned`/`ban_*` = **plugin admin** → déclarer en `additionalFields` dans la config.
- On abandonne `token_identifier`/`external_id` (Clerk).
- **Anonymisation RGPD** : poser `anonymized_at`, scrubber `name`/`bio`/`image`/`username`, et
  remplacer `email` par un **placeholder unique** (`deleted-{id}@anonymized.invalid`) — `email`/`username`
  étant `unique notNull`.

**`session`**, **`account`**, **`verification`** : standard Better Auth.
**`rate_limit`** : `id` · `key` · `count` · `last_request` (bigint) — requis (`rateLimit.storage:'database'`).

### 4.3 Content (`db/schema/questions.ts`)

**`questions`** (réutilise `_id`) — `id` PK · `question` · `correct_answer` · `options` (**jsonb**,
4-5 chaînes) · `objectif_cmc` · `domain` · **`deleted_at?`** (archivage) · `created_at` · `updated_at`.
- Index : `domain`, `objectif_cmc`.
- **Full-text** : colonne générée `search_vector tsvector GENERATED ALWAYS AS
  (to_tsvector('french', question)) STORED` + **index GIN** (remplace le `searchIndex` Convex).
- **`has_images`** : dérivé via `EXISTS(question_images)` (booléen maintenu seulement si besoin perf).
- **`hasImagesComputed` supprimé.**
- **Règle DAL** : toute lecture de **sélection** (création examen, config training, browser) filtre
  `deleted_at IS NULL` ; la **revue historique** résout par `id` (questions archivées incluses).

**`question_explanations`** (1:1) — **PK = `question_id`** (FK CASCADE) · `explanation` ·
`references?` (jsonb). Sort la colonne lourde des listings.

**`question_images`** (remplace `images[]`) — `id` PK · `question_id` (FK CASCADE) · `url` ·
`storage_path` · `position` · `created_at`. Index : `question_id`.

### 4.4 Exams (`db/schema/exams.ts`)

**`exams`** — `id` PK · `title` · `description?` · `start_date` (timestamptz) · `end_date` ·
**`completion_time` (int, SECONDES** — 83 s/question) · `enable_pause` (défaut false) ·
`pause_duration_minutes?` · `is_active` (défaut true) · `created_by` (FK → user `RESTRICT`) ·
`created_at` · `updated_at`. Index : is_active, start_date, end_date, (is_active,start_date), created_by.
**`question_ids[]` supprimé.**

**`exam_questions`** (jonction ordonnée, **template partagé de l'examen**) — `exam_id` (FK CASCADE) ·
`question_id` (FK → questions `RESTRICT`) · `position`. **PK (`exam_id`,`question_id`)** · **UNIQUE
(`exam_id`,`position`)** · index `question_id`.

**`exam_participations`** — `id` PK · `exam_id` (FK CASCADE) · `user_id` (FK CASCADE) · `score` (int,
défaut 0) · `status` (défaut in_progress) · `started_at?` · **`completed_at?`** (null tant que non
soumis — l'import convertit l'ancien `0 → NULL`) · `pause_phase?` · `pause_started_at?` ·
`pause_ended_at?` · `is_pause_cut_short?` · `total_pause_duration_ms?` (bigint) · `created_at`.
**UNIQUE (`exam_id`,`user_id`)** (D6). Index : exam, user, status. *(Scoring = `correct_answer ===
selected_answer`, texte exact ; pause 100 % serveur, multi-onglets sûr.)*

**`exam_answers`** — `id` PK · `participation_id` (FK CASCADE) · `question_id` (FK RESTRICT) ·
`selected_answer` (texte) · `is_correct` · `is_flagged` (défaut false) · `created_at`. **UNIQUE
(`participation_id`,`question_id`)** · index participation, question.

### 4.5 Training (`db/schema/training.ts`) — **refait (D9)**

Modèle à 2 tables (vs `training_participations` + `trainingAnswers` éclatés). Pas de template partagé
(tirage aléatoire **par session**) → 2 tables suffisent.

**`training_sessions`** — `id` PK · `user_id` (FK CASCADE) · `status` (training_status) · `domain?`
(filtre utilisé) · **`objectif_cmc?`** (filtre utilisé — récupéré) · `question_count` (int) ·
`score?` (int 0-100, null tant que non complété) · `started_at` · `completed_at?` · `expires_at` ·
`created_at` · `updated_at`. Index : (user,status), (user, started_at desc), status,
**(status, expires_at)** (cron).

**`training_session_items`** (une ligne par question sélectionnée, **portant sa réponse optionnelle**)
— `id` PK · `session_id` (FK CASCADE) · `question_id` (FK RESTRICT) · `position` · `selected_answer?`
(null tant que non répondu) · `is_correct?` (null tant que non répondu) · `answered_at?`. **UNIQUE
(`session_id`,`question_id`)** · **UNIQUE (`session_id`,`position`)** · index session_id, question_id.

> **Comportement** : les N `items` sont créés **au démarrage** (preserve sélection + ordre +
> non-répondues) ; répondre = `UPDATE` de l'item ; `score = COUNT(is_correct) / question_count`.

### 4.6 Payments (`db/schema/payments.ts`)

**`products`** — `id` PK · `code` · `name` · `description` · `price_cad` (int cents) · `duration_days`
· `access_type` · `stripe_product_id` · `stripe_price_id` · `is_active` · `is_combo` (défaut false) ·
`created_at` · `updated_at`. Index : code (unique), stripe_product_id, is_active.

**`transactions`** — `id` PK · `user_id` (FK → user **`RESTRICT`**) · `product_id` (FK RESTRICT) ·
`type` · `status` · `amount_paid` (int) · `currency` · `stripe_session_id?` ·
`stripe_payment_intent_id?` · **`stripe_event_id?` (UNIQUE — idempotence webhook)** · `payment_method?`
· `recorded_by?` (FK → user **`SET NULL`**) · `notes?` · `access_type` · `duration_days` ·
`access_expires_at` · `created_at` · `completed_at?`. Index : userId, stripeSessionId, stripeEventId
(unique), status, type, (userId,accessType), createdAt, (status,createdAt).

**`user_access`** — `id` PK · `user_id` (FK CASCADE) · `access_type` · `expires_at` ·
`last_transaction_id` (FK → transactions RESTRICT) · `created_at` · `updated_at`. **UNIQUE
(`user_id`,`access_type`)** · index userId, expires_at.

### 4.7 Ops (`db/schema/ops.ts`)

**`upload_rate_limits`** — `id` PK · `user_id` (FK CASCADE ; remplace `clerk_id`) · `upload_type` ·
`count` · `window_start`. **UNIQUE (`user_id`,`upload_type`)**. *Non migré (éphémère).*

### 4.8 Tables supprimées

`question_stats`, `objectif_cmc_stats`, `exam_participation_stats` (→ COUNT/EXISTS indexés) ·
`migrations` (→ drizzle-kit) · `training_participations`/`trainingAnswers` (→ remplacés par D9).

## 5. Migration des données

### 5.1 Mécanique

1. Convex **read-only** (fenêtre de maintenance). `npx convex export --path convex-snapshot.zip`.
2. `scripts/import-from-convex.ts` (Bun, `DATABASE_URL_UNPOOLED`), **dans l'ordre des FK** :
   `user → products → questions → question_explanations → question_images → exams → exam_questions →
   transactions → user_access → exam_participations → exam_answers → training_sessions →
   training_session_items`.
3. Mapping : `_id`→PK `text` · `_creationTime`(ms)→`created_at` · **`completedAt === 0 ? null`** ·
   `images[]`→`question_images` (position) · exam `questionIds[]`→`exam_questions` (position) ·
   training `questionIds[]`→`training_session_items` (position = index), puis `trainingAnswers`
   remplit `selected_answer`/`is_correct`/`answered_at` des items correspondants ; `score` conservé.
4. Insert par **batches de 500** + `onConflictDoNothing` → **relançable**.
5. **Répétition sur `develop`** d'abord ; exécution sur `production` à la bascule finale.

### 5.2 Auth (le morceau délicat)

- Users insérés avec **`email_verified = true`** (déjà vérifiés Clerk).
- **Pas de lignes `account`** : 1er login **Google** → `account` recréé auto ; 1er login **email/mdp** →
  voir §6 (flux « définir mot de passe »).
- **Bannière in-app + email** « re-connexion requise ».

### 5.3 Données non migrées

Sessions training `in_progress` (éphémères 24 h) → **abandonnées** · `upload_rate_limits` (repart à
zéro) · tables d'agrégats/`migrations`.

### 5.4 Vérification (critère de fin)

Comptes de lignes Convex vs Neon · scan FK orphelines (réponse → question supprimée : log, skip ou
conserver le texte dénormalisé) · spot-check ordre des questions d'un examen · unicité
`user_access(user_id, access_type)` et `exam_participations(exam_id, user_id)` · `score`/prix sans
fractionnaire avant cast `integer` · `TZ=UTC`.

## 6. Auth — Better Auth

- `lib/auth.ts` : `emailAndPassword` (+ `requireEmailVerification`, `emailVerification`),
  `socialProviders.google`, `rateLimit.storage:'database'`, `plugins:[admin({ ac, roles }),
  nextCookies()]` (**`nextCookies()` en dernier**), `baseURL: env.BETTER_AUTH_URL`, importe le `db` partagé.
- `lib/auth-client.ts` : `adminClient()` + exports. Guards `lib/auth-guards.ts` (+ garde 401/403 dédiée
  pour les route handlers). Rôles via `lib/permissions.ts` **passé au plugin admin**.
- **⚠️ Re-login email/mdp (à vérifier avant phase 4)** : un user migré n'a **pas** de ligne `account`.
  Vérifier si le flux « mot de passe oublié » de Better Auth (`^1.6.19`) fonctionne sans compte
  credential préexistant. Sinon → **pré-créer des `account`** (`providerId:'credential'`, sans mot de
  passe) **ou** un flux dédié « revendiquer mon compte / définir le mot de passe » au 1er login.
- Gotchas : cf. `references/02-better-auth.md` (cookieCache ne cache pas `role`, anti-énumération
  sign-up, `setPassword` vs `changePassword`, 1er admin via script, etc.).

## 7. Réactivité par écran

Aucun écran « live cross-user » (vérifié : pause examen 100 % serveur) → **aucun service temps réel managé**.

| Écran | Stratégie |
|---|---|
| Profil, tarifs, abonnements, historiques, résultats, listes admin | **Server Component + DAL `await`** ; `revalidateTag` sur mutation (⚠️ Next 16 : 2ᵉ argument). |
| Prise d'examen, prise d'entraînement, quiz marketing | **Fetch one-shot + état client + Server Actions** (`useActionState`/`useOptimistic`). |
| Dashboards admin, leaderboard | **Revalidate + `router.refresh()`** ; polling optionnel. |
| **Stats marketing publiques** (`getMarketingStats`) | **Cache** (ISR / `use cache` + revalidate) — pas un COUNT à chaque visite. |

## 8. Crons, webhooks, uploads, secrets

| Convex | Cible |
|---|---|
| cron `close-expired-exam-participations` (:00) | **Vercel Cron** → `app/api/cron/close-expired-exams/route.ts` (`CRON_SECRET`) |
| cron `close-expired-training-sessions` (:30) | **Vercel Cron** → `app/api/cron/close-expired-training/route.ts` |
| httpAction `/stripe` | `app/api/webhooks/stripe/route.ts` (signature) — ⚠️ **nouveau `STRIPE_WEBHOOK_SECRET`** (endpoint change) |
| httpAction `/clerk` | **Supprimé** (Better Auth = source de vérité users) |
| httpAction upload avatar / question-image | route handlers (session Better Auth + rate-limit + Bunny) |
| httpAction `/e2e/*` | route handlers (`E2E_RESET_SECRET`) |

> **Pas de file/queue durable nécessaire** : le seul `ctx.scheduler` est un backfill jetable non porté.

**Checklist secrets à porter (Vercel/.env)** : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`,
**`STRIPE_WEBHOOK_SECRET` (nouveau)**, `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_API_KEY`,
`BUNNY_CDN_HOSTNAME`, `E2E_RESET_SECRET`. (`CLERK_*` retirés en fin de migration.)

## 9. Stratégie de tests

Le backend est testé via `convex-test` (edge-runtime) ; seuil **coverage 75 %**. À refaire :
- **DAL + Server Actions** : tests d'intégration sur une **branche Neon de test éphémère par run CI**
  (ou `pglite`/testcontainers en local), schéma appliqué via drizzle-kit.
- **Migration des tests par domaine**, en même temps que la conversion (phase 5).
- **E2E Playwright** : remplacer l'auth Clerk (`@clerk/testing`) par un bypass **Better Auth** (session
  programmatique) ; mettre à jour les POMs.

## 10. Plan strangler par phases (dev-first)

| Phase | Contenu | Vérif (gate) |
|---|---|---|
| **0** | Branche git `migration/drizzle-neon` ; protéger Neon `production` | — |
| **1** ✅ | Inventaire + audit (ce doc) | fait |
| **2** | `db/index.ts` (pg Pool), env zod, `drizzle.config.ts`, déplacer schéma auth → `db/schema/`, infra de tests DB, 1ʳᵉ migration sur **`develop`** | `build` ok |
| **3** | Porter tout le schéma + **import de répétition sur `develop`** (Convex export) | counts concordants, 0 FK orpheline non expliquée |
| **4** | Better Auth (instance/client/guards/rôles/`rate_limit`) + **résoudre le flux re-login email** (vérif Better Auth) ; plan bannière/email | guard protège une page test ; sign-in Google OK |
| **5** | Convertir l'accès données **domaine par domaine** (DAL lectures → Server Actions écritures) **+ migrer les tests du domaine** : questions → exams → training → payments → admin | `tsc`+tests par domaine |
| **6** | Refermer la réactivité (§7) | chaque écran a sa stratégie |
| **7** | Crons (Vercel) + webhooks (Stripe, nouveau secret) + uploads (Bunny) + E2E (Better Auth) | webhooks signés OK |
| **8 — BASCULE** | `proxy.ts`, headers, env prod ; **fenêtre de maintenance** : Convex read-only → export+import **réel sur `production`** → flip auth → retrait `convex/` + deps Clerk/Convex | `build`+`check`+tests verts, coverage ≥ 75 % |

**Garde-fou** : `bun run build` + `bun run check` + tests verts **après chaque phase**.

## 11. Risques principaux

1. **Re-login massif** + **faisabilité du reset email** (B5) → vérifier Better Auth tôt, flux robuste.
2. **Fraîcheur des données** → résolu par dev-first + import réel **à la bascule** (pas de snapshot précoce périmé).
3. **Migration des tests** (coverage 75 %) → non triviale, intégrée phase 5.
4. **FK orphelines / incohérences Convex** → dry-run sur `develop` + vérifs.
5. **Auth en dernier des gros morceaux** (le plus risqué).
6. **Zscaler/SSL** + **PgBouncer prepared statements** → réglés tôt (§3.1).

## 12. Hors-scope (YAGNI)

Temps réel managé, Neon Auth / Data API, read replicas, logical replication, file/queue durable. À
reconsidérer seulement sur besoin mesuré.
