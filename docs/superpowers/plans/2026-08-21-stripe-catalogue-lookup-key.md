# Catalogue Stripe par `lookup_key` — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre impossible la classe de bug « identifiant Stripe du mauvais mode », détecter automatiquement la dérive entre le prix affiché et le prix facturé, et persister le montant réellement présenté au client par Adaptive Pricing.

**Architecture:** Le checkout ne lit plus un `stripe_price_id` opaque en base : il résout le prix via `prices.list({ lookup_keys })`, une clé identique en test et en live. La comparaison `unit_amount` ↔ `products.priceCad` devient gratuite à cet endroit, et une tâche cron la rejoue sur les produits que personne n'achète. En parallèle, `checkoutSession.presentment_details` est persisté au fulfillment dans deux colonnes nullables et affiché au panneau admin.

**Tech Stack:** Next.js 16 (App Router) · Drizzle ORM · Neon Postgres · Stripe SDK 22.4.0 (API `2026-07-29.dahlia`) · Vitest · Sentry.

**Spec:** [`docs/superpowers/specs/2026-08-21-stripe-catalogue-lookup-key-design.md`](../specs/2026-08-21-stripe-catalogue-lookup-key-design.md) · Issue [#138](https://github.com/RinKhimera/NOMAQbanq/issues/138)

**Branche:** `feat/stripe-catalogue-lookup-key` (déjà créée, le spec y est commité).

---

## Prérequis avant de commencer

- [ ] **Vérifier la permission de la clé Stripe runtime.** `prices.list` exige la lecture sur Prices, ce que la création d'une session avec un price ID n'exigeait pas. Si `STRIPE_SECRET_KEY` (Vercel + `.env.local`) porte une clé restreinte `rk_`, ajouter `prices:read` **avant** de déployer, sinon tous les checkouts tombent en `permission_error`. Une clé `sk_` a la permission par défaut.

Cette vérification ne bloque pas l'écriture du code (les tests moquent Stripe), mais elle bloque le déploiement.

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
| --- | --- | --- |
| `db/schema/payments.ts` | Colonnes `stripe_price_lookup_key`, `presentment_amount`, `presentment_currency` | Modifier |
| `drizzle/0013_*.sql` | Migration : ajout + backfill + `SET NOT NULL` | Créer (généré puis édité) |
| `features/payments/catalog.ts` | Résolution d'un prix par `lookup_key` et description d'une dérive. Deux fonctions, aucune dépendance à la base | Créer |
| `features/payments/actions.ts` | `createStripeCheckout` résout le prix et signale la dérive | Modifier |
| `features/payments/cron.ts` | Tâche `auditProductPriceDrift` : dérive sur les produits actifs | Créer |
| `app/api/cron/close-expired/route.ts` | Branchement de la tâche dans le dispatcher | Modifier |
| `features/payments/stripe.ts` | `completeStripeTransaction` persiste `presentment_*` | Modifier |
| `app/api/stripe/webhook/route.ts` | Transmet `presentment_details` au fulfillment | Modifier |
| `lib/format.ts` | `formatPresentmentAmount` (unité mineure d'une devise arbitraire) | Modifier |
| `features/users/dal.ts` | `PanelTransaction` porte les deux champs | Modifier |
| `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx` | Affiche le montant présenté | Modifier |
| `features/payments/dal.ts` | `ProductView` perd `stripePriceId` / `stripeProductId` | Modifier |

`catalog.ts` est un module neuf plutôt qu'un ajout à `lib.ts` : ses deux fonctions ne touchent ni la base ni la session, elles ne parlent qu'à Stripe. Les garder isolées les rend testables sans monter le moindre mock de Drizzle, et `lib.ts` est déjà le module de l'octroi d'accès — une responsabilité sans rapport.

---

## Task 1 : Colonnes et migration

**Files:**
- Modify: `db/schema/payments.ts:35` (products), `db/schema/payments.ts:66-70` (transactions)
- Create: `drizzle/0013_<nom-généré>.sql`
- Modify: tous les inserts `products` des tests (~20 fichiers)

- [ ] **Step 1 : Ajouter les trois colonnes au schéma**

Dans `db/schema/payments.ts`, table `products`, juste après `stripeProductId` :

```ts
    stripeProductId: text("stripe_product_id").notNull(),
    stripePriceLookupKey: text("stripe_price_lookup_key").notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
```

`stripePriceId` reste : sa suppression est un PR de suivi (expand/contract — voir la section Déploiement en fin de plan).

Dans la même table `transactions`, juste après `currency` :

```ts
    currency: currency("currency").notNull(),
    // Montant réellement présenté au client par Adaptive Pricing, dans SA devise.
    // Texte libre et non l'enum `currency` : la conversion couvre plus de
    // 150 pays, contraindre ici perdrait la donnée qu'on cherche à capturer.
    // Nul quand le client a payé dans la devise d'intégration (CAD).
    presentmentAmount: integer("presentment_amount"),
    presentmentCurrency: text("presentment_currency"),
```

- [ ] **Step 2 : Générer la migration**

Run: `bun run db:generate`
Expected: création de `drizzle/0013_<mot>_<mot>.sql` et mise à jour de `drizzle/meta/_journal.json`.

- [ ] **Step 3 : Corriger la migration à la main**

Drizzle génère `ADD COLUMN "stripe_price_lookup_key" text NOT NULL`, qui **échoue** sur une table non vide. Remplacer intégralement le contenu du fichier généré par :

```sql
-- `lookup_key` : clé de prix Stripe, IDENTIQUE en test et en live (contrairement
-- aux `price_…`). Le catalogue Stripe a été annoté avec la même chaîne que
-- `products.code` dans les deux modes, d'où le backfill ci-dessous.
ALTER TABLE "products" ADD COLUMN "stripe_price_lookup_key" text;--> statement-breakpoint
UPDATE "products" SET "stripe_price_lookup_key" = "code"::text;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "stripe_price_lookup_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "presentment_amount" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "presentment_currency" text;
```

Le `::text` n'est pas décoratif : `code` est de type `product_code` (enum Postgres), et l'affectation directe d'un enum à une colonne `text` n'est pas garantie sans cast explicite.

Ne pas toucher à `drizzle/meta/_journal.json` ni au dossier `drizzle/meta/` : le fichier est déjà enregistré par `db:generate`.

- [ ] **Step 4 : Mettre à jour les inserts `products` des tests**

Les tests d'intégration tournent sur une branche Neon migrée : la colonne `NOT NULL` casse tous leurs inserts. Ajouter le champ partout, avec la même valeur que `stripePriceId` (aucun test de cette vague ne résout de prix, la valeur n'a pas d'importance) :

Run:
```bash
find tests -name '*.ts' -exec sed -i -E 's/^(\s*)stripePriceId: (.+),$/\1stripePriceId: \2,\n\1stripePriceLookupKey: \2,/' {} +
```

Expected: ~20 fichiers modifiés. Vérifier avec `git diff --stat tests/`.

`tests/components/payments/PricingGrid.test.tsx` n'est **pas** touché (extension `.tsx`) : il moque un `ProductView`, dont les champs Stripe disparaissent en Task 7.

- [ ] **Step 5 : Appliquer la migration en dev**

Run: `bun run db:migrate`
Expected: `[✓] migrations applied successfully!`

- [ ] **Step 6 : Vérifier le backfill**

Run:
```bash
bun -e 'import {db} from "./db"; import {products} from "./db/schema"; console.table(await db.select({code: products.code, lk: products.stripePriceLookupKey}).from(products))'
```
Expected: 5 lignes, `lk` égal à `code` sur chacune (`exam_access`, `training_access`, `exam_access_promo`, `training_access_promo`, `premium_access`).

- [ ] **Step 7 : Type-check**

Run: `bunx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 8 : Commit**

```bash
git add db/schema/payments.ts drizzle/ tests/
git commit -m "feat(db): lookup_key de prix Stripe et colonnes presentment"
```

---

## Task 2 : Module `catalog.ts` — résolution et dérive

**Files:**
- Create: `features/payments/catalog.ts`
- Test: `tests/features/payments-catalog.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/features/payments-catalog.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest"
import {
  describePriceDrift,
  resolveStripePrice,
} from "@/features/payments/catalog"

// `describePriceDrift` est pur : c'est lui qui décide si le prix affiché en base
// et le prix que Stripe facturera racontent la même chose. Chaque cas est écrit
// par paire — une version qui concorde, une version qui diverge — sinon rien ne
// prouve que la comparaison mord réellement.
const PRICE = {
  id: "price_1",
  unit_amount: 5000,
  currency: "cad",
} as const

describe("describePriceDrift", () => {
  it("montant et devise concordants → aucune dérive", () => {
    expect(describePriceDrift(5000, PRICE)).toBeNull()
  })

  it("montant divergent → dérive décrite avec les deux valeurs", () => {
    const drift = describePriceDrift(3000, PRICE)
    expect(drift).toContain("5000")
    expect(drift).toContain("3000")
  })

  it("devise du prix Stripe ≠ cad → dérive", () => {
    expect(describePriceDrift(5000, { ...PRICE, currency: "usd" })).toContain(
      "usd",
    )
  })

  it("unit_amount null (prix à montant libre) → dérive, pas de crash", () => {
    expect(
      describePriceDrift(5000, { ...PRICE, unit_amount: null }),
    ).not.toBeNull()
  })
})

describe("resolveStripePrice", () => {
  it("interroge Stripe sur la clé, en prix actifs seulement", async () => {
    const list = vi.fn(async () => ({ data: [PRICE] }))
    const stripe = { prices: { list } } as never

    const price = await resolveStripePrice(stripe, "exam_access")

    expect(price).toEqual(PRICE)
    expect(list).toHaveBeenCalledWith({
      lookup_keys: ["exam_access"],
      active: true,
      limit: 2,
    })
  })

  it("aucun prix actif pour la clé → null (et non une exception)", async () => {
    const stripe = { prices: { list: async () => ({ data: [] }) } } as never
    expect(await resolveStripePrice(stripe, "inconnu")).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `bun run test tests/features/payments-catalog.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/payments/catalog"`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `features/payments/catalog.ts` :

```ts
import "server-only"
import type Stripe from "stripe"

type PriceShape = Pick<Stripe.Price, "id" | "unit_amount" | "currency">

/**
 * Résout le prix Stripe d'un produit par sa `lookup_key`. Contrairement à un
 * `price_…`, une `lookup_key` est identique en test et en live : c'est ce qui
 * rend impossible l'usage d'un identifiant du mauvais mode. Stripe garantit
 * l'unicité de la clé parmi les prix actifs (`transfer_lookup_key` la déplace
 * sur le nouveau prix lors d'un changement de tarif) — `limit: 2` laisse
 * néanmoins voir une éventuelle anomalie plutôt que de la masquer.
 *
 * `null` = aucun prix actif ne porte cette clé dans le mode de la clé API.
 */
export const resolveStripePrice = async (
  stripe: Stripe,
  lookupKey: string,
): Promise<Stripe.Price | null> => {
  const { data } = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 2,
  })
  return data[0] ?? null
}

/**
 * Écart entre le prix AFFICHÉ (`products.priceCad`, en cents, lu par la grille
 * tarifaire et les paywalls) et le prix que Stripe FACTURERA. Les deux vivent
 * dans des systèmes différents ; sans cette comparaison, une modification de
 * tarif au dashboard non répercutée en base laisse le client lire un montant et
 * en payer un autre.
 *
 * `null` = ils concordent. Sinon, une description prête à partir dans Sentry.
 */
export const describePriceDrift = (
  priceCad: number,
  price: PriceShape,
): string | null => {
  const parts: string[] = []
  if (price.currency !== "cad") {
    parts.push(`devise Stripe ${price.currency} ≠ cad`)
  }
  if (price.unit_amount !== priceCad) {
    parts.push(`montant Stripe ${price.unit_amount ?? "null"} ≠ base ${priceCad}`)
  }
  return parts.length > 0 ? `${price.id} : ${parts.join(" · ")}` : null
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `bun run test tests/features/payments-catalog.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5 : Commit**

```bash
git add features/payments/catalog.ts tests/features/payments-catalog.test.ts
git commit -m "feat(payments): résolution de prix Stripe par lookup_key et détection de dérive"
```

---

## Task 3 : Checkout — résolution par `lookup_key`

**Files:**
- Modify: `features/payments/actions.ts:335-415`
- Test: `tests/features/payments-actions.test.ts`, `tests/integration/payments-checkout.test.ts`

- [ ] **Step 1 : Étendre les mocks du test unitaire**

Dans `tests/features/payments-actions.test.ts`, ajouter au bloc `vi.hoisted` (après `checkoutCreate`) :

```ts
    pricesList:
      vi.fn<
        () => Promise<{
          data: { id: string; unit_amount: number | null; currency: string }[]
        }>
      >(),
```

Étendre le mock du client Stripe :

```ts
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mocks.checkoutCreate } },
    customers: { list: mocks.customersList },
    billingPortal: { sessions: { create: mocks.portalCreate } },
    prices: { list: mocks.pricesList },
  }),
}))
```

Remplacer `stripePriceId` par `stripePriceLookupKey` dans `ACTIVE_PRODUCT` :

```ts
const ACTIVE_PRODUCT = {
  id: "p1",
  stripePriceLookupKey: "exam_access",
  priceCad: 5000,
  accessType: "exam",
  durationDays: 90,
  isCombo: false,
  isActive: true,
}
```

Et donner une résolution par défaut dans le `beforeEach` existant (`clearMocks: true` efface les appels, pas l'implémentation posée ici) :

```ts
beforeEach(() => {
  mocks.productRows.current = [ACTIVE_PRODUCT]
  mocks.pricesList.mockResolvedValue({
    data: [{ id: "price_resolved", unit_amount: 5000, currency: "cad" }],
  })
})
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Ajouter dans le `describe("createStripeCheckout", …)` de `tests/features/payments-actions.test.ts` :

```ts
  it("facture le prix résolu par lookup_key, pas un identifiant stocké", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout(input)

    expect(mocks.pricesList).toHaveBeenCalledWith({
      lookup_keys: ["exam_access"],
      active: true,
      limit: 2,
    })
    const arg = mocks.checkoutCreate.mock.calls[0]![0] as unknown as {
      line_items: { price: string }[]
    }
    expect(arg.line_items[0].price).toBe("price_resolved")
  })

  it("lookup_key sans prix actif → produit mal configuré, aucune session", async () => {
    mocks.pricesList.mockResolvedValue({ data: [] })
    const res = await createStripeCheckout(input)

    expect(res).toEqual({
      error: "Ce produit est mal configuré. Contactez le support.",
    })
    expect(mocks.checkoutCreate).not.toHaveBeenCalled()
    expect(mocks.insertValues).not.toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  // Le prix affiché vient de la base, le prix facturé vient de Stripe. Un écart
  // doit ALERTER sans bloquer : couper les ventes d'un produit sur une erreur
  // d'ops coûte plus cher que l'écart lui-même.
  it("prix Stripe divergent → alerte mais la vente aboutit", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [{ id: "price_resolved", unit_amount: 9900, currency: "cad" }],
    })
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })

    const res = await createStripeCheckout(input)

    expect(res).toEqual({ checkoutUrl: "https://stripe.test/pay" })
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  it("prix Stripe conforme → aucune alerte", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout(input)
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })
```

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run: `bun run test tests/features/payments-actions.test.ts`
Expected: FAIL — `mocks.pricesList` jamais appelé, `line_items[0].price` vaut `undefined`.

- [ ] **Step 4 : Implémenter**

Dans `features/payments/actions.ts`, ajouter l'import (bloc `@/` de l'ordre Prettier) :

```ts
import { describePriceDrift, resolveStripePrice } from "./catalog"
```

Remplacer le champ sélectionné (`features/payments/actions.ts:341`) :

```ts
      stripePriceLookupKey: products.stripePriceLookupKey,
```

Dans le `try`, entre `const base = appBase()` et `stripe.checkout.sessions.create` :

```ts
    const price = await resolveStripePrice(
      stripe,
      product.stripePriceLookupKey,
    )
    if (!price) {
      captureServerError(
        "[createStripeCheckout]",
        new Error("aucun prix actif pour cette lookup_key"),
        {
          userId: session.user.id,
          detail: `lookup_key ${product.stripePriceLookupKey} absente du mode de la clé active (produit ${productCode})`,
        },
      )
      return { error: "Ce produit est mal configuré. Contactez le support." }
    }

    // Le client a vu `priceCad` sur la grille tarifaire ; Stripe encaissera
    // `price.unit_amount`. On alerte sans bloquer : une vente refusée sur une
    // erreur de configuration coûte plus cher que l'écart.
    const drift = describePriceDrift(product.priceCad, price)
    if (drift) {
      captureServerError(
        "[createStripeCheckout]",
        new Error("prix affiché divergent du prix Stripe"),
        { userId: session.user.id, detail: `produit ${productCode} · ${drift}` },
      )
    }
```

Puis remplacer la ligne `line_items` :

```ts
      line_items: [{ price: price.id, quantity: 1 }],
```

Enfin, remplacer le commentaire du bloc `isStripeResourceMissing` (`features/payments/actions.ts:399-404`) — il décrit un mécanisme qui n'existe plus :

```ts
    // `resource_missing` à la CRÉATION de la session (≠ verifyStripeCheckout, où
    // il vient d'une URL périmée). Le prix étant désormais résolu en amont, ce
    // cas ne peut plus venir d'un identifiant du mauvais mode : il signale un
    // objet Stripe supprimé entre la résolution et la création.
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `bun run test tests/features/payments-actions.test.ts`
Expected: PASS, tous les tests du fichier — y compris les anciens (`safePath`, produit désactivé…), qui doivent continuer à passer sans modification.

- [ ] **Step 6 : Adapter le test d'intégration du checkout**

Dans `tests/integration/payments-checkout.test.ts` :

Ajouter le mock de `prices.list` au bloc `vi.hoisted` :

```ts
    pricesList: vi.fn(async () => ({
      data: [{ id: "price_resolved", unit_amount: 5000, currency: "cad" }],
    })),
```

Étendre le mock Stripe :

```ts
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mocks.create } },
    prices: { list: mocks.pricesList },
  }),
}))
```

Le `db.insert(products)` du `beforeAll` porte déjà `stripePriceLookupKey` depuis la Task 1 — vérifier que c'est bien le cas, sinon l'ajouter.

Ajouter le test qui prouve qu'aucun `pending` n'est créé quand la clé ne résout rien :

```ts
  it("lookup_key sans prix actif → aucune transaction pending créée", async () => {
    mocks.create.mockClear()
    mocks.pricesList.mockResolvedValueOnce({ data: [] })

    const before = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.userId, USER_ID))

    const res = await createStripeCheckout({
      productCode: "exam_access",
      successPath: "/tableau-de-bord",
      cancelPath: "/tarifs",
    })

    expect(res).toEqual({
      error: "Ce produit est mal configuré. Contactez le support.",
    })
    expect(mocks.create).not.toHaveBeenCalled()

    const after = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.userId, USER_ID))
    expect(after.length).toBe(before.length)
  })
```

- [ ] **Step 7 : Commit**

```bash
git add features/payments/actions.ts tests/features/payments-actions.test.ts tests/integration/payments-checkout.test.ts
git commit -m "feat(payments): résoudre le prix au checkout par lookup_key et alerter sur la dérive"
```

---

## Task 4 : Tâche cron d'audit de dérive

**Files:**
- Create: `features/payments/cron.ts`
- Modify: `app/api/cron/close-expired/route.ts`
- Test: `tests/features/payments-cron.test.ts`, `tests/features/cron-close-expired.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/features/payments-cron.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { auditProductPriceDrift } from "@/features/payments/cron"

// La vérification au checkout ne voit que les produits qu'on achète. Cette tâche
// couvre ceux qui dorment — un produit peu demandé peut dériver des semaines.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    productRows: { current: [] as unknown[] },
    pricesList:
      vi.fn<
        () => Promise<{
          data: {
            id: string
            lookup_key: string | null
            unit_amount: number | null
            currency: string
          }[]
        }>
      >(),
    env: { STRIPE_SECRET_KEY: "sk_test_x" as string | undefined },
  },
}))

const selectChain = () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => mocks.productRows.current,
  }
  return chain
}

vi.mock("@/db", () => ({ db: { select: () => selectChain() } }))
vi.mock("@/db/schema", () => ({
  products: { code: {}, priceCad: {}, stripePriceLookupKey: {}, isActive: {} },
}))
vi.mock("@/lib/env/server", () => ({ env: mocks.env }))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ prices: { list: mocks.pricesList } }),
}))

// Les clés sont celles de l'ALIAS du `select` Drizzle (`lookupKey`), pas les noms
// de colonnes : c'est ce que la vraie requête retourne.
const PRODUCT = {
  code: "exam_access",
  priceCad: 5000,
  lookupKey: "exam_access",
}

beforeEach(() => {
  mocks.env.STRIPE_SECRET_KEY = "sk_test_x"
  mocks.productRows.current = [PRODUCT]
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("auditProductPriceDrift", () => {
  it("prix conforme → aucune alerte", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_1",
          lookup_key: "exam_access",
          unit_amount: 5000,
          currency: "cad",
        },
      ],
    })

    const res = await auditProductPriceDrift()

    expect(res).toEqual({ checked: 1, drifted: 0 })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("prix divergent → une alerte, le produit est compté comme dérivé", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_1",
          lookup_key: "exam_access",
          unit_amount: 9900,
          currency: "cad",
        },
      ],
    })

    const res = await auditProductPriceDrift()

    expect(res).toEqual({ checked: 1, drifted: 1 })
    expect(mocks.captureServerError).toHaveBeenCalledTimes(1)
  })

  it("lookup_key sans prix actif → alerte dédiée", async () => {
    mocks.pricesList.mockResolvedValue({ data: [] })

    const res = await auditProductPriceDrift()

    expect(res).toEqual({ checked: 1, drifted: 1 })
    expect(mocks.captureServerError).toHaveBeenCalledTimes(1)
  })

  // `lookup_keys` accepte 10 clés par requête : au-delà, une seule liste
  // tronquerait en silence et les produits surnuméraires passeraient pour
  // « sans prix actif ».
  it("plus de 10 produits → découpage en plusieurs appels", async () => {
    mocks.productRows.current = Array.from({ length: 12 }, (_, i) => ({
      code: `p${i}`,
      priceCad: 5000,
      lookupKey: `key_${i}`,
    }))
    mocks.pricesList.mockImplementation(async () => ({
      data: mocks.productRows.current.map((r) => {
        const row = r as { lookupKey: string }
        return {
          id: `price_${row.lookupKey}`,
          lookup_key: row.lookupKey,
          unit_amount: 5000,
          currency: "cad",
        }
      }),
    }))

    const res = await auditProductPriceDrift()

    expect(mocks.pricesList).toHaveBeenCalledTimes(2)
    expect(res).toEqual({ checked: 12, drifted: 0 })
  })

  it("Stripe non configuré → tâche neutre, aucun appel", async () => {
    mocks.env.STRIPE_SECRET_KEY = undefined
    const res = await auditProductPriceDrift()
    expect(res).toEqual({ checked: 0, drifted: 0 })
    expect(mocks.pricesList).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `bun run test tests/features/payments-cron.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/payments/cron"`.

- [ ] **Step 3 : Implémenter**

Créer `features/payments/cron.ts` :

```ts
import { eq } from "drizzle-orm"
import "server-only"
import type Stripe from "stripe"
import { db } from "@/db"
import { products } from "@/db/schema"
import { env } from "@/lib/env/server"
import { captureServerError } from "@/lib/observability"
import { getStripe } from "@/lib/stripe"
import { describePriceDrift } from "./catalog"

export type PriceDriftResult = { checked: number; drifted: number }

// Borne de l'API Stripe : `prices.list` accepte au plus 10 `lookup_keys` par
// requête. Au-delà, la liste serait tronquée en silence et les produits
// surnuméraires passeraient pour « sans prix actif ».
const LOOKUP_KEYS_PER_CALL = 10

/**
 * Compare le prix AFFICHÉ (`products.priceCad`) au prix que Stripe FACTURERAIT,
 * pour tous les produits actifs. Le contrôle équivalent au checkout ne couvre
 * que les produits qu'on achète : un produit peu demandé peut dériver des
 * semaines sans que personne ne l'apprenne.
 *
 * Lecture seule : aucune écriture en base, aucune écriture chez Stripe.
 */
export async function auditProductPriceDrift(): Promise<PriceDriftResult> {
  if (!env.STRIPE_SECRET_KEY) return { checked: 0, drifted: 0 }

  const rows = await db
    .select({
      code: products.code,
      priceCad: products.priceCad,
      lookupKey: products.stripePriceLookupKey,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .limit(50)
  if (rows.length === 0) return { checked: 0, drifted: 0 }

  const stripe = getStripe()
  const byLookupKey = new Map<string, Stripe.Price>()
  for (let i = 0; i < rows.length; i += LOOKUP_KEYS_PER_CALL) {
    const { data } = await stripe.prices.list({
      lookup_keys: rows
        .slice(i, i + LOOKUP_KEYS_PER_CALL)
        .map((r) => r.lookupKey),
      active: true,
      limit: LOOKUP_KEYS_PER_CALL,
    })
    for (const price of data) {
      if (price.lookup_key) byLookupKey.set(price.lookup_key, price)
    }
  }

  let drifted = 0
  for (const row of rows) {
    const price = byLookupKey.get(row.lookupKey)
    if (!price) {
      drifted++
      captureServerError(
        "[cron:price-drift]",
        new Error("aucun prix actif pour cette lookup_key"),
        { detail: `produit ${row.code} · lookup_key ${row.lookupKey}` },
      )
      continue
    }
    const drift = describePriceDrift(row.priceCad, price)
    if (drift) {
      drifted++
      captureServerError(
        "[cron:price-drift]",
        new Error("prix affiché divergent du prix Stripe"),
        { detail: `produit ${row.code} · ${drift}` },
      )
    }
  }

  return { checked: rows.length, drifted }
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `bun run test tests/features/payments-cron.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5 : Brancher la tâche dans le dispatcher**

Dans `app/api/cron/close-expired/route.ts`, ajouter l'import :

```ts
import { auditProductPriceDrift } from "@/features/payments/cron"
```

Ajouter l'appel après `quizRateLimitCleanup` et avant le bloc `notifications` :

```ts
  const priceDrift = await run(
    "dérive des prix catalogue",
    "[cron:price-drift]",
    auditProductPriceDrift,
    { checked: 0, drifted: 0 },
  )
```

Ajouter la clé au `Response.json` final :

```ts
  return Response.json({
    examParticipations,
    trainingSessions,
    anonymizedAccounts,
    notifications,
    quizRateLimitCleanup,
    priceDrift,
  })
```

Ne PAS toucher au `console.log` conditionnel : une dérive alerte déjà par Sentry, l'ajouter au log de synthèse ferait doublon.

Mettre à jour le JSDoc de la route, qui annonce aujourd'hui deux tâches :

```ts
/**
 * Cron : clôtures (examens, entraînements), anonymisation RGPD, purge du
 * rate-limit quiz, notifications en attente et audit de dérive des prix
 * catalogue. Une seule route pour l'ensemble.
```

- [ ] **Step 6 : Étendre le test d'isolation de la route**

Dans `tests/features/cron-close-expired.test.ts`, ajouter au bloc `vi.hoisted` :

```ts
    auditProductPriceDrift: vi.fn(async () => ({ checked: 0, drifted: 0 })),
```

Et le mock du module :

```ts
vi.mock("@/features/payments/cron", () => ({
  auditProductPriceDrift: mocks.auditProductPriceDrift,
}))
```

Ajouter le test qui prouve l'isolation — l'invariant du fichier :

```ts
  it("échec de l'audit de prix → les autres tâches tournent quand même", async () => {
    mocks.auditProductPriceDrift.mockRejectedValueOnce(new Error("Stripe down"))

    const res = await call("Bearer s3cret")

    expect(res.status).toBe(500)
    expect(mocks.anonymizeExpiredDeletedAccounts).toHaveBeenCalled()
    expect(mocks.sendPendingNotifications).toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalled()
  })
```

- [ ] **Step 7 : Lancer les deux fichiers de test**

Run: `bun run test tests/features/payments-cron.test.ts tests/features/cron-close-expired.test.ts`
Expected: PASS sur les deux fichiers.

- [ ] **Step 8 : Commit**

```bash
git add features/payments/cron.ts app/api/cron/close-expired/route.ts tests/features/payments-cron.test.ts tests/features/cron-close-expired.test.ts
git commit -m "feat(payments): tâche cron d'audit de dérive des prix catalogue"
```

---

## Task 5 : Fulfillment — persistance de `presentment_details`

**Files:**
- Modify: `features/payments/stripe.ts:52-70` (signature + JSDoc), `features/payments/stripe.ts:140-155` (UPDATE)
- Modify: `app/api/stripe/webhook/route.ts:70-80`
- Test: `tests/integration/payments-stripe.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `tests/integration/payments-stripe.test.ts`, étendre le helper `txStatus` avec les deux colonnes :

```ts
const txStatus = (id: string) =>
  db
    .select({
      status: transactions.status,
      completedAt: transactions.completedAt,
      eventId: transactions.stripeEventId,
      pi: transactions.stripePaymentIntentId,
      accessExpiresAt: transactions.accessExpiresAt,
      amountPaid: transactions.amountPaid,
      currency: transactions.currency,
      presentmentAmount: transactions.presentmentAmount,
      presentmentCurrency: transactions.presentmentCurrency,
    })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)
    .then((r) => r[0])
```

Ajouter deux identifiants d'utilisateur au tableau `U` (passer `length: 11` à `length: 13`) et à la déstructuration :

```ts
const U = Array.from({ length: 13 }, () => createId())
const [
  U_HAPPY,
  U_CUMUL,
  U_COMBO,
  U_FAIL,
  U_FAILDONE,
  U_PROMO,
  U_XAF,
  U_DEGNULL,
  U_DEGUSD,
  U_PROMO100,
  U_RACE,
  U_PRESENT,
  U_NOPRESENT,
] = U
```

Ajouter les deux tests dans le `describe("completeStripeTransaction", …)` :

```ts
  // Adaptive Pricing : le client voit des FCFA, l'événement arrive en CAD. Le
  // montant local ne vit que dans `presentment_details` — sans persistance,
  // un client qui écrit « j'ai payé 228 000 FCFA » n'est recoupable par personne.
  it("persiste le montant présenté sans toucher au montant encaissé", async () => {
    const txId = createId()
    const sid = `sess_present_${suffix}`
    await seedPending({
      id: txId,
      userId: U_PRESENT,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 90,
    })

    await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_present",
      stripeEventId: `evt_present_${suffix}`,
      amountTotal: 5000,
      currency: "cad",
      presentmentAmount: 2280000,
      presentmentCurrency: "xaf",
    })

    const tx = await txStatus(txId)
    expect(tx?.presentmentAmount).toBe(2280000)
    expect(tx?.presentmentCurrency).toBe("XAF")
    // Invariant comptable : l'encaissement reste le CAD.
    expect(tx?.amountPaid).toBe(5000)
    expect(tx?.currency).toBe("CAD")
  })

  it("client sans conversion (pas de presentment_details) → colonnes nulles", async () => {
    const txId = createId()
    const sid = `sess_nopresent_${suffix}`
    await seedPending({
      id: txId,
      userId: U_NOPRESENT,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 90,
    })

    await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_nopresent",
      stripeEventId: `evt_nopresent_${suffix}`,
      amountTotal: 5000,
      currency: "cad",
    })

    const tx = await txStatus(txId)
    expect(tx?.presentmentAmount).toBeNull()
    expect(tx?.presentmentCurrency).toBeNull()
    expect(tx?.amountPaid).toBe(5000)
  })
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `bun run test:integration tests/integration/payments-stripe.test.ts`
Expected: FAIL — TypeScript refuse `presentmentAmount` dans les paramètres de `completeStripeTransaction`.

