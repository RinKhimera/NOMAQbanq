import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PendingRegion } from "@/components/ui/pending-region"

describe("PendingRegion", () => {
  it("rend toujours ses enfants, en attente comme au repos", () => {
    const { rerender } = render(
      <PendingRegion isPending={false}>
        <p>Contenu</p>
      </PendingRegion>,
    )
    expect(screen.getByText("Contenu")).toBeInTheDocument()

    rerender(
      <PendingRegion isPending>
        <p>Contenu</p>
      </PendingRegion>,
    )
    expect(screen.getByText("Contenu")).toBeInTheDocument()
  })

  it("marque la zone occupée et la rend inerte pendant l'attente", () => {
    render(
      <PendingRegion isPending data-testid="region">
        <button type="button">Modifier</button>
      </PendingRegion>,
    )
    const region = screen.getByTestId("region")
    expect(region).toHaveAttribute("aria-busy", "true")
    expect(region).toHaveClass("pointer-events-none")
    expect(region).toHaveClass("opacity-60")
  })

  it("ne marque rien au repos", () => {
    render(
      <PendingRegion isPending={false} data-testid="region">
        <button type="button">Modifier</button>
      </PendingRegion>,
    )
    const region = screen.getByTestId("region")
    expect(region).toHaveAttribute("aria-busy", "false")
    expect(region).not.toHaveClass("pointer-events-none")
  })
})
