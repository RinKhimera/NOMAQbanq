import { describe, expect, it } from "vitest"
import { publicFigures } from "@/components/marketing/marketing-figures"

const stats = { totalQuestions: "3000+", totalUsers: "300+" }

describe("publicFigures", () => {
  it("sans taux publiable : QCM, domaines et candidats seulement", () => {
    const figures = publicFigures({ ...stats, successRate: null })

    expect(figures.map((f) => f.value)).toEqual(["3000+", "22", "300+"])
    expect(figures.map((f) => f.label).join(" ")).not.toMatch(/réussite/)
  })

  it("avec un taux publiable, le nomme comme un taux d'examens blancs", () => {
    const figures = publicFigures({ ...stats, successRate: "82 %" })

    expect(figures).toContainEqual({
      value: "82 %",
      label: "de réussite aux examens blancs",
    })
    expect(figures).toHaveLength(4)
  })

  it("ne publie jamais de note", () => {
    const values = publicFigures({ ...stats, successRate: "82 %" }).map(
      (f) => f.value,
    )
    expect(values.join(" ")).not.toMatch(/\/5/)
  })

  it("annonce les 22 domaines médicaux", () => {
    expect(publicFigures({ ...stats, successRate: null })).toContainEqual({
      value: "22",
      label: "domaines médicaux",
    })
  })
})
