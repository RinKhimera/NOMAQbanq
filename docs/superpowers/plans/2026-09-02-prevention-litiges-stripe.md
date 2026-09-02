# Prévention des litiges Stripe — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au client une trace écrite reconnaissable de son achat, faire connaître à l'application l'issue d'un litige, et produire le journal d'activité d'un client en une commande.

**Architecture:** Trois lots indépendants sur la même branche. Lot 1 : paramètres de session Checkout + quatre événements de litige dans le webhook, persistés sur `transactions` et affichés dans l'admin. Lot 2 : courriel de confirmation envoyé en best-effort après le fulfillment, `MessageId` SES stocké, journal SES → EventBridge → CloudWatch Logs. Lot 3 : script de lecture seule qui assemble les preuves au format attendu par Stripe.

**Tech Stack:** Next.js 16 · Drizzle/Neon · Stripe SDK 22 · React Email + SES v2 · Vitest (projets `frontend` et `integration`) · AWS via profil `claude-ops`.

**Spec :** `docs/superpowers/specs/2026-09-02-prevention-litiges-stripe-design.md`

**Conventions du dépôt à respecter :**

- `bun run test` (jamais `bun test`), `bun run test:integration <fichier>` pour un test sur branche Neon éphémère (crée, migre, détruit ; plusieurs minutes), `bun run check` avant chaque commit.
- Commentaires : le « pourquoi » non évident seulement. Jamais d'étiquette de tâche, jamais de narration de changement.
- Pas d'attribution Claude dans les commits.
- Ne jamais lancer `bun dev` : demander le port à l'utilisateur.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `db/schema/payments.ts` | + 4 colonnes nullables sur `transactions` |
| `drizzle/0014_*.sql` | migration générée |
| `features/payments/stripe.ts` | + `recordStripeDispute`, + `markConfirmationEmailSent`, retour enrichi de `completeStripeTransaction` |
| `features/payments/actions.ts` | 4 paramètres de session Checkout |
| `features/payments/dal.ts` | `disputeStatus` dans `AdminTransactionView` |
| `app/api/stripe/webhook/route.ts` | 4 événements, courriel best-effort |
| `components/shared/payments/dispute-badge.ts` | logique pure du badge (testable sans rendu) |
| `components/shared/payments/transaction-table.tsx` | affichage du badge |
| `email/templates/purchase-confirmation-email.tsx` | gabarit |
| `email/index.tsx` | `sendPurchaseConfirmationEmail` |
| `scripts/dispute-evidence.ts` | script lecture seule |
| `tests/features/stripe-webhook-errors.test.ts` | événements + courriel |
| `tests/features/payments-actions.test.ts` | paramètres Checkout |
| `tests/integration/payments-stripe.test.ts` | DAL litige + retour enrichi |
| `tests/integration/payments-admin-dal.test.ts` | `disputeStatus` exposé |
| `tests/components/payments/dispute-badge.test.ts` | badge |
| `tests/email/templates.test.ts`, `tests/email/index.test.ts` | courriel |
| `tests/scripts/dispute-evidence.test.ts` | formatage des preuves |
| `.claude/rules/payments.md` | invariants ajoutés |
| `package.json`, `.gitignore` | script + sortie ignorée |

---

## Lot 1 — Prévenir et voir

### Task 1 : Colonnes `transactions` + migration

**Files:**
- Modify: `db/schema/payments.ts` (table `transactions`, après `stripeEventId`)
- Create: `drizzle/0014_<nom généré>.sql`

- [ ] **Step 1 : Ajouter les colonnes au schéma**

Dans `db/schema/payments.ts`, juste après la ligne
`stripeEventId: text("stripe_event_id"), // idempotence (unique below)` :

```ts
    // Litige Stripe rattaché par `stripe_payment_intent_id`. Statut en texte
    // libre : l'enum Stripe peut s'étendre, une valeur inconnue ne doit pas
    // faire échouer le webhook.
    stripeDisputeId: text("stripe_dispute_id"),
    disputeStatus: text("dispute_status"),
    // Preuve d'envoi du courriel de confirmation (MessageId SES) : seule clé
    // qui relie une transaction à une entrée du journal SES.
    confirmationEmailMessageId: text("confirmation_email_message_id"),
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at", {
      withTimezone: true,
    }),
```

- [ ] **Step 2 : Générer la migration**

Run: `bun run db:generate`
Expected: un nouveau fichier `drizzle/0014_<nom>.sql` contenant exactement quatre `ALTER TABLE "transactions" ADD COLUMN …` séparés par `--> statement-breakpoint`, et `drizzle/meta/_journal.json` mis à jour. Aucun `NOT NULL`, aucun `DROP`.

- [ ] **Step 3 : Appliquer sur la base de dev**

Run: `bun run db:migrate`
Expected: `migrations applied` sans erreur (cible `DATABASE_URL_UNPOOLED` de `.env.local`, branche Neon develop).

- [ ] **Step 4 : Vérifier le type-check**

Run: `bun run type-check`
Expected: 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add db/schema/payments.ts drizzle/
git commit -m "feat(payments): colonnes litige et preuve d'envoi sur transactions"
```

---

### Task 2 : `recordStripeDispute` (DAL, tests d'intégration)

**Files:**
- Modify: `features/payments/stripe.ts` (fin de fichier)
- Test: `tests/integration/payments-stripe.test.ts`

- [ ] **Step 1 : Écrire les tests d'intégration (échouent : fonction absente)**

Dans `tests/integration/payments-stripe.test.ts`, ajouter `recordStripeDispute` à l'import depuis `@/features/payments/stripe`, ajouter un utilisateur au tableau `U` (passer `length: 13` à `length: 14` et ajouter `U_DISPUTE` en dernière position de la déstructuration), puis ajouter en fin de fichier :

```ts
describe("recordStripeDispute", () => {
  const disputeOf = (id: string) =>
    db
      .select({
        disputeId: transactions.stripeDisputeId,
        disputeStatus: transactions.disputeStatus,
      })
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1)
      .then((r) => r[0])

  const seedCompleted = async (id: string, paymentIntentId: string) => {
    await seedPending({
      id,
      userId: U_DISPUTE,
      productId: PEXAM,
      sessionId: `cs_${id}`,
      accessType: "exam",
      durationDays: 90,
    })
    await db
      .update(transactions)
      .set({ status: "completed", stripePaymentIntentId: paymentIntentId })
      .where(eq(transactions.id, id))
  }

  it("pose l'id et le statut du litige sur la transaction du payment_intent", async () => {
    const tx = createId()
    await seedCompleted(tx, `pi_${tx}`)

    const result = await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: "dp_1",
      disputeStatus: "needs_response",
    })

    expect(result).toEqual({ status: "recorded" })
    expect(await disputeOf(tx)).toEqual({
      disputeId: "dp_1",
      disputeStatus: "needs_response",
    })
  })

  it("un statut non terminal n'écrase jamais un statut terminal (ordre de livraison non garanti)", async () => {
    const tx = createId()
    await seedCompleted(tx, `pi_${tx}`)
    await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: "dp_2",
      disputeStatus: "won",
    })

    const late = await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: "dp_2",
      disputeStatus: "under_review",
    })

    expect(late).toEqual({ status: "kept_terminal" })
    expect((await disputeOf(tx)).disputeStatus).toBe("won")
  })

  it("un statut terminal remplace un non terminal", async () => {
    const tx = createId()
    await seedCompleted(tx, `pi_${tx}`)
    await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: "dp_3",
      disputeStatus: "under_review",
    })

    await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: "dp_3",
      disputeStatus: "lost",
    })

    expect((await disputeOf(tx)).disputeStatus).toBe("lost")
  })

  it("payment_intent inconnu → not_found, rien d'écrit", async () => {
    const result = await recordStripeDispute({
      stripePaymentIntentId: `pi_inconnu_${suffix}`,
      stripeDisputeId: "dp_4",
      disputeStatus: "needs_response",
    })
    expect(result).toEqual({ status: "not_found" })
  })
})
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test:integration tests/integration/payments-stripe.test.ts`
Expected: échec à l'import, `recordStripeDispute` n'est pas exporté.

- [ ] **Step 3 : Implémenter**

Dans `features/payments/stripe.ts`, remplacer la première ligne d'import drizzle par :

```ts
import { and, eq, isNull, notInArray, or } from "drizzle-orm"
```

et ajouter en fin de fichier :

```ts
// Statuts après lesquels Stripe ne renvoie plus de changement d'état.
const TERMINAL_DISPUTE_STATUSES = ["won", "lost", "warning_closed"] as const

export type RecordDisputeResult = {
  status: "recorded" | "kept_terminal" | "not_found"
}

/**
 * Rattache un litige Stripe à la transaction de son `payment_intent` et
 * enregistre son statut courant. Idempotent (même valeur réécrite). Stripe ne
 * garantit pas l'ordre de livraison des événements : un statut terminal n'est
 * jamais écrasé par un statut non terminal arrivé en retard.
 */
