# Francisation des routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, préférence utilisateur) pour exécuter ce plan phase par phase avec checkpoints. Les étapes utilisent la syntaxe checkbox (`- [ ]`).

**Goal:** Uniformiser toutes les routes user-facing en français (auth + étudiant + admin), avec redirections 308 permanentes pour ne rien casser.

**Architecture:** Refactor de renommage. Le routage Next.js est basé fichiers : on renomme les dossiers dans `app/` (via `git mv`), puis on met à jour **tout ce qui pointe** vers les anciennes URL (liens, `redirect()`, `router.push`, `revalidatePath`, `callbackURL`, guards, proxy, Stripe, robots, tests, e2e). Un `redirects()` dans `next.config.ts` mappe les anciennes URL vers les nouvelles. Le filet de sécurité de ce refactor est **`bun run check` (tsc casse sur tout import brisé)** + la suite de tests (qui assert des chemins) + un e2e ciblé.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), Better Auth, Drizzle, Stripe, Vitest, Playwright.

**Référence :** table de correspondance complète dans [`docs/superpowers/specs/2026-07-01-routes-francaises-design.md`](../specs/2026-07-01-routes-francaises-design.md).

## Règles transverses (valables à chaque phase)

- **Segments d'URL sans accent** (cohérent avec l'existant : `examen-blanc`, `creer`, `succes`). Le libellé UI garde ses accents ; seule l'URL est sans accent.
- **`git mv`** pour les dossiers (préserve l'historique). Sous Windows, Git suit le renommage tant que le nom change réellement (c'est le cas partout ici).
- **Gate anti-régression par phase** : après les edits, `rg` (Grep) sur l'ancien motif doit renvoyer **0** hors `docs/**`, `.claude/**`, `.agents/**`, `README.md`, `AGENTS.md` (ces derniers sont traités en Phase 5). Puis `bun run check` vert.
- **Ordre des phases** : Admin → Auth → Dashboard → Redirects → Docs/Vérif. (Admin d'abord car le plus isolé ; Dashboard en dernier car le plus large.)
- Ne **jamais** toucher `/api/*`, le marketing, ni `/compte-supprime` (sauf son lien interne vers l'auth).

---

## Phase 0 : Baseline

**Files:** aucun.

- [ ] **Step 1 : Confirmer la branche et un arbre propre**

Run:
```bash
git branch --show-current   # attendu : dev-2
git status --porcelain      # attendu : vide (le spec est déjà commité)
```

- [ ] **Step 2 : Baseline verte (référence avant refactor)**

Run:
```bash
bun run check && bun run test
```
Expected: `check` (tsc + eslint) vert, tests verts. Si rouge **avant** de commencer, corriger/arrêter — on ne refactore pas sur une base cassée.

---

## Phase 1 : Zone Admin (`exams`→`examens`, `users`→`utilisateurs`)

Renommages : `exams`→`examens`, `users`→`utilisateurs`, `create`→`creer`, `edit`→`modifier`, `results`→`resultats`.

### Task 1.1 : Renommer les dossiers admin

**Files (git mv) :**

- [ ] **Step 1 : Déplacer les dossiers**

```bash
git mv "app/(admin)/admin/exams" "app/(admin)/admin/examens"
git mv "app/(admin)/admin/examens/create" "app/(admin)/admin/examens/creer"
git mv "app/(admin)/admin/examens/edit" "app/(admin)/admin/examens/modifier"
git mv "app/(admin)/admin/examens/[id]/results" "app/(admin)/admin/examens/[id]/resultats"
git mv "app/(admin)/admin/users" "app/(admin)/admin/utilisateurs"
```

- [ ] **Step 2 : Vérifier l'arborescence**

Run: `ls "app/(admin)/admin/examens" "app/(admin)/admin/examens/[id]" "app/(admin)/admin/utilisateurs"`
Expected: `creer/`, `modifier/[id]/`, `[id]/` (avec `resultats/`), `utilisateurs/[id]/`.

### Task 1.2 : Mettre à jour toutes les chaînes de route admin

**Files (modify) — remplacer `/admin/exams`→`/admin/examens`, `/admin/exams/create`→`/admin/examens/creer`, `/admin/exams/edit/`→`/admin/examens/modifier/`, `/admin/exams/${...}/results/`→`/admin/examens/${...}/resultats/`, `/admin/users`→`/admin/utilisateurs`** dans :

- `constants/index.tsx` (l.24 `/admin/exams`, l.29 `/admin/users`)
- `components/admin/exams-list.tsx` (l.108, 141, 157, 229)
- `components/admin/exam-actions.tsx` (l.45)
- `components/admin/dashboard/quick-actions.tsx` (l.107 `.../create`, l.113 `/admin/users`)
- `components/admin/dashboard/alerts-panel.tsx` (l.151, 163 `/admin/users`)
- `features/exams/actions.ts` (l.166, 303, 304, 337, 356, 357, 376, 377, 406 — `revalidatePath`)
- `features/payments/actions.ts` (l.89 `revalidatePath("/admin/users")`)
- `app/(admin)/admin/utilisateurs/[id]/page.tsx` (l.28, 42 `/admin/users`)
- `app/(admin)/admin/utilisateurs/[id]/user-detail-client.tsx` (l.86)
- `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx` (l.415, 441 `/admin/users/${userId}`)
- `app/(admin)/admin/examens/_components/exam-side-panel.tsx` (l.273 `.../${exam.id}`, l.282 `.../edit/${exam.id}`→`.../modifier/${exam.id}`)
- `app/(admin)/admin/examens/_components/admin-exams-client.tsx` (l.42, 69)
- `app/(admin)/admin/examens/modifier/[id]/_components/exam-edit-form.tsx` (l.179, 219, 691)
- `app/(admin)/admin/examens/creer/_components/exam-create-form.tsx` (l.157, 206, 681)
- `app/(admin)/admin/examens/[id]/_components/exam-details-client.tsx` (l.65, l.82 `.../edit/${examId}`→`.../modifier/${examId}`)
- `app/(admin)/admin/examens/[id]/_components/exam-leaderboard.tsx` (l.170, 217 `/admin/exams/${examId}/results/${...}`→`/admin/examens/${examId}/resultats/${...}`)
- `app/(admin)/admin/examens/[id]/resultats/[userId]/page.tsx` (l.88 `.../${id}`)
- `app/(admin)/admin/examens/[id]/resultats/[userId]/_components/participant-results-error.tsx` (l.63 `.../${examId}`)

- [ ] **Step 1 : Appliquer les remplacements** (Edit par fichier, ou sweep PowerShell scopé ci-dessous)

Sweep optionnel (PowerShell) — l'ordre importe (specifiques avant génériques) :
```powershell
$files = Get-ChildItem -Recurse -Include *.ts,*.tsx app,components,features,constants |
  Where-Object { $_.FullName -notmatch '\\docs\\|\\node_modules\\' }
foreach ($f in $files) {
  (Get-Content $f -Raw) `
    -replace '/admin/exams/create','/admin/examens/creer' `
    -replace '/admin/exams/edit/','/admin/examens/modifier/' `
    -replace '/admin/exams/([^"''`) ]*)/results/','/admin/examens/$1/resultats/' `
    -replace '/admin/exams','/admin/examens' `
    -replace '/admin/users','/admin/utilisateurs' |
    Set-Content $f -NoNewline
}
```
> ⚠️ Après un sweep `-Raw`/`-NoNewline`, vérifier qu'aucune fin de ligne finale n'a sauté (Prettier la remettra ; lancer `bun run format` en fin de phase).

- [ ] **Step 2 : Gate anti-régression**

Run (Grep): motif `["'\`]/admin/(exams|users)` hors `docs/`, `.claude/`, `.agents/`, `README.md`, `AGENTS.md`.
Expected: **0** match.

### Task 1.3 : Mettre à jour les tests admin

**Files (modify) :**
- `tests/components/admin/ExamActions.test.tsx` (l.101 `/admin/exams/exam456`→`/admin/examens/exam456`)
- `tests/components/admin/dashboard/QuickActions.test.tsx` (l.53 `.../create`→`.../creer`, l.60 `/admin/users`→`/admin/utilisateurs`)
- `tests/components/admin/dashboard/AlertsPanel.test.tsx` (l.193 `/admin/users`→`/admin/utilisateurs`)

- [ ] **Step 1 : Éditer les assertions de chemin** (mêmes remplacements que Task 1.2).

- [ ] **Step 2 : E2E admin (chemins en dur)**

**Files:** `e2e/pages/admin-exams.page.ts` (l.10), `e2e/pages/admin-users.page.ts` (l.10), `e2e/tests/admin-exams.spec.ts` (l.35, 73, 95, 117), `e2e/tests/navigation-admin.spec.ts` (l.16, 17). Appliquer les mêmes remplacements.

- [ ] **Step 3 : Vérifier**

Run: `bun run check && bun run test -- tests/components/admin`
Expected: vert.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "refactor(routes): admin exams→examens, users→utilisateurs (+ creer/modifier/resultats)"
```

---

## Phase 2 : Zone Auth (retrait du préfixe `/auth` + francisation)

Cible : `/auth/sign-in`→`/connexion`, `/auth/sign-up`→`/inscription`, `/auth/forgot-password`→`/mot-de-passe-oublie`, `/auth/reset-password`→`/reinitialiser-mot-de-passe`. Le groupe `(auth)` (dossier entre parenthèses) reste invisible.

### Task 2.1 : Déplacer/renommer les dossiers auth (remonter d'un niveau)

- [ ] **Step 1 : git mv**

```bash
git mv "app/(auth)/auth/sign-in"          "app/(auth)/connexion"
git mv "app/(auth)/auth/sign-up"          "app/(auth)/inscription"
git mv "app/(auth)/auth/forgot-password"  "app/(auth)/mot-de-passe-oublie"
git mv "app/(auth)/auth/reset-password"   "app/(auth)/reinitialiser-mot-de-passe"
git mv "app/(auth)/auth/_components"       "app/(auth)/_components"
```

- [ ] **Step 2 : Supprimer le dossier `auth` désormais vide**

```bash
rmdir "app/(auth)/auth"    # doit être vide ; sinon lister ce qui reste
ls "app/(auth)"            # attendu : connexion/ inscription/ mot-de-passe-oublie/ reinitialiser-mot-de-passe/ _components/ layout.tsx
```

### Task 2.2 : Corriger les imports vers `_components` déplacés

**Files (modify) — l'`_components` partagé et ceux des pages ont changé de chemin :**
- `tests/components/auth/sign-in-form.test.tsx` (l.5 : `@/app/(auth)/auth/sign-in/_components/sign-in-form` → `@/app/(auth)/connexion/_components/sign-in-form`)
- `tests/components/auth/sign-up-form.test.tsx` (l.5 : `.../auth/sign-up/_components/...` → `.../inscription/_components/...`)
- `tests/components/auth/check-email-notice.test.tsx` (import de `check-email-notice` : `@/app/(auth)/auth/_components/check-email-notice` → `@/app/(auth)/_components/check-email-notice`)

- [ ] **Step 1 : Éditer les imports.**

- [ ] **Step 2 : Trouver tout import résiduel vers l'ancien chemin**

Run (Grep): motif `\(auth\)/auth/` sur tout le repo (hors docs).
Expected: **0** match (sinon corriger le chemin d'import du fichier trouvé).

### Task 2.3 : Mettre à jour les chaînes de route auth

**Files (modify) — remplacer `/auth/sign-in`→`/connexion`, `/auth/sign-up`→`/inscription`, `/auth/forgot-password`→`/mot-de-passe-oublie`, `/auth/reset-password`→`/reinitialiser-mot-de-passe` :**
- `proxy.ts` (l.68 redirect non-auth)
- `lib/auth-guards.ts` (l.8 `redirect("/auth/sign-in")`)
- `components/shared/generic-nav-user.tsx` (l.113)
- `components/marketing-header/index.tsx` (l.43, 212, 220)
- `components/marketing-header/mobile-menu.tsx` (l.56, 209, 221)
- `app/(marketing)/_components/home-landing.tsx` (l.118, 375, 411)
- `app/(marketing)/a-propos/_components/about-cta.tsx` (l.25)
- `app/(marketing)/tarifs/_components/tarifs-page-client.tsx` (l.124)
- `app/(marketing)/tarifs/_components/pricing-grid.tsx` (l.40)
- `app/compte-supprime/page.tsx` (l.18)
- `app/(auth)/connexion/page.tsx` (l.100 lien vers `/inscription`)
- `app/(auth)/connexion/_components/sign-in-form.tsx` (l.130, 179 `/auth/forgot-password`→`/mot-de-passe-oublie` ; l.213 `/auth/sign-up`→`/inscription`)
- `app/(auth)/inscription/_components/sign-up-form.tsx` (l.196 `/auth/sign-in`→`/connexion`)
- `app/(auth)/mot-de-passe-oublie/page.tsx` (l.78, 125 `/auth/sign-in`→`/connexion`)
- `app/(auth)/reinitialiser-mot-de-passe/page.tsx` (l.50 `router.push("/auth/sign-in")`→`/connexion` ; l.78 `/auth/forgot-password`→`/mot-de-passe-oublie`)
- `app/(auth)/_components/check-email-notice.tsx` (l.96 `/auth/sign-in`→`/connexion`)
- `scripts/verify-relogin.ts` (l.25 `redirectTo: "/auth/reset-password"`→`/reinitialiser-mot-de-passe`)

- [ ] **Step 1 : Le `redirectTo` critique du reset** — dans `app/(auth)/mot-de-passe-oublie/page.tsx` (l.36) :

```ts
// AVANT
redirectTo: "/auth/reset-password",
// APRÈS
redirectTo: "/reinitialiser-mot-de-passe",
```
> C'est ce `redirectTo` que Better Auth encode dans le lien email (`callbackURL`). Le template email (`email/templates/reset-password-email`) ne contient PAS de chemin en dur — il rend le `url` fourni par Better Auth. (Vérifier : Grep `reset-password` dans `email/` → attendu 0 chemin de route en dur.)

- [ ] **Step 2 : Appliquer les autres remplacements** (Edit par fichier).

- [ ] **Step 3 : Gate anti-régression**

Run (Grep): motif `/auth/(sign-in|sign-up|forgot-password|reset-password)` hors `docs/`, `.claude/`, `.agents/`, `README.md`, `AGENTS.md`.
Expected: **0** match.

### Task 2.4 : `callbackURL` Better Auth (post-vérification email → `/dashboard`)

> Ces `callbackURL` pointent vers `/dashboard` (traité Phase 3). On les laisse tels quels ici ; la Phase 3 les francisera avec le reste de `/dashboard`. **Ne pas** les toucher en Phase 2.

### Task 2.5 : robots.ts + e2e auth + tests auth

**Files (modify) :**
- `app/robots.ts` (l.9) — les pages auth ne sont plus sous `/auth/` :
```ts
// AVANT
disallow: ["/admin/", "/dashboard/", "/auth/"],
// APRÈS (dashboard traité en Phase 3 ; ici on remplace /auth/ par les 4 pages)
disallow: ["/admin/", "/dashboard/", "/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"],
```
- `e2e/global.setup.ts` (l.12 `/auth/sign-in`→`/connexion`)
- `e2e/tests/auth.spec.ts` (l.7, 22)
- `e2e/tests/auth-ux.spec.ts` (l.9, 24, 34)
- `e2e/tests/error-states.spec.ts` (l.50 regex `/\/auth\/sign-in|\/dashboard/` → `/\/connexion|\/dashboard/`)
- `tests/components/auth/sign-in-form.test.tsx` (l.58 `href` `/auth/forgot-password`→`/mot-de-passe-oublie`)

- [ ] **Step 1 : Appliquer.**

- [ ] **Step 2 : Vérifier**

Run: `bun run check && bun run test -- tests/components/auth tests/email`
Expected: vert.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "refactor(routes): auth sans préfixe /auth (connexion, inscription, mot-de-passe-oublie, reinitialiser-mot-de-passe)"
```

---

## Phase 3 : Zone Étudiant (`/dashboard`→`/tableau-de-bord` + fuites EN)

Cible du préfixe : `/dashboard`→`/tableau-de-bord`. Feuilles EN : `onboarding`→`bienvenue`, `payment/success`→`paiement/succes`, `entrainement/[sessionId]/results`→`.../resultats`.

### Task 3.1 : Renommer les dossiers étudiant

- [ ] **Step 1 : Renommer le préfixe + les feuilles EN**

```bash
git mv "app/(dashboard)/dashboard" "app/(dashboard)/tableau-de-bord"
git mv "app/(dashboard)/tableau-de-bord/onboarding" "app/(dashboard)/tableau-de-bord/bienvenue"
git mv "app/(dashboard)/tableau-de-bord/payment" "app/(dashboard)/tableau-de-bord/paiement"
git mv "app/(dashboard)/tableau-de-bord/paiement/success" "app/(dashboard)/tableau-de-bord/paiement/succes"
git mv "app/(dashboard)/tableau-de-bord/entrainement/[sessionId]/results" "app/(dashboard)/tableau-de-bord/entrainement/[sessionId]/resultats"
```

- [ ] **Step 2 : Vérifier l'arborescence**

Run: `ls "app/(dashboard)/tableau-de-bord"`
Expected: `bienvenue/ paiement/ entrainement/ examen-blanc/ abonnements/ profil/ _components/ page.tsx …` (plus de `dashboard/`, `onboarding/`, `payment/`).

### Task 3.2 : Éditer `proxy.ts` (regex — NON couverte par le sweep), puis sweep quote-ancré

- [ ] **Step 1 : `proxy.ts` — édition MANUELLE de la regex `PROTECTED`**

Le sweep quote-ancré (Step 2) ne modifie **que** les chaînes précédées d'un guillemet/backtick. La regex `PROTECTED` (`/^\/dashboard.../`) n'en est pas une → **édition manuelle obligatoire** :
```ts
// AVANT (proxy.ts l.8)
const PROTECTED = [/^\/dashboard(?:\/|$)/, /^\/admin(?:\/|$)/]
// APRÈS
const PROTECTED = [/^\/tableau-de-bord(?:\/|$)/, /^\/admin(?:\/|$)/]
```
> La l.63 `NextResponse.redirect(new URL("/dashboard", …))` EST quote-ancrée → couverte par le sweep (Step 2). `PUBLIC_ONLY` (`/`, `/a-propos`, `/domaines`) reste inchangé.

- [ ] **Step 2 : Sweep quote-ancré (sûr — n'attrape que les chaînes de route)**

Scopé (app, components, features, constants, hooks, scripts, tests, e2e). Ordre critique : **préfixe d'abord, feuilles ensuite**.
```powershell
$roots = 'app','components','features','constants','hooks','scripts','tests','e2e'
$files = Get-ChildItem -Recurse -Include *.ts,*.tsx $roots |
  Where-Object { $_.FullName -notmatch '\\docs\\|\\node_modules\\' }
foreach ($f in $files) {
  $c = Get-Content $f -Raw
  # 1) préfixe, uniquement quand précédé d'un guillemet/backtick (= chaîne de route)
  $c = [regex]::Replace($c, '([""''`])/dashboard', '${1}/tableau-de-bord')
  # 2) feuilles EN (sur les nouveaux chemins)
  $c = $c -replace '/tableau-de-bord/onboarding','/tableau-de-bord/bienvenue'
  $c = $c -replace '/tableau-de-bord/payment/success','/tableau-de-bord/paiement/succes'
  $c = [regex]::Replace($c, '(/tableau-de-bord/entrainement/[^""''`) ]*)/results', '${1}/resultats')
  Set-Content $f -NoNewline $c
}
```
> ⚠️ `@/components/admin/dashboard/...` est précédé de `admin` (pas d'un guillemet immédiatement avant `/dashboard`) → **épargné**. Vérifié au Step 4.

- [ ] **Step 3 : Contrôler les comparaisons de `pathname` (quote-ancrées → couvertes par le sweep, à confirmer)**

Vérifier que ces lignes ont bien été mises à jour :
- `components/shared/onboarding-guard.tsx` : l.19 `pathname === "/tableau-de-bord/bienvenue"`, l.22 `router.replace("/tableau-de-bord/bienvenue")`, l.24 `router.replace("/tableau-de-bord")`.
- `components/shared/nav-secondary.tsx` : l.44 `pathname.startsWith("/tableau-de-bord")`, l.49 `href: "/tableau-de-bord"`.
- `components/shared/site-header.tsx` : l.30 `pathname === "/tableau-de-bord"`.
- `components/shared/dashboard-shell.tsx` : l.19 `: "/tableau-de-bord"`.
- `app/(admin)/error.tsx` (l.72) et `app/(dashboard)/error.tsx` (l.61) : `window.location.href = "/tableau-de-bord"`.
- `app/(dashboard)/not-found.tsx` (l.33) : `href="/tableau-de-bord"`.

- [ ] **Step 4 : Gate anti-régression (ne rien avoir cassé côté imports)**

Run (Grep):
1. motif `["'\`]/dashboard` hors docs/.claude/.agents/README/AGENTS → **0** match.
2. motif `["'\`]/tableau-de-bord/(onboarding|payment)` → **0** match (feuilles bien renommées).
3. motif `/tableau-de-bord/entrainement/[^"'\`]*/results\b` → **0** match.
4. Sanity imports intacts : `import.*admin/dashboard/` doit **toujours** exister (composants non renommés) — Grep `components/admin/dashboard/` → matches attendus (inchangés).

### Task 3.3 : `callbackURL` Better Auth (Phase 2 reportée ici)

**Files (modify) — étaient `callbackURL: "/dashboard"` → `/tableau-de-bord` (déjà couverts par le sweep quote-ancré, à confirmer) :**
- `app/(auth)/connexion/_components/sign-in-form.tsx` (l.65) + `router.push` (l.58)
- `app/(auth)/inscription/_components/sign-up-form.tsx` (l.39, 56)
- `app/(auth)/_components/check-email-notice.tsx` (l.35)

- [ ] **Step 1 : Confirmer via Grep** `callbackURL: "/tableau-de-bord"` présent dans ces 3 fichiers ; `callbackURL: "/dashboard"` absent partout.

### Task 3.4 : Mettre à jour les tests + e2e étudiant

**Files (modify) — assertions de chemin :**
- `tests/components/OnboardingGuard.test.tsx` (l.60, 64, 74, 78, 88, 102 : `/dashboard*`→`/tableau-de-bord*`, dont `/dashboard/onboarding`→`/tableau-de-bord/bienvenue`)
- `tests/components/OnboardingPage.test.tsx` (l.77, 109 : `/dashboard`→`/tableau-de-bord`)
- `tests/components/auth/sign-in-form.test.tsx` (l.45 : `/dashboard`→`/tableau-de-bord`)
- `tests/components/auth/check-email-notice.test.tsx` (l.52 : `callbackURL "/dashboard"`→`/tableau-de-bord`)
- `tests/users/profile-login-methods.test.tsx` (l.24, 42, 62 : `profilePath "/dashboard/profil"`→`/tableau-de-bord/profil`)
- E2E pages : `e2e/pages/dashboard.page.ts` (l.10), `profil.page.ts` (l.10), `payment.page.ts` (l.17, 24 → `paiement/succes`), `entrainement.page.ts` (l.10), `examen-blanc.page.ts` (l.10), `examen-resultats.page.ts` (l.12)
- E2E specs : `error-states.spec.ts` (l.47), `payment-access.spec.ts` (l.38, 73 → `paiement/succes?session_id=…`, 83), `navigation-student.spec.ts` (l.7, 13, 14, 15, 30, 43), `examen-audience.spec.ts` (l.68, 95)

> La plupart sont déjà couverts par le sweep quote-ancré (Step 1bis inclut `tests` et `e2e`). Ce sont les points à **vérifier**, avec attention aux feuilles : `payment/success`→`paiement/succes`, `onboarding`→`bienvenue`, entrainement `results`→`resultats`.

- [ ] **Step 1 : Vérifier/compléter les assertions** (surtout les feuilles EN).

- [ ] **Step 2 : Format + check + tests**

Run: `bun run format && bun run check && bun run test`
Expected: vert (toute la suite).

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "refactor(routes): /dashboard→/tableau-de-bord (+ bienvenue, paiement/succes, entrainement/resultats)"
```

---

## Phase 4 : Redirections 308 permanentes (`next.config.ts`)

**Files:** Modify `next.config.ts`.

### Task 4.1 : Ajouter `redirects()` à `nextConfig`

- [ ] **Step 1 : Ajouter la clé `redirects` dans l'objet `nextConfig`** (au même niveau que `experimental` / `images`) :

```ts
const nextConfig: NextConfig = {
  experimental: { /* … inchangé … */ },
  images: { /* … inchangé … */ },
  async redirects() {
    return [
      // — Étudiant — (spécifiques AVANT le wildcard de préfixe)
      { source: "/dashboard/entrainement/:sessionId/results", destination: "/tableau-de-bord/entrainement/:sessionId/resultats", permanent: true },
      { source: "/dashboard/onboarding", destination: "/tableau-de-bord/bienvenue", permanent: true },
      { source: "/dashboard/payment/success", destination: "/tableau-de-bord/paiement/succes", permanent: true },
      { source: "/dashboard/:path*", destination: "/tableau-de-bord/:path*", permanent: true },
      { source: "/dashboard", destination: "/tableau-de-bord", permanent: true },
      // — Admin — (spécifiques AVANT le générique :id)
      { source: "/admin/exams/create", destination: "/admin/examens/creer", permanent: true },
      { source: "/admin/exams/edit/:id", destination: "/admin/examens/modifier/:id", permanent: true },
      { source: "/admin/exams/:id/results/:userId", destination: "/admin/examens/:id/resultats/:userId", permanent: true },
      { source: "/admin/exams/:id", destination: "/admin/examens/:id", permanent: true },
      { source: "/admin/exams", destination: "/admin/examens", permanent: true },
      { source: "/admin/users/:path*", destination: "/admin/utilisateurs/:path*", permanent: true },
      { source: "/admin/users", destination: "/admin/utilisateurs", permanent: true },
      // — Auth —
      { source: "/auth/sign-in", destination: "/connexion", permanent: true },
      { source: "/auth/sign-up", destination: "/inscription", permanent: true },
      { source: "/auth/forgot-password", destination: "/mot-de-passe-oublie", permanent: true },
      { source: "/auth/reset-password", destination: "/reinitialiser-mot-de-passe", permanent: true },
    ]
  },
}
```

> `permanent: true` → 308 (préserve la méthode HTTP ; « 301 » au sens courant). La query (`?token=`, `?session_id=`) est transmise automatiquement (doc Next confirmée). L'ordre du tableau = priorité de match (haut→bas).

- [ ] **Step 2 : Type-check**

Run: `bun run check`
Expected: vert (le typage de `NextConfig.redirects` accepte cette forme).

- [ ] **Step 3 : Vérif runtime des redirections (dev)**

Run: `bun dev` (arrière-plan), puis :
```bash
curl -sI "http://localhost:3000/dashboard" | grep -i "location\|HTTP/"
curl -sI "http://localhost:3000/auth/sign-in" | grep -i "location\|HTTP/"
curl -sI "http://localhost:3000/admin/exams/create" | grep -i "location\|HTTP/"
curl -sI "http://localhost:3000/reinitialiser-mot-de-passe-inexistant?token=abc" # sanity : pas de boucle
curl -sI "http://localhost:3000/dashboard/entrainement/SID/results" | grep -i location
```
Expected: `308` + `location:` vers la nouvelle URL ; la query `?token=`/`?session_id=` préservée sur les cas concernés ; **aucune** boucle de redirection. Arrêter le dev server après (`TaskStop`).

- [ ] **Step 4 : Commit**

```bash
git add next.config.ts
git commit -m "feat(routes): redirections 308 des anciennes URL EN vers les nouvelles URL FR"
```

---

## Phase 5 : Docs + vérification finale

### Task 5.1 : Mettre à jour la doc projet (chemins cités)

**Files (modify) :**
- `AGENTS.md` (l.45 `app/(auth)/  # … (sign-in, sign-up, reset)` — reformuler ; toute autre mention de `/dashboard`, `/admin/exams`, `/admin/users`)
- `README.md` (l.115, 161, 205 : mentions auth ; toute mention de routes EN)
- `.claude/rules/e2e-testing.md` (l.48 `/auth/sign-in`→`/connexion`)
- `.claude/rules/admin-ui.md` (l.11 `/admin/users` et `/admin/exams`→`/admin/utilisateurs`, `/admin/examens`)
- `.claude/rules/seo.md` (l.16 tableau robots : `/dashboard/`, `/auth/`→libellés à jour)

- [ ] **Step 1 : Éditer les mentions.** (Doc uniquement — aucune incidence runtime.)

- [ ] **Step 2 : `sitemap.ts`** — vérifier qu'il ne liste **que** du marketing (déjà le cas). Aucun changement attendu.

Run (Grep): `dashboard|/auth/|admin/exams|admin/users` dans `app/sitemap.ts`.
Expected: **0** match.

### Task 5.2 : Gate global anti-straggler

- [ ] **Step 1 : Aucune ancienne route ne subsiste dans le code applicatif**

Run (Grep) sur `app,components,features,constants,hooks,lib,scripts,tests,e2e,proxy.ts` :
```
["'`]/dashboard\b
/auth/(sign-in|sign-up|forgot-password|reset-password)
["'`]/admin/(exams|users)\b
/tableau-de-bord/(onboarding|payment)\b
```
Expected: **0** match pour chacun.

- [ ] **Step 2 : Suite complète**

Run: `bun run check && bun run test`
Expected: vert, coverage ≥ seuil.

### Task 5.3 : E2E ciblé sur les parcours renommés

- [ ] **Step 1 : Lancer un sous-ensemble e2e** (garder court — préférence utilisateur)

Run:
```bash
bun run test:e2e -- auth.spec.ts navigation-student.spec.ts navigation-admin.spec.ts payment-access.spec.ts
```
Expected: vert. Vérifier visuellement : connexion → `/tableau-de-bord`, onboarding → `/tableau-de-bord/bienvenue`, paiement succès → `/tableau-de-bord/paiement/succes`, nav admin → `/admin/examens`, `/admin/utilisateurs`.

> Si le dev/e2e se comporte bizarrement après le renommage massif de dossiers : vider `.next` (`rm -rf .next`) puis relancer (gotcha connu du projet).

- [ ] **Step 2 : Commit final docs**

```bash
git add -A
git commit -m "docs(routes): MAJ AGENTS/README/rules après francisation des routes"
```

- [ ] **Step 3 : Push (branche dev-2, autorisé par l'utilisateur)**

```bash
git push origin dev-2
```

---

## Self-review (couverture spec ↔ plan)

- **Auth (4 routes)** : Phase 2 (dossiers, imports, chaînes, robots, redirectTo, tests, e2e) ✅
- **Étudiant (`/dashboard`→`/tableau-de-bord` + onboarding/payment/results)** : Phase 3 ✅
- **Admin (exams/users + create/edit/results)** : Phase 1 ✅
- **Redirections 308 (16 règles, ordre)** : Phase 4 ✅
- **Points d'impact du spec** : constants (P1/P3), liens/href (P1-3), redirect/router.push (P1-3), proxy.ts (P2 auth + P3 dashboard — l.63/68), auth-guards (P2/P3), stripe fallbacks (P3, couverts par sweep quote-ancré `features/payments/actions.ts`), forgot-password redirectTo (P2), robots.ts (P2 auth + P3 dashboard), e2e (P1-3), tests (P1-3), verify-relogin (P2) ✅
- **SEO/sitemap** : Phase 5 (vérif, aucun changement) ✅
- **Risque ordre proxy↔redirects** : neutralisé — proxy protège les nouveaux chemins ; validé au runtime en P4 Step 3 ✅

## Points de vigilance (pour la revue adversariale)

1. **proxy.ts — regex `PROTECTED` non quote-ancrée** : `/^\/dashboard.../` n'est pas modifiée par le sweep → traitée en **édition manuelle explicite** (Phase 3, Task 3.2, Step 1). Point à re-vérifier en revue : que la regex soit bien `^/tableau-de-bord` ET que le redirect l.63 (`new URL("/dashboard"…)`, quote-ancré → couvert par le sweep) pointe bien vers `/tableau-de-bord`. L.68 (`/auth/sign-in`) est traité en Phase 2.
2. **Sweep `-Raw`/`-NoNewline`** : peut manger la newline finale → `bun run format` en fin de P3 la rétablit. Vérifier `git diff --stat` pour des fichiers modifiés « en trop ».
3. **`callbackURL`** volontairement reporté de P2 à P3 (car pointe `/dashboard`) — ne pas le franciser deux fois.
4. **Feuilles EN vs préfixe** : l'ordre des `-replace` (préfixe d'abord, feuilles ensuite) est critique ; sinon `onboarding`/`payment` restent EN.