> Ce script crée, migre et détruit une branche Neon éphémère. Il est plus lent que les tests frontend ; ne le lancer que sur le fichier concerné pendant l'itération.

- [ ] **Step 3 : Implémenter dans le fulfillment**

Dans `features/payments/stripe.ts`, étendre les paramètres :

```ts
export async function completeStripeTransaction(params: {
  stripeSessionId: string
  stripePaymentIntentId: string
  stripeEventId: string
  amountTotal?: number | null
  currency?: string | null
  presentmentAmount?: number | null
  presentmentCurrency?: string | null
}): Promise<CompleteStripeResult> {
```

Ajouter, juste après le bloc `reconcile` / `console.error` existant :

```ts
    // Adaptive Pricing : présent UNIQUEMENT si le client a payé dans sa devise
    // locale. Absent pour un client canadien — les colonnes restent nulles, et
    // c'est ce qui rend la proportion de conversions mesurable. Ne jamais faire
    // échouer un paiement valide sur de la traçabilité : valeurs partielles
    // ⇒ on n'écrit rien.
    const presentment =
      params.presentmentAmount != null && params.presentmentCurrency
        ? {
            presentmentAmount: params.presentmentAmount,
            presentmentCurrency: params.presentmentCurrency.toUpperCase(),
          }
        : null
```

