import { describe, expect, it } from "vitest"
import { type PricedProduct, savingsOf } from "@/lib/pricing"

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
    // 350 $ contre 6 × (50 $ + 50 $) = 600 $.
    expect(savingsOf(catalog, premium)).toEqual({
      referenceCAD: 60000,
      savedCAD: 25000,
      percent: 42,
    })
  })

  it("n'annonce aucune économie pour le mensuel lui-même", () => {
    expect(savingsOf(catalog, monthlyExam)).toBeNull()
  })

  it("n'annonce rien quand le mensuel de référence manque au catalogue", () => {
    expect(savingsOf([sixMonthExam, premium, monthlyExam], premium)).toBeNull()
  })
})
