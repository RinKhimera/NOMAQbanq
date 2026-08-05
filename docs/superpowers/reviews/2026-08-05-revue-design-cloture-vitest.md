# Revue adversariale — design (spec + plan) de clôture de la campagne vitest-audit

**Date** : 2026-08-05 · **Branche** : `feat/stripe-fiabilite-paiements` (HEAD `6e518de`)

## Périmètre

| Type | Fichier |
| ---- | ------- |
| Spec | `docs/superpowers/specs/2026-08-05-cloture-campagne-vitest-design.md` |
| Plan | `docs/superpowers/plans/2026-08-05-cloture-campagne-vitest.md` |
| Contexte | `docs/superpowers/handoffs/2026-08-03-vitest-audit-progress.md` |

Fichiers de l'arbre COURANT lus et confrontés au plan : `eslint.config.mjs`,
`prettier.config.mjs`, `vitest.config.ts`, `vitest.coverage.config.ts`,
`vitest.setup.ts`, `vitest.setup.integration.ts`, `scripts/test-integration.ts`,
`package.json`, `.github/workflows/ci.yml`, `features/questions/schemas.ts`,
`features/questions/dal.ts`, `features/exams/{dal.ts,dal.student.ts,dal.shared.ts}`,
`features/training/dal.ts`, `features/users/dal.ts`, `features/payments/dal.ts`,
`lib/dal.ts`, `lib/cdn.ts`, `tests/features/{training-actions,exam-explanations-cap}.test.ts`,
`tests/helpers/{mocks.ts,test-env.ts}`, `tests/integration/{exam-audience,exams,
passation-anti-cheat,training,training-mode,users-admin-dal}.test.ts`,
`coverage/coverage-final.json`, `node_modules/react/cjs/react.{development,
react-server.development}.js`, `.claude/rules/data-layer.md`, `AGENTS.md`.

## Méthode

Lecture seule, posture hostile. Aucun fichier source, spec ou plan modifié ; le
seul fichier écrit est ce rapport. Chaque constat est prouvé contre le code réel
avec une commande ou une lecture rejouable ; chaque défaut suspecté a subi une
tentative de réfutation avant d'être retenu (les réfutés sont en §4).

**Mesures lancées** (les deux gratuites, sans branche Neon) :

| Commande | Résultat |
| -------- | -------- |
| `bun run check` | **exit 0** — base verte avant implémentation |
| `bun run test` | exit 0 — **108 fichiers, 1233 tests** |
| `bun run test:coverage` | exit 0 — statements 83,71 % · **branches 80,28 % (1376/1714)** · functions 81,88 % · lines 84,58 % |

Ni `bun run test:integration` ni `bun run test:coverage:full` n'ont été lancés
(aucune branche Neon créée).

---

## 2. Table des constats

| # | Sév | fichier:ligne | problème | régression ? |
| - | --- | ------------- | -------- | ------------ |
| 1 | 🔴 | plan §Task 4 Step 4.5, §Task 5 Step 5.3 | `grep "training/dal"` / `grep "users/dal"` ne matchent **jamais** la sortie du reporter `text` (dossier et fichier sur deux lignes distinctes) → le contrôle par lot rend un silence, pas un chiffre | NON |
| 2 | 🟠 | plan Steps 1.7 / 3.6 / 4.5 / 5.3 / 6.5 (`git add -A`) | l'arbre porte déjà des modifs hors campagne (`components/shared/payments/access-badge.tsx`, son test, un rapport non suivi) : `git add -A` les embarque dans un commit `test(...)` d'une PR qui promet zéro changement applicatif | **OUI** |
| 3 | 🟠 | plan §Architecture + Steps 3.2/4.2/5.2 ; `tests/features/training-actions.test.ts:51-82` | le harnais faux-db n'expose ni `selectDistinct`, ni `leftJoin`, ni `groupBy`, ni `offset` — les quatre formes que les trois DAL utilisent. « Réutilisé tel quel » est faux | NON |
| 4 | 🟠 | plan Step 3.2 ; `features/exams/dal.student.ts:28-35` | la liste de mocks de la Task 3 ne mentionne que les tables : il manque `@/lib/dal` (→ `next/headers` + Better Auth) et `./dal.shared` (`fetchImages`, `getOpenExamLockedQuestionIds`) — le squelette « renvoie [] sans session » ne peut pas s'importer | NON |
| 5 | 🟠 | plan Step 5.1/5.2 ; `features/users/dal.ts:50,203-211` | `escapeLike` est **inobservable** au travers du harnais : son seul effet est le motif `ilike` passé à `.where()`, que le harnais jette (`where: () => chain`) | NON |
| 6 | 🟠 | plan Steps 1.5/1.6 ; `eslint.config.mjs:30` | le garde-fou de la Task 1 ne regarde que le frontend, alors que la règle ESLint s'applique aussi à `tests/integration/**` : un test d'intégration cassé/supprimé par un correctif de lint n'est vu qu'à la Task 6 (run Neon payant) | **OUI** |
| 7 | 🟠 | plan Step 0.1 / Step 1.5 | comptes attendus faux : 1233 tests ne sont pas « 1038 + 195 + intégration », c'est le **frontend seul** ; l'agrégé vaut ~1554. Step 1.5 compare un compte frontend à un compte agrégé → il ne peut pas détecter un test perdu | NON |
| 8 | 🟠 | `.github/workflows/ci.yml:84` vs plan Steps 0.1/6.1/6.3 | la campagne se valide avec `--testTimeout=25000`, la CI lance `bun run test:coverage:full` **sans** ce flag (frontend à 5 s par défaut) → le verrou `branches: 80` est posé sur une mesure que la CI ne reproduit pas | **OUI** |
| 9 | 🟡 | plan Step 3.1 ; `tests/integration/exam-audience.test.ts:560-579`, `tests/integration/exams.test.ts:471-476` | deux des « invariants pressentis » de la Task 3 sont **déjà couverts** (les deux branches de `memberAudienceWhere`, l'exclusion de l'examen non clos) | NON |
| 10 | 🟡 | plan Step 6.2 vs `vitest.coverage.config.ts:34-38` | le commentaire de remplacement supprime les chiffres mesurés que porte l'actuel — on perd la marge et la traçabilité du seuil | NON |
| 11 | 🟡 | plan Step 2.2 | `cd <scratchpad> && bun uncovered.ts …` contredit le chemin relatif `coverage/coverage-baseline.json` du script (et la note qui suit) | NON |
| 12 | ℹ️ | plan Step 3.1 (`dal.student.ts:687`), Step 6.4 (`schemas.ts:58-60`) | ancrages décalés d'une ligne : la ligne anti-fuite est `dal.student.ts:686`, le commentaire à reformuler est `schemas.ts:59-61` | NON |
| 13 | ℹ️ | spec §Phase 1 / plan Step 1.6 | la marge frontend réelle est 80,28 % (1376/1714), soit ~5 branches couvertes de battement — « 0,26 pt » sous-estime la finesse du garde-fou | NON |

