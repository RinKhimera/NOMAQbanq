import { describe, expect, it } from "vitest"
import {
  MIN_COMPLETED_PARTICIPATIONS,
  MIN_PUBLISHABLE_SUCCESS_RATE,
  resolveSuccessRate,
} from "@/features/marketing/lib"

describe("resolveSuccessRate", () => {
  it("ne publie rien sous le seuil de volume", () => {
    expect(resolveSuccessRate({ completed: 49, passed: 49 })).toBeNull()
  })

  it("ne publie rien à 0 participation (pas de division par zéro)", () => {
    expect(resolveSuccessRate({ completed: 0, passed: 0 })).toBeNull()
  })

  it("publie le taux calculé au seuil exact de volume si ≥ plancher", () => {
    // 50 terminées, 40 réussies → 80 % ≥ 70 % → publié.
    expect(resolveSuccessRate({ completed: 50, passed: 40 })).toBe("80\u00a0%")
  })

  it("ne publie rien quand le taux est sous le plancher de publication", () => {
    expect(resolveSuccessRate({ completed: 100, passed: 42 })).toBeNull()
  })

  it("publie exactement au plancher (70 %) mais pas juste en dessous (69 %)", () => {
    expect(resolveSuccessRate({ completed: 100, passed: 70 })).toBe("70\u00a0%")
    expect(resolveSuccessRate({ completed: 100, passed: 69 })).toBeNull()
  })

  it("arrondit le taux (Math.round)", () => {
    // 60 terminées, 47 réussies → 78,33 % → 78 %.
    expect(resolveSuccessRate({ completed: 60, passed: 47 })).toBe("78\u00a0%")
  })

  it("expose des seuils cohérents avec la spec", () => {
    expect(MIN_COMPLETED_PARTICIPATIONS).toBe(50)
    expect(MIN_PUBLISHABLE_SUCCESS_RATE).toBe(70)
  })
})
