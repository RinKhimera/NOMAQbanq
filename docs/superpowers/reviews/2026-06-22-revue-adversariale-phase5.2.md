# Revue adversariale — Phase 5.2 (paiements manuels + admin transactions/users)

**Date** : 2026-06-22
**Périmètre** : `git diff ef8dd7e..36a8649 -- features/ app/ components/ tests/`
(commits `3444fa2` 5.2c-core, `65eee54` 5.2c-UI, `36a8649` 5.2d ; `e3b1050` = doc, ignoré).
**Référence sémantique** : `convex/payments.ts`, `convex/users.ts` (comportement attendu).
**Méthode** : lecture du code réel + schéma Drizzle + driver DB. `bun run check` (tsc + eslint) = **vert**.
Branche jamais déployée ; écrans Convex non convertis cassés au runtime = acceptable (Option C).

> **Note de cadrage** : le driver est `drizzle-orm/node-postgres` + `pg.Pool` (`db/index.ts:2-14`),
> **pas** `neon-http`. Donc `db.transaction()` ouvre une vraie transaction sur une connexion
> dédiée et `SELECT … FOR UPDATE` verrouille réellement la ligne `user`. **Toute l'histoire
> d'atomicité / sérialisation des octrois concurrents tient** (voir faux positifs §FP-1).

---

## Synthèse des findings