Et l'ajouter au `set` du même `UPDATE` (aucune écriture supplémentaire) :

```ts
      .set({
        status: "completed",
        stripePaymentIntentId: params.stripePaymentIntentId || null,
        stripeEventId: params.stripeEventId,
        accessExpiresAt: txAccessExpiresAt,
        completedAt: now,
        ...(reconcile ?? {}),
        ...(presentment ?? {}),
      })
```

- [ ] **Step 4 : Transmettre depuis le webhook**

Dans `app/api/stripe/webhook/route.ts`, dans l'appel à `completeStripeTransaction`, remplacer le commentaire trompeur et ajouter les deux champs :

```ts
            // Montant réellement facturé : un code promo fait diverger
            // `amount_total` du prix catalogue. (Adaptive Pricing, lui, ne
            // change PAS la devise de la session — voir `presentment_details`
            // juste en dessous.)
            amountTotal: checkoutSession.amount_total,
            currency: checkoutSession.currency,
            // Ce que le client a réellement vu et payé dans sa devise locale.
            presentmentAmount:
              checkoutSession.presentment_details?.presentment_amount,
            presentmentCurrency:
              checkoutSession.presentment_details?.presentment_currency,
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `bun run test:integration tests/integration/payments-stripe.test.ts`
Expected: PASS — y compris les tests existants de réconciliation (`U_XAF`, `U_DEGNULL`, `U_DEGUSD`, `U_PROMO`), qui ne doivent pas bouger.

- [ ] **Step 6 : Commit**

```bash
git add features/payments/stripe.ts app/api/stripe/webhook/route.ts tests/integration/payments-stripe.test.ts
git commit -m "feat(payments): persister le montant présenté par Adaptive Pricing"
```

---

## Task 6 : Affichage du montant présenté au panneau admin

**Files:**
- Modify: `lib/format.ts:32-55`
- Test: `tests/lib/format.test.ts`
- Modify: `features/users/dal.ts:586-595` (type), `features/users/dal.ts:637-680` (requête + mapping)
- Modify: `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx:165-222`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `tests/lib/format.test.ts` :

```ts
import { formatPresentmentAmount } from "@/lib/format"

