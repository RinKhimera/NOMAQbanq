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
  ])("la création refuse un %s, sur le champ des options", (_, options) => {
    const issues = issuesOf(
      createQuestionSchema.safeParse({ ...question, options }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: ["options"],
        message: expect.stringContaining("identiques"),
      }),
    )
  })

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
        message: expect.stringContaining("identiques"),
      }),
    )
    expect(
      questionFormSchema.safeParse({
        ...question,
        options: [...question.options, ""],
      }).success,
    ).toBe(true)
  })
})
