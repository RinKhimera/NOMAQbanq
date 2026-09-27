import { describe, expect, it } from "vitest"
import {
  createQuestionSchema,
  updateQuestionSchema,
} from "@/features/questions/schemas"
import { questionFormSchema } from "@/schemas/question"

const question = {
  question: "Quel antibiotique ?",
  options: ["Amoxicilline", "Doxycycline", "Céfazoline", "Vancomycine"],
  correctAnswer: "Amoxicilline",
  explanation: "Parce que.",
  objectifCMC: "Objectif",
  domain: "Cardiologie",
}

const issuesOf = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[]; message: string }[] }
}) => result.error?.issues ?? []

describe("options distinctes deux à deux", () => {
  it.each([
    [
      "doublon exact",
      ["Amoxicilline", "Doxycycline", "Doxycycline", "Céfazoline"],
    ],
    [
      "doublon à la casse près",
      ["Amoxicilline", "Doxycycline", "DOXYCYCLINE", "Céfazoline"],
    ],
    [
      "doublon aux espaces de bord près",
      ["Amoxicilline", "Doxycycline", " Doxycycline\t", "Céfazoline"],
    ],
  ])(
    "la création refuse un %s, en désignant les deux options",
    (_, options) => {
      const issues = issuesOf(
        createQuestionSchema.safeParse({ ...question, options }),
      )
      expect(issues).toContainEqual(
        expect.objectContaining({
          path: ["options"],
          message:
            "L'option C est identique à l'option B (casse et espaces ignorés)",
        }),
      )
    },
  )

  it("l'édition refuse un doublon", () => {
    expect(
      updateQuestionSchema.safeParse({
        ...question,
        id: "q1",
        options: ["Amoxicilline", "amoxicilline", "Doxycycline", "Céfazoline"],
      }).success,
    ).toBe(false)
  })

  it("accepte des options distinctes", () => {
    expect(createQuestionSchema.safeParse(question).success).toBe(true)
  })

  it("le formulaire admin refuse un doublon sur le champ des options, en ignorant les cases vides", () => {
    const duplicate = questionFormSchema.safeParse({
      ...question,
      options: [
        "Amoxicilline",
        "Doxycycline ",
        "doxycycline",
        "Céfazoline",
        "",
      ],
    })
    expect(issuesOf(duplicate)).toContainEqual(
      expect.objectContaining({
        path: ["options"],
        message:
          "L'option C est identique à l'option B (casse et espaces ignorés)",
      }),
    )
    expect(
      questionFormSchema.safeParse({
        ...question,
        options: [...question.options, ""],
      }).success,
    ).toBe(true)
  })

  it("garde le texte exact des options et de la clé, espaces de bord compris", () => {
    const parsed = createQuestionSchema.safeParse({
      ...question,
      options: ["Amoxicilline ", "Doxycycline	", "Céfazoline", "Vancomycine"],
      correctAnswer: "Amoxicilline ",
    })
    expect(parsed.data?.options).toEqual([
      "Amoxicilline ",
      "Doxycycline	",
      "Céfazoline",
      "Vancomycine",
    ])
    expect(parsed.data?.correctAnswer).toBe("Amoxicilline ")
  })

  it("refuse une option ou une clé faite d'espaces", () => {
    expect(
      createQuestionSchema.safeParse({
        ...question,
        options: [...question.options.slice(0, 3), " 	"],
      }).success,
    ).toBe(false)
    expect(
      createQuestionSchema.safeParse({ ...question, correctAnswer: "  " })
        .success,
    ).toBe(false)
  })
})
