import { describe, expect, it } from "vitest"
import { classify, isResourceMissing } from "@/scripts/audit-stripe-orphelins"

const session = (
  status: string | null,
  paymentStatus: string,
): Parameters<typeof classify>[0] =>
  ({
    status,
    payment_status: paymentStatus,
  }) as Parameters<typeof classify>[0]

describe("classify", () => {
  it("session payée alors que la transaction est restée pending → ORPHELIN", () => {
    expect(classify(session("complete", "paid"))).toBe("ORPHELIN")
  })

  it("promo 100 % (no_payment_required) → ORPHELIN aussi", () => {
    expect(classify(session("complete", "no_payment_required"))).toBe(
      "ORPHELIN",
    )
  })

  it("session expirée sans paiement → ABANDONNE", () => {
    expect(classify(session("expired", "unpaid"))).toBe("ABANDONNE")
  })

  it("session ouverte ou paiement différé en cours → EN_ATTENTE", () => {
    expect(classify(session("open", "unpaid"))).toBe("EN_ATTENTE")
    expect(classify(session("complete", "unpaid"))).toBe("EN_ATTENTE")
  })

  it("le statut de session ne prime jamais sur payment_status", () => {
    // Une session `expired` payée reste un paiement encaissé : la classer
    // « abandonnée » masquerait l'orphelin, qui est tout l'objet de l'audit.
    expect(classify(session("expired", "paid"))).toBe("ORPHELIN")
  })
})

describe("isResourceMissing", () => {
  it("reconnaît le code Stripe d'objet absent du mode courant", () => {
    expect(isResourceMissing({ code: "resource_missing" })).toBe(true)
  })

  it("ignore les autres erreurs", () => {
    expect(isResourceMissing({ code: "rate_limit" })).toBe(false)
    expect(isResourceMissing(new Error("boom"))).toBe(false)
    expect(isResourceMissing(null)).toBe(false)
  })
})
