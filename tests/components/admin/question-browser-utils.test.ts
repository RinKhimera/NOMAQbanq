import { describe, expect, it } from "vitest"
import {
  type QuestionFilters,
  defaultFilters,
} from "@/components/admin/question-browser/types"
import {
  nextUsageFilters,
  toQuestionSelection,
} from "@/components/admin/question-browser/utils"

describe("nextUsageFilters", () => {
  it("choisir un examen force usedInExamId et remet usageFilter à all", () => {
    const start = { ...defaultFilters, usageFilter: "unused" as const }
    const r = nextUsageFilters(start, { usedInExamId: "ex1" })
    expect(r.usedInExamId).toBe("ex1")
    expect(r.usageFilter).toBe("all")
  })

  it("choisir un filtre d'usage efface usedInExamId", () => {
    const start = { ...defaultFilters, usedInExamId: "ex1" }
    const r = nextUsageFilters(start, { usageFilter: "used" })
    expect(r.usageFilter).toBe("used")
    expect(r.usedInExamId).toBeNull()
  })
})

describe("toQuestionSelection", () => {
  it("les filtres par défaut ne sélectionnent rien", () => {
    expect(toQuestionSelection(defaultFilters)).toEqual({
      search: undefined,
      domain: undefined,
      hasImages: undefined,
      usageFilter: "all",
      usedInExamId: undefined,
      toVerify: false,
    })
  })

  it("reprend chaque filtre actif, tri exclu", () => {
    const filters: QuestionFilters = {
      ...defaultFilters,
      searchQuery: "coeur",
      domain: "Cardiologie",
      hasImages: "without",
      usedInExamId: "ex1",
      toVerify: true,
      sortBy: "successRate",
    }
    expect(toQuestionSelection(filters)).toEqual({
      search: "coeur",
      domain: "Cardiologie",
      hasImages: false,
      usageFilter: "all",
      usedInExamId: "ex1",
      toVerify: true,
    })
  })
})