export async function recordStripeDispute(params: {
  stripePaymentIntentId: string
  stripeDisputeId: string
  disputeStatus: string
}): Promise<RecordDisputeResult> {
  const incomingIsTerminal = (
    TERMINAL_DISPUTE_STATUSES as readonly string[]
  ).includes(params.disputeStatus)

  const updated = await db
    .update(transactions)
    .set({
      stripeDisputeId: params.stripeDisputeId,
      disputeStatus: params.disputeStatus,
    })
    .where(
      and(
        eq(transactions.stripePaymentIntentId, params.stripePaymentIntentId),
        incomingIsTerminal
          ? undefined
          : or(
              isNull(transactions.disputeStatus),
              notInArray(transactions.disputeStatus, [
                ...TERMINAL_DISPUTE_STATUSES,
              ]),
            ),
      ),
    )
    .returning({ id: transactions.id })
  if (updated.length > 0) return { status: "recorded" }

  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      eq(transactions.stripePaymentIntentId, params.stripePaymentIntentId),
    )
    .limit(1)
  return { status: existing ? "kept_terminal" : "not_found" }
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `bun run test:integration tests/integration/payments-stripe.test.ts`
Expected: tous verts, dont les 4 nouveaux.

- [ ] **Step 5 : Commit**

```bash
git add features/payments/stripe.ts tests/integration/payments-stripe.test.ts
git commit -m "feat(payments): recordStripeDispute avec garde-fou sur les statuts terminaux"
```

---

### Task 3 : Webhook — cycle de vie du litige + early fraud warning

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Test: `tests/features/stripe-webhook-errors.test.ts`

- [ ] **Step 1 : Adapter le mock et écrire les tests (échouent)**

Dans `tests/features/stripe-webhook-errors.test.ts` :

Dans le bloc `vi.hoisted`, ajouter :

```ts
    recordDispute: vi.fn<() => Promise<unknown>>(),
```

Dans `vi.mock("@/features/payments/stripe", …)`, ajouter :

```ts
  recordStripeDispute: mocks.recordDispute,
```

Dans `beforeEach`, ajouter :

```ts
  mocks.recordDispute.mockResolvedValue({ status: "recorded" })
```

Remplacer le test existant `"charge.dispute.created → alerte, 200, aucune révocation d'accès"` par :

```ts
  it("charge.dispute.created → persiste le litige, alerte, 200, aucune révocation d'accès", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "needs_response",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_dispute",
      stripeDisputeId: "dp_1",
      disputeStatus: "needs_response",
    })
    // Le payment_intent est ce qui relie l'alerte a une transaction, donc a un
    // client : sans lui, personne n'est identifiable depuis Sentry.
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.any(Error),
      {
        detail:
          "dispute dp_1 · 9900 cad · motif fraudulent · statut needs_response · payment_intent pi_dispute",
      },
    )
    expect(mocks.fail).not.toHaveBeenCalled()
  })
```

Dans le test `"litige sans payment_intent → alerte quand meme, 200"`, ajouter `status: "needs_response",` dans l'objet et, après l'assertion existante :

```ts
    expect(mocks.recordDispute).not.toHaveBeenCalled()
```

Ajouter ensuite, dans le même `describe` :

```ts
  it("charge.dispute.updated → persiste sans alerter", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute_upd",
      type: "charge.dispute.updated",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "under_review",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_dispute",
      stripeDisputeId: "dp_1",
      disputeStatus: "under_review",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it.each([
    ["won", "litige gagné"],
    ["lost", "litige perdu"],
  ])("charge.dispute.closed (%s) → persiste et alerte « %s »", async (status, message) => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: `evt_closed_${status}`,
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status,
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).toHaveBeenCalledWith(
      expect.objectContaining({ disputeStatus: status }),
    )
    const [, error, context] = mocks.captureServerError.mock.calls[0]!
    expect((error as Error).message).toBe(message)
    expect(context).toEqual({
      detail: `dispute dp_1 · 9900 cad · motif fraudulent · statut ${status} · payment_intent pi_dispute`,
    })
  })

  it("charge.dispute.funds_reinstated → persiste et signale la restitution", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_reinstated",
      type: "charge.dispute.funds_reinstated",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "won",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).toHaveBeenCalled()
    const [, error] = mocks.captureServerError.mock.calls[0]!
    expect((error as Error).message).toBe("fonds restitués après litige")
  })

  it("litige sur un payment_intent sans transaction → alerte dédiée, 200", async () => {
    mocks.recordDispute.mockResolvedValueOnce({ status: "not_found" })
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute_ghost",
      type: "charge.dispute.updated",
      data: {
        object: {
          id: "dp_9",
          amount: 100,
          currency: "cad",
          reason: "general",
          status: "under_review",
          payment_intent: "pi_ghost",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    const [, error] = mocks.captureServerError.mock.calls[0]!
    expect((error as Error).message).toBe(
      "litige sans transaction correspondante",
    )
  })

  it("échec DB sur un événement de litige → 500 (retry Stripe)", async () => {
    mocks.recordDispute.mockRejectedValueOnce(new Error("Neon down"))
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute_db",
      type: "charge.dispute.updated",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "under_review",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(500)
  })

  it("radar.early_fraud_warning.created → alerte avec charge et payment_intent, 200", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_efw",
      type: "radar.early_fraud_warning.created",
      data: {
        object: {
          id: "issfr_1",
          charge: "ch_1",
          fraud_type: "made_with_stolen_card",
          actionable: true,
          payment_intent: "pi_efw",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).not.toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.any(Error),
      {
        detail:
          "efw issfr_1 · charge ch_1 · type made_with_stolen_card · payment_intent pi_efw · remboursement proactif à envisager",
      },
    )
  })
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test tests/features/stripe-webhook-errors.test.ts`
Expected: les nouveaux tests échouent (`recordDispute` jamais appelé, événements acquittés sans traitement).

- [ ] **Step 3 : Implémenter dans la route**

Dans `app/api/stripe/webhook/route.ts`, remplacer l'import du DAL par :

```ts
import {
  completeStripeTransaction,
  failStripeTransaction,
  recordStripeDispute,
} from "@/features/payments/stripe"
```

Remplacer tout le bloc `case "charge.dispute.created": { … break }` par :

```ts
      // Un litige prélève la somme + des frais et ouvre une fenêtre de réponse
      // limitée : sans alerte, elle se referme sans que personne ne l'ait vue.
      // Traitement humain (aucune révocation automatique d'accès : couper
      // l'accès affaiblirait la position « service livré et utilisé »).
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_reinstated": {
        const dispute = event.data.object as Stripe.Dispute
        // Le `payment_intent` est la SEULE clé qui relie le litige à un client :
        // il rejoint `transactions.stripe_payment_intent_id`.
        const disputedPaymentIntent =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id
        const detail = `dispute ${dispute.id} · ${dispute.amount} ${dispute.currency} · motif ${dispute.reason} · statut ${dispute.status} · payment_intent ${disputedPaymentIntent ?? "absent"}`

        if (disputedPaymentIntent) {
          const recorded = await recordStripeDispute({
            stripePaymentIntentId: disputedPaymentIntent,
            stripeDisputeId: dispute.id,
            disputeStatus: dispute.status,
          })
          if (recorded.status === "not_found") {
            captureServerError(
              "[stripe:webhook]",
              new Error("litige sans transaction correspondante"),
              { detail },
            )
            break
          }
        }

        if (event.type === "charge.dispute.created") {
          captureServerError(
            "[stripe:webhook]",
            new Error("litige ouvert sur un paiement Stripe"),
            { detail },
          )
        } else if (event.type === "charge.dispute.closed") {
          const outcome =
            dispute.status === "won"
              ? "litige gagné"
              : dispute.status === "lost"
                ? "litige perdu"
                : "litige clos"
          captureServerError("[stripe:webhook]", new Error(outcome), {
            detail,
          })
        } else if (event.type === "charge.dispute.funds_reinstated") {
          captureServerError(
            "[stripe:webhook]",
            new Error("fonds restitués après litige"),
            { detail },
          )
        }
        break
      }

      // Signal des réseaux AVANT le litige : Stripe indique que 80 % des EFW
      // deviennent un litige si rien n'est fait. Rembourser proactivement évite
      // les frais de litige et le coup au taux de litige.
      case "radar.early_fraud_warning.created": {
        const warning = event.data.object as Stripe.Radar.EarlyFraudWarning
        const chargeId =
          typeof warning.charge === "string" ? warning.charge : warning.charge.id
        const paymentIntent =
          typeof warning.payment_intent === "string"
            ? warning.payment_intent
            : warning.payment_intent?.id
        captureServerError(
          "[stripe:webhook]",
          new Error("signal de fraude avant litige (early fraud warning)"),
          {
            detail: `efw ${warning.id} · charge ${chargeId} · type ${warning.fraud_type} · payment_intent ${paymentIntent ?? "absent"} · remboursement proactif à envisager`,
          },
        )
        break
      }
```

- [ ] **Step 4 : Lancer les tests**

Run: `bun run test tests/features/stripe-webhook-errors.test.ts`
Expected: tous verts.

- [ ] **Step 5 : Vérification complète et commit**

Run: `bun run check`
Expected: prettier, tsc et eslint sans erreur.

```bash
git add app/api/stripe/webhook/route.ts tests/features/stripe-webhook-errors.test.ts
git commit -m "feat(payments): cycle de vie du litige et early fraud warning dans le webhook"
```

---

### Task 4 : Paramètres de session Checkout

**Files:**
- Modify: `features/payments/actions.ts` (`createStripeCheckout`)
- Test: `tests/features/payments-actions.test.ts`

- [ ] **Step 1 : Écrire le test (échoue)**

Dans `tests/features/payments-actions.test.ts`, ajouter `name: "Accès examens",` à la constante `ACTIVE_PRODUCT` (juste avant `priceCad: 5000,`). Puis, dans `describe("createStripeCheckout", …)`, ajouter :

