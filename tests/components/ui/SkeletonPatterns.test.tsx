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
  it("rend le nombre de lignes demandé", () => {
    const { container } = render(<SkeletonText lines={4} />)
    expect(slots(container)).toHaveLength(4)
  })

  it("rend 3 lignes par défaut", () => {
    const { container } = render(<SkeletonText />)
    expect(slots(container)).toHaveLength(3)
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
