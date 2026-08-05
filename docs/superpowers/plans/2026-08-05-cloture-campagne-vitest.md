# Clôture campagne vitest-audit — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (préférence
> utilisateur : exécution inline) to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal :** Porter la couverture agrégée de branches ≥ 80 %, couvrir les invariants des trois
DAL sensibles, activer le linter vitest, verrouiller le seuil à 80 et clore la PR #135.

**Architecture :** Campagne de tests sur code existant — aucun comportement applicatif ne
change. Sélection des tests par le risque (invariants nommés), le % est une conséquence.
Unitaire (harnais faux-db de `tests/features/`) pour les décisions ; intégration (branche
Neon) pour la sémantique SQL. Linter installé AVANT les nouveaux tests.

**Tech stack :** Vitest 4 (projets `frontend`/`integration`), `@vitest/coverage-v8`,
`@vitest/eslint-plugin`, branche Neon éphémère via `scripts/test-integration.ts`.

**Spec :** `docs/superpowers/specs/2026-08-05-cloture-campagne-vitest-design.md`

**Règle spéciale « tests sur code existant »** : contrairement au TDD classique, un test
écrit ici doit passer **du premier coup** (il caractérise un comportement déjà en place).
Un test qui échoue = soit l'invariant supposé est faux (corriger le test), soit un **vrai
bug** → s'arrêter, le signaler à l'utilisateur avant de toucher au code applicatif.

---

### Task 0 : Mesure de référence

**Files :** aucun (mesure seule)

- [ ] **Step 0.1 : Lancer la mesure agrégée**

```bash
bun run test:coverage:full -- --testTimeout=25000
```

Attendu : tous les tests verts (~1233 : 1038 frontend + 195 nouveaux + intégration), tableau
de couverture final. Noter les 4 métriques globales et le % branches de :
`features/exams/dal.student.ts`, `features/training/dal.ts`, `features/users/dal.ts`.

- [ ] **Step 0.2 : Archiver la base de travail**

```bash
cp coverage/coverage-final.json coverage/coverage-baseline.json
```

(`/coverage` est gitignoré — copie locale pour les inventaires des Tasks 3-5.)

- [ ] **Step 0.3 : Constat**

Si branches globales ≥ 80 % : le lot DAL part d'au-dessus de la barre (il se fait quand
même — décision de spec). Si < 80 % : noter l'écart, il sera comblé par les lots.

---

### Task 1 : Linter vitest sur `tests/**`

**Files :**
- Modify: `package.json` (devDependency)
- Modify: `eslint.config.mjs`
- Modify: tests existants selon violations

- [ ] **Step 1.1 : Installer**

```bash
bun add -d @vitest/eslint-plugin
```

(Nom actuel du paquet — `eslint-plugin-vitest` est l'ancien nom, déprécié.)

- [ ] **Step 1.2 : Activer le preset recommandé, scopé aux tests**

Dans `eslint.config.mjs`, ajouter l'import en tête (ordre Prettier : npm avant `@/`) :

```js
import vitest from "@vitest/eslint-plugin"
```

puis étendre le bloc existant `files: ["tests/**/*.{ts,tsx}"]` (ligne ~30) :

```js
  {
    files: ["tests/**/*.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      "@next/next/no-img-element": "off",
      ...vitest.configs.recommended.rules,
    },
  },
```

- [ ] **Step 1.3 : Compter les violations**

```bash
bun run lint 2>&1 | tail -5
```

**Porte de décision** : si le preset produit un bruit disproportionné (violations
majoritairement stylistiques, sans lien avec la valeur des tests), remplacer
`...vitest.configs.recommended.rules` par les cinq règles de l'audit :

```js
      "vitest/no-focused-tests": "error",
      "vitest/expect-expect": "error",
      "vitest/valid-expect": "error",
      "vitest/valid-expect-in-promise": "error",
      "vitest/no-conditional-expect": "error",
```

- [ ] **Step 1.4 : Corriger les violations**

Doctrine : un test tautologique révélé par `expect-expect` reçoit une vraie assertion ou
disparaît. Un `eslint-disable` ponctuel exige une justification d'une ligne (le « pourquoi »
non évident, pas de narration). Pas de désactivation de règle globale.

- [ ] **Step 1.5 : Vérifier que rien n'a cassé**

```bash
bun run test
```

Attendu : tous verts, aucun test perdu par accident (comparer le compte au Step 0.1).

- [ ] **Step 1.6 : Garde-fou marge frontend**

```bash
bun run test:coverage 2>&1 | tail -15
```

Attendu : branches frontend ≥ 80 % (marge de départ : 80,26 %). Si un test supprimé a crevé
le seuil : couvrir l'équivalent proprement avant de continuer.

- [ ] **Step 1.7 : Check complet + commit**