```ts
  it("reçu garanti, CGU obligatoires et 3DS demandé sur chaque session", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout(input)

    expect(mocks.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // `receipt_email` posé sur le PaymentIntent : Stripe envoie alors un
        // reçu en live quel que soit le réglage « Paiements réussis ».
        payment_intent_data: {
          receipt_email: "u1@test.invalid",
          description: "Accès examens",
        },
        consent_collection: { terms_of_service: "required" },
        payment_method_options: {
          card: { request_three_d_secure: "any" },
        },
      }),
    )
  })
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test tests/features/payments-actions.test.ts`
Expected: le nouveau test échoue (paramètres absents).

- [ ] **Step 3 : Implémenter**

Dans `features/payments/actions.ts`, `createStripeCheckout` : ajouter `name: products.name,` dans le `select` du produit (après `id: products.id,`). Puis dans l'appel `stripe.checkout.sessions.create({ … })`, après `customer_creation: "always",` :

```ts
      // Reçu Stripe indépendant du toggle Dashboard « Paiements réussis » :
      // un `receipt_email` sur le PaymentIntent déclenche l'envoi en live.
      payment_intent_data: {
        receipt_email: session.user.email,
        description: product.name,
      },
      // Case CGU au checkout : preuve que Stripe recommande dans un dossier
      // de litige. Exige l'URL des CGU dans les informations publiques du
      // compte, sinon Stripe REFUSE la création de session.
      consent_collection: { terms_of_service: "required" },
      // 3DS demandé sur chaque paiement carte (préférence frictionless, la
      // banque décide). Un litige « fraudulent » sur un paiement authentifié
      // retombe sur la banque. Clause de sortie : retirer si la conversion
      // du checkout chute.
      payment_method_options: {
        card: { request_three_d_secure: "any" },
      },
```

- [ ] **Step 4 : Lancer les tests**

Run: `bun run test tests/features/payments-actions.test.ts`
Expected: tous verts.

- [ ] **Step 5 : Commit**

```bash
git add features/payments/actions.ts tests/features/payments-actions.test.ts
git commit -m "feat(payments): reçu garanti, CGU et 3DS sur la session Checkout"
```

---

### Task 5 : Badge « Litige » dans l'admin

**Files:**
- Modify: `features/payments/dal.ts` (`AdminTransactionView`, `getAllTransactions`)
- Create: `components/shared/payments/dispute-badge.ts`
- Modify: `components/shared/payments/transaction-table.tsx`
- Test: `tests/components/payments/dispute-badge.test.ts`, `tests/integration/payments-admin-dal.test.ts`

- [ ] **Step 1 : Test unitaire du badge (échoue)**

Créer `tests/components/payments/dispute-badge.test.ts` :

```ts
import { describe, expect, it } from "vitest"
import { disputeBadge } from "@/components/shared/payments/dispute-badge"

describe("disputeBadge", () => {
  it("aucun litige → pas de badge", () => {
    expect(disputeBadge(null)).toBeNull()
    expect(disputeBadge(undefined)).toBeNull()
  })

  it("litige en cours → rouge, quel que soit le statut non terminal", () => {
    for (const status of [
      "needs_response",
      "under_review",
      "warning_needs_response",
      "warning_under_review",
    ]) {
      expect(disputeBadge(status)).toEqual({
        label: "Litige en cours",
        tone: "danger",
      })
    }
  })

  it("gagné → vert, perdu → gris, enquête close → gris", () => {
    expect(disputeBadge("won")).toEqual({ label: "Litige gagné", tone: "success" })
    expect(disputeBadge("lost")).toEqual({ label: "Litige perdu", tone: "muted" })
    expect(disputeBadge("warning_closed")).toEqual({
      label: "Enquête close",
      tone: "muted",
    })
  })

  it("statut inconnu → rouge (mieux vaut un faux « en cours » qu'un litige invisible)", () => {
    expect(disputeBadge("statut_futur")).toEqual({
      label: "Litige en cours",
      tone: "danger",
    })
  })
})
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test tests/components/payments/dispute-badge.test.ts`
Expected: échec, module introuvable.

- [ ] **Step 3 : Implémenter la logique pure**

Créer `components/shared/payments/dispute-badge.ts` :

```ts
export type DisputeBadge = {
  label: string
  tone: "danger" | "success" | "muted"
}

/**
 * Libellé et ton du badge de litige. Un statut inconnu est traité comme « en
 * cours » : Stripe peut ajouter des statuts, et un litige invisible coûte plus
 * cher qu'un badge rouge de trop.
 */
export const disputeBadge = (
  status: string | null | undefined,
): DisputeBadge | null => {
  if (!status) return null
  switch (status) {
    case "won":
      return { label: "Litige gagné", tone: "success" }
    case "lost":
      return { label: "Litige perdu", tone: "muted" }
    case "warning_closed":
      return { label: "Enquête close", tone: "muted" }
    default:
      return { label: "Litige en cours", tone: "danger" }
  }
}
```

- [ ] **Step 4 : Lancer le test unitaire**

Run: `bun run test tests/components/payments/dispute-badge.test.ts`
Expected: vert.

- [ ] **Step 5 : Exposer `disputeStatus` dans le DAL admin (test d'intégration d'abord)**

Dans `tests/integration/payments-admin-dal.test.ts`, repérer le test existant qui appelle `getAllTransactions` et vérifie les items (chercher `getAllTransactions(`). Ajouter un test dans le même `describe` :

```ts
  it("expose le statut de litige de chaque transaction", async () => {
    await db
      .update(transactions)
      .set({ stripeDisputeId: "dp_admin", disputeStatus: "needs_response" })
      .where(eq(transactions.id, txCadStripeRecent))

    const page = await getAllTransactions({ userId: uid, limit: 50 })
    const disputed = page.items.find((t) => t.id === txCadStripeRecent)
    const clean = page.items.find((t) => t.id === txCadManualOld)

    expect(disputed?.disputeStatus).toBe("needs_response")
    expect(clean?.disputeStatus).toBeNull()
  })
```

Puis dans `features/payments/dal.ts` :

Dans `AdminTransactionView`, après `notes: string | null` :

```ts
  /** Statut Stripe brut du litige, null sans litige. */
  disputeStatus: string | null
```

Dans le `select` de `getAllTransactions`, après `notes: transactions.notes,` :

```ts
      disputeStatus: transactions.disputeStatus,
```

Dans le `map` vers `items`, après `notes: r.notes,` :

```ts
    disputeStatus: r.disputeStatus,
```

Run: `bun run type-check`
Expected: erreurs là où `AdminTransactionView` est construit à la main (tests ou mocks) : ajouter `disputeStatus: null` à chaque objet signalé, puis 0 erreur.

Run: `bun run test:integration tests/integration/payments-admin-dal.test.ts`
Expected: vert.

- [ ] **Step 6 : Afficher le badge dans la table**

Dans `components/shared/payments/transaction-table.tsx` :

Ajouter l'import :

```ts
import { disputeBadge } from "./dispute-badge"
```

Dans l'interface `Transaction`, après `notes?: string | null` :

```ts
  disputeStatus?: string | null
```

Dans `adminTransactionToRow`, après `notes: tx.notes,` :

```ts
  disputeStatus: tx.disputeStatus,
```

Après le composant `TypeBadge`, ajouter :

```tsx
const disputeToneClass = {
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  success:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  muted: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
} as const

const DisputeBadge = ({ status }: { status: string | null | undefined }) => {
  const badge = disputeBadge(status)
  if (!badge) return null
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        disputeToneClass[badge.tone],
      )}
    >
      {badge.label}
    </span>
  )
}
```

Dans le rendu de la ligne, remplacer :

```tsx
                <TableCell>
                  <StatusBadge status={transaction.status} />
                </TableCell>
```

par :

```tsx
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={transaction.status} />
                    <DisputeBadge status={transaction.disputeStatus} />
                  </div>
                </TableCell>
```

- [ ] **Step 7 : Vérification et commit**

Run: `bun run check && bun run test`
Expected: tout vert.

```bash
git add features/payments/dal.ts components/shared/payments/dispute-badge.ts components/shared/payments/transaction-table.tsx tests/components/payments/dispute-badge.test.ts tests/integration/payments-admin-dal.test.ts
git commit -m "feat(admin): badge de litige sur les transactions"
```

---

### Task 6 : Vérifications Dashboard Stripe et test manuel du lot 1

**Files:** aucun (Dashboard Stripe + navigateur). Tâche à faire par l'utilisateur, l'agent guide.

- [ ] **Step 1 : Informations publiques** — Dashboard → Réglages → Informations publiques : nom commercial, courriel de support, URL du site, **URL des conditions d'utilisation**, URL de politique de confidentialité. Sans l'URL des CGU, la création de session échoue en test comme en live (réglage partagé).

- [ ] **Step 2 : Courriels aux clients** — Réglages → Courriels aux clients → « Paiements réussis » activé.

- [ ] **Step 3 : Endpoint webhook de production** — Développeurs → Webhooks → endpoint `/api/stripe/webhook` : cocher `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_reinstated`, `radar.early_fraud_warning.created` (fait le 2026-09-02, à re-vérifier).

