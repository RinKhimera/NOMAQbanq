---
paths:
  - "e2e/**"
  - "playwright.config.ts"
  - "components/quiz/**"
  - "app/api/e2e/**"
---

# E2E Testing Rules (Playwright)

Stack actuelle : **Playwright + Bun + Better Auth + Drizzle/Neon**. Config :
`playwright.config.ts`. Tests : `e2e/tests/`. POMs : `e2e/pages/`. Fixtures :
`e2e/fixtures/base.ts`. Setup/teardown : `e2e/global.setup.ts` / `global.teardown.ts`.
Reset/seed : route Next.js `app/api/e2e/route.ts`.

> ⚠️ La suite **mute la base Neon de DEV** (reset participations/sessions + crée des
> transactions `[E2E]` d'octroi d'accès). Ne jamais la lancer contre la prod. La
> route `/api/e2e` répond 404 si `E2E_RESET_SECRET` absent OU `VERCEL_ENV==='production'`.

## Lancer la suite — `bun run test:e2e`, JAMAIS `bunx playwright test`

```bash
bun run test:e2e --reporter=list        # toute la suite
bun run test:e2e e2e/tests/<f>.spec.ts  # un fichier
bun run e2e:ui                          # mode UI
node node_modules/@playwright/test/cli.js test --list   # collecte déterministe (hors Bun)
bunx playwright install chromium        # si « Executable doesn't exist »
```

- **`bunx playwright test` est flaky** : Bun duplique le module `@playwright/test` au
  runtime → ~1 run sur 2 échoue à la **collecte** avec `test.describe() not expected
here` + `No tests found` (faux « tout est cassé »). Passer par le **script**
  (`bun run test:e2e`) ou `node node_modules/@playwright/test/cli.js test`.
- **`npx playwright test` est cassé ici** : `npm error EOVERRIDE` (les `overrides`
  du `package.json` sur `@types/react`). Toujours `bun run`.
- Playwright démarre le serveur lui-même (`webServer` : `bun dev --turbopack` en
  local, `bun run build && bun run start` en CI). Pas besoin de lancer `bun dev`.

## Comptes de test & accès — IMPORTANT

- Comptes (`.env.local`) : `E2E_USER_EMAIL` (= `e2e.student@…`, role `user`),
  `E2E_ADMIN_EMAIL` (= `e2e.examen@…`, role `admin`), mots de passe + `E2E_RESET_SECRET`.
