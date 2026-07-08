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

⚠️ **Post-revue (F6)** : `bun run check` inclut `prettier --check` sur **tout** le repo, `docs/` compris. Les fichiers spec/plan de ce chantier peuvent être non formatés → `check` exit 1 (uniquement la passe Prettier ; tsc/eslint/test sont verts). **Formater les docs d'abord** :

```bash
bunx prettier --write docs/superpowers/specs/2026-07-01-routes-francaises-design.md docs/superpowers/plans/2026-07-01-routes-francaises.md
git commit -am "docs(routes): format spec + plan (baseline verte)"
```

Run ensuite :

```bash
bun run check && bun run test
```

Expected: `check` (tsc + eslint + prettier) vert, tests verts (866/866 à la revue). Si rouge **avant** de commencer, corriger/arrêter — on ne refactore pas sur une base cassée.

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

⚠️ **Post-revue (F4)** : un `-replace '/admin/exams'` NON borné corrompt l'import `@/components/admin/exams-list` (`/admin/exams` ⊂ `/admin/exams-list`) → `examens-list` (module inexistant). Le fichier `exams-list.tsx` **n'est pas renommé** (nom de fichier ≠ route). Le sweep ci-dessous ancre donc chaque route sur un guillemet/backtick **ou** un `\` (forme regex des assertions e2e, cf. F1) — jamais sur une lettre. L'ordre importe (spécifiques avant génériques) :

```powershell
$roots = 'app','components','features','constants','hooks','scripts','tests','e2e'
$files = Get-ChildItem -Recurse -Include *.ts,*.tsx $roots |
  Where-Object { $_.FullName -notmatch '\\docs\\|\\node_modules\\' }
