import { describe, expect, it } from "vitest"
import { hasDoubled, keyReview } from "@/features/questions/key-review"

const confirmation = (answerCount: number) => ({
  at: 0,
  byName: "Admin",
  answerCount,
  note: null,
})

describe("clé à vérifier et clé confirmée", () => {
  it("une clé suspecte sans confirmation est à vérifier", () => {
    expect(
      keyReview({ answerCount: 20, keySuspect: true, confirmation: null }),
    ).toEqual({ toVerify: true, confirmation: null, lapsedConfirmation: null })
  })

  it("une confirmation en vigueur sort la question des clés à vérifier", () => {
    const c = confirmation(20)
    expect(
      keyReview({ answerCount: 25, keySuspect: true, confirmation: c }),
    ).toEqual({ toVerify: false, confirmation: c, lapsedConfirmation: null })
  })

  it("elle tombe quand les réponses ont doublé et que l'écart persiste", () => {
    const c = confirmation(20)
    expect(
      keyReview({ answerCount: 40, keySuspect: true, confirmation: c }),
    ).toEqual({ toVerify: true, confirmation: null, lapsedConfirmation: c })
  })

  it("jumeau : doublé mais plus suspecte, la confirmation reste affichée", () => {
    const c = confirmation(20)
    expect(
      keyReview({ answerCount: 40, keySuspect: false, confirmation: c }),
    ).toEqual({ toVerify: false, confirmation: c, lapsedConfirmation: null })
  })

  it("le doublement exige 10 réponses nouvelles au moins", () => {
    expect(hasDoubled(10, 5)).toBe(false)
    expect(hasDoubled(15, 5)).toBe(true)
    expect(hasDoubled(39, 20)).toBe(false)
    expect(hasDoubled(40, 20)).toBe(true)
  })
})
