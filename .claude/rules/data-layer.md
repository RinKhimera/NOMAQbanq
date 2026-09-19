---
paths:
  - "features/**"
  - "app/**"
  - "components/**"
  - "tests/integration/**"
---

# Data Layer (Drizzle) + Server Actions / Components

Patterns du data layer Drizzle (code `features/**` + les écrans qui le câblent).

## DAL (`features/<domaine>/dal.ts`)

- `import "server-only"` + self-guard (`requireSession`/`requireRole` de
  `@/lib/auth-guards`, ou `getCurrentSession` de `@/lib/dal`) + React `cache()` +
  colonnes ciblées. Comptes via SQL live (`count(*) filter (where …)`), pas de
  tables d'agrégat.
- **Forme-pont quiz = un seul type, un seul mappeur.** `QuizQuestion`
  (`components/quiz/runner/types.ts`) est possédé par le moteur de quiz et
  importé en `import type` par les DAL, jamais redéclaré : sa partie révélée
  est `Revealed`, le type de retour du verrou de clé de réponse. Toute DAL qui
  livre des questions aux composants passe par le mappeur `toQuizQuestion` de
  `features/questions/quiz-bridge.ts` (qui possède aussi `fetchImages`,
  `groupImages` et la dérivation CDN) : `level: null` = énoncé
  seul (passation, quiz public), sinon le verrou décide ce qu'il blanchit. Ni
  spread de champs de correction à la main, ni mapping dans les pages, ni cast
  au point de montage — `tsc` est la garde, `tests/integration/passation-anti-cheat.test.ts`
  le filet.
- Partage de types vers les clients : `import type { X } from "@/features/.../dal"`
  (le module `server-only` est effacé à la compilation — pas de fuite dans le
  bundle client).

## Server Actions (`features/<domaine>/actions.ts`)

- `"use server"` → guard → `zod.safeParse` (early `fail(message)`) → écriture →
  `revalidatePath`.
- **Catch fallback = `captureServerError`** (`lib/observability.ts`) : tag
  statique + `{ userId }` si en scope — JAMAIS de payload (PII). Réservé aux
  exceptions inattendues : les erreurs métier mappées (zod, TIME_UP,
  ACCESS_EXPIRED, 23505 username, `resource_missing` Stripe, `APIError` Better
  Auth…) `return fail(...)` SANS capture (sinon on recrée le bruit filtré en
  #105). Codes pg : `getPgErrorCode`/`isPgUniqueViolation` (`lib/db-errors.ts`)
  — ne JAMAIS tester `error.code` en surface (Drizzle enveloppe dans `cause` ;
  branche morte, bug updateProfile). Les route handlers qui catchent puis
  répondent 500 (webhook Stripe) DOIVENT capturer eux-mêmes : `onRequestError`
  ne voit jamais une erreur catchée.
- **Concurrence par utilisateur** : `db.transaction` + `SELECT … .for("update")`
  (verrou de ligne) englobant check + insert. Postgres (READ COMMITTED) ne
  sérialise pas les checks applicatifs — sans le verrou, deux requêtes
  concurrentes passent toutes deux le check. Un `EXISTS (…)` dans le `WHERE`
  d'un UPDATE NE suffit PAS contre une transaction concurrente en vol : il lit
  la dernière version committée et ne se met pas en file derrière un `FOR UPDATE`
  détenu (ex. `saveExamAnswer` vs `finalizeExam` sur la même participation →
  verrou de ligne, pas EXISTS).
- **Écriture sur une tentative = `requireAttempt`** (`features/attempts/guard.ts`,
  `docs/adr/0001`). Toute action qui écrit sur une participation ou une session
  d'entraînement ouvre `db.transaction` et appelle
  `requireAttempt(tx, { kind, ref, actor, now, verb })` : `SELECT … FOR UPDATE`
  sur la tentative (propriété dans le WHERE — autrui = `NOT_FOUND`), puis la
  politique du verbe (table en tête du module : fenêtre/TTL, accès, pause,
  budget). Refus par code, message par `refusalMessage(code, kind)` ; les refus
  propres à l'action (« question hors examen », « déjà en pause ») restent
  locaux. Plus de garde de statut dans le WHERE des UPDATE : le verrou est la
  discipline (seule exception : `closeAttempts`, qui sert aussi le balayage
  du cron sans verrou et re-vérifie « encore ouverte » dans son WHERE final).
  **Le cron est le seul écrivain de la clôture par expiration** :
  une action qui constate l'expiration refuse (`EXPIRED`) sans rien écrire.
  **La clôture elle-même a UN écrivain : `closeAttempts`**
  (`features/attempts/close.ts`, vocabulaire dans `CONTEXT.md`). Il possède le
  compte des justes, le dénominateur par type (questions de l'examen blanc
  pour une participation, nombre tiré pour une session d'entraînement), la
  garde « encore ouverte » et l'écriture (statut, score, `completedAt`) ;
  `{ id }` sous le verrou d'une action, `{ expiredBefore, limit, id? }` pour
  les crons et pour `createTrainingSession` qui libère la place.
  Un appelant ne recopie ni l'agrégat ni la formule (`scoreSql`) ni un UPDATE
  sur la tentative ; la règle est prouvée une fois dans
  `tests/integration/attempt-close.test.ts`, les tests des appelants ne
  gardent que leur mapping (statut demandé, crédit de pause). `isAutoSubmit`
  (client) n'a qu'un effet : exempter le `close` du budget — jamais une
  écriture de réponse.
- **Le cron est une liste** : `SCHEDULE` (`features/cron/schedule.ts`), exécutée
  par `runSchedule` (`features/cron/run.ts`). Ajouter une tâche = ajouter une
  entrée `{ key, label, tag, run }` à la bonne place, avec sa contrainte
  d'ordre en commentaire à côté ; ni la route ni son test ne changent.
- **Passation d'examen — invariante d'accès** : le contenu des questions n'est
  livré/écrit que pour une participation `in_progress` (créée par `startExam`,
  seul à vérifier audience + fenêtre + accès à la création). La page evaluation
  ne met les questions dans le payload RSC qu'en `in_progress` (le client
  `router.refresh()` après `startExam`) ; `getExamWithQuestions` re-garde
  `hasAccess("exam")` pour `subscribers` (défense en profondeur — un `null` sur
  la page détail rend la carte paywall, PAS un 404). Budget-temps anti-triche
  gardé À L'ÉCRITURE (verbe `answer` de `requireAttempt`, au-delà de
  `startedAt + completionTime + grâce`), pas seulement à la finalisation.
  `updateExam` et `startExam` prennent un `FOR UPDATE` commun sur la ligne
  `exams` ; `requireAttempt` ne verrouille QUE la participation (`OF p`).