describe("formatPresentmentAmount", () => {
  // Le piège : `formatCurrency` divise toujours par 100. Le XAF n'a pas de
  // sous-unité — 228 000 FCFA s'afficheraient en « 2 280 ».
  it("devise zéro-décimal : l'unité mineure EST l'unité", () => {
    const out = formatPresentmentAmount(2280000, "xaf")
    expect(out).toContain("2 280 000")
    expect(out).not.toContain("22 800")
  })

  it("devise à deux décimales : division par 100", () => {
    expect(formatPresentmentAmount(5000, "cad")).toContain("50")
  })

  it("code de devise inconnu d'Intl → repli lisible, pas d'exception", () => {
    expect(formatPresentmentAmount(1234, "zz")).toBe("1234 ZZ")
  })
})
```

Les espaces des séparateurs de milliers produits par `Intl` sont des espaces insécables étroites : les assertions ci-dessus utilisent `toContain` sur des fragments sans séparateur ambigu. Si `toContain("2 280 000")` échoue, comparer via `out.replace(/\s/g, " ")`.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `bun run test tests/lib/format.test.ts`
Expected: FAIL — `formatPresentmentAmount is not a function`.

- [ ] **Step 3 : Implémenter le formateur**

Ajouter dans `lib/format.ts`, juste après `formatCurrency` :

```ts
/**
 * Montant présenté au client par Adaptive Pricing, dans SA devise.
 *
 * Ne pas confondre avec `formatCurrency`, qui divise toujours par 100 parce que
 * l'app stocke ses montants en centièmes. Ici la devise est arbitraire (plus de
 * 150 pays) et peut être zéro-décimal — XAF, JPY : l'unité mineure y EST
 * l'unité. Le facteur se dérive d'`Intl` plutôt que d'une liste de devises
 * zéro-décimal écrite en dur, qui vieillirait sans que rien ne le signale.
 */
