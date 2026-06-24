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
  re-vérifie le préfixe `avatars/{ownId}/` anti-IDOR ; images question :
  `setQuestionImages` au save). Suppression CDN via `tryDeleteFromStorage`
  (best-effort, après commit DB). Voir `lib/aws.ts` / `lib/storage.ts`.

## Écrans (Server Component + wrapper client)

- Page = Server Component qui fetch la DAL et passe en props à un `*-client.tsx` ;
  mutations via Server Actions + `router.refresh()` (plus de réactivité Convex).
- **ESLint `react-hooks/purity`** (échoue `bun run check`) : pas de `Date.now()`
  ni `new Date()` argless dans le corps de rendu d'un composant (même un Server
  Component async) → extraire l'horloge dans un helper au scope module.
- **ESLint `react-hooks/set-state-in-effect`** : pas de `setState` synchrone dans
  un `useEffect`. Fetch-par-id → tracker l'id chargé (`useState<{id,q}>` +
  comparer `state?.id === currentId`) au lieu d'un reset synchrone.

## Gates

- `bun run check` = `tsc --noEmit && eslint --max-warnings 0`. **SonarLint**
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
  `session.token`, `ipAddress`, `userAgent`) pour de la donnée destinée au client.
  Les tables Better Auth `account`/`session` ne sont lues par aucun DAL métier.
- **Session brute jamais propagée au client** : `getCurrentSession`/
  `requireSession`/`requireRole` renvoient l'objet session Better Auth (qui porte
  `session.token`) — l'utiliser comme garde ou en extraire `session.user.id`/
  `role` UNIQUEMENT. Ne pas passer la session entière (ni `session.session`) en
  prop d'un composant client.
- Les emails/noms qui atteignent le client (profil de l'utilisateur, listes admin,
  activity feed) sont des affichages **volontaires** — ne pas les « durcir ».