foreach ($f in $files) {
  $c = Get-Content $f -Raw
  # a) chaînes de route (guillemet/backtick) — spécifiques d'abord
  $c = $c -replace '(["''`])/admin/exams/create','$1/admin/examens/creer'
  $c = $c -replace '(["''`])/admin/exams/edit/','$1/admin/examens/modifier/'
  $c = $c -replace '(["''`])/admin/exams','$1/admin/examens'
  $c = $c -replace '(["''`])/admin/users','$1/admin/utilisateurs'
  # b) forme regex e2e (\/…) — mêmes règles, ancrées sur un backslash
  $c = $c -replace '(\\)/admin/exams/create','$1/admin/examens/creer'
  $c = $c -replace '(\\)/admin/exams','$1/admin/examens'
  $c = $c -replace '(\\)/admin/users','$1/admin/utilisateurs'
  # c) results → resultats DANS les chemins d'examens déjà renommés (template literals)
  $c = [regex]::Replace($c, '(/admin/examens/[^"''`) ]*)/results', '${1}/resultats')
  Set-Content $f -NoNewline $c
}
```

> ⚠️ Après un sweep `-Raw`/`-NoNewline`, la newline finale peut sauter → `bun run format` en fin de phase la rétablit.

- [ ] **Step 2 : Gate anti-régression (agnostique à la forme — F1/F4)**

Grep par **sous-chaîne** (attrape toutes les formes : `"…"`, `\/…`, `}/…`) en **excluant** le seul faux positif légitime (le fichier composant `exams-list`), sur `app,components,features,constants,hooks,scripts,tests,e2e` :

```bash
rg -n --glob '!docs/**' '/admin/(exams|users)' app components features constants hooks scripts tests e2e | rg -v 'exams-list'
```

Expected: **0** ligne. (Toute occurrence restante = route non convertie, quelle que soit sa forme.)

### Task 1.3 : Mettre à jour les tests admin

**Files (modify) :**

- `tests/components/admin/ExamActions.test.tsx` (l.101 `/admin/exams/exam456`→`/admin/examens/exam456`)
- `tests/components/admin/dashboard/QuickActions.test.tsx` (l.53 `.../create`→`.../creer`, l.60 `/admin/users`→`/admin/utilisateurs`)
- `tests/components/admin/dashboard/AlertsPanel.test.tsx` (l.193 `/admin/users`→`/admin/utilisateurs`)

- [ ] **Step 1 : Éditer les assertions de chemin** (mêmes remplacements que Task 1.2).

- [ ] **Step 2 : E2E admin — chaînes ET assertions regex (F1)**

Le sweep Task 1.2 (roots inclut `e2e`) couvre les deux formes. **Vérifier** que ces occurrences sont bien converties :

- Chaînes (`goto`/`url`) : `e2e/pages/admin-exams.page.ts` (l.10), `e2e/pages/admin-users.page.ts` (l.10), `e2e/tests/admin-exams.spec.ts` (l.35, 73, 95, 117), `e2e/tests/navigation-admin.spec.ts` (l.16, 17 — data `url`).
- **Regex** `toHaveURL/waitForURL` (forme `\/…`, hors sous-ensemble initial) : `e2e/tests/admin.spec.ts` (l.40 `\/admin\/exams\/create`→`examens\/creer`, l.47 `\/admin\/users`→`utilisateurs`), `e2e/tests/admin-exams.spec.ts` (l.29 `\/admin\/exams\/create`→`examens\/creer`), `e2e/pages/admin-exams.page.ts` (l.21 `\/admin\/exams\/create`→`examens\/creer`).
- Inchangés (déjà FR) : `\/admin\/questions…` (admin.spec.ts:33, admin-questions), `\/admin\/profil` (navigation-admin:40).

- [ ] **Step 3 : Vérifier**

Run: `bun run check && bun run test -- tests/components/admin`
Expected: vert. (Le gate agnostique de Task 1.2 Step 2 doit déjà renvoyer 0.)

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

**Files (modify) — l'`_components` partagé et ceux des pages ont changé de chemin. ⚠️ F3 : inclut 2 fichiers SOURCE qui importent `check-email-notice` en chemin absolu (omis initialement — le gate Step 2 les rattrape) :**

- `app/(auth)/inscription/_components/sign-up-form.tsx` (l.7 : `@/app/(auth)/auth/_components/check-email-notice` → `@/app/(auth)/_components/check-email-notice`)
- `app/(auth)/connexion/_components/sign-in-form.tsx` (l.9 : idem → `@/app/(auth)/_components/check-email-notice`)
- `tests/components/auth/sign-in-form.test.tsx` (l.5 : `@/app/(auth)/auth/sign-in/_components/sign-in-form` → `@/app/(auth)/connexion/_components/sign-in-form`)
- `tests/components/auth/sign-up-form.test.tsx` (l.5 : `.../auth/sign-up/_components/...` → `.../inscription/_components/...`)
- `tests/components/auth/check-email-notice.test.tsx` (l.5 : `@/app/(auth)/auth/_components/check-email-notice` → `@/app/(auth)/_components/check-email-notice`)

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

- [ ] **Step 1 : Éditions MANUELLES hors racines du sweep (F5)**

⚠️ **Correction post-revue** : les racines du sweep (Step 2) sont `app,components,features,constants,hooks,scripts,tests,e2e` — elles **excluent `proxy.ts` (racine) et `lib/`**. Ces 3 points sont donc édités **à la main** (l'ancienne version du plan les disait couverts par le sweep — c'était FAUX) :

`proxy.ts` (racine — regex `PROTECTED` l.8 **et** redirect l.63) :

```ts
// AVANT (l.8)
const PROTECTED = [/^\/dashboard(?:\/|$)/, /^\/admin(?:\/|$)/]
// APRÈS
const PROTECTED = [/^\/tableau-de-bord(?:\/|$)/, /^\/admin(?:\/|$)/]

