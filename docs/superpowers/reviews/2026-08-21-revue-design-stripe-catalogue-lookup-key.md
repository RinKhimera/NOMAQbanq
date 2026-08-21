# Revue adversariale de conception — Catalogue Stripe par `lookup_key`

## 1. En-tête

**Date :** 2026-08-21
**Nature :** revue **hostile de conception**, avant toute ligne de code. Cible = un spec + un plan écrits, pas un diff.

**Périmètre relu**

| Document | Chemin |
| --- | --- |
| Spec | `docs/superpowers/specs/2026-08-21-stripe-catalogue-lookup-key-design.md` (commit `87eeb8f`) |
| Plan | `docs/superpowers/plans/2026-08-21-stripe-catalogue-lookup-key.md` (commit `1ada0c5`, 1430 lignes) |
| Issue amont | RinKhimera/NOMAQbanq#138 |

**Fichiers réels confrontés au plan** (état de l'arbre au 2026-08-21) :
`db/schema/payments.ts` · `drizzle/meta/_journal.json` · `features/payments/actions.ts` ·
`features/payments/stripe.ts` · `features/payments/dal.ts` · `features/users/dal.ts` ·
`features/users/cron.ts` · `app/api/stripe/webhook/route.ts` ·
`app/api/cron/close-expired/route.ts` · `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx` ·
`lib/format.ts` · `lib/stripe.ts` · `lib/stripe-api-version.ts` · `lib/env/schema.ts` · `lib/env/server.ts` ·
`scripts/audit-stripe-transactions.ts` · `tests/features/payments-actions.test.ts` ·
`tests/features/cron-close-expired.test.ts` · `tests/features/users-dal.test.ts` ·
`tests/lib/format.test.ts` · `tests/components/payments/PricingGrid.test.tsx` ·
`tests/integration/payments-checkout.test.ts` · `tests/integration/payments-stripe.test.ts` ·
`vercel.json` · `.github/workflows/cron-hourly.yml` · `vitest.config.ts` · `eslint.config.mjs` ·
`node_modules/stripe/esm/resources/Prices.d.ts` · `node_modules/stripe/esm/resources/Checkout/Sessions.d.ts` ·
`node_modules/stripe/esm/stripe.core.js` · `.claude/rules/payments.md` · `.claude/rules/data-layer.md` · `AGENTS.md`

**Méthode :** lecture seule. Chaque constat est prouvé par une lecture `fichier:ligne` ou une commande rejouable,
et a d'abord subi une tentative sincère de réfutation ; ceux qui n'y ont pas survécu sont consignés en §4.

**État de la vérification (base avant implémentation)**

| Commande | Code de sortie |
| --- | --- |
| `bun run check` (prettier + tsc + eslint) | **0** ✅ |
| `bun run test` (suite frontend — hors mandat strict, mais utile au diagnostic) | **0** ✅ — 114 fichiers, 1300 tests |

> ⚠️ Nuance de base : `bun run check` a tourné sur l'arbre de travail courant
> (`chore/aligner-types-react-overrides` = `origin/main` + 1 commit). La branche
> `feat/stripe-catalogue-lookup-key` est **4 commits derrière `origin/main`**
> (`git log --oneline feat/stripe-catalogue-lookup-key..origin/main` → #145, #142, #147, #146 :
> bumps de dépendances + `tests/helpers/mocks.ts` + `package.json`/`bun.lock`).
> `git diff --stat HEAD feat/stripe-catalogue-lookup-key` confirme qu'**aucun fichier du périmètre du plan
> ne diffère** entre les deux arbres : tous les constats ci-dessous valent sur les deux. Rebaser avant
> d'implémenter reste préférable (le `tsc` de la branche feat tourne sur un Next/React plus ancien).

---

## 2. Tableau des constats

| # | Sév | fichier:ligne | Problème | Régression ? |
| --- | --- | --- | --- | --- |
| F1 | 🔴 | `features/payments/actions.ts:408` | Le plan retire `stripePriceId` du `select` (Task 3) mais ne touche pas le `detail:` du bloc `resource_missing`, qui le lit encore → `tsc` casse. Édition incomplète. | NON (build) |
| F2 | 🔴 | plan §« Prérequis » + Task 1 Step 3 | Le backfill `lookup_key = code` n'est vérifié **nulle part contre le Stripe LIVE** avant migration. Le plan troque un pointeur connu-bon (`stripe_price_id`, en service en prod) contre un pointeur non vérifié, **sans repli**, en un seul déploiement. | OUI (potentielle : 5/5 produits) |
| F3 | 🟠 | `tests/features/cron-close-expired.test.ts:91-97` | `toEqual` **exact** sur `res.json()` sans `priceDrift`. La Task 4 ajoute la clé au `Response.json` → ce test casse ; le plan ne le mentionne pas et annonce « PASS » au Step 7. | NON (test) |
| F4 | 🟠 | spec §Fulfillment + `app/api/stripe/webhook/route.ts:83` | « Le hash n'est présent que si le client a payé en devise locale » est une **hypothèse non vérifiée**. Si Stripe peuple `presentment_details` sur toute session, le panneau admin affiche une ligne redondante aux clients CAD **et** la métrique-phare du spec devient fausse. | NON (colonnes neuves) |
| F5 | 🟠 | `app/api/cron/close-expired/route.ts:50-64` + `.github/workflows/cron-hourly.yml:56-62` + `lib/stripe.ts:14-16` | Une panne/429 Stripe fait échouer la tâche d'audit → `failed = true` → 500 → `curl --retry 3 --retry-all-errors` rejoue **tout le cron** jusqu'à 4×/h. Et l'appel n'a ni `timeout` (défaut **80 000 ms**) ni `maxNetworkRetries: 0` (défaut **2**) → jusqu'à ~240 s pour un `prices.list`, contre `--max-time 60`. | OUI (comportement du cron entier) |
| F6 | 🟠 | plan Task 2 Step 3 (JSDoc de `resolveStripePrice`) | Le JSDoc affirme que `limit: 2` « laisse voir une éventuelle anomalie plutôt que de la masquer ». Aucun code ne lit `data.length`. Commentaire faux — précisément la classe de bug que la Task 7 existe pour corriger. | NON |
| F7 | 🟡 | plan Task 3 Step 4 vs `features/payments/actions.ts:23-30` | « ajouter l'import (bloc `@/` de l'ordre Prettier) » : `./catalog` est un import **relatif** (groupe 3, avant `./dal`). Placé dans le bloc `@/`, `prettier --check` échoue. | NON |
| F8 | 🟡 | plan Task 6 Step 1 / `tests/lib/format.test.ts` | `expect(out).toContain("2 280 000")` **échoue tel quel** : `Intl` produit des U+00A0. Le plan annonce « Expected: PASS » au Step 4. | NON (test) |
| F9 | 🟡 | `app/(admin)/…/user-side-panel.tsx:166-173` | Le plan dit « lignes 166-172 » : l'accolade fermante est en **173**. Et **aucun test ne rend `TransactionItem`** → la garde d'affichage `presentmentCurrency !== null` n'a pas de paire jumelle, contre la consigne du spec. | NON |
| F10 | ℹ️ | plan §« Portée collatérale », Tasks 5 et 7 | Chiffres et ancres approximatifs : « ~20 fichiers de tests » = **17** (16 `.ts`, 21 lignes) ; `scripts/audit-stripe-transactions.ts` « trois premières lignes » = **1-5** ; `features/payments/stripe.ts:140-155` (UPDATE) = **148-157**. | NON |
| F11 | ℹ️ | spec §« Affichage admin » + plan Task 6 | « Code ISO inconnu d'`Intl` (qui lève `RangeError`) » : `Intl` ne lève que sur un code **mal formé**. `"XYZ"` ne lève pas et est divisé par 100. Le test choisit `"zz"` (2 lettres) — il ne couvre pas le cas réaliste. | NON |
| F12 | ℹ️ | `AGENTS.md` (structure `features/<domaine>/…`) | `catalog.ts` est un type de module absent de la structure documentée ; la Task 7 met à jour `AGENTS.md` mais pas cette ligne. | NON |

