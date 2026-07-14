# Spec — Observabilité & gestion d'erreurs backend (campagne C1)

- **Date** : 2026-07-14
- **Statut** : IMPLÉMENTÉ le 2026-07-14 (branche `c1-observabilite`) — revue
  adversariale design passée, constats #1 #2 #3 #4 #5 #6 #7 #9 intégrés
- **Origine** : audit complet du 2026-07-13 — constat 🔴 « cécité totale sur les
  erreurs de prod » (agents data-layer #4 et frontend #3), + bug 23505
  `updateProfile` (agent data-layer #6).

## Problème

Sentry est branché (`instrumentation.ts` exporte
`onRequestError = Sentry.captureRequestError`), mais trois familles de code
**catchent l'exception avant qu'elle remonte** et la réduisent à un message
générique sans trace :

1. **Server Actions** : les catch fallback (`"Erreur serveur. Réessayez."`)
   loggent via `logDev` (3 copies identiques dans `features/{exams,training,questions}/actions.ts`)
   ou via des blocs inline `if (NODE_ENV !== "production") console.error`
   (6 blocs dans `features/payments/actions.ts`, d'autres dans
   `features/users/actions.ts`) — **rien en prod**. Une régression d'écriture
   (contrainte violée à chaque soumission d'examen, échec Stripe) serait
   invisible.
2. **Error boundaries de segment** : `app/error.tsx`,
   `app/(dashboard)/error.tsx`, `app/(admin)/error.tsx` font seulement
   `console.error`. Seul `app/global-error.tsx` appelle
   `Sentry.captureException`, or il ne se déclenche que si aucun boundary de
   segment ne capte — donc les crashs de rendu dashboard/admin n'atteignent
   jamais Sentry.
3. **Crons** : l'isolation par tâche de `app/api/cron/close-expired/route.ts`
   et le best-effort d'envoi email de `features/notifications/cron.ts`
   avalent les erreurs des tâches qui échouent (comportement voulu pour la
   continuité, mais panne silencieuse).

Bug corrélé : `updateProfile` (`features/users/actions.ts:158`) teste
`error.code === "23505"` au **premier niveau**, alors que Drizzle enveloppe
l'erreur pg dans `DrizzleQueryError.cause` — la branche est morte ; sous course
(pré-check d'unicité passé des deux côtés), l'utilisateur reçoit « Erreur
serveur » au lieu de « déjà pris ». Le projet connaît déjà le pattern d'unwrap
(`isForeignKeyViolation`, `features/questions/actions.ts:313`, remontée de
`cause` bornée à 5).

## Principe directeur

**Capturer uniquement dans les catch fallback génériques.** Les erreurs métier
mappées (validation zod, `TIME_UP`, `ACCESS_EXPIRED`, `ALREADY_TAKEN`,
`NOT_IN_PROGRESS`, FK 23001/23503 du delete hybride, 23505 username…) sont du
flux de contrôle normal : elles ne vont **jamais** à Sentry. C'est ce qui garde
le signal exploitable — l'inverse du bruit qu'on a déjà dû filtrer (#105).

Deux catch sont des **faux fallbacks** (revue design #2 et #5) — leur erreur
« attendue » fait partie du flux métier et doit être filtrée AVANT capture :

- `verifyStripeCheckout` : le `session_id` vient de l'URL de la page de succès
  (contrôlable/périmable par l'utilisateur) ; `stripe.checkout.sessions.retrieve`
  **throw** `resource_missing` sur tout id invalide et le catch mappe déjà ça au
  message métier « Session non trouvée ou invalide ». → pas de capture si
  `code === "resource_missing"` (duck-check), capture sinon.
- `setAccountPassword` : catch actuellement **nu** (aucun log — pire que les
  blocs recensés) ; `auth.api.setPassword` throw aussi des `APIError` Better
  Auth métier. → capture seulement si `!(error instanceof APIError)`
  (`better-auth/api`).

## Design

### 1. `lib/observability.ts` — capture centralisée (nouveau)

Module serveur : première ligne `import "server-only"` (revue #7 — verrouille
l'invariant « jamais importé côté client » ; le stub de test existe déjà,
alias `server-only` dans `vitest.config.ts`).

```ts
export const captureServerError = (
  tag: string,               // ex. "[finalizeExam]" — statique (cardinalité de tag Sentry)
  error: unknown,
  context?: { userId?: string; detail?: string },
) => { ... }
```

- `console.error` **inconditionnel** (dev : terminal ; prod : logs Vercel —
  on ne perd pas la trace texte que les crons ont déjà aujourd'hui).
- Prod uniquement : `Sentry.captureException(error, { tags: { action: tag },
user: context?.userId ? { id } : undefined, extra: { detail } })`. Pas
  d'envoi Sentry en dev/test (bruit local).
- `tag` reste **statique** (les tags Sentry sont à faible cardinalité) ; les
  ids dynamiques (participation, accès) passent dans `detail` → `extra`.
- **Contexte léger uniquement** : nom d'action + userId + ids techniques.
  Jamais de payload (emails, réponses d'examen, montants) — pas de PII dans
  Sentry.
- Remplace : les 3 `logDev` copiés-collés + tous les blocs inline
  `NODE_ENV !== "production" → console.error` des catch fallback de
  `features/*/actions.ts`.
- Les erreurs métier mappées ne passent pas par ce helper (elles `return fail(...)`
  avant).

### 2. `lib/db-errors.ts` — extraction de code pg (nouveau)

```ts
export const getPgErrorCode = (error: unknown): string | undefined
```

- Remonte la chaîne `.cause` (bornée à 5 niveaux, même idiome que
  `isForeignKeyViolation`) et renvoie le premier `.code` string rencontré.
- `isForeignKeyViolation` (questions) devient un wrapper mince :
  `FK_VIOLATION_CODES.has(getPgErrorCode(e) ?? "")` — dédup du parcours.
- **Fix 23505** : `updateProfile` remplace son test de surface par
  `isPgUniqueViolation(error)` (wrapper nommé de
  `getPgErrorCode(error) === "23505"`) → « Ce nom d'utilisateur est déjà
  pris ! » fonctionne sous course.

### 3. Error boundaries de segment

`app/error.tsx`, `app/(dashboard)/error.tsx`, `app/(admin)/error.tsx` :
ajouter `Sentry.captureException(error)` dans le `useEffect` existant (import
direct `@sentry/nextjs`, comme `global-error.tsx` — le helper serveur n'est
PAS importé côté client, aucune fuite de bundle). UI inchangée.

Doublon SSR attendu (revue #9, setup standard Sentry) : un crash de rendu
**serveur** produit deux événements — un serveur (vraie stack, via
`onRequestError`) et un client (erreur digest, via le boundary) ; un crash
**client** ne produit que l'événement boundary — c'est le trou comblé. Ne pas
« corriger » ce doublon plus tard en retirant la capture boundary (commentaire
d'une ligne dans les boundaries).

### 4. Crons, webhook Stripe & route handlers

- `app/api/cron/close-expired/route.ts` : dans le catch d'isolation du helper
  `run`, capturer avec un **tag par tâche** (`[cron:exams]`, `[cron:trainings]`,
  `[cron:anonymize]`, `[cron:quiz-rl]`, `[cron:notifications]` — filtrables dans
  Sentry, cardinalité triviale ; revue #6) puis continuer (isolation,
  `failed=true` et 500 final inchangés).
- `features/notifications/cron.ts` : capturer l'échec d'envoi email dans les 2
  catch best-effort existants (marqueur conservé, boucle continue — inchangé).
- `features/users/cron.ts` : l'anonymisation RGPD a sa **propre isolation par
  ligne** (poison-row) que le `run()` de la route ne voit jamais (revue #3) →
  capturer dans ce catch aussi (`[cron:anonymize]`, detail `user <id>` — id
  technique, pas de PII).
- **Webhook Stripe : DANS le scope** (revue #1 — la prémisse « le 500 est
  retracé par `onRequestError` » était fausse : le handler **catche** puis
  retourne une `Response` 500, Next ne voit jamais d'exception,
  `captureRequestError` ne se déclenche pas). À instrumenter, réponses HTTP
  strictement inchangées :
  - catch de traitement (`route.ts:110-113`) : capture `[stripe:webhook]`
    (detail `event.type`) + **500 conservé** (le retry Stripe est le
    comportement à ne pas régresser) ;
  - catch de configuration (`route.ts:38-41`) : capture + 500 conservé ;
  - branche `not_found` (`route.ts:77-82`) : capture (transaction fantôme =
    vraie anomalie, cf. audit #81) + **200 conservé** ;
  - catch de signature invalide (`route.ts:52-57`) : **pas de capture** (entrée
    forgeable par n'importe qui → bruit) + 400 conservé.

## Hors scope (YAGNI)

- Pas de capture dans les DAL : elles throw → remontent aux pages → boundaries
  (désormais instrumentés) ou `onRequestError`. En capturer créerait des
  doublons. (Confirmé en revue : les rares catch silencieux des DAL —
  `training/dal.ts:46`, `payments/dal.ts:187`, `quiz-token.ts:51` — sont des
  parseurs d'entrée qui retournent `null` = validation métier, pas des erreurs
  avalées.)
- Pas de payload/PII dans les événements Sentry.
- Aucun changement de config Sentry (`instrumentation*.ts`, filtres
  `beforeSend` existants — le filtre `$RS` reste tel quel).
- Pas de nouveau service de logging, pas de niveaux de log, pas de wrapper
  d'action générique (les try/catch existants restent en place, seul le corps
  du catch change).

## Tests

- **`getPgErrorCode`** (unit) : code au 1er niveau, code dans `cause` imbriquée
  (2-3 niveaux), borne à 5 (pas de boucle infinie sur cycle), erreur sans code
  → `undefined`, non-objet → `undefined`.
- **`updateProfile` 23505** (unit, `tests/`) : `db.update` mocké qui throw une
  erreur enveloppée `{ cause: { code: "23505" } }` → message « déjà pris » ;
  erreur autre → « Erreur serveur » + `captureServerError` appelé.
- **`captureServerError`** (unit) : mock `@sentry/nextjs` — en prod appelle
  `captureException` avec tags/user ; en dev appelle `console.error` sans
  Sentry.
- **Boundaries** (unit léger) : rendu du composant avec une erreur → mock
  Sentry appelé une fois.
- **Non-régression bruit** : un test vérifie qu'une erreur métier mappée
  ne déclenche PAS `captureServerError` (mock compté à 0) — couvert par le cas
  23505 de `updateProfile`, plus les deux faux-fallbacks : `verifyStripeCheckout`
  avec une erreur `resource_missing` (pas de capture) vs erreur inattendue
  (capture), et `setAccountPassword` avec une `APIError` (pas de capture).
- **Webhook** : le contrat HTTP complet du webhook (signature, 500→retry) reste
  la cible de la campagne C3 ; ici on vérifie seulement que le catch de
  traitement appelle `captureServerError` et répond toujours 500 (unit, Stripe
  mocké).

## Critères de succès

1. Une exception inattendue dans n'importe quel catch fallback de
   `features/*/actions.ts` produit un événement Sentry en prod (tag action +
   userId) tout en gardant le message utilisateur neutre.
2. Un crash de rendu sous `(dashboard)`/`(admin)`/racine produit un événement
   Sentry.
3. Une erreur métier mappée ne produit AUCUN événement Sentry.
4. Le doublon de username sous course affiche « déjà pris ».
5. `logDev` et les blocs inline `NODE_ENV` ont disparu (une seule
   implémentation).
6. Gates verts : `bun run check`, `bun run test`.
