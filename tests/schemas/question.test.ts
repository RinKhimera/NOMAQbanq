import { describe, expect, it } from "vitest"
import {
  QuestionFormValues,
  filterValidOptions,
  filterValidReferences,
  questionFormSchema,
  validateCorrectAnswer,
} from "@/schemas/question"

describe("Question Schema", () => {
  describe("questionFormSchema", () => {
    const validQuestion: QuestionFormValues = {
      question: "Quelle est la capitale de la France ?",
      options: ["Paris", "Londres", "Berlin", "Madrid"],
      correctAnswer: "Paris",
      explanation: "Paris est la capitale de la France depuis longtemps.",
      objectifCMC: "Connaître les capitales européennes",
      domain: "Géographie",
    }

    describe("valid data", () => {
      it("should validate a complete valid question", () => {
        const result = questionFormSchema.safeParse(validQuestion)
        expect(result.success).toBe(true)
      })

      it("should validate with 5 options", () => {
        const questionWith5Options = {
          ...validQuestion,
          options: ["A", "B", "C", "D", "E"],
          correctAnswer: "A",
        }
        const result = questionFormSchema.safeParse(questionWith5Options)
        expect(result.success).toBe(true)
      })

      it("should validate with optional imageSrc", () => {
        const questionWithImage = {
          ...validQuestion,
          imageSrc: "https://example.com/image.png",
        }
        const result = questionFormSchema.safeParse(questionWithImage)
        expect(result.success).toBe(true)
      })

      it("should validate with optional references", () => {
        const questionWithRefs = {
          ...validQuestion,
          references: ["Reference 1", "Reference 2"],
        }
        const result = questionFormSchema.safeParse(questionWithRefs)
        expect(result.success).toBe(true)
      })
    })

    describe("question field validation", () => {
      it("should reject empty question", () => {
        const invalid = { ...validQuestion, question: "" }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("options validation", () => {
      it("should reject less than 4 options", () => {
        const invalid = {
          ...validQuestion,
          options: ["A", "B", "C"],
        }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("should reject more than 5 options", () => {
        const invalid = {
          ...validQuestion,
          options: ["A", "B", "C", "D", "E", "F"],
        }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })

      it("should reject 4 options with empty strings (refinement)", () => {
        const invalid = {
          ...validQuestion,
          options: ["A", "B", "", ""],
        }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            "4 options non vides",
          )
        }
      })

      it("should accept 4 valid options with 1 empty (5 total)", () => {
        const valid = {
          ...validQuestion,
          options: ["A", "B", "C", "D", ""],
        }
        const result = questionFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })
    })

    describe("correctAnswer validation", () => {
      it("should reject empty correct answer", () => {
        const invalid = { ...validQuestion, correctAnswer: "" }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("explanation validation", () => {
      it("should reject empty explanation", () => {
        const invalid = { ...validQuestion, explanation: "" }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("objectifCMC validation", () => {
      it("should reject empty objectifCMC", () => {
        const invalid = { ...validQuestion, objectifCMC: "" }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })

    describe("domain validation", () => {
      it("should reject empty domain", () => {
        const invalid = { ...validQuestion, domain: "" }
        const result = questionFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
      })
    })
  })

  describe("validateCorrectAnswer", () => {
    it("should return true when correct answer is in options", () => {
      const data: QuestionFormValues = {
        question: "Test",
        options: ["A", "B", "C", "D"],
        correctAnswer: "B",
        explanation: "Test explanation",
        objectifCMC: "Test objective",
        domain: "Test domain",
      }
      expect(validateCorrectAnswer(data)).toBe(true)
    })

    it("should return false when correct answer is not in options", () => {
      const data: QuestionFormValues = {
        question: "Test",
        options: ["A", "B", "C", "D"],
        correctAnswer: "E",
        explanation: "Test explanation",
        objectifCMC: "Test objective",
        domain: "Test domain",
      }
      expect(validateCorrectAnswer(data)).toBe(false)
    })

    it("should filter empty options before checking", () => {
      const data: QuestionFormValues = {
        question: "Test",
        options: ["A", "B", "", "D", ""],
        correctAnswer: "B",
        explanation: "Test explanation",
        objectifCMC: "Test objective",
        domain: "Test domain",
      }
      expect(validateCorrectAnswer(data)).toBe(true)
    })

    it("should return false for empty string answer even if in options", () => {
      const data: QuestionFormValues = {
        question: "Test",
        options: ["A", "B", "", "D"],
        correctAnswer: "",
        explanation: "Test explanation",
        objectifCMC: "Test objective",
        domain: "Test domain",
      }
      expect(validateCorrectAnswer(data)).toBe(false)
    })

    it("should handle whitespace-only options correctly", () => {
      const data: QuestionFormValues = {
        question: "Test",
        options: ["A", "B", "   ", "D"],
        correctAnswer: "   ",
        explanation: "Test explanation",
        objectifCMC: "Test objective",
        domain: "Test domain",
      }
      expect(validateCorrectAnswer(data)).toBe(false)
    })
  })

  describe("filterValidOptions", () => {
    it("should remove empty strings", () => {
      expect(filterValidOptions(["A", "", "B", "", "C"])).toEqual([
        "A",
        "B",
        "C",
      ])
    })

    it("should remove whitespace-only strings", () => {
      expect(filterValidOptions(["A", "   ", "B", "\t", "C"])).toEqual([
        "A",
        "B",
        "C",
      ])
    })

    it("should keep all valid options", () => {
      expect(filterValidOptions(["A", "B", "C", "D"])).toEqual([
        "A",
        "B",
        "C",
        "D",
      ])
    })

    it("should return empty array for all empty input", () => {
      expect(filterValidOptions(["", "  ", "\n", "\t"])).toEqual([])
    })

    it("should handle empty array", () => {
      expect(filterValidOptions([])).toEqual([])
    })

    it("should preserve option order", () => {
      expect(filterValidOptions(["D", "", "A", "C", "", "B"])).toEqual([
        "D",
        "A",
        "C",
        "B",
      ])
    })
  })

  describe("filterValidReferences", () => {
    it("should return undefined for undefined input", () => {
      expect(filterValidReferences(undefined)).toBeUndefined()
    })

    it("should return undefined for empty array", () => {
      expect(filterValidReferences([])).toBeUndefined()
    })

    it("should return undefined for array with only empty strings", () => {
      expect(filterValidReferences(["", "  ", "\t"])).toBeUndefined()
    })

    it("should filter empty strings and return valid references", () => {
      expect(filterValidReferences(["Ref1", "", "Ref2", "  "])).toEqual([
        "Ref1",
        "Ref2",
      ])
    })

    it("should return all valid references", () => {
      expect(filterValidReferences(["Ref1", "Ref2", "Ref3"])).toEqual([
        "Ref1",
        "Ref2",
        "Ref3",
      ])
    })

    it("should preserve reference order", () => {
      expect(filterValidReferences(["C", "", "A", "B"])).toEqual([
        "C",
        "A",
        "B",
      ])
    })
  })
})