---

## 3. Détail par constat

### 1 — 🔴 Les greps de contrôle des Tasks 4 et 5 ne peuvent rien matcher

**Code** — plan Step 4.5 :
`bunx vitest run --config vitest.coverage.config.ts --coverage --project frontend 2>&1 | grep "training/dal"`
et Step 5.3, identique avec `grep "users/dal"`.

**Pourquoi c'est un vrai défaut** — le reporter `text` d'istanbul n'imprime jamais
un chemin `dossier/fichier` sur une seule ligne : il met le dossier sur sa propre
ligne, puis les fichiers indentés, **nom de base seul et tronqué** à la largeur de
colonne. Sortie réelle de `bun run test:coverage` sur ce dépôt :

```
 ...ts/quiz/runner |       0 |        0 |       0 |       0 |
  quiz-runner.tsx  |       0 |        0 |       0 |       0 | 55-367
 lib/env           |      92 |    78.94 |     100 |     100 |
  schema.ts        |      92 |    78.94 |     100 |     100 | 73,110,113
```

`features/training` et `dal.ts` ne se rencontrent sur aucune ligne : les deux
greps rendent une sortie **vide**. Combiné à la consigne « ignorer l'exit code »
(Step 3.5), l'opérateur ne reçoit aucun signal et enchaîne : le plan perd son
seul retour intermédiaire entre deux mesures agrégées, celles-là mêmes qui coûtent
une branche Neon. Le grep de la Task 3 (`grep "dal.student"`) fonctionne, lui, par
accident : `dal.student.ts` fait 14 caractères et tient dans la colonne — ce qui
rend l'échec des deux autres d'autant plus invisible.

**Régression** : NON (aucun code applicatif touché).

**Comment je l'ai prouvé** — `bun run test:coverage` (exit 0), lecture de la sortie
complète : aucune ligne ne porte un séparateur `/` entre un dossier et un nom de
fichier.

**Correctif suggéré** — ne pas lire le reporter `text` pour un contrôle par
fichier. Deux options :
- ajouter `"json-summary"` au `reporter` de `vitest.coverage.config.ts` et lire
  `coverage/coverage-summary.json` ; ou
- réutiliser l'outil de la Task 2 : un second mode qui, au lieu de lister les
  branches non prises, imprime `couvertes/total` pour le fichier ciblé depuis
  `coverage/coverage-final.json` (déjà écrit par le reporter `json`). Un seul
  outil, un seul format, et le contrôle devient vrai pour les trois lots.

---

### 2 — 🟠 `git add -A` embarque du travail hors campagne

**Code** — plan Steps 1.7, 3.6, 4.5, 5.3, 6.5 : `git add -A` puis `git commit -m "test(…)"`.

**Pourquoi c'est un vrai défaut** — l'arbre n'est pas propre au moment où le plan
démarre :

```
 M components/shared/payments/access-badge.tsx
 M tests/components/payments/AccessBadge.test.tsx
?? docs/superpowers/reviews/2026-08-05-audit-sentry.md
```

`access-badge.tsx` est du **code applicatif**. Le premier `git add -A` (Step 1.7,
message `test(lint): active @vitest/eslint-plugin sur tests/**`) le committe sous
un message qui ment sur son contenu, dans une PR dont la spec affirme « aucun
comportement applicatif ne change » (§Hors périmètre). C'est exactement le genre de
changement qui échappe ensuite à la revue d'implémentation, puisque personne ne
cherche du code produit dans un commit `test(...)`.

**Régression** : **OUI** — potentiellement un changement de comportement livré
sous une étiquette qui le rend invisible.

**Comment je l'ai prouvé** — `git status --short` à HEAD `6e518de`.

**Correctif suggéré** — remplacer `git add -A` par des `git add` explicites (les
fichiers listés en tête de chaque Task), ou ajouter un Step 0.0 : « statuer sur
les modifications en cours (`access-badge.tsx` + son test) avant d'ouvrir la
campagne — commit séparé ou stash », avec le rappel projet de ne jamais faire un
`git stash pop` à l'aveugle.

---

### 3 — 🟠 Le harnais faux-db ne couvre pas les formes de requête des trois DAL

**Code** — `tests/features/training-actions.test.ts:51-82` :

```ts
const chain: Record<string, unknown> = {
  from, innerJoin, where, orderBy, for, limit, set, values,
  onConflictDoNothing, returning, then,
}
const fakeDb = { transaction, select, insert, update, delete }
```