| #   | Sévérité    | Titre                                                                                                                         | Fichier                                                     |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| H1  | **HAUTE**   | Suppression d'une transaction **combo** impossible (FK `restrict` vs révocation mono-type)                                    | `features/payments/{lib,actions}.ts`                        |
| M1  | **MOYENNE** | `products.code` sans contrainte `UNIQUE` → résolution produit non déterministe                                                | `db/schema/payments.ts`, `features/payments/actions.ts`     |
| M2  | **MOYENNE** | Server Actions forwardent un `limit`/`offset` client **non borné** au DAL                                                     | `features/payments/actions.ts`, `features/users/actions.ts` |
| B1  | BASSE       | `getAccessStatus`/`hasAccess` : zéro autorisation interne (defense-in-depth) ; `hasAccess` bypass sur le rôle de la **cible** | `features/payments/dal.ts`                                  |
| B2  | BASSE       | Tri par `role` : ordre divergent (ordre d'enum Postgres vs chaîne Convex)                                                     | `features/users/dal.ts`                                     |
| B3  | BASSE       | `amountPaid` : `0` accepté côté serveur alors que le client exige `> 0`                                                       | `features/payments/schemas.ts`                              |
| I1  | INFO        | Remboursement d'un combo ne révoque qu'un type (préservé de Convex, mais asymétrique)                                         | `features/payments/actions.ts`                              |

---

## H1 — HAUTE : la suppression d'une transaction **combo** échoue systématiquement (FK `restrict`)

**Fichiers** :

- `features/payments/lib.ts:106-123` (octroi combo → écrit `lastTransactionId` sur **exam ET training**)
- `features/payments/lib.ts:133-156` (`revokeAccessIfLast` ne traite **qu'un** `accessType`)
- `features/payments/actions.ts:258-264` (`deleteManualTransaction` : revoke mono-type **puis** `delete`)
- `db/schema/payments.ts:114-116` (`userAccess.lastTransactionId` → `transactions.id`, **`notNull` + `onDelete: "restrict"`**)

### Description

Pour un produit `isCombo`, `grantManualAccess` accorde **les deux** accès et pose
`lastTransactionId = <txId>` sur la ligne `user_access` _exam_ **et** _training_
(`lib.ts:106-123`, boucle `for (const accessType of types)`).

La transaction stocke un **seul** `accessType` (`lib.ts:99`, `accessType: product.accessType`,
ex. `"exam"` pour `premium_access`). À la suppression :

```ts
// features/payments/actions.ts:258-264
const revoked = await revokeAccessIfLast(tx, {
  id: transaction.id,
  userId: transaction.userId,
  accessType: transaction.accessType, // ← UN SEUL type (ex. "exam")
})
await tx.delete(transactions).where(eq(transactions.id, transactionId))
```

`revokeAccessIfLast` supprime la ligne `user_access` **exam** (son `lastTransactionId` pointe la tx),
mais la ligne `user_access` **training** continue de référencer cette même transaction.
Le `DELETE transactions` viole alors la FK `restrict` (`payments.ts:114-116`) → l'instruction
échoue, `db.transaction` **rollback**, l'action retombe sur le `catch` générique
(`actions.ts:269-283`) et renvoie « Erreur serveur. Réessayez. ».

**Conséquence** : un admin ne peut **jamais** supprimer une transaction manuelle combo
(`premium_access`) tant qu'elle reste la dernière à accorder l'un des deux types — c.-à-d. le
cas normal juste après l'octroi. L'UI affiche une erreur opaque ; aucune action corrective
possible depuis l'admin.

### Pourquoi c'est une régression (et pas une sémantique préservée)

En Convex, `userAccess.lastTransactionId` n'a **aucune** contrainte FK. `deleteManualTransaction`
(`convex/payments.ts:1114-1143`) supprimait la tx **avec succès**, laissant simplement une
référence pendante (dangling) sur la ligne training. Le port Drizzle ajoute une FK `restrict`
légitime, mais la logique de révocation mono-type n'a pas été adaptée → ce qui passait en
Convex **casse** ici.

### Repro (test d'intégration prêt à l'emploi, branche Neon éphémère)

Non couvert : `payments-manual.test.ts` teste `grantManualAccess` et `revokeAccessIfLast`
**isolément** ; aucun test n'exécute le chemin complet `revoke → delete` sur un combo.

```ts
it("supprime une transaction combo (revoke + delete)", async () => {
  const u = createId()
  await db
    .insert(user)
    .values({ id: u, name: "combo del", email: `cd-${createId()}@t.invalid` })
  const txId = await db.transaction((tx) =>
    grantManualAccess(tx, {
      userId: u,
      product: pCombo,
      amountPaid: 9000,
      currency: "CAD",
      paymentMethod: "interac",
      recordedBy: u,
    }),
  )
  // Reproduit deleteManualTransaction : revoke mono-type puis delete.
  await expect(
    db.transaction(async (tx) => {
      await revokeAccessIfLast(tx, { id: txId, userId: u, accessType: "exam" })
      await tx.delete(transactions).where(eq(transactions.id, txId)) // ← FK violation training
    }),
  ).rejects.toThrow() // FK restrict sur user_access.last_transaction_id (training)
})
```

### Correctif suggéré

Réconcilier la révocation avec la sémantique combo. Au choix :

1. Dans `deleteManualTransaction`/`updateManualTransaction`, **révoquer les deux types** quand
   la tx est combo (passer la liste des `accessType` réellement accordés, pas un seul), OU
2. Avant le `DELETE`, **détacher** toute ligne `user_access` dont `lastTransactionId = txId`
   pour les types non révoqués (réaffecter à la transaction précédente, ou passer la FK en
   `ON DELETE SET NULL` + rendre `lastTransactionId` nullable), OU
3. Au minimum, dériver les types accordés depuis `product.isCombo` (re-lookup produit) au lieu
   du champ scalaire `transaction.accessType`.

Garder la cohérence avec I1 (remboursement combo).

---

## M1 — MOYENNE : `products.code` sans `UNIQUE` → résolution produit non déterministe

**Fichiers** :

- `db/schema/enums.ts:3-9` + `db/schema/payments.ts:29,48` (`code` = colonne + **index non unique**)
- `features/payments/actions.ts:118-128` (`recordManualPayment` : lookup `eq(code) .limit(1)` **sans `orderBy`**)
- Réf. Convex : `convex/payments.ts:836-838` et `:206-211` utilisaient `.withIndex("by_code").unique()`

### Description

Côté Convex, la résolution d'un produit par code passait par `.unique()` : une **assertion
runtime** garantissant l'unicité (throw si doublon). Le schéma Drizzle ne déclare qu'un
`index("products_code_idx")` **non unique** (`payments.ts:48`). `recordManualPayment` fait :

```ts
// features/payments/actions.ts:118-128
const [product] = await tx.select({...}).from(products)
  .where(eq(products.code, data.productCode)).limit(1)   // ← aucun ORDER BY
```

S'il existe deux produits avec le même `code` (ex. un ancien désactivé + un actif, ou un seed
rejoué), Postgres renvoie une ligne **arbitraire** (ordre physique). L'octroi peut alors utiliser
le mauvais `durationDays` / `accessType` / `isCombo` → durée d'accès ou type erroné, silencieusement.

**Symptôme UI corollaire** : `getAvailableProducts` (`dal.ts:120-142`) liste tous les produits
actifs ; le `<Select>` du modal utilise `key={product.code}` (`manual-payment-modal.tsx:335-336`).
Deux produits de même code ⇒ **clés React dupliquées** + entrée fantôme non sélectionnable.

### Impact

Intégrité des données : la garantie d'unicité du code (invariant historique de l'app, porté par
`.unique()` Convex) n'est plus appliquée nulle part. Contingent à l'existence d'un doublon — mais
rien n'empêche d'en créer un, et le futur portage de `upsertProduct`/`seedProducts` (Convex) y
serait exposé.

