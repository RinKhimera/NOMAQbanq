---
paths:
  - "features/**"
  - "app/**"
  - "components/**"
  - "tests/integration/**"
---

# Data Layer (Drizzle) + Server Actions / Components

Patterns de la migration Convex→Drizzle (nouveau code `features/**` + les écrans
qui le câblent). Remplace progressivement `convex-backend.md`.

## DAL (`features/<domaine>/dal.ts`)

- `import "server-only"` + self-guard (`requireSession`/`requireRole` de
  `@/lib/auth-guards`, ou `getCurrentSession` de `@/lib/dal`) + React `cache()` +
  colonnes ciblées. Comptes via SQL live (`count(*) filter (where …)`), pas de
  tables d'agrégat.
- **Forme « pont » quiz** : renvoyer `_id`/`_creationTime`/`images:{url,
storagePath,order}` pour rester assignable aux composants partagés
  (`QuestionCard`, `QuizResults`). `correctAnswer`/`explanation`/`references`
  **seulement quand autorisé** (admin, ou session/participation complétée) —
  anti-triche. Au point de montage : `question={q as never}` (l'`_id` Drizzle est
  un `string`, pas un `Id<>` brandé).
- Partage de types vers les clients : `import type { X } from "@/features/.../dal"`
  (le module `server-only` est effacé à la compilation — pas de fuite dans le
  bundle client).

## Server Actions (`features/<domaine>/actions.ts`)

- `"use server"` → guard → `zod.safeParse` (early `fail(message)`) → écriture →
  `revalidatePath`.
- **Concurrence par utilisateur** : `db.transaction` + `SELECT … .for("update")`
  (verrou de ligne) englobant check + insert. Postgres (READ COMMITTED) ne
  sérialise pas comme Convex (OCC) — sans le verrou, deux requêtes concurrentes
  passent toutes deux le check.
- **Narrowing TS** : renvoyer la valeur DEPUIS le callback de transaction
  (`const r = await db.transaction(async tx => { … return v })`), PAS via un
  `let` capturé dans la closure — TS ne le narrow pas après un garde `if (!r)`
  (erreur `TS2698 Spread types may only be created from object types`).
- **`onConflictDoUpdate`** : dédupliquer le tableau de `values` par la clé de
  conflit AVANT l'insert. Un doublon dans un seul INSERT → **Postgres 21000**
  (« ON CONFLICT … affecte 2× la même ligne ») = toute la soumission échoue.
- **Upload médias (presigned POST)** : l'upload passe par S3 en direct, pas par
  le serveur. Pattern : Server Action gardé → validation type + rate-limit
  consommé À L'ÉTAPE PRESIGN → `createPresignedUpload(storagePath, contentType)`
  (clé dérivée serveur, non falsifiable). Le client POST le fichier à S3, puis un
  Server Action persiste le `storagePath` (avatars : `confirmAvatarUpload`, qui
  re-vérifie le préfixe `avatars/{ownId}/` anti-IDOR — y compris pour la
  suppression de l'ANCIEN avatar au remplacement ; images question :
  `setQuestionImages` au save). Suppression CDN via `tryDeleteFromStorage`
  (best-effort, après commit DB). Voir `lib/aws.ts` / `lib/storage.ts`.
- **Avatars** : toujours `<UserAvatar name image className fallbackClassName>`
  (`components/shared/user-avatar.tsx`) — JAMAIS `AvatarImage src={user.image}`
  brut ni `next/image` sur `user.image` (valeur polymorphe : clé S3 brute
  legacy, URL Google/CDN/Clerk morte, `data:`). Le primitif `ui/avatar.tsx` est
  du shadcn stock, sans logique CDN. Initiales : `getInitials` (`lib/utils.ts`),
  ne pas dupliquer.
