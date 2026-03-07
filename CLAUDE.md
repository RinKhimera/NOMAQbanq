# NOMAQbanq

Plateforme francophone de preparation a l'EACMC Partie I. 5000+ QCM, examens blancs, suivi de progression.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Convex · Clerk · Tailwind v4 · shadcn/ui · Bunny CDN · Vitest

## Commandes

```bash
bun dev                  # Serveur dev (Turbopack)
bun run build            # Build production
bun run check            # tsc + eslint (avant commit)
bun run lint             # ESLint strict (--max-warnings 0)
bun run lint:fix         # Auto-fix ESLint
bun run format           # Prettier write
bun run format:check     # Prettier check
bun test                 # Tests frontend + Convex
bun run test:coverage    # Tests avec rapport coverage
```

CI: `.github/workflows/ci.yml` — type-check -> lint -> test + coverage -> Codecov.

## Structure

```
app/(dashboard)/           # Pages etudiant (protegees)
app/(admin)/               # Pages admin
app/(auth)/                # Pages auth (sign-in, sign-up)
app/(marketing)/           # Pages marketing + _components/
convex/                    # Backend: queries, mutations, schema
convex/lib/                # Helpers: auth.ts, errors.ts, batchFetch.ts, bunny.ts
components/ui/             # shadcn/ui
components/quiz/           # Quiz: question-card, calculator, session/
components/admin/          # Dashboard admin, modals, question-browser
components/shared/payments # Composants paiement
hooks/                     # useCurrentUser, useCalculator, useIsMobile
providers/                 # ConvexClientProvider (Clerk+Convex+Motion)
constants/index.tsx        # Routes centralisees, MEDICAL_DOMAINS
```

## Regles Critiques

**IMPORTANT - Langue FR** : Tout texte UI en francais avec accents. Routes user en francais (`/entrainement`, `/examen-blanc`).

**IMPORTANT - Auth cote serveur** : Toujours verifier les roles dans Convex via `getCurrentUserOrThrow()` ou `getAdminUserOrThrow()`. Ne jamais faire confiance au client.

**IMPORTANT - Skip queries auth** : Utiliser `useConvexAuth` + `"skip"` pour eviter race condition au reload. Pattern dans `hooks/useCurrentUser.ts` et `app/(dashboard)/`.

**IMPORTANT - Unbounded queries** : Toujours limiter les `.collect()` avec `.take(n)` ou pagination. Max 1000 docs par query.

**IMPORTANT - N+1 queries** : Utiliser `batchGetByIds()` de `convex/lib/batchFetch.ts` au lieu de `Promise.all(ids.map(...))`.

## Tests

- Seuil coverage: 75%
- Frontend: `tests/` (happy-dom) — Convex: `tests/convex/` (edge-runtime, convex-test)
- Config: `vitest.config.ts` — env `TZ=UTC` pour coherence timezone

## Gotchas

- **motion** : Import depuis `motion/react`, pas `framer-motion`
- **Icons** : `@tabler/icons-react` (primaire), `lucide-react` (secondaire)
- **Clerk webhooks** : Sync users via `convex/http.ts` route `/clerk`
- **Routes centralisees** : Modifier `constants/index.tsx` pour ajouter/changer URLs
- **Hauteur uniforme cards** : Utiliser `h-full` + reserver espace pour elements optionnels
- **URL state** : Deriver l'etat de l'URL, pas useState+useEffect
- **useActionState** : Toujours dans `startTransition()` ou via `<form action={...}>`
- **Prettier** : Import order enforce: 1) node/npm 2) @/ 3) relatifs
- **Sentry** : Tunnel route a `/monitoring` dans next.config.ts
- **Image domains** : pexels.com, clerk.com, \*.b-cdn.net, cdn.nomaqbanq.ca (next.config.ts)

## Instruction Routing

Regles specialisees dans `.claude/rules/`:

| Fichier             | Scope                                                   | Contenu                                                                 |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `convex-backend.md` | `convex/**`                                             | Auth, errors, rate limits, crons, HTTP actions, analytics, acces payant |
| `admin-ui.md`       | `app/(admin)/**`, `components/admin/**`                 | Master-detail, stat cards, filtres                                      |
| `seo.md`            | `app/(marketing)/**`, `app/robots.ts`, `app/sitemap.ts` | Metadata, pages marketing                                               |

Ajouter les nouveaux patterns au fichier rules correspondant, pas ici.