- **Les comptes n'ont AUCUN `user_access` par défaut** (l'étudiant est paywallé).
  `global.setup.ts` octroie exam+training au student via `POST /api/e2e
{ action:"set-access", accessType, grant:true }` avant les tests. L'admin bypasse
  `hasAccess` (pas d'octroi nécessaire).
- Auth = **Better Auth via le formulaire réel** (`global.setup.ts` :
  `getByTestId("auth-email"|"auth-password"|"auth-submit")` sur `/auth/sign-in`),
  storageState sauvegardé dans `e2e/.auth/{user,admin}.json`. Si auth bizarre →
  supprimer `e2e/.auth/` et relancer. (Pas de Clerk.)

## Route support `/api/e2e` (Drizzle) — actions

- `reset-exam` (`userEmail`) : garantit UN examen actif en fenêtre, supprime la
  participation du user dessus (+ cascade réponses) + **TOUTES** ses sessions
  d'entraînement (pas seulement `in_progress`) → remet aussi à zéro la fenêtre du
  rate-limit `MAX_SESSIONS_PER_HOUR` (sinon les sessions accumulées au fil des runs
  saturent la limite). Appelée en setup ET teardown.
- `cleanup` (`prefix`, défaut `"[E2E]"`) : supprime examens préfixés (cascade) +
  questions orphelines préfixées.
- `set-access` (`userEmail`, `accessType:"exam"|"training"`, `grant?:boolean`) :
  octroie/révoque un accès. Idempotent ; l'octroi crée une transaction manuelle
  `[E2E]` si besoin (`user_access.last_transaction_id` est `NOT NULL` FK).
- `seed-restricted-exam` (`title`, `audienceUserEmails[]`, `questionCount?`) : crée
  un examen `restricted` actif (en fenêtre) + son `exam_audience` (réutilise des
  questions de la banque dev). Titre préfixé `[E2E]` → nettoyé par `cleanup`.
- `seed-explanation-image` (`examId`, `remove?`) : attache (ou retire si `remove`)
  une image `kind='explanation'` sur la **1re question** d'un examen. La question
  est PARTAGÉE (banque) → toujours `remove` en teardown (hors cascade examen).
- **À créer** : `seed-exam` (examen `subscribers` dédié, un par fichier) pour
  isoler les specs `examen-blanc*` des collisions d'état (cf. ci-dessous).

## Sélecteurs — `data-testid` obligatoires sur l'interactif

Ne JAMAIS utiliser de sélecteurs CSS génériques (ils matchent la sidebar/header).
Convention quiz : `answer-option-{i}`, `btn-next/previous/finish/flag`,
`btn-header-finish`, `pause-overlay`, `pause-timer`, `btn-resume-exam`,
`explanation-content`, `explanation-images`, `score-percentage`, `score-badge`,
`btn-filter-errors`, `btn-expand-all`, `btn-collapse-all`, `results-nav-item-{i}`.
Autres testids stables : `exam-card-{id}` (carte examen étudiant), `quick-access-{titre}`
(grille dashboard), `exam-side-panel`/`user-side-panel` (panels admin master-détail),
`{testId}-edit`/`-input`/`-save` (InlineEditField profil).
États : `data-selected="true"`, `data-flagged="true"`. Tout nouveau composant
interactif (quiz, **F2 audience**, etc.) doit recevoir un `data-testid` stable.

- **Sidebar = aucun `<nav>`** : la sidebar shadcn ne rend PAS d'élément `<nav>` →
  `page.locator("nav")` ne matche rien et **timeout** (30 s). Scoper les liens de
  navigation via `[data-sidebar="content"]` (puis `getByRole("link", { name })`).

## Gotchas Playwright (à jour)

- **Pas de `waitForLoadState("networkidle")`** : en dev Next.js (HMR websocket +
  tunnel Sentry + fetch charts) le réseau n'est jamais idle → `goto` pend jusqu'au
  **timeout 30 s** sur toute page authentifiée. `page.goto` attend déjà `load` ;
  s'appuyer sur des attentes d'élément explicites (`waitForReady`) ou
  `domcontentloaded` pour les nav SPA. (Retiré de tous les POMs.)
- **Strict mode / texte dupliqué** : après la refonte F1, beaucoup de libellés
  apparaissent 2-3× (sidebar **et** contenu, carte **et** graphe, heading **et**
  description). Préférer `getByRole("heading", { name })`, `{ exact: true }`, ou
  scoper (`page.locator("main")` = le `<main>` du `SidebarInset`). `.first()` en
  dernier recours.
- **Texte responsive** (`hidden sm:inline`) : le texte des boutons nav n'existe pas
  sous 640px → utiliser `getByTestId`.
- **Header sticky `fixed z-50`** : intercepte les clics près du bord →
  `.scrollIntoViewIfNeeded()` avant le click (ex. `answer-option-0` sur `/evaluation/quiz`).
- **Pages légales** (`/confidentialite`, `/conditions`, `/cookies`) : titre en h1
  ET paragraphe → `getByRole("heading", { name })`.
- **Stats marketing dynamiques** : matcher le suffixe par regex, ne pas hardcoder
  les nombres.

## Concurrence & état partagé

- **`workers: 1`** (config, toujours) : `chromium-auth`/`chromium-admin` partagent
  l'état d'un même compte. `describe.configure({ mode: "serial" })` ne protège qu'À
  L'INTÉRIEUR d'un fichier ; `workers:1` protège ENTRE fichiers. Ne jamais repasser
  à >1 worker pour ces projets.
- **Collision examen** : il n'y a qu'UN examen in-window (le reset). Les specs qui
  **consomment/complètent** l'examen (`examen-blanc-auto-submit` s'exécute avant
  `examen-blanc` — tri ASCII `-`<`.`) cassent les suivantes (« Déjà passé »). Chaque
  fichier examen doit **seeder son propre examen** (action `seed-exam` à créer) ou
  reset en `beforeAll`. La pause exige un examen `enablePause:true`.
