<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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
bun run test             # Tests unitaires + composants (cibler : `bun run test <fichier>` ; NE PAS utiliser `bun test` — runner Bun casse vi.mocked/vi.hoisted)
bun run test:coverage    # Tests avec rapport coverage
bun run test:integration # Tests DAL/Actions sur un Postgres Docker jetable (demarre/migre/detruit ; Docker Desktop requis, ~25 s ; cibler : -- <fichier> -t "<titre>" ; ordre des tests melange, graine affichee : -- --sequence.seed=N pour rejouer)
bun run test:integration -- --experimental.importDurations.print # Diagnostic : modules les plus lents a importer (duree d'une suite)
bun run test:coverage:full # Couverture AGREGEE frontend + backend (Postgres Docker ; seuls chiffres couvrant features/** et app/api/**)
bun run test:e2e         # Tests E2E Playwright (toujours via ce script : `bunx playwright test` est flaky)
bun run e2e:ui           # Playwright UI mode
bun run db:generate      # Drizzle: genere une migration depuis le schema
bun run db:migrate       # Drizzle: applique les migrations (cible via DATABASE_URL_UNPOOLED)
bun run email:preview    # Rend chaque courriel (HTML + texte) dans .email-preview/ pour les ouvrir dans un navigateur
```

CI: `.github/workflows/ci.yml` — type-check -> lint -> format:check -> test + coverage (seuil 80%, échoue sous la barre).
Label de PR `skip-integration` : saute le job « Integration Tests » (rendu « Success », le check requis passe), donc aussi le seuil de couverture agrégée backend. Il reste posé d'un push à l'autre : le retirer après usage. Poser ou retirer un label relance la CI.

## Structure

```
app/(dashboard)/           # Pages etudiant (protegees par layout requireSession)
app/(admin)/               # Pages admin (protegees par layout requireRole)
app/(auth)/                # Pages auth Better Auth, sans préfixe /auth (connexion, inscription, mot-de-passe-oublie, reinitialiser-mot-de-passe)
app/(marketing)/           # Pages marketing + _components/
app/(evaluation)/          # Passation de l'évaluation gratuite, plein écran (hors coquille vitrine)
app/(passation)/           # Passation d'une série ou d'un examen blanc, plein écran (hors coquille étudiant, requireSession)
app/api/                   # Route handlers: auth/[...all], stripe/webhook, cron/close-expired, e2e
features/<domaine>/        # Backend: {schemas,dal,actions,lib,cron}.ts (users/payments/questions/exams/training/analytics/marketing)
db/                        # Drizzle: schema/** (tables/enums), index.ts (pg Pool)
lib/                       # auth.ts (Better Auth), dal.ts, auth-guards.ts, aws.ts, storage.ts, stripe.ts, cdn.ts, ids.ts, env/
components/ui/             # shadcn/ui
components/quiz/           # Quiz: question-card, calculator, session/
components/admin/          # Dashboard admin, modals, question-browser
components/marketing/      # Composites de la vitrine (héros, chiffres, bande CTA, démo de question)
components/shared/payments # Composants paiement
hooks/                     # useCurrentUser, useCalculator, use-checkout, use-mounted, use-media-query
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
- Unitaires `tests/**/*.test.ts` (Node) · composants/hooks `tests/**/*.test.tsx` (happy-dom) — Integration DAL/Actions: `tests/integration/` (node, Postgres Docker vide et migre via `bun run test:integration`)
- E2E: `e2e/tests/` (Playwright + auth Better Auth) — POMs dans `e2e/pages/` ; support reset/cleanup via `app/api/e2e`
- Config: `vitest.config.ts` (exclut `e2e/**`) — `playwright.config.ts` — env `TZ=UTC`
- Verrous d'architecture : `tests/architecture/` (styles interdits, tonalités, chargement, requêtes en transaction, tests d'intégration, hygiène des tests) — un échec signale une convention enfreinte, pas un test à assouplir

## Gotchas

