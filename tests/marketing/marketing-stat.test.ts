import { describe, expect, it } from "vitest"
import { formatMarketingStat } from "@/features/marketing/lib"

describe("formatMarketingStat", () => {
  it("affiche 0 sans suffixe pour un total nul ou négatif", () => {
    expect(formatMarketingStat(0)).toBe("0")
    expect(formatMarketingStat(-3)).toBe("0")
  })

  it.each([
    [1, "50+"],
    [71, "100+"],
    [199, "200+"],
    [200, "200+"],
    [201, "300+"],
    [999, "1000+"],
    [1000, "1000+"],
    [2875, "3000+"],
    [4999, "5000+"],
    [5000, "5000+"],
    [5001, "6000+"],
  ])("arrondit %i au palier supérieur (%s)", (n, expected) => {
    expect(formatMarketingStat(n)).toBe(expected)
  })
})
