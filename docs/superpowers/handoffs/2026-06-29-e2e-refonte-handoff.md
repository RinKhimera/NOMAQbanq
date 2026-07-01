# Handoff — Tests E2E (Playwright) après la refonte quiz (F1/F2/F3)

**Date :** 2026-06-29
**Branche :** `feat/refonte-quiz-audience-images` (tout le travail ici — **rien n'est poussé**)
**Pour :** une session dédiée e2e (Playwright). Le reste de la refonte (F1 runner unifié, F2 audience, F3 images d'explication) est **terminé, revu et vert** côté type-check/lint/unit/intégration. Il manque la **validation e2e**.

> ⚠️ Cette session **mute la base Neon de DEV** (le reset e2e crée/réinitialise examens + participations + sessions des comptes de test). Ne jamais la lancer contre la prod. La route de reset est désactivée si `VERCEL_ENV === "production"`.

---

## Objectif

1. **Établir la baseline** de la suite e2e existante (elle n'a **jamais tourné en CI** → état réel inconnu, dérives probables).
2. **Réparer** les dérives de `data-testid`/POM identifiées (la refonte F1 a renommé/restructuré des composants).
3. **Ajouter la couverture e2e manquante pour F2 (audience d'examen)** — **zéro test aujourd'hui**.
4. **Compléter la couverture F3 (images d'explication)** — affichage à la correction + **assertion anti-triche** (jamais en passation).
5. _(Optionnel)_ Rafraîchir la règle `.claude/rules/e2e-testing.md` (périmée : Clerk/Convex) et **câbler e2e en CI**.

But final : `bun run test:e2e` **vert**, F1/F2/F3 couverts, sans flakiness.

---

## Approche & outils — **`/e2e-scenario` EN PRIORITÉ** (IMPORTANT)

Deux outils, deux temps. **Ne saute pas le temps 1.**

1. **Explorer/valider d'abord avec le skill `/e2e-scenario`** (navigateur réel via `playwright-cli`, rapport factuel en chat). Pour CHAQUE parcours F2/F3 (et pour diagnostiquer les dérives de la suite existante), commence par rejouer le parcours en langage naturel avec `/e2e-scenario`. Ça te donne, sans écrire une ligne de spec : les **vrais sélecteurs/`data-testid` présents** (ou manquants), les **préconditions réelles**, la **confirmation factuelle du comportement** (ex. examen restreint masqué à l'outsider ; image d'explication **absente** en passation). C'est le moyen le plus sûr de découvrir l'état réel avant de coder. `/e2e-scenario` fait déjà du « deps-over-docs » : il croit `package.json`/config, pas la prose périmée → il gère correctement Better Auth + le reset `/api/e2e`.
2. **Codifier ensuite en specs pérennes** dans `e2e/tests/*.spec.ts` (POM + `playwright.config`). C'est le livrable durable. `/e2e-scenario` **ne** remplace **pas** ce travail (il ne sait pas écrire de specs pérennes — c'est explicitement hors de son périmètre) ; il le **dé-risque** : tu codifies un parcours que tu as confirmé qui marche, avec les sélecteurs réels.

> Le skill `/playwright-e2e` (générateur de specs Clerk/Convex) a été **supprimé** (obsolète). Ne pas le chercher. Le savoir « écriture de specs » (POM, config, CI, gotchas projet) est dans le code `e2e/` actuel et doit être consolidé dans `.claude/rules/e2e-testing.md` (tâche D).

---

## État actuel (ground truth — déjà vérifié, ne pas re-découvrir)

La suite est **déjà migrée** vers le stack actuel. Les seules occurrences `Clerk`/`Convex` dans `e2e/**` sont des **commentaires** (aucun import/code actif).

- **Auth = Better Auth** (pas Clerk). `e2e/global.setup.ts` se connecte via le **formulaire réel** : `getByTestId("auth-email")/("auth-password")/("auth-submit")` sur `/auth/sign-in`, puis sauvegarde `e2e/.auth/{user,admin}.json`. Variables `E2E_USER_EMAIL/PASSWORD`, `E2E_ADMIN_EMAIL/PASSWORD` **présentes dans `.env.local`**.
- **Reset/seed = route Next.js Drizzle** : `app/api/e2e/route.ts` (runtime Node), gardée par `E2E_RESET_SECRET` (présent dans `.env.local`), 404 si secret absent ou prod. Actions :
  - `reset-exam` (par `userEmail`) : trouve/étend un examen actif, supprime la participation du user (cascade `examAnswers`) + ses `trainingSessions` en cours. Appelée dans `global.setup.ts` (avant) et `global.teardown.ts` (après).
  - `cleanup` (par `prefix`, défaut `"[E2E]"`) : supprime examens + questions orphelines préfixés. Appelée en teardown.
- **Specs quiz = nouveau runner unifié F1** (`<QuizRunner>`, persistance par réponse, pause repos unique). Les `data-testid` quiz EXISTENT bien (vérifiés) : `answer-option-{i}`, `btn-next/previous/finish/flag`, `btn-header-finish`, `pause-overlay`, `pause-timer`, `btn-resume-exam`, `explanation-content`, `explanation-images`, `score-percentage`, `score-badge`, `btn-filter-errors`, `results-nav-item-{i}`.
- **~21 fichiers de specs, ~70 tests.** Segmentation stricte dans `playwright.config.ts` :
  - `chromium` (public) : `marketing`, `auth`, `auth-ux`, `evaluation-quiz`, `error-states`
  - `chromium-auth` (étudiant, `.auth/user.json`) : `dashboard`, `entrainement`, `examen-blanc*`, `resultats-*`, `profil`, `payment-access`, `navigation-student`
  - `chromium-admin` (admin, `.auth/admin.json`) : `admin*`, `navigation-admin`
- **CI** : `.github/workflows/ci.yml` ne lance **PAS** les e2e (job `quality` = type-check/lint/format/coverage uniquement). Les e2e sont **local-only** aujourd'hui.

---

## Comment lancer (local)

```bash
bun run test:e2e            # toute la suite (Playwright démarre `bun dev` tout seul)
bunx playwright test e2e/tests/entrainement.spec.ts   # un fichier
bun run e2e:ui             # mode UI
bun run e2e:debug          # inspector
```

- **`bunx playwright`, jamais `npx`** (le projet a `playwright` ET `@playwright/test` → npx résout le mauvais binaire → `test.describe() not expected here`).
- Playwright démarre le serveur lui-même (`webServer.command = "bun dev --turbopack"` en local, `reuseExistingServer: true`). Pas besoin de lancer `bun dev` à la main.
- Les `e2e/.auth/*.json` sont (re)générés par `global-setup` à chaque run. Si auth bizarre → supprimer `e2e/.auth/` et relancer.
- ⚠️ Chaque run **réinitialise l'état examen/entraînement des comptes de test sur le Neon de dev**.

---

## ⚠️ Étape 0 (obligatoire) — établir la baseline AVANT de coder

La suite n'a jamais tourné en CI ; **ne présume pas qu'elle est verte**. Lance `bun run test:e2e`, note les échecs réels, distingue : (a) dérives de testid/POM (à réparer), (b) flakiness (timeouts/animations), (c) specs réellement cassées par la refonte. Pour tout échec ambigu, **rejoue le parcours avec `/e2e-scenario`** afin de voir ce que le navigateur fait réellement (vrai sélecteur, vrai libellé) vs ce que la spec attend. Travaille à partir de cette baseline, pas de suppositions.

---

## Travail à faire

### A. Réparer les dérives confirmées (la refonte F1 a bougé des choses)

1. **`btn-expand-all` / `btn-collapse-all` inexistants.** `e2e/tests/entrainement.spec.ts:93-94` clique `[data-testid='btn-expand-all']` et `[data-testid='btn-collapse-all']`, mais les boutons « Tout déplier »/« Tout replier » de `components/quiz/results/session-results.tsx:432-436` **n'ont pas de data-testid**. → Ajoute les testids au composant (`btn-expand-all`/`btn-collapse-all`) OU change le spec pour `getByRole("button", { name: "Tout déplier" })`. Préférer **ajouter les testids** (convention projet).
2. **POM filtre incohérent.** `e2e/pages/examen-resultats.page.ts:52` appelle `getByTestId("btn-filter-incorrect")`, mais le composant expose `btn-filter-errors` (`session-results.tsx:410`). → Corriger le POM en `btn-filter-errors`.
3. Tout autre échec révélé par l'étape 0 (POM/sélecteur qui ne matche plus le runner unifié).

### B. Couverture F2 — audience d'examen (🔴 ZÉRO test aujourd'hui)

> **Commence par `/e2e-scenario`** : rejoue en navigateur réel « admin crée un examen restreint pour le membre X ; le membre X (sans abonnement) le voit et le démarre ; l'outsider abonné ne le voit nulle part et son `startExam` est refusé ». Tu y découvres les sélecteurs réels du picker/radio (et confirmes qu'il faut leur ajouter des `data-testid`) et tu valides factuellement la sémantique avant de codifier.

Rappel sémantique F2 : `audienceType ∈ {subscribers, restricted}` ; **la sélection octroie l'accès** (un membre restreint **sans abonnement** peut passer l'examen) ; les examens restreints sont **masqués aux non-membres** (liste, leaderboard, dashboard) ; admin voit tout.

⚠️ **Pré-requis : ajouter des `data-testid`** aux composants F2 (ils n'en ont **aucun** aujourd'hui) :

- `app/(admin)/admin/exams/create/_components/exam-create-form.tsx` + `.../edit/[id]/_components/exam-edit-form.tsx` : le `RadioGroup` audience utilise des `id` (`audience-subscribers`/`audience-restricted`) mais pas de testid ; `components/admin/user-multi-select.tsx` n'a aucun testid (trigger, items, badges retirables). Ajoute des testids stables (ex. `audience-type-radio`, `audience-user-search`, `audience-user-option-{id}`, `audience-user-badge-{id}`).

Scénarios e2e à écrire (admin crée → étudiants vérifient). Attention : `restricted` octroie l'accès **sans abonnement**, donc il faut un compte étudiant **membre** distinct du `E2E_USER` abonné. Deux options : (a) ajouter un compte de test « membre sans abo » (nouvelle var env + storageState), ou (b) piloter l'accès via la route `app/api/e2e` (étendre `route.ts` avec une action de seed d'audience/retrait d'abo). **Recommandé : étendre `/api/e2e`** (seed d'un examen restreint + ajout/retrait d'un user de l'audience + révocation d'accès) pour un setup déterministe sans multiplier les comptes.

- **admin** : créer un examen `restricted` via le form (radio + picker `UserMultiSelect` recherche serveur) ; la page détail affiche « Utilisateurs autorisés » (composant `restricted-audience-section.tsx`).
- **membre restreint sans abonnement** : voit l'examen dans la liste `/dashboard/examen-blanc`, peut le démarrer, répondre (`saveExamAnswer`), finaliser. _(C'est le cœur de D1 — le point le plus important.)_
- **outsider (abonné, non-membre)** : l'examen restreint est **absent** de la liste, **absent** du dashboard (recent/available), `startExam` **refuse**, le leaderboard est **vide** (après endDate).
- **subscribers (inchangé)** : un examen ouvert reste visible/démarrable par tout abonné.

### C. Couverture F3 — images d'explication (couverture partielle aujourd'hui)

> **Commence par `/e2e-scenario`** : rejoue « une question a une image d'explication ; pendant la passation (examen + entraînement test) l'image est **absente** ; à la correction elle **apparaît** sous l'explication ». L'assertion anti-triche est le point sensible — confirme-la d'abord en navigateur réel, puis codifie-la.

Rappel : images d'explication visibles **uniquement à la correction** (dashboard examen/entraînement + quiz vitrine), **jamais en passation**. Le testid `explanation-images` existe (`components/quiz/question-card/index.tsx:109`, rendu en `variant="review"` seulement). L'upload admin a 2 sections (énoncé/explication) dans `question-form-page.tsx` (ajouter testids si absents).

- **admin** : sur une question, téléverser une image d'explication (section dédiée) — _peut nécessiter un seed via `/api/e2e` ou un upload réel si S3 dev configuré ; sinon seed direct en DB d'une ligne `questionImages kind='explanation'`_.
- **correction entraînement** (`resultats-entrainement.spec.ts`) : après une session complétée contenant cette question, déplier → `explanation-images` **visible**.
- **correction examen** (`resultats-examen.spec.ts`, après endDate) : idem via le lazy-load.
- **🔴 anti-triche (assertion clé)** : **pendant la passation** (examen `variant="exam"` et entraînement mode test), `[data-testid='explanation-images']` est **ABSENT** et aucune image `/explanation/` n'apparaît. C'est la garantie centrale de F3 à verrouiller en e2e.

### D. _(Recommandé)_ Rafraîchir `.claude/rules/e2e-testing.md` — c'est désormais LA source du savoir « specs pérennes »

La règle est **périmée** : elle décrit Clerk (`@clerk/testing`), Convex (`convex/testing.ts`, `.convex.site`, WebSocket). La réalité = Better Auth (formulaire) + reset `app/api/e2e` (Drizzle). Le skill `/playwright-e2e` qui portait ce savoir a été **supprimé** (obsolète) → cette règle devient le dépôt unique des patterns d'écriture de specs. Mettre à jour :

- **Auth** : Better Auth via formulaire (`global.setup.ts`), storageState `e2e/.auth/`. Retirer Clerk.
- **Reset** : `POST /api/e2e` (Drizzle, gardé `E2E_RESET_SECRET`, 404 en prod). Retirer `.convex.site`/WebSocket.
- **Conserver/consolider les patterns encore valides** (issus de l'ex-skill + du code `e2e/` réel) : POM (`e2e/pages/`), fixtures, segmentation projets, `--workers=1` pour auth/admin, `mode: "serial"` pour état partagé, **`page.clock` pour timers/auto-submit** (cf. `examen-blanc-auto-submit.spec.ts`), **page évaluation = boutons inline** (testids à dupliquer), popover profil sidebar à éviter, `bunx` (pas `npx`). Retirer tout ce qui est Convex/WebSocket/`networkidle`.

### E. _(Optionnel)_ Câbler e2e en CI

Ajouter un job `e2e` à `.github/workflows/ci.yml` (après `quality`). Spécificités projet :

- **Pas de Clerk** : secrets = `E2E_USER_EMAIL/PASSWORD`, `E2E_ADMIN_EMAIL/PASSWORD`, `E2E_RESET_SECRET`, et un `DATABASE_URL`/`DATABASE_URL_UNPOOLED` pointant vers **une branche Neon éphémère/preview** (jamais la prod — les e2e mutent la DB). S'inspirer de `scripts/test-integration.ts` (création/migration/destruction de branche Neon) pour provisionner une DB jetable + la seeder (comptes de test + un examen actif).
- `command: bun run build && bun run start` en CI (déjà prévu dans `playwright.config.ts` via `process.env.CI`).
- `bunx playwright install --with-deps chromium`. Upload `playwright-report` en artefact.

---

## Conventions & gotchas (valables pour ce repo)

- **`bunx playwright`, jamais `npx`.**
- **ESM** : `playwright.config.ts`/`global.setup.ts` → `__dirname` via `fileURLToPath(import.meta.url)`.
- **`data-testid` obligatoire** sur tout élément interactif (quiz ET nouveaux composants F2/F3). Pas de sélecteurs CSS génériques (matchent la sidebar/header). Convention quiz : `answer-option-{i}`, `btn-next/previous/finish/flag`, `btn-header-finish`. Attributs d'état : `data-selected="true"`, `data-flagged="true"`.
- **Page d'évaluation = boutons inline** : `app/(dashboard)/dashboard/examen-blanc/[examId]/evaluation/page.tsx` a ses propres boutons (pas `SessionNavigation`) — testids à dupliquer aux deux endroits si besoin.
- **Mode serial + `--workers=1`** pour tout ce qui partage l'état d'un compte (examen/entraînement/admin) — sinon collisions `userAccess`/participations. `describe.configure({ mode: "serial" })` protège DANS un fichier ; `--workers=1` protège ENTRE fichiers sur `chromium-auth`/`chromium-admin`.
- **Examen passable une seule fois** : `startExam` idempotent pour `in_progress` → POM `acceptWarningOrResume()`. Reset entre runs via `/api/e2e`.
- **Timers/auto-submit** : `page.clock.install()` APRÈS que le timer soit visible (sinon race sur `serverStartTime`), puis `fastForward("3:00:00")`. Cf. `examen-blanc-auto-submit.spec.ts`.
- **Strict mode FR** : `{ exact: true }` quand un texte est sous-chaîne d'un autre (« Correctes » vs « Incorrectes ») ; `getByRole("heading", { name })` pour les titres dupliqués (h1 + paragraphe sur les pages légales).
- **Scope `main`** : `page.locator("main")` (le `SidebarInset` shadcn rend un `<main>`) pour éviter de matcher la sidebar.
- **Header sticky** : `.scrollIntoViewIfNeeded()` avant un clic sur un élément proche du bord (ex. `answer-option-0` sur `/evaluation/quiz`).
- **Reset mute la DB de dev** : ne pas lancer contre une base partagée importante ; idéalement une branche Neon dédiée.

---

## Fichiers clés

| Fichier                                                                    | Rôle                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `playwright.config.ts`                                                     | Projets/segmentation, webServer, baseURL                                 |
| `e2e/global.setup.ts`                                                      | Auth Better Auth (formulaire) + reset `/api/e2e`                         |
| `e2e/global.teardown.ts`                                                   | reset + cleanup `[E2E]`                                                  |
| `app/api/e2e/route.ts`                                                     | Reset/seed Drizzle (à ÉTENDRE pour F2 audience / F3 images)              |
| `e2e/fixtures/base.ts`                                                     | Fixtures `entrainement`/`examen`/reset                                   |
| `e2e/pages/*.page.ts`                                                      | POMs (corriger `examen-resultats.page.ts:52`)                            |
| `e2e/tests/*.spec.ts`                                                      | Specs (corriger `entrainement.spec.ts:93-94`)                            |
| `components/quiz/results/session-results.tsx`                              | Boutons déplier/replier sans testid (A1) ; `explanation-images` (review) |
| `components/quiz/question-card/index.tsx:109`                              | `explanation-images` (review only) — assertion anti-triche F3            |
| `app/(admin)/admin/exams/{create,edit}/_components/exam-*-form.tsx`        | Form audience (ajouter testids F2)                                       |
| `components/admin/user-multi-select.tsx`                                   | Picker audience (ajouter testids F2)                                     |
| `app/(admin)/admin/exams/[id]/_components/restricted-audience-section.tsx` | « Utilisateurs autorisés » (détail)                                      |
| `.claude/rules/e2e-testing.md`                                             | Règle PÉRIMÉE (Clerk/Convex) — à rafraîchir (D)                          |

---

## Definition of Done

- [ ] Baseline établie ; dérives A1/A2 (+ autres) corrigées ; suite existante verte.
- [ ] F2 : data-testids ajoutés ; scénarios membre-sans-abo (accès), outsider (refus + masquage liste/dashboard/leaderboard), admin (création + détail) — verts.
- [ ] F3 : affichage images à la correction (entraînement + examen + vitrine) + **assertion anti-triche** (absentes en passation) — verts.
- [ ] `bun run test:e2e` vert localement, sans flakiness (relancer 2× pour confirmer).
- [ ] _(Optionnel)_ règle e2e rafraîchie ; job e2e en CI sur branche Neon éphémère.

> Garde-fous habituels : ne **pas** lancer `bun run check`/`prettier --check`/`--write .` (CRLF working-tree pré-existant = faux signal) ; gate = `bun run type-check` + `bun run lint` à 0/0 pour tout code de composant touché. Ne change le code feature F2/F3 que si un vrai bug e2e le révèle.