```bash
bun run check
git add -A
git commit -m "test(lint): active @vitest/eslint-plugin sur tests/**"
```

---

### Task 2 : Outil d'inventaire des branches non prises

**Files :**
- Create: `<scratchpad>/uncovered.ts` (hors repo — outil jetable)

- [ ] **Step 2.1 : Écrire le script**

```ts
// Usage : bun uncovered.ts features/exams/dal.student.ts
const target = process.argv[2].replaceAll("\\", "/")
const cov = await Bun.file("coverage/coverage-baseline.json").json()
const entry = Object.entries(cov).find(([k]) =>
  (k as string).replaceAll("\\", "/").endsWith(target),
)
if (!entry) throw new Error(`${target} absent du rapport`)
const d = entry[1] as {
  b: Record<string, number[]>
  branchMap: Record<
    string,
    { type: string; locations: { start: { line: number } }[] }
  >
}
for (const [id, counts] of Object.entries(d.b)) {
  const loc = d.branchMap[id]
  counts.forEach((n, i) => {
    if (n === 0)
      console.log(
        `L${loc.locations[i]?.start.line ?? "?"}  ${loc.type}  branche ${i}`,
      )
  })
}
```

- [ ] **Step 2.2 : Vérifier sur un fichier connu**

```bash
cd <scratchpad> && bun uncovered.ts features/users/dal.ts
```

Attendu : liste de lignes (33 branches avant référence). Lancer depuis la racine du repo ou
ajuster le chemin du JSON.

---

### Task 3 : Lot exams — `features/exams/dal.student.ts` (le plus sensible)

**Files :**
- Create: `tests/features/exams-dal-student.test.ts` (unitaire)
- Modify: `tests/integration/exam-audience.test.ts`, `tests/integration/passation-anti-cheat.test.ts` (compléter, pas créer)

- [ ] **Step 3.1 : Inventaire**

```bash
bun <scratchpad>/uncovered.ts features/exams/dal.student.ts
```

Croiser chaque ligne avec le code et la transformer en invariant **nommé**. Invariants
pressentis (spec §Phase 2, vérifiés dans le code) :

- `getExamQuestionExplanations` : sans session → `[]` ; `questionIds` vide → `[]` ;
  non-admin ne reçoit que les questions autorisées ; examen **non clos**
  (`endDate > now`) → exclu (anti-fuite pendant la fenêtre, `dal.student.ts:687`) ;
  ids dupliqués dédupliqués ; questions verrouillées (`locked`) retenues.
- `memberAudienceWhere` (`dal.student.ts:933`) : `audienceType = "subscribers"` passe ;
  liste d'invités : membre passe, non-membre exclu — sémantique SQL → **intégration**
  (`exam-audience.test.ts`).
- `getExamAnswersForParticipation` / `getExamSubmissionSummary` : jamais `isCorrect` ni
  explication avant clôture — compléter `passation-anti-cheat.test.ts` si l'inventaire
  montre des branches non prises.
- `getExamLeaderboard`, `getMyDashboardStats`, fenêtres de dates : selon inventaire.

Toute branche sans enjeu (défensive, inatteignable) : pas de test, une ligne de
justification à reporter dans le handoff (Task 7).

- [ ] **Step 3.2 : Tests unitaires — gardes et mappages**

Créer `tests/features/exams-dal-student.test.ts` sur le harnais de
`tests/features/training-actions.test.ts` (recopier le bloc `vi.hoisted` + les `vi.mock`
de `@/db` et `@/db/schema`, adapter les tables). Squelette des premiers cas :

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getExamQuestionExplanations } from "@/features/exams/dal.student"

// Harnais recopié de tests/features/training-actions.test.ts (vi.hoisted +
// fakeDb indexé par table). Adapter les tables mockées de @/db/schema :
// exams, examQuestions, examParticipations, questionExplanations…

