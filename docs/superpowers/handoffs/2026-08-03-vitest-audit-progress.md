# Campagne vitest-audit — état au 2026-08-03

Deux chantiers menés ensemble : création du skill d'audit `vitest-audit`, puis
application de ses conclusions à ce dépôt.

**Branche** : `feat/stripe-fiabilite-paiements` (contenait déjà tout `main` + 3 commits
Stripe au moment d'ajouter ces commits). La PR mêlera donc fiabilité Stripe et couverture
de tests — à séparer si on veut deux PR distinctes.

---

## Fait

### Skill `vitest-audit` — poussé, terminé

Dépôt `claude-config`, commit `ac2fe50`, poussé sur `main`. 9 fichiers, 44 règles.

- `SKILL.md` : procédure, routage conditionnel, format de rapport, frontières.
- `references/detection.md` + 6 catalogues (CFG, COV, MOCK, REL, VAL, INT/CI) +
  `bootstrap.md`.
- Chaque règle : identifiant, sévérité, **détecter**, **pourquoi**, **vérifier avant
  d'affirmer** (les faux positifs), **correctif**.
- Complète le skill `vitest` (manuel d'usage) sans le recouvrir : celui-ci juge et
  configure une suite existante, il n'écrit pas les tests d'une feature.

Validé sur ce dépôt : 5 constats retenus, 3 faux positifs écartés par les blocs de
vérification (REL-04 gère déjà minuit UTC ; INT-02 est un pattern documenté dans
`.claude/rules/data-layer.md` ; COV-02 dégradé de 🔴 à 🟠 car le code est testé, juste
pas mesuré). Le retour d'usage a ensuite produit 9 ajustements du skill, tous intégrés.

### Lot 1 — MOCK-01 + COV-07

- `vitest.config.ts` : `clearMocks`, `restoreMocks`, `unstubEnvs`, `unstubGlobals`
  activées. Vitest les laisse à `false` : sans elles, l'historique d'appels survit d'un
  test au suivant dans un même fichier et un `toHaveBeenCalledTimes` peut passer grâce au
  test précédent. **Mesuré avant d'appliquer : 0 test cassé** (1038 verts).
- `@vitest/coverage-istanbul` retiré (aucun projet ne l'utilisait, `provider: "v8"`).

### Lot 3 — Couverture agrégée frontend + backend

Le seuil de 80 % ne portait que sur `lib`, `hooks`, `components`, `schemas`, `email` :
`features/**` et `app/api/**` n'étaient mesurés par rien, alors qu'ils sont testés par
les 33 fichiers d'intégration.

- `vitest.coverage.config.ts` (nouveau) : périmètre élargi au backend, `app/api/e2e/**`
  exclu (harnais de test), seuils **80 / 74 / 80 / 80**.
- `scripts/test-integration.ts` : un `--project` explicite prime sur le ciblage par défaut.
- `package.json` : `test:coverage:full`.
- `.github/workflows/ci.yml` : le job d'intégration mesure la couverture agrégée ; le job
  `quality` reste le garde-fou rapide sans secret.
- `AGENTS.md` : commande documentée.

**Mesure du 2026-08-03 : 81,85 % stmts · 75,01 % branches · 83,17 % funcs · 83,87 % lines**
(129 fichiers). `bun run check` passe, la commande de CI passe.

---

## À faire

### 1. Remonter les branches de 74 % à 80 % — priorité produit

C'est le seul écart à la politique maison, et il est concentré sur trois fichiers :

| Fichier                        | Branches   | Taille    |
| ------------------------------ | ---------- | --------- |
| `features/payments/actions.ts` | **22,8 %** | 169 stmts |
| `features/exams/actions.ts`    | 66,5 %     | 356 stmts |
| `features/training/actions.ts` | 69,0 %     | 197 stmts |

Il manque **163 branches** pour atteindre 80 %. `payments/actions.ts` est du code de
paiement à 22,8 % de branches — aucune mesure ne le voyait avant cette campagne. C'est la
vraie trouvaille de l'audit. Une fois couvert, remonter `branches: 74` → `80` dans
`vitest.coverage.config.ts` (le commentaire du fichier le rappelle).

### 2. Revue adversariale du skill — `/adversarial-review-prompt`

À lancer **en session fraîche**, sur le contenu de `C:\Code\claude-config\skills\vitest-audit\`.
Les skills jumeaux `stripe` et `sentry-audit` ont chacun eu la leur (commit
`16c4a56` : « corrige 8 constats de la revue adversariale ») ; celui-ci ne l'a pas encore.

Angles à donner au relecteur, par ordre de rendement attendu :

- **Règles jamais vues mordre.** 44 règles écrites en une passe, un seul projet d'essai,
  et ce projet est propre sur la plupart. Beaucoup n'ont donc jamais produit de constat.
- **Faux positifs mal bornés.** Le bloc « vérifier avant d'affirmer » est ce qui fait la
  valeur du skill — chercher les règles dont le bloc est plus faible que la détection.
- **Affirmations techniques non vérifiées.** Les défauts Vitest ont été lus dans les types
  de la version installée, mais certaines règles avancent des comportements (hoisting,
  `mockReset` en v4, sémantique de `include`) qui méritent contre-vérification.
- **Sévérités.** Y a-t-il des 🔴 qui ne décrivent qu'un risque structurel, et des 🟠 qui
  laissent réellement passer des régressions ?
- **Doublons avec le skill `vitest`** (manuel d'usage) : le catalogue doit dire _quoi
  chercher et pourquoi_, pas _comment écrire_.

### 3. Lot 2 — `eslint-plugin-vitest` (non commencé)

Installer, activer le preset recommandé, lancer `bun run lint`, compter les violations.
Rend continues quatre vérifications faites à la main pendant l'audit : `no-focused-tests`,
`expect-expect`, `valid-expect`, `valid-expect-in-promise`, `no-conditional-expect`.
Si le preset produit trop de bruit (règles d'opinion comme `no-conditional-in-test`),
activer ces cinq règles à l'unité.

---

## Faits techniques à ne pas reperdre

Vérifiés pendant la campagne, coûteux à retrouver :

- **`coverage` n'est pas configurable par projet** (`NonProjectOptions`, cf.
  `node_modules/vitest/dist/chunks/reporters.d.*.d.ts`). Un run = un seul périmètre. D'où
  la config dédiée qui lance les deux projets ensemble.
- **`coverage.include` ajoute, il ne restreint pas.** Le périmètre réel est l'union de ce
  que les tests chargent et de ce que l'`include` désigne — des composants sous `app/**`
  apparaissent dans le rapport sans y être listés.
- **Le reporter `text` masque les fichiers à 100 %.** `features/exams/cron.ts`,
  `exams/dal.ts`, `exams/schemas.ts` et `training/cron.ts` semblaient absents du rapport :
  ils sont bien mesurés, à 100 %. Toujours vérifier dans `coverage/coverage-final.json`
  avant de conclure à un trou de mesure.
- **Vitest 4 a supprimé `coverage.all` et inversé le défaut** : sans `coverage.include`,
  seuls les fichiers chargés par un test entrent au rapport — un fichier non testé
  disparaît au lieu de compter pour 0.
- **Marge du seuil frontend** : `branches` y est à 80,26 % pour un seuil de 80. Un seul
  commit peut le casser.
