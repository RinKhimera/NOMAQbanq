import { describe, expect, it } from "vitest"
import { computeScorePercent } from "@/lib/score"

describe("computeScorePercent", () => {
  it("0 question → 0", () => {
    expect(computeScorePercent(0, 0)).toBe(0)
  })

  it("cas nominaux", () => {
    expect(computeScorePercent(2, 4)).toBe(50)
    expect(computeScorePercent(1, 3)).toBe(33)
    expect(computeScorePercent(23, 40)).toBe(58) // 57.5 exact — Math.round float donnait 57
    expect(computeScorePercent(40, 40)).toBe(100)
  })

  it("half-up exact pour tout total ≤ 500 (parité avec round() SQL numeric)", () => {
    for (let total = 1; total <= 500; total++) {
      for (let correct = 0; correct <= total; correct++) {
        const hundred = correct * 100
        const remainder = hundred % total
        const base = (hundred - remainder) / total
        const expected = 2 * remainder >= total ? base + 1 : base
        expect(computeScorePercent(correct, total)).toBe(expected)
      }
    }
  })
})
