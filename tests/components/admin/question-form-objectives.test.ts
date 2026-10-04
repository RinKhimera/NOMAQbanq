import { describe, expect, it } from "vitest"
import { objectiveSelectOptions } from "@/app/(admin)/admin/questions/_components/question-form-model"

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