- [ ] **Step 4 : Test manuel en mode test** (l'utilisateur lance `bun dev` et `stripe listen --forward-to localhost:<port>/api/stripe/webhook`) :
  1. Acheter un produit avec la carte `4242 4242 4242 4242` : la page Checkout affiche la case CGU ; après paiement, la charge dans le Dashboard test a `receipt_email` renseigné et la description du produit.
  2. Acheter avec la carte `4000 0000 0000 0259` : un litige est créé ; le terminal `stripe listen` montre `charge.dispute.created` en 200 ; la transaction porte le badge « Litige en cours » dans `/admin/transactions`.
  3. Dans le Dashboard test, contester ce litige avec le texte libre `winning_evidence` : `charge.dispute.closed` arrive, le badge passe à « Litige gagné ».
  4. Acheter avec la carte `4000 0000 0000 5423` : `radar.early_fraud_warning.created` arrive en 200 et la console serveur affiche l'alerte EFW.

---

## Lot 2 — Confirmation d'achat et preuve d'envoi

### Task 7 : Gabarit et fonction d'envoi

**Files:**
- Create: `email/templates/purchase-confirmation-email.tsx`
- Modify: `email/index.tsx`
- Test: `tests/email/templates.test.ts`, `tests/email/index.test.ts`

- [ ] **Step 1 : Tests (échouent)**

Dans `tests/email/templates.test.ts`, ajouter l'import :

```ts
import { PurchaseConfirmationEmail } from "@/email/templates/purchase-confirmation-email"
```

et le test :

```ts
  it("purchase confirmation email : produit, montant, libellé de relevé et fin d'accès", async () => {
    const html = await render(
      createElement(PurchaseConfirmationEmail, {
        productName: "Accès examens — 90 jours",
        amountLabel: "200,00 $",
        presentmentLabel: "228 000 FCFA",
        purchasedAtLabel: "2 septembre 2026",
        accessExpiresAtLabel: "1 décembre 2026",
        accountUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
      }),
    )
    expect(html).toContain("Accès examens — 90 jours")
    expect(html).toContain("200,00 $")
    expect(html).toContain("228 000 FCFA")
    expect(html).toContain("NOMAQBANQ")
    expect(html).toContain("1 décembre 2026")
    expect(html).toContain("https://nomaqbanq.ca/tableau-de-bord/abonnements")
  })

  it("purchase confirmation email : sans montant local, aucune mention de conversion", async () => {
    const html = await render(
      createElement(PurchaseConfirmationEmail, {
        productName: "Accès examens — 90 jours",
        amountLabel: "200,00 $",
        presentmentLabel: null,
        purchasedAtLabel: "2 septembre 2026",
        accessExpiresAtLabel: "1 décembre 2026",
        accountUrl: "https://nomaqbanq.ca/tableau-de-bord/abonnements",
      }),
    )
    expect(html).not.toContain("soit environ")
  })
```

Dans `tests/email/index.test.ts`, ajouter `sendPurchaseConfirmationEmail` à l'import depuis `@/email` et le test :

```ts
  it("sendPurchaseConfirmationEmail formate montants et dates en français", async () => {
    const messageId = await sendPurchaseConfirmationEmail({
      to: "u@x.com",
      productName: "Accès examens",
      amountPaid: 20000,
      currency: "CAD",
      presentmentAmount: 9120000,
      presentmentCurrency: "XAF",
      purchasedAt: new Date("2026-09-02T14:00:00Z"),
      accessExpiresAt: new Date("2026-12-01T14:00:00Z"),
    })
    expect(messageId).toBe("msg-1")
    const arg = firstArg()
    expect(arg.to).toBe("u@x.com")
    expect(arg.subject).toBe("Confirmation de votre achat — NOMAQbanq")
    const props = (arg.react as { props: Record<string, unknown> }).props
    expect(props.amountLabel).toBe("200 $")
    // Le symbole (« XAF » ou « FCFA ») dépend des données ICU du runtime :
    // on ne vérifie que la valeur.
    expect(props.presentmentLabel).toContain("91")
    expect(props.purchasedAtLabel).toBe("2 septembre 2026")
    expect(props.accessExpiresAtLabel).toBe("1 décembre 2026")
    expect(props.accountUrl).toMatch(/\/tableau-de-bord\/abonnements$/)
  })
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test tests/email`
Expected: échecs (module et fonction absents).

- [ ] **Step 3 : Créer le gabarit**

Créer `email/templates/purchase-confirmation-email.tsx` :

```tsx
import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

const row = { fontSize: "14px", color: "#18181b", margin: "4px 0" } as const

export function PurchaseConfirmationEmail({
  productName,
  amountLabel,
  presentmentLabel,
  purchasedAtLabel,
  accessExpiresAtLabel,
  accountUrl,
}: {
  productName: string
  amountLabel: string
  presentmentLabel: string | null
  purchasedAtLabel: string
  accessExpiresAtLabel: string
  accountUrl: string
}) {
  return (
    <EmailLayout preview={`Votre achat : ${productName}`}>
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Merci pour votre achat. Voici le récapitulatif de votre commande.
        </Text>
        <Text style={row}>
          <strong>Produit :</strong> {productName}
        </Text>
        <Text style={row}>
          <strong>Montant :</strong> {amountLabel}
          {presentmentLabel ? ` (soit environ ${presentmentLabel})` : ""}
        </Text>
        <Text style={row}>
          <strong>Date :</strong> {purchasedAtLabel}
        </Text>
        <Text style={row}>
          <strong>Accès valide jusqu&apos;au :</strong> {accessExpiresAtLabel}
        </Text>
        <Text style={{ fontSize: "13px", color: "#52525b", marginTop: "16px" }}>
          Cette transaction apparaîtra sous le libellé <strong>NOMAQBANQ</strong>{" "}
          sur votre relevé bancaire. Un reçu Stripe vous est envoyé séparément.
        </Text>
        <Button
          href={accountUrl}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Voir mes accès
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien : <Link href={accountUrl}>{accountUrl}</Link>
        </Text>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Une question sur cet achat ? Répondez à ce courriel avant toute
          démarche auprès de votre banque : nous réglons la plupart des
          demandes le jour même.
        </Text>
      </Section>
    </EmailLayout>
  )
}
```

- [ ] **Step 4 : Ajouter la fonction d'envoi**

Dans `email/index.tsx`, ajouter les imports :

```ts
import { getBaseUrl } from "@/lib/base-url"
import {
  formatCurrency,
  formatExpiration,
  formatPresentmentAmount,
} from "@/lib/format"
import { PurchaseConfirmationEmail } from "./templates/purchase-confirmation-email"
```

et en fin de fichier :

```tsx
export function sendPurchaseConfirmationEmail({
  to,
  productName,
  amountPaid,
  currency,
  presentmentAmount,
  presentmentCurrency,
  purchasedAt,
  accessExpiresAt,
}: {
  to: string
  productName: string
  /** Centièmes, devise d'encaissement. */
  amountPaid: number
  currency: "CAD" | "XAF"
  /** Unités mineures de la devise locale (Adaptive Pricing), null sans conversion. */
  presentmentAmount: number | null
  presentmentCurrency: string | null
  purchasedAt: Date
  accessExpiresAt: Date
}) {
  const presentmentLabel =
    presentmentAmount != null && presentmentCurrency
      ? formatPresentmentAmount(presentmentAmount, presentmentCurrency)
      : null
  return sendEmail({
    to,
    subject: "Confirmation de votre achat — NOMAQbanq",
    react: (
      <PurchaseConfirmationEmail
        productName={productName}
        amountLabel={formatCurrency(amountPaid, currency)}
        presentmentLabel={presentmentLabel}
        purchasedAtLabel={formatExpiration(purchasedAt.getTime())}
        accessExpiresAtLabel={formatExpiration(accessExpiresAt.getTime())}
        accountUrl={`${getBaseUrl()}/tableau-de-bord/abonnements`}
      />
    ),
  })
}
```

Si `tests/email/index.test.ts` échoue sur `getBaseUrl` (variable d'env absente en test), ajouter en tête du fichier de test :

```ts
vi.mock("@/lib/base-url", () => ({ getBaseUrl: () => "https://nomaqbanq.ca" }))
```

- [ ] **Step 5 : Lancer les tests**

Run: `bun run test tests/email`
Expected: tous verts.

- [ ] **Step 6 : Commit**

```bash
git add email/templates/purchase-confirmation-email.tsx email/index.tsx tests/email
git commit -m "feat(email): courriel de confirmation d'achat"
```

---

### Task 8 : Fulfillment enrichi + `markConfirmationEmailSent`

**Files:**
- Modify: `features/payments/stripe.ts`
- Test: `tests/integration/payments-stripe.test.ts`

- [ ] **Step 1 : Tests (échouent)**

Dans `tests/integration/payments-stripe.test.ts`, ajouter `markConfirmationEmailSent` à l'import du DAL, puis dans `describe("completeStripeTransaction", …)` :

```ts
  it("completed → retourne les données du courriel de confirmation", async () => {
    const tx = createId()
    await seedPending({
      id: tx,
      userId: U_HAPPY,
      productId: PEXAM,
      sessionId: `cs_confirm_${tx}`,
      accessType: "exam",
      durationDays: 90,
    })

    const result = await completeStripeTransaction({
      stripeSessionId: `cs_confirm_${tx}`,
      stripePaymentIntentId: `pi_${tx}`,
      stripeEventId: `evt_confirm_${tx}`,
      amountTotal: 5000,
      currency: "cad",
      presentmentAmount: 2280000,
      presentmentCurrency: "xaf",
    })

    expect(result.status).toBe("completed")
    if (result.status !== "completed") return
    expect(result.confirmation.userEmail).toMatch(/@test\.invalid$/)
    expect(result.confirmation.productName).toBe(`Exam ${suffix}`)
    expect(result.confirmation.amountPaid).toBe(5000)
    expect(result.confirmation.currency).toBe("CAD")
    expect(result.confirmation.presentmentAmount).toBe(2280000)
    expect(result.confirmation.presentmentCurrency).toBe("XAF")
    expect(result.confirmation.accessExpiresAt).toBeInstanceOf(Date)
    expect(result.confirmation.completedAt).toBeInstanceOf(Date)
  })
```

et un nouveau `describe` en fin de fichier :

```ts
describe("markConfirmationEmailSent", () => {
  it("pose le MessageId et l'horodatage d'envoi", async () => {
    const tx = createId()
    await seedPending({
      id: tx,
      userId: U_HAPPY,
      productId: PEXAM,
      sessionId: `cs_mail_${tx}`,
      accessType: "exam",
      durationDays: 90,
    })

    await markConfirmationEmailSent({ transactionId: tx, messageId: "ses-123" })

    const [row] = await db
      .select({
        messageId: transactions.confirmationEmailMessageId,
        sentAt: transactions.confirmationEmailSentAt,
      })
      .from(transactions)
      .where(eq(transactions.id, tx))
      .limit(1)
    expect(row.messageId).toBe("ses-123")
    expect(row.sentAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test:integration tests/integration/payments-stripe.test.ts`
Expected: échec de compilation (`confirmation` absent du type, fonction absente).

- [ ] **Step 3 : Implémenter**

Dans `features/payments/stripe.ts` :

Remplacer le type de résultat :

```ts
export type PurchaseConfirmationData = {
  userEmail: string
  productName: string
  amountPaid: number
  currency: "CAD" | "XAF"
  presentmentAmount: number | null
  presentmentCurrency: string | null
  completedAt: Date
  accessExpiresAt: Date
}

export type CompleteStripeResult =
  | {
      status: "completed"
      transactionId: string
      confirmation: PurchaseConfirmationData
    }
  | { status: "already_processed" }
  | { status: "not_found" }
```

Dans `completeStripeTransaction`, la lecture du `pending` doit aussi ramener les montants provisoires : ajouter à son `select` :

```ts
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
```

Remplacer le verrou utilisateur (qui ne lisait que `id`) par :

```ts
    // Verrou utilisateur : sérialise octrois/révocations concurrents. Le
    // courriel du compte est lu ici, sous le même verrou, pour le courriel
    // de confirmation.
    const [lockedUser] = await tx
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, pending.userId))
      .for("update")
```

Remplacer le `select` du produit par :

```ts
    const [product] = await tx
      .select({ isCombo: products.isCombo, name: products.name })
      .from(products)
      .where(eq(products.id, pending.productId))
      .limit(1)
    const isCombo = product?.isCombo ?? false
```

Remplacer le `return { status: "completed", transactionId: pending.id }` final par :

```ts
    return {
      status: "completed",
      transactionId: pending.id,
      confirmation: {
        userEmail: lockedUser?.email ?? "",
        productName: product?.name ?? "Accès NOMAQbanq",
        amountPaid: reconcile?.amountPaid ?? pending.amountPaid,
        currency: reconcile?.currency ?? pending.currency,
        presentmentAmount: presentment?.presentmentAmount ?? null,
        presentmentCurrency: presentment?.presentmentCurrency ?? null,
        completedAt: now,
        accessExpiresAt: txAccessExpiresAt,
      },
    }
```

Ajouter en fin de fichier :

```ts
/** Trace d'envoi du courriel de confirmation (corrélation avec le journal SES). */
export async function markConfirmationEmailSent(params: {
  transactionId: string
  messageId: string
}): Promise<void> {
  await db
    .update(transactions)
    .set({
      confirmationEmailMessageId: params.messageId,
      confirmationEmailSentAt: new Date(),
    })
    .where(eq(transactions.id, params.transactionId))
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `bun run test:integration tests/integration/payments-stripe.test.ts`
Expected: tous verts (les tests existants sur `completed` restent valides : ils ne lisent que `status` et `transactionId`).

- [ ] **Step 5 : Type-check et commit**

Run: `bun run type-check`
Expected: 0 erreur (le webhook ignore encore `confirmation`, c'est la tâche suivante).

```bash
git add features/payments/stripe.ts tests/integration/payments-stripe.test.ts
git commit -m "feat(payments): données de confirmation au fulfillment et trace d'envoi"
```

---

### Task 9 : Envoi best-effort depuis le webhook

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Test: `tests/features/stripe-webhook-errors.test.ts`

- [ ] **Step 1 : Tests (échouent)**

Dans `tests/features/stripe-webhook-errors.test.ts` :

Dans `vi.hoisted`, ajouter :

```ts
    sendPurchaseConfirmationEmail: vi.fn<() => Promise<string>>(),
    markConfirmationEmailSent: vi.fn<() => Promise<void>>(),
```

Dans `vi.mock("@/features/payments/stripe", …)`, ajouter :

```ts
  markConfirmationEmailSent: mocks.markConfirmationEmailSent,
```

Ajouter un mock du module courriel :

```ts
vi.mock("@/email", () => ({
  sendPurchaseConfirmationEmail: mocks.sendPurchaseConfirmationEmail,
}))
```

Dans `beforeEach`, remplacer la valeur par défaut de `completeStripeTransaction` par :

```ts
  mocks.completeStripeTransaction.mockResolvedValue({
    status: "completed",
    transactionId: "tx_1",
    confirmation: {
      userEmail: "u@test.invalid",
      productName: "Accès examens",
      amountPaid: 20000,
      currency: "CAD",
      presentmentAmount: null,
      presentmentCurrency: null,
      completedAt: new Date("2026-09-02T14:00:00Z"),
      accessExpiresAt: new Date("2026-12-01T14:00:00Z"),
    },
  })
  mocks.sendPurchaseConfirmationEmail.mockResolvedValue("ses-msg-1")
  mocks.markConfirmationEmailSent.mockResolvedValue(undefined)
```

Ajouter un `describe` :

```ts
describe("webhook Stripe — courriel de confirmation", () => {
  const paidEvent = (id: string) => ({
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${id}`,
        payment_status: "paid",
        payment_intent: `pi_${id}`,
        amount_total: 20000,
        currency: "cad",
      },
    },
  })

  it("fulfillment completed → courriel envoyé et MessageId enregistré", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce(paidEvent("evt_mail"))
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.sendPurchaseConfirmationEmail).toHaveBeenCalledWith({
      to: "u@test.invalid",
      productName: "Accès examens",
      amountPaid: 20000,
      currency: "CAD",
      presentmentAmount: null,
      presentmentCurrency: null,
      purchasedAt: new Date("2026-09-02T14:00:00Z"),
      accessExpiresAt: new Date("2026-12-01T14:00:00Z"),
    })
    expect(mocks.markConfirmationEmailSent).toHaveBeenCalledWith({
      transactionId: "tx_1",
      messageId: "ses-msg-1",
    })
  })

  it("already_processed → aucun courriel (un seul envoi par achat)", async () => {
    mocks.completeStripeTransaction.mockResolvedValueOnce({
      status: "already_processed",
    })
    mocks.constructEventAsync.mockResolvedValueOnce(paidEvent("evt_replay"))
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.sendPurchaseConfirmationEmail).not.toHaveBeenCalled()
  })

  // L'accès est déjà commité quand le courriel part : un 500 ferait rejouer
  // un fulfillment idempotent pour rien, et un client resterait sans courriel
  // de toute façon. Sentry est la seule trace.
  it("échec SES → capture Sentry, réponse 200 conservée", async () => {
    mocks.sendPurchaseConfirmationEmail.mockRejectedValueOnce(
      new Error("SES down"),
    )
    mocks.constructEventAsync.mockResolvedValueOnce(paidEvent("evt_ses_ko"))
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.any(Error),
      { detail: "courriel de confirmation non envoyé · transaction tx_1" },
    )
    expect(mocks.markConfirmationEmailSent).not.toHaveBeenCalled()
  })

  it("échec de l'écriture du MessageId → capture, 200 (le courriel est parti)", async () => {
    mocks.markConfirmationEmailSent.mockRejectedValueOnce(new Error("Neon"))
    mocks.constructEventAsync.mockResolvedValueOnce(paidEvent("evt_mark_ko"))
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.captureServerError).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test tests/features/stripe-webhook-errors.test.ts`
Expected: les 4 nouveaux tests échouent (aucun envoi).

- [ ] **Step 3 : Implémenter**

Dans `app/api/stripe/webhook/route.ts` :

Ajouter aux imports :

```ts
import { sendPurchaseConfirmationEmail } from "@/email"
import {
  type CompleteStripeResult,
  completeStripeTransaction,
  failStripeTransaction,
  markConfirmationEmailSent,
  recordStripeDispute,
} from "@/features/payments/stripe"
```

(remplacer l'import existant de `@/features/payments/stripe`.)

Ajouter avant `export async function POST` :

```ts
/**
 * Courriel de confirmation, en best-effort : l'accès est déjà COMMITÉ quand
 * on arrive ici. Un échec ne doit ni changer le code de réponse (un 500
 * ferait rejouer un fulfillment idempotent pour rien) ni bloquer l'octroi.
 * Le reçu Stripe (`receipt_email`) part de son côté : le client n'est jamais
 * sans trace. Sentry est la seule trace de l'échec.
 */
const sendConfirmation = async (
  result: Extract<CompleteStripeResult, { status: "completed" }>,
) => {
  try {
    const c = result.confirmation
    const messageId = await sendPurchaseConfirmationEmail({
      to: c.userEmail,
      productName: c.productName,
      amountPaid: c.amountPaid,
      currency: c.currency,
      presentmentAmount: c.presentmentAmount,
      presentmentCurrency: c.presentmentCurrency,
      purchasedAt: c.completedAt,
      accessExpiresAt: c.accessExpiresAt,
    })
    await markConfirmationEmailSent({
      transactionId: result.transactionId,
      messageId,
    })
  } catch (error) {
    captureServerError("[stripe:webhook]", error, {
      detail: `courriel de confirmation non envoyé · transaction ${result.transactionId}`,
    })
  }
}
```

Dans le `case "checkout.session.completed"`, après le bloc `if (result.status === "not_found") { … }`, ajouter :

```ts
          if (result.status === "completed") {
            await sendConfirmation(result)
          }
```

- [ ] **Step 4 : Lancer les tests**

Run: `bun run test tests/features/stripe-webhook-errors.test.ts`
Expected: tous verts.

- [ ] **Step 5 : Vérification complète et commit**

Run: `bun run check && bun run test`
Expected: tout vert.

```bash
git add app/api/stripe/webhook/route.ts tests/features/stripe-webhook-errors.test.ts
git commit -m "feat(payments): courriel de confirmation best-effort après le fulfillment"
```

---

### Task 10 : Journal SES → EventBridge → CloudWatch Logs

**Files:** aucun dans le dépôt. Exécuté par l'agent via le MCP `aws-mcp` (profil `claude-ops`, `us-east-2`). Chaque étape lit avant d'écrire et est idempotente.

- [ ] **Step 1 : Groupe de logs + rétention**

```python
async def main():
    region, group = "us-east-2", "/aws/events/nomaqbanq-ses"
    existing = await call_boto3(service_name="logs", operation_name="DescribeLogGroups",
        region_name=region, params={"logGroupNamePrefix": group})
    if not any(g["logGroupName"] == group for g in existing.get("logGroups", [])):
        await call_boto3(service_name="logs", operation_name="CreateLogGroup",
            region_name=region, params={"logGroupName": group})
    await call_boto3(service_name="logs", operation_name="PutRetentionPolicy",
        region_name=region, params={"logGroupName": group, "retentionInDays": 400})
    return {"ok": True}
result = await main(); result
```

Expected: `{"ok": true}` ; `DescribeLogGroups` ensuite montre `retentionInDays: 400`.

- [ ] **Step 2 : Policy de ressource CloudWatch Logs pour EventBridge**

```python
async def main():
    region = "us-east-2"
    policy = json.dumps({"Version": "2012-10-17", "Statement": [{
        "Sid": "TrustEventsToStoreLogEvent",
        "Effect": "Allow",
        "Principal": {"Service": ["events.amazonaws.com", "delivery.logs.amazonaws.com"]},
        "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
        "Resource": "arn:aws:logs:us-east-2:710353053639:log-group:/aws/events/*:*"}]})
    r = await call_boto3(service_name="logs", operation_name="PutResourcePolicy",
        region_name=region, params={"policyName": "EventBridgeToCWLogsPolicy", "policyDocument": policy})
    return {"policyName": r["resourcePolicy"]["policyName"]}
result = await main(); result
```

Expected: `{"policyName": "EventBridgeToCWLogsPolicy"}`.

- [ ] **Step 3 : Règle EventBridge + cible**

```python
async def main():
    region = "us-east-2"
    rule = await call_boto3(service_name="events", operation_name="PutRule", region_name=region,
        params={"Name": "nomaqbanq-ses-events", "EventPattern": json.dumps({"source": ["aws.ses"]}),
                "State": "ENABLED", "Description": "Journal des événements SES (send/delivery/bounce/complaint)"})
    targets = await call_boto3(service_name="events", operation_name="PutTargets", region_name=region,
        params={"Rule": "nomaqbanq-ses-events", "Targets": [{
            "Id": "cwlogs", "Arn": "arn:aws:logs:us-east-2:710353053639:log-group:/aws/events/nomaqbanq-ses"}]})
    return {"ruleArn": rule["RuleArn"], "failed": targets.get("FailedEntryCount")}
result = await main(); result
```

Expected: `failed: 0`.

- [ ] **Step 4 : Destination d'événements SES**

```python
async def main():
    region, cs = "us-east-2", "nomaqbanq-transactional"
    current = await call_boto3(service_name="sesv2", operation_name="GetConfigurationSetEventDestinations",
        region_name=region, params={"ConfigurationSetName": cs})
    names = [d["Name"] for d in current.get("EventDestinations", [])]
    definition = {"Enabled": True,
        "MatchingEventTypes": ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "REJECT", "RENDERING_FAILURE"],
        "EventBridgeDestination": {"EventBusArn": "arn:aws:events:us-east-2:710353053639:event-bus/default"}}
    op = "UpdateConfigurationSetEventDestination" if "nomaqbanq-eventbridge" in names else "CreateConfigurationSetEventDestination"
    await call_boto3(service_name="sesv2", operation_name=op, region_name=region,
        params={"ConfigurationSetName": cs, "EventDestinationName": "nomaqbanq-eventbridge", "EventDestination": definition})
    after = await call_boto3(service_name="sesv2", operation_name="GetConfigurationSetEventDestinations",
        region_name=region, params={"ConfigurationSetName": cs})
    return {"op": op, "destinations": [{"Name": d["Name"], "Enabled": d["Enabled"], "Types": d["MatchingEventTypes"]} for d in after["EventDestinations"]]}
result = await main(); result
```

Expected: une destination `nomaqbanq-eventbridge`, `Enabled: true`, six types.

- [ ] **Step 5 : Vérification de bout en bout**

L'utilisateur déclenche un envoi réel depuis l'app en dev (par exemple « mot de passe oublié » sur son compte, `EMAIL_OVERRIDE_TO` redirige en sandbox) et communique l'heure. Puis :

```python
async def main():
    r = await call_boto3(service_name="logs", operation_name="FilterLogEvents", region_name="us-east-2",
        params={"logGroupName": "/aws/events/nomaqbanq-ses", "limit": 20,
                "startTime": int((time.time() - 900) * 1000)})
    return [{"ts": e["timestamp"], "msg": e["message"][:300]} for e in r.get("events", [])]
result = await main(); result
```

Expected: au moins un événement `Send` puis `Delivery` portant le `messageId` et le destinataire, aucun corps de courriel.

- [ ] **Step 6 : Note dans les règles** (voir Task 12).

---

## Lot 3 — Script `dispute:evidence`

### Task 11 : Script de lecture seule et son test

**Files:**
- Create: `scripts/dispute-evidence.ts`
- Test: `tests/scripts/dispute-evidence.test.ts`
- Modify: `package.json` (scripts), `.gitignore`

- [ ] **Step 1 : Test du formatage (échoue)**

Créer `tests/scripts/dispute-evidence.test.ts` :

```ts
import { describe, expect, it } from "vitest"
import {
  type EvidenceInput,
  buildActivityEvents,
  buildEvidenceMarkdown,
  formatActivityLog,
} from "@/scripts/dispute-evidence"

const at = (iso: string) => new Date(iso)

const input: EvidenceInput = {
  customer: {
    name: "Jane Doe",
    email: "jane@example.com",
    emailVerified: true,
    createdAt: at("2026-08-01T10:00:00Z"),
    providers: ["credential"],
  },
  transaction: {
    id: "tx_1",
    stripePaymentIntentId: "pi_1",
    productName: "Accès examens",
    amountPaid: 20000,
    currency: "CAD",
    presentmentAmount: null,
    presentmentCurrency: null,
    completedAt: at("2026-08-02T12:00:00Z"),
    accessExpiresAt: at("2026-11-02T12:00:00Z"),
    confirmationEmailSentAt: at("2026-08-02T12:00:05Z"),
  },
  sessions: [
    {
      createdAt: at("2026-08-02T11:55:00Z"),
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0",
    },
    {
      createdAt: at("2026-08-01T10:01:00Z"),
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0",
    },
  ],
  participations: [
    {
      examTitle: "Examen blanc 3",
      startedAt: at("2026-08-05T09:00:00Z"),
      completedAt: at("2026-08-05T12:10:00Z"),
      status: "completed",
      answerCount: 230,
      resultsNotifiedAt: at("2026-08-05T13:00:00Z"),
    },
  ],
  trainings: [
    {
      startedAt: at("2026-08-03T08:00:00Z"),
      completedAt: null,
      status: "expired",
      questionCount: 20,
      answeredCount: 12,
    },
  ],
  dispute: null,
}

describe("buildActivityEvents + formatActivityLog", () => {
  it("journal chronologique, une ligne par événement, IP et user-agent quand connus", () => {
    const log = formatActivityLog(buildActivityEvents(input))
    const lines = log.split("\n")
    expect(lines[0]).toBe(
      "2026-08-01T10:00:00Z · compte créé · jane@example.com (courriel vérifié)",
    )
    expect(lines[1]).toContain("connexion · IP 203.0.113.7 · Mozilla/5.0")
    expect(log).toContain("achat · Accès examens · 200 $ CAD · payment_intent pi_1")
    expect(log).toContain("courriel de confirmation envoyé")
    expect(log).toContain(
      "examen commencé · Examen blanc 3",
    )
    expect(log).toContain("examen terminé · Examen blanc 3 · 230 réponses")
    expect(log).toContain("courriel de résultats envoyé · Examen blanc 3")
    expect(log).toContain("entraînement commencé · 20 questions")
    // Ordre strictement croissant.
    const stamps = lines.map((l) => l.slice(0, 20))
    expect([...stamps].sort()).toEqual(stamps)
  })
})

describe("buildEvidenceMarkdown", () => {
  it("une section par champ de preuve Stripe", () => {
    const md = buildEvidenceMarkdown(input)
    expect(md).toContain("## customer_name\n\nJane Doe")
    expect(md).toContain("## customer_email_address\n\njane@example.com")
    expect(md).toContain("## product_description")
    expect(md).toContain("## access_activity_log")
    expect(md).not.toContain("## Contexte du litige")
  })

  it("avec les données Stripe, ajoute le contexte du litige", () => {
    const md = buildEvidenceMarkdown({
      ...input,
      dispute: {
        id: "dp_1",
        reason: "fraudulent",
        status: "needs_response",
        amount: 20000,
        currency: "cad",
        dueBy: at("2026-09-30T00:00:00Z"),
        cardCountry: "CA",
        threeDSecure: "non tenté",
      },
    })
    expect(md).toContain("## Contexte du litige")
    expect(md).toContain("dp_1")
    expect(md).toContain("2026-09-30")
    expect(md).toContain("fraudulent")
  })
})
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `bun run test tests/scripts/dispute-evidence.test.ts`
Expected: module introuvable.

- [ ] **Step 3 : Écrire le script**

Créer `scripts/dispute-evidence.ts` :

```ts
/**
 * Assemble, en LECTURE SEULE, les preuves d'usage d'un client pour répondre à
 * un litige Stripe. Sortie Markdown dont les sections correspondent aux champs
 * de preuve Stripe pour un produit numérique (`customer_name`,
 * `customer_email_address`, `product_description`, `access_activity_log`).
 *
 * Usage :
 *   AUDIT_DATABASE_URL=... [AUDIT_STRIPE_KEY=rk_live_...] bun scripts/dispute-evidence.ts <payment_intent> [--out dossier.md]
 *
 * Env (délibérément DISTINCT des vars runtime) :
 * - AUDIT_DATABASE_URL : branche Neon à lire (idéalement clonée de la prod).
 * - AUDIT_STRIPE_KEY   : optionnelle, clé LIVE en lecture ; ajoute motif,
 *   date limite, pays de la carte et résultat 3DS. Sans elle, ces lignes sont
 *   omises et le journal reste complet.
 *
 * N'importe pas @/db ni lib/stripe (schéma d'env complet requis hors Next).
 */
import { config } from "dotenv"
import { and, count, desc, eq, isNotNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import Stripe from "stripe"
import {
  account,
  examAnswers,
  examParticipations,
  exams,
  products,
  session,
  trainingSessionItems,
  trainingSessions,
  transactions,
  user,
} from "../db/schema"
import { STRIPE_API_VERSION } from "../lib/stripe-api-version"

const LIMIT = 1000

export type EvidenceInput = {
  customer: {
    name: string
    email: string
    emailVerified: boolean
    createdAt: Date
    providers: string[]
  }
  transaction: {
    id: string
    stripePaymentIntentId: string
    productName: string
    amountPaid: number
    currency: string
    presentmentAmount: number | null
    presentmentCurrency: string | null
    completedAt: Date | null
    accessExpiresAt: Date
    confirmationEmailSentAt: Date | null
  }
  sessions: {
    createdAt: Date
    ipAddress: string | null
    userAgent: string | null
  }[]
  participations: {
    examTitle: string
    startedAt: Date | null
    completedAt: Date | null
    status: string
    answerCount: number
    resultsNotifiedAt: Date | null
  }[]
  trainings: {
    startedAt: Date
    completedAt: Date | null
    status: string
    questionCount: number
    answeredCount: number
  }[]
  dispute: {
    id: string
    reason: string
    status: string
    amount: number
    currency: string
    dueBy: Date | null
    cardCountry: string | null
    threeDSecure: string
  } | null
}

export type ActivityEvent = { at: Date; kind: string; detail: string }

const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z")

// Format volontairement brut et sans locale (« 200 $ CAD », « 200,50 $ CAD »,
// « 50000 XAF ») : le journal est lu par une banque, pas par un client.
const money = (cents: number, currency: string) => {
  if (currency === "XAF") return `${Math.round(cents / 100)} XAF`
  const amount = cents / 100
  const label = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(".", ",")
  return `${label} $ ${currency}`
}

export const buildActivityEvents = (input: EvidenceInput): ActivityEvent[] => {
  const events: ActivityEvent[] = []
  const c = input.customer
  events.push({
    at: c.createdAt,
    kind: "compte créé",
    detail: `${c.email}${c.emailVerified ? " (courriel vérifié)" : ""}`,
  })
  for (const s of input.sessions) {
    events.push({
      at: s.createdAt,
      kind: "connexion",
      detail: `IP ${s.ipAddress ?? "inconnue"} · ${s.userAgent ?? "user-agent inconnu"}`,
    })
  }
  const t = input.transaction
  if (t.completedAt) {
    events.push({
      at: t.completedAt,
      kind: "achat",
      detail: `${t.productName} · ${money(t.amountPaid, t.currency)}${
        t.presentmentAmount != null && t.presentmentCurrency
          ? ` (présenté ${t.presentmentAmount} ${t.presentmentCurrency})`
          : ""
      } · payment_intent ${t.stripePaymentIntentId} · accès jusqu'au ${stamp(t.accessExpiresAt)}`,
    })
  }
  if (t.confirmationEmailSentAt) {
    events.push({
      at: t.confirmationEmailSentAt,
      kind: "courriel de confirmation envoyé",
      detail: c.email,
    })
  }
  for (const p of input.participations) {
    if (p.startedAt)
      events.push({
        at: p.startedAt,
        kind: "examen commencé",
        detail: p.examTitle,
      })
    if (p.completedAt)
      events.push({
        at: p.completedAt,
        kind: "examen terminé",
        detail: `${p.examTitle} · ${p.answerCount} réponses · statut ${p.status}`,
      })
    if (p.resultsNotifiedAt)
      events.push({
        at: p.resultsNotifiedAt,
        kind: "courriel de résultats envoyé",
        detail: p.examTitle,
      })
  }
  for (const tr of input.trainings) {
    events.push({
      at: tr.startedAt,
      kind: "entraînement commencé",
      detail: `${tr.questionCount} questions`,
    })
    if (tr.completedAt)
      events.push({
        at: tr.completedAt,
        kind: "entraînement terminé",
        detail: `${tr.answeredCount}/${tr.questionCount} réponses · statut ${tr.status}`,
      })
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime())
}

export const formatActivityLog = (events: ActivityEvent[]): string =>
  events.map((e) => `${stamp(e.at)} · ${e.kind} · ${e.detail}`).join("\n")

export const buildEvidenceMarkdown = (input: EvidenceInput): string => {
  const { customer, transaction, dispute } = input
  const sections = [
    `# Preuves — litige sur ${transaction.stripePaymentIntentId}`,
    `## customer_name\n\n${customer.name}`,
    `## customer_email_address\n\n${customer.email}${customer.emailVerified ? " (vérifié)" : ""}\n\nConnexion : ${customer.providers.join(", ") || "inconnue"}`,
    `## product_description\n\nAccès en ligne « ${transaction.productName} » à la plateforme NOMAQbanq (préparation à l'EACMC Partie I) : banque de questions, examens blancs et suivi de progression, livré immédiatement après paiement, valide jusqu'au ${stamp(transaction.accessExpiresAt)}.`,
    `## access_activity_log\n\n\`\`\`\n${formatActivityLog(buildActivityEvents(input))}\n\`\`\``,
  ]
  if (dispute) {
    sections.push(
      `## Contexte du litige\n\n- Litige : ${dispute.id}\n- Motif : ${dispute.reason}\n- Statut : ${dispute.status}\n- Montant : ${dispute.amount} ${dispute.currency}\n- Date limite de réponse : ${dispute.dueBy ? stamp(dispute.dueBy) : "inconnue"}\n- Pays de la carte : ${dispute.cardCountry ?? "inconnu"}\n- 3D Secure : ${dispute.threeDSecure}`,
    )
  }
  return sections.join("\n\n") + "\n"
}

const flagValue = (flag: string): string | null => {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

const main = async (): Promise<number> => {
  config({ path: ".env.local" })
  config()

  const paymentIntentId = process.argv[2]
  const dbUrl = process.env.AUDIT_DATABASE_URL
  const stripeKey = process.env.AUDIT_STRIPE_KEY
  if (!paymentIntentId || !paymentIntentId.startsWith("pi_") || !dbUrl) {
    console.error(
      "Usage : AUDIT_DATABASE_URL=... [AUDIT_STRIPE_KEY=rk_live_...] bun scripts/dispute-evidence.ts <pi_...> [--out fichier.md]",
    )
    return 2
  }
  if (stripeKey && !/^(rk|sk)_live_/.test(stripeKey)) {
    console.error("AUDIT_STRIPE_KEY doit être une clé live (rk_live_/sk_live_).")
    return 2
  }
  console.error(
    `Cible : db=${new URL(dbUrl).hostname} · stripe=${stripeKey ? "oui" : "non"} (lecture seule)`,
  )

  const pool = new Pool({ connectionString: dbUrl, max: 2 })
  const db = drizzle(pool)
  try {
    const [tx] = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        productName: products.name,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        presentmentAmount: transactions.presentmentAmount,
        presentmentCurrency: transactions.presentmentCurrency,
        completedAt: transactions.completedAt,
        accessExpiresAt: transactions.accessExpiresAt,
        confirmationEmailSentAt: transactions.confirmationEmailSentAt,
      })
      .from(transactions)
      .leftJoin(products, eq(products.id, transactions.productId))
      .where(eq(transactions.stripePaymentIntentId, paymentIntentId))
      .limit(1)
    if (!tx) {
      console.error(`Aucune transaction pour ${paymentIntentId}.`)
      return 1
    }

    const [customer] = await db
      .select({
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, tx.userId))
      .limit(1)
    const providers = await db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, tx.userId))
      .limit(LIMIT)
    const sessions = await db
      .select({
        createdAt: session.createdAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, tx.userId))
      .orderBy(desc(session.createdAt))
      .limit(LIMIT)
    // Jointure + groupBy plutôt qu'une sous-requête `.as()` : Drizzle déqualifie
    // les colonnes d'une sous-requête mono-table et casse la corrélation.
    const participations = await db
      .select({
        examTitle: exams.title,
        startedAt: examParticipations.startedAt,
        completedAt: examParticipations.completedAt,
        status: examParticipations.status,
        resultsNotifiedAt: examParticipations.resultsNotifiedAt,
        answerCount: count(examAnswers.selectedAnswer),
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .leftJoin(
        examAnswers,
        and(
          eq(examAnswers.participationId, examParticipations.id),
          isNotNull(examAnswers.selectedAnswer),
        ),
      )
      .where(eq(examParticipations.userId, tx.userId))
      .groupBy(examParticipations.id, exams.title)
      .limit(LIMIT)
    const trainings = await db
      .select({
        startedAt: trainingSessions.startedAt,
        completedAt: trainingSessions.completedAt,
        status: trainingSessions.status,
        questionCount: trainingSessions.questionCount,
        answeredCount: count(trainingSessionItems.selectedAnswer),
      })
      .from(trainingSessions)
      .leftJoin(
        trainingSessionItems,
        and(
          eq(trainingSessionItems.sessionId, trainingSessions.id),
          isNotNull(trainingSessionItems.selectedAnswer),
        ),
      )
      .where(eq(trainingSessions.userId, tx.userId))
      .groupBy(trainingSessions.id)
      .limit(LIMIT)

    let dispute: EvidenceInput["dispute"] = null
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION })
      const disputes = await stripe.disputes.list({
        payment_intent: paymentIntentId,
        limit: 1,
      })
      const d = disputes.data[0]
      if (d) {
        const chargeId = typeof d.charge === "string" ? d.charge : d.charge.id
        const charge = await stripe.charges.retrieve(chargeId)
        const card = charge.payment_method_details?.card
        dispute = {
          id: d.id,
          reason: d.reason,
          status: d.status,
          amount: d.amount,
          currency: d.currency,
          dueBy: d.evidence_details?.due_by
            ? new Date(d.evidence_details.due_by * 1000)
            : null,
          cardCountry: card?.country ?? null,
          threeDSecure: card?.three_d_secure
            ? `${card.three_d_secure.result ?? "?"} (${card.three_d_secure.authentication_flow ?? "?"})`
            : "non tenté",
        }
      }
    }

    const markdown = buildEvidenceMarkdown({
      customer: {
        name: customer.name,
        email: customer.email,
        emailVerified: customer.emailVerified,
        createdAt: customer.createdAt,
        providers: providers.map((p) => p.providerId),
      },
      transaction: {
        id: tx.id,
        stripePaymentIntentId: paymentIntentId,
        productName: tx.productName ?? "Accès NOMAQbanq",
        amountPaid: tx.amountPaid,
        currency: tx.currency,
        presentmentAmount: tx.presentmentAmount,
        presentmentCurrency: tx.presentmentCurrency,
        completedAt: tx.completedAt,
        accessExpiresAt: tx.accessExpiresAt,
        confirmationEmailSentAt: tx.confirmationEmailSentAt,
      },
      sessions,
      participations,
      trainings,
      dispute,
    })

    const out = flagValue("--out")
    if (out) {
      const { writeFileSync } = await import("node:fs")
      writeFileSync(out, markdown)
      console.error(`Preuves écrites dans ${out}`)
    } else {
      process.stdout.write(markdown)
    }
    return 0
  } finally {
    await pool.end()
  }
}

const isDirectRun = process.argv[1]?.endsWith("dispute-evidence.ts") ?? false
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("Assemblage interrompu :", error)
      process.exit(1)
    })
}
```

- [ ] **Step 4 : Lancer le test**

Run: `bun run test tests/scripts/dispute-evidence.test.ts`
Expected: vert.

- [ ] **Step 5 : Script npm et gitignore**

Dans `package.json`, après `"audit:stripe-orphelins": …` :

```json
    "dispute:evidence": "bun scripts/dispute-evidence.ts",
```

Dans `.gitignore`, après la ligne `stripe-audit*.json` :

```
# Sortie du script de preuves de litige (donnees personnelles, jamais commitees)
dispute-evidence*.md
```

- [ ] **Step 6 : Essai réel en lecture seule**

Avec une branche Neon clonée de la prod (créée via le MCP Neon depuis `br-blue-moon-adhu1l69`, supprimée après) et le `payment_intent` du litige d'août :

Run: `AUDIT_DATABASE_URL=<branche> bun run dispute:evidence pi_… --out dispute-evidence-2026-08.md`
Expected: fichier Markdown avec les quatre sections, journal trié, aucune erreur. Comparer à l'œil avec le dossier déjà soumis à Stripe.

- [ ] **Step 7 : Vérification et commit**

Run: `bun run check && bun run test`
Expected: tout vert.

```bash
git add scripts/dispute-evidence.ts tests/scripts/dispute-evidence.test.ts package.json .gitignore
git commit -m "feat(scripts): dispute:evidence, journal d'activité prêt pour Stripe"
```

---

### Task 12 : Règles du dépôt et clôture

**Files:**
- Modify: `.claude/rules/payments.md`
- Modify: `docs/superpowers/specs/2026-09-02-prevention-litiges-stripe-design.md` (nom de la variable `AUDIT_STRIPE_KEY`)

- [ ] **Step 1 : Ajouter une section aux règles**

Dans `.claude/rules/payments.md`, après la section « Webhook — contrat de réponse », ajouter :

```markdown
## Litiges et confirmation d'achat

- **L'accès n'est jamais révoqué sur litige**, délibérément : couper l'accès
  affaiblirait la position « service livré et utilisé ». Le webhook persiste
  `stripe_dispute_id` / `dispute_status` sur la transaction (via
  `recordStripeDispute`) et alerte Sentry ; la décision de contester reste
  humaine.
- **Ordre des événements de litige non garanti.** Un statut terminal (`won`,
  `lost`, `warning_closed`) n'est jamais écrasé par un non-terminal arrivé en
  retard. Ne pas « simplifier » l'UPDATE conditionnel.
- **`radar.early_fraud_warning.created` est un signal AVANT litige** : Stripe
  indique que 80 % deviennent un litige si rien n'est fait. L'alerte propose le
  remboursement proactif, qui évite les frais (15 $ + 15 $ CA) et le coup au
  taux de litige.
- **Le courriel de confirmation est best-effort et part APRÈS le commit** du
  fulfillment. Un échec est capturé dans Sentry sans changer le code de
  réponse : un 500 ferait rejouer un fulfillment idempotent pour rien. Le reçu
  Stripe (`payment_intent_data.receipt_email`) part de son côté, donc le client
  n'est jamais sans trace. Le `MessageId` SES est stocké
  (`confirmation_email_message_id`) : c'est la clé de corrélation avec le
  journal SES.
- **Journal SES** : configuration set `nomaqbanq-transactional` → destination
  EventBridge → règle `nomaqbanq-ses-events` → CloudWatch Logs
  `/aws/events/nomaqbanq-ses` (rétention 400 j, métadonnées seulement, jamais
  le corps). C'est la seule preuve d'envoi a posteriori.
- **`consent_collection.terms_of_service: "required"` exige l'URL des CGU dans
  les informations publiques du compte Stripe**, sinon la création de session
  échoue (réglage partagé test/live).
- **Preuves de litige** : `bun run dispute:evidence <pi_…>` (lecture seule,
  env `AUDIT_DATABASE_URL` + `AUDIT_STRIPE_KEY` optionnelle) produit le journal
  d'activité au format des champs Stripe pour un produit numérique.
```

- [ ] **Step 2 : Aligner le spec**

Dans le spec, remplacer `STRIPE_AUDIT_KEY` par `AUDIT_STRIPE_KEY` (nom retenu par le script le plus récent du dépôt, `audit-stripe-orphelins.ts`).

- [ ] **Step 3 : Vérification finale complète**

Run: `bun run check && bun run test && bun run test:integration`
Expected: tout vert, couverture ≥ 80 % sur les quatre axes.

- [ ] **Step 4 : Commit**

```bash
git add .claude/rules/payments.md docs/superpowers/specs/2026-09-02-prevention-litiges-stripe-design.md
git commit -m "docs(payments): invariants litiges, confirmation d'achat et journal SES"
```

- [ ] **Step 5 : Fin de feature** — proposer un test e2e (`/e2e-scenario` : achat en mode test, badge litige, courriel reçu en sandbox) et une revue adversariale de l'implémentation (`/adversarial-review-prompt`) dans une session séparée, puis ouvrir la PR vers `main` en référençant `#154`.
