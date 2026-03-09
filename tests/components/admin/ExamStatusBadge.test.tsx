import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import { ExamStatus } from "@/lib/exam-status"

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

describe("ExamStatusBadge", () => {
  it("affiche le label 'En cours' pour le statut active", () => {
    render(<ExamStatusBadge status="active" />)
    expect(screen.getByText("En cours")).toBeInTheDocument()
  })

  it("affiche le label 'À venir' pour le statut upcoming", () => {
    render(<ExamStatusBadge status="upcoming" />)
    expect(screen.getByText("À venir")).toBeInTheDocument()
  })

  it("affiche le label 'Terminé' pour le statut completed", () => {
    render(<ExamStatusBadge status="completed" />)
    expect(screen.getByText("Terminé")).toBeInTheDocument()
  })

  it("affiche le label 'Désactivé' pour le statut inactive", () => {
    render(<ExamStatusBadge status="inactive" />)
    expect(screen.getByText("Désactivé")).toBeInTheDocument()
  })

  it("applique les classes CSS correspondant au statut active", () => {
    const { container } = render(<ExamStatusBadge status="active" />)
    const badge = container.querySelector("[class*='bg-gray']")
    expect(badge).not.toBeNull()
  })

  it("applique les classes CSS correspondant au statut completed", () => {
    const { container } = render(<ExamStatusBadge status="completed" />)
    const badge = container.querySelector("[class*='bg-green']")
    expect(badge).not.toBeNull()
  })

  it("applique une className personnalisée", () => {
    const { container } = render(
      <ExamStatusBadge status="active" className="custom-class" />,
    )
    const badge = container.querySelector(".custom-class")
    expect(badge).not.toBeNull()
  })

  it("rend un badge pour chaque statut possible", () => {
    const statuses: ExamStatus[] = [
      "active",
      "upcoming",
      "completed",
      "inactive",
    ]

    statuses.forEach((status) => {
      const { unmount } = render(<ExamStatusBadge status={status} />)
      // Vérifie que le badge contient du texte (le label)
      const badge = screen.getByText(/.+/)
      expect(badge).toBeInTheDocument()
      unmount()
    })
  })
})
