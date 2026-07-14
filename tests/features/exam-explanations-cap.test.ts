import { describe, expect, it } from "vitest"
import {
  MAX_EXAM_QUESTIONS,
  loadExamQuestionExplanationsSchema,
} from "@/features/exams/schemas"

describe("loadExamQuestionExplanationsSchema", () => {
  it("accepte 1 à MAX_EXAM_QUESTIONS ids", () => {
    expect(loadExamQuestionExplanationsSchema.safeParse(["a"]).success).toBe(
      true,
    )
    expect(
      loadExamQuestionExplanationsSchema.safeParse(
        Array(MAX_EXAM_QUESTIONS).fill("a"),
      ).success,
    ).toBe(true)
  })
  it("refuse 0 id et > MAX_EXAM_QUESTIONS ids", () => {
    expect(loadExamQuestionExplanationsSchema.safeParse([]).success).toBe(false)
    expect(
      loadExamQuestionExplanationsSchema.safeParse(
        Array(MAX_EXAM_QUESTIONS + 1).fill("a"),
      ).success,
    ).toBe(false)
  })
})