- **Animations** : CSS seul (`tw-animate-css`, transitions sur `--duration-*`) ; `motion` est retiré et interdit par `tests/architecture/forbidden-styles.test.ts`
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
- **Second serveur de dev (worktree, session parallèle)** : `BETTER_AUTH_URL=http://localhost:3001 bun dev --port 3001` — sans la variable, l'auth vise le 3000 ; copier `.env.local` dans le worktree (gitignoré, absent d'un `git worktree add`)
- **Image domains** : pexels.com, \*.cloudfront.net, cdn.nomaqbanq.ca (next.config.ts)
- **Uploads médias** : presigned POST direct navigateur→S3 (`lib/aws.ts` + `lib/storage.ts`) ; rate-limit + validation à l'étape presign ; jamais via Server Action proxy
- **Courriels** : socle dans `email/` (`theme.ts` jetons + identité, `components/`, `templates/email-layout.tsx` à catégories `transactional` / `commercial`). Un courriel commercial exige `unsubscribeUrl` (Loi canadienne anti-pourriel). Les templates ne lisent jamais l'env : `email/index.tsx` passe `baseUrl` et le prénom. Pas de SVG dans un courriel (Gmail/Outlook), pas de thème sombre. Courriels commerciaux (relance d'inactivité, panier abandonné) : préférence `user.notify_marketing`, désabonnement sans connexion sur `/desabonnement?token=` (jeton HMAC `lib/unsubscribe-token.ts`, aucune écriture au rendu, bouton de confirmation puis réactivation) ; en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) pointant sur `POST /api/desabonnement`, sans quoi Gmail n'affiche pas son bouton natif. Marqueurs d'envoi unique sur `user` : `welcome_email_sent_at`, `inactivity_reminder_sent_at`, `cart_reminder_sent_at` (plafond 7 j). `lib/auth.ts` n'importe que `features/notifications/welcome.ts` (pas de cycle)
- **ESM** : `"type": "module"` — pas de `__dirname`, utiliser `fileURLToPath(import.meta.url)`
- **Env** : valide via zod (`lib/env/schema.ts`) ; nouvelles vars optionnelles + erreur claire a l'usage. `.env.local` est GÉNÉRÉ (`bun run env:sync` depuis le scope Vercel Development) : nouvelle var = `vercel env add <KEY> development` d'abord, pas d'édition manuelle durable
- **GitGuardian** (check de PR, non requis) : aucun mot de passe littéral, même de test (`POSTGRES_PASSWORD=postgres` l'a déclenché) ; un incident regroupe une même valeur de secret tous dépôts confondus, d'où des dates antérieures au commit
- **`.playwright-cli/`** : gitignoré mais parcouru par ESLint. Un script d'audit laissé là fait échouer `bun run check` ; le supprimer après le run.
- **data-testid** : Obligatoire sur composants quiz interactifs (`components/quiz/`). Convention : `answer-option-{index}`, `btn-next`, `btn-previous`, `btn-flag`, `btn-finish`
- **Usage Vercel (Hobby, 4 h d'Active CPU/mois)** : chaque invocation compte, proxy inclus. `proxy.ts` ne matche que `/`, `/a-propos`, `/domaines` **avec cookie de session** — la zone protégée est gardée par les layouts, ne pas ré-élargir le matcher (verrou : `tests/proxy.test.ts`). Prefetch et session côté client : `.claude/rules/loading-ui.md`. Sentry serveur : `lib/sentry-sampling.ts`. Diagnostic : MCP `vercel` (`get_runtime_logs` `group_by: source`), page Usage.

## Instruction Routing

Regles specialisees dans `.claude/rules/`:

| Fichier            | Scope                                                                        | Contenu                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `data-layer.md`    | `features/**`, `app/**`, `components/**`, `tests/integration/**`             | DAL Drizzle, Server Actions, forme-pont quiz, PII/frontiere client, gotchas ESLint/SonarLint, cleanup tests |
| `loading-ui.md`    | `app/**`, `components/**`                                                    | Doctrine des états de chargement, socle Spinner/Skeleton, `loading.tsx` par segment                         |
| `payments.md`      | `features/payments/**`, `app/api/stripe/**`, `components/shared/payments/**` | Octroi via webhook, idempotence, cumul/combo, devises zéro-décimal, Adaptive Pricing, catalogue produits    |
| `admin-ui.md`      | `app/(admin)/**`, `components/admin/**`                                      | Master-detail, stat cards, filtres                                                                          |
| `seo.md`           | `app/(marketing)/**`, `app/robots.ts`, `app/sitemap.ts`                      | Metadata, pages marketing, claims éditoriaux                                                                |
| `e2e-testing.md`   | `e2e/**`, `playwright.config.ts`, `components/quiz/**`                       | Playwright, data-testid, auth Better Auth, selectors                                                        |
| `testing.md`       | `tests/**`, `vitest*.ts`                                                     | Environnement par extension, resets portés par la config, défauts `vi.fn(impl)`, assertions prouvées        |
| `design-system.md` | `app/**`, `components/**`, `hooks/**`                                        | Interdits, jetons sémantiques, hauteurs de contrôles, vocabulaire ; catalogue des composants partagés       |

Ajouter les nouveaux patterns au fichier rules correspondant, pas ici.

`DESIGN.md` (racine) est la référence de design permanente : jetons, typographie, ton, règles métier affichées. À lire avant de créer ou modifier une interface ; `design-system.md` en est l'application dans le code.

## Agent skills

### Issue tracker

Les issues vivent dans GitHub Issues (`RinKhimera/NOMAQbanq`, via le CLI `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Labels par défaut : `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context : `CONTEXT.md` + `docs/adr/` à la racine (créés à la demande par `/domain-modeling`). See `docs/agents/domain.md`.

### Revue adversariale

Classes de défauts déjà vécues ici, chassées en premier par `/adversarial-review`. See `docs/agents/review-checklist.md`.