describe("getExamQuestionExplanations", () => {
  it("renvoie [] sans session", async () => {
    mocks.session.current = null
    expect(await getExamQuestionExplanations(["q1"])).toEqual([])
  })

  it("renvoie [] pour une liste vide sans toucher la base", async () => {
    expect(await getExamQuestionExplanations([])).toEqual([])
  })
})
```

- [ ] **Step 3.3 : Lancer les unitaires du lot**

```bash
bunx vitest run --project frontend tests/features/exams-dal-student.test.ts
```

Attendu : PASS du premier coup (règle spéciale en tête de plan). FAIL → invariant faux ou
vrai bug ; dans le doute, signaler avant de continuer.

- [ ] **Step 3.4 : Tests d'intégration — sémantique SQL**

Compléter `tests/integration/exam-audience.test.ts` (et `passation-anti-cheat.test.ts` si
l'inventaire l'exige) avec les cas d'audience manquants. Respecter le cleanup des données
créées et **jamais d'appel au `db` global dans une `db.transaction`** (pool max 5 →
interblocage). Lancer en ciblé :

```bash
bun run test:integration -- tests/integration/exam-audience.test.ts
```

- [ ] **Step 3.5 : Contrôle de couverture du fichier (sans Neon)**

```bash
bunx vitest run --config vitest.coverage.config.ts --coverage --project frontend 2>&1 | grep "dal.student"
```

Note : sans le projet `integration`, les seuils globaux échoueront — **ignorer l'exit
code**, ne lire que la ligne du fichier. Le chiffre vrai vient de la Task 6.

- [ ] **Step 3.6 : Check + commit**

```bash
bun run check
git add -A
git commit -m "test(couverture): couvre les invariants de exams/dal.student"
```

---

### Task 4 : Lot training — `features/training/dal.ts`

**Files :**
- Create: `tests/features/training-dal.test.ts`
- Modify: `tests/integration/training.test.ts` ou `training-mode.test.ts` (compléter)

- [ ] **Step 4.1 : Inventaire**

```bash
bun <scratchpad>/uncovered.ts features/training/dal.ts
```

Invariants pressentis :

- **IDOR** : `getTrainingSessionById` renvoie `null` si `userId ≠ session.user.id` et rôle
  ≠ admin (`dal.ts:539`) ; l'admin passe.
- **Curseur keyset** : `decodeCursor` (privé — tester via `getTrainingHistory`) : curseur
  corrompu (pas de `|`, date invalide, base64 arbitraire) → traité comme première page,
  pas de crash ; round-trip via le `nextCursor` renvoyé.
- **Mode tuteur / anti-triche** : `correctAnswer`/`explanation`/`explanationImages`
  absents tant que la session n'est pas `completed` (forme-pont, `dal.ts:65`).
- `clamp` aux bornes (via les fonctions publiques qui l'utilisent).
- Expiration de session, `getTrainingStats` sur historique vide : selon inventaire.

- [ ] **Step 4.2 : Test unitaire complet du garde IDOR** (premier cas, harnais identique)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTrainingSessionById } from "@/features/training/dal"

// Harnais : vi.hoisted + fakeDb (tests/features/training-actions.test.ts),
// mocks supplémentaires : @/lib/dal (getCurrentSession), @/lib/cdn (cdnUrl),
// @/features/exams/dal (getOpenExamLockedQuestionIds).

describe("getTrainingSessionById — propriété", () => {
  beforeEach(() => {
    mocks.rows.current = {
      training_sessions: [
        { id: "s1", userId: "autre", status: "active", mode: "practice" },
      ],
    }
  })

  it("refuse la session d'un autre utilisateur", async () => {
    mocks.session.current = { user: { id: "u1", role: "user" } }
    expect(await getTrainingSessionById("s1")).toBeNull()
  })

  it("laisse passer l'admin", async () => {
    mocks.session.current = { user: { id: "u1", role: "admin" } }
    expect(await getTrainingSessionById("s1")).not.toBeNull()
  })
})
```

- [ ] **Step 4.3 : Lancer, compléter les autres invariants de l'inventaire**

```bash
bunx vitest run --project frontend tests/features/training-dal.test.ts
```

- [ ] **Step 4.4 : Intégration si l'inventaire l'exige** (keyset réel, agrégats)

```bash
bun run test:integration -- tests/integration/training.test.ts
```

- [ ] **Step 4.5 : Contrôle fichier + check + commit**

```bash
bunx vitest run --config vitest.coverage.config.ts --coverage --project frontend 2>&1 | grep "training/dal"
bun run check
git add -A
git commit -m "test(couverture): couvre les invariants de training/dal"
```

---

### Task 5 : Lot users — `features/users/dal.ts`

**Files :**
- Create: `tests/features/users-dal.test.ts`
- Modify: `tests/integration/users-admin-dal.test.ts` (compléter si besoin)

- [ ] **Step 5.1 : Inventaire**

```bash
bun <scratchpad>/uncovered.ts features/users/dal.ts
```

Invariants pressentis :

- **Frontière d'accès** : `toAccessInfo` (privé — via `getCurrentUser`) : accès expiré →
  `null` ; `toPanelAccess` (via `getUserPanelData`) : expiré → `isActive: false`,
  `daysRemaining: 0` (les deux mappages divergent volontairement, `dal.ts:38` vs `:595`).
