import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import type { ExamStatus } from "@/lib/exam-status"

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

describe("ExamStatusBadge", () => {
  it.each<{ status: ExamStatus; label: string }>([
    { status: "active", label: "En cours" },
    { status: "upcoming", label: "À venir" },
    { status: "completed", label: "Terminé" },
    { status: "inactive", label: "Désactivé" },
  ])("affiche '$label' pour le statut $status", ({ status, label }) => {
    render(<ExamStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it("applique une className personnalisée", () => {
    const { container } = render(
      <ExamStatusBadge status="active" className="custom-class" />,
    )
    expect(container.querySelector(".custom-class")).not.toBeNull()
  })
})
