import { describe, expect, it } from "vitest"
import {
  normalizeObjectiveLabel,
  objectiveKey,
  objectiveLabelError,
  objectiveLabelProblems,
} from "@/features/objectives/label"

describe("normalizeObjectiveLabel", () => {
  it("compose en NFC, retire les espaces de bord et réduit les espaces internes", () => {
    expect(normalizeObjectiveLabel("  Douleur  abdominale   aiguë ")).toBe(
      "Douleur abdominale aiguë",
    )
  })

  it("retire une tabulation de bord mais garde une tabulation interne", () => {
    expect(normalizeObjectiveLabel("Bordetella pertussis \t")).toBe(
      "Bordetella pertussis",
    )
    expect(normalizeObjectiveLabel("Toux\tchronique")).toBe("Toux\tchronique")
  })
})

describe("objectiveKey", () => {
  it("rapproche les variantes d'accent, de casse, de ponctuation et d'espaces", () => {
    expect(objectiveKey("Douleur abdominale aiguë")).toBe(
      objectiveKey("douleur abdominale, aigue"),
    )
    expect(objectiveKey("Hypertension artérielle")).toBe(
      objectiveKey("Hypertension-arterielle"),
    )
  })

  it("ne rapproche pas les pluriels", () => {
    expect(objectiveKey("Affection")).not.toBe(objectiveKey("Affections"))
  })
})

describe("règles d'un libellé", () => {
  it("accepte un libellé ordinaire", () => {
    expect(objectiveLabelProblems("Dyspnée")).toEqual([])
    expect(objectiveLabelError("  Dyspnée ")).toBeNull()
  })

  it("refuse une valeur sans lettre ou trop courte", () => {
    expect(objectiveLabelProblems("-")).toEqual([
      "Moins de 3 caractères",
      "Aucune lettre",
    ])
    expect(objectiveLabelError("-")).toMatch(/3 caractères au moins/)
    expect(objectiveLabelError("123")).toMatch(/une lettre/)
    expect(objectiveLabelError("   ")).toMatch(/requis/)
  })

  it("refuse un énoncé collé et une tabulation interne", () => {
    const pasted = "Une jeune fille de 13 ans ".repeat(6)
    expect(objectiveLabelProblems(pasted)).toEqual(["Plus de 120 caractères"])
    expect(objectiveLabelError(pasted)).toMatch(/120 caractères au plus/)
    expect(objectiveLabelError("Toux\tchronique")).toMatch(/tabulation/)
  })

  it("compte les caractères, pas les unités UTF-16", () => {
    expect(objectiveLabelError("Œil")).toBeNull()
    expect(objectiveLabelProblems("é".repeat(120))).toEqual([])
  })
})