- **`escapeLike`** (via `searchSelectableUsers`) : une recherche contenant `%`, `_` ou
  `\` est traitée littéralement.
- **Self-guard** : `getCurrentUser`, `getLoginMethods`, `getUserSessions` → `null`/vide
  sans session.
- **Gardes admin** : `getUserForAdmin`, `getUserPanelData`, `getUsersForExport` refusent
  un non-admin.
- `trendPct` : période précédente à 0 (division), selon inventaire.

- [ ] **Step 5.2 : Écrire les tests (même harnais), lancer**

```bash
bunx vitest run --project frontend tests/features/users-dal.test.ts
```

- [ ] **Step 5.3 : Contrôle fichier + check + commit**

```bash
bunx vitest run --config vitest.coverage.config.ts --coverage --project frontend 2>&1 | grep "users/dal"
bun run check
git add -A
git commit -m "test(couverture): couvre les invariants de users/dal"
```

---

### Task 6 : Mesure finale + verrou du seuil

**Files :**
- Modify: `vitest.coverage.config.ts:39-44`
- Modify: `features/questions/schemas.ts:58-60`

- [ ] **Step 6.1 : Mesure agrégée finale**

```bash
bun run test:coverage:full -- --testTimeout=25000
```

Attendu : branches ≥ 80 %. Sinon : retour à l'inventaire (`coverage-final.json` **frais**,
pas la baseline) sur le plus gros reliquat, compléter, re-mesurer.

- [ ] **Step 6.2 : Remonter le seuil**

Dans `vitest.coverage.config.ts`, remplacer le bloc commentaire + seuils par :

```ts
      // Cales sous la mesure de clôture de campagne (2026-08) : un seuil sert
      // a empecher le retour en arriere, pas a decrire l'ambition.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
```

- [ ] **Step 6.3 : Vérifier que le seuil passe**

```bash
bun run test:coverage:full -- --testTimeout=25000
```

Attendu : exit 0, aucune métrique sous son seuil.

- [ ] **Step 6.4 : Reformuler le commentaire de `schemas.ts`**

Remplacer le commentaire au-dessus de `loadRandomQuizQuestionsSchema`
(`features/questions/schemas.ts:58-60`) par :

```ts
// Entrées PUBLIQUES (quiz marketing, appelant anonyme) : le schéma ne valide
// que le TYPE ; la borne effective vit dans la DAL (`clamp(count, 1, 10)`).
// Refus silencieux côté action (pas de message d'erreur → pas d'oracle).
// Sans zod sur le tirage, `count: "abc"` → clamp = NaN → `LIMIT NaN` → 500.
```

- [ ] **Step 6.5 : Check + commit**

```bash
bun run check
git add -A
git commit -m "test(couverture): verrouille le seuil de branches a 80 %"
```

---

### Task 7 : Clôture — handoff + PR #135

**Files :**
- Modify: `docs/superpowers/handoffs/2026-08-03-vitest-audit-progress.md`

- [ ] **Step 7.1 : Mettre à jour le handoff**

Dans la section « À faire » : marquer les items 1-3 faits avec les chiffres finaux
(mesure, seuil, linter — préciser preset ou 5 règles). Ajouter une sous-section
« Branches laissées non couvertes » avec les justifications d'une ligne collectées aux
Tasks 3-5. Statut de campagne : **close**.

- [ ] **Step 7.2 : Commit docs**

```bash
git add docs/superpowers/handoffs/2026-08-03-vitest-audit-progress.md
git commit -m "docs: clot la campagne vitest-audit dans le handoff"
```

- [ ] **Step 7.3 : Push + requalifier la PR #135** (⚠️ **uniquement avec l'accord
  explicite de l'utilisateur** — règle : jamais de push non demandé)

```bash
git push
gh pr edit 135 --title "feat: fiabilité paiements Stripe + couverture backend" --body-file <scratchpad>/pr-body.md
```

`pr-body.md` : deux volets (fiabilité Stripe : commits `01511c8`, `1d97f29`, `2970d4f` ;
campagne couverture : linter vitest, mesure agrégée, Server Actions + DAL, seuil 80),
critères de fin de la spec cochés.

- [ ] **Step 7.4 : Proposer la revue adversariale d'implémentation**

Générer le prompt via `/adversarial-review-prompt` (cible : l'implémentation de la
campagne), à exécuter dans une session fraîche. Pas de `/e2e-scenario` (aucun comportement
utilisateur ajouté).

---

## Auto-revue du plan (faite à la rédaction)

- **Couverture de la spec** : Phase 0 → Task 0 ; Phase 1 → Task 1 ; Phase 2 → Tasks 2-5
  (ordre exams → training → users respecté) ; Phase 3 → Tasks 6-7 ; critères de fin →
  Steps 6.1/6.3 (seuils), 1.7/3.6/4.5/5.3/6.5 (`check`), 7.1 (handoff), 7.3 (PR).
- **Écart assumé vs TDD du gabarit** : tests sur code existant → PASS attendu du premier
  coup, règle spéciale en tête de plan.
- **Inventaires** : les listes d'invariants sont pressenties (vérifiées dans le code le
  2026-08-05) ; l'inventaire outillé (Task 2) reste l'autorité — il peut en ajouter ou en
  retirer.
