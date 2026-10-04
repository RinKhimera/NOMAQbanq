import { render, screen } from "@testing-library/react"
import { Percent } from "lucide-react"
import { describe, expect, it } from "vitest"
import { VitalCard } from "@/components/shared/vital-card"

describe("VitalCard", () => {
  it("libellé, valeur, unité et contexte", () => {
    render(
      <VitalCard
        label="Score moyen"
        value="66"
        unit="%"
        icon={Percent}
        subtitle="examens blancs"
      />,
    )
    expect(screen.getByText("Score moyen")).toBeInTheDocument()
    expect(screen.getByText("66")).toBeInTheDocument()
    expect(screen.getByText("%")).toBeInTheDocument()
    expect(screen.getByText("examens blancs")).toBeInTheDocument()
  })

  it("sans donnée : « — » seul, sans unité orpheline", () => {
    render(<VitalCard label="Score moyen" value="—" unit="%" />)
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("%")).not.toBeInTheDocument()
  })

  it("annonce le sens de la tendance au lecteur d'écran", () => {
    const { rerender } = render(
      <VitalCard label="Score moyen" value="66" trend={4} />,
    )
    expect(screen.getByText("En hausse de 4 points")).toBeInTheDocument()
    rerender(<VitalCard label="Score moyen" value="66" trend={-3} />)
    expect(screen.getByText("En baisse de 3 points")).toBeInTheDocument()
    rerender(<VitalCard label="Score moyen" value="66" trend={0} />)
    expect(screen.getByText("Stable")).toBeInTheDocument()
  })

  it("aucune tendance affichée quand elle est nulle ou absente", () => {
    render(<VitalCard label="Score moyen" value="66" trend={null} />)
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument()
    expect(screen.queryByText("Stable")).not.toBeInTheDocument()
  })
})
