import { describe, expect, it } from "vitest"
import {
  MONTH_DAYS,
  type PricedProduct,
  cheapestMonthly,
  monthsOf,
  savingsOf,
} from "@/lib/pricing"

const monthlyExam: PricedProduct = {
  code: "exam_access",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "exam",
  isCombo: false,
}
const sixMonthExam: PricedProduct = {
  ...monthlyExam,
  code: "exam_access_promo",
  priceCAD: 20000,
  durationDays: 180,
}
const monthlyTraining: PricedProduct = {
  ...monthlyExam,
  code: "training_access",
  accessType: "training",
}
const premium: PricedProduct = {
  code: "premium_access",
  priceCAD: 35000,
  durationDays: 180,
  accessType: "exam",
  isCombo: true,
}
const catalog = [monthlyExam, sixMonthExam, monthlyTraining, premium]

describe("savingsOf", () => {
  it("compare une formule 6 mois à six fois le mensuel du même accès", () => {
    // 200 $ contre 6 × 50 $ = 300 $.
    expect(savingsOf(catalog, sixMonthExam)).toEqual({
      referenceCAD: 30000,
      savedCAD: 10000,
      percent: 33,
    })
  })

  it("compare le Pack Premium aux deux accès mensuels sur la même durée", () => {
    // 350 $ contre 6 × (50 $ + 50 $) = 600 $ : 41,67 % arrondi par défaut,
    // une économie annoncée ne dépasse jamais l'économie réelle.
    expect(savingsOf(catalog, premium)).toEqual({
      referenceCAD: 60000,
      savedCAD: 25000,
      percent: 41,
    })
  })

  it("n'annonce aucune économie pour le mensuel lui-même", () => {
    expect(savingsOf(catalog, monthlyExam)).toBeNull()
  })

  it("n'annonce rien quand le mensuel de référence manque au catalogue", () => {
    expect(savingsOf([sixMonthExam, premium, monthlyExam], premium)).toBeNull()
  })
})

describe("cheapestMonthly", () => {
  const product = (p: Partial<PricedProduct>): PricedProduct => ({
    code: "x",
    priceCAD: 5000,
    durationDays: MONTH_DAYS,
    accessType: "exam",
    isCombo: false,
    ...p,
  })
  const catalog = [
    product({ code: "exam", priceCAD: 5000 }),
    product({ code: "training", accessType: "training", priceCAD: 4500 }),
    product({ code: "exam6", durationDays: 180, priceCAD: 20000 }),
    product({
      code: "combo",
      isCombo: true,
      durationDays: 180,
      priceCAD: 1000,
    }),
  ]

  it("le mensuel simple le moins cher, tous types ou d'un type", () => {
    expect(cheapestMonthly(catalog)?.code).toBe("training")
    expect(cheapestMonthly(catalog, "exam")?.code).toBe("exam")
  })

  it("aucun mensuel : undefined", () => {
    expect(cheapestMonthly([catalog[2]])).toBeUndefined()
  })
})

describe("monthsOf", () => {
  it("durée en mois du catalogue", () => {
    expect(monthsOf({ durationDays: 180 })).toBe(6)
    expect(monthsOf({ durationDays: MONTH_DAYS })).toBe(1)
  })
})
