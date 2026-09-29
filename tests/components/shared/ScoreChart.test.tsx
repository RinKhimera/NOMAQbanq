import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScoreChart } from "@/components/shared/charts/score-chart"
import { ScoreRing } from "@/components/shared/score-ring"

// Le contenu recharts est chargé à part : le test porte sur le cadre.
vi.mock("next/dynamic", () => ({
  default: () =>
    function Lazy({ data }: { data: unknown[] }) {
      return <div data-testid="score-lines">{data.length}</div>
    },
}))

const empty = {
  title: "Aucun examen blanc sur la période",
  description: "Vos scores s'afficheront ici.",
}

describe("ScoreChart", () => {
  it("sans point : état vide partagé, recharts jamais chargé", () => {
    render(<ScoreChart data={[]} label="Évolution du score" empty={empty} />)
    expect(
      screen.getByText("Aucun examen blanc sur la période"),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("score-lines")).not.toBeInTheDocument()
  })

  it("avec des points : figure résumée pour un lecteur d'écran", () => {
    render(
      <ScoreChart
        data={[
          { key: "a", label: "21 sept.", value: 62, detail: "Examen A" },
          { key: "b", label: "27 sept.", value: 70, detail: "Examen B" },
        ]}
        label="Évolution du score"
        empty={empty}
      />,
    )
    expect(
      screen.getByRole("figure", {
        name: "Évolution du score : 2 points, dernier 70 %, seuil de réussite 60 %",
      }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("score-lines")).toHaveTextContent("2")
  })
})

describe("ScoreRing", () => {
  it("sans score lisible : « — », jamais 0 %", () => {
    render(<ScoreRing value={null} valueTestId="ring-value" />)
    expect(screen.getByTestId("ring-value")).toHaveTextContent("—")
  })

  it("un score lisible s'affiche en pourcentage", () => {
    render(<ScoreRing value={72} valueTestId="ring-value" />)
    expect(screen.getByTestId("ring-value")).toHaveTextContent("72 %")
  })
})