---

## 3. Détail par constat

### F1 🔴 — L'édition de la Task 3 ne compile pas : `product.stripePriceId` survit au retrait du `select`

**Code**
- `features/payments/actions.ts:341` — `stripePriceId: products.stripePriceId,` (le champ que la Task 3 remplace par `stripePriceLookupKey`).
- `features/payments/actions.ts:363` — `line_items: [{ price: product.stripePriceId, quantity: 1 }]` (remplacé par le plan ✅).
- `features/payments/actions.ts:399-404` — le commentaire que le plan réécrit ✅.
- **`features/payments/actions.ts:408`** — ``detail: `price ${product.stripePriceId} absent du mode de la clé active (produit ${productCode})` `` — **jamais mentionné par le plan**.

**Pourquoi c'est un vrai défaut.** Le plan prescrit trois éditions exactes dans ce `try`/`catch` (le champ du `select`, la ligne `line_items`, le commentaire 399-404) et une quatrième ligne lit encore `product.stripePriceId`. Comme le `select` typé Drizzle détermine la forme de `product`, retirer le champ rend la propriété inexistante : `bunx tsc --noEmit` échoue (`TS2339`). L'agent qui suit le plan à la lettre découvre le problème au Step 5 (« Expected: PASS ») et improvise — exactement ce que le format « chaînes exactes » est censé éviter.

**Régression ?** NON — arrêt au build, aucun risque runtime.

**Comment je l'ai prouvé.**
```
grep -n "stripePriceId" features/payments/actions.ts
# 341:      stripePriceId: products.stripePriceId,
# 363:      line_items: [{ price: product.stripePriceId, quantity: 1 }],
# 408:        detail: `price ${product.stripePriceId} absent du mode de la clé active (produit ${productCode})`,
```
Le plan (Task 3 Step 4) ne cite que 341, 363 et le commentaire 399-404.

**Correctif suggéré.** Ajouter explicitement au Step 4 :
```ts
        detail: `lookup_key ${product.stripePriceLookupKey} : objet Stripe absent à la création (produit ${productCode})`,
```

---

### F2 🔴 — Le backfill repose sur une affirmation invérifiée, sans repli et sans étape bloquante

**Code**
- Plan, Task 1 Step 3 : `UPDATE "products" SET "stripe_price_lookup_key" = "code"::text;`
- Plan, §« Prérequis avant de commencer » : le **seul** prérequis listé est la permission `prices:read`.
- Plan, §« Déploiement » point 1 : « **C'est le seul point qui casse tout le checkout s'il est manqué.** » — affirmation fausse : la présence des 5 `lookup_key` en mode live est un second point, de gravité identique.
- Chemin d'échec : `features/payments/actions.ts:405-411` (message « Ce produit est mal configuré. Contactez le support. »).

**Pourquoi c'est un vrai défaut.** Aujourd'hui le checkout facture `products.stripePriceId`, une valeur **empiriquement bonne en production** (les paiements passent). Le plan la remplace par une valeur **dérivée d'un commentaire GitHub du 2026-08-06**, jamais revérifiée, et la nouvelle résolution n'a **aucun repli** : `resolveStripePrice` renvoie `null` → retour immédiat, aucune session, aucune transaction. Un seul `lookup_key` manquant ou mal orthographié en live = 0 vente sur ce produit jusqu'à intervention humaine. Le spec présente ce risque comme dissous (« les 5 `lookup_key` existent déjà des deux côtés »), ce qui transforme une hypothèse en postulat.

Deux aggravants concrets :
1. La migration tourne **au build Vercel, avant activation** (`vercel.json` → `build:vercel` → `migrate-deploy`) : au moment où le nouveau code sert du trafic, la bascule est déjà faite.
2. La vérification du plan (Task 1 Step 6) ne contrôle que la base (`lk == code`), **jamais Stripe**. Elle ne peut structurellement pas détecter le cas qui coûte de l'argent.

**Régression ?** OUI (potentielle) — sur le chemin de revenu, pour les 5 produits à la fois.

**Comment je l'ai prouvé.** Lecture du plan (Prérequis, Task 1 Steps 3 et 6, §Déploiement) et de `features/payments/actions.ts:335-415` : le seul consommateur de `stripePriceLookupKey` est `resolveStripePrice`, et son `null` mène directement au `return { error: … }` sans autre branche. `cat vercel.json` confirme l'ordre migration → activation. Aucune écriture ni lecture Stripe n'a été faite pour cette revue (cf. §7).

**Correctif suggéré** (l'un ou l'autre suffit, les deux valent mieux) :
1. **Étape bloquante en lecture seule, avant la migration**, ajoutée aux Prérequis :
   ```
   stripe --api-key <clé TEST> prices list --active \
     --lookup-keys exam_access --lookup-keys training_access \
     --lookup-keys exam_access_promo --lookup-keys training_access_promo \
     --lookup-keys premium_access
   # puis la même chose avec la clé LIVE.
   # Attendu des deux côtés : 5 prix, un par clé, en `cad`, `unit_amount` == products.price_cad.
   ```
   Refuser de dérouler la Task 1 tant que les deux modes ne rendent pas 5/5.
