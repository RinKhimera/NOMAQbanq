# Revue adversariale — clôture campagne vitest (`0008948..45d5e16`)

**Date** : 2026-08-05
**Branche** : `feat/stripe-fiabilite-paiements` (PR #135)
**Périmètre** : 6 commits, `10d4510` → `45d5e16` (23 fichiers, +1093 / −169)
**Posture** : relecteur hostile, lecture seule. Aucun fichier du dépôt modifié ; ce
rapport est le seul écrit.

## Gate

| Commande                      | Résultat                                       |
| ----------------------------- | ---------------------------------------------- |
| `bun run check`               | **exit 0** (prettier + tsc + eslint)           |
| `bun run test` (frontend)     | **exit 0** — 111 fichiers, **1273 tests** verts |
| `bun run test:integration`    | **non lancé** (crée une branche Neon — interdit) |
| `bun run test:coverage:full`  | **non lancé** (idem)                            |

## Méthode

Pour chaque test ajouté ou réécrit, une seule question : **le test échouerait-il si
on supprimait la ligne de code produit qu'il prétend protéger ?** Les gardes visées
ont été lues dans le code produit, les fixtures rejouées à la main à travers le
faux-db (`where: () => chain`, `then` indexé par table), et l'historique interrogé
(`git show 0008948:<fichier>`) pour distinguer ce que ce lot apporte de ce qui
existait déjà. Les chiffres du handoff ont été recomptés un par un.

---

## Constats

| #   | Sév | Fichier:ligne                                 | Problème                                                                              | Régression ? |
| --- | --- | --------------------------------------------- | ------------------------------------------------------------------------------------- | ------------ |
| 1   | 🔴  | `tests/features/exams-dal-student.test.ts:214` | Le test de l'invariant phare n'exerce pas la garde : il passe si on la supprime         | NON          |
| 2   | 🔴  | `docs/…/2026-08-03-vitest-audit-progress.md`   | « Deux invariants qu'aucun test n'exerçait » — faux pour les deux, preuves antérieures | NON          |
| 3   | 🟠  | `tests/features/training-dal.test.ts:130`      | Affirme un contrat contraire à la production ; assertion satisfaite par le faux-db      | NON          |
| 4   | 🟠  | `tests/features/users-dal.test.ts:204`         | Assertion tautologique qui fige un artefact du faux-db (valeur fausse en prod)          | NON          |
| 5   | 🟡  | `tests/integration/exam-audience.test.ts:230`  | L'assertion `escapeLike` ne prouve pas l'échappement (fenêtre `limit: 10` triée)        | NON          |
| 6   | 🟡  | `tests/features/exams-dal-student.test.ts:220` | Titre survendu : « voir les résultats » alors que la valeur est `NO_PARTICIPATION`      | NON          |
| 7   | 🟡  | `bun.lock`                                     | Bump non annoncé `@typescript-eslint/*` 8.56.1 → 8.66.0 dans un commit « active plugin » | NON          |

Aucun constat n'est une régression : **le diff ne touche aucun fichier de production**
hors le commentaire attendu (détail en fin de rapport).

---

### Constat 1 🔴 — Le test de l'invariant anti-fuite ne teste pas la garde

**Code** — [tests/features/exams-dal-student.test.ts:214-218](tests/features/exams-dal-student.test.ts#L214-L218) :

```ts
it("cache ses propres resultats tant que l'examen n'est pas termine", async () => {
  asUser("u1")
  mocks.rows.current = { exams: [openExam] }
  expect(await getParticipantExamResults("e1", "u1")).toBeNull()
})
```

La fixture ne pose **que** `exams`. Or le faux-db rend `[]` pour toute table absente
de `mocks.rows.current` ([tests/features/exams-dal-student.test.ts:52-55](tests/features/exams-dal-student.test.ts#L52-L55)).

**Pourquoi c'est un vrai défaut** — Déroulé de
[features/exams/dal.student.ts:462-548](features/exams/dal.student.ts#L462-L548) **si
on supprime la garde de la ligne 488** (`if (!isAdmin && Date.now() < exam.endDate.getTime()) return null`) :

1. l.473-485 — `exams` → `[openExam]`, `if (!exam)` non pris ;
2. l.499-508 — `.from(user)` → table absente → `[]` → `participantUser = null` ;
3. l.519-535 — `.from(examParticipations)` → table absente → `[]` → `p === undefined` ;
4. l.537-549 — `if (!p)` → `isAdmin` faux → **`return null`**.

Le test attend `null` : il passe. La garde 488 est donc **exécutée** (donc comptée en
couverture) mais **non protégée**. La preuve la plus courte : le test
[exams-dal-student.test.ts:245-249](tests/features/exams-dal-student.test.ts#L245-L249)
(« refuse a un non-admin dont la participation n'existe pas », avec `closedExam`)
atteint **exactement le même `return null` ligne 548**. Les deux tests ne diffèrent
que par une date que le code, dans cette fixture, n'a jamais l'occasion de lire.

C'est précisément l'invariant que le handoff met en avant comme justification
sécurité de la campagne — voir constat 2.

**Régression ?** NON (fichier de test uniquement).

**Comment je l'ai prouvé** — Lecture de la fonction complète + du faux-db ; mise en
correspondance des lignes de retour ; `grep` de tous les appels à
`getParticipantExamResults` dans `tests/` (aucun autre test unitaire ne pose une
participation complétée avec un examen ouvert).

**Correctif suggéré** — Poser une participation complétée dans la fixture, pour que
la seule issue non-nulle soit celle que la garde bloque :

```ts
mocks.rows.current = {
  exams: [openExam],
  user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
  exam_participations: [
    { id: "p1", userId: "u1", status: "completed", score: 50,
      startedAt: new Date(), completedAt: new Date() },
  ],
  exam_questions: [], exam_answers: [],
}
expect(await getParticipantExamResults("e1", "u1")).toBeNull()
```

Avec cette fixture, supprimer la ligne 488 fait renvoyer l'objet de résultats → le
test devient rouge. Le pendant admin (constat 6) doit alors asserter la forme de
succès, pas `not.toBeNull()`.

---

### Constat 2 🔴 — Les « deux invariants qu'aucun test n'exerçait » étaient déjà testés

**Code** — [docs/superpowers/handoffs/2026-08-03-vitest-audit-progress.md](docs/superpowers/handoffs/2026-08-03-vitest-audit-progress.md) :

> Deux invariants de sécurité qu'aucun test n'exerçait :
> - `dal.student.ts:485` — un étudiant ne voit pas ses propres résultats tant que
>   l'examen n'est pas terminé (`!isAdmin && Date.now() < endDate`). **Branche jamais prise.**
> - `training/dal.ts:539` — refus IDOR sur la session d'entraînement d'autrui, et son
>   exception admin.

**Pourquoi c'est un vrai défaut** — Les deux étaient couverts **et protégés** par des
tests d'intégration antérieurs au lot :

1. [tests/integration/exams.test.ts:383-386](tests/integration/exams.test.ts#L383-L386) :

```ts
it("getParticipantExamResults (étudiant, examen actif) → null avant endDate", async () => {
  asStudent()
  expect(await getParticipantExamResults(noPauseId, STUDENT_ID)).toBeNull()
})
```

Ce test est discriminant, lui : le test qui le précède immédiatement
([exams.test.ts:370-381](tests/integration/exams.test.ts#L370-L381)) vérifie que
l'admin obtient `r.participant.score === 50` — donc une participation **complétée
existe réellement** en base à cet instant. Supprimez la garde 488 : l'étudiant reçoit
l'objet de résultats complet, le test devient rouge.

2. [tests/integration/training.test.ts:390-391](tests/integration/training.test.ts#L390-L391) :

```ts
expect(await getTrainingSessionById(sid)).toBeNull()
expect(await getTrainingSessionResults(sid)).toBeNull()
```

sur une session bien réelle créée par `USER_ID`, lue par un intrus. Supprimez la
garde [training/dal.ts:539](features/training/dal.ts#L539) : la vue est renvoyée,
le test devient rouge.

**Les deux existaient à `0008948`**, vérifié par `git show`. Le premier remonte à
`1f121c5` (« feat(exams): data layer — DAL + actions + integration tests (5.5a) »).

Conséquence : la phrase « Branche jamais prise » ne peut pas être vraie sur la mesure
agrégée, qui inclut le projet `integration` (`test:coverage:full` lance
`--project frontend --project integration`). Quelle qu'ait été la lecture du
`coverage-final.json`, **la conclusion sécurité qui en est tirée est fausse** — et
elle est le principal argument de valeur de la campagne.

Ce n'est pas anodin : cumulé au constat 1, le dépôt se retrouve avec un document de
clôture qui attribue à un test décoratif la protection réellement assurée par un test
d'intégration plus ancien. Si quelqu'un allège un jour les tests d'intégration en se
fiant à « c'est couvert en unitaire », la garde 488 devient silencieusement nue.

**Régression ?** NON (documentation).

**Comment je l'ai prouvé** — `grep -rn "getParticipantExamResults" tests/`,
`grep -rn "getTrainingSessionById" tests/integration/`, puis
`git show 0008948:tests/integration/{exams,training}.test.ts` pour dater les deux
tests, puis lecture du contexte pour vérifier qu'une participation / session existe
bien au moment de l'assertion.

**Correctif suggéré** — Réécrire le paragraphe : ces deux invariants étaient couverts
en intégration ; le lot leur ajoute une couverture **unitaire** (rapide, sans base),
ce qui reste légitime — et corriger le constat 1 pour que ce soit vrai du premier.
Retirer « Branche jamais prise ».

---

### Constat 3 🟠 — `getAvailableDomains` : le test affirme un contrat que la production n'a pas

**Code** — [tests/features/training-dal.test.ts:115-134](tests/features/training-dal.test.ts#L115-L134),
`it("chaque lecture rend sa valeur vide sans session")` :

```ts
anonymous()
…
expect(await getAvailableDomains()).toEqual({ domains: [], totalQuestions: 0 })
```

avec, en tête de fichier ([training-dal.test.ts:77-79](tests/features/training-dal.test.ts#L77-L79)) :

```ts
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => mocks.session.current),
}))
```

**Pourquoi c'est un vrai défaut** — Deux problèmes distincts :

1. **Le contrat asserté n'existe pas.** `getAvailableDomains` utilise
   `await requireSession()` ([features/training/dal.ts:433](features/training/dal.ts#L433)),
   et le vrai `requireSession` fait `redirect("/connexion")`
   ([lib/auth-guards.ts:6-10](lib/auth-guards.ts#L6-L10)) — donc **jette**. En
   production, `getAvailableDomains()` sans session ne renvoie jamais
   `{ domains: [], totalQuestions: 0 }`. Le mock remplace une redirection par un
   `null` silencieux, et le test grave cette fiction dans le dépôt.
2. **L'assertion ne discrimine rien.** `beforeEach` remet `mocks.rows.current = {}`
   ([training-dal.test.ts:109-112](tests/features/training-dal.test.ts#L109-L112)),
   donc `.from(questions)` rend `[]`, donc `domains = []` et `totalQuestions = 0` —
   que la ligne `await requireSession()` soit présente ou supprimée. Sur cette seule
   assertion, la garde peut disparaître sans que rien ne devienne rouge.

Même faiblesse, moins grave, pour deux autres assertions du même `it` :
`getTrainingSessionById("s1")` et `getTrainingSessionResults("s1")` retombent sur
`if (!s) return null` ([training/dal.ts:538](features/training/dal.ts#L538)) faute de
lignes `training_sessions` — elles passent aussi sans garde de session. Les cinq
autres (`getActiveTrainingSession`, `getTrainingStats`, `getMyTrainingScoreHistory`,
`getBookmarkedQuestionIds`, `getTrainingHistory`) échoueraient, elles, par
`TypeError` sur `session.user.id` : discriminantes, mais par crash plutôt que par
décision.

**Régression ?** NON.

**Comment je l'ai prouvé** — Lecture de `lib/auth-guards.ts` (13 lignes), de
`features/training/dal.ts:432-448`, et déroulé du faux-db avec `mocks.rows.current = {}`.

**Correctif suggéré** — Faire porter au mock le comportement réel et asserter le rejet :

```ts
requireSession: vi.fn(async () => {
  if (!mocks.session.current) throw new Error("NEXT_REDIRECT")
  return mocks.session.current
}),
…
await expect(getAvailableDomains()).rejects.toThrow("NEXT_REDIRECT")
```

Pour `getTrainingSessionById`/`Results`, poser une ligne `training_sessions` dans la
fixture anonyme afin que la garde soit la seule cause du `null`.

---

### Constat 4 🟠 — Assertion tautologique qui fige un artefact du faux-db

**Code** — [tests/features/users-dal.test.ts:186-205](tests/features/users-dal.test.ts#L186-L205),
`it("rend un produit nul quand la transaction n'en porte pas")` :

```ts
mocks.rows.current = { user: [detailRow], user_access: [], transactions: [ /* 1 transaction */ ] }
const panel = await getUserPanelData("u9")
expect(panel?.recentTransactions[0]?.product).toBeNull()
expect(panel?.totalTransactionCount).toBe(0)
```

**Pourquoi c'est un vrai défaut** — `getUserPanelData` lance trois requêtes en
parallèle ([features/users/dal.ts:619-646](features/users/dal.ts#L619-L646)) ; la
troisième est un `count(*)` sur la **même table** `transactions`. Le faux-db étant
indexé par table, elle rend le **même tableau** que la liste, c'est-à-dire la
transaction de la fixture. `countRows[0].count` est donc `undefined`, et
[users/dal.ts:668](features/users/dal.ts#L668) applique `?? 0`.

L'assertion `toBe(0)` :

- n'a aucun rapport avec le titre du test (le produit nul) ;
- fige la valeur **fausse** : en production, une transaction ⇒ `totalTransactionCount === 1` ;
- ne peut jamais valoir autre chose que `0` avec ce faux-db — sauf si quelqu'un
  remplaçait le `count(*)` par `txRows.length`, auquel cas le test deviendrait rouge
  **pour un changement plus correct**. L'assertion protège donc à l'envers.

La première assertion (`product` à `null`) est, elle, légitime et discriminante.

**Régression ?** NON.

**Comment je l'ai prouvé** — Lecture de `getUserPanelData` (les trois `.from(transactions)`)
et du `then` du faux-db ([users-dal.test.ts:45-48](tests/features/users-dal.test.ts#L45-L48)).

**Correctif suggéré** — Supprimer l'assertion. Un compte agrégé n'est pas observable
à travers un faux-db indexé par table : il relève de
`tests/integration/payments-admin-dal.test.ts`.

---

### Constat 5 🟡 — L'assertion `escapeLike` ne prouve pas l'échappement

**Code** — [tests/integration/exam-audience.test.ts:224-236](tests/integration/exam-audience.test.ts#L224-L236) :

```ts
const rows = await searchSelectableUsers({ query: meta, limit: 10 })
expect(rows.every((u) => u.id !== MEMBER_ID && u.id !== MEMBER2_ID)).toBe(true)
```

**Pourquoi c'est un vrai défaut** — L'assertion dit « ces deux utilisateurs ne sont pas
dans les 10 premières lignes triées par nom », pas « le motif a été échappé ». Sans
`escapeLike` ([features/users/dal.ts:50](features/users/dal.ts#L50)), `%` devient un
joker : la requête rend les 10 premiers non-admins par `asc(user.name)`
([users/dal.ts:215-216](features/users/dal.ts#L215-L216)). Le test échoue aujourd'hui
uniquement parce que les fixtures sont nommées `"AAud Alice Dupont"` / `"BAud Bob Martin"`
([exam-audience.test.ts:104-113](tests/integration/exam-audience.test.ts#L104-L113)),
qui trient en tête. Une renommée de fixture, ou une dizaine d'utilisateurs résiduels
d'un autre fichier triant avant `"BAud"`, et l'assertion passe avec un `escapeLike`
supprimé.

Le cas `\` est en revanche solide : sans échappement le motif `%\` fait lever
Postgres (`22025`, « LIKE pattern must not end with escape character ») et le test
casse bruyamment. Les deux autres sont faibles.

**Régression ?** NON.

**Comment je l'ai prouvé** — Lecture de `searchSelectableUsers` (tri + `limit`), des
noms seedés, et `grep -rn "email: \`[^\`]*_" tests/integration/*.ts` + équivalent `%`
sur 81 déclarations d'email : **aucun nom ni email seedé ne contient `%` ou `_`**.

**Correctif suggéré** — Assertion exacte et indépendante de l'ordre, justifiée par le
grep ci-dessus :

```ts
expect(rows).toHaveLength(0)
```

Plus fort encore, si l'on veut prouver les deux sens : seeder un utilisateur témoin
nommé `"%Aud literal"` et vérifier qu'il est le **seul** rendu pour `query: "%"`.

---

### Constat 6 🟡 — Titre survendu sur le pendant admin

**Code** — [tests/features/exams-dal-student.test.ts:220-224](tests/features/exams-dal-student.test.ts#L220-L224) :

```ts
it("laisse l'admin voir les resultats d'un examen encore ouvert", async () => {
  asAdmin()
  mocks.rows.current = { exams: [openExam], user: [], exam_answers: [] }
  expect(await getParticipantExamResults("e1", "u1")).not.toBeNull()
})
```

**Pourquoi c'est un vrai défaut** — La fixture ne pose pas de participation, donc la
valeur renvoyée est `{ error: "NO_PARTICIPATION", … }`
([features/exams/dal.student.ts:537-547](features/exams/dal.student.ts#L537-L547)) :
l'admin ne « voit » aucun résultat. Le test discrimine bien le contournement admin de
la ligne 488 (sans lui, `null`), mais `not.toBeNull()` est satisfait par n'importe
quel objet — y compris une future forme d'erreur qui masquerait une régression.

**Régression ?** NON.

**Comment je l'ai prouvé** — Même déroulé que le constat 1, branche `isAdmin`.

**Correctif suggéré** — Après avoir corrigé la fixture du constat 1 (participation
complétée), asserter la forme de succès : `expect(res).toHaveProperty("participant")`.

---

### Constat 7 🟡 — Bump de dépendances non annoncé

**Code** — `bun.lock`, commit `10d4510` (« test(lint): active @vitest/eslint-plugin sur tests/** »).

**Pourquoi c'est un vrai défaut** — Outre l'ajout attendu de
`@vitest/eslint-plugin@1.6.26`, le lockfile **remonte `@typescript-eslint/*` de 8.56.1
à 8.66.0** au niveau racine (`project-service`, `scope-manager`, `tsconfig-utils`,
`types`, `typescript-estree`, `utils`, `visitor-keys`, `ts-api-utils` 2.4.0 → 2.5.0)
et re-épingle 8.56.1 en dépendances imbriquées pour `@typescript-eslint/eslint-plugin`,
`/parser` et `/type-utils`. Effet de hoisting de `bun install`, non mentionné dans le
message de commit ni dans le handoff. C'est du `devDependencies` et `bun run check`
est vert, donc l'impact est nul aujourd'hui — mais un lecteur du journal ne s'attend
pas à ce qu'un commit « active un plugin » déplace la chaîne de lint de dix versions
mineures.

**Régression ?** NON (dev-only, gate verte).

**Comment je l'ai prouvé** — `git diff 0008948..45d5e16 -- bun.lock`.

**Correctif suggéré** — Une ligne dans le handoff. Pas de retour arrière.

---

## Faux positifs écartés (avec preuve)

**1. Les 23 réécritures zod `result.error?.issues[0]?.message` n'affaiblissent rien.**
Chaque site est précédé d'un `expect(result.success).toBe(false)` **dur** — vérifié sur
les 23, tous fichiers `tests/schemas/**`. Un `expect` Vitest jette à l'échec : si la
discriminante bascule, le test s'arrête avant la ligne suivante. Et si l'on suppose la
première assertion retirée, `?.` rend `undefined`, et `expect(undefined).toContain(x)`
comme `expect(undefined).toBe(x)` échouent. Aucun chemin où l'ancienne forme échouait
et la nouvelle passe. Voir aussi réponse 1.

**2. `training-concurrency.test.ts:147-151` — l'attente calculée n'introduit pas de flake.**
La branche perdante attend désormais `score: null` en plus du statut. Vérifié :
`seedSession` pose `score: o.status === "completed" ? 100 : null`
([training-concurrency.test.ts:71](tests/integration/training-concurrency.test.ts#L71))
et `abandonTrainingSession` ne fait que
`.set({ status: "abandoned" })` ([features/training/actions.ts:565-574](features/training/actions.ts#L565-L574)) —
il ne touche jamais au score. L'attente est correcte et **plus stricte** qu'avant.

**3. `exams.test.ts:266` — l'attente calculée est strictement plus forte.**
`expect(answerSet).toEqual(start.success ? storedSet : new Set())` : la branche
d'échec, auparavant muette, exige maintenant qu'aucune réponse n'existe. Vérifié que
le test n'écrit aucune réponse en dehors de `startExam`
([exams.test.ts:230-268](tests/integration/exams.test.ts#L230-L268)) : si `startExam`
échoue, il n'y a ni participation ni réponse, l'attente est atteignable.

**4. `users-account.test.ts:313-341` — la réécriture est un gain net.**
L'ancienne forme n'assertait **rien** si un autre fichier avait laissé un admin actif.
La nouvelle appelle toujours `deleteMyAccount` et attend `res.success === !isSoleAdmin`
plus la cohérence de `deletedAt`. Supprimer la garde « dernier admin » rend le test
rouge dans le cas seul-admin. Le nettoyage final (`db.delete(user)`) est inchangé.

**5. `StatCard.test.tsx:72-78` — équivalence stricte.**
`expect(s.includes(c)).toBe(cond)` couvre les deux branches de l'ancien `if/else`.
Sur `footerDiv === null`, l'ancienne comme la nouvelle forme échouent.

**6. `exam-runner.test.ts:274` — pas de trou de typage.**
`resumeExam` renvoie une union **non discriminée**
(`{ success: boolean; error?: string; totalPauseDurationMs?: number }`,
[features/exams/actions.ts:987-995](features/exams/actions.ts#L987-L995)) : l'accès
non narrowé compile, ce que `tsc --noEmit` confirme. Et `expect(undefined).toBeGreaterThanOrEqual(0)`
échoue — donc plus strict qu'avant, pas moins.

**7. Le seuil à 80 est un vrai verrou, sur un périmètre inchangé.**
Le job CI `integration` lance `bun run test:coverage:full`
([.github/workflows/ci.yml](.github/workflows/ci.yml)), qui passe
`--config vitest.coverage.config.ts --project frontend --project integration` : les
quatre seuils sont bien appliqués sur le périmètre élargi (`features/**`, `app/api/**`).
Et `git show --stat 1bf97c3` ne touche que `vitest.coverage.config.ts` (seuils +
commentaire) et le commentaire de `features/questions/schemas.ts` : **ni `include` ni
`exclude` n'ont bougé**. Pas de seuil qui monte pendant que le périmètre rétrécit.

**8. `getExamQuestionExplanations` « retire les questions verrouillées » est un vrai test.**
Le filtrage est bien en JS —
`authorized = […].filter((id) => !locked.has(id))`
([features/exams/dal.student.ts:708-713](features/exams/dal.student.ts#L708-L713)) —
puis `if (authorized.length === 0) return []`. Supprimez le `.filter` : `authorized`
vaut `["q1"]`, la requête `question_explanations` rend la ligne de la fixture, et le
test attendant `[]` devient rouge. Le renvoi croisé du commentaire vers
`tests/integration/exams.test.ts` « étudiant non autorisé sur une question témoin »
est exact ([exams.test.ts:480](tests/integration/exams.test.ts#L480)).

**9. Le nouveau commentaire de `features/questions/schemas.ts` est exact.**
Il annonce « la borne effective vit dans la DAL (`clamp(count, 1, 10)`) » : vérifié à
[features/questions/dal.ts:417](features/questions/dal.ts#L417) (`const safeCount = clamp(count, 1, 10)`).
L'ancien commentaire, lui, était faux. Correction réelle.

**10. Les chiffres du handoff sont exacts** (sauf la ligne 485, constat 6 du tableau) :

| Affirmation                | Vérification                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| 49 violations, 23 / 17 / 9 | Recomptées **une par `expect` conditionnel** : 23 (schemas) + 17 (`training`, `upload-rate-limit`, `uploads-actions`, `StatCard`) + 9 (`exam-runner` ×3, `exams` ×1, `training-concurrency` ×3, `users-account` ×2) = **49** ✅ |
| 40 tests ajoutés           | 19 + 13 (`it.each` déplié) + 8 = **40** ✅                                                                  |
| +48 branches               | 2569 − 2521 = **48** ✅                                                                                     |
| ~54 branches de marge      | 2569 − ⌈0,80 × 3143⌉ = 2569 − 2515 = **54** ✅                                                              |
| 1597 tests                 | 1273 (frontend, mesurés ici) + 322 déclarations d'intégration dont un `it.each` à 3 cas = **1597** ✅       |
| `training/dal.ts:539`      | ✅ exactement la garde IDOR                                                                                 |
| `users/dal.ts:50`          | ✅ exactement `escapeLike`                                                                                   |
| `dal.student.ts:485`       | ❌ 485 = `if (!exam) return null` ; la garde visée est à **488**                                             |
| `no-focused-tests` : zéro  | ✅ `grep -rn "\.only(" tests/` → aucun résultat                                                              |

Les quatre pourcentages agrégés (88,22 / 81,73 / 86,27 / 89,28) ne sont pas
vérifiables ici : `test:coverage:full` crée une branche Neon, interdit par le
périmètre. Ils sont **internement cohérents** (voir les deux lignes « branches »
ci-dessus), ce qui est tout ce qu'on peut établir sans le run.

---

## Réponses aux questions ouvertes

**1. Le remplacement du narrowing zod par `result.error?.issues[0]?.message` : un cas
où l'ancienne forme échouait et la nouvelle passe ?**
**Non.** Aucun. Le raisonnement complet est au faux positif 1. Le point qui mérite
d'être conscientisé : la sûreté ne vient plus du langage mais de la **ligne
adjacente** (`expect(result.success).toBe(false)`). Un futur `expect.soft` sur cette
ligne, ou sa suppression, ferait couler la garantie — mais même alors l'assertion
échouerait sur `undefined`. Le risque résiduel est nul en pratique ; il vaut une ligne
de convention, pas un correctif.

**2. Le cas `escapeLike` prouve-t-il vraiment l'échappement ?**
**Partiellement, et je ne suis pas d'accord avec la formulation du commentaire.** Le
cas `\` est probant (Postgres lève sans échappement). Les cas `%` et `_` ne prouvent
que « ces deux utilisateurs ne sont pas dans les 10 premiers noms », ce qui dépend du
seed et de l'ordre. Détail et correctif en une ligne au constat 5.

**3. Le mock de `react` pour neutraliser `cache()` : bruit à retirer ?**
**Non — à garder, mais l'auteur a raison sur le fond : il est inerte aujourd'hui.**
Vérifié empiriquement, hors RSC : `React.cache(fn)` appelé trois fois avec le même
argument exécute `fn` **trois fois** (React 19.2.8) — passe-plat confirmé. Je le
garderais quand même : si React changeait ce comportement, la mémoïsation
survivrait aux `beforeEach` qui réaffectent `mocks.rows.current`, et les tests
passeraient sur des lignes périmées — un faux vert silencieux, dépendant de l'ordre,
très coûteux à diagnostiquer. Quatre lignes contre ce mode de panne, alignées sur 20
fichiers d'intégration : c'est le bon prix.

**4. Le filtrage de `getExamQuestionExplanations` est-il bien en JS ?**
**Oui, confirmé** — `features/exams/dal.student.ts:713`. Le test est légitime et
discriminant. Détail au faux positif 8.

---

## Non-régression

Fichiers touchés hors `tests/`, `docs/` :
`eslint.config.mjs`, `vitest.coverage.config.ts`, `package.json`, `bun.lock`,
et `features/questions/schemas.ts`.

Ce dernier est bien **commentaire seul** : le diff ne porte que sur les lignes
préfixées `//`, `export const loadRandomQuizQuestionsSchema` et `count: z.number().int()`
apparaissent en contexte non modifié. **Aucun changement de comportement applicatif
dans tout le lot** — l'affirmation de la campagne tient.

## Verdict

### Ces tests protègent-ils réellement ce qu'ils annoncent ? **NON — pas les deux qui comptent.**

Le lot est globalement sain : les 49 corrections `no-conditional-expect` sont
équivalentes ou strictement plus strictes (aucun affaiblissement trouvé sur les 49),
le seuil à 80 % est un vrai verrou appliqué en CI sur un périmètre inchangé, et les
chiffres du handoff sont exacts au comptage près. Mais **les deux invariants de
sécurité présentés comme la valeur de la campagne ne sont pas protégés par ce qu'elle
a ajouté** : l'un est testé par une fixture qui court-circuite la garde (constat 1),
et tous deux étaient déjà protégés par des tests d'intégration antérieurs que le
handoff déclare inexistants (constat 2).

**Bloquants** (à traiter avant merge) :

- **Constat 1** — corriger la fixture de
  `tests/features/exams-dal-student.test.ts:214` pour qu'elle exerce réellement
  `features/exams/dal.student.ts:488`, et le constat 6 dans la foulée.
- **Constat 2** — corriger le handoff : retirer « Branche jamais prise » / « qu'aucun
  test n'exerçait », créditer `tests/integration/exams.test.ts:383` et
  `tests/integration/training.test.ts:390`.

**Non bloquants**, à traiter au fil de l'eau : constats 3, 4, 5, 7.

## Sûreté opérationnelle

- Revue **strictement en lecture**. Le seul fichier écrit est ce rapport ; il n'est
  **pas** committé (`git status` était propre avant, et le reste hors ce fichier).
- `bun run test:integration` et `bun run test:coverage:full` **non lancés** — aucune
  branche Neon créée.
- Aucun `.env*` lu ni imprimé. Aucun `git push`, aucune commande destructrice, aucun
  serveur de dev démarré.
- Seules commandes d'écriture indirecte : `bun run check` et `bun run test`, tous deux
  en lecture seule sur le dépôt.
