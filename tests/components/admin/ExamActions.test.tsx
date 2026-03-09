import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ExamActions } from "@/components/admin/exam-actions"
import { Id } from "@/convex/_generated/dataModel"
import { ExamWithoutParticipants } from "@/types"

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
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    asChild,
  }: {
    children: ReactNode
    onClick?: () => void
    asChild?: boolean
  }) => {
    if (asChild) {
      return <div onClick={onClick}>{children}</div>
    }
    return (
      <button role="menuitem" onClick={onClick}>
        {children}
      </button>
    )
  },
  DropdownMenuSeparator: () => <hr />,
}))

const createMockExam = (
  overrides: Partial<ExamWithoutParticipants> = {},
): ExamWithoutParticipants =>
  ({
    _id: "exam456" as Id<"exams">,
    _creationTime: Date.now(),
    title: "Examen Neurologie",
    startDate: Date.now(),
    endDate: Date.now() + 86400000,
    questionIds: [],
    completionTime: 60,
    isActive: true,
    createdBy: "user1" as Id<"users">,
    participantCount: 10,
    ...overrides,
  }) as ExamWithoutParticipants

describe("ExamActions", () => {
  const defaultCallbacks = {
    onDeactivate: vi.fn(),
    onReactivate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }

  it("affiche le bouton de déclenchement du menu", () => {
    render(<ExamActions exam={createMockExam()} {...defaultCallbacks} />)

    expect(
      screen.getByLabelText("Actions de l'examen"),
    ).toBeInTheDocument()
  })

  it("affiche le lien 'Voir les détails'", () => {
    render(<ExamActions exam={createMockExam()} {...defaultCallbacks} />)

    expect(screen.getByText("Voir les détails")).toBeInTheDocument()
  })

  it("contient un lien vers la page de détails de l'examen", () => {
    render(<ExamActions exam={createMockExam()} {...defaultCallbacks} />)

    const link = screen.getByText("Voir les détails").closest("a")
    expect(link?.getAttribute("href")).toBe("/admin/exams/exam456")
  })

  it("affiche 'Désactiver' quand l'examen est actif", () => {
    render(
      <ExamActions
        exam={createMockExam({ isActive: true })}
        {...defaultCallbacks}
      />,
    )

    expect(screen.getByText("Désactiver")).toBeInTheDocument()
    expect(screen.queryByText("Réactiver")).not.toBeInTheDocument()
  })

  it("affiche 'Réactiver' quand l'examen est inactif", () => {
    render(
      <ExamActions
        exam={createMockExam({ isActive: false })}
        {...defaultCallbacks}
      />,
    )

    expect(screen.getByText("Réactiver")).toBeInTheDocument()
    expect(screen.queryByText("Désactiver")).not.toBeInTheDocument()
  })

  it("appelle onEdit au clic sur 'Modifier'", () => {
    const onEdit = vi.fn()
    const exam = createMockExam()
    render(
      <ExamActions exam={exam} {...defaultCallbacks} onEdit={onEdit} />,
    )

    fireEvent.click(screen.getByText("Modifier"))

    expect(onEdit).toHaveBeenCalledWith(exam)
  })

  it("appelle onDeactivate au clic sur 'Désactiver'", () => {
    const onDeactivate = vi.fn()
    const exam = createMockExam({ isActive: true })
    render(
      <ExamActions
        exam={exam}
        {...defaultCallbacks}
        onDeactivate={onDeactivate}
      />,
    )

    fireEvent.click(screen.getByText("Désactiver"))

    expect(onDeactivate).toHaveBeenCalledWith(exam)
  })

  it("appelle onReactivate au clic sur 'Réactiver'", () => {
    const onReactivate = vi.fn()
    const exam = createMockExam({ isActive: false })
    render(
      <ExamActions
        exam={exam}
        {...defaultCallbacks}
        onReactivate={onReactivate}
      />,
    )

    fireEvent.click(screen.getByText("Réactiver"))

    expect(onReactivate).toHaveBeenCalledWith(exam._id)
  })

  it("appelle onDelete au clic sur 'Supprimer'", () => {
    const onDelete = vi.fn()
    const exam = createMockExam()
    render(
      <ExamActions exam={exam} {...defaultCallbacks} onDelete={onDelete} />,
    )

    fireEvent.click(screen.getByText("Supprimer"))

    expect(onDelete).toHaveBeenCalledWith(exam)
  })
})
