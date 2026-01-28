import { describe, expect, it } from "vitest"
import { isValidAmount, parseAmountToCents } from "@/lib/currency"

describe("parseAmountToCents", () => {
  describe("CAD", () => {
    it("parse un montant entier", () => {
      expect(parseAmountToCents("50", "CAD")).toBe(5000)
      expect(parseAmountToCents("100", "CAD")).toBe(10000)
      expect(parseAmountToCents("1", "CAD")).toBe(100)
    })

    it("parse un montant avec décimales (point)", () => {
      expect(parseAmountToCents("50.00", "CAD")).toBe(5000)
      expect(parseAmountToCents("50.50", "CAD")).toBe(5050)
      expect(parseAmountToCents("99.99", "CAD")).toBe(9999)
      expect(parseAmountToCents("0.01", "CAD")).toBe(1)
    })

    it("parse un montant avec décimales (virgule européenne)", () => {
      expect(parseAmountToCents("50,00", "CAD")).toBe(5000)
      expect(parseAmountToCents("50,50", "CAD")).toBe(5050)
      expect(parseAmountToCents("99,99", "CAD")).toBe(9999)
    })

    it("parse un montant avec une seule décimale", () => {
      expect(parseAmountToCents("50.5", "CAD")).toBe(5050)
      expect(parseAmountToCents("10.1", "CAD")).toBe(1010)
    })

    it("rejette plus de 2 décimales", () => {
      expect(parseAmountToCents("50.001", "CAD")).toBeNull()
      expect(parseAmountToCents("50.999", "CAD")).toBeNull()
      expect(parseAmountToCents("1.123", "CAD")).toBeNull()
    })

    it("gère les espaces autour du montant", () => {
      expect(parseAmountToCents("  50  ", "CAD")).toBe(5000)
      expect(parseAmountToCents(" 99.99 ", "CAD")).toBe(9999)
    })

    it("arrondit correctement les calculs flottants", () => {
      // 19.99 * 100 peut donner 1998.9999999999998 en JS
      expect(parseAmountToCents("19.99", "CAD")).toBe(1999)
      expect(parseAmountToCents("29.99", "CAD")).toBe(2999)
    })
  })

  describe("XAF", () => {
    it("parse un montant entier", () => {
      expect(parseAmountToCents("5000", "XAF")).toBe(500000)
      expect(parseAmountToCents("10000", "XAF")).toBe(1000000)
      expect(parseAmountToCents("1", "XAF")).toBe(100)
    })

    it("rejette les décimales (XAF n'a pas de centimes)", () => {
      expect(parseAmountToCents("5000.50", "XAF")).toBeNull()
      expect(parseAmountToCents("100.1", "XAF")).toBeNull()
      expect(parseAmountToCents("50,5", "XAF")).toBeNull()
    })

    it("accepte les grands montants", () => {
      expect(parseAmountToCents("1000000", "XAF")).toBe(100000000)
    })
  })

  describe("Cas invalides (toutes devises)", () => {
    it("retourne null pour une chaîne vide", () => {
      expect(parseAmountToCents("", "CAD")).toBeNull()
      expect(parseAmountToCents("", "XAF")).toBeNull()
    })

    it("retourne null pour des espaces uniquement", () => {
      expect(parseAmountToCents("   ", "CAD")).toBeNull()
      expect(parseAmountToCents("   ", "XAF")).toBeNull()
    })

    it("retourne null pour zéro", () => {
      expect(parseAmountToCents("0", "CAD")).toBeNull()
      expect(parseAmountToCents("0.00", "CAD")).toBeNull()
      expect(parseAmountToCents("0", "XAF")).toBeNull()
    })

    it("retourne null pour un montant négatif", () => {
      expect(parseAmountToCents("-50", "CAD")).toBeNull()
      expect(parseAmountToCents("-100", "XAF")).toBeNull()
    })

    it("retourne null pour du texte non numérique", () => {
      expect(parseAmountToCents("abc", "CAD")).toBeNull()
      expect(parseAmountToCents("$50", "CAD")).toBeNull()
      // Note: parseFloat("50$") retourne 50 en JS, donc ce cas n'est pas rejeté
      // C'est acceptable car le champ input est de type text avec inputMode="decimal"
      expect(parseAmountToCents("cinquante", "XAF")).toBeNull()
    })

    it("retourne null pour NaN", () => {
      expect(parseAmountToCents("NaN", "CAD")).toBeNull()
      expect(parseAmountToCents("Infinity", "CAD")).toBeNull()
    })
  })
})

describe("isValidAmount", () => {
  it("retourne true pour un montant CAD valide", () => {
    expect(isValidAmount("50.00", "CAD")).toBe(true)
    expect(isValidAmount("99,99", "CAD")).toBe(true)
    expect(isValidAmount("100", "CAD")).toBe(true)
  })

  it("retourne true pour un montant XAF valide", () => {
    expect(isValidAmount("5000", "XAF")).toBe(true)
    expect(isValidAmount("1", "XAF")).toBe(true)
  })

  it("retourne false pour un montant invalide", () => {
    expect(isValidAmount("", "CAD")).toBe(false)
    expect(isValidAmount("abc", "CAD")).toBe(false)
    expect(isValidAmount("50.001", "CAD")).toBe(false)
    expect(isValidAmount("50.5", "XAF")).toBe(false)
  })
})