2. **Repli pendant la phase 1** (la colonne `stripe_price_id` existe encore, `NOT NULL` — c'est tout l'intérêt de l'expand/contract) :
   ```ts
   const price = await resolveStripePrice(stripe, product.stripePriceLookupKey)
   const priceId = price?.id ?? product.stripePriceId   // filet de la phase 1
   if (!price) captureServerError(/* lookup_key introuvable, repli sur le price ID */)
   ```
   Le PR de suivi (`DROP COLUMN`) retire le repli en même temps que la colonne, **après** la vérification en production que le plan prévoit déjà. Coût : trois lignes. Bénéfice : l'échec devient une alerte Sentry au lieu d'une rupture de vente.

---

### F3 🟠 — La Task 4 casse un test existant que le plan déclare vert

**Code**
- `tests/features/cron-close-expired.test.ts:91-97` :
  ```ts
  await expect(res.json()).resolves.toEqual({
    examParticipations: { closedCount: 2 },
    trainingSessions: { closedCount: 0 },
    anonymizedAccounts: { anonymizedCount: 0 },
    notifications: { examResultsSent: 3, accessRemindersSent: 1 },
    quizRateLimitCleanup: { deletedCount: 0 },
  })
  ```
- Plan, Task 4 Step 5 : ajoute `priceDrift` au `Response.json` de `app/api/cron/close-expired/route.ts:117-123`.
- Plan, Task 4 Step 6 : n'ajoute qu'un mock et un test d'isolation. Step 7 : « Expected: PASS sur les deux fichiers ».

**Pourquoi c'est un vrai défaut.** `toEqual` sur un objet est une égalité **exacte** : une clé supplémentaire fait échouer. La Task 4 se termine donc en rouge, et un agent en mode « fais passer les tests » peut être tenté de retirer la clé du `Response.json` (perte du compte-rendu) plutôt que d'étendre l'assertion.

**Régression ?** NON — défaut de couverture du plan, pas du produit.

**Comment je l'ai prouvé.** Lecture directe de `tests/features/cron-close-expired.test.ts:79-98`, croisée avec `app/api/cron/close-expired/route.ts:117-123`.

**Correctif suggéré.** Ajouter au Step 6 : « étendre l'assertion du test *bearer valide → 200 et compte-rendu de chaque tache* avec `priceDrift: { checked: 0, drifted: 0 }` ».

> Contre-vérification faite : le test `chaque tache est capturee sous son propre tag` (lignes 135-150), lui aussi un `toEqual` **ordonné**, ne casse **pas** — la tâche mockée résout, donc n'ajoute aucun tag. Voir §4.

---

### F4 🟠 — « `presentment_details` n'est présent qu'en devise locale » : hypothèse non vérifiée qui porte la métrique du spec

**Code**
- `node_modules/stripe/esm/resources/Checkout/Sessions.d.ts:249` — `presentment_details?: Session.PresentmentDetails;` : **optionnel**, sans un mot sur les conditions de présence.
- `node_modules/stripe/esm/resources/Checkout/Sessions.d.ts:624-633` — `presentment_amount: number` / `presentment_currency: string`, tous deux non nullables quand le hash existe.
- Spec, §Fulfillment : « Le hash n'est présent **que si** le client a payé en devise locale (doc Adaptive Pricing) […] le taux de lignes non nulles *est* la proportion de clients passés par la conversion. »
- Plan, Task 5 Step 3 : persiste dès que `presentmentAmount != null && presentmentCurrency`.
- Plan, Task 6 Step 6 : affiche dès que les deux champs sont non nuls.

**Pourquoi c'est un vrai défaut.** Le SDK installé, seule source d'autorité disponible en lecture seule ici, **ne confirme pas** la condition. Stripe peuple `presentment_details` sur `Charge`, `PaymentIntent`, `Refund` et `Subscription` (mêmes `.d.ts`) — un ensemble d'objets qui suggère un champ descriptif général plutôt qu'un marqueur de conversion. Si le hash arrive aussi pour un client canadien (`presentment_currency: "cad"`, `presentment_amount === amount_total`), alors :
- le panneau admin affiche `+50,00 $ CA` **puis** `présenté : 50,00 $` — du bruit sur 100 % des lignes, alors que la ligne est censée être l'exception ;
- la mesure annoncée (« taux de lignes non nulles = proportion de conversions ») vaut 100 % quoi qu'il arrive, c'est-à-dire rien.

Le coût du doute est asymétrique : se tromper côté « toujours présent » pollue durablement la base et le panneau ; la garde coûte une comparaison.

**Régression ?** NON — les deux colonnes sont neuves, `amountPaid`/`currency` ne bougent pas (invariant respecté : le bloc `reconcile` de `features/payments/stripe.ts:119-146` n'est modifié par aucune tâche).

**Comment je l'ai prouvé.**
```
grep -n "presentment" node_modules/stripe/esm/resources/Checkout/Sessions.d.ts
grep -rn "presentment_details" node_modules/stripe/esm/resources/*.d.ts node_modules/stripe/esm/resources/**/*.d.ts
grep -n -i "presentment" node_modules/stripe/CHANGELOG.md   # une seule ligne, purement descriptive
```
Aucune de ces sources ne conditionne la présence du hash à une conversion. Le compte Stripe n'a pas été interrogé (cf. §7).

**Correctif suggéré.** Ne persister (ou a minima n'afficher) que ce qui est réellement informatif :
```ts
const converted =
  params.presentmentCurrency &&
  params.presentmentCurrency.toLowerCase() !== (params.currency ?? "").toLowerCase()
```
et marquer explicitement l'hypothèse dans le spec, à confirmer au Step 4 de la Task 8 — ce test manuel est justement l'occasion de vérifier, dans le même passage, ce que reçoit un client **canadien**.

---

### F5 🟠 — La tâche cron peut faire échouer tout le cron, et son appel Stripe n'est pas borné

**Code**
- `app/api/cron/close-expired/route.ts:50-64` — `run()` positionne `failed = true` sur exception.
- `app/api/cron/close-expired/route.ts:99` — `if (failed) return new Response("Cron handler error", { status: 500 })`.
- `.github/workflows/cron-hourly.yml:56-62` — `curl --fail-with-body … --retry 3 --retry-delay 10 --retry-all-errors --max-time 60`.
- `lib/stripe.ts:14-16` — `new Stripe(key, { apiVersion })` : ni `timeout` ni `maxNetworkRetries`.
- `node_modules/stripe/esm/stripe.core.js:96` — `const DEFAULT_TIMEOUT = 80000;`
- `node_modules/stripe/esm/stripe.core.js:168` — `maxNetworkRetries: validateInteger('maxNetworkRetries', props.maxNetworkRetries, 2)`.
- Patron de référence que le plan dit suivre : `features/users/cron.ts:25-45` — la tâche **avale ses propres erreurs** (`try`/`catch` par ligne) et ne remonte jamais d'exception.

**Pourquoi c'est un vrai défaut.** Trois conséquences enchaînées, toutes absentes du tableau « Coût — mesuré, pas supposé » du spec, qui ne chiffre que le chemin heureux :

1. **Amplification.** `--retry-all-errors --retry 3` rejoue sur un 500. Une indisponibilité Stripe fait donc tourner **4 fois par heure** l'intégralité du cron — clôtures, anonymisation RGPD, notifications comprises. Le spec annonce « ~25 requêtes/jour » ; sous panne c'est ~100, et surtout ~96 exécutions supplémentaires des quatre autres tâches.
2. **Durée.** Le SDK réessaie 2 fois par défaut, avec un timeout de 80 s par tentative : un `prices.list` peut occuper ~240 s. Le `--max-time 60` du workflow coupe bien avant — le job GitHub échoue pendant que la fonction continue de tourner.
3. **Inversion de gravité.** Une tâche **strictement informative et en lecture seule** (elle n'écrit ni en base ni chez Stripe, le plan le dit lui-même) devient capable de marquer tout le cron en échec. La tâche existante la plus proche, `anonymizeExpiredDeletedAccounts`, fait exactement l'inverse : elle isole ses erreurs en interne pour ne jamais bloquer la file.

Le plan **assume** ce choix : son test de la Task 4 Step 6 exige `expect(res.status).toBe(500)`. C'est là que je suis en désaccord : l'isolation par `run()` protège les tâches *suivantes*, pas le code de retour — et c'est le code de retour qui pilote le rejeu.

**Régression ?** OUI — le comportement du cron entier change sur un chemin d'erreur externe qui n'existait pas (aucune tâche actuelle n'appelle un tiers réseau).

**Comment je l'ai prouvé.** Lectures ci-dessus, plus :
```
grep -rn "maxNetworkRetries\|DEFAULT_TIMEOUT" node_modules/stripe/esm/stripe.core.js
grep -n "maxDuration" -r app next.config.ts vercel.json   # aucun résultat : pas de borne applicative
cat vercel.json                                            # cron quotidien "0 0 * * *", aucune clé `functions`
```

**Correctif suggéré.**
```ts
export async function auditProductPriceDrift(): Promise<PriceDriftResult> {
  try {
    // … corps actuel …
  } catch (error) {
    captureServerError("[cron:price-drift]", error, { detail: "audit interrompu" })
    return { checked: 0, drifted: 0 }   // un audit ne fait pas échouer le cron
  }
}
```
et borner l'appel : `stripe.prices.list({ … }, { timeout: 10_000, maxNetworkRetries: 0 })` (second argument `RequestOptions`, supporté par le SDK). Adapter le test de la Task 4 Step 6 : « échec de l'audit → **200**, les autres tâches ont tourné, une capture Sentry ».

---

### F6 🟠 — Le JSDoc de `resolveStripePrice` décrit un garde-fou qui n'existe pas

**Code** — plan, Task 2 Step 3 :
```
 * […] `limit: 2` laisse néanmoins voir une éventuelle anomalie plutôt que de la masquer.
```
suivi de :
```ts
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 2 })
  return data[0] ?? null
```

**Pourquoi c'est un vrai défaut.** `data.length` n'est lu nulle part, ni dans l'implémentation ni dans le test de la Task 2 Step 1. `limit: 2` ne fait donc **rien** de plus que `limit: 1`. Le commentaire affirme le contraire de ce que fait le code — exactement la classe de défaut que la **Task 7 existe pour corriger** dans trois autres fichiers. Le prochain lecteur croira l'anomalie surveillée.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture du bloc complet de la Task 2 Step 3 dans le plan ; aucune occurrence de `data.length` ni de `data[1]`.

**Correctif suggéré.** Rendre le commentaire vrai (trois lignes) — ce qui répond aussi à la question ouverte n°3 :
```ts
  if (data.length > 1) {
    captureServerError(
      "[resolveStripePrice]",
      new Error("plusieurs prix actifs pour une même lookup_key"),
      { detail: `lookup_key ${lookupKey} · ${data.map((p) => p.id).join(", ")}` },
    )
  }
```
Sinon : `limit: 1` et suppression de la phrase.

---

### F7 🟡 — L'import prescrit viole l'ordre Prettier du projet

**Code**
- Plan, Task 3 Step 4 : « ajouter l'import (**bloc `@/`** de l'ordre Prettier) : `import { describePriceDrift, resolveStripePrice } from "./catalog"` ».
- `features/payments/actions.ts:3-30` — ordre réel : npm (3-4), puis `@/` (5-11), puis **relatifs triés** (`./dal` 12-23, `./lib` 24, `./schemas` 25-30).
- `AGENTS.md` §Gotchas : « **Prettier** : Import order enforce: 1) node/npm 2) `@/` 3) relatifs ».

**Pourquoi c'est un vrai défaut.** `./catalog` appartient au groupe 3 et se trie **avant** `./dal`. Placé dans le bloc `@/` comme le plan le demande, `prettier --check .` échoue — donc `bun run check` (Task 7 Step 6, Task 8 Step 3) et la CI.

**Régression ?** NON.

**Comment je l'ai prouvé.** `sed -n '1,35p' features/payments/actions.ts` + la ligne Gotchas d'`AGENTS.md`.

**Correctif suggéré.** « Insérer `import { describePriceDrift, resolveStripePrice } from "./catalog"` **juste avant** le bloc `from "./dal"` ».

---

### F8 🟡 — Le test de `formatPresentmentAmount` échoue tel qu'écrit

**Code** — plan, Task 6 Step 1 :
```ts
  it("devise zéro-décimal : l'unité mineure EST l'unité", () => {
    const out = formatPresentmentAmount(2280000, "xaf")
    expect(out).toContain("2 280 000")
```
puis Step 4 : « Run: `bun run test tests/lib/format.test.ts` — Expected: **PASS** ».

**Pourquoi c'est un vrai défaut.** `Intl.NumberFormat("fr-CA", { style: "currency", currency: "XAF" })` produit `"2 280 000 XAF"` avec des **U+00A0**, pas des espaces ASCII. L'assertion échoue. Le plan anticipe la gêne (« si `toContain` échoue, comparer via `out.replace(/\s/g, " ")` ») mais annonce quand même PASS — un agent voit un rouge inattendu au milieu d'un cycle TDD censé être déjà vert.

**Régression ?** NON.

**Comment je l'ai prouvé** (rejouable) :
```
node -e 'const f=(m,c)=>{const code=c.toUpperCase();const fm=new Intl.NumberFormat("fr-CA",{style:"currency",currency:code});const d=fm.resolvedOptions().maximumFractionDigits??2;return fm.format(m/10**d)};
const o=f(2280000,"xaf");console.log(JSON.stringify(o),[...o].map(c=>c.charCodeAt(0).toString(16)).join(" "),o.includes("2 280 000"))'
# "2 280 000 XAF"  32 a0 32 38 30 a0 30 30 30 a0 58 41 46  false
```
La logique de division, elle, est correcte : `xaf` → 0 décimale, `cad` → 2, `kwd` → 3 (vérifiés dans le même script). Le repli `\s` proposé par le plan fonctionne bien : ` ` **est** couvert par `\s` en JS.

**Correctif suggéré.** Écrire l'assertion normalisée d'emblée :
```ts
const norm = (s: string) => s.replace(/\s/g, " ")   // \s couvre U+00A0 et U+202F
expect(norm(formatPresentmentAmount(2280000, "xaf"))).toContain("2 280 000")
```

---

### F9 🟡 — Ancre à une ligne près, et la garde d'affichage n'a pas de paire jumelle

**Code**
- `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx:166-173` — le `formatCurrency` local que le plan dit supprimer « (lignes 166-172) » ; l'accolade fermante `}` est en **173**. Un retrait par plage littérale laisse une accolade orpheline.
- Même fichier, ligne 39 : `import { formatExpiration, formatMediumDate } from "@/lib/format"` ✅ conforme au plan ; bloc du montant en **216-218** ✅ (« ligne ~216 »).
- `grep -rn "user-side-panel" tests/` → **vide** : aucun test ne rend ce composant.

**Pourquoi c'est un vrai défaut.** Le spec impose : « Écrire les tests **par paires jumelles** : un cas où la garde doit passer, un cas où elle doit mordre. » La nouvelle garde `presentmentCurrency !== null && presentmentAmount !== null` est précisément une garde, et la section Tests du spec ne la couvre pas — elle ne teste que `formatPresentmentAmount`, en aval. Rien ne prouve que la ligne « présenté : … » disparaît pour un client canadien (ce qui est aussi le symptôme de F4).

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture de `user-side-panel.tsx:150-221` (numérotation vérifiée) ; `grep -rn "user-side-panel\|recentTransactions" tests/`.

**Correctif suggéré.** Corriger l'ancre en `166-173`, et ajouter à la Task 6 un test de rendu de `TransactionItem` (deux cas : `presentmentCurrency` renseignée → la ligne apparaît ; nulle → elle n'apparaît pas). Le fichier n'entre pas dans l'`include` de couverture (`vitest.config.ts:39-45` ne couvre que `lib/**`, `hooks/**`, `components/**`, `schemas/**`, `email/**`), donc le seuil de 80 % ne le réclamera jamais : c'est bien un choix explicite à poser.