**Pourquoi c'est un vrai défaut** — la spec (§Phase 2, méthode 2) et le plan
(§Architecture) affirment que ce harnais est « réutilisé **tel quel** ». Inventaire
des méthodes réellement appelées par les trois cibles :

| Méthode | `exams/dal.student.ts` | `training/dal.ts` | `users/dal.ts` | présente au harnais |
| ------- | ---------------------- | ----------------- | -------------- | ------------------- |
| `selectDistinct` | 2 | – | – | **non** |
| `leftJoin` | – | 2 | 5 | **non** |
| `groupBy` | – | 3 | 1 | **non** |
| `offset` | – | – | 1 | **non** |

Le premier test qui atteint le chemin non-admin de `getExamQuestionExplanations`
(`dal.student.ts:671-705`) plante sur `db.selectDistinct is not a function` — un
échec d'infrastructure, que la « règle spéciale tests sur code existant » du plan
invite pourtant à lire comme « l'invariant supposé est faux, ou vrai bug ». Mauvais
oracle au pire moment.

Le coût réel reste modeste (quatre lignes : trois alias sur `chain`, un
`selectDistinct` sur `fakeDb`) — ce n'est **pas** un motif de basculer le lot exams
en intégration. Mais le plan doit le dire, sinon l'exécutant le découvre en
croyant avoir trouvé un bug.

**Régression** : NON.

**Comment je l'ai prouvé** —
`grep -oE "\.(selectDistinct|leftJoin|groupBy|offset|innerJoin|…)\(" features/{exams/dal.student,training/dal,users/dal}.ts | sort | uniq -c`
croisé avec la lecture de `tests/features/training-actions.test.ts:51-82`.

**Correctif suggéré** — un Step 3.0 explicite : « étendre le harnais avant le
premier test du lot — `selectDistinct` sur `fakeDb`, `leftJoin`/`groupBy`/`offset`
sur `chain` », et remplacer « réutilisé tel quel » par « réutilisé, étendu de
quatre maillons » dans la spec et le plan.

---

### 4 — 🟠 La liste de mocks de la Task 3 est incomplète (celle de la Task 4 ne l'est pas)

**Code** — `features/exams/dal.student.ts:28-35` :

```ts
import { getCurrentSession } from "@/lib/dal"
import { hasAccess } from "../payments/dal"
import { type ExamQuestionView, countQuestionsByExam, fetchImages,
         getOpenExamLockedQuestionIds } from "./dal.shared"
```

et `lib/dal.ts:1-9` : `import { headers } from "next/headers"` + `import { auth } from "@/lib/auth"`.

**Pourquoi c'est un vrai défaut** — le commentaire du squelette (Step 3.2) ne parle
que d'« adapter les tables mockées de `@/db/schema` ». Or :

- sans `vi.mock("@/lib/dal")`, le module réel est chargé → Better Auth + `next/headers`
  hors contexte de requête ; le tout premier cas (`mocks.session.current = null`,
  « renvoie [] sans session ») ne peut pas s'exécuter ;
- `getOpenExamLockedQuestionIds` doit être mocké sur **`./dal.shared`**, pas sur
  `@/features/exams/dal` — `dal.ts` n'est qu'un baril de réexport
  (`features/exams/dal.ts:3-9`), et mocker le baril n'intercepte pas l'import direct
  que fait `dal.student` ;
- `fetchImages` (appelé en fin de `getExamQuestionExplanations`, `dal.student.ts:728`)
  vient du même module et touche `db` + `cdnUrl`.

Le contraste est frappant avec le Step 4.2, dont le commentaire liste correctement
`@/lib/dal`, `@/lib/cdn` et `@/features/exams/dal` — et là le baril **est** la bonne
cible, puisque `training/dal.ts:27` importe bien `from "../exams/dal"`.

**Régression** : NON.

**Comment je l'ai prouvé** — lecture des en-têtes d'import de `features/exams/dal.student.ts`,
`features/exams/dal.ts`, `features/training/dal.ts`, `lib/dal.ts`.

**Correctif suggéré** — aligner le commentaire du Step 3.2 sur celui du Step 4.2 :
mocks requis = `@/db`, `@/db/schema` (union des tables de `dal.student` **et** de
`dal.shared`), `@/lib/dal`, `@/features/exams/dal.shared`, `@/features/payments/dal`.

---

### 5 — 🟠 `escapeLike` n'est pas testable par le chemin prévu

**Code** — `features/users/dal.ts:50` et son unique consommateur, `searchSelectableUsers`
(`features/users/dal.ts:203-211`) :

```ts
term ? or(ilike(user.name, `%${escapeLike(term)}%`),
          ilike(user.email, `%${escapeLike(term)}%`)) : undefined
```

**Pourquoi c'est un vrai défaut** — le plan (Step 5.1) range `escapeLike` dans les
invariants du lot users, et le Step 5.2 les écrit tous « même harnais ». Mais
`escapeLike` n'a **aucun effet observable sur la valeur de retour** : son résultat
n'existe que dans le motif `ilike` passé à `.where()`, et le harnais jette cet
argument (`where: () => chain`, `training-actions.test.ts:59`). Un test unitaire ne
peut donc qu'affirmer que la fonction renvoie une liste — c'est-à-dire exactement
le test tautologique que la Phase 1 de la spec se propose d'éliminer.

