import { describe, expect, it } from "vitest"
import {
  MAX_EXPLANATIONS_BATCH,
  loadExamQuestionExplanationsSchema,
} from "@/features/exams/schemas"

describe("loadExamQuestionExplanationsSchema", () => {
  it("accepte 1 à MAX_EXPLANATIONS_BATCH ids", () => {
    expect(loadExamQuestionExplanationsSchema.safeParse(["a"]).success).toBe(
      true,
    )
    expect(
      loadExamQuestionExplanationsSchema.safeParse(
        Array(MAX_EXPLANATIONS_BATCH).fill("a"),
      ).success,
    ).toBe(true)
  })
  it("refuse 0 id et > MAX_EXPLANATIONS_BATCH ids", () => {
    expect(loadExamQuestionExplanationsSchema.safeParse([]).success).toBe(false)
    expect(
      loadExamQuestionExplanationsSchema.safeParse(
        Array(MAX_EXPLANATIONS_BATCH + 1).fill("a"),
      ).success,
    ).toBe(false)
  })
})