- **Suppression de question = hybride** (`deleteQuestion`) : on TENTE le hard
  delete, arbitré par les FK `restrict` — Postgres lève `23001`
  (restrict_violation ; PAS `23503`, réservé aux inserts) → fallback soft
  delete ; aucun check applicatif → aucune race. Hard = cascade DB + purge S3
  best-effort ; soft = médias CONSERVÉS (encore servis en passation/correction :
  `exams/dal` ne filtre pas `deletedAt`, c'est voulu). Audit/GC des orphelins :
  `bun run audit:medias` (dry-run ; `--purge` explicite ; exige `s3:ListBucket`).

## Écrans (Server Component + wrapper client)

- Page = Server Component qui fetch la DAL et passe en props à un `*-client.tsx` ;
  mutations via Server Actions + `router.refresh()` (plus de réactivité Convex).
- **Appels client de Server Actions — jamais d'`await` nu** : un rejet réseau
  (« Failed to fetch ») contourne le garde `if (!res.success)` → unhandled
  rejection, spinner figé, optimiste non rollback (post-mortem Sentry
  NOMAQBANQ-1A, 2026-07-12). Mutations : `callAction(() => action(x))`
  (`lib/safe-action.ts`) — ne throw jamais, convertit le rejet en
  `{ success: false, error }` discriminable par les gardes existants ;
  `{ retries: n }` RÉSERVÉ aux actions idempotentes (upserts quiz).
  **Deploy skew** : `callAction` détecte `UnrecognizedActionError` (bundle
  périmé après déploiement) via `unstable_isUnrecognizedActionError`
  (`next/navigation`), ne retente JAMAIS ce cas, renvoie `DEPLOY_SKEW_MESSAGE`
  et affiche LUI-MÊME un toast central « Recharger » (id `deploy-skew`,
  dédupliqué) — exception assumée à « les toasts vivent dans les pages » :
  événement d'infrastructure, plusieurs pages toastent un message métier
  hardcodé qui masquerait le remède. Piège tests : un
  `vi.mock("next/navigation", …)` PARTIEL dans un test qui fait rejeter une
  action via `callAction` doit fournir `unstable_isUnrecognizedActionError`
  (ou utiliser `importOriginal`), sinon le rejet frappe le proxy Vitest avec
  une erreur cryptique. Lectures :
  try/catch dans la transition, ou `.catch` sur toute chaîne `.then` d'effet
  (toujours sortir du skeleton). Le moteur quiz traite tout throw de callback
  comme `{ ok: false }` (rollback) et sérialise les envois de réponses par
  question ; les toasts vivent dans les callbacks des pages. `authClient.*` ne
  throw pas (résout `{ error }`) → lire le retour, pas de `callAction`.
- **ESLint `react-hooks/purity`** (échoue `bun run check`) : pas de `Date.now()`
  ni `new Date()` argless dans le corps de rendu d'un composant (même un Server
  Component async) → extraire l'horloge dans un helper au scope module.
- **Hydration — formatage locale-dépendant** : `(n).toLocaleString()` / `Intl.*`
  SANS locale explicite produit un séparateur de milliers différent côté serveur
  (Node) vs client → _hydration mismatch_ (« 2 880 » ≠ « 2 880 » à l'œil ; l'arbre
  est régénéré côté client et l'état local peut sauter). Toujours passer une locale
  fixe : `n.toLocaleString("fr-CA")`.
- **ESLint `react-hooks/set-state-in-effect`** : pas de `setState` synchrone dans
  un `useEffect`. Fetch-par-id → tracker l'id chargé (`useState<{id,q}>` +
  comparer `state?.id === currentId`) au lieu d'un reset synchrone.

## Gates

- `bun run check` = `prettier --check . && tsc --noEmit && eslint --max-warnings 0`. **SonarLint**
  (codes `typescript:Sxxxx` : S3776 complexité cognitive, S6759 readonly-props,
  S7749 littéraux numériques…) est **IDE-only** et ne casse PAS `check` — ne pas
  refactorer pour les satisfaire.

## Tests d'intégration (`tests/integration/**`)

- Nettoyage `afterAll` : respecter les FK `restrict` — supprimer les tables
  enfants avant les parents (ex. `trainingSessionItems`/`examAnswers` avant
  `questions`). Les FK `cascade` (ex. delete `exams`) emportent leurs enfants
  automatiquement.

## PII / frontière serveur-client

Pas de `experimental_taint*` (React) : activer `experimental.taint` dans
`next.config` bascule TOUT le répertoire `app` sur le canal React **experimental**
— tradeoff disproportionné en prod pour une app React stable. La protection PII
repose sur la **modélisation** (recommandation officielle Next), à maintenir :

- **DAL `server-only` + colonnes ciblées** : ne JAMAIS `select()` une colonne
  secrète (`password`, `account.{accessToken,refreshToken,idToken}`,
  `session.token`) pour de la donnée destinée au client.
- **Exception self-scoped (gestion de compte)** : `getLoginMethods` /
  `getUserSessions` (`features/users/dal.ts`) lisent `account` (`providerId`,
  `createdAt`) et `session` (`ipAddress`, `userAgent`, `updatedAt`, `id`)
  UNIQUEMENT pour l'utilisateur de la session courante, et NE sélectionnent
  JAMAIS `token`, `password`, ni les tokens OAuth. Afficher à l'utilisateur ses
  propres appareils/méthodes de connexion est un affichage volontaire (comme
  l'activity feed). Hors ce cas, les tables `account`/`session` ne sont lues par
  aucun DAL métier.
- **Session brute jamais propagée au client** : `getCurrentSession`/
  `requireSession`/`requireRole` renvoient l'objet session Better Auth (qui porte
  `session.token`) — l'utiliser comme garde ou en extraire `session.user.id`/
  `role` UNIQUEMENT. Ne pas passer la session entière (ni `session.session`) en
  prop d'un composant client.
- Les emails/noms qui atteignent le client (profil de l'utilisateur, listes admin,
  activity feed) sont des affichages **volontaires** — ne pas les « durcir ».