export const formatPresentmentAmount = (
  minorUnits: number,
  currency: string,
): string => {
  const code = currency.toUpperCase()
  try {
    const formatter = new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: code,
    })
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
    return formatter.format(minorUnits / 10 ** digits)
  } catch {
    // Intl lève un RangeError sur un code non conforme : mieux vaut un affichage
    // brut qu'un panneau admin qui plante sur une devise exotique.
    return `${minorUnits} ${code}`
  }
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `bun run test tests/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5 : Exposer les champs dans le DAL admin**

Dans `features/users/dal.ts`, étendre le type `PanelTransaction` :

```ts
export type PanelTransaction = {
  id: string
  type: "stripe" | "manual"
  status: (typeof transactions.status.enumValues)[number]
  amountPaid: number
  currency: "CAD" | "XAF"
  /** Unité mineure de `presentmentCurrency`. Nul hors Adaptive Pricing. */
  presentmentAmount: number | null
  presentmentCurrency: string | null
  /** Epoch ms. */
  createdAt: number
  product: { name: string } | null
}
```

Ajouter les deux colonnes au `select` des transactions du panneau :

```ts
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        presentmentAmount: transactions.presentmentAmount,
        presentmentCurrency: transactions.presentmentCurrency,
        createdAt: transactions.createdAt,