- **Verrou de clé de réponse = un seul module**,
  `features/questions/answer-key-lock.ts` (voir `CONTEXT.md`). Tant qu'un
  examen contenant une question est ouvert, sa clé est retenue pour tout
  lecteur qui y participe (pour tout le monde sur le canal anonyme ; jamais
  pour un admin). Trois entrées, à ne pas contourner : `lockFor(viewer,
candidats)` → `Lock.reveal(row, niveau)` sur les canaux de RÉVÉLATION
  (correction d'entraînement, résultats et explications d'examen, notation du
  quiz public) — `reveal` décide quels champs de CORRECTION blanchir et pose
  `keyWithheld` ; `isCorrect` d'une réponse se masque à côté, par `Lock.has`,
  car il révèle la clé combiné à `selectedAnswer` ; `excludeLocked(viewer,
colonne)` dans le WHERE des canaux de
  SÉLECTION (corpus de révision, tirage du quiz public). Masquer la correction
  ne suffit pas : l'appartenance d'une question au lot « mes ratées » dit déjà
  « tu t'es trompé ». `pickRevisionQuestionIds` et `getRevisionCounts`
  prennent le `viewer` en paramètre **requis** : un oubli casse la
  compilation au lieu du silence. Une réponse dont la clé est retenue n'est
  **ni juste ni fausse** : `SessionResults` la compte « différée », et un
  lecteur qui dérive un compteur de `isCorrect` doit d'abord lire
  `keyWithheld`. Troisième entrée, pour les LECTURES DE SCORE :
  `scoreWithheldForOwner(colonneUserId, réponsesSQL, examenPropre?)` — le
  score enregistré compte les réponses différées, le lire à côté des
  compteurs qui les excluent (ou avant/après dans une moyenne) redonnerait la
  clé par soustraction. Une PARTICIPATION passe en plus son examen propre
  (`exam_participations.exam_id`) : son score est retenu tant que cet examen
  est ouvert (`end_date > now()`, la borne du verrou), réponses ou non — une
  participation auto-soumise sans réponse a un score `0` enregistré qui, lu
  pendant la fenêtre, fabrique « 0 réussi · 0 % ». Une session
  d'entraînement n'a pas d'examen propre : retenue par ses réponses seules.
  La retenue s'indexe sur le PROPRIÉTAIRE du score, pas sur le lecteur : son
  score lu par un camarade (classement) ou envoyé par courriel (cron de
  clôture) lui revient. `scoreWithheldFor(viewer, …)` est la forme
  « je lis mes propres scores » (admin jamais retenu) ; un lecteur admin lit
  le score brut partout. Toute lecture étudiant d'un `score` (session,
  participation, historique, graphique, moyenne, classement, courriel) le
  projette en `null` quand il est retenu et l'exclut des agrégats — une
  moyenne sans lecture lisible est `null`, jamais `0` (faux « 0 % »). Les
  composants rendent `null` comme « retenu » (`formatScore`). Le score n'est
  jamais recalculé ni réécrit ; les vues de passation (`getExamSession`,
  `getTrainingSessionById`) ne le portent pas. Corollaire :
  `completeTrainingSession`/`finalizeExam` ne renvoient plus le décompte des
  justes au navigateur.