// AVANT (l.63)
return NextResponse.redirect(new URL("/dashboard", request.url))
// APRÈS
return NextResponse.redirect(new URL("/tableau-de-bord", request.url))
```

> `PUBLIC_ONLY` (`/`, `/a-propos`, `/domaines`) reste inchangé. La l.68 (`/auth/sign-in`→`/connexion`) a déjà été éditée en Phase 2.

`lib/auth-guards.ts` (dossier `lib/` hors sweep — l.16) :

```ts
// AVANT (l.16)
if (!roles.includes(role)) redirect("/dashboard")
// APRÈS
if (!roles.includes(role)) redirect("/tableau-de-bord")
```

> La l.8 (`redirect("/auth/sign-in")`→`/connexion`) a déjà été éditée en Phase 2.

- [ ] **Step 2 : Sweep agnostique à la forme (F1/F2/F3)**

⚠️ **Correction post-revue** : le préfixe `/dashboard` apparaît dans **5 contextes**, pas seulement en chaîne. L'ancre couvre donc `"` `'` `` ` `` (chaînes), `}` (template-literal cron `${getBaseUrl()}/dashboard`, cf. F2), `)` (import `(dashboard)/dashboard/…`, cf. F3), et `\` (assertion regex e2e `/\/dashboard/`, cf. F1). Scopé (app, components, features, constants, hooks, scripts, tests, e2e). **Ne couvre PAS `proxy.ts` ni `lib/`** → faits à la main en Step 1. Ordre critique : **préfixe d'abord, feuilles ensuite**.

