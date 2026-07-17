import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  AnimatedStatCard,
  AnimatedStatCardSkeleton,
} from "@/components/admin/animated-stat-card"

describe("AnimatedStatCard", () => {
  it("rend le label, la valeur et l'icône", () => {
    render(
      <AnimatedStatCard
        label="Total utilisateurs"
        value="1 234"
        color="emerald"
        icon={<span data-testid="icon" />}
      />,
    )
    expect(screen.getByText("Total utilisateurs")).toBeInTheDocument()
    expect(screen.getByText("1 234")).toBeInTheDocument()
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  it("affiche le subtitle quand fourni, sinon réserve l'espace (invisible)", () => {
    const { rerender } = render(
      <AnimatedStatCard
        label="Accès actifs"
        value={42}
        color="amber"
        subtitle="3 expirent dans 7j"
        icon={<span />}
      />,
    )
    expect(screen.getByText("3 expirent dans 7j")).toBeInTheDocument()

    rerender(
      <AnimatedStatCard
        label="Accès actifs"
        value={42}
        color="amber"
        icon={<span />}
      />,
    )
    // Hauteur uniforme (règle admin-ui) : le placeholder occupe l'espace mais
    // est masqué visuellement.
    expect(screen.getByText("placeholder")).toHaveClass("invisible")
  })

  it("affiche le trend positif et négatif", () => {
    const { rerender } = render(
      <AnimatedStatCard
        label="Nouveaux"
        value={10}
        color="blue"
        trend={{ value: 12.4, isPositive: true }}
        icon={<span />}
      />,
    )
    expect(screen.getByText("12%")).toBeInTheDocument()

    rerender(
      <AnimatedStatCard
        label="Nouveaux"
        value={10}
        color="slate"
        trend={{ value: -8, isPositive: false }}
        icon={<span />}
      />,
    )
    expect(screen.getByText("8%")).toBeInTheDocument()
  })

  it("ne rend pas de badge de trend sans prop trend", () => {
    render(
      <AnimatedStatCard
        label="Domaines"
        value={28}
        color="teal"
        icon={<span />}
      />,
    )
    expect(screen.queryByText("%", { exact: false })).not.toBeInTheDocument()
  })

  it("AnimatedStatCardSkeleton rend un placeholder animé", () => {
    const { container } = render(<AnimatedStatCardSkeleton />)
    expect(container.firstElementChild).toHaveClass("animate-pulse")
  })
})
