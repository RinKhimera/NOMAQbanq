import { describe, expect, it } from "vitest"
import {
  manualNoteError,
  paymentMethodLabel,
  paymentMethodSchema,
} from "@/schemas/payment"

describe("Payment Schema", () => {
  describe("paymentMethodSchema", () => {
    it("valide les méthodes de paiement valides", () => {
      expect(paymentMethodSchema.safeParse("cash").success).toBe(true)
      expect(paymentMethodSchema.safeParse("interac").success).toBe(true)
      expect(paymentMethodSchema.safeParse("virement").success).toBe(true)
      expect(paymentMethodSchema.safeParse("autre").success).toBe(true)
    })

    it("rejette les méthodes invalides", () => {
      expect(paymentMethodSchema.safeParse("paypal").success).toBe(false)
      expect(paymentMethodSchema.safeParse("credit_card").success).toBe(false)
      expect(paymentMethodSchema.safeParse("").success).toBe(false)
    })
  })

  describe("paymentMethodLabel", () => {
    it("libellé des moyens enregistrés par le formulaire", () => {
      expect(paymentMethodLabel("cash")).toBe("Espèces")
      expect(paymentMethodLabel("virement")).toBe("Virement bancaire")
    })

    it("une valeur historique libre reste lisible telle quelle", () => {
      expect(paymentMethodLabel("Virement Interac")).toBe("Virement Interac")
    })
  })

  describe("manualNoteError", () => {
    it("note facultative pour un paiement", () => {
      expect(manualNoteError("", false)).toBeNull()
      expect(manualNoteError("Reçu n° 12", false)).toBeNull()
    })

    it("500 caractères au plus", () => {
      expect(manualNoteError("a".repeat(500), false)).toBeNull()
      expect(manualNoteError("a".repeat(501), false)).toBe(
        "500 caractères au plus.",
      )
    })

    it("accès offert : le motif est obligatoire, 5 caractères au moins", () => {
      expect(manualNoteError("  abcd  ", true)).toBe(
        "Indiquez le motif de la gratuité (5 caractères au moins).",
      )
      expect(manualNoteError("Panne du 21 septembre", true)).toBeNull()
    })
  })
})
