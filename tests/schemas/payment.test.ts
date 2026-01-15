import { describe, expect, it } from "vitest"
import {
  editTransactionSchema,
  manualPaymentSchema,
  paymentMethodSchema,
  productCodeSchema,
  accessTypeSchema,
  transactionStatusSchema,
  transactionTypeSchema,
} from "@/schemas/payment"

describe("Payment Schema", () => {
  describe("productCodeSchema", () => {
    it("valide les codes de produits valides", () => {
      expect(productCodeSchema.safeParse("exam_access").success).toBe(true)
      expect(productCodeSchema.safeParse("training_access").success).toBe(true)
      expect(productCodeSchema.safeParse("exam_access_promo").success).toBe(true)
      expect(productCodeSchema.safeParse("training_access_promo").success).toBe(true)
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

  describe("manualPaymentSchema", () => {
    const validPayment = {
      userId: "user_123",
      productCode: "exam_access",
      amountInput: "50.00",
      currency: "CAD",
      paymentMethod: "interac",
    }

    describe("données valides", () => {
      it("valide un paiement complet valide", () => {
        const result = manualPaymentSchema.safeParse(validPayment)
        expect(result.success).toBe(true)
      })

      it("valide avec des notes optionnelles", () => {
        const withNotes = {
          ...validPayment,
          notes: "Paiement reçu en personne",
        }
        const result = manualPaymentSchema.safeParse(withNotes)
        expect(result.success).toBe(true)
      })

      it("valide un montant avec virgule comme séparateur décimal", () => {
        const withComma = { ...validPayment, amountInput: "50,75" }
        const result = manualPaymentSchema.safeParse(withComma)
        expect(result.success).toBe(true)
      })

      it("valide un montant XAF entier", () => {
        const xafPayment = {
          ...validPayment,
          amountInput: "5000",
          currency: "XAF",
        }
        const result = manualPaymentSchema.safeParse(xafPayment)
        expect(result.success).toBe(true)
      })
    })

    describe("validation du userId", () => {
      it("rejette un userId vide", () => {
        const invalid = { ...validPayment, userId: "" }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("validation du montant", () => {
      it("rejette un montant vide", () => {
        const invalid = { ...validPayment, amountInput: "" }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant négatif", () => {
        const invalid = { ...validPayment, amountInput: "-50.00" }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant à zéro", () => {
        const invalid = { ...validPayment, amountInput: "0" }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant non numérique", () => {
        const invalid = { ...validPayment, amountInput: "abc" }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant CAD avec plus de 2 décimales", () => {
        const invalid = { ...validPayment, amountInput: "50.123" }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant XAF avec décimales", () => {
        const invalid = {
          ...validPayment,
          amountInput: "5000.50",
          currency: "XAF",
        }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("accepte un montant CAD avec 2 décimales exactement", () => {
        const valid = { ...validPayment, amountInput: "50.75" }
        const result = manualPaymentSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("accepte un montant CAD avec 1 décimale", () => {
        const valid = { ...validPayment, amountInput: "50.5" }
        const result = manualPaymentSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("accepte un montant CAD sans décimales", () => {
        const valid = { ...validPayment, amountInput: "50" }
        const result = manualPaymentSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })

    describe("validation des notes", () => {
      it("rejette des notes dépassant 500 caractères", () => {
        const invalid = {
          ...validPayment,
          notes: "a".repeat(501),
        }
        const result = manualPaymentSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("500")
        }
      })

      it("accepte des notes de 500 caractères exactement", () => {
        const valid = {
          ...validPayment,
          notes: "a".repeat(500),
        }
        const result = manualPaymentSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })
  })

  describe("editTransactionSchema", () => {
    const validEdit = {
      amountInput: "50.00",
      currency: "CAD",
      paymentMethod: "interac",
    }

    describe("données valides", () => {
      it("valide une modification minimale", () => {
        const result = editTransactionSchema.safeParse(validEdit)
        expect(result.success).toBe(true)
      })

      it("valide avec des notes optionnelles", () => {
        const withNotes = {
          ...validEdit,
          notes: "Notes de modification",
        }
        const result = editTransactionSchema.safeParse(withNotes)
        expect(result.success).toBe(true)
      })

      it("valide avec un statut completed", () => {
        const withStatus = {
          ...validEdit,
          status: "completed",
        }
        const result = editTransactionSchema.safeParse(withStatus)
        expect(result.success).toBe(true)
      })

      it("valide avec un statut refunded", () => {
        const withStatus = {
          ...validEdit,
          status: "refunded",
        }
        const result = editTransactionSchema.safeParse(withStatus)
        expect(result.success).toBe(true)
      })

      it("valide avec un montant et virgule décimale", () => {
        const withComma = { ...validEdit, amountInput: "75,50" }
        const result = editTransactionSchema.safeParse(withComma)
        expect(result.success).toBe(true)
      })

      it("valide toutes les méthodes de paiement", () => {
        const methods = ["cash", "interac", "virement", "autre"]
        methods.forEach((method) => {
          const withMethod = { ...validEdit, paymentMethod: method }
          const result = editTransactionSchema.safeParse(withMethod)
          expect(result.success).toBe(true)
        })
      })
    })

    describe("validation du montant", () => {
      it("rejette un montant vide", () => {
        const invalid = { ...validEdit, amountInput: "" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant négatif", () => {
        const invalid = { ...validEdit, amountInput: "-100" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant à zéro", () => {
        const invalid = { ...validEdit, amountInput: "0" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un montant CAD avec plus de 2 décimales", () => {
        const invalid = { ...validEdit, amountInput: "50.999" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("Montant invalide")
        }
      })

      it("rejette un montant XAF avec décimales", () => {
        const invalid = {
          ...validEdit,
          amountInput: "5000.5",
          currency: "XAF",
        }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("accepte un grand montant XAF entier", () => {
        const valid = {
          ...validEdit,
          amountInput: "500000",
          currency: "XAF",
        }
        const result = editTransactionSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })

    describe("validation du statut", () => {
      it("rejette un statut invalide", () => {
        const invalid = {
          ...validEdit,
          status: "pending",
        }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette un statut failed", () => {
        const invalid = {
          ...validEdit,
          status: "failed",
        }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("accepte un statut absent (optionnel)", () => {
        const valid = { ...validEdit }
        const result = editTransactionSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })

    describe("validation des notes", () => {
      it("rejette des notes dépassant 500 caractères", () => {
        const invalid = {
          ...validEdit,
          notes: "x".repeat(501),
        }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("accepte des notes vides", () => {
        const valid = {
          ...validEdit,
          notes: "",
        }
        const result = editTransactionSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("accepte des notes de 500 caractères", () => {
        const valid = {
          ...validEdit,
          notes: "x".repeat(500),
        }
        const result = editTransactionSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })

    describe("validation de la devise", () => {
      it("accepte CAD", () => {
        const valid = { ...validEdit, currency: "CAD" }
        const result = editTransactionSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("accepte XAF", () => {
        const valid = {
          ...validEdit,
          amountInput: "5000",
          currency: "XAF",
        }
        const result = editTransactionSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("rejette une devise invalide", () => {
        const invalid = { ...validEdit, currency: "USD" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette une devise vide", () => {
        const invalid = { ...validEdit, currency: "" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("validation de la méthode de paiement", () => {
      it("rejette une méthode de paiement invalide", () => {
        const invalid = { ...validEdit, paymentMethod: "paypal" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("rejette une méthode de paiement vide", () => {
        const invalid = { ...validEdit, paymentMethod: "" }
        const result = editTransactionSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })
  })
})