- **Examen passable une fois** : `startExam` idempotent pour `in_progress` → POM
  `acceptWarningOrResume()`.
- **Timers/auto-submit** : `page.clock.install()` APRÈS que le timer soit visible
  (sinon race sur `serverStartTime`), puis `fastForward("3:00:00")`. Cf.
  `examen-blanc-auto-submit.spec.ts`.

## F2 audience (sémantique pour les specs)

`audienceType ∈ {subscribers, restricted}`. L'appartenance à `exam_audience`
**octroie l'accès même sans abonnement**. Les examens `restricted` sont **masqués
aux non-membres** (liste, dashboard, leaderboard) ; admin voit tout ; `startExam`
refuse un non-membre (`NOT_IN_AUDIENCE`) ; `getExamWithQuestions` → `null`/`notFound`
pour un outsider. **Éligibilité par-examen** (corrigé) : `ExamListItem` expose
`audienceType` et le client calcule `isEligible = hasExamAccess || audienceType==='restricted'`
(un examen `restricted` présent dans la liste implique l'appartenance via le filtre
d'audience) → un membre sans abonnement peut le démarrer. Couvert par `examen-audience.spec.ts`.

## F3 images d'explication (anti-triche)

`explanation-images` n'est rendu qu'en `QuestionCard variant="review"` (correction).
Garanti **absent** en passation : examen (`variant="exam"`, questions mappées sans
explanation) et entraînement test `in_progress`. Correction entraînement : eager
(`getTrainingSessionResults`) ; correction examen : lazy + **après `endDate`**
seulement (`getExamQuestionExplanations`). Vitrine `/evaluation/quiz` = questions
**aléatoires** → n'y tester que l'anti-triche en passation. Seed via
`seed-explanation-image`. **Couverture** : la VRAIE garde anti-fuite est
l'intégration `tests/integration/passation-anti-cheat.test.ts` (seed image
`explanation` + assert `getExamWithQuestions` ne la laisse pas transiter — le
canal DAL) ; l'e2e `examen-explication.spec.ts` n'est qu'un **smoke UI**
(`variant="exam"` ne rend jamais `explanation-*`, donc ne capterait pas une fuite
DAL). L'affichage **à la correction** reste à couvrir en e2e (examen intriqué avec
les collisions d'état ; entraînement = nécessite un seed de session complétée).

## Segmentation projets (`testMatch`)

Chaque fichier de test est listé dans EXACTEMENT UN projet de `playwright.config.ts` :
`chromium` (public, pas d'auth), `chromium-auth` (storageState user),
`chromium-admin` (storageState admin). Tout nouveau spec doit être ajouté au bon
`testMatch`. Un spec à 2 rôles → le splitter (`-student`/`-admin`).

## ESLint + fixtures Playwright

Le callback `use` des fixtures (`e2e/fixtures/base.ts`) déclenche un faux positif
`react-hooks/rules-of-hooks` → garder l'`/* eslint-disable react-hooks/rules-of-hooks */`
en tête de fichier.

## ESM — pas de `__dirname`

`"type": "module"` → `const __dirname = path.dirname(fileURLToPath(import.meta.url))`.

## Gate

`bun run type-check` + `bun run lint` (PAS `bun run check` ni `prettier --check .` —
CRLF working-tree pré-existant = faux signal). `bunx prettier --write` uniquement sur
les fichiers touchés. Warnings SonarLint (`typescript:Sxxxx`) = IDE-only, n'échouent
pas le gate.
