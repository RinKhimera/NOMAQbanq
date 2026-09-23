import { describe, expect, it } from "vitest"
import { read, utils } from "xlsx"
import { questionsCsvLines } from "@/app/(admin)/admin/questions/_components/questions-csv"
import type { QuestionExportRow } from "@/features/questions/dal"

const row: QuestionExportRow = {
  id: "q1",
  question: "Une question, avec virgule ?",
  options: ["A", "B"],
  correctAnswer: "A",
  explanation: "Explication",
  references: ["Réf 1"],
  objectifCMC: "Sang dans les urines, hématurie",
  domain: "Urologie, néphrologie",
  hasImages: false,
  imagesCount: 0,
  createdAt: 0,
  answerCount: 9,
  successRate: null,
}

const parse = (lines: string[]) =>
  utils.sheet_to_json<Record<string, unknown>>(
    read(lines.join("\n"), { type: "string" }).Sheets.Sheet1,
    { defval: "" },
  )

describe("questionsCsvLines", () => {
  it("une virgule dans le domaine ou l'objectif ne décale pas les colonnes", () => {
    const [parsed] = parse(questionsCsvLines([row]))
    expect(parsed).toMatchObject({
      Domaine: "Urologie, néphrologie",
      "Objectif CMC": "Sang dans les urines, hématurie",
      "Réussite (%)": "",
      Réponses: 9,
    })
  })
})
