<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# NOMAQbanq

Plateforme francophone de preparation a l'EACMC Partie I. 3000+ QCM, examens blancs, suivi de progression.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM · Neon Postgres · Better Auth · Tailwind v4 · shadcn/ui · AWS S3 + CloudFront · Stripe · Vitest

## Commandes

```bash
bun dev                  # Serveur dev (Turbopack)
bun run build            # Build production
bun run check            # prettier --check + tsc + eslint (avant commit)
bun run lint             # ESLint strict (--max-warnings 0)
bun run lint:fix         # Auto-fix ESLint
bun run format           # Prettier write
bun run format:check     # Prettier check
bun run test             # Tests frontend (NE PAS utiliser `bun test` — runner Bun casse vi.mocked/vi.hoisted)
bun run test:coverage    # Tests avec rapport coverage
bun run test:integration # Tests DAL/Actions sur branche Neon ephemere (cree/migre/detruit)
bun run test:coverage:full # Couverture AGREGEE frontend + backend (branche Neon ; seuls chiffres couvrant features/** et app/api/**)
bun run test:e2e         # Tests E2E Playwright (bunx, pas npx)
bun run e2e:ui           # Playwright UI mode
bun run db:generate      # Drizzle: genere une migration depuis le schema
bun run db:migrate       # Drizzle: applique les migrations (cible via DATABASE_URL_UNPOOLED)
bun run email:preview    # Rend chaque courriel (HTML + texte) dans .email-preview/ pour les ouvrir dans un navigateur
```

CI: `.github/workflows/ci.yml` — type-check -> lint -> format:check -> test + coverage (seuil 80%, échoue sous la barre).

## Structure