Deux issues honnêtes : capturer l'argument de `.where()` et introspecter l'objet
SQL Drizzle (fragile, dépend des internes), ou mettre l'invariant en intégration.
La seconde est déjà à moitié faite : `searchSelectableUsers` y est exercé
(`tests/integration/exam-audience.test.ts:205-224`, recherche par nom et par email,
sur des users seedés) — il n'y manque qu'un cas « terme contenant `%`/`_`/`\` ».

**Régression** : NON.

**Comment je l'ai prouvé** — lecture de `features/users/dal.ts:190-215`,
de `tests/features/training-actions.test.ts:51-73`, et
`grep -n "searchSelectableUsers" tests/integration/exam-audience.test.ts`.

**Correctif suggéré** — déplacer `escapeLike` de la liste unitaire vers l'intégration,
dans `exam-audience.test.ts` (fichier qui possède déjà le seed et le `describe`)
ou `users-admin-dal.test.ts`.

---

### 6 — 🟠 Le garde-fou de la Task 1 est aveugle aux tests d'intégration

**Code** — `eslint.config.mjs:29-34` scope le bloc sur `files: ["tests/**/*.{ts,tsx}"]`,
ce qui inclut `tests/integration/**`. Les garde-fous du plan sont Step 1.5
(`bun run test` = `vitest run --project frontend`, `package.json:17`) et Step 1.6
(`bun run test:coverage` = `--project frontend`, `package.json:19`).

**Pourquoi c'est un vrai défaut** — la Task 1 autorise explicitement la **suppression**
de tests (« un test tautologique … reçoit une vraie assertion ou disparaît »), et la
spec ne prévoit qu'une seule parade : « re-mesure frontend après la phase 1 ». Les
34 fichiers de `tests/integration/` sont dans le périmètre du linter mais dans aucune
des deux vérifications. Un test d'intégration supprimé ou réécrit de travers passe
les Steps 1.5, 1.6 et 1.7 (`bun run check` ne lance aucun test) et n'apparaît qu'à
la Task 6 — après trois lots d'écriture, sur la mesure Neon que le plan veut
justement ne lancer que deux fois. Or c'est précisément là que vivent les invariants
les plus sensibles (anti-triche, audience, IDOR).

**Régression** : **OUI** — perte potentielle de couverture d'invariants de sécurité,
non détectée par les garde-fous prévus.

**Comment je l'ai prouvé** — `eslint.config.mjs:30` (glob), `package.json:17,19`
(les deux scripts portent `--project frontend`), `package.json:14` (`check` = prettier
+ tsc + eslint, aucun test).

**Correctif suggéré** — ajouter au Step 1.4 la contrainte « aucune suppression dans
`tests/integration/**` ; sur ce répertoire, seule la correction d'assertion est
autorisée », ou insérer un `bun run test:integration` ciblé sur les fichiers touchés
avant le commit du Step 1.7.

---

### 7 — 🟠 Les comptes de tests attendus sont faux, et la comparaison du Step 1.5 est vide de sens

**Code** — plan Step 0.1 : « Attendu : tous les tests verts (~1233 : 1038 frontend +
195 nouveaux + intégration) » ; Step 1.5 : « aucun test perdu par accident (comparer
le compte au Step 0.1) ».

**Pourquoi c'est un vrai défaut** — mesuré aujourd'hui :

```
$ bun run test        → Test Files 108 passed (108) · Tests 1233 passed (1233)
$ grep -rho "\bit(" tests/integration/ | wc -l  → 321
```

Les 1233 sont donc le **frontend seul**, 195 nouveaux inclus (le « 1038 » du handoff
datait d'avant le Lot 4). L'agrégé du Step 0.1 tournera autour de **1554**. Le Step 1.5,
lui, relance `bun run test` (frontend) et compare son résultat au chiffre agrégé :
un écart de ~320 est attendu par construction, donc la disparition d'un ou deux tests
frontend se noie dedans. Le garde-fou est décoratif — le même défaut que la campagne
cherche à corriger ailleurs.

**Régression** : NON.

**Comment je l'ai prouvé** — les deux commandes ci-dessus, sortie complète en §Méthode.

**Correctif suggéré** — Step 0.1 : noter **deux** chiffres (frontend et agrégé).
Step 1.5 : comparer au chiffre frontend, en le rappelant explicitement (`1233`).

---

### 8 — 🟠 La mesure de clôture ne reproduit pas la commande de la CI

**Code** — `.github/workflows/ci.yml:84` :

```yaml
      - name: Integration tests + aggregated coverage (ephemeral Neon branch)
        run: bun run test:coverage:full
```

`package.json:22` ne porte aucun `--testTimeout`. Les projets : `integration` fixe
`testTimeout: 30_000` (`vitest.config.ts:144`), `frontend` reste au défaut de 5 s.

**Pourquoi c'est un vrai défaut** — la spec (Phase 0 et Phase 3), le plan (Steps 0.1,
6.1, 6.3) et le handoff lancent tous `bun run test:coverage:full -- --testTimeout=25000`.
Ce flag n'existe que parce que quelque chose dépasse le défaut de 5 s dans le run
agrégé ; personne ne l'a documenté, et la CI ne le passe pas. La Task 6 verrouille
`branches: 80` sur une mesure obtenue avec le flag, puis la CI applique ce seuil sans
lui : la campagne peut se déclarer close sur du vert local pendant que le job
`integration` échoue sur un timeout. Le critère de fin « `bun run test:coverage:full`
vert » ne parle pas de la même commande que la porte qu'il verrouille.

**Régression** : **OUI** — risque de casser le job `integration` de la CI dès la PR
qui pose le seuil.

**Comment je l'ai prouvé** — lecture de `.github/workflows/ci.yml`, `package.json:22`,
`vitest.config.ts:138-147`, et des trois documents de campagne.

**Correctif suggéré** — trancher avant de coder : soit le timeout est nécessaire et il
va **dans `package.json`** (`test:coverage:full` porte `--testTimeout=25000`), soit il
ne l'est pas et on l'abandonne partout. Dans les deux cas, une mesure de clôture
lancée exactement comme la CI la lance.

---

### 9 — 🟡 Deux invariants « pressentis » de la Task 3 sont déjà couverts

**Code** — `tests/integration/exam-audience.test.ts:560-579` :

```ts
describe("dashboard étudiant — restreint masqué aux non-membres (D3)", () => {
  it("getMyAvailableExams/getMyRecentExams : restreint visible pour un membre abonné,
      masqué pour un abonné non-membre", …)
```

qui exerce les deux branches de `memberAudienceWhere` (`features/exams/dal.student.ts:933-945`).
Et `tests/integration/exams.test.ts:471-476` :

```ts
// (endDate dans le futur) → ses explications ne doivent pas être révélées
// avant l'ouverture des résultats.
expect(await getExamQuestionExplanations([qIds[0]])).toEqual([])
```

**Pourquoi c'est un vrai défaut** — le Step 3.1 présente ces deux points comme des
invariants à couvrir, et le Step 3.4 prescrit de « compléter `exam-audience.test.ts`
avec les cas d'audience manquants » — formulation qui présuppose qu'il en reste. Le
plan reconnaît (auto-revue) que l'inventaire outillé fait autorité, mais les listes
ont été « vérifiées dans le code » sans être croisées avec les 34 fichiers
d'intégration existants. Le risque n'est pas la fausseté : c'est de dépenser un lot à
réécrire du couvert, pendant que les 47 branches réellement manquantes de
`dal.student.ts` sont ailleurs (`getExamSession`, `getParticipantExamResults`,
`getExamSubmissionSummary`, fenêtres de dates).

**Régression** : NON.

**Comment je l'ai prouvé** — `grep -n "^describe(" tests/integration/exam-audience.test.ts`
puis lecture des lignes 560-579 ; `grep -n "getExamQuestionExplanations" -A12 tests/integration/exams.test.ts`.

**Correctif suggéré** — ajouter au Step 3.1 : « croiser chaque invariant candidat avec
`grep -rn "<nomDeFonction>" tests/` avant de l'inscrire ; un invariant déjà exercé sort
de la liste ». Et retirer la présupposition du Step 3.4 (« si l'inventaire en révèle »).

---

### 10 — 🟡 Le nouveau commentaire de seuil perd les chiffres

**Code** — `vitest.coverage.config.ts:34-38`, actuel :

```ts
      // Cales juste sous la mesure du 2026-08-03 (81,85 / 75,01 / 83,17 / 83,87) :
      // un seuil sert a empecher le retour en arriere, pas a decrire l'ambition.
```

Remplacement prescrit (Step 6.2) : même seconde phrase, mais « Cales sous la mesure de
clôture de campagne (2026-08) » — sans les quatre pourcentages.

**Pourquoi c'est un vrai défaut** — le chiffre est ce qui rend le commentaire utile :
il dit de combien on est au-dessus du seuil, donc combien de marge la prochaine PR
peut brûler. Le remplacer par « 2026-08 » transforme une information opérationnelle en
formule. C'est aussi le seul endroit où la mesure de clôture serait durablement
inscrite dans le code (le rapport `coverage/` est gitignoré).

**Régression** : NON.

**Comment je l'ai prouvé** — lecture comparée de `vitest.coverage.config.ts:34-38` et
du bloc du Step 6.2.

**Correctif suggéré** — garder la forme actuelle en substituant les quatre nombres
mesurés à la Task 6.

---

### 11 — 🟡 Le Step 2.2 se place dans le mauvais répertoire

**Code** — Step 2.1, le script lit `Bun.file("coverage/coverage-baseline.json")`
(chemin relatif au cwd) ; Step 2.2 : `cd <scratchpad> && bun uncovered.ts features/users/dal.ts`,
suivi de « Lancer depuis la racine du repo ou ajuster le chemin du JSON ».

**Pourquoi c'est un vrai défaut** — la commande écrite et la note qui la suit se
contredisent ; exécutée telle quelle, la vérification de l'outil échoue sur un fichier
introuvable, au moment précis où l'on cherche à savoir si l'outil est correct. Les Steps
3.1/4.1/5.1 utilisent la bonne forme (`bun <scratchpad>/uncovered.ts …` depuis la racine).

**Régression** : NON.

**Comment je l'ai prouvé** — lecture du Step 2.1 et du Step 2.2.

**Correctif suggéré** — aligner le Step 2.2 sur les Steps 3.1/4.1/5.1.

---

### 12 — ℹ️ Ancrages décalés d'une ligne

**Code** — `features/exams/dal.student.ts` :

```
686:            lte(exams.endDate, nowDate),
687:            inArray(examQuestions.questionId, requested),
```

Le plan cite `dal.student.ts:687` pour l'invariant anti-fuite ; c'est 686.
`features/questions/schemas.ts` : le commentaire « bornes strictes » occupe les lignes
**59-61**, pas 58-60 (58 est vide, 57 est le `export type SetQuestionImagesInput`).

Tous les autres ancrages sont exacts et vérifiés : `dal.student.ts:656`
(`getExamQuestionExplanations`), `:933` (`memberAudienceWhere`), `training/dal.ts:36`
(`decodeCursor`), `:65` (forme-pont), `:539` (garde IDOR
`if (s.userId !== session.user.id && session.user.role !== "admin") return null`),
`users/dal.ts:38` (`toAccessInfo`), `:50` (`escapeLike`), `:595` (`toPanelAccess`),
`:423` (`trendPct`), `eslint.config.mjs:30` (bloc `tests/**`),
`vitest.coverage.config.ts:39-44` (seuils). Les exports cités
(`getExamQuestionExplanations`, `getTrainingSessionById`, `searchSelectableUsers`)
existent et sont publics.

**Régression** : NON. **Correctif** : décaler les deux références.

---

### 13 — ℹ️ La marge frontend, en branches et non en points

`bun run test:coverage` mesure aujourd'hui **1376/1714 = 80,28 %** (le plan et le
handoff disent 80,26 %). Traduit en unités actionnables : perdre **5 branches
couvertes** fait passer sous 80 (1371/1714 = 79,99 %). Le Step 1.6 gagne à raisonner
en branches plutôt qu'en points de pourcentage — un `it()` supprimé en vaut souvent
plus de cinq.

---

## 4. Faux positifs écartés

| Suspecté | Verdict | Preuve |
| -------- | ------- | ------ |
| Le script de la Task 2 lit un format istanbul (`b`/`branchMap`) alors que le provider est `v8` | **Blanchi** | `coverage/coverage-final.json` réel : chaque entrée porte `path`/`statementMap`/`fnMap`/`branchMap`/`s`/`f`/`b` ; un `branchMap` type est `{"loc":…,"type":"default-arg","locations":[{"start":{"line":33,…}}],"line":33}` et `b` un tableau d'entiers. Le typage du script correspond exactement. |
| React `cache()` mémoïse entre `it()` → résultats pollués | **Blanchi** | `node_modules/react/cjs/react.development.js:917` : `exports.cache = function (fn) { return function () { return fn.apply(null, arguments) } }` — passe-plat pur. Même le build `react-server` (`react.react-server.development.js:575-578`) retombe sur `fn.apply` quand aucun dispatcher n'est actif, ce qui est le cas hors rendu RSC. |
| Les Steps 3.5/4.5/5.3 exigent une branche Neon | **Blanchi** | `--project frontend` n'instancie jamais le projet `integration`, donc jamais `vitest.setup.integration.ts` (seul fichier qui exige `INTEGRATION_BRANCH`/`HOST`). `vitest.setup.ts` ne contient qu'`import "@testing-library/jest-dom"`. Les projets sont des littéraux inline dans `vitest.config.ts:123-149` : rien à évaluer au chargement. Confirmé empiriquement : `bun run test:coverage` tourne exit 0 sans DB. |
| `vitest/expect-expect` va exploser à cause des helpers d'assertion | **Blanchi** | `grep -rln "expect(" tests/helpers/` → aucun fichier. Le seul helper local est `expectNoSensitive` (`tests/integration/passation-anti-cheat.test.ts:72`), et les deux `it()` qui l'appellent (lignes 203, 224) contiennent aussi des `expect(...)` directs. |
| `vitest/no-commented-out-tests` va produire du bruit | **Blanchi** | Aucun `// it(` / `// test(` / `// describe(` dans `tests/`. |
| L'import `@vitest/eslint-plugin` « en tête » cassera `prettier --check` | **Blanchi** | `prettier.config.mjs` : `importOrder: ["^(node:(.*)$)|^([a-zA-Z0-9].*)$", "^@/(.*)$", "^[./]"]`. Un paquet scopé ne matche aucun groupe et remonte donc en tête — comportement visible dans `vitest.config.ts:1-5`, où `@tailwindcss/vite` et `@vitejs/plugin-react` précèdent `fs`, `path`, `vitest/config`. L'instruction du Step 1.2 est correcte. |
| Le preset ESLint exigera `languageOptions.globals: vitest.environments.env.globals` (config `globals: true`) | **Blanchi** | `grep -rLE 'from "vitest"'` sur les 96 fichiers de test : aucun fichier ne s'appuie sur les globales implicites. |
| `bun add -d` cassera `bun install --frozen-lockfile` en CI | **Blanchi** | `bun.lock` est versionné (présent, non ignoré) et le `git add -A` du Step 1.7 l'emporte. (L'ampleur de ce `git add -A` reste le constat #2.) |
| `bun run test:integration -- <fichier>` relancerait toute la suite | **Blanchi** | `scripts/test-integration.ts:21-23` filtre `--keep` et `--` puis repasse le reste à vitest ; ligne 57-59, `--project integration` n'est ajouté que si l'appelant n'en fournit pas. Les Steps 3.4 et 4.4 sont corrects. |
| Le mock `@/features/exams/dal` du Step 4.2 vise le mauvais module | **Blanchi** | `features/training/dal.ts:27` importe bien `getOpenExamLockedQuestionIds` depuis `"../exams/dal"` (le baril). Le défaut symétrique existe côté Task 3 seulement (constat #4). |
| Le commentaire prescrit au Step 6.4 invente `clamp(count, 1, 10)` | **Blanchi** | `features/questions/dal.ts:417` : `const safeCount = clamp(count, 1, 10)`. La reformulation est factuellement juste, et le passage de « bornes strictes » à « le schéma ne valide que le TYPE » corrige bien une affirmation fausse. |
| Les chiffres « 47 / 40 / 33 branches » sont périmés | **Blanchi (assumé)** | Ils viennent de la table du handoff (§À faire), antérieure aux 195 tests de Server Actions. Mais la spec les annote « (avant réf.) » et la Task 0 les remesure avant tout usage. L'écart est déclaré, pas caché. |
| Le plan ajoute des choses que la spec n'a jamais demandées | **Blanchi** | Task 2 (outil d'inventaire) est le support de la méthode §Phase 2 point 1 de la spec (« lire ses branches non prises dans `coverage-final.json` »). Toutes les autres Tasks se rattachent à une phase. Aucun ajout hors spec. |

---

## 5. Réponses aux questions ouvertes

### Q1 — Le harnais faux-db tiendra-t-il pour les DAL ?

**Non tel quel, oui moyennant quatre lignes.** Ce n'est pas un motif de basculer le
lot exams en intégration.

- **Manquants** : `selectDistinct` (sur `fakeDb`), `leftJoin`, `groupBy`, `offset`
  (sur `chain`) — constat #3, table de comptage à l'appui. Ajout trivial, la chaîne
  étant déjà uniformément auto-renvoyante.
- **React `cache()`** : non bloquant, c'est un passe-plat hors rendu RSC (§4). Rien à
  faire ; les tests d'intégration le mockent quand même, par prudence documentaire.
- **`Promise.all` de requêtes parallèles** (`getExamQuestionExplanations`,
  `dal.student.ts:671-705`) : passe. Chaque appel `db.selectDistinct()` construit sa
  propre chaîne, indexée par la table du `.from()` — les trois lectures parallèles ne
  se marchent pas dessus. Le troisième membre du `Promise.all` est
  `getOpenExamLockedQuestionIds(uid, requested)`, à mocker (constat #4).
- **`leftJoin` multiples** : passent une fois le maillon ajouté, mais imposent de
  façonner les lignes du faux-db à la forme **jointe** (la sélection projette des
  colonnes de plusieurs tables sous une seule clé de table). C'est un coût d'écriture,
  pas un blocage.
- **La vraie limite est ailleurs** : tout invariant dont l'effet vit **dans** le
  prédicat SQL et non dans la valeur de retour est hors de portée du harnais, parce
  que `where: () => chain` jette son argument. Concrètement : `escapeLike` (constat #5),
  `memberAudienceWhere`, le keyset de `getTrainingHistory`, les agrégats filtrés. Le
  découpage de la spec (unitaire = décisions, intégration = sémantique SQL) est donc le
  bon — il faut juste appliquer le critère fonction par fonction, et retirer `escapeLike`
  de la liste unitaire.

**Verdict** : le lot exams **ne** bascule **pas** « presque entièrement » en intégration.
Le coût du plan ne change pas significativement ; la seule correction budgétaire est le
déplacement de `escapeLike` (Task 5) vers l'intégration.

### Q2 — `bunx vitest run --config vitest.coverage.config.ts --coverage --project frontend` tourne-t-il sans branche Neon ?

**Oui.** Trois lectures indépendantes le prouvent :

1. Le seul point du dépôt qui exige `DATABASE_URL`/`INTEGRATION_BRANCH` est
   `vitest.setup.integration.ts:6-24` — chargé uniquement comme `setupFiles` du projet
   `integration` (`vitest.config.ts:141`), donc jamais avec `--project frontend`.
2. `vitest.setup.ts` ne contient qu'`import "@testing-library/jest-dom"` — aucun accès
   à l'environnement.
3. `vitest.coverage.config.ts` n'est qu'un `defineConfig` qui étale `baseConfig` et
   remplace `coverage` ; les deux projets y sont des objets littéraux inline, sans
   effet de bord au chargement.

Empiriquement, `bun run test:coverage` (même projet, même absence de DB) tourne exit 0
sur cette machine. Le seul effet de bord annoncé — l'échec des seuils globaux faute du
projet `integration` — est correctement anticipé par la note du Step 3.5.

**Réserve** : la commande est correcte, c'est sa **lecture** qui est cassée pour deux
lots sur trois (constat #1).

### Q3 — `vitest/expect-expect` et les helpers d'assertion : le Step 1.3/1.4 sous-estime-t-il le bruit ?

**Non pour `expect-expect` ; l'inconnue est ailleurs.**

- Aucun `expect(` dans `tests/helpers/` — il n'existe pas de bibliothèque d'assertions
  maison dans ce dépôt. `assertFunctionNames` n'est donc pas requis.
- Le seul helper local, `expectNoSensitive` (`passation-anti-cheat.test.ts:72-76`), est
  systématiquement accompagné d'`expect` directs dans le même `it()` — zéro faux positif.
- 1480 appels `it(`/`test(` au total, aucun test commenté.

Les deux vrais points d'attention, que le plan ne nomme pas :

1. **`vitest/no-standalone-expect`** — `expectNoSensitive` contient un `expect()` dans
   une fonction déclarée au scope module. C'est l'unique candidat du dépôt ; suffixe
   `expect*`, il peut aussi déclencher la règle selon son implémentation. À traiter par
   inlining ou par un `eslint-disable` d'une ligne, pas par une désactivation globale.
2. **`vitest/no-identical-title`** — des titres identiques existent
   (`it("erreur inattendue → capture"` ×5, `it("id vide → refus"` ×4…), mais la règle
   ne compare qu'à l'intérieur d'un même `describe`. Le volume réel est indéterminable
   sans exécuter le linter.

**Point de méthode** : le contenu exact de `vitest.configs.recommended` n'est pas
vérifiable ici — le paquet n'est pas installé, et l'installer sortirait du périmètre
lecture seule. Le plan a raison d'installer d'abord, compter ensuite, avec la porte de
décision du Step 1.3 ; mais il devrait exiger que le **compte** de violations par règle
soit reporté au handoff, pas seulement le total (`tail -5` n'en montre que la somme).

### Q4 — « Couvrir l'équivalent proprement » est-il assez précis ?

**Non.** C'est la seule instruction du plan qui ne se termine par aucune vérification
mesurable : ni oracle (couvrir quoi ?), ni seuil (jusqu'où ?), ni commande. Elle arrive
au pire moment — après une suppression de test, sous une marge de 5 branches (constat #13).

Formulation exécutable proposée pour le Step 1.6 :

> Si `bun run test:coverage` échoue après les correctifs : **rétablir** le test supprimé
> et le doter d'une vraie assertion à la place de le supprimer. Une suppression n'est
> acceptable que si `bun run test:coverage` reste vert **et** que la ligne de couverture
> du fichier concerné est inchangée. Aucune suppression dans `tests/integration/**`
> (constat #6).

Cela remplace un objectif flou par la règle la plus simple : un test tautologique se
répare ; il ne se supprime que s'il ne coûte aucune couverture.

### Q5 — React `cache()` pollue-t-il entre `it()` ?

**Non.** Dans le build `react` que Vitest résout (pas de condition `react-server`),
`cache` est un passe-plat :

```js
// node_modules/react/cjs/react.development.js:917
exports.cache = function (fn) {
  return function () { return fn.apply(null, arguments) }
}
```

Et même le build `react-server` (`react.react-server.development.js:575-578`) commence
par `var dispatcher = ReactSharedInternals.A; if (!dispatcher) return fn.apply(null, arguments)`
— sans rendu RSC, aucun dispatcher, donc aucune mémoïsation. Deux appels du même DAL
dans un même fichier de test ne partagent rien.

**Comment le dépôt gère la question aujourd'hui** : 20 fichiers de `tests/integration/`
neutralisent quand même `cache` :

```ts
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
```

C'est redondant sur le plan fonctionnel, mais cela documente l'intention et immunise
contre un futur changement de résolution de conditions. **Recommandation** : reprendre
le même bloc dans les nouveaux fichiers unitaires — par cohérence avec les 20 existants,
pas par nécessité. Aucune ligne du plan n'est à corriger sur ce point.

---

## 6. Verdict

> **Le plan est-il sûr et complet pour être implémenté tel quel ? → NON.**

Le design est bon : l'ordre linter → lots → verrou est le bon, la sélection par le
risque plutôt que par le pourcentage est la bonne discipline, le découpage
unitaire/intégration est juste, et le plan est honnête sur ce qu'il ne sait pas
(chiffres annotés « avant réf. », inventaire outillé déclaré autorité). Rien dans la
campagne ne touche au comportement applicatif, et les seules régressions possibles
identifiées viennent de la **mécanique d'exécution**, pas des tests eux-mêmes.

Ce qui bloque : deux des trois contrôles intermédiaires ne peuvent rien afficher (#1),
le premier `git add -A` committerait du code applicatif non lié sous un message `test:` (#2),
et trois hypothèses sur le harnais sont fausses ou incomplètes (#3, #4, #5), avec un
oracle piégeux — la « règle spéciale tests sur code existant » invite à lire un échec
d'infrastructure comme un bug applicatif.

### Correctifs priorisés

| Priorité | # | Correctif |
| -------- | - | --------- |
| **Avant de coder** | 1 | Remplacer les greps `text` des Steps 3.5/4.5/5.3 par une lecture de `coverage-final.json` (ou ajouter le reporter `json-summary`) |
| **Avant de coder** | 2 | Statuer sur `access-badge.tsx` + son test avant d'ouvrir la campagne ; remplacer les `git add -A` par des `git add` explicites |
| **Avant de coder** | 3 | Step 3.0 : étendre le harnais (`selectDistinct`, `leftJoin`, `groupBy`, `offset`) ; corriger « réutilisé tel quel » dans la spec et le plan |
| **Avant de coder** | 4 | Compléter la liste de mocks du Step 3.2 (`@/lib/dal`, `@/features/exams/dal.shared`, `@/features/payments/dal`) |
| **Avant de coder** | 5 | Déplacer `escapeLike` de la liste unitaire (Step 5.1) vers l'intégration (`exam-audience.test.ts`, où `searchSelectableUsers` est déjà seedé) |
| **Avant de coder** | 8 | Trancher le `--testTimeout=25000` : dans `package.json` ou nulle part — la mesure de clôture doit être la commande de la CI |
| **Pendant** | 6 | Interdire toute suppression dans `tests/integration/**` au Step 1.4 ; sinon lancer un `test:integration` ciblé avant le commit 1.7 |
| **Pendant** | 7 | Step 0.1 : noter frontend **et** agrégé ; Step 1.5 : comparer au chiffre frontend (1233) |
| **Pendant** | 4bis (Q4) | Réécrire « couvrir l'équivalent proprement » en règle vérifiable (§5, Q4) |
| **Pendant** | 9 | Croiser chaque invariant candidat avec `grep -rn "<fonction>" tests/` avant de l'inscrire à l'inventaire |
| **Polish** | 10 | Conserver les quatre pourcentages mesurés dans le commentaire de seuil |
| **Polish** | 11 | Aligner le Step 2.2 sur la forme des Steps 3.1/4.1/5.1 |
| **Polish** | 12 | Décaler les deux ancrages (`dal.student.ts:686`, `schemas.ts:59-61`) |
| **Polish** | 13 | Exprimer la marge frontend en branches (~5) plutôt qu'en points |

Aucun de ces correctifs ne remet en cause l'architecture de la campagne : ce sont des
corrections d'exécution. Une fois les six items « avant de coder » traités, le plan est
implémentable en l'état.

---

## 7. Confirmations de sûreté opérationnelle

- **Lecture seule respectée** : aucun fichier source, de configuration, de test, de spec
  ou de plan modifié. Le seul fichier écrit est ce rapport
  (`docs/superpowers/reviews/2026-08-05-revue-design-cloture-vitest.md`), non committé.
- **Aucune branche Neon créée ni touchée.** `bun run test:integration` et
  `bun run test:coverage:full` n'ont **pas** été lancés. Aucun accès à un système distant.
- **Commandes exécutées** : `bun run check` (exit 0), `bun run test` (exit 0),
  `bun run test:coverage` (exit 0, local, frontend uniquement, aucune base de données),
  plus des lectures (`git log`, `git status`, `grep`, `sed`, `ls`) et un `bun -e` qui
  n'a fait que lire `coverage/coverage-final.json`.
- **Effet de bord assumé** : `bun run test:coverage` a réécrit le rapport local
  `coverage/` (répertoire gitignoré) — il datait du 2026-08-03 et ne reflétait plus
  l'arbre. Aucun fichier suivi par git n'a changé : `git status --short` rend les mêmes
  trois lignes qu'à l'ouverture de la revue.
- **Aucun secret imprimé** : `.env.local` et tout `.env*` n'ont été ni lus ni affichés.
- **Aucune commande destructrice, aucun `git add`, `commit`, `push`, `stash` ou `checkout`.**
