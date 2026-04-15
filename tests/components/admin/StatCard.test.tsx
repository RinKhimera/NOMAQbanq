import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { StatCard } from "@/components/admin/stat-card"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const baseProps = {
  title: "Total Questions",
  value: 1250,
  growth: "+12.5%",
  footerLabel: "Questions disponibles",
  footerDescription: "Base de données QCM médicaux",
  icon: <span data-testid="stat-icon">icon</span>,
}

describe("StatCard", () => {
  it("affiche toutes les props de contenu (titre, valeur, growth, footer, icône)", () => {
    render(<StatCard {...baseProps} />)

    expect(screen.getByText("Total Questions")).toBeInTheDocument()
    expect(screen.getByText("1250")).toBeInTheDocument()
    expect(screen.getByText("+12.5%")).toBeInTheDocument()
    expect(screen.getByText("Questions disponibles")).toBeInTheDocument()
    expect(screen.getByText("Base de données QCM médicaux")).toBeInTheDocument()
    expect(screen.getByTestId("stat-icon")).toBeInTheDocument()
  })

  it("accepte une valeur en string", () => {
    render(<StatCard {...baseProps} value="5 000" />)
    expect(screen.getByText("5 000")).toBeInTheDocument()
  })

  // Le variant primary change le style de la description ET la couleur du
  // footer — on teste la matrice pour garantir que les deux modifications
  // sont liées à la même prop.
  it.each([
    {
      variant: undefined,
      descriptionHasPrimary: false,
      footerHasBlue: false,
    },
    {
      variant: "primary" as const,
      descriptionHasPrimary: true,
      footerHasBlue: true,
    },
  ])(
    "variant=$variant → description primary=$descriptionHasPrimary, footer blue=$footerHasBlue",
    ({ variant, descriptionHasPrimary, footerHasBlue }) => {
      render(<StatCard {...baseProps} variant={variant} />)

      const description = screen.getByText("Total Questions")
      const footerLabel = screen.getByText("Questions disponibles")
      const footerDiv = footerLabel.closest("div")

      if (descriptionHasPrimary) {
        expect(description.className).toContain("text-foreground")
        expect(description.className).toContain("font-semibold")
      } else {
        expect(description.className).not.toContain("text-foreground")
        expect(description.className).not.toContain("font-semibold")
      }

      if (footerHasBlue) {
        expect(footerDiv?.className).toContain("text-blue-700")
      } else {
        expect(footerDiv?.className).not.toContain("text-blue-700")
      }
    },
  )
})