```
app/(dashboard)/           # Pages etudiant (protegees par layout requireSession)
app/(admin)/               # Pages admin (protegees par layout requireRole)
app/(auth)/                # Pages auth Better Auth, sans préfixe /auth (connexion, inscription, mot-de-passe-oublie, reinitialiser-mot-de-passe)
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

**IMPORTANT - Server Actions** : `features/<domaine>/actions.ts` = `"use server"` -> guard -> `zod.safeParse` -> ecriture -> `revalidatePath`. Concurrence par utilisateur : `db.transaction` + verrou de ligne (`.for("update")`) ou UPDATE garde sur le statut attendu (Postgres READ COMMITTED : sans verrou, deux requetes concurrentes passent le meme check).

**IMPORTANT - Reads bornes** : Toujours limiter (`.limit(n)` / pagination keyset). Max ~1000 lignes par requete. Comptes via SQL agrege (`count(*) filter (where ...)`), pas de tables d'agregat.

**IMPORTANT - Pas de N+1** : Preferer une requete SQL jointe ou `inArray(...)` plutot que `Promise.all(ids.map(...))`.

## Tests

- Seuil coverage: 80% (statements/branches/functions/lines — `vitest.config.ts`)
- Frontend: `tests/` (happy-dom) — Integration DAL/Actions: `tests/integration/` (node, vraie branche Neon ephemere via `bun run test:integration`)
- E2E: `e2e/tests/` (Playwright + auth Better Auth) — POMs dans `e2e/pages/` ; support reset/cleanup via `app/api/e2e`
- Config: `vitest.config.ts` (exclut `e2e/**`) — `playwright.config.ts` — env `TZ=UTC`

## Gotchas

- **motion** : Import depuis `motion/react`, pas `framer-motion`
- **Icons** : `lucide-react` (primaire — utilisé partout), `@tabler/icons-react` (secondaire — surtout admin/dashboard et profil)
- **Auth** : Better Auth (`lib/auth.ts`, route `app/api/auth/[...all]`) ; client `authClient` (`lib/auth-client.ts`)
- **Webhooks** : Stripe -> `app/api/stripe/webhook` (signature verifiee, 500 sur erreur -> retry)
- **Stripe en dev** : mode TEST (profil CLI `nomaqbanq`) ; webhooks locaux via `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Le prix est résolu au checkout par `products.stripe_price_lookup_key`, identique en test et en live → les 5 produits sont achetables en local sans configuration. Code promo test −100 % : `E2EPROMO100`
- **Routes centralisees** : Modifier `constants/index.tsx` pour ajouter/changer URLs
- **Hauteur uniforme cards** : Utiliser `h-full` + reserver espace pour elements optionnels
- **URL state** : Deriver l'etat de l'URL, pas useState+useEffect
- **useActionState** : Toujours dans `startTransition()` ou via `<form action={...}>`
- **Prettier** : Import order enforce: 1) node/npm 2) @/ 3) relatifs
- **Sentry** : Tunnel route a `/monitoring` dans next.config.ts
- **Dev server qui crashe au demarrage** (`An error occurred while loading instrumentation hook ... module factory is not available`, hook Sentry `instrumentation.ts`) : cache `.next` corrompu (souvent apres un gros diff ou des runs e2e), PAS la config → `rm -rf .next` puis relancer `bun dev`
- **Image domains** : pexels.com, \*.cloudfront.net, cdn.nomaqbanq.ca (next.config.ts)
- **Uploads médias** : presigned POST direct navigateur→S3 (`lib/aws.ts` + `lib/storage.ts`) ; rate-limit + validation à l'étape presign ; jamais via Server Action proxy
- **Courriels** : socle dans `email/` (`theme.ts` jetons + identité, `components/`, `templates/email-layout.tsx` à catégories `transactional` / `commercial`). Un courriel commercial exige `unsubscribeUrl` (Loi canadienne anti-pourriel). Les templates ne lisent jamais l'env : `email/index.tsx` passe `baseUrl` et le prénom. Pas de SVG dans un courriel (Gmail/Outlook), pas de thème sombre. Courriels commerciaux (relance d'inactivité, panier abandonné) : préférence `user.notify_marketing`, désabonnement sans connexion sur `/desabonnement?token=` (jeton HMAC `lib/unsubscribe-token.ts`, aucune écriture au rendu, bouton de confirmation puis réactivation) ; en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) pointant sur `POST /api/desabonnement`, sans quoi Gmail n'affiche pas son bouton natif. Marqueurs d'envoi unique sur `user` : `welcome_email_sent_at`, `inactivity_reminder_sent_at`, `cart_reminder_sent_at` (plafond 7 j). `lib/auth.ts` n'importe que `features/notifications/welcome.ts` (pas de cycle)
- **ESM** : `"type": "module"` — pas de `__dirname`, utiliser `fileURLToPath(import.meta.url)`
- **Env** : valide via zod (`lib/env/schema.ts`) ; nouvelles vars optionnelles + erreur claire a l'usage. `.env.local` est GÉNÉRÉ (`bun run env:sync` depuis le scope Vercel Development) : nouvelle var = `vercel env add <KEY> development` d'abord, pas d'édition manuelle durable
- **data-testid** : Obligatoire sur composants quiz interactifs (`components/quiz/`). Convention : `answer-option-{index}`, `btn-next`, `btn-previous`, `btn-flag`, `btn-finish`
- **Usage Vercel (Hobby, 4 h d'Active CPU/mois)** : chaque invocation compte, proxy inclus. `proxy.ts` ne matche que `/`, `/a-propos`, `/domaines` **avec cookie de session** — la zone protégée est gardée par les layouts, ne pas ré-élargir le matcher (verrou : `tests/proxy.test.ts`). Prefetch et session côté client : `.claude/rules/loading-ui.md`. Sentry serveur : `lib/sentry-sampling.ts`. Diagnostic : MCP `vercel` (`get_runtime_logs` `group_by: source`), page Usage. Spec : `docs/superpowers/specs/2026-09-06-usage-vercel-design.md`

## Instruction Routing

Regles specialisees dans `.claude/rules/`:

| Fichier          | Scope                                                                        | Contenu                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `data-layer.md`  | `features/**`, `app/**`, `components/**`, `tests/integration/**`             | DAL Drizzle, Server Actions, forme-pont quiz, PII/frontiere client, gotchas ESLint/SonarLint, cleanup tests |
| `loading-ui.md`  | `app/**`, `components/**`                                                    | Doctrine des états de chargement, socle Spinner/Skeleton, `loading.tsx` par segment                         |
| `payments.md`    | `features/payments/**`, `app/api/stripe/**`, `components/shared/payments/**` | Octroi via webhook, idempotence, cumul/combo, devises zéro-décimal, Adaptive Pricing, catalogue produits    |
| `admin-ui.md`    | `app/(admin)/**`, `components/admin/**`                                      | Master-detail, stat cards, filtres                                                                          |
| `seo.md`         | `app/(marketing)/**`, `app/robots.ts`, `app/sitemap.ts`                      | Metadata, pages marketing, claims éditoriaux                                                                |
| `e2e-testing.md` | `e2e/**`, `playwright.config.ts`, `components/quiz/**`                       | Playwright, data-testid, auth Better Auth, selectors                                                        |

Ajouter les nouveaux patterns au fichier rules correspondant, pas ici.
