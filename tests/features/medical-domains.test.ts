import { describe, expect, it } from "vitest"
import { MEDICAL_DOMAINS } from "@/constants"
import {
  createQuestionSchema,
  updateQuestionSchema,
} from "@/features/questions/schemas"

const normalize = (domain: string) =>
  domain
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/[^a-z]/gi, "")
    .toLowerCase()

describe("domaines médicaux", () => {
  it("n'a pas deux graphies d'un même domaine", () => {
    const byKey = Map.groupBy(MEDICAL_DOMAINS, normalize)
    const duplicates = [...byKey.values()].filter((group) => group.length > 1)
    expect(duplicates).toEqual([])
  })

  it("retient « Gastro-entérologie » comme seule graphie", () => {
    expect(MEDICAL_DOMAINS).toContain("Gastro-entérologie")
    expect(MEDICAL_DOMAINS).not.toContain("Gastroentérologie")
  })
})

describe("domaine d'une question côté serveur", () => {
  const question = {
    question: "Quel est le traitement de première intention ?",
    options: ["A", "B"],
    correctAnswer: "A",
    explanation: "Parce que.",
    objectifCMC: "Objectif",
  }

  it("accepte un domaine de la liste", () => {
    expect(
      createQuestionSchema.safeParse({ ...question, domain: "Cardiologie" })
        .success,
    ).toBe(true)
  })

  it("refuse un domaine hors liste à la création", () => {
    expect(
      createQuestionSchema.safeParse({
        ...question,
        domain: "Gastroentérologie",
      }).success,
    ).toBe(false)
  })

  it("refuse un domaine hors liste à l'édition", () => {
    expect(
      updateQuestionSchema.safeParse({
        ...question,
        id: "q1",
        domain: "Cardio",
      }).success,
    ).toBe(false)
  })
})