### Correctif suggéré

Remplacer `index("products_code_idx")` par `uniqueIndex("products_code_unique")` (migration), et,
défensivement, ajouter un `ORDER BY` déterministe dans le lookup. Cela restaure l'invariant et
permet à un futur `onConflictDoUpdate({ target: products.code })` côté seed.

---

## M2 — MOYENNE : Server Actions forwardent `limit`/`offset`/filtres client **non bornés** au DAL

**Fichiers** :

- `features/payments/actions.ts:47-55` (`loadAdminTransactions(params)` → `getAllTransactions(params)`)
- `features/payments/dal.ts:324-336` (`limit` paramétrable, défaut 20, **aucun plafond**)
- `features/users/actions.ts:24-29` (`loadUsersPage(filters)` → `getUsersWithFilters(filters)`)
- `features/users/dal.ts:138-148` (`limit`/`offset` paramétrables, **aucun plafond, aucun zod**)

### Description

Les actions client-callable passent l'objet `params`/`filters` **tel quel** au DAL. Le type
TypeScript de `loadAdminTransactions` n'expose pas `limit`, mais TS ne contraint pas le runtime :
une requête forgée `{ type, status, limit: 100000 }` atteint `getAllTransactions` qui exécute
`.limit(100001)`. Idem `loadUsersPage` (`limit`/`offset` arbitraires, et **aucune** validation zod
sur `UsersFilters`, contrairement aux mutations qui font `safeParse`).

C'est une entorse directe à la règle « **IMPORTANT — Unbounded queries** : Max 1000 docs par query »
(CLAUDE.md / `.claude/rules/convex-backend.md`). La pagination keyset/offset elle-même est correcte ;
c'est la **borne supérieure** qui manque.

### Impact

Surface bornée à un **admin** (les deux actions sont derrière `requireRole(["admin"])`, et
`requireRole` redirige les non-admins). Donc pas d'escalade ni de fuite cross-tenant : impact =
auto-DoS / requête lourde déclenchable par un admin (ou un appel hors-UI authentifié admin). Réel
mais à portée limitée → MOYENNE basse.

### Correctif suggéré

Clamp serveur systématique : `const safeLimit = Math.min(Math.max(1, limit ?? 20), 100)` dans les
DAL paginés, et valider `UsersFilters`/params via zod dans les actions (cohérent avec
`recordManualPayment`/`updateManualTransaction`). Ne pas faire confiance au type pour borner le runtime.

---

## B1 — BASSE : `getAccessStatus`/`hasAccess` sans autorisation interne (defense-in-depth) ; `hasAccess` bypass sur le rôle de la **cible**

**Fichiers** : `features/payments/dal.ts:34-63` (`getAccessStatus(userId?)`), `:69-95` (`hasAccess(type, userId?)`)

### Description

Quand un `userId` explicite est fourni, ni `getAccessStatus` ni `hasAccess` ne vérifient que
**l'appelant** a le droit de lire l'accès d'autrui. Pire, `hasAccess` applique le bypass admin sur
le rôle de la **cible** (`dal.ts:80-86`) : `hasAccess("exam", X)` renvoie `true` si `X` est admin,
quel que soit l'appelant.

**État réel (mitigation)** — cette fois, **tous les chemins d'appel avec `userId` sont gardés en amont** :

- `app/(admin)/layout.tsx:11` → `requireRole(["admin"])` (barrière serveur de tout le groupe admin) ;
- `app/(admin)/admin/users/[id]/page.tsx:22` → `requireRole(["admin"])` explicite avant `getAccessStatus(id)` ;
- `loadUserAccessStatus` (`actions.ts:79-85`) garde `requireRole`.
- `hasAccess(type, userId)` n'a **aucun appelant** dans `app/`/`features/`/`components/` (uniquement
  appelé sans `userId` ou via POMs e2e). Le bypass-sur-cible est donc un **footgun latent**, pas une
  IDOR exploitable aujourd'hui.

C'est l'état « partiellement corrigé » du H3 de la revue 2026-06-19 : les **appelants** ont été
gardés, mais le **contrat dans le DAL** (« `userId` ⇒ admin ») n'est toujours pas appliqué au point
de définition.

### Impact

Aucun chemin exploitable aujourd'hui. Risque = un futur appelant (Server Action, route handler)
qui passerait un `userId` client sans garde → fuite de statut d'accès / IDOR. Sévérité BASSE
(latent).

### Correctif suggéré