```powershell
$roots = 'app','components','features','constants','hooks','scripts','tests','e2e'
$files = Get-ChildItem -Recurse -Include *.ts,*.tsx $roots |
  Where-Object { $_.FullName -notmatch '\\docs\\|\\node_modules\\' }
foreach ($f in $files) {
  $c = Get-Content $f -Raw
  # 1) préfixe /dashboard, ancré sur " ' ` } ) \ (= toute forme de chemin, jamais une lettre)
  $c = [regex]::Replace($c, '([""''`}\\)])/dashboard', '${1}/tableau-de-bord')
  # 2) feuilles EN (chaînes ET imports — non ancrées car chemins déjà distinctifs)
  $c = $c -replace '/tableau-de-bord/onboarding','/tableau-de-bord/bienvenue'
  $c = $c -replace '/tableau-de-bord/payment/success','/tableau-de-bord/paiement/succes'
  # 3) results→resultats de l'entraînement : forme chaîne/template…
  $c = [regex]::Replace($c, '(/tableau-de-bord/entrainement/[^""''`) ]*)/results', '${1}/resultats')
  # 3bis) …ET forme regex e2e bare `\/results` (ne matche pas `\/resultats`)
  $c = $c -replace '\\/results','\/resultats'
  Set-Content $f -NoNewline $c
}
```

> ⚠️ **Épargnés à raison** : `@/components/admin/dashboard/…` (le `/dashboard` y est précédé de `n`), `@/components/shared/dashboard-shell` (précédé de `d`), et le groupe `(dashboard)` lui-même (c'est `/(dashboard)`, pas `/dashboard` — un `(` s'intercale). Seul le vrai segment de route `)/dashboard/` du groupe est converti. Vérifié au Step 4.

- [ ] **Step 3 : Contrôler les comparaisons de `pathname` (quote-ancrées → couvertes par le sweep, à confirmer)**

Vérifier que ces lignes ont bien été mises à jour :

- `components/shared/onboarding-guard.tsx` : l.19 `pathname === "/tableau-de-bord/bienvenue"`, l.22 `router.replace("/tableau-de-bord/bienvenue")`, l.24 `router.replace("/tableau-de-bord")`.
- `components/shared/nav-secondary.tsx` : l.44 `pathname.startsWith("/tableau-de-bord")`, l.49 `href: "/tableau-de-bord"`.
- `components/shared/site-header.tsx` : l.30 `pathname === "/tableau-de-bord"`.
- `components/shared/dashboard-shell.tsx` : l.19 `: "/tableau-de-bord"`.
- `app/(admin)/error.tsx` (l.72) et `app/(dashboard)/error.tsx` (l.61) : `window.location.href = "/tableau-de-bord"`.
- `app/(dashboard)/not-found.tsx` (l.33) : `href="/tableau-de-bord"`.

- [ ] **Step 4 : Gate anti-régression AGNOSTIQUE À LA FORME (F1/F2/F3)**

Grep par **sous-chaîne** (attrape `"…"`, `\/…`, `}/…`, `)/…` d'un coup) en excluant les 2 faux positifs légitimes, sur `app,components,features,constants,hooks,lib,scripts,tests,e2e,proxy.ts` :

```bash
# 1) plus aucun /dashboard résiduel (hors composants non-routes)
rg -n --glob '!docs/**' '/dashboard' app components features constants hooks lib scripts tests e2e proxy.ts | rg -v 'dashboard-shell|admin/dashboard'
# 2) feuilles EN bien renommées
rg -n '/tableau-de-bord/(onboarding|payment)' app components features constants hooks lib scripts tests e2e proxy.ts
# 3) plus aucun /results résiduel (training) — n'attrape pas /resultats
rg -n '/results' app components features constants hooks lib scripts tests e2e
```

Expected: **0** ligne pour chacun.

- [ ] **Step 5 : Sanity — imports composants intacts**

Run (Grep): `components/admin/dashboard/` → matches **attendus** (répertoire composant non renommé, ne doit PAS avoir bougé). `dashboard-shell` → présent. Confirme que le sweep n'a pas sur-remplacé.

### Task 3.3 : `callbackURL` Better Auth (Phase 2 reportée ici)

**Files (modify) — étaient `callbackURL: "/dashboard"` → `/tableau-de-bord` (déjà couverts par le sweep quote-ancré, à confirmer) :**

- `app/(auth)/connexion/_components/sign-in-form.tsx` (l.65) + `router.push` (l.58)
- `app/(auth)/inscription/_components/sign-up-form.tsx` (l.39, 56)
- `app/(auth)/_components/check-email-notice.tsx` (l.35)

- [ ] **Step 1 : Confirmer via Grep** `callbackURL: "/tableau-de-bord"` présent dans ces 3 fichiers ; `callbackURL: "/dashboard"` absent partout.

### Task 3.4 : Vérifier les cibles hors-chaîne + tests + e2e étudiant

Le sweep élargi (Task 3.2 Step 2, roots = app/components/features/constants/hooks/scripts/tests/e2e) couvre les 5 formes. Cette task **vérifie** les cibles que la revue avait identifiées comme angles morts, puis lance la suite.

- [ ] **Step 1 : Cibles hors-chaîne à confirmer converties (F2/F3)**

- **Cron email (F2)** — `features/notifications/cron.ts` (l.80 `${getBaseUrl()}/dashboard/examen-blanc/…`, l.150 `${getBaseUrl()}/dashboard/abonnements`) : ancré sur `}` → doit être `…}/tableau-de-bord/…`. **Confirme via Grep** : `getBaseUrl()}/dashboard` → 0.
- **Imports absolus (F3)** — le `)`-ancre convertit `@/app/(dashboard)/dashboard/…` → `@/app/(dashboard)/tableau-de-bord/…`. **Confirme convertis** (sinon tsc casse) :
  - Source prod : `app/(admin)/admin/profil/page.tsx` (l.1-6, imports `.../profil/_components/*`)
  - Tests : `tests/users/{profile-sessions,profile-notifications,profile-login-methods,profile-danger-zone}.test.tsx` (l.3), `tests/components/OnboardingPage.test.tsx` (l.4 : `.../dashboard/onboarding/page` → `.../tableau-de-bord/bienvenue/page`)
  - Grep gate : `@/app/\(dashboard\)/dashboard/` → **0** match.

- [ ] **Step 2 : Assertions de chemin — tests (à vérifier)**

- `tests/components/OnboardingGuard.test.tsx` (l.60/64/74/78/88/102 — dont `/dashboard/onboarding`→`/tableau-de-bord/bienvenue`)
- `tests/components/OnboardingPage.test.tsx` (l.77/109), `tests/components/auth/sign-in-form.test.tsx` (l.45), `tests/components/auth/check-email-notice.test.tsx` (l.52 `callbackURL`), `tests/users/profile-login-methods.test.tsx` (l.24/42/62 `profilePath`)

- [ ] **Step 3 : Assertions e2e — CHAÎNES _et_ REGEX (F1)**

- **Chaînes** (`goto`/`url`) : `e2e/pages/{dashboard,profil,entrainement,examen-blanc}.page.ts` (l.10), `payment.page.ts` (l.17 ; l.24 → `paiement/succes`), `examen-resultats.page.ts` (l.12) ; `e2e/tests/{error-states.spec.ts:47, payment-access.spec.ts:38/73(→paiement/succes?session_id=…)/83, navigation-student.spec.ts:7/13/14/15/30/43, examen-audience.spec.ts:68/95}`
- **Regex** (`\/…`, angle mort initial) :
  - `e2e/global.setup.ts:17` — `/\/dashboard(\/|$)/` → `/\/tableau-de-bord(\/|$)/` (⚠️ **bloque toute la suite** si raté)
  - `e2e/tests/dashboard.spec.ts` (l.26/33/40 `\/dashboard\/{entrainement,examen-blanc,profil}`)
  - `e2e/tests/examen-blanc-auto-submit.spec.ts:76` (`\/dashboard\/examen-blanc`)
  - `e2e/tests/navigation-student.spec.ts` (l.38 `\/dashboard\/profil`, l.45 `\/dashboard\/abonnements` ; l.21 `new RegExp(link.url)` dérive des données l.13-15 → OK si le tableau est converti)
  - `e2e/pages/entrainement.page.ts` (l.71 `\/dashboard\/entrainement\/` ; **l.117/127 `\/results`→`\/resultats`**)
  - `e2e/tests/resultats-entrainement.spec.ts:33` (`\/results`→`\/resultats`)
  - `e2e/pages/examen-blanc.page.ts:138` (`\/dashboard\/examen-blanc`)
  - `e2e/tests/error-states.spec.ts:50` — `/\/auth\/sign-in|\/dashboard/` : la partie `\/auth\/sign-in`→`\/connexion` a été faite en Phase 2 ; ici `\/dashboard`→`\/tableau-de-bord` → résultat `/\/connexion|\/tableau-de-bord/`

- [ ] **Step 4 : Format + check + tests**

Run: `bun run format && bun run check && bun run test`
Expected: vert (toute la suite). `bun run format` rétablit les newlines finales éventuellement mangées par le sweep `-NoNewline`.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "refactor(routes): /dashboard→/tableau-de-bord (+ bienvenue, paiement/succes, entrainement/resultats, cron, imports)"
```

---

## Phase 4 : Redirections 308 permanentes (`next.config.ts`)

**Files:** Modify `next.config.ts`.

### Task 4.1 : Ajouter `redirects()` à `nextConfig`

- [ ] **Step 1 : Ajouter la clé `redirects` dans l'objet `nextConfig`** (au même niveau que `experimental` / `images`) :

```ts
const nextConfig: NextConfig = {
  experimental: {/* … inchangé … */},
  images: {/* … inchangé … */},
  async redirects() {
    return [
      // — Étudiant — (spécifiques AVANT le wildcard de préfixe)
      {
        source: "/dashboard/entrainement/:sessionId/results",
        destination: "/tableau-de-bord/entrainement/:sessionId/resultats",
        permanent: true,
      },
      {
        source: "/dashboard/onboarding",
        destination: "/tableau-de-bord/bienvenue",
        permanent: true,
      },
      {
        source: "/dashboard/payment/success",
        destination: "/tableau-de-bord/paiement/succes",
        permanent: true,
      },
      {
        source: "/dashboard/:path*",
        destination: "/tableau-de-bord/:path*",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/tableau-de-bord",
        permanent: true,
      },
      // — Admin — (spécifiques AVANT le générique :id)
      {
        source: "/admin/exams/create",
        destination: "/admin/examens/creer",
        permanent: true,
      },
      {
        source: "/admin/exams/edit/:id",
        destination: "/admin/examens/modifier/:id",
        permanent: true,
      },
      {
        source: "/admin/exams/:id/results/:userId",
        destination: "/admin/examens/:id/resultats/:userId",
        permanent: true,
      },
      {
        source: "/admin/exams/:id",
        destination: "/admin/examens/:id",
        permanent: true,
      },
      {
        source: "/admin/exams",
        destination: "/admin/examens",
        permanent: true,
      },
      {
        source: "/admin/users/:path*",
        destination: "/admin/utilisateurs/:path*",
        permanent: true,
      },
      {
        source: "/admin/users",
        destination: "/admin/utilisateurs",
        permanent: true,
      },
      // — Auth —
      { source: "/auth/sign-in", destination: "/connexion", permanent: true },
      { source: "/auth/sign-up", destination: "/inscription", permanent: true },
      {
        source: "/auth/forgot-password",
        destination: "/mot-de-passe-oublie",
        permanent: true,
      },
      {
        source: "/auth/reset-password",
        destination: "/reinitialiser-mot-de-passe",
        permanent: true,
      },
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

- [ ] **Step 1 : Aucune ancienne route ne subsiste (gate AGNOSTIQUE À LA FORME)**

⚠️ **Post-revue (F1)** : ne PAS ancrer sur un guillemet — les assertions e2e sont des regex (`\/…`), les URLs cron des template-literals (`}/…`), les imports des `)/…`. On grep par **sous-chaîne** en excluant les faux positifs légitimes (fichiers composants). Sur `R = app components features constants hooks lib scripts tests e2e proxy.ts` :

```bash
rg -n --glob '!docs/**' '/dashboard' $R | rg -v 'dashboard-shell|admin/dashboard'      # → 0
rg -n --glob '!docs/**' '/admin/(exams|users)' $R | rg -v 'exams-list'                  # → 0
rg -n --glob '!docs/**' '/auth/(sign-in|sign-up|forgot-password|reset-password)' $R      # → 0
rg -n --glob '!docs/**' '/tableau-de-bord/(onboarding|payment)' $R                        # → 0
rg -n --glob '!docs/**' '/results' $R                                                     # → 0 (≠ /resultats)
rg -n --glob '!docs/**' '\(auth\)/auth/' $R                                               # → 0 (imports auth)
rg -n --glob '!docs/**' '@/app/\(dashboard\)/dashboard/' $R                               # → 0 (imports dashboard)
```

Expected: **0** ligne pour chacun.

- [ ] **Step 2 : Suite complète**

Run: `bun run check && bun run test`
Expected: vert, coverage ≥ seuil.

### Task 5.3 : E2E ciblé sur les parcours renommés

- [ ] **Step 1 : Lancer les e2e touchant des routes renommées**

⚠️ **Post-revue (F1)** : le sous-ensemble initial (4 fichiers) laissait `dashboard.spec.ts`, `admin.spec.ts`, `admin-exams.spec.ts`, `examen-blanc-auto-submit.spec.ts` non exécutés alors qu'ils portent des assertions d'URL. `global.setup.ts` (login → attente d'URL) s'exécute de toute façon avant **toute** spec. Lancer l'ensemble des specs à assertions d'URL :

```bash
bun run test:e2e -- auth.spec.ts auth-ux.spec.ts navigation-student.spec.ts navigation-admin.spec.ts \
  dashboard.spec.ts admin.spec.ts admin-exams.spec.ts payment-access.spec.ts \
  examen-blanc-auto-submit.spec.ts resultats-entrainement.spec.ts examen-audience.spec.ts error-states.spec.ts
```

Expected: vert (dont l'auth du `global.setup`). Vérifier visuellement : connexion → `/tableau-de-bord`, onboarding → `/tableau-de-bord/bienvenue`, paiement succès → `/tableau-de-bord/paiement/succes`, résultats entraînement → `.../resultats`, nav admin → `/admin/examens`, `/admin/utilisateurs`.

> Si tu préfères, une passe `bun run test:e2e` complète est plus sûre encore (demander avant — les runs complets sont longs).

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
- **Points d'impact du spec** : constants (P1/P3), liens/href (P1-3), redirect/router.push (P1-3), proxy.ts (P2 auth l.68 + **P3 dashboard l.8/l.63 en édition manuelle** — hors racines du sweep), auth-guards (P2 l.8 + **P3 l.16 manuel**), stripe fallbacks (P3, `features/payments/actions.ts` couvert par le sweep — `features` ∈ racines), forgot-password redirectTo (P2), robots.ts (P2 auth + P3 dashboard), **cron email `features/notifications/cron.ts` (P3, ancre `}`)**, **imports absolus `@/app/(dashboard)/dashboard/…` (P3, ancre `)`)**, e2e chaînes **et regex** (P1-3), tests (P1-3), verify-relogin (P2) ✅
- **SEO/sitemap** : Phase 5 (vérif, aucun changement) ✅
- **Risque ordre proxy↔redirects** : neutralisé — proxy protège les nouveaux chemins ; validé au runtime en P4 Step 3 ✅

## Traçabilité — revue adversariale du 2026-07-02 (verdict initial : NON)

La revue a validé le **design** (ordre redirects→proxy sans boucle, liens reset/Stripe en vol couverts, `safePath` OK, layout `(auth)` non orphelin, ancres de ligne exactes) mais a trouvé un **angle mort systémique** : sweep + gates **quote-ancrés uniquement**. Corrections intégrées :

| #     | Constat                                                                                                | Correctif dans ce plan                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 🔴 F1 | 12 assertions e2e sont des **regex** (`\/…`), 4 fichiers hors périmètre e2e                            | Sweep P1/P3 ancre aussi sur `\` ; gates en **sous-chaîne** (P1 S2, P3 S4, P5 S1) ; e2e élargi (P5 S3) |
| 🟠 F2 | `features/notifications/cron.ts:80,150` URLs email `${getBaseUrl()}/dashboard/…`                       | Sweep P3 ancre sur `}` ; vérif explicite (P3 Task 3.4 S1)                                             |
| 🟠 F3 | 8 imports absolus `@/app/(dashboard)/dashboard/…` (dont `admin/profil/page.tsx` prod) + 2 sources auth | Sweep P3 ancre sur `)` (P3 S2) + P2 Task 2.2 liste les 2 sources ; gate imports (P3 S4, P5 S1)        |
| 🟠 F4 | Sweep P1 non borné corrompt `@/components/admin/exams-list`                                            | Sweep P1 **quote/regex-ancré** + gate excluant `exams-list` (P1 S1/S2)                                |
| 🟠 F5 | `proxy.ts:63` & `auth-guards.ts:16` **hors racines du sweep** (faussement « couverts »)                | Édition **manuelle** explicite (P3 Task 3.2 S1)                                                       |
| 🟠 F6 | Baseline `bun run check` rouge (Prettier sur spec/plan)                                                | Formatage des docs d'abord (P0 S2) — fait ci-dessous                                                  |

Réfutations consignées (§4 du rapport) : pas de boucle de redirection, query préservée, `safePath` sans whitelist bloquante, ancres exactes → **non ré-adressées** (rien à corriger).

## Points de vigilance (résiduels)

1. **proxy.ts & lib/ hors sweep** : `proxy.ts` (l.8 regex `PROTECTED` + l.63 redirect) et `lib/auth-guards.ts:16` sont édités **à la main** (P3 Task 3.2 S1). Re-vérifier en fin de P3 que le gate agnostique (qui INCLUT `proxy.ts` et `lib/`) renvoie 0.
2. **Sweep `-Raw`/`-NoNewline`** : peut manger la newline finale → `bun run format` en fin de P3 la rétablit. Vérifier `git diff --stat`.
3. **`callbackURL`** reporté de P2 à P3 (pointe `/dashboard`) — ne pas franciser deux fois.
4. **Ordre des `-replace`** : préfixe d'abord, feuilles ensuite ; sinon `onboarding`/`payment` restent EN.
5. **`/results` vs `/resultats`** : `\/results` (regex) et `/results` (gate) ne matchent PAS `/resultats` — vérifié, mais rester attentif si un nouveau segment `result*` apparaît.
