import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { StatCard } from "@/components/admin/stat-card"

// Mock motion/react
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// Mock next/link
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
  it("affiche le titre, la valeur et la croissance", () => {
    render(<StatCard {...baseProps} />)

    expect(screen.getByText("Total Questions")).toBeInTheDocument()
    expect(screen.getByText("1250")).toBeInTheDocument()
    expect(screen.getByText("+12.5%")).toBeInTheDocument()
  })

  it("affiche le footer label et la description", () => {
    render(<StatCard {...baseProps} />)

    expect(screen.getByText("Questions disponibles")).toBeInTheDocument()
    expect(screen.getByText("Base de données QCM médicaux")).toBeInTheDocument()
  })

  it("affiche l'icône passée en prop", () => {
    render(<StatCard {...baseProps} />)

    expect(screen.getByTestId("stat-icon")).toBeInTheDocument()
  })

  it("accepte une valeur en string", () => {
    render(<StatCard {...baseProps} value="5 000" />)

    expect(screen.getByText("5 000")).toBeInTheDocument()
  })

  it("applique le style par défaut quand variant n'est pas spécifié", () => {
    render(<StatCard {...baseProps} />)

    // Le variant default utilise variant="outline" pour le Badge
    // La CardDescription ne devrait PAS avoir la classe "text-foreground"
    const description = screen.getByText("Total Questions")
    expect(description.className).not.toContain("text-foreground")
    expect(description.className).not.toContain("font-semibold")
  })

  it("applique le style primary quand variant='primary'", () => {
    render(<StatCard {...baseProps} variant="primary" />)

    // La CardDescription devrait avoir la classe "text-foreground font-semibold"
    const description = screen.getByText("Total Questions")
    expect(description.className).toContain("text-foreground")
    expect(description.className).toContain("font-semibold")
  })

  it("applique la couleur bleue au footer en variant primary", () => {
    render(<StatCard {...baseProps} variant="primary" />)

    const footerLabel = screen.getByText("Questions disponibles")
    const footerDiv = footerLabel.closest("div")
    expect(footerDiv?.className).toContain("text-blue-700")
  })

  it("n'applique pas la couleur bleue au footer en variant default", () => {
    render(<StatCard {...baseProps} />)

    const footerLabel = screen.getByText("Questions disponibles")
    const footerDiv = footerLabel.closest("div")
    expect(footerDiv?.className).not.toContain("text-blue-700")
  })
})
