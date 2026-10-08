import { describe, expect, it } from "vitest"
import {
  blankQuestionForm,
  duplicateOf,
  objectiveSelectOptions,
  questionFormChecks,
  toQuestionPayload,
} from "@/app/(admin)/admin/questions/_components/question-form-model"

const filled = () => ({
  ...blankQuestionForm({ domain: "Cardiologie", objective: "Toux" }),
  question: "Énoncé",
  options: ["A", "B", "C", "D"],
  keyIndex: 1,
  explanation: "Parce que.",
})

const states = (checks: { id: string; state: string }[]) =>
  Object.fromEntries(checks.map((c) => [c.id, c.state]))

describe("vérifications du formulaire de question", () => {
  it("un formulaire complet passe toutes les vérifications", () => {
    const checks = questionFormChecks(filled(), {
      frozen: false,
      showErrors: true,
    })
    expect(checks.every((c) => c.state === "ok")).toBe(true)
  })

  it("« à faire » avant la première tentative, « erreur » après", () => {
    const blank = blankQuestionForm()
    expect(
      states(questionFormChecks(blank, { frozen: false, showErrors: false }))
        .enonce,
    ).toBe("todo")
    expect(
      states(questionFormChecks(blank, { frozen: false, showErrors: true }))
        .enonce,
    ).toBe("error")
  })

  it("choix figés : ni choix ni clé à vérifier, une ligne verrouillée", () => {
    const checks = questionFormChecks(
      { ...filled(), options: ["A", "A", "", ""], keyIndex: null },
      { frozen: true, showErrors: true },
    )
    expect(states(checks)).toMatchObject({ verrou: "locked" })
    expect(checks.map((c) => c.id)).not.toContain("cle")
    expect(checks.map((c) => c.id)).not.toContain("doublons")
  })

  it("une longueur dépassée ajoute une vérification en échec", () => {
    const checks = questionFormChecks(
      { ...filled(), references: ["x".repeat(2001)] },
      { frozen: false, showErrors: false },
    )
    expect(states(checks).longueurs).toBe("todo")
  })

  it("doublons aux espaces de bord et à la casse près, cases vides ignorées", () => {
    expect(duplicateOf(["A", " a ", "", "", "B"])).toEqual([1, 0, -1, -1, -1])
  })

  it("la charge garde le texte exact des choix et ne garde que les références remplies", () => {
    expect(
      toQuestionPayload({
        ...filled(),
        options: ["A ", "B", "C", "D"],
        keyIndex: 0,
        references: ["R1", " ", ""],
      }),
    ).toMatchObject({
      options: ["A ", "B", "C", "D"],
      correctAnswer: "A ",
      references: ["R1"],
    })
  })
})

const objectives = [
  { id: "a", label: "Dyspnée" },
  { id: "b", label: "Fièvre" },
  { id: "c", label: "Toux" },
]

describe("objectiveSelectOptions", () => {
  it("met les objectifs du domaine en tête, puis le reste du référentiel", () => {
    expect(objectiveSelectOptions(objectives, ["c"])).toEqual([
      { value: "c", label: "Toux", group: "Objectifs du domaine" },
      { value: "a", label: "Dyspnée", group: "Autres objectifs" },
      { value: "b", label: "Fièvre", group: "Autres objectifs" },
    ])
  })

  it("sans objectif dans le domaine, propose tout le référentiel sans groupes", () => {
    expect(objectiveSelectOptions(objectives, [])).toEqual([
      { value: "a", label: "Dyspnée" },
      { value: "b", label: "Fièvre" },
      { value: "c", label: "Toux" },
    ])
  })
})