- **Jamais d'appel au `db` global depuis une fonction exécutée dans une
  transaction** : le pool est à `max: 5` avec `connectionTimeoutMillis: 10_000`
  (`db/index.ts`), donc réclamer une 2ᵉ connexion pendant qu'on en détient une
  bloque 10 s puis échoue — mieux qu'avant (blocage indéfini), mais toujours un
  bug à corriger à la source. Ce qu'une transaction doit lire ailleurs se résout
  avant de l'ouvrir et se passe en paramètre (`hasAccess` dans
  `createTrainingSession`), se lit par l'exécuteur de la transaction
  (`hasActiveAccess(tx, …)`, `requireAttempt(tx, …)`), ou s'exprime en
  sous-requête corrélée dans la requête elle-même (`excludeLocked`). Le pool retente par
  ailleurs l'**acquisition** sur les erreurs de réveil Neon 53300/57P03
  (`db/retry-pool.ts`, post-mortem NOMAQBANQ-1F) — sûr car aucune requête n'est
  encore partie ; ne JAMAIS étendre ce retry aux requêtes elles-mêmes ni au
  timeout de file local (sans code pg), que retenter aggraverait.
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
  legacy, URL Google/CDN morte, `data:`). Le primitif `ui/avatar.tsx` est
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
  mutations via Server Actions + `router.refresh()` (pas de réactivité temps réel).
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
- **Hydration — fuseau des dates** : `format()` de date-fns rend dans le fuseau
  du RUNTIME → serveur en UTC (TZ=UTC en prod/CI) vs navigateur en heure locale
  = mismatch systématique de 4-5 h, et de jour entier près de minuit (post-mortem
  Sentry NOMAQBANQ-5, 29 users). TOUT formatage de date passe par `lib/format.ts`,
  qui ancre l'instant sur `America/Toronto` via `TZDate` (`@date-fns/tz`) — ne
  JAMAIS appeler `format()` de date-fns directement dans un composant rendu côté
  serveur ; ajouter un helper au module plutôt qu'un `format()` inline. Une échéance
  que le lecteur pourrait prendre pour son heure locale (ouverture/fermeture d'examen)
  s'affiche via `formatDeadline`, qui suffixe « (heure de l'Est) » — sans ça un
  étudiant hors Québec se trompe de plusieurs heures sur la fermeture.
  Exceptions assumées, à ne pas « corriger » sans réfléchir :
  - date pickers admin (`exam-form`, `users-filter-bar`) : ils formatent la valeur
    locale du calendrier, cohérente avec ce que l'admin vient de cliquer ;
  - `SESSION_DATE_FMT` (`features/users/dal.ts`) : formatage côté DAL, antérieur
    au module et volontairement autonome ;
  - `getRevenueByDay` : `parseISO` sur du date-only (`YYYY-MM-DD`) rend bien le même
    jour partout — le bucket SQL est lui aussi un jour de l'Est depuis la
    correction de #132.
- **Filtres et agrégats « par jour » : transporter une journée civile, pas un
  instant.** Un instant ne désigne pas un jour (minuit local à Paris tombe la
  veille à Toronto), et une borne de fin posée sur le minuit du dernier jour
  exclut la journée entière. Convention : `YYYY-MM-DD` sur le fil, résolu côté
  DAL par `startOfAppZoneDay` / `startOfNextAppZoneDay` (borne haute
  **exclusive** — le `timestamptz` de Postgres est plus fin que le ms JS), et
  bucket SQL via `at time zone ${APP_TIME_ZONE}`. Une suite de jours se
  construit avec `shiftCalendarDay`, jamais en soustrayant 24 h : aux
  changements d'heure une journée civile fait 23 ou 25 h.
- **Ces helpers vivent dans `lib/app-zone.ts`, pas dans `lib/format.ts`.** La
  séparation est une contrainte de charge, pas un rangement : `lib/format.ts`
  tire `date-fns` et sa locale française, et l'importer depuis `features/**`
  faisait entrer ce graphe dans presque tous les tests d'intégration — mesuré à
  +60 s d'import sur la suite. `lib/app-zone.ts` ne dépend que de `@date-fns/tz`
  (zéro dépendance). Ne pas ré-exporter l'un depuis l'autre : la frontière ne
  tient que si le code serveur importe `lib/app-zone` directement.
