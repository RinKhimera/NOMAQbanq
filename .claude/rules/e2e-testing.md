---
paths:
  - "e2e/**"
  - "playwright.config.ts"
  - "components/quiz/**"
  - "convex/testing.ts"
---

# E2E Testing Rules (Playwright)

## Stack

Playwright 1.58 + @clerk/testing 2.0 + Bun. Config: `playwright.config.ts`. Tests: `e2e/tests/`. POMs: `e2e/pages/`.

## Commandes

```bash
bun run test:e2e     # Run all E2E tests
bun run e2e:ui       # Playwright UI mode
bun run e2e:debug    # Debug with inspector
```

**IMPORTANT** : Utiliser `bunx playwright` (pas `npx`). Le projet a `playwright` ET `@playwright/test` dans node_modules (via `@clerk/testing`). `npx` peut resoudre vers le mauvais binaire et causer `test.describe() not expected here`.

## ESM — pas de `__dirname`

Le projet a `"type": "module"` dans `package.json`. Utiliser :

```typescript
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
```

## Selectors — data-testid obligatoires

**IMPORTANT** : Ne JAMAIS utiliser de selecteurs CSS generiques (`button.w-full.text-left`) — ils matchent des elements inattendus (bouton profil sidebar, etc.). Utiliser les `data-testid` :

| Element                     | data-testid             | Fichier source                                    |
| --------------------------- | ----------------------- | ------------------------------------------------- |
| Option reponse N            | `answer-option-{index}` | `components/quiz/question-card/answer-option.tsx` |
| Bouton precedent            | `btn-previous`          | `session-navigation.tsx` + `evaluation/page.tsx`  |
| Bouton suivant              | `btn-next`              | `session-navigation.tsx` + `evaluation/page.tsx`  |
| Bouton terminer (dernier Q) | `btn-finish`            | `session-navigation.tsx` + `evaluation/page.tsx`  |
| Bouton terminer (header)    | `btn-header-finish`     | `session-header.tsx`                              |
| Bouton marquer              | `btn-flag`              | `session-navigation.tsx`                          |

**Data attributes d'etat** :

- `data-selected="true"` sur `answer-option-{index}` quand selectionne
- `data-flagged="true"` sur `btn-flag` quand question marquee

Quand un nouveau composant interactif est cree dans `components/quiz/`, ajouter un `data-testid` stable.

## Gotchas Playwright

- **Strict mode** : `getByText("Correctes")` matche aussi "Incorrectes" et "X/5 correctes". Toujours `{ exact: true }` ou `.first()` quand le texte est un sous-ensemble d'un autre.
- **`.or()` + `.toBeVisible()`** : echoue en strict mode si les DEUX elements sont visibles. Utiliser `.first().waitFor()` a la place.
- **Texte responsive** : Les boutons nav ont `hidden sm:inline` — le texte "Suivant"/"Precedent" n'existe qu'au-dessus de 640px. Preferer `getByTestId` pour ces boutons.
- **`SidebarInset`** = `<main>` : Pour scoper un selecteur au contenu principal (hors sidebar), utiliser `page.locator("main")`.
- **Stats marketing dynamiques** (commit 7ed7530) : `home-landing.tsx` affiche `{stats?.totalUsers ?? "200+"} candidats satisfaits`. Ne JAMAIS hardcoder les nombres dans les tests marketing — matcher le suffixe avec une regex.
- **Pages légales** (`/confidentialite`, `/conditions`, `/cookies`) : le titre apparaît dans h1 ET dans un paragraphe → strict mode violation sur `getByText(...)`. Utiliser `getByRole("heading", { name: "..." })`.
- **Header sticky `fixed z-50`** : intercepte les clicks sur les éléments proches du bord de viewport (ex: `answer-option-0` sur `/evaluation/quiz`). Appeler `.scrollIntoViewIfNeeded()` avant le click.

## Convex real-time et sessions

- **Tests serial obligatoires** : Les tests entrainement/examen partagent l'etat Convex (meme user). `test.describe.configure({ mode: "serial" })`.
- **Session en cours** : Un user peut avoir une session existante. Le POM doit detecter "Session en cours" et l'abandonner avant d'en creer une nouvelle.
- **Resume exam** : L'examen ne peut etre passe qu'une seule fois. `startExam()` est idempotent pour les participations `in_progress` (retourne la participation existante). Apres le 1er `acceptWarning()`, les tests suivants reprennent la session sans warning dialog → utiliser `acceptWarningOrResume()`.
- **Bouton detached** : Convex re-render reactif detache le DOM. Si `element was detached from the DOM, retrying` apparait, c'est normal — augmenter le timeout ou re-query.
- **Evaluation page ≠ SessionNavigation** : La page `examen-blanc/[examId]/evaluation/page.tsx` a ses propres boutons inline (pas le composant `SessionNavigation`). Les `data-testid` doivent etre ajoutes aux DEUX endroits.

