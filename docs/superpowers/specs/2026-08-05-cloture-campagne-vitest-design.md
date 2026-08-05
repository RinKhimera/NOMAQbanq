# Clôture de la campagne vitest-audit — couverture DAL + linter

**Date** : 2026-08-05 · **Branche** : `feat/stripe-fiabilite-paiements` (PR #135)
**Précède** : handoff `docs/superpowers/handoffs/2026-08-03-vitest-audit-progress.md`

## Objectif

Terminer la campagne ouverte par l'audit vitest : porter la couverture agrégée de
branches au-dessus de 80 %, y ajouter les trois DAL les plus sensibles, rendre
continues les vérifications de qualité de tests via ESLint, puis verrouiller le
seuil. La sélection des tests se fait **par le risque, pas par le pourcentage** :
chaque test ajouté protège un invariant nommable ; le chiffre suit.

## Décisions actées

| Question | Décision |
| -------- | -------- |
| Ambition | 80 % de branches + couverture des trois DAL (`users`, `training`, `exams/dal.student`) |
| Méthode | Risque d'abord : inventaire d'invariants non testés, le % est une conséquence |
| Seuil final | `branches: 80` — politique maison, alignée sur les trois autres métriques |
| PR #135 | Inchangée, la campagne s'empile dessus ; titre + description requalifiés à la fin |
| Ordre linter/tests | Linter **avant** les nouveaux tests : il se calibre sur les 1038 existants, les nouveaux naissent conformes |
| `schemas.ts:60` | Reformuler le commentaire (la borne vit dans le clamp de la DAL) ; pas de `min`/`max` zod — transformerait un clamp silencieux en refus silencieux, changement de comportement public non motivé |

## Phases

### Phase 0 — Mesure de référence

`bun run test:coverage:full` — **la commande de la CI telle quelle**
(`.github/workflows/ci.yml:90`) : le seuil de la Phase 3 doit être posé sur une mesure
que la CI reproduit. Si des timeouts imposent `--testTimeout=25000`, l'inscrire dans le
script `package.json` (local et CI restent identiques). Première mesure incluant les
195 tests de Server Actions du 2026-08-04. Archiver les chiffres et
`coverage/coverage-final.json` comme base de travail des inventaires.

Dernière mesure connue (avant ces tests) : branches 79,75 % (2506/3142), 8
manquantes pour 80 %. La référence dira si le lot DAL part d'un rattrapage ou
d'au-dessus de la barre — il se fait dans les deux cas.

### Phase 1 — linter vitest (ex-Lot 2 du handoff)

- Installer `@vitest/eslint-plugin` (nom actuel du paquet ; `eslint-plugin-vitest`
  est l'ancien nom, déprécié), activer le preset recommandé **scopé aux fichiers de
  tests** (`tests/**`), lancer `bun run lint`, compter les violations.
- Si le preset est trop bruyant : replier sur les cinq règles qui rendent
  continues les vérifications faites à la main pendant l'audit —
  `no-focused-tests`, `expect-expect`, `valid-expect`,
  `valid-expect-in-promise`, `no-conditional-expect`.
- Corriger les violations sur les tests existants. Un test révélé tautologique
  se corrige (vraie assertion) ou se supprime — pas de désactivation de règle
  au cas par cas sans justification en une ligne. **Aucune suppression dans
  `tests/integration/**`** (le linter couvre ce répertoire mais aucun garde-fou
  de la phase ne relance ses tests).
- Garde-fou : re-mesurer `bun run test:coverage` (frontend seul, gratuit) après
  correction — la marge frontend est de **~5 branches** (80,28 % = 1376/1714 au
  2026-08-05) pour un seuil de 80, un seul test supprimé peut la crever.

### Phase 2 — Couverture des trois DAL, risque d'abord

Ordre : du plus sensible au moins sensible.

| Lot | Fichier | Branches manquantes (avant réf.) | Invariants pressentis |
| --- | ------- | -------------------------------- | --------------------- |
| 2a | `features/exams/dal.student.ts` | 47 (74,3 %) | anti-triche (`isCorrect`/explications jamais servis avant clôture), audience (`memberAudienceWhere`), leaderboard, fenêtres de dates |
| 2b | `features/training/dal.ts` | 40 (69,0 %) | propriété des sessions (IDOR), curseur keyset (`decodeCursor` sur entrée arbitraire), mode tuteur qui retient la correction, clamps |
| 2c | `features/users/dal.ts` | 33 (62,1 %) | self-guard, PII à la frontière (`toAccessInfo`, `toPanelAccess`), `escapeLike` sur les recherches admin, `trendPct` |

Méthode par lot :

1. **Inventaire** : lire le fichier et ses branches non prises dans
   `coverage-final.json` ; en tirer une liste d'invariants nommés (« un
   non-membre de l'audience ne voit pas l'examen », jamais « couvrir la ligne
   940 »). La liste pilote le lot.
2. **Unitaire** (harnais faux-db de `tests/features/`, étendu de quatre maillons :
   `selectDistinct`, `leftJoin`, `groupBy`, `offset`) pour les décisions et
   helpers purs : clamps, décodage de curseur, mappages PII. Un invariant dont
   l'effet vit dans le **prédicat SQL** (ex. `escapeLike` → motif `ilike`) est du
   ressort de l'intégration — le harnais jette l'argument de `.where()`.
3. **Intégration** (branche Neon ; compléter les fichiers existants de
   `tests/integration/` plutôt qu'en créer) uniquement quand la sémantique SQL
   est l'invariant : audience, keyset, agrégats filtrés.
4. Une branche jugée sans enjeu (défensive, inatteignable) : pas de test, une
   ligne de justification dans le handoff. Pas de test-pour-le-chiffre.

Ces DAL ont déjà des tests d'intégration — les % actuels sont le reliquat
*après* eux ; l'inventaire part de ce qui manque, pas de zéro.

Rappels actifs pendant l'écriture :

- Harnais dans `vi.hoisted` (piège MOCK-02 : `Cannot access before initialization`).
- Jamais d'appel au `db` global dans une `db.transaction` (interblocage du pool, max 5).
- Cleanup des données créées par les tests d'intégration.
- Le reporter `text` masque les fichiers à 100 % ; vérifier dans
  `coverage-final.json` avant de conclure à un trou.

### Phase 3 — Verrou + clôture

- Mesure finale : `bun run test:coverage:full` (commande CI, cf. Phase 0).
- `vitest.coverage.config.ts` : `branches: 74 → 80` ; mettre à jour le
  commentaire du bloc (il promet cette remontée). Les autres seuils restent à 80.
- `features/questions/schemas.ts:60` : reformuler le commentaire « bornes
  strictes » — le schéma valide le type, la borne vit dans `clamp(count, 1, 10)`
  côté DAL.
- Handoff : mettre à jour `2026-08-03-vitest-audit-progress.md` (fait / justifications
  des branches non couvertes / campagne close).
- PR #135 : requalifier titre + description en deux volets (fiabilité paiements
  Stripe + couverture backend), via `gh`.

Deux mesures complètes seulement (phases 0 et 3) : chaque `test:coverage:full`
crée une branche Neon et rejoue les migrations. Entre les lots, contrôle ciblé
frontend (`bun run test:coverage`) qui ne coûte rien.

## Critères de fin

- Branches agrégées ≥ 80 % mesurées **et** seuil remonté à 80 (les quatre
  métriques passent leur seuil).
- `bun run check`, `bun run test`, `bun run test:coverage:full` verts.
- Linter vitest actif (porté par `bun run lint`, déjà dans la CI).
- Handoff à jour, PR #135 requalifiée.

## Hors périmètre

- `components/quiz/runner/quiz-runner.tsx` (55 branches à 0 %) : composant
  d'orchestration React, harnais différent, mieux servi par les e2e existants.
  Reste au backlog.
- Séparation de la PR #135 en deux PR.
- Toute retouche de comportement applicatif (la campagne n'ajoute que des tests,
  de la config et des commentaires).

## Risques

| Risque | Parade |
| ------ | ------ |
| Correctifs ESLint qui suppriment des tests → seuil frontend (marge ~5 branches) | Re-mesure frontend après la phase 1 ; rétablir + vraie assertion plutôt que supprimer |
| Preset ESLint trop bruyant | Repli sur les 5 règles à l'unité (décision déjà au handoff) |
| Conclusion hâtive « fichier non mesuré » | `coverage.include` matche en sous-chaîne ; vérifier `coverage-final.json` |
| Interblocage pool pg dans les tests d'intégration | Résoudre les lectures avant d'ouvrir la transaction |

## Fin de campagne

Générer un prompt de revue adversariale (`/adversarial-review-prompt`) pour une
session fraîche. Pas de `/e2e-scenario` : aucun comportement utilisateur
n'est ajouté.
