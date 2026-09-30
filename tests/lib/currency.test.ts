import { describe, expect, it } from "vitest"
import {
  amountInputError,
  centsToInputAmount,
  parseAmountToCents,
} from "@/lib/currency"

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

    it("accepte zéro : un accès offert se saisit à 0", () => {
      expect(parseAmountToCents("0", "CAD")).toBe(0)
      expect(parseAmountToCents("0,00", "CAD")).toBe(0)
      expect(parseAmountToCents("0", "XAF")).toBe(0)
    })

    it("retourne null pour un montant négatif", () => {
      expect(parseAmountToCents("-50", "CAD")).toBeNull()
      expect(parseAmountToCents("-100", "XAF")).toBeNull()
    })

    it("retourne null pour du texte non numérique", () => {
      expect(parseAmountToCents("abc", "CAD")).toBeNull()
      expect(parseAmountToCents("$50", "CAD")).toBeNull()
      expect(parseAmountToCents("50$", "CAD")).toBeNull()
      expect(parseAmountToCents("1e3", "CAD")).toBeNull()
      expect(parseAmountToCents("cinquante", "XAF")).toBeNull()
    })

    it("retourne null pour NaN", () => {
      expect(parseAmountToCents("NaN", "CAD")).toBeNull()
      expect(parseAmountToCents("Infinity", "CAD")).toBeNull()
    })
  })
})

describe("centsToInputAmount", () => {
  it("CAD : deux décimales, relisibles par parseAmountToCents", () => {
    expect(centsToInputAmount(5050, "CAD")).toBe("50.50")
    expect(parseAmountToCents(centsToInputAmount(5050, "CAD"), "CAD")).toBe(
      5050,
    )
  })

  it("XAF : entier, sans centimes", () => {
    expect(centsToInputAmount(2_280_000, "XAF")).toBe("22800")
  })
})

describe("amountInputError", () => {
  it("rien à signaler pour un montant valide, zéro compris", () => {
    expect(amountInputError("50", "CAD")).toBeNull()
    expect(amountInputError("49,99", "CAD")).toBeNull()
    expect(amountInputError("0", "CAD")).toBeNull()
    expect(amountInputError("25000", "XAF")).toBeNull()
  })

  it("montant vide : rappelle qu'un accès offert se saisit à 0", () => {
    expect(amountInputError("  ", "CAD")).toBe(
      "Indiquez un montant (0 pour un accès offert).",
    )
  })

  it("montant négatif ou non numérique", () => {
    expect(amountInputError("-5", "CAD")).toBe(
      "Le montant doit être positif ou nul.",
    )
    expect(amountInputError("abc", "XAF")).toBe(
      "Le montant doit être positif ou nul.",
    )
  })

  it("règle de la devise : entier en XAF, deux décimales au plus en CAD", () => {
    expect(amountInputError("100,5", "XAF")).toBe(
      "En XAF, le montant est un nombre entier.",
    )
    expect(amountInputError("10.123", "CAD")).toBe(
      "Deux décimales au plus en CAD.",
    )
  })
})
