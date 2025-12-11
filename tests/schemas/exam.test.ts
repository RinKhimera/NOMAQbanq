import { describe, expect, it } from "vitest"
import { Id } from "@/convex/_generated/dataModel"
import { examFormSchema, validateQuestionCount } from "@/schemas/exam"

describe("Exam Schema", () => {
  describe("examFormSchema", () => {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 86400000)
    const nextWeek = new Date(now.getTime() + 7 * 86400000)

    const validExam = {
      title: "Examen de test",
      startDate: tomorrow,
      endDate: nextWeek,
      numberOfQuestions: 50,
      questionIds: Array(50).fill("question_id_placeholder"),
    }

    describe("valid data", () => {
      it("should validate a complete valid exam", () => {
        const result = examFormSchema.safeParse(validExam)
        expect(result.success).toBe(true)
      })

      it("should validate with optional description", () => {
        const examWithDesc = {
          ...validExam,
          description: "Description de l'examen",
        }
        const result = examFormSchema.safeParse(examWithDesc)
        expect(result.success).toBe(true)
      })

      it("should validate with minimum 10 questions", () => {
        const minExam = {
          ...validExam,
          numberOfQuestions: 10,
          questionIds: Array(10).fill("q"),
        }
        const result = examFormSchema.safeParse(minExam)
        expect(result.success).toBe(true)
      })

      it("should validate with maximum 230 questions", () => {
        const maxExam = {
          ...validExam,
          numberOfQuestions: 230,
          questionIds: Array(230).fill("q"),
        }
        const result = examFormSchema.safeParse(maxExam)
        expect(result.success).toBe(true)
      })
    })

    describe("title validation", () => {
      it("should reject title with less than 3 characters", () => {
        const invalid = { ...validExam, title: "AB" }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("3 caractères")
        }
      })

      it("should accept title with exactly 3 characters", () => {
        const valid = { ...validExam, title: "ABC" }
        const result = examFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should reject empty title", () => {
        const invalid = { ...validExam, title: "" }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("date validation", () => {
      it("should reject when endDate is before startDate", () => {
        const invalid = {
          ...validExam,
          startDate: nextWeek,
          endDate: tomorrow,
        }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("postérieure")
        }
      })

      it("should reject when endDate equals startDate", () => {
        const invalid = {
          ...validExam,
          startDate: tomorrow,
          endDate: tomorrow,
        }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("should accept when endDate is 1 day after startDate", () => {
        const dayAfterTomorrow = new Date(tomorrow.getTime() + 86400000)
        const valid = {
          ...validExam,
          startDate: tomorrow,
          endDate: dayAfterTomorrow,
        }
        const result = examFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should reject missing startDate", () => {
        const invalid = { ...validExam, startDate: undefined }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("should reject missing endDate", () => {
        const invalid = { ...validExam, endDate: undefined }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("numberOfQuestions validation", () => {
      it("should reject less than 10 questions", () => {
        const invalid = { ...validExam, numberOfQuestions: 9 }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("10")
        }
      })

      it("should reject more than 230 questions", () => {
        const invalid = { ...validExam, numberOfQuestions: 231 }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("230")
        }
      })

      it("should accept exactly 10 questions", () => {
        const valid = { ...validExam, numberOfQuestions: 10 }
        const result = examFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should accept exactly 230 questions", () => {
        const valid = { ...validExam, numberOfQuestions: 230 }
        const result = examFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })

    describe("questionIds validation", () => {
      it("should reject empty questionIds array", () => {
        const invalid = { ...validExam, questionIds: [] }
        const result = examFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("au moins une")
        }
      })

      it("should accept single question", () => {
        const valid = { ...validExam, questionIds: ["q1"] }
        const result = examFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })
  })

  describe("validateQuestionCount", () => {
    it("should return true when counts match", () => {
      const selected = ["q1", "q2", "q3"] as Id<"questions">[]
      expect(validateQuestionCount(selected, 3)).toBe(true)
    })

    it("should return false when too few questions", () => {
      const selected = ["q1", "q2"] as Id<"questions">[]
      expect(validateQuestionCount(selected, 3)).toBe(false)
    })

    it("should return false when too many questions", () => {
      const selected = ["q1", "q2", "q3", "q4"] as Id<"questions">[]
      expect(validateQuestionCount(selected, 3)).toBe(false)
    })

    it("should return true for empty array with 0 required", () => {
      expect(validateQuestionCount([], 0)).toBe(true)
    })

    it("should return false for empty array with required > 0", () => {
      expect(validateQuestionCount([], 10)).toBe(false)
    })

    it("should handle large question counts", () => {
      const selected = Array(230).fill("q") as Id<"questions">[]
      expect(validateQuestionCount(selected, 230)).toBe(true)
    })
  })
})
