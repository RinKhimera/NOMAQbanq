<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# NOMAQbanq

Plateforme francophone de preparation a l'EACMC Partie I. 3000+ QCM, examens blancs, suivi de progression.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM · Neon Postgres · Better Auth · Tailwind v4 · shadcn/ui · AWS S3 + CloudFront · Stripe · Vitest

> Backend historiquement Convex + Clerk : **migré** vers Drizzle/Neon + Better Auth (Convex et `@clerk/*` retirés). Voir `.claude/rules/data-layer.md`.

## Commandes

```bash
bun dev                  # Serveur dev (Turbopack)
bun run build            # Build production
bun run check            # tsc + eslint (avant commit)
bun run lint             # ESLint strict (--max-warnings 0)
bun run lint:fix         # Auto-fix ESLint
bun run format           # Prettier write
bun run format:check     # Prettier check
bun run test             # Tests frontend (NE PAS utiliser `bun test` — runner Bun casse vi.mocked/vi.hoisted)
bun run test:coverage    # Tests avec rapport coverage
bun run test:integration # Tests DAL/Actions sur branche Neon ephemere (cree/migre/detruit)
bun run test:e2e         # Tests E2E Playwright (bunx, pas npx)
bun run e2e:ui           # Playwright UI mode
bun run db:generate      # Drizzle: genere une migration depuis le schema
bun run db:migrate       # Drizzle: applique les migrations (cible via DATABASE_URL_UNPOOLED)
```

CI: `.github/workflows/ci.yml` — type-check -> lint -> test + coverage -> Codecov.

## Structure

```
app/(dashboard)/           # Pages etudiant (protegees par layout requireSession)
app/(admin)/               # Pages admin (protegees par layout requireRole)
app/(auth)/                # Pages auth Better Auth (sign-in, sign-up, reset)
app/(marketing)/           # Pages marketing + _components/
app/api/                   # Route handlers: auth/[...all], stripe/webhook, cron/close-expired, e2e
features/<domaine>/        # Backend: {schemas,dal,actions,lib,cron}.ts (users/payments/questions/exams/training/analytics/marketing)
db/                        # Drizzle: schema/** (tables/enums), index.ts (pg Pool)
lib/                       # auth.ts (Better Auth), dal.ts, auth-guards.ts, aws.ts, storage.ts, stripe.ts, cdn.ts, ids.ts, env/
components/ui/             # shadcn/ui
components/quiz/           # Quiz: question-card, calculator, session/
components/admin/          # Dashboard admin, modals, question-browser
components/shared/payments # Composants paiement
hooks/                     # useCurrentUser, useCalculator, useMarketingStats, use-mobile, use-media-query
constants/index.tsx        # Routes centralisees, MEDICAL_DOMAINS
```

## Regles Critiques

**IMPORTANT - Langue FR** : Tout texte UI en francais avec accents. Routes user en francais (`/entrainement`, `/examen-blanc`).

**IMPORTANT - Auth cote serveur** : Verifier la session/role cote serveur via `requireSession()` / `requireRole(["admin"])` (`lib/auth-guards.ts`) ou `getCurrentSession()` (`lib/dal.ts`). Les layouts `(dashboard)`/`(admin)` gardent deja la zone ; re-garder dans chaque DAL/Action sensible (defense en profondeur). Jamais confiance au client.

**IMPORTANT - DAL** : `features/<domaine>/dal.ts` = `import "server-only"` + React `cache()` + colonnes ciblees + self-guard. Partager les types vers le client via `import type` (le module server-only est efface a la compilation).

**IMPORTANT - Server Actions** : `features/<domaine>/actions.ts` = `"use server"` -> guard -> `zod.safeParse` -> ecriture -> `revalidatePath`. Concurrence par utilisateur : `db.transaction` + verrou de ligne (`.for("update")`) ou UPDATE garde sur le statut attendu (Postgres READ COMMITTED ne serialise pas comme l'OCC Convex).

**IMPORTANT - Reads bornes** : Toujours limiter (`.limit(n)` / pagination keyset). Max ~1000 lignes par requete. Comptes via SQL agrege (`count(*) filter (where ...)`), pas de tables d'agregat.

**IMPORTANT - Pas de N+1** : Preferer une requete SQL jointe ou `inArray(...)` plutot que `Promise.all(ids.map(...))`.

## Tests

- Seuil coverage: 75%
- Frontend: `tests/` (happy-dom) — Integration DAL/Actions: `tests/integration/` (node, vraie branche Neon ephemere via `bun run test:integration`)
- E2E: `e2e/tests/` (Playwright + auth Better Auth) — POMs dans `e2e/pages/` ; support reset/cleanup via `app/api/e2e`
- Config: `vitest.config.ts` (exclut `e2e/**`) — `playwright.config.ts` — env `TZ=UTC`

## Gotchas

- **motion** : Import depuis `motion/react`, pas `framer-motion`
- **Icons** : `@tabler/icons-react` (primaire), `lucide-react` (secondaire)
- **Auth** : Better Auth (`lib/auth.ts`, route `app/api/auth/[...all]`) ; client `authClient` (`lib/auth-client.ts`)
- **Webhooks** : Stripe -> `app/api/stripe/webhook` (signature verifiee, 500 sur erreur -> retry)
- **Routes centralisees** : Modifier `constants/index.tsx` pour ajouter/changer URLs
- **Hauteur uniforme cards** : Utiliser `h-full` + reserver espace pour elements optionnels
- **URL state** : Deriver l'etat de l'URL, pas useState+useEffect
- **useActionState** : Toujours dans `startTransition()` ou via `<form action={...}>`
- **Prettier** : Import order enforce: 1) node/npm 2) @/ 3) relatifs
- **Sentry** : Tunnel route a `/monitoring` dans next.config.ts
- **Image domains** : pexels.com, \*.cloudfront.net, cdn.nomaqbanq.ca (next.config.ts)
- **Uploads médias** : presigned POST direct navigateur→S3 (`lib/aws.ts` + `lib/storage.ts`) ; rate-limit + validation à l'étape presign ; jamais via Server Action proxy
- **ESM** : `"type": "module"` — pas de `__dirname`, utiliser `fileURLToPath(import.meta.url)`
- **Env** : valide via zod (`lib/env/schema.ts`) ; nouvelles vars optionnelles + erreur claire a l'usage
- **data-testid** : Obligatoire sur composants quiz interactifs (`components/quiz/`). Convention : `answer-option-{index}`, `btn-next`, `btn-previous`, `btn-flag`, `btn-finish`

## Instruction Routing

Regles specialisees dans `.claude/rules/`:

| Fichier          | Scope                                                            | Contenu                                                                                                     |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `data-layer.md`  | `features/**`, `app/**`, `components/**`, `tests/integration/**` | DAL Drizzle, Server Actions, forme-pont quiz, PII/frontiere client, gotchas ESLint/SonarLint, cleanup tests |
| `admin-ui.md`    | `app/(admin)/**`, `components/admin/**`                          | Master-detail, stat cards, filtres                                                                          |
| `seo.md`         | `app/(marketing)/**`, `app/robots.ts`, `app/sitemap.ts`          | Metadata, pages marketing                                                                                   |
| `e2e-testing.md` | `e2e/**`, `playwright.config.ts`, `components/quiz/**`           | Playwright, data-testid, auth Better Auth, selectors                                                        |

Ajouter les nouveaux patterns au fichier rules correspondant, pas ici.
