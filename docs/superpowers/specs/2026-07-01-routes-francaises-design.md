# Routes en français — cohérence des URLs

> Design validé le 2026-07-01. Branche : `dev-2`.

## Objectif

Uniformiser toutes les routes **utilisateur** de l'application en français. L'app
mélange aujourd'hui des segments FR (`/entrainement`, `/examen-blanc`, `/tarifs`)
et EN (`/dashboard`, `/auth/sign-in`, `/admin/exams`, `/admin/users`,
`.../results`). On francise l'intégralité des routes user-facing, avec des
redirections 301 permanentes pour ne casser ni les bookmarks ni les liens de
réinitialisation de mot de passe déjà envoyés par email.

**Hors périmètre** : les routes techniques `/api/*` (webhooks Stripe, cron,
Better Auth) restent en anglais — ce ne sont pas des routes utilisateur. Le
marketing (`/tarifs`, `/domaines`, `/a-propos`, `/faq`, `/confidentialite`,
`/conditions`, `/cookies`, `/evaluation`) et `/compte-supprime` sont déjà en
français, on n'y touche pas.

## Décisions

| Sujet | Décision |
|---|---|
| Périmètre | Tout : auth + étudiant + admin |
| Préfixe étudiant | `/dashboard` → `/tableau-de-bord` |
| Préfixe auth | **Retiré** — routes à la racine (`/connexion`, …) |
| `onboarding` | → `bienvenue` |
| Rétro-compat | Redirections **301 permanentes** dans `next.config.ts` |

## Table de correspondance (ancienne → nouvelle)

### Auth (préfixe `/auth` retiré ; le groupe `(auth)` reste invisible)

| Ancienne | Nouvelle |
|---|---|
| `/auth/sign-in` | `/connexion` |
| `/auth/sign-up` | `/inscription` |
| `/auth/forgot-password` | `/mot-de-passe-oublie` |
| `/auth/reset-password` | `/reinitialiser-mot-de-passe` |

### Étudiant (préfixe `/tableau-de-bord`)

| Ancienne | Nouvelle |
|---|---|
| `/dashboard` | `/tableau-de-bord` |
| `/dashboard/entrainement` (+ `[sessionId]`) | `/tableau-de-bord/entrainement` (idem) |
| `/dashboard/entrainement/[sessionId]/results` | `/tableau-de-bord/entrainement/[sessionId]/resultats` |
| `/dashboard/examen-blanc/**` | `/tableau-de-bord/examen-blanc/**` *(feuilles déjà FR : `evaluation`, `resultats`, `soumis`)* |
| `/dashboard/abonnements` | `/tableau-de-bord/abonnements` |
| `/dashboard/profil` | `/tableau-de-bord/profil` |
| `/dashboard/onboarding` | `/tableau-de-bord/bienvenue` |
| `/dashboard/payment/success` | `/tableau-de-bord/paiement/succes` |

### Admin (seuls les 2 sous-arbres EN changent)

| Ancienne | Nouvelle |
|---|---|
| `/admin/exams` | `/admin/examens` |
| `/admin/exams/create` | `/admin/examens/creer` |
| `/admin/exams/edit/[id]` | `/admin/examens/modifier/[id]` |
| `/admin/exams/[id]` | `/admin/examens/[id]` |
| `/admin/exams/[id]/results/[userId]` | `/admin/examens/[id]/resultats/[userId]` |
| `/admin/users` | `/admin/utilisateurs` |
| `/admin/users/[id]` | `/admin/utilisateurs/[id]` |

**Inchangés** (déjà FR ou identiques dans les deux langues) : `/admin`,
`/admin/questions` (+ `nouvelle`, `[questionId]/modifier`), `/admin/transactions`,
`/admin/profil`.

## Points d'impact (le « blast radius »)

Renommer une route = renommer le dossier dans `app/` (routage basé fichiers).
Tout ce qui **pointe** vers l'ancienne URL doit suivre :

