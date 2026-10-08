import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  PageSkeleton,
  SkeletonStatRow,
  SkeletonTable,
  SkeletonText,
} from "@/components/ui/skeleton-patterns"

const slots = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')

describe("SkeletonText", () => {
  it.each([
    [4, 4],
    [undefined, 3],
  ])("lines=%s → %i lignes", (lines, expected) => {
    const { container } = render(<SkeletonText lines={lines} />)
    expect(slots(container)).toHaveLength(expected)
  })
})

describe("SkeletonStatRow", () => {
  it("rend le nombre de cartes demandé", () => {
    const { container } = render(<SkeletonStatRow count={5} />)
    expect(
      container.querySelectorAll('[data-testid="skeleton-stat"]'),
    ).toHaveLength(5)
  })
})

describe("SkeletonTable", () => {
  it("rend une grille de lignes × colonnes", () => {
    const { container } = render(<SkeletonTable columns={3} rows={4} />)
    // 1 ligne d'en-tête + 4 lignes de corps, à 3 colonnes chacune
    expect(slots(container)).toHaveLength(3 * 5)
  })
})

describe("PageSkeleton", () => {
  it("est annoncé comme un chargement de page", () => {
    render(<PageSkeleton />)
    // Requête par libellé plutôt que par rôle : `<output>` porte implicitement
    // role="status", mais on ne veut pas que le test dépende du mapping ARIA
    // de happy-dom.
    expect(screen.getByLabelText("Chargement de la page")).toBeInTheDocument()
  })
})