## Journey tests pour les describes serial

Quand un describe est en `mode: "serial"` à cause d'un état Convex partagé (entrainement, examen-blanc, examen-resultats), **préférer les journey tests** qui chaînent les assertions dans un seul flow plutôt que des tests isolés qui répètent le même setup.

- **Anti-pattern** : 10 tests qui chacun font `goto → fill form → start session → answer → assert X` (~15s de setup × 10 = 2.5 min redondantes).
- **Bon pattern** : 1 test "journey complet" qui chaîne les assertions + 1-2 tests pour les edge cases (paywall, outils, etc.).

## Workers parallelism — `--workers=1` obligatoire pour auth/admin

`describe.configure({ mode: "serial" })` protège DANS un fichier, pas ENTRE fichiers. Deux fichiers lancés en parallèle sur le même test user entrent en collision sur `userAccess` / `trainingParticipations` / `examParticipations`. Ne JAMAIS passer `--workers=2+` pour `chromium-auth` ou `chromium-admin`. Safe uniquement sur `chromium` (public, pas d'auth).

## Tester un timer/auto-submit avec `page.clock`

Pour tester l'expiration d'un timer sans attendre la vraie durée (examen complet = 10+ min) :

1. Démarrer le flow normalement (goto, start, acceptWarning, etc.)
2. **Attendre que le timer soit visible** (le `serverStartTime` de Convex est alors capturé)
3. `await page.clock.install({ time: new Date() })` — gèle `Date.now()` à maintenant
4. `await page.clock.fastForward("3:00:00")` — avance la clock et fire les `setInterval` callbacks
5. Asserter le toast + redirect

**Critique** : installer la clock AVANT que le timer soit visible causerait une race (serverStartTime réel vs clock gelée → elapsed négatif). Exemple : `e2e/tests/examen-blanc-auto-submit.spec.ts`.

## Auth projects

| Projet           | storageState           | Usage                        |
| ---------------- | ---------------------- | ---------------------------- |
| `chromium`       | aucun                  | Pages publiques (marketing)  |
| `chromium-auth`  | `e2e/.auth/user.json`  | Student sans acces (paywall) |
| `chromium-admin` | `e2e/.auth/admin.json` | Admin avec acces complet     |

Si le user test n'a pas d'acces training/exam, les tests skipent gracieusement via `if (!(await pom.hasAccess())) test.skip()`.

## Project segmentation (`testMatch`)

Chaque fichier de test doit être listé dans le `testMatch` d'EXACTEMENT UN project dans `playwright.config.ts`. Sans segmentation, chaque spec tourne dans les 3 projects → 3× le runtime + échecs silencieux (un spec admin sous auth student échoue mais passe inaperçu).

- `chromium` (no auth) → `marketing`, `auth`, `evaluation-quiz`, `error-states`
- `chromium-auth` → specs student (`dashboard`, `entrainement`, `examen-*`, `profil`, `payment-access`, `navigation-student`)
- `chromium-admin` → `admin-*` + `navigation-admin`

Si un spec concerne deux roles (ex: navigation sidebar), le splitter en 2 fichiers (`-student.spec.ts` / `-admin.spec.ts`) plutôt que de le laisser tourner dans plusieurs projects.

## Reset E2E (`convex/testing.ts`)

Setup ET teardown appellent `POST /e2e/reset-exam` sur le Convex HTTP site (`*.convex.site`). Necessite `E2E_RESET_SECRET` dans l'env Convex (`bunx convex env set`) ET `.env.local`.

Le reset :

1. Trouve ou cree un examen actif (si aucun n'existe, en cree un avec 10 questions de la DB)
2. Supprime la participation du user test pour l'examen actif uniquement (garde les resultats des examens passes)
3. Supprime les sessions d'entrainement `in_progress`

**Schema indexes** : `examParticipations` utilise `by_user` (pas `by_userId`), `examAnswers` utilise `by_participation` (pas `by_participationId`), `trainingParticipations` (pas `trainingSessions`).

## ESLint + custom fixtures Playwright

Le callback `use` des custom fixtures (`e2e/fixtures/base.ts`) déclenche `react-hooks/rules-of-hooks` (faux positif : ce n'est pas un hook React). Ajouter en tête du fichier :

```ts
/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture `use` is not a React hook */
```
