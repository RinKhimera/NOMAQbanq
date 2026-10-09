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

## Pièges de happy-dom (tests de composants)

- happy-dom ne retire pas le focus d'un bouton qui passe à `disabled` : un test
  « le focus reste » y passe à tort. Asserter l'attribut (`aria-disabled`,
  `not.toBeDisabled()`) pendant l'attente, puis le focus.
- `toHaveTextContent` normalise l'espace insécable, `getByRole({ name })` ne le
  fait pas : « 70 % » s'écrit `"70\u00a0%"` dans un nom accessible.

## Tests d'intégration (`tests/integration/**`)

- **`@/email` se remplace par le faux Mailer complet**
  (`tests/helpers/fake-mailer.ts`, `satisfies Mailer`) :
  `vi.mock("@/email", () => import("../helpers/fake-mailer").then((m) => m.fakeMailer))`,
  puis `mailbox.sent` / `mailbox.failNext(verbe, erreur)` / `mailbox.reset()`.
  Jamais un mock partiel : un verbe absent rend `undefined`, l'erreur tombe
  dans le catch par ligne et aucun test ne rougit.
- **`@/lib/stripe` se remplace par le faux Stripe complet**
  (`tests/helpers/fake-stripe.ts`, `satisfies StripePort`) :
  `vi.mock("@/lib/stripe", () => import("../helpers/fake-stripe").then((m) => m.fakeStripe))`,
  puis `stripeBox.calls` / `stripeBox.failNext(verbe, erreur)` / l'état
  (`prices`, `seedCheckoutSession`, `customers`, `nextEvent`) /
  `stripeBox.reset()`. Même raison que le Mailer : un verbe Stripe ajouté au
  port sans son faux ne compile plus, un faux partiel ne masque plus un appel.
- **La base part vide** : un Postgres Docker jetable par run
  (`scripts/test-postgres.ts`), migrations appliquées, aucune donnée de
  référence (aucune migration ne sème de produit ni d'objectif ; seul
  `test-objective` est semé par `vitest.setup.integration.ts`). Un test sème
  tout ce qu'il lit, produit cherché par son code compris. Docker Desktop est
  requis en local.
- **Une migration qui transforme des données a son test de rejeu** : il crée
  des lignes dans l'ancienne forme puis rejoue le SQL du fichier de migration
  (modèle : `medical-domains-migration.test.ts`). La base de test étant vide,
  c'est la seule preuve automatique qu'une migration tient sur des données
  sales (clé nulle, doublon) ; elle s'applique aussi sur develop avant le
  merge.
- Les fichiers d'intégration tournent **en parallèle**, chacun sur une base
  neuve et vide clonée de la base migrée (`tests/helpers/worker-database.ts` :
  une base par worker vitest, recréée à chaque fichier). Chaque fichier sème
  tout ce qu'il lit et compte en valeurs exactes ; aucun nettoyage en fin de
  fichier. Les tests d'un même fichier partagent sa base mais pas leur ordre :
  le projet `integration` mélange l'ordre des tests à chaque run (graine
  affichée en tête, `--sequence.seed=<n>` pour rejouer). Chacun sème donc son
  propre état ; un test qui modifie un état commun du fichier le remet dans
  un `finally` (FK `restrict` : enfants avant parents). Cibler un fichier :
  `bun run test:integration -- <fichier>`.
- **Fixtures partagées** (`tests/helpers/`) : `seedProduct` / `seedAccess`
  (`seed-payments.ts`), `seedAnswers` (`seed-answers.ts`), `holdUserLock`
  (`user-lock.ts`, pour forcer un entrelacement derrière le verrou `user` au
  lieu d'un sommeil), `seedExam` (`seed-exam.ts`).
