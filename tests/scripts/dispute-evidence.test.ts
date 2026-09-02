import { describe, expect, it } from "vitest"
import {
  type EvidenceInput,
  buildActivityEvents,
  buildEvidenceMarkdown,
  describePaymentMethod,
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
    expect(log).toContain(
      "achat · Accès examens · 200 $ CAD · payment_intent pi_1",
    )
    expect(log).toContain("courriel de confirmation envoyé")
    expect(log).toContain("examen commencé · Examen blanc 3")
    expect(log).toContain("examen terminé · Examen blanc 3 · 230 réponses")
    expect(log).toContain("courriel de résultats envoyé · Examen blanc 3")
    expect(log).toContain("entraînement commencé · 20 questions")
    const stamps = lines.map((l) => l.slice(0, 20))
    expect([...stamps].sort()).toEqual(stamps)
  })
})

describe("describePaymentMethod", () => {
  it("carte : pays et résultat 3DS", () => {
    expect(
      describePaymentMethod({
        type: "card",
        card: {
          country: "CA",
          three_d_secure: {
            result: "authenticated",
            authentication_flow: "frictionless",
          },
        },
      }),
    ).toEqual({
      paymentMethodType: "card",
      cardCountry: "CA",
      threeDSecure: "authenticated (frictionless)",
    })
  })

  it("carte sans 3DS tenté", () => {
    expect(
      describePaymentMethod({
        type: "card",
        card: { country: "CA", three_d_secure: null },
      }),
    ).toEqual({
      paymentMethodType: "card",
      cardCountry: "CA",
      threeDSecure: "non tenté",
    })
  })

  // Le litige d'août est passé par Link : le dossier ne doit pas dire « non
  // tenté » comme si 3DS avait été possible.
  it("Link pur : pays de financement, 3DS non applicable", () => {
    expect(
      describePaymentMethod({ type: "link", link: { country: "CA" } }),
    ).toEqual({
      paymentMethodType: "link",
      cardCountry: "CA",
      threeDSecure: "non applicable (Link)",
    })
  })

  it("détails absents", () => {
    expect(describePaymentMethod(null)).toEqual({
      paymentMethodType: "inconnu",
      cardCountry: null,
      threeDSecure: "inconnu",
    })
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
        paymentMethodType: "link",
        cardCountry: "CA",
        threeDSecure: "non applicable (Link)",
      },
    })
    expect(md).toContain("## Contexte du litige")
    expect(md).toContain("dp_1")
    expect(md).toContain("2026-09-30")
    expect(md).toContain("fraudulent")
    expect(md).toContain("Moyen de paiement : link")
  })
})
