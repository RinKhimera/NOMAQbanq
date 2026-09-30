import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ColumnChart } from "@/components/shared/charts/column-chart"
import { ValueBarChart } from "@/components/shared/charts/value-bar-chart"
import { StatBand } from "@/components/shared/stat-band"

const barWidths = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("li span span")].map(
    (el) => el.style.width,
  )

describe("ValueBarChart", () => {
  it("échelle sur la valeur maximale, jamais 0–100", () => {
    const { container } = render(
      <ValueBarChart
        label="Questions par domaine"
        data={[
          { label: "Cardiologie", value: 400 },
          { label: "Pédiatrie", value: 100 },
        ]}
      />,
    )
    expect(barWidths(container)).toEqual(["100%", "25%"])
    expect(screen.getByText("400")).toBeInTheDocument()
  })
})

describe("ColumnChart", () => {
  it("colonnes proportionnelles au maximum, jour vide à hauteur nulle", () => {
    const { container } = render(
      <ColumnChart
        label="Revenus quotidiens"
        format={(v) => `${v} $`}
        data={[
          { label: "1 sept.", value: 200 },
          { label: "2 sept.", value: 0 },
          { label: "3 sept.", value: 50 },
        ]}
      />,
    )
    const heights = [
      ...container.querySelectorAll<HTMLElement>("[title] span"),
    ].map((el) => el.style.height)
    expect(heights).toEqual(["100%", "0px", "25%"])
    expect(
      screen.getByRole("img", {
        name: "Revenus quotidiens, maximum sur un jour : 200 $",
      }),
    ).toBeInTheDocument()
  })
})

describe("StatBand", () => {
  it("libellé, valeur et contexte de chaque cellule", () => {
    render(
      <StatBand
        items={[
          { label: "Utilisateurs", value: "232", sub: "+4 % sur 30 jours" },
          { label: "Examens actifs", value: "1" },
        ]}
      />,
    )
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument()
    expect(screen.getByText("232")).toBeInTheDocument()
    expect(screen.getByText("+4 % sur 30 jours")).toBeInTheDocument()
  })
})
