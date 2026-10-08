---
paths:
  - "tests/**"
  - "vitest*.ts"
---

# Tests Vitest (unitaires, composants, intégration)

## Environnement : l'extension décide

- `tests/**/*.test.ts` = projet `unit` : Node, sans DOM ni jest-dom (trois fois
  plus rapide). `tests/**/*.test.tsx` = projet `frontend` : happy-dom +
  jest-dom, pour tout test qui rend un composant ou un hook, ou touche
  `document`. Un test DOM laissé en `.ts` échoue aussitôt (« document is not
  defined ») : le renommer en `.tsx`.
- Cibler un fichier : `bun run test <fichier>` (sans `--`).

## État entre deux tests : la config s'en charge

- `mockReset`, `restoreMocks`, `unstubEnvs`, `unstubGlobals` (`vitest.config.ts`)
  et `vitest.setup.common.ts` (vrais timers après chaque test) remettent tout à
  zéro. Pas de `vi.clearAllMocks()`, `mockReset()`, `mockClear()` en
  `beforeEach`/`afterEach`, ni d'`afterEach(() => vi.useRealTimers())` recopiés.
- `mockReset` efface avant chaque test toute implémentation posée au
  chargement : une valeur par défaut se pose par `vi.fn(impl)` (le reset y
  revient) ou dans un `beforeEach`, jamais par `vi.fn().mockResolvedValue(…)`
  dans une factory `vi.mock`, un `describe` ou un `beforeAll`. Sinon le mock rend
  `undefined` dès le premier test, sans que rien ne rougisse.
- Exception : le projet `integration` garde `clearMocks` sans `mockReset`. Ses
  mocks de session sont posés en `beforeAll`, parce que la base se sème une fois
  par fichier.
- Verrou : `tests/architecture/test-hygiene.test.ts` (resets recopiés,
  implémentations posées au chargement, mocks `next/link` hors liste, caractères
  de contrôle).

## Une assertion se prouve

- Une assertion neuve ou corrigée se prouve par mutation : casser la ligne
  protégée, voir le test tomber, restaurer.
- Un script d'édition (Python, sed) qui écrit `\b` hors chaîne brute pose
  l'octet 0x08 : la regex ne reconnaît plus rien et le test passe à vide.
  Écrire le code avec l'outil d'édition, ou en chaîne brute.
- Vitest n'affiche la console (`console.log`) que pour un test qui échoue :
  pour déboguer, faire échouer l'assertion plutôt que de chercher un log absent.
