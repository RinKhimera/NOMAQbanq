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

## Convex real-time et sessions

- **Tests serial obligatoires** : Les tests entrainement/examen partagent l'etat Convex (meme user). `test.describe.configure({ mode: "serial" })`.
- **Session en cours** : Un user peut avoir une session existante. Le POM doit detecter "Session en cours" et l'abandonner avant d'en creer une nouvelle.
- **Resume exam** : L'examen ne peut etre passe qu'une seule fois. `startExam()` est idempotent pour les participations `in_progress` (retourne la participation existante). Apres le 1er `acceptWarning()`, les tests suivants reprennent la session sans warning dialog → utiliser `acceptWarningOrResume()`.
- **Bouton detached** : Convex re-render reactif detache le DOM. Si `element was detached from the DOM, retrying` apparait, c'est normal — augmenter le timeout ou re-query.
- **Evaluation page ≠ SessionNavigation** : La page `examen-blanc/[examId]/evaluation/page.tsx` a ses propres boutons inline (pas le composant `SessionNavigation`). Les `data-testid` doivent etre ajoutes aux DEUX endroits.

## Auth projects

| Projet           | storageState           | Usage                        |
| ---------------- | ---------------------- | ---------------------------- |
| `chromium`       | aucun                  | Pages publiques (marketing)  |
| `chromium-auth`  | `e2e/.auth/user.json`  | Student sans acces (paywall) |
| `chromium-admin` | `e2e/.auth/admin.json` | Admin avec acces complet     |

Si le user test n'a pas d'acces training/exam, les tests skipent gracieusement via `if (!(await pom.hasAccess())) test.skip()`.

## Reset E2E (`convex/testing.ts`)

Setup ET teardown appellent `POST /e2e/reset-exam` sur le Convex HTTP site (`*.convex.site`). Necessite `E2E_RESET_SECRET` dans l'env Convex (`bunx convex env set`) ET `.env.local`.

Le reset :

1. Trouve ou cree un examen actif (si aucun n'existe, en cree un avec 10 questions de la DB)
2. Supprime la participation du user test pour l'examen actif uniquement (garde les resultats des examens passes)
3. Supprime les sessions d'entrainement `in_progress`

**Schema indexes** : `examParticipations` utilise `by_user` (pas `by_userId`), `examAnswers` utilise `by_participation` (pas `by_participationId`), `trainingParticipations` (pas `trainingSessions`).
