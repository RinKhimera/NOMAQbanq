import { describe, expect, it } from "vitest"
import {
  accessLine,
  clientFileHref,
  grantedAccessLabel,
  recordedGrantLine,
  transactionTypeLabel,
  verdictLine,
} from "@/components/shared/payments/transaction-labels"

const DAY = 24 * 60 * 60 * 1000
// 27 septembre 2026, 11 h 02, heure de l'Est.
const NOW = Date.UTC(2026, 8, 27, 15, 2)

describe("verdictLine", () => {
  it("le litige en cours prime", () => {
    expect(verdictLine({ kind: "dispute" })).toEqual({
      tone: "danger",
      text: "Litige en cours sur un paiement Stripe. L'accès reste actif tant que le litige n'est pas perdu.",
    })
  })

  it("plusieurs échecs d'un client qui n'a jamais payé", () => {
    const line = verdictLine({
      kind: "failed",
      failedStreak: 3,
      lastFailedAt: NOW,
      everPaid: false,
    })
    expect(line.tone).toBe("danger")
    expect(line.text).toBe(
      "3 tentatives Stripe ont échoué, la dernière le 27 sept. 2026, 11 h 02. Aucun paiement n'a abouti ensuite ; le client n'a jamais payé.",
    )
  })

  it("un seul échec après un paiement abouti", () => {
    expect(
      verdictLine({
        kind: "failed",
        failedStreak: 1,
        lastFailedAt: NOW,
        everPaid: true,
      }).text,
    ).toBe(
      "La dernière tentative Stripe a échoué, la dernière le 27 sept. 2026, 11 h 02. Aucun paiement n'a abouti ensuite.",
    )
  })

  it("dernier paiement remboursé, avec sa date", () => {
    expect(verdictLine({ kind: "refunded", refundedAt: NOW })).toEqual({
      tone: "neutral",
      text: "Le dernier paiement a été remboursé le 27 sept. 2026 ; l'accès correspondant a été retiré ou recalculé.",
    })
  })

  it("dernier paiement abouti, manuel", () => {
    expect(
      verdictLine({ kind: "completed", completedAt: NOW, manual: true }),
    ).toEqual({
      tone: "success",
      text: "Le dernier paiement a abouti le 27 sept. 2026, 11 h 02 (paiement manuel, aucun courriel envoyé).",
    })
  })
})

describe("transactionTypeLabel", () => {
  it("Stripe, manuel avec son moyen, accès offert", () => {
    expect(
      transactionTypeLabel({
        type: "stripe",
        amountPaid: 5000,
        paymentMethod: null,
      }),
    ).toBe("Stripe")
    expect(
      transactionTypeLabel({
        type: "manual",
        amountPaid: 5000,
        paymentMethod: "interac",
      }),
    ).toBe("Manuel · Interac")
    expect(
      transactionTypeLabel({
        type: "manual",
        amountPaid: 0,
        paymentMethod: null,
      }),
    ).toBe("Manuel · Accès offert")
  })
})

describe("grantedAccessLabel", () => {
  it("Pack Premium : les deux accès", () => {
    expect(
      grantedAccessLabel({
        isCombo: true,
        accessType: "exam",
        durationDays: 180,
      }),
    ).toBe("Examens + Entraînement · 180 jours")
    expect(
      grantedAccessLabel({
        isCombo: false,
        accessType: "training",
        durationDays: 30,
      }),
    ).toBe("Entraînement · 30 jours")
  })
})

describe("accessLine", () => {
  it("actif, expiré, jamais acheté", () => {
    expect(accessLine(NOW + 10 * DAY, NOW)).toEqual({
      state: "active",
      text: "Actif jusqu'au 7 oct. 2026",
    })
    expect(accessLine(NOW - 10 * DAY, NOW)).toEqual({
      state: "expired",
      text: "Expiré le 17 sept. 2026",
    })
    expect(accessLine(null, NOW)).toEqual({
      state: "never",
      text: "Jamais acheté",
    })
  })
})

describe("recordedGrantLine", () => {
  it("accès simple encore actif : jours restants + durée", () => {
    expect(
      recordedGrantLine(
        {
          accessType: "exam",
          previousExpiresAt: NOW + 15 * DAY,
          expiresAt: NOW + 45 * DAY,
        },
        { isCombo: false, durationDays: 30, recordedAt: NOW },
      ),
    ).toBe("15 j restants + 30 j = 45 j · prolongé jusqu'au 11 nov. 2026")
  })

  it("Pack Premium : fenêtre neuve, sans addition", () => {
    expect(
      recordedGrantLine(
        {
          accessType: "training",
          previousExpiresAt: NOW + 15 * DAY,
          expiresAt: NOW + 180 * DAY,
        },
        { isCombo: true, durationDays: 180, recordedAt: NOW },
      ),
    ).toBe("accordé jusqu'au 26 mars 2027")
  })

  it("accès expiré ou jamais eu : accordé", () => {
    expect(
      recordedGrantLine(
        {
          accessType: "exam",
          previousExpiresAt: NOW - DAY,
          expiresAt: NOW + 30 * DAY,
        },
        { isCombo: false, durationDays: 30, recordedAt: NOW },
      ),
    ).toBe("accordé jusqu'au 27 oct. 2026")
  })
})

describe("clientFileHref", () => {
  it("dossier d'un client, transaction dépliée", () => {
    expect(clientFileHref("u1")).toBe("/admin/transactions?client=u1")
    expect(clientFileHref("u1", "t9")).toBe(
      "/admin/transactions?client=u1&tx=t9",
    )
  })
})
