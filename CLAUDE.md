# NOMAQbanq

Plateforme francophone de préparation à l'EACMC Partie I. 5000+ QCM, examens blancs, suivi de progression.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Convex · Clerk · Tailwind v4 · shadcn/ui · Bunny CDN · Vitest

## Commandes

```bash
npm run dev              # Serveur dev (Turbopack)
npm run build-check      # tsc + eslint (avant commit)
npm run test:all         # Tests frontend + Convex
```

## Structure

```
app/(dashboard)/           # Pages étudiant (protégées)
app/(admin)/               # Pages admin
convex/                    # Backend: queries, mutations, schema
convex/lib/                # Helpers: auth.ts, errors.ts, batchFetch.ts, bunny.ts
components/ui/             # shadcn/ui
components/quiz/           # Quiz: question-card, calculator, session/
components/admin/dashboard   # Dashboard admin: vital-cards, charts, activity-feed
components/shared/payments   # Composants paiement: manual-payment-modal, access-badge
```

## Règles Critiques

**IMPORTANT - Langue FR** : Tout texte UI en français avec accents (É, è, ê, à, ç). Routes user en français (`/entrainement`, `/examen-blanc`).

**IMPORTANT - Auth côté serveur** : Toujours vérifier les rôles dans Convex via `getCurrentUserOrThrow()` ou `getAdminUserOrThrow()`. Ne jamais faire confiance au client.

**IMPORTANT - Skip queries auth** : Utiliser `useConvexAuth` + `"skip"` pour éviter race condition au reload. Voir pattern dans `app/(dashboard)/`.

**IMPORTANT - Unbounded queries** : Toujours limiter les `.collect()` avec `.take(n)` ou pagination. Max 1000 docs par query.

**IMPORTANT - N+1 queries** : Utiliser `batchGetByIds()` ou `batchGetOrderedByIds()` de `convex/lib/batchFetch.ts` au lieu de `Promise.all(ids.map(id => ctx.db.get(id)))`.

## Convex Patterns

### Auth helpers (`convex/lib/auth.ts`)

```typescript
getCurrentUserOrThrow(ctx)   // Throws ConvexError si non auth
getAdminUserOrThrow(ctx)     // Throws si non admin
getCurrentUserOrNull(ctx)    // Pour queries publiques
```

### Errors standardisées (`convex/lib/errors.ts`)

```typescript
throw Errors.unauthenticated()           // Code: UNAUTHENTICATED
throw Errors.unauthorized("Message")     // Code: UNAUTHORIZED
throw Errors.notFound("Entité")          // Code: NOT_FOUND
throw Errors.accessExpired("training")   // Code: ACCESS_EXPIRED
throw Errors.invalidState("Message")     // Code: INVALID_STATE
```

### Rate limiting uploads

Avatar uploads limités à 5/heure via `convex/rateLimit.ts`. Vérifié dans `convex/http.ts`.

### Pause state machine (examens)

Transitions valides: `undefined → before_pause → during_pause → after_pause`. Voir `validatePauseTransition()` dans `convex/exams.ts`.

### Aggregation (`questionStats`)

Table d'agrégation pour stats questions. Clé réservée: `"__total__"`. Mise à jour atomique dans mutations questions.

### Analytics admin (`convex/analytics.ts`)

```typescript
getRecentActivity()       // 10 dernières activités (inscriptions, paiements, examens)
getDashboardTrends()      // Tendances 30j vs 30j précédents (users, revenus, participations)
getFailedPaymentsCount()  // Paiements échoués (7 derniers jours)
```

Queries complémentaires dans `payments.ts`:
```typescript
getExpiringAccess()       // Accès expirant dans 7 jours
getRevenueByDay({ days }) // Revenus quotidiens sur N jours
```

### Admin users page (`convex/users.ts`)

```typescript
getUsersStats()           // KPIs: total, nouveaux, accès actifs, revenus avec trends
getUsersWithFilters()     // Liste paginée avec filtres (role, accessStatus, dates, search)
getUserPanelData()        // Données panel latéral (user, accès, transactions)
```

## Accès payant

- Types: `exam` (examens blancs) et `training` (banque questions)
- Table `userAccess` avec `expiresAt`
- **Éligibilité examens** : Automatique via `userAccess.accessType === "exam"` ET `expiresAt > now`. Plus de sélection manuelle.
- **Re-vérifier l'accès à la soumission** (pas seulement au démarrage)
- Admins: bypass automatique

## Médias (Bunny CDN)

Upload via HTTP actions dans `convex/http.ts`. Helpers dans `convex/lib/bunny.ts`.

| Route | Usage |
|-------|-------|
| `POST /api/upload/avatar` | Avatar user (rate limited) |
| `POST /api/upload/question-image` | Images questions (admin) |

## Tests

- Seuil coverage: 75%
- Frontend: `tests/` (happy-dom)
- Convex: `tests/convex/` (edge-runtime, convex-test)

## UI Patterns Admin

### Master-detail avec panel latéral

Pattern utilisé dans `/admin/users` et `/admin/exams`. Table cliquable → panel Sheet (420px) avec détails.
- URL deep linking: `?user=xxx` ou `?exam=xxx` pour partager un lien direct
- Composants: `Sheet` de shadcn/ui, animation `motion/react`
- **État dérivé de l'URL** : Pas de useState+useEffect. Voir `app/(admin)/admin/exams/page.tsx`.

### Stat cards avec trends

Pattern `users-stats-row.tsx` et `exams-stats-row.tsx`: cartes KPI avec icône, valeur, trend %, subtitle.
- Couleurs: emerald, blue, amber, teal, slate
- Toujours réserver l'espace subtitle pour hauteur uniforme

### Filtres avancés

Pattern `users-filter-bar.tsx`: recherche debounce + Select filters + DateRange picker avec presets.

## SEO

**IMPORTANT - Metadata Server Components** : `metadata` et `generateMetadata` uniquement dans Server Components. Pages avec `"use client"` → extraire le contenu dans `_components/*-page-client.tsx`.

| Fichier | Rôle |
|---------|------|
| `app/robots.ts` | Règles crawl (bloque `/admin/`, `/dashboard/`, `/auth/`) |
| `app/sitemap.ts` | 9 pages publiques avec priorités |
| `app/layout.tsx` | Metadata globales + OpenGraph + Twitter cards |

Pattern pages marketing : voir `app/(marketing)/tarifs/page.tsx` + `_components/tarifs-page-client.tsx`.

## Gotchas

- **motion** : Import depuis `motion/react`, pas `framer-motion`
- **Icons** : `@tabler/icons-react` (primaire), `lucide-react` (secondaire)
- **HTTP Actions** : Toujours inclure CORS headers + OPTIONS handler
- **Clerk webhooks** : Sync users via `convex/http.ts` route `/clerk`
- **Routes centralisées** : Modifier `constants/index.tsx` pour ajouter/changer URLs
- **Hauteur uniforme cards** : Utiliser `h-full` + réserver espace pour éléments optionnels (subtitles)
- **URL state** : Dériver l'état de l'URL, pas useState+useEffect. Voir [React docs](https://react.dev/learn/you-might-not-need-an-effect)
- **useActionState** : Toujours appeler l'action dans `startTransition()` ou via `<form action={...}>`. Sinon erreur "called outside of a transition"