---

### F10 ℹ️ — Chiffres et ancres à corriger

- « **~20 fichiers de tests** insèrent `stripePriceId` » : **17** fichiers, dont 1 en `.tsx` exclu du `sed` → **16 fichiers, 21 lignes** réellement touchées.
  Preuve : `grep -rn "stripePriceId" tests/` → 22 lignes dont 1 `.tsx` ; `grep -rl "stripePriceId" tests/ | wc -l` → 17.
- `scripts/audit-stripe-transactions.ts` — « remplacer les **trois premières lignes** du bloc » : le paragraphe visé s'étend sur les lignes **1-5**.
- `features/payments/stripe.ts:140-155` (annoncé pour le `set` de l'`UPDATE`) : le `.set({…})` réel est en **148-157**.
- Ancres **vérifiées exactes**, en revanche : `db/schema/payments.ts:35` ✅ · `features/payments/actions.ts:341` ✅ · `features/payments/actions.ts:399-404` ✅ · `features/payments/stripe.ts:52-70` (signature) ✅ · `features/payments/stripe.ts:46-50` (dernier paragraphe du JSDoc) ✅ · `app/api/stripe/webhook/route.ts:70-80` ✅ · `features/users/dal.ts:586-595` et `637-680` ✅ · `features/payments/dal.ts:107-140` ✅ · `tests/components/payments/PricingGrid.test.tsx:53-54` ✅ · `lib/format.ts:32-55` ✅ · `tests/integration/payments-stripe.test.ts:32-45` (`length: 11` + 11 noms) ✅ · `tests/integration/payments-stripe.test.ts:60-74` (`txStatus`) ✅ · `.claude/rules/payments.md:59-65` ✅ · numérotation `drizzle/0013_*` ✅ (le journal s'arrête à `0012_lowly_paper_doll`).
- La branche `feat/stripe-catalogue-lookup-key` est 4 commits derrière `origin/main` : à rebaser avant de commencer.

---

### F11 ℹ️ — « `Intl` lève sur un code inconnu » : vrai seulement pour un code mal formé

`new Intl.NumberFormat("fr-CA", { style: "currency", currency: "XYZ" })` ne lève **pas** : le `RangeError` ne survient que si le code n'est pas trois lettres ASCII. Prouvé par le même script que F8 : `"zz"` → `"1234 ZZ"` (repli) mais `"xyz"` → `"12,34 XYZ"` (divisé par 100 par défaut). Le test choisi (`"zz"`) valide donc le repli, pas le cas « code ISO inconnu ». Conséquence pratique nulle — `presentment_currency` vient de Stripe et sera toujours un code ISO réel — mais la phrase du spec est à rectifier pour ne pas induire le prochain lecteur.

---

### F12 ℹ️ — `catalog.ts` absent de la structure documentée

`AGENTS.md` décrit `features/<domaine>/{schemas,dal,actions,lib,cron}.ts`. La Task 7 met `AGENTS.md` à jour (puce « Stripe en dev ») mais laisse la ligne de structure. Ajouter `catalog` à l'énumération, ou justifier le module dans `.claude/rules/payments.md`. La justification du plan (« ni base ni session, testable sans mock Drizzle ») est bonne — elle mérite de survivre au merge.

---

## 4. Faux positifs écartés

| Soupçon | Verdict | Preuve |
| --- | --- | --- |
| Le `sed` de la Task 1 raterait des inserts multi-lignes ou différemment formatés | **Écarté** | Dry-run **sans `-i`** sur les 16 fichiers `.ts` : 21 insertions, soit exactement les 21 occurrences recensées par `grep -rn "stripePriceId" tests/`. Toutes sont mono-ligne et finissent par `,`. `find tests -name '*.ts'` ne matche pas `.tsx` — l'exclusion volontaire de `PricingGrid.test.tsx` annoncée par le plan est exacte. |
| `restoreMocks: true` (`vitest.config.ts:33`) effacerait les implémentations posées dans `vi.hoisted`, cassant les mocks `prices.list` du plan | **Écarté** | Vitest **4.1.10** : `mockReset` restaure l'implémentation passée à `vi.fn(impl)`. Preuve empirique : `vi.mock("@/lib/auth-guards", () => ({ requireSession: vi.fn(async () => …) }))` (`tests/integration/payments-checkout.test.ts:24-29`) n'est jamais reposé et la suite est verte. |
| Le retrait de `stripePriceId`/`stripeProductId` de `ProductView` casserait un composant ou un test | **Écarté** | `grep -rn "\.stripePriceId\|\.stripeProductId" app components features scripts lib` → seulement `features/payments/dal.ts:136-137` et `features/payments/actions.ts`. Aucun test n'annote un littéral en `ProductView` (`grep -rln "ProductView" tests/` → vide) : `tests/components/payments/PricingGrid.test.tsx:43-55` passe une **variable**, ce qui désactive le contrôle de propriétés excédentaires de TS. |
| Passer au `formatCurrency` partagé changerait l'affichage XAF du panneau admin | **Écarté** | Comparaison des deux implémentations en Node : `"22 800 XAF"` des deux côtés, `"50 $"` / `"123,45 $"` identiques en CAD. Seul le codepoint de l'espace insécable diffère (`fr-CA` vs `fr-FR`), invisible à l'écran. |
| Les tests de `getUserPanelData` construiraient un `PanelTransaction` littéral et casseraient sur les deux nouveaux champs | **Écarté** | `tests/features/users-dal.test.ts:186-204` lit `panel?.recentTransactions[0]?.product` uniquement ; `tests/integration/users-admin-dal.test.ts:298-309` idem. Aucun `toEqual` sur l'objet complet. La claim du plan (Task 6 Step 7) est exacte. |
| Un second appel à `completeStripeTransaction` (paiement différé) oublierait `presentment_*` | **Écarté** | `app/api/stripe/webhook/route.ts:67-83` : `checkout.session.completed` et `checkout.session.async_payment_succeeded` **partagent** le même `case` et le même appel. L'invariant de `.claude/rules/payments.md` (« `async_payment_succeeded` DOIT rester branché sur le même chemin d'octroi ») est préservé. |
| Le test `chaque tache est capturee sous son propre tag` (`toEqual` ordonné) casserait avec la nouvelle tâche | **Écarté** | `tests/features/cron-close-expired.test.ts:135-150` ne rejette que 4 tâches ; l'audit mocké résout et n'ajoute aucun tag. |
| Un script de seed ou la route `app/api/e2e` insérerait des `products` et casserait sur la colonne `NOT NULL` | **Écarté** | `grep -rn "insert(products)" app features scripts lib e2e drizzle` → aucun résultat. `app/api/e2e/route.ts:258-260` fait un `select` seul. Seuls les tests insèrent. |
| `scripts/audit-stripe-transactions.ts` dépendrait de `stripe_price_id` | **Écarté** | `grep -n "stripePriceId" scripts/audit-stripe-transactions.ts` → vide. Il ne lit que `amountPaid`/`currency`/`stripeSessionId`. Seul son en-tête est à corriger. |
| Le `::text` de la migration serait décoratif (cast implicite enum→text) | **Écarté comme constat** | Le cast explicite est correct et sans coût ; la prudence du plan est justifiée. |
| « `lookup_keys` accepte 10 clés » serait un chiffre inventé | **Écarté** | `node_modules/stripe/esm/resources/Prices.d.ts:667` — « You can specify **up to 10** lookup_keys ». Le `LOOKUP_KEYS_PER_CALL = 10` du plan est exact, et le découpage est réellement nécessaire à terme. |
| Le mock `@/db/schema` du test cron (`products: { code: {}, … }`) ferait échouer `eq(products.isActive, true)` | **Écarté** | Le même motif existe déjà : `tests/features/payments-actions.test.ts:66-81` mocke `products: { id: {}, code: { enumValues } }` et `eq(products.code, …)` fonctionne. Suite verte. |
| Le nouvel appel Stripe dans le cron ouvrirait une connexion Neon supplémentaire | **Écarté** | La tâche ne fait qu'un `db.select(...).limit(50)` **hors** transaction, dans un dispatcher séquentiel (`app/api/cron/close-expired/route.ts:40-44`). L'invariant « jamais de `db` global dans une `db.transaction` » (`.claude/rules/data-layer.md`) n'est pas approché. |
| L'idempotence du fulfillment serait affaiblie par l'écriture des colonnes `presentment_*` | **Écarté** | Le plan les fusionne dans le `set` de l'`UPDATE` existant (`features/payments/stripe.ts:148-157`), lui-même sous `SELECT … FOR UPDATE` (75-79) et après les deux contrôles d'idempotence (82-94). Aucune écriture ni requête supplémentaire. |
| `amountPaid`/`currency` seraient touchés | **Écarté** | Le bloc `reconcile` (`features/payments/stripe.ts:119-146`) n'est modifié par aucune tâche ; le spread `...(presentment ?? {})` est ajouté **après** `...(reconcile ?? {})` et ne partage aucune clé. |
| Le retrait du `resource_missing` de `createStripeCheckout` casserait un test existant | **Écarté** | Aucun test unitaire ne couvre cette branche : `tests/features/payments-actions-errors.test.ts:46-50` ne teste `resource_missing` que pour `verifyStripeCheckout`. |

---

## 5. Réponses aux questions ouvertes

### Q1 — Le backfill invérifié : le plan prévoit-il assez de garde-fous ?

**Non, et c'est le point le plus grave du dossier.** Voir **F2**. En résumé :

- Le seul prérequis listé est `prices:read` ; le plan va jusqu'à écrire « c'est le **seul** point qui casse tout le checkout », ce qui est factuellement faux.
- La vérification prévue (Task 1 Step 6) ne regarde que Postgres. Elle ne peut structurellement pas détecter une clé absente du catalogue live.
- Il n'existe **aucun repli** : `resolveStripePrice` → `null` → `return { error }`, fin.

**Recommandation, dans cet ordre :**
1. **Étape bloquante, lecture seule, avant la Task 1** : lister les 5 `lookup_key` en modes test **et** live ; exiger 5/5 des deux côtés, en `cad`, avec `unit_amount` égal à `products.price_cad`. Deux minutes, et l'hypothèse devient un fait.
2. **Repli pendant la phase 1** (`price?.id ?? product.stripePriceId`), retiré par le PR `DROP COLUMN`. Le plan garde déjà la colonne pour l'expand/contract ; ne pas s'en servir comme filet est un gaspillage.
3. **Ordre de déploiement réversible écrit noir sur blanc** : le rollback fonctionne déjà (la colonne survit, l'ancien code la relit), mais il faut nommer le signal à surveiller (`[createStripeCheckout]` / « aucun prix actif pour cette lookup_key » dans Sentry) et le délai au-delà duquel on revient en arrière.

### Q2 — Alerter sans bloquer sur la dérive de prix : bon arbitrage ?

**Oui, je maintiens l'arbitrage du spec** — mais l'argumentaire est incomplet, et la nuance manquante coûte peu.

Pour, et c'est décisif : couper la vente d'un produit sur un écart de configuration transforme une erreur d'ops silencieuse en panne totale de revenu, avec un diagnostic plus long (« pourquoi personne n'achète ? ») qu'un écart facturé. Le repo a déjà tranché dans ce sens ailleurs : la réconciliation montant/devise « ne doit jamais faire échouer un paiement valide » (`.claude/rules/payments.md` ; `features/payments/stripe.ts:134-146`).

Contre, l'argument le plus fort — celui du litige — **ne tient pas dans le sens invoqué**. Un client qui voit 300 $ affichés et se voit facturer 350 $ ne paie pas : Stripe Checkout montre le montant **avant** confirmation. Le vrai dommage est plus modeste : abandon de panier, méfiance, un ticket au support. Dans l'autre sens (base 350 $, Stripe 300 $), l'entreprise perd 50 $ par vente sans que personne ne s'en aperçoive — mais bloquer ne « sauve » rien : ça remplace 300 $ encaissés par 0 $.

En revanche, deux durcissements bon marché manquent :
- **Un plafond de tolérance.** Une dérive de +900 % n'est plus une erreur de tarif, c'est un `lookup_key` pointant sur un autre produit. Au-delà d'un seuil (écart relatif > 50 %, par exemple), le message « produit mal configuré » est *plus* juste que la vente.
- **La devise devrait bloquer, pas seulement alerter.** `price.currency !== "cad"` signifie que le prix résolu n'appartient pas à l'intégration : le montant affiché en CAD et le montant facturé ne sont même plus comparables, et Adaptive Pricing se désactive sur cette devise (`.claude/rules/payments.md`). Vendre dans ce cas est un choix indéfendable a posteriori.

### Q3 — Stripe garantit-il l'unicité de `lookup_key` parmi les prix actifs ?

**Oui — le SDK installé le dit implicitement. Mais le code n'en tire pas la conséquence qu'il annonce.**

Preuves dans `node_modules/stripe/esm/resources/Prices.d.ts` :
- lignes 344 (create) et 579 (update) — `transfer_lookup_key` : « If set to true, will **atomically remove the lookup key from the existing price**, and assign it to this price. » Un transfert n'a de sens que si la clé ne peut appartenir qu'à un prix à la fois.
- ligne 667 (list) — « Only return **the price** with these lookup_keys » (singulier).

Donc `data.length > 1` ne devrait pas survenir avec `active: true`. **Mais** :
1. C'est une garantie de service, pas une contrainte que l'app observe. Un `data[0]` silencieux sur une anomalie de facturation est exactement le genre de silence que ce PR combat par ailleurs.
2. Le JSDoc prescrit **prétend déjà** qu'on la surveille (**F6**). Il faut soit tenir la promesse, soit la retirer.

**Ma position : traiter `data.length > 1` comme une anomalie** — `captureServerError` puis continuer avec `data[0]` (ne pas bloquer, cohérent avec Q2). Trois lignes, et le commentaire redevient vrai.

### Q4 — Supprimer `stripe_price_id` fait-il perdre la trace du prix facturé ?

**Non — et la prémisse est fausse dès aujourd'hui.**

1. **Aucune colonne n'a jamais enregistré le prix d'une transaction donnée.** `transactions` (`db/schema/payments.ts:53-100`) ne porte aucun champ de prix Stripe. `products.stripePriceId` est un pointeur **par produit**, mutable : si le tarif change, une ancienne transaction pointe rétroactivement sur le nouveau prix. La « trace » invoquée n'existe pas — elle est même trompeuse.
2. **Le chemin de récupération existe et est stable.** `transactions.stripe_session_id` (`db/schema/payments.ts:69`, indexé ligne 93) permet `stripe.checkout.sessions.listLineItems(sessionId)`, qui rend le `price.id` **réellement facturé** pour cette session — plus fiable que le pointeur produit.
3. **Aucun consommateur dans le dépôt.** `grep -n "stripePriceId" scripts/audit-stripe-transactions.ts` → vide ; le script ne lit que `amountPaid`/`currency`/`stripeSessionId`. Hors `db/schema`, `features/payments/dal.ts:136-137` et `features/payments/actions.ts:341/363/408`, plus rien ne le touche.

**Réserve :** aucune. L'index `products_stripe_product_id_idx` (`db/schema/payments.ts:48`) porte sur `stripe_product_id`, qui reste — le `DROP COLUMN` de suivi est propre.

### Q5 — Le silence du cron sans `STRIPE_SECRET_KEY` masque-t-il une misconfiguration de prod ?

**Non, et le choix est bon.** Trois raisons vérifiées :

1. `lib/env/schema.ts:43` — `STRIPE_SECRET_KEY: z.string().optional()`. L'app assume déjà de tourner sans Stripe ; faire échouer une tâche de fond sur ce motif contredirait le schéma d'env.
2. `lib/stripe.ts:9-13` — `getStripe()` **lève** si la clé manque. Sans la garde, la tâche jetterait à chaque exécution et, via **F5**, ferait échouer tout le cron en environnement sans Stripe (preview, CI). Le remède serait pire que le mal.
3. **Le symptôme réel est ailleurs, et il est assourdissant.** En production, une `STRIPE_SECRET_KEY` absente ne produit pas un cron silencieux : elle produit un **checkout entièrement cassé** (`getStripe()` lève dans `createStripeCheckout`, capturé en Sentry) et un webhook qui répond 500 (`app/api/stripe/webhook/route.ts:39-42`). Le `refine` de `lib/env/schema.ts:73-76` couple déjà les deux variables. Aucun masquage possible.

Détail à corriger tout de même : `checked: 0` est renvoyé dans **deux** cas distincts (« pas de clé » et « aucun produit actif »), ce qui rend le compte-rendu JSON ambigu. Un troisième état (`skipped: true`) le lèverait sans complexité.

### Q6 — Le nouvel aller-retour réseau dans un dispatcher séquentiel : risque de timeout ?

**Oui, et le spec ne l'a pas mesuré.** C'est **F5**. Les chiffres réels :

| Élément | Valeur mesurée | Source |
| --- | --- | --- |
| Timeout de requête du SDK Stripe | **80 000 ms** | `node_modules/stripe/esm/stripe.core.js:96` |
| Réessais réseau du SDK (défaut, non surchargé) | **2** | `node_modules/stripe/esm/stripe.core.js:168` ; `lib/stripe.ts:14-16` ne passe ni `timeout` ni `maxNetworkRetries` |
| Pire cas pour **un** `prices.list` | ~240 s | 3 tentatives × 80 s |
| Fenêtre du déclencheur horaire | **60 s** | `.github/workflows/cron-hourly.yml:60` (`--max-time 60`) |
| Rejeu sur erreur | **3 réessais, toutes erreurs** | `.github/workflows/cron-hourly.yml:58` |
| `maxDuration` applicatif | **aucun** | `grep -rn "maxDuration" app next.config.ts vercel.json` → vide |

En régime normal, la tâche ajoute ~200-500 ms : négligeable, le spec a raison sur ce point. Le problème est la **queue de distribution** : c'est le premier appel réseau tiers du cron, il n'est pas borné, et son échec est amplifié ×4 par le workflow. Correctif en F5 (borner l'appel + avaler l'erreur dans la tâche). À noter que le même raisonnement vaut, en plus modeste, sur le chemin utilisateur du checkout : `createStripeCheckout` passe de un à **deux** appels Stripe non bornés, donc de ~240 s à ~480 s de pire cas théorique. Fixer `timeout`/`maxNetworkRetries` sur la résolution du prix vaut aussi là-bas.

### Q7 — `presentment_currency` en texte libre, normalisé à l'écriture seulement : suffisant ?

**Suffisant pour l'affichage, insuffisant pour l'agrégation future.**

- **Affichage : aucun risque.** `formatPresentmentAmount` refait `currency.toUpperCase()` (plan, Task 6 Step 3) : la casse en base n'a aucun effet. Et `Intl` ne lève que sur un code mal formé (**F11**), pour lequel le repli existe.
- **Agrégation : le piège est réel.** La normalisation vit dans **une seule fonction applicative** (`completeStripeTransaction`). Rien au niveau du schéma n'empêche un `INSERT` manuel, un backfill, un futur import ou un second écrivain de poser `"xaf"`. Un `GROUP BY presentment_currency` rendrait alors deux lignes pour une même devise — la classe de bug la plus discrète qui soit.
- **Le choix du `text` plutôt que d'un enum reste le bon** : l'argument du spec (150+ devises possibles vs un enum à deux valeurs) est solide, et contraindre ferait perdre exactement la donnée recherchée.

**Correctif proposé** — une contrainte qui n'ôte aucune liberté et rend l'invariant indépendant du code appelant :
```sql
ALTER TABLE "transactions"
  ADD CONSTRAINT transactions_presentment_currency_iso
  CHECK ("presentment_currency" IS NULL OR "presentment_currency" ~ '^[A-Z]{3}$');
```
Elle documente le format, bloque la casse basse et les codes mal formés, et coûte une ligne dans la migration `0013`. À noter aussi : aucun index n'est prévu sur la colonne — correct au volume actuel, mais l'agrégation par devise sera un scan complet ; un choix à assumer plutôt qu'à découvrir.

---

## 6. Verdict

### Le plan est-il sûr et complet à implémenter tel quel ? — **NON**

La conception d'ensemble est bonne, et il faut le dire : la bascule vers `lookup_key` élimine réellement la classe « identifiant du mauvais mode » plutôt que de la détecter ; l'expand/contract est correctement raisonné face au `migrate-deploy` du build Vercel ; l'idempotence du fulfillment et l'invariant comptable `amountPaid`/`currency` sont préservés sans y toucher ; et **13 des 16 ancres de lignes citées sont exactes** dans l'arbre actuel. Le plan est nettement au-dessus de la moyenne sur la traçabilité.

Deux points bloquent néanmoins :

1. **F1** — l'édition de la Task 3 est incomplète : `features/payments/actions.ts:408` lit encore `product.stripePriceId` après le retrait du `select`. Le type-check casse au Step 5.
2. **F2** — le cœur du changement (le backfill `lookup_key = code`) repose sur une affirmation invérifiée, appliquée en production sans étape de vérification bloquante et **sans repli**, alors que la colonne qui servirait de filet est justement conservée par le design.

### Correctifs priorisés

#### À corriger **avant** de coder

| # | Correctif | Coût |
| --- | --- | --- |
| F2 | Ajouter aux Prérequis une **vérification bloquante en lecture seule** des 5 `lookup_key` en modes test **et** live (5/5, `cad`, `unit_amount` = `price_cad`). Ajouter le repli `price?.id ?? product.stripePriceId` pour la phase 1, retiré par le PR `DROP COLUMN`. Écrire la procédure de rollback et le signal Sentry à surveiller. | ~15 min de plan, 3 lignes de code |
| F1 | Ajouter au Step 4 de la Task 3 l'édition de la ligne 408 (`detail:` → `stripePriceLookupKey`). | 1 ligne |
| F3 | Ajouter au Step 6 de la Task 4 : étendre l'assertion `toEqual` de `tests/features/cron-close-expired.test.ts:91-97` avec `priceDrift`. | 1 ligne |
| F5 | Envelopper `auditProductPriceDrift` dans son propre `try`/`catch` (patron `features/users/cron.ts:27-45`) et borner l'appel (`{ timeout: 10_000, maxNetworkRetries: 0 }`). Adapter le test d'isolation : 200, pas 500. | ~8 lignes |
| F4 | Décider maintenant : persister/afficher `presentment_*` seulement si `presentment_currency ≠ currency` de session, **ou** marquer explicitement l'hypothèse dans le spec et la vérifier au Step 4 de la Task 8 avec un client **canadien**. | 2 lignes + une phrase de spec |
| F7 | Corriger l'instruction d'import : `./catalog` va dans le groupe relatif, avant `./dal`. | 1 mot |

#### À surveiller **pendant** l'implémentation

| # | Point de vigilance |
| --- | --- |
| F6 | Rendre vrai le JSDoc de `resolveStripePrice` (capturer `data.length > 1`) ou retirer la phrase. |
| F8 | Écrire l'assertion XAF déjà normalisée (`replace(/\s/g, " ")`) plutôt que de découvrir l'échec au Step 4. |
| F9 | Ancre `166-173` (pas 166-172) ; ajouter la paire jumelle de tests sur la garde d'affichage. |
| Q2 | Envisager un plafond de tolérance et un blocage sur devise ≠ `cad` (le reste alerte sans bloquer). |
| Q6 | Le checkout passe de un à deux appels Stripe non bornés : borner aussi la résolution du prix. |
| Q7 | Ajouter le `CHECK (presentment_currency ~ '^[A-Z]{3}$')` à la migration `0013`. |
| — | **Rebaser `feat/stripe-catalogue-lookup-key` sur `origin/main`** (4 commits de retard) avant de commencer. |

#### Cosmétique

| # | Point |
| --- | --- |
| F10 | Corriger les chiffres (« ~20 fichiers » → 17/16) et les ancres `scripts/audit-stripe-transactions.ts:1-5`, `features/payments/stripe.ts:148-157`. |
| F11 | Reformuler la phrase sur le `RangeError` d'`Intl` dans le spec. |
| F12 | Ajouter `catalog` à la ligne de structure d'`AGENTS.md`. |
| Q5 | Distinguer « Stripe non configuré » de « aucun produit actif » dans le retour de la tâche. |

---

## 7. Confirmations de sécurité opérationnelle

**Ce que j'ai touché**
- Lectures seules du dépôt (`cat`, `sed -n`, `grep`, `git show`, `git log`, `git diff --stat`, `git branch`) sur la branche courante et sur `feat/stripe-catalogue-lookup-key` via `git show`.
- `bun run check` → exit **0**. `bun run test` (suite frontend, happy-dom) → exit **0**, 114 fichiers / 1300 tests.
- Deux scripts `node -e` **purement locaux** (formatage `Intl`, comparaison des deux `formatCurrency`) — aucun accès réseau, aucune écriture disque.
- Un dry-run du `sed` de la Task 1 **sans `-i`** (sortie comptée par `grep -c`, jamais réinjectée dans les fichiers).
- Un seul fichier écrit : **ce rapport**, `docs/superpowers/reviews/2026-08-21-revue-design-stripe-catalogue-lookup-key.md`. **Non committé** — la session demandeuse décide de le garder ou non.

**Ce que je n'ai pas touché**
- **Aucune écriture** dans le dépôt hors ce rapport : ni code, ni spec, ni plan, ni `AGENTS.md`, ni `.claude/rules/**`.
- **Aucun changement de branche** (`git checkout`/`switch`), aucun `stash`, aucun commit, aucun push.
- **Base Neon intacte** : aucune connexion, aucune requête, aucune migration. `bun run db:migrate`, `bun run db:generate` et `bun run test:integration` (qui crée une branche Neon éphémère) n'ont **pas** été lancés.
- **Compte Stripe intact** : aucun appel API, en live comme en test, en lecture comme en écriture. Aucun objet créé. Les affirmations sur le SDK proviennent exclusivement des fichiers `.d.ts` / `.js` / `CHANGELOG.md` de `node_modules/stripe` installés dans le dépôt.
- **Aucun secret imprimé** : `.env.local` n'a jamais été lu ni affiché ; aucune variable portant une clé (`STRIPE_SECRET_KEY`, `CRON_SECRET`, `DATABASE_URL*`…) n'apparaît dans ce rapport autrement que par son nom.
- **Aucun serveur de développement lancé** (`bun dev` ni équivalent), aucun test E2E, aucune commande destructive ni de déploiement.
