import { describe, expect, it } from "vitest"
import { MARKETING_CLAIMS } from "@/constants"
import {
  MIN_COMPLETED_PARTICIPATIONS,
  MIN_PUBLISHABLE_SUCCESS_RATE,
  SUCCESS_SCORE_THRESHOLD,
  resolveSuccessRate,
} from "@/features/marketing/lib"

const EDITORIAL = MARKETING_CLAIMS.successRate

describe("resolveSuccessRate", () => {
  it("retombe sur l'éditorial sous le seuil de volume", () => {
    expect(resolveSuccessRate({ completed: 49, passed: 49 })).toBe(EDITORIAL)
  })

  it("retombe sur l'éditorial à 0 participation (pas de division par zéro)", () => {
    expect(resolveSuccessRate({ completed: 0, passed: 0 })).toBe(EDITORIAL)
  })

  it("publie le taux calculé au seuil exact de volume si ≥ plancher", () => {
    // 50 terminées, 40 réussies → 80 % ≥ 70 % → publié.
    expect(resolveSuccessRate({ completed: 50, passed: 40 })).toBe("80%")
  })

  it("retombe sur l'éditorial quand le taux est sous le plancher de publication", () => {
    // 100 terminées, 42 réussies → 42 % < 70 % → éditorial.
    expect(resolveSuccessRate({ completed: 100, passed: 42 })).toBe(EDITORIAL)
  })

  it("publie exactement au plancher (70 %) mais pas juste en dessous (69 %)", () => {
    expect(resolveSuccessRate({ completed: 100, passed: 70 })).toBe("70%")
    expect(resolveSuccessRate({ completed: 100, passed: 69 })).toBe(EDITORIAL)
  })

  it("arrondit le taux (Math.round)", () => {
    // 60 terminées, 47 réussies → 78,33 % → 78 %.
    expect(resolveSuccessRate({ completed: 60, passed: 47 })).toBe("78%")
  })

  it("expose des seuils cohérents avec la spec", () => {
    expect(SUCCESS_SCORE_THRESHOLD).toBe(60)
    expect(MIN_COMPLETED_PARTICIPATIONS).toBe(50)
    expect(MIN_PUBLISHABLE_SUCCESS_RATE).toBe(70)
  })
})
