---
paths:
  - "convex/**"
  - "tests/convex/**"
---

# Convex Backend Rules

## Conventions fonctions

**IMPORTANT** : Toujours utiliser la syntaxe objet avec `handler`, `args` et `returns` :

```typescript
export const get = query({
  args: { id: v.id("users") },
  returns: v.union(v.object({ /* ... */ }), v.null()),
  handler: async (ctx, args) => { ... },
});
```

- `args: {}` obligatoire meme sans arguments
- `returns` obligatoire sur toute fonction
- Runtime edge uniquement — jamais de `"use node"` dans ce projet
- Fonctions internes privees : prefixe `_` (ex: `_removeQuestionImageData`)
- Fonctions systeme : `internalMutation` / `internalQuery` (webhooks, crons)

## Queries

**IMPORTANT - Unbounded queries interdit** : Jamais de `.collect()` sans borne. Toujours `.take(n)`, `.first()`, `.unique()` ou `.paginate()`.

```typescript
// BON
.withIndex("by_user", (q) => q.eq("userId", args.userId)).take(100)
.paginate(args.paginationOpts)

// INTERDIT
.collect()  // sur tables qui grandissent
```

`.collect()` acceptable uniquement sur query index etroit avec borne previsible (roles user, sections examen).

**Toujours utiliser `.withIndex()`** au lieu de `.filter()` pour les queries. Definir l'index dans `schema.ts` si absent.

## Auth (`convex/lib/auth.ts`)

```typescript
getCurrentUserOrThrow(ctx) // Throws si non auth
getAdminUserOrThrow(ctx) // Throws si non admin
getCurrentUserOrNull(ctx) // Pour queries publiques
isAdmin(ctx) // Boolean (pas de throw)
```

Verifier les roles dans CHAQUE mutation/query sensible. Ne jamais faire confiance au client.

## Errors (`convex/lib/errors.ts`)

**Toujours utiliser `Errors.*`**, jamais `throw new ConvexError(...)` directement :

```typescript
Errors.unauthenticated() // UNAUTHENTICATED
Errors.unauthorized("Message") // UNAUTHORIZED
Errors.notFound("Entite") // NOT_FOUND
Errors.accessExpired("training") // ACCESS_EXPIRED
Errors.invalidState("Message") // INVALID_STATE
Errors.invalidInput("Message") // INVALID_INPUT
Errors.rateLimited(retryMinutes) // RATE_LIMITED
Errors.alreadyExists("Entite") // ALREADY_EXISTS
```

## N+1 queries (`convex/lib/batchFetch.ts`)

```typescript
batchGetByIds(ctx.db, ids) // Map pour lookups O(1), deduplique
batchGetOrderedByIds(ctx.db, ids) // Array ordonne preservant les indices
```

Jamais `Promise.all(ids.map(id => ctx.db.get(id)))`.

## Mutations

- Rendre les mutations **idempotentes** : verifier l'etat courant avant update
- `ctx.db.patch()` directement quand possible (throws si doc inexistant)
- `Promise.all()` pour updates paralleles independants (eviter write conflicts)
- Messages d'erreur en **francais** (coherent avec UI)

## HTTP Actions (`convex/http.ts`)

| Route                             | Usage                               |
| --------------------------------- | ----------------------------------- |
| `POST /clerk`                     | Webhook Clerk (sync users via svix) |
| `POST /stripe`                    | Webhook Stripe (paiements)          |
| `POST /api/upload/avatar`         | Avatar user (rate limited 5/h)      |
| `POST /api/upload/question-image` | Images questions (admin, 50/h)      |
| `POST /e2e/reset-exam`            | Reset E2E (secret-protected, dev)   |

- CORS : `getCorsHeaders()` avec origin dynamique
- Toujours OPTIONS handler sur routes upload
- Rate limiting verifie via `convex/rateLimit.ts`

## Cron jobs (`convex/crons.ts`)

Deux crons horaires decales :

- `close-expired-exam-participations` a :00
- `close-expired-training-sessions` a :30

Appellent des `internalMutation` dans `exams.ts` et `training.ts`.

## Pause state machine

Transitions valides : `undefined -> before_pause -> during_pause -> after_pause`.
Terminal : `after_pause`. Voir `validatePauseTransition()` dans `convex/examPause.ts`.

## Aggregation (`questionStats`)

Table d'aggregation. Cle reservee : `"__total__"`. Mise a jour atomique dans mutations `questions.ts`.

## Acces payant (`userAccess`)

- Types : `exam` et `training`
- Eligibilite : `accessType === "exam"` ET `expiresAt > now`
- Re-verifier a la soumission (pas seulement au demarrage)
- Admins : bypass automatique
- Produits `isCombo: true` : accordent exam + training en un seul achat

## Organisation fichiers

| Fichier               | Lignes | Role                               |
| --------------------- | ------ | ---------------------------------- |
| questions.ts          | ~1200  | CRUD questions, aggregation, batch |
| payments.ts           | ~1200  | Transactions, acces, Stripe        |
| training.ts           | ~990   | Sessions entrainement              |
| users.ts              | ~970   | Gestion users, Clerk sync          |
| exams.ts              | ~970   | CRUD examens, participations       |
| examStats.ts          | ~450   | Statistiques examens               |
| http.ts               | ~435   | Webhooks et uploads                |
| examParticipations.ts | ~370   | Cycle de vie participations        |
| analytics.ts          | ~320   | Dashboard admin                    |
| examPause.ts          | ~310   | Machine a etats pause              |

Libs : `lib/auth.ts`, `lib/errors.ts`, `lib/batchFetch.ts`, `lib/bunny.ts`, `lib/stripe.ts`.