- **Hydration — bruit tiers filtré** : les crashs `$RS` (`Cannot read properties
of null (reading 'parentNode')`, script inline du streaming React) causés par
  un tiers qui mute le DOM (traduction, extension, proxy) sont DROPPÉS par le
  `beforeSend` d'`instrumentation-client.ts` (double condition message + frame
  `$RS`, volontairement étroite). Ne JAMAIS élargir ce filtre à d'autres erreurs
  d'hydratation sans audit préalable de l'arbre rendu (grep `toLocaleString()`/
  `new Date()`/`Date.now()`/`useId`/`typeof window` sur les composants rendus
  côté serveur) — un vrai mismatch applicatif doit rester visible dans Sentry.
- **ESLint `react-hooks/set-state-in-effect`** : pas de `setState` synchrone dans
  un `useEffect`. Fetch-par-id → tracker l'id chargé (`useState<{id,q}>` +
  comparer `state?.id === currentId`) au lieu d'un reset synchrone.

## Gates

- `bun run check` = `prettier --check . && tsc --noEmit && eslint --max-warnings 0`. **SonarLint**
  (codes `typescript:Sxxxx` : S3776 complexité cognitive, S6759 readonly-props,
  S7749 littéraux numériques…) est **IDE-only** et ne casse PAS `check` — ne pas
  refactorer pour les satisfaire.

## Tests d'intégration (`tests/integration/**`)

- **`@/email` se remplace par le faux Mailer complet**
  (`tests/helpers/fake-mailer.ts`, `satisfies Mailer`) :
  `vi.mock("@/email", () => import("../helpers/fake-mailer").then((m) => m.fakeMailer))`,
  puis `mailbox.sent` / `mailbox.failNext(verbe, erreur)` / `mailbox.reset()`.
  Jamais un mock partiel : un verbe absent rend `undefined`, l'erreur tombe
  dans le catch par ligne et aucun test ne rougit.
- **`@/lib/stripe` se remplace par le faux Stripe complet**
  (`tests/helpers/fake-stripe.ts`, `satisfies StripePort`) :
  `vi.mock("@/lib/stripe", () => import("../helpers/fake-stripe").then((m) => m.fakeStripe))`,
  puis `stripeBox.calls` / `stripeBox.failNext(verbe, erreur)` / l'état
  (`prices`, `seedCheckoutSession`, `customers`, `nextEvent`) /
  `stripeBox.reset()`. Même raison que le Mailer : un verbe Stripe ajouté au
  port sans son faux ne compile plus, un faux partiel ne masque plus un appel.
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
  `getUserSessions` (`features/users/dal.ts`) lisent `account` (`id`, `providerId`,
  `createdAt` — l'`id` est la poignée que `unlinkAccount` exige depuis
  better-auth 1.7) et `session` (`ipAddress`, `userAgent`, `updatedAt`, `id`)
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
- **Suspension (`user.banned`) = pas de session.** `getCurrentSession`
  renvoie `null` pour un compte suspendu ; aucune garde ni DAL ne doit tester
  `banned` par ailleurs. Le plugin admin refuse la CRÉATION de session d'un
  banni mais ne revérifie jamais une session existante : `banUser` supprime
  donc les sessions, et ce `null` couvre la requête en vol. Le journal vit dans
  `user_bans` ; le drapeau reste le verrou lu par le plugin.
- **Tout courriel unique passe par `sendOnce`**
  (`features/notifications/one-shot.ts` ; vocabulaire dans `CONTEXT.md`,
  « Courriels »). Le claim applique l'éligibilité du destinataire
  (`deletedAt IS NULL AND banned = false`, fragment `eligibleRecipient` à
  reprendre aussi dans le select) SANS poser de marqueur — le courriel repart
  si la suspension est levée —, pose le marqueur AVANT l'envoi et le laisse
  posé sur échec. Portée de cette garantie : sur la ligne cible quand le
  marqueur vit sur `user` (prédicat ré-évalué par Postgres après attente d'un
  verrou, donc une suspension en cours de commit est vue) ; au snapshot du
  claim quand il vit ailleurs (`EXISTS` corrélé, comme le select l'était
  avant). Un nouvel expéditeur (bienvenue, relance, panier…) ne
  réécrit ni `UPDATE … SET <marqueur> … WHERE <marqueur> IS NULL` ni son
  try/catch par ligne : il déclare sa sélection (portes métier et préférences
  comprises), son claim (`guard`, `cooldownMs`) et son payload ; ses tests ne
  couvrent que ce qui lui est propre (candidats, payload, `boolean`), la règle
  est prouvée une fois dans `tests/integration/one-shot.test.ts`. Seule
  exception voulue : le courriel de confirmation d'achat (webhook, « envoi
  puis marquage », `.claude/rules/payments.md`).
