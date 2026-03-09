import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ExamStatusFilter } from "@/components/admin/exam-status-filter"
import { EXAM_STATUS_CONFIG, ExamStatus } from "@/lib/exam-status"

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
    <a href={href}>
      {children}
    </a>
  ),
}))

// Mock Radix DropdownMenu to render inline (no portal)
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div data-testid="dropdown">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: { children: ReactNode; checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <button
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {children}
    </button>
  ),
}))

describe("ExamStatusFilter", () => {
  it("affiche le bouton 'Filtrer par statut'", () => {
    render(
      <ExamStatusFilter selectedStatuses={[]} onStatusChange={vi.fn()} />,
    )

    // Le texte apparait dans le bouton et dans le header du dropdown
    const elements = screen.getAllByText("Filtrer par statut")
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it("affiche tous les labels de statut", () => {
    render(
      <ExamStatusFilter selectedStatuses={[]} onStatusChange={vi.fn()} />,
    )

    expect(screen.getByText("En cours")).toBeInTheDocument()
    expect(screen.getByText("À venir")).toBeInTheDocument()
    expect(screen.getByText("Terminé")).toBeInTheDocument()
    expect(screen.getByText("Désactivé")).toBeInTheDocument()
  })

  it("affiche les boutons 'Tout' et 'Aucun'", () => {
    render(
      <ExamStatusFilter selectedStatuses={[]} onStatusChange={vi.fn()} />,
    )

    expect(screen.getByText("Tout")).toBeInTheDocument()
    expect(screen.getByText("Aucun")).toBeInTheDocument()
  })

  it("appelle onStatusChange pour ajouter un statut non sélectionné", () => {
    const onStatusChange = vi.fn()
    render(
      <ExamStatusFilter
        selectedStatuses={["active"]}
        onStatusChange={onStatusChange}
      />,
    )

    fireEvent.click(screen.getByText("À venir"))

    expect(onStatusChange).toHaveBeenCalledWith(["active", "upcoming"])
  })

  it("appelle onStatusChange pour retirer un statut déjà sélectionné", () => {
    const onStatusChange = vi.fn()
    render(
      <ExamStatusFilter
        selectedStatuses={["active", "upcoming"]}
        onStatusChange={onStatusChange}
      />,
    )

    fireEvent.click(screen.getByText("En cours"))

    expect(onStatusChange).toHaveBeenCalledWith(["upcoming"])
  })

  it("appelle onStatusChange avec tous les statuts au clic sur 'Tout'", () => {
    const onStatusChange = vi.fn()
    render(
      <ExamStatusFilter
        selectedStatuses={[]}
        onStatusChange={onStatusChange}
      />,
    )

    fireEvent.click(screen.getByText("Tout"))

    const allStatuses = Object.keys(EXAM_STATUS_CONFIG) as ExamStatus[]
    expect(onStatusChange).toHaveBeenCalledWith(allStatuses)
  })

  it("appelle onStatusChange avec un tableau vide au clic sur 'Aucun'", () => {
    const onStatusChange = vi.fn()
    render(
      <ExamStatusFilter
        selectedStatuses={["active", "completed"]}
        onStatusChange={onStatusChange}
      />,
    )

    fireEvent.click(screen.getByText("Aucun"))

    expect(onStatusChange).toHaveBeenCalledWith([])
  })

  it("affiche des indicateurs colorés quand des statuts sont sélectionnés", () => {
    const { container } = render(
      <ExamStatusFilter
        selectedStatuses={["active", "completed"]}
        onStatusChange={vi.fn()}
      />,
    )

    // Les cercles colorés inline-block
    const dots = container.querySelectorAll("span.inline-block.rounded-full")
    expect(dots.length).toBe(2)
  })
})
