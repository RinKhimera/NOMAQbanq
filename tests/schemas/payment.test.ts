import { describe, expect, it } from "vitest"
import { productCode } from "@/db/schema/enums"
import {
  accessTypeSchema,
  manualNoteError,
  paymentMethodLabel,
  paymentMethodSchema,
  productCodeSchema,
  transactionStatusSchema,
  transactionTypeSchema,
} from "@/schemas/payment"

describe("Payment Schema", () => {
  describe("productCodeSchema", () => {
    it("accepte chaque code produit de la base, combo compris", () => {
      expect([...productCodeSchema.options].sort()).toEqual(
        [...productCode.enumValues].sort(),
      )
    })

    it("valide les codes de produits valides", () => {
      expect(productCodeSchema.safeParse("exam_access").success).toBe(true)
      expect(productCodeSchema.safeParse("training_access").success).toBe(true)
      expect(productCodeSchema.safeParse("exam_access_promo").success).toBe(
        true,
      )
      expect(productCodeSchema.safeParse("training_access_promo").success).toBe(
        true,
      )
    })

    it("rejette les codes invalides", () => {
      expect(productCodeSchema.safeParse("invalid").success).toBe(false)
      expect(productCodeSchema.safeParse("").success).toBe(false)
    })
  })

  describe("accessTypeSchema", () => {
    it("valide les types d'accès valides", () => {
      expect(accessTypeSchema.safeParse("exam").success).toBe(true)
      expect(accessTypeSchema.safeParse("training").success).toBe(true)
    })

    it("rejette les types invalides", () => {
      expect(accessTypeSchema.safeParse("invalid").success).toBe(false)
      expect(accessTypeSchema.safeParse("").success).toBe(false)
    })
  })

  describe("transactionStatusSchema", () => {
    it("valide les statuts valides", () => {
      expect(transactionStatusSchema.safeParse("pending").success).toBe(true)
      expect(transactionStatusSchema.safeParse("completed").success).toBe(true)
      expect(transactionStatusSchema.safeParse("failed").success).toBe(true)
      expect(transactionStatusSchema.safeParse("refunded").success).toBe(true)
    })

    it("rejette les statuts invalides", () => {
      expect(transactionStatusSchema.safeParse("cancelled").success).toBe(false)
      expect(transactionStatusSchema.safeParse("").success).toBe(false)
    })
  })

  describe("transactionTypeSchema", () => {
    it("valide les types de transaction valides", () => {
      expect(transactionTypeSchema.safeParse("stripe").success).toBe(true)
      expect(transactionTypeSchema.safeParse("manual").success).toBe(true)
    })

    it("rejette les types invalides", () => {
      expect(transactionTypeSchema.safeParse("paypal").success).toBe(false)
      expect(transactionTypeSchema.safeParse("").success).toBe(false)
    })
  })

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