Mettre la garde **dans le DAL** : si `userId` est fourni et ≠ session courante, exiger
`requireRole(["admin"])`. Et pour `hasAccess`, le bypass admin doit porter sur l'**appelant**, pas
sur la cible.

---

## B2 — BASSE : tri par `role` — ordre divergent de Convex

**Fichier** : `features/users/dal.ts:206-212` (`sortBy === "role"` → `user.role`), réf. `convex/users.ts:836-839,849`

`ORDER BY user.role` trie selon l'**ordre de l'enum** Postgres (`["user", "admin"]`,
`enums.ts:35`) : asc ⇒ _user_ puis _admin_. Convex triait `a.role`/`b.role` comme **chaînes**
(`"admin" < "user"`) : asc ⇒ _admin_ puis _user_. Le sens du tri par rôle est donc **inversé**
vs l'ancien comportement. Purement cosmétique (regroupement d'affichage d'un champ binaire), non
couvert par les tests (qui ne testent que le tri par `name`). Correctif : `ORDER BY user.role::text`
si la parité exacte est souhaitée.

---

## B3 — BASSE : `amountPaid = 0` accepté côté serveur

**Fichier** : `features/payments/schemas.ts:8,18` (`z.number().int().nonnegative()`)

Le serveur accepte `0`, le client (`parseAmountToCents`, `manual-payment-modal.tsx:129` /
`edit-transaction-modal.tsx:87`) rejette `num <= 0`. Incohérence mineure : un appel direct de
l'action peut enregistrer un paiement « complété » à 0 et accorder l'accès. (Reste plus strict
que Convex, qui n'avait **aucune** validation — `v.number()` acceptait négatif/décimal.) Si les
comps gratuites ne sont pas voulues, utiliser `.positive()`. Sinon, documenter comme intentionnel.

---

## I1 — INFO : remboursement d'un combo ne révoque qu'un type (préservé, mais asymétrique)

**Fichier** : `features/payments/actions.ts:191-197`

Au remboursement (`completed → refunded`), `revokeAccessIfLast` ne traite que
`transaction.accessType` (un seul type) ; pour un combo, l'autre type reste actif. **Identique à
Convex** (`convex/payments.ts:1094-1095` + `handleAccessRevocation`), donc conforme au mandat
« préserver la sémantique ». Pas une régression — mais à traiter de pair avec le correctif H1 si
l'on veut une révocation combo cohérente (sinon : remboursé côté exam, toujours actif côté training).
Pas de violation de FK ici (la tx n'est pas supprimée).

---

## Faux positifs écartés

- **FP-1 — `FOR UPDATE` ne sérialiserait pas (READ COMMITTED).** Faux : `db/index.ts` utilise
  `node-postgres` + `pg.Pool`, donc `db.transaction()` = vraie transaction sur connexion dédiée ;
  `SELECT … FOR UPDATE` sur la ligne `user` (`lib.ts:61-66`, `:137-141`) verrouille et sérialise
  réellement deux octrois concurrents du même user, et grant vs revoke (même ordre de lock : ligne
  `user` d'abord → pas de deadlock). Le cumul concurrent est correct. _(Le risque cité par la
  mission — un futur webhook Stripe écrivant `userAccess` sans verrouiller `user` — reste valable à
  documenter, mais ce chemin n'existe pas encore en Drizzle.)_

- **FP-2 — Curseur keyset en ms vs colonne µs (saut/dédoublement).** Mitigé : `transactions.createdAt`
  est déclaré `timestamp({ precision: 3 })` (`payments.ts:85`), aligné sur la précision ms de
  `Date`/`toISOString()`. `defaultNow()` est donc tronqué à la ms → `eq(createdAt, curseur)` matche.

- **FP-3 — Falsification du curseur.** `decodeCursor` (`dal.ts:179-192`) est robuste (try/catch,
  validation `NaN`/séparateur), et les valeurs décodées passent en **paramètres** Drizzle (pas
  d'injection). Falsifier le curseur ne change que la fenêtre de pagination, bornée par
  `userId = session` (`getMyTransactions`) ou la garde admin (`getAllTransactions`). Aucune fuite.

- **FP-4 — `escapeLike` incomplet.** Faux : `s.replace(/[\\%_]/g, "\\$&")` (`users/dal.ts:42`)
  échappe `\`, `%`, `_` avec `\`, qui est l'ESCAPE par défaut de `LIKE/ILIKE` Postgres. Correct.

- **FP-5 — `premium_access` rejeté par un enum à 4 valeurs.** Faux : `productCode`
  (`enums.ts:3-9`) liste bien les **5** codes, dont `premium_access`. Le schéma zod
  `z.enum(productCode.enumValues)` les couvre tous.

- **FP-6 — `completedAt` NULL faussant les stats.** Correct par construction : en SQL,
  `completedAt > $date` (`dal.ts:443,448` ; `users/dal.ts:341,345`) **exclut** les NULL, comme le
  `tx.completedAt && …` de Convex. Revenu `total` (sans filtre completedAt) inclut bien toutes les
  complétées, comme Convex.

- **FP-7 — Bornes de mois `Date.UTC` incohérentes.** Faux : `getUsersStats` (`users/dal.ts:292-297`)
  calcule `startOfMonth`/`startOfLastMonth` en UTC, cohérent avec `TZ=UTC` (tests) et le runtime
  Vercel (UTC). Plus déterministe que le `setHours(0,0,0,0)` local de Convex.

- **FP-8 — Divergence d'arrondi du trend revenus (Convex 1 décimale vs Drizzle brut).** Sans effet :
  l'UI affiche `Math.abs(trend.value).toFixed(0)%` (`users-stats-row.tsx:147`) → arrondi entier de
  toute façon.

- **FP-9 — Frontières `>`/`>=` 30j/60j (double comptage).** Vérifié : `recent` = `completedAt > ago30`,
  `previous` = `completedAt > ago60 AND <= ago30` (`users/dal.ts:341-345`) ; bornes disjointes,
  identiques à Convex (`convex/users.ts:616-624`).

- **FP-10 — Prédicat `accessStatus="expired"` mal formé.** Vérifié correct : les LEFT JOIN aliasés
  contraignent déjà `accessType`, donc `or(eq(exam.accessType,'exam'), eq(training.accessType,'training'))`
  = « a ≥ 1 ligne d'accès », combiné à « exam absent/expiré ET training absent/expiré »
  (`users/dal.ts:171-177`). Un user _exam-expiré + training-actif_ tombe bien en `active`, pas
  `expired`. Conforme à Convex (`:812-818`) et couvert par les tests.

- **FP-11 — Fuite d'info dans les erreurs.** Les actions renvoient des messages génériques
  (« Erreur serveur. Réessayez. ») et ne logguent (`console.error`) qu'en non-prod
  (`actions.ts:150-153,223-226,279-282` ; `users/actions.ts:87-90`). Pas de `error.message` brut
  exposé au client. `requireRole` redirige (pas de 403 verbeux).

- **FP-12 — `_id` (champ-pont) mal mappé.** `adminTransactionToRow` (`transaction-table.tsx:73-91`)
  reporte fidèlement `tx.id` (Drizzle) → `_id`, et les modales rappellent les actions avec
  `transaction._id` (= id Drizzle). Cohérent ; renommage `5.6` annoncé. Les props `products`/`users`
  optionnelles de `ManualPaymentModal` sont **intentionnelles** (Option C) et toujours fournies par
  les appelants convertis (`transactions/page.tsx:13-18`, `users/[id]/page.tsx:54-59`,
  `users-manager.tsx`/`user-side-panel.tsx`).

- **FP-13 — Combo : `userAccess.expiresAt = max(existant, calc)` non atomique.** Lecture + upsert se
  font **sous le verrou `user`** (`lib.ts:106-123`), dans la même transaction → atomique. Cible de
  conflit `onConflictDoUpdate` = `[userId, accessType]`, adossée à la contrainte
  `unique("user_access_user_access_type_unique")` (`payments.ts:126`). Correct.

---

## Verdict global

**Empilable 5.3+ après UN correctif bloquant.**

- **Bloquant** : **H1** (suppression de transaction combo cassée par la FK `restrict`). C'est un
  chemin admin nominal qui échoue à 100 % sur les produits combo (`premium_access`), avec une erreur
  opaque. À corriger avant d'empiler des features qui s'appuient sur la gestion des transactions.
- **À planifier (non bloquant)** : **M1** (unicité `products.code` — migration + invariant) et
  **M2** (clamp serveur des `limit`/`offset` + zod sur les filtres admin), idéalement avant le
  portage de `upsertProduct`/`seedProducts` et du webhook Stripe.
- **Dette propre** : B1 (garde au point de définition du DAL), B2/B3 (cosmétique/cohérence).

Le cœur « argent/accès » (cumul non-combo, combo max-preserve, révocation conditionnelle, keyset,
agrégats SQL, prédicats accessStatus) est **correct et bien testé** ; l'atomicité/concurrence tient
grâce au bon driver et au verrou `user`. Le point faible n'est pas le calcul mais la **suppression
combo** (interaction FK ⇄ révocation mono-type) — angle mort des tests qui exercent `grant`/`revoke`
isolément, jamais le chemin `revoke → delete` complet.
