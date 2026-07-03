import { describe, expect, it } from "vitest"
import { defaultFilters } from "@/components/admin/question-browser/types"
import { nextUsageFilters } from "@/components/admin/question-browser/utils"

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