1. **Dossiers `app/`** — renommer via `git mv` (préserve l'historique).
2. **`constants/index.tsx`** — `adminNavigation` (`/admin/exams`, `/admin/users`)
   et `dashboardNavigation` (toutes les `url` `/dashboard/*`).
3. **Liens en dur** — `<Link href>` / `href` dans ~30 composants (marketing header,
   nav user, pricing, CTA about, side-panels admin, composants quiz…).
4. **Navigations** — `redirect()`, `router.push/replace()` dans les Server
   Components/Actions et clients (formulaires auth, quiz runner, onboarding-guard,
   exam actions…).
5. **`proxy.ts`** — regex `PROTECTED` (`^\/dashboard` → `^\/tableau-de-bord`),
   cible de redirection non-auth (`/auth/sign-in` → `/connexion`), redirection
   `PUBLIC_ONLY` des connectés (`/dashboard` → `/tableau-de-bord`).
6. **`lib/auth-guards.ts`** — `redirect("/auth/sign-in")` → `/connexion`,
   `redirect("/dashboard")` → `/tableau-de-bord`.
7. **`features/payments/actions.ts`** — fallbacks Stripe `safePath(..., "/dashboard")`,
   `"/dashboard/abonnements"` (portail) ; le `cancel_url` `/tarifs` reste.
8. **Formulaire mot de passe oublié** — le `redirectTo` passé à `forgetPassword`
   pointe vers `/auth/reset-password` → `/reinitialiser-mot-de-passe`.
9. **`app/robots.ts`** — `disallow` : `/dashboard/` → `/tableau-de-bord/`, `/auth/`
   → ajouter `/connexion`, `/inscription`, `/mot-de-passe-oublie`,
   `/reinitialiser-mot-de-passe` (pages désormais à la racine).
10. **E2E** — `e2e/pages/*.page.ts`, `e2e/tests/*.spec.ts`, `e2e/global.setup.ts`
    (chemins en dur).
11. **Tests unitaires** — `tests/helpers/mocks.ts` et tout test référant un chemin.
12. **`scripts/verify-relogin.ts`** — chemins en dur.

> SEO : aucun impact. `sitemap.ts` ne liste que du marketing (déjà FR) et
> `robots.ts` bloque déjà toutes les zones renommées. Le risque se limite aux
> bookmarks et aux liens de reset en vol → couvert par les redirections 301.

## Redirections 301 (`next.config.ts` → `redirects()`)

⚠️ **L'ordre compte** (Next matche de haut en bas) : les règles spécifiques
avant les wildcards. La query string (`?token=…`, `?session_id=…`) est préservée
automatiquement par Next.

Ordre proposé :

1. `/dashboard/entrainement/:sessionId/results` → `/tableau-de-bord/entrainement/:sessionId/resultats`
2. `/dashboard/onboarding` → `/tableau-de-bord/bienvenue`
3. `/dashboard/payment/success` → `/tableau-de-bord/paiement/succes`
4. `/dashboard/:path*` → `/tableau-de-bord/:path*`
5. `/dashboard` → `/tableau-de-bord`
6. `/admin/exams/create` → `/admin/examens/creer`
7. `/admin/exams/edit/:id` → `/admin/examens/modifier/:id`
8. `/admin/exams/:id/results/:userId` → `/admin/examens/:id/resultats/:userId`
9. `/admin/exams/:id` → `/admin/examens/:id`
10. `/admin/exams` → `/admin/examens`
11. `/admin/users/:path*` → `/admin/utilisateurs/:path*`
12. `/admin/users` → `/admin/utilisateurs`
13. `/auth/sign-in` → `/connexion`
14. `/auth/sign-up` → `/inscription`
15. `/auth/forgot-password` → `/mot-de-passe-oublie`
16. `/auth/reset-password` → `/reinitialiser-mot-de-passe`

## Risques à vérifier à l'implémentation

- **Ordre proxy vs redirects()** : vérifier dans la doc Next 16 installée
  (`node_modules/next/dist/docs/`) l'ordre d'exécution `redirects()` ↔ middleware
  (`proxy.ts`). Quel que soit l'ordre, `proxy.ts` doit protéger les **nouveaux**
  chemins et rediriger vers `/connexion` (défense en profondeur).
- **Syntaxe `redirects()`** : confirmer la forme `{ source, destination,
  permanent: true }` et la préservation de query sur les patterns `:path*` dans
  la version installée avant d'écrire.
- **`git mv` sensible à la casse** sous Windows : renommages purement de casse
  improbables ici (les noms changent réellement), mais vérifier que Git suit bien
  les renommages.
- **Cache `.next`** : après un renommage massif de dossiers, vider `.next` si le
  dev server se comporte mal (gotcha connu du projet).

## Validation

- `bun run check` (tsc + eslint `--max-warnings 0`) vert.
- `bun run test` vert (mettre à jour les chemins dans les tests).
- E2E ciblé sur les parcours touchés : connexion, inscription, reset mot de passe,
  onboarding/bienvenue, paiement (success), navigation admin examens/utilisateurs.
