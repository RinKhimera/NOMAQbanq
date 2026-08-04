# Campagne vitest-audit — état au 2026-08-04

Deux chantiers menés ensemble : création du skill d'audit `vitest-audit`, puis
application de ses conclusions à ce dépôt.

**Branche** : `feat/stripe-fiabilite-paiements` → **PR #135 ouverte**
(https://github.com/RinKhimera/NOMAQbanq/pull/135). Elle mêle fiabilité Stripe et
couverture de tests — à séparer si on veut deux PR distinctes.

---

## Fait

### Skill `vitest-audit` — poussé, revu, corrigé

Dépôt `claude-config`, `ac2fe50` puis **`bde7d9f`** (correctifs de revue), poussés sur
`main`. 9 fichiers, 44 règles.

- `SKILL.md` : procédure, routage conditionnel, format de rapport, frontières.
- `references/detection.md` + 6 catalogues (CFG, COV, MOCK, REL, VAL, INT/CI) +
  `bootstrap.md`.
- Chaque règle : identifiant, sévérité, **détecter**, **pourquoi**, **vérifier avant
  d'affirmer** (les faux positifs), **correctif**.
- Complète le skill `vitest` (manuel d'usage) sans le recouvrir : celui-ci juge et
  configure une suite existante, il n'écrit pas les tests d'une feature.

**Revue adversariale faite le 2026-08-04** (session séparée) : verdict initial NON,
7 constats, tous vérifiés indépendamment dans le paquet installé avant correction, tous
corrigés dans `bde7d9f`.

| Constat | Correction |
| ------- | ---------- |
| 🔴 « `coverage.include` ajoute » | **Faux** : `isIncluded` filtre chaque résultat, fichiers testés compris (`@vitest/coverage-v8/dist/provider.js:247`). L'`include` RESTREINT. Neutralisait COV-01/COV-02. |
| 🔴 « `restoreMocks` restaure les faux timers » | **Faux** : `restoreAllMocks` ne parcourt que `MOCK_RESTORE` (`@vitest/spy/dist/index.js:467`). MOCK-04 devenait un faux négatif systématique. |
| 🟠 MOCK-03 | Vitest 4 lève une erreur nommée sur un export omis (pas `undefined`, pas de casse « en production »). Détection resserrée, 🟠 → 🟡. |
| 🟠 CI-01 | `watch: !isCI && process.stdin.isTTY && !isAgent` — trois conditions, pas une. 🔴 → 🟠. |
| 🟠 CI-02 | `allowOnly: !isCI` : un `.only` FAIT échouer la CI. Le correctif proposait un défaut déjà actif. |
| 🟠 Trou | Les motifs d'`include` matchent en **sous-chaîne** (`contains: true`) : `"lib/**/*.ts"` capture `features/*/lib/*.ts`. Ajouté au garde-fou de COV-02. |
| 🟡 bootstrap | Plugin Vite du framework absent de l'installation et du gabarit. |

Reste non établi : la sémantique v3 de `mockReset` (aucun projet v3 sous la main). Le
skill dit maintenant de la vérifier sur place avant de s'en servir.

### Lot 1 — MOCK-01 + COV-07 (commit `b61eed1`)

- `vitest.config.ts` : `clearMocks`, `restoreMocks`, `unstubEnvs`, `unstubGlobals`
  activées. **Mesuré avant d'appliquer : 0 test cassé** (1038 verts).
- `@vitest/coverage-istanbul` retiré (aucun projet ne l'utilisait, `provider: "v8"`).

### Lot 3 — Couverture agrégée frontend + backend (commit `84ccdfb`)

`features/**` et `app/api/**` n'étaient mesurés par rien.

- `vitest.coverage.config.ts` (nouveau) : périmètre élargi au backend, `app/api/e2e/**`
  exclu, seuils **80 / 74 / 80 / 80**.
- `scripts/test-integration.ts` : un `--project` explicite prime sur le ciblage par défaut.
- `package.json` : `test:coverage:full`. `.github/workflows/ci.yml` : le job d'intégration
  mesure la couverture agrégée. `AGENTS.md` : commande documentée.

### Lot 4 — Couverture des Server Actions (2026-08-04)

C'était la trouvaille de l'audit : `payments/actions.ts` à **22,8 %** de branches, du code
de paiement qu'aucune mesure ne voyait.

| Fichier | branches avant | après |
| ------- | -------------- | ----- |
| `features/payments/actions.ts` | 22,8 % | **94,0 %** |
| `features/training/actions.ts` | 69,0 % | **92,9 %** |
| `features/exams/actions.ts` | 66,5 % | **86,2 %** |
| `features/questions/actions.ts` | 72,9 % | **83,3 %** |
| `app/api/cron/close-expired/route.ts` | 0 % | couvert (7 cas) |
| **Global branches** | **75,01 %** | **79,75 %** puis mesure finale en cours |

Six fichiers de tests ajoutés (195 cas), `bun run check` vert :

- `tests/features/payments-actions.test.ts` (32) — gardes, zod, mapping d'erreurs,
  revalidation, et le repli interne de `safePath` sur `success_url`/`cancel_url`/
  `return_url` (anti open-redirect).
- `tests/integration/payments-actions.test.ts` (10) — corps des `db.transaction` sur vraie
  base : octroi combo exam+training, refund qui restaure l'échéance précédente, refus des
  transactions Stripe, recompute avant DELETE (FK restrict).
- `tests/features/exams-actions.test.ts` (78) — les 8 messages de `finalizeExam`, les 5 de
  `startExam`, budget-temps refusé **à l'écriture** (anti-triche), pause déjà utilisée,
  plafonnement de la durée de pause, `isCorrect` jamais renvoyé.
- `tests/features/training-actions.test.ts` (52) — gardes de propriété (IDOR) sur les
  quatre actions de session, expiration → `abandoned`, mode tuteur qui **retient la
  correction** quand la question appartient à un examen ouvert, gardes de statut contre
  une clôture concurrente du cron.
- `tests/features/questions-actions.test.ts` (26) — refus silencieux du quiz public (aucun
  oracle), jeton HMAC couvrant les ids servis, exclusion des questions d'examen ouvert,
  et l'arbitrage **hard → soft delete** par violation de FK (23001/23503).
- `tests/features/cron-close-expired.test.ts` (7) — garde fail-closed, et l'invariant
  documenté que rien ne vérifiait : un échec de la clôture des examens **ne bloque pas
  l'anonymisation RGPD**, le 500 n'arrive qu'après avoir tout tenté.

### Correctifs de la revue appliqués à CE dépôt (commit `4f9e5e1`)

Deux artefacts du dépôt portaient les affirmations fausses corrigées dans le skill :

- `vitest.config.ts` : le commentaire disait que `restoreMocks` rend les
  `afterEach(() => vi.useRealTimers())` inutiles — il invitait à supprimer des garde-fous
  encore nécessaires. Le dépôt appaire correctement partout, aucune fuite réelle.
- ce handoff : « l'`include` ajoute » → il restreint (+ le matching en sous-chaîne).

---

## À faire

### 1. Finir les 80 % de branches et remonter le seuil

Dernière mesure connue : **79,75 %** (2506/3142) — il manquait **8 branches**. Le fichier
de tests du cron (13 branches à 0 %) a été ajouté depuis ; **la mesure qui le prend en
compte n'a pas été relue** (lancée en fin de session). Première chose à faire :

```bash
bun run test:coverage:full -- --testTimeout=25000
```

Si ≥ 80 % : remonter `branches: 74` → `80` dans `vitest.coverage.config.ts` (le
commentaire du fichier le rappelle). Sinon, prendre le reliquat dans la table ci-dessous.

Gisements restants, par branches manquantes :

| Fichier | manquantes | % |
| ------- | ---------- | - |
| `components/quiz/runner/quiz-runner.tsx` | 55 | **0 %** — aucun test |
| `features/exams/dal.student.ts` | 47 | 74,3 % |
| `features/training/dal.ts` | 40 | 69,0 % |
| `features/exams/actions.ts` | 33 | 86,2 % |
| `features/users/dal.ts` | 33 | 62,1 % |
| `features/questions/dal.ts` | 20 | 77,3 % |
| `features/payments/dal.ts` | 16 | 78,7 % |

### 2. Lot 2 — `eslint-plugin-vitest` (non commencé)

Installer, activer le preset recommandé, lancer `bun run lint`, compter les violations.
Rend continues quatre vérifications faites à la main pendant l'audit : `no-focused-tests`,
`expect-expect`, `valid-expect`, `valid-expect-in-promise`, `no-conditional-expect`.
Si le preset produit trop de bruit, activer ces cinq règles à l'unité.

### 3. Point mineur relevé au passage, non corrigé

`features/questions/schemas.ts:60` annonce des « bornes strictes » sur les entrées
publiques du quiz, mais `loadRandomQuizQuestionsSchema` ne valide que le **type** de
`count` (`z.number().int()`, sans `min`/`max`). La borne réelle est `clamp(count, 1, 10)`
dans la DAL — aucun risque, mais le commentaire décrit une garantie que le schéma ne porte
pas. Décision laissée à l'auteur.

---

## Faits techniques à ne pas reperdre

Vérifiés dans le paquet installé (Vitest 4), coûteux à retrouver :

- **`coverage` n'est pas configurable par projet** (`NonProjectOptions`). Un run = un seul
  périmètre. D'où la config dédiée qui lance les deux projets ensemble.
- **`coverage.include` RESTREINT** : `isIncluded` est appliqué à chaque résultat de
  couverture, y compris aux fichiers réellement chargés par un test
  (`node_modules/@vitest/coverage-v8/dist/provider.js:247`). Un fichier importé par un test
  mais hors `include` est absent du rapport.
- **Les motifs d'`include` matchent en sous-chaîne** (`pm.isMatch(…, { contains: true })`,
  `vitest/dist/chunks/coverage.*.js`) : `"lib/**/*.ts"` capture aussi
  `features/users/lib/*.ts`, `"components/**"` capture `app/_components/**`. C'est ce qui
  fait apparaître au rapport des fichiers sous `app/**` qu'aucun motif ne nomme.
- **Aucune option de config ne restaure les faux timers** : `restoreAllMocks` ne parcourt
  que le registre des espions. `afterEach(() => vi.useRealTimers())` reste obligatoire.
  `isolate: true` (défaut) borne la fuite au fichier.
- **Vitest 4 lève sur un export manquant d'un mock** (`No "x" export is defined on the "y"
  mock`) — le mock partiel est bruyant, pas silencieux.
- **`allowOnly: !isCI`** et **`watch: !isCI && process.stdin.isTTY && !isAgent**` — un
  `.only` fait échouer la CI ; le mode veille ne s'active pas sans TTY.
- **Le reporter `text` masque les fichiers à 100 %.** Toujours vérifier dans
  `coverage/coverage-final.json` avant de conclure à un trou de mesure.
- **Marge du seuil frontend** : `branches` y est à 80,26 % pour un seuil de 80. Un seul
  commit peut le casser.

### Le harnais de test réutilisé pour les Server Actions

Les quatre fichiers `tests/features/*-actions.test.ts` partagent un faux `db` d'une
trentaine de lignes, à recopier pour le prochain domaine :

- les lignes sont servies **indexées par nom de table** (`mocks.rows.current.exams`), pas
  en file d'attente — les tests ne cassent pas si l'ordre des requêtes change dans
  l'action ;
- la chaîne de requête est *thenable* : chaque méthode se renvoie elle-même, donc `await`
  fonctionne quel que soit le maillon terminal (`.limit()`, `.where()`, `.values()`) ;
- `db.transaction` est simulé **au niveau du résultat** (`mockRejectedValueOnce(new
  Error("TX_NOT_FOUND"))`) pour couvrir le mapping d'erreurs sans rejouer le SQL ; un
  helper `runCallback()` exécute réellement le callback quand les branches à couvrir sont
  DANS la transaction (pause/reprise d'examen) ;
- **tout le harnais vit dans `vi.hoisted`** : `vi.mock` est remonté au-dessus des `const`
  du module, et un `fakeDb` déclaré normalement donne `Cannot access 'fakeDb' before
  initialization` (piège rencontré pour de vrai, règle MOCK-02).

La sémantique SQL correspondante reste couverte par les tests d'intégration sur branche
Neon — le découpage est volontaire : unitaire pour les décisions, intégration pour la base.
