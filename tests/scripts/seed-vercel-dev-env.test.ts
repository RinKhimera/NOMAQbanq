import { describe, expect, it } from "vitest"
import { keysToSeed } from "@/scripts/seed-vercel-dev-env"

describe("keysToSeed", () => {
  it("retourne les clés locales absentes de Vercel, triées", () => {
    expect(keysToSeed({ B: "2", A: "1", C: "3" }, new Set(["A"]))).toEqual([
      "B",
      "C",
    ])
  })
  it("ignore les valeurs vides", () => {
    expect(keysToSeed({ X: "", Y: "v" }, new Set())).toEqual(["Y"])
  })
  it("ne retourne rien si tout est déjà présent", () => {
    expect(keysToSeed({ A: "1" }, new Set(["A"]))).toEqual([])
  })
})