```

Et au mapping `recentTransactions` :

```ts
    recentTransactions: txRows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      amountPaid: r.amountPaid,
      currency: r.currency,
      presentmentAmount: r.presentmentAmount,
      presentmentCurrency: r.presentmentCurrency,
      createdAt: r.createdAt.getTime(),
      product: r.productName ? { name: r.productName } : null,
    })),
```

- [ ] **Step 6 : Afficher dans le panneau**

Dans `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx`, étendre l'import de `lib/format` :

```ts
import {
  formatCurrency,
  formatExpiration,
  formatMediumDate,
  formatPresentmentAmount,
} from "@/lib/format"
```

Supprimer le `formatCurrency` local défini dans `TransactionItem` (lignes 166-172) : c'est une copie divergente de celui de `lib/format.ts`, et on vient d'ajouter son jumeau juste à côté. Le composant commence désormais par :

```tsx
function TransactionItem({ transaction }: { transaction: PanelTransaction }) {
  const statusConfig = {
```

Remplacer le bloc du montant (ligne ~216) :

```tsx
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          +{formatCurrency(transaction.amountPaid, transaction.currency)}
        </span>
        {transaction.presentmentCurrency !== null &&
          transaction.presentmentAmount !== null && (
            <p className="text-xs text-gray-500">
              présenté :{" "}
              {formatPresentmentAmount(
                transaction.presentmentAmount,
                transaction.presentmentCurrency,
              )}
            </p>
          )}
      </div>
```

- [ ] **Step 7 : Vérifier la suite frontend et le type-check**

Run: `bun run test && bunx tsc --noEmit`
Expected: PASS et aucune erreur de type. Aucun test ne construit de `PanelTransaction` littéral (`tests/features/users-dal.test.ts` et `tests/integration/users-admin-dal.test.ts` ne font que lire le résultat) : les deux nouveaux champs n'y demandent rien.

- [ ] **Step 8 : Commit**

```bash
git add lib/format.ts tests/lib/format.test.ts features/users/dal.ts "app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx"
git commit -m "feat(admin): afficher le montant présenté au client dans le panneau utilisateur"
```

---

## Task 7 : Commentaires trompeurs, documentation et `ProductView`

Cette tâche ne change aucun comportement. Elle existe parce que trois commentaires du dépôt affirment aujourd'hui le contraire de la documentation Stripe : le prochain lecteur « réparerait » une branche saine.

**Files:**
- Modify: `features/payments/stripe.ts:46-50`, `scripts/audit-stripe-transactions.ts:1-6`
- Modify: `features/payments/dal.ts:107-140`
- Modify: `tests/components/payments/PricingGrid.test.tsx:54`
- Modify: `.claude/rules/payments.md`, `AGENTS.md`

- [ ] **Step 1 : Corriger le JSDoc du fulfillment**

Dans `features/payments/stripe.ts`, remplacer le dernier paragraphe du bloc JSDoc de `completeStripeTransaction` :

```
 * `amountTotal`/`currency` (session Checkout) écrasent les valeurs provisoires du
 * pending (prix catalogue CAD) : seuls les CODES PROMO font effectivement diverger
 * le montant facturé du prix catalogue. Adaptive Pricing, lui, ne change ni la
 * devise ni le montant de la session — le montant local vit dans
 * `presentment_details`, persisté à part. La conversion XAF ×100 ci-dessous reste
 * correcte (le XAF est zéro-décimal chez Stripe) mais n'est atteinte que si un
 * prix est RÉELLEMENT libellé en XAF. Valeurs inexploitables (`amount_total`
 * null, devise hors enum) → on conserve le provisoire et on logue — un paiement
 * valide ne doit jamais échouer pour un problème de réconciliation.
```

- [ ] **Step 2 : Corriger l'en-tête du script d'audit**

Dans `scripts/audit-stripe-transactions.ts`, remplacer les trois premières lignes du bloc :

```
/**
 * Audit LECTURE SEULE des transactions Stripe historiques. Compare
 * `amountPaid`/`currency` en base avec `amount_total`/`currency` des sessions
 * Checkout réelles. Source de divergence attendue : les CODES PROMO. Adaptive
 * Pricing n'en est PAS une — il laisse la session dans la devise d'intégration
 * (le montant local vit dans `presentment_details`). AUCUNE écriture : selects
 * et GET Stripe.
```

- [ ] **Step 3 : Retirer les identifiants Stripe de `ProductView`**

Dans `features/payments/dal.ts`, supprimer les deux champs du type :

```ts
export type ProductView = {
  id: string
  code: (typeof products.code.enumValues)[number]
  name: string
  description: string
  /** En cents. Casse `priceCAD` conservée pour l'UI existante. */
  priceCAD: number
  durationDays: number
  accessType: "exam" | "training"
  isCombo: boolean
}
```

et du `select` de `getAvailableProducts` (supprimer les lignes `stripeProductId:` et `stripePriceId:`). Ces deux champs traversaient la frontière serveur → client sans qu'aucun composant ne les lise.

Dans `tests/components/payments/PricingGrid.test.tsx:53-54`, supprimer les deux lignes :

```ts
    stripeProductId: "prod_test",
    stripePriceId: "price_test",
```

- [ ] **Step 4 : Mettre à jour la règle projet**

Dans `.claude/rules/payments.md`, remplacer les deux premières puces de la section « Catalogue produits » :

```markdown
- **Le prix affiché et le prix facturé viennent de deux sources.**
  `products.priceCad` (Postgres) alimente la grille tarifaire et les paywalls ;
  Stripe facture le prix résolu au checkout depuis
  `products.stripePriceLookupKey`. Modifier un prix au dashboard Stripe SANS
  mettre à jour la ligne `products` fait diverger les deux — le client voit un
  montant et en paie un autre. Deux garde-fous alertent (Sentry, sans bloquer la
  vente) : la comparaison au checkout et la tâche cron `auditProductPriceDrift`.
- **Une `lookup_key` est IDENTIQUE en test et en live**, contrairement aux
  identifiants `price_…` / `prod_…` dont les préfixes ne trahissent pas le mode.
  C'est ce qui rend impossible la classe « identifiant du mauvais mode » : la clé
  résout le prix de test sous une clé de test, le prix live sous une clé live.
  Changer un tarif se fait par `transfer_lookup_key=true` (Stripe ne modifie
  jamais le montant d'un prix : il en crée un nouveau et déplace la clé).
```

Ajouter à la section « Montants et devises », après la puce Adaptive Pricing :

```markdown
- **`presentment_details` est persisté** (`transactions.presentment_amount` /
  `presentment_currency`, nullables) et affiché au panneau admin. C'est la seule
  façon de recouper un client qui écrit « j'ai payé 228 000 FCFA ». Ces colonnes
  ne sont PAS comptables : `amountPaid`/`currency` restent l'encaissement.
```

- [ ] **Step 5 : Mettre à jour `AGENTS.md`**

Dans la section « Gotchas », remplacer la puce « Stripe en dev » :

```markdown
- **Stripe en dev** : mode TEST (profil CLI `nomaqbanq`) ; webhooks locaux via `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Le prix est résolu au checkout par `products.stripe_price_lookup_key`, identique en test et en live → les 5 produits sont achetables en local sans configuration. Code promo test −100 % : `E2EPROMO100`
```

- [ ] **Step 6 : Vérifier**

Run: `bun run check`
Expected: prettier, tsc et eslint passent.

- [ ] **Step 7 : Commit**

```bash
git add features/payments/stripe.ts features/payments/dal.ts scripts/audit-stripe-transactions.ts tests/components/payments/PricingGrid.test.tsx .claude/rules/payments.md AGENTS.md
git commit -m "docs(payments): aligner les commentaires Adaptive Pricing sur la doc officielle"
```

---

## Task 8 : Vérification complète

- [ ] **Step 1 : Suite frontend + couverture**

Run: `bun run test:coverage`
Expected: PASS, seuil de 80 % (statements/branches/functions/lines) tenu. Les nouveaux modules (`catalog.ts`, `cron.ts`) sont couverts par leurs tests dédiés.

- [ ] **Step 2 : Suite d'intégration complète**

Run: `bun run test:integration`
Expected: PASS. C'est ici que la migration est réellement éprouvée — le script crée une branche Neon neuve, y applique toutes les migrations, puis la détruit.

- [ ] **Step 3 : Vérification statique**

Run: `bun run check`
Expected: aucune erreur.

- [ ] **Step 4 : Test manuel du checkout en devise locale**

Nécessite le serveur de dev. **Ne pas le lancer soi-même** — demander à l'utilisateur de démarrer `bun dev` et de donner le port.

Modifier temporairement `customer_email` dans `createStripeCheckout` en
`"test+location_CM@example.com"`, acheter un produit, et vérifier que la page
Stripe s'affiche en FCFA. Après paiement (carte de test `4242 4242 4242 4242`),
vérifier en base que `presentment_amount` / `presentment_currency` sont
renseignés et qu'`amount_paid` reste le montant CAD. **Annuler la modification
de `customer_email` avant de committer.**

- [ ] **Step 5 : Commit final s'il reste des ajustements**

```bash
git add -A
git commit -m "test: vérification complète du catalogue par lookup_key"
```

---

## Déploiement

1. **Vérifier la permission `prices:read`** sur la clé Stripe de production (voir Prérequis). C'est le seul point qui casse tout le checkout s'il est manqué.
2. Merger ce PR. La migration s'applique au build Vercel (`build:vercel` → `migrate-deploy`), avant l'activation du déploiement — d'où le maintien de `stripe_price_id` : l'ancien code tourne encore pendant le build et continue de lire cette colonne.
3. Après vérification en production (un achat réel, ou l'absence d'alerte `[cron:price-drift]` pendant 24 h), ouvrir le PR de suivi : `DROP COLUMN stripe_price_id`, retrait du champ de `db/schema/payments.ts` et de tous les inserts de tests.

## Hors périmètre — ne pas dériver

- Aucun prix en XAF (couperait la conversion Adaptive Pricing sur cette devise).
- Aucun backfill de `presentment_details` sur l'historique.
- Aucun affichage dans la table transactions admin ni dans l'historique client.
- Aucun blocage de vente sur dérive de prix.
- Aucun cache sur la résolution du prix.
