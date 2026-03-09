import { fireEvent, render, screen } from "@testing-library/react"
import { ComponentPropsWithoutRef, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ExamCard } from "@/components/admin/exam-card"
import { Id } from "@/convex/_generated/dataModel"
import { ExamWithoutParticipants } from "@/types"

// Hoist the filter function so it's available inside vi.mock
const { filterMotionProps } = vi.hoisted(() => {
  const motionPropsToFilter = new Set([
    "initial",
    "animate",
    "exit",
    "variants",
    "transition",
    "layout",
    "layoutId",
    "layoutDependency",
    "layoutScroll",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileDrag",
    "whileInView",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "inherit",
    "custom",
  ])

  return {
    filterMotionProps: <T extends Record<string, unknown>>(props: T) =>
      Object.fromEntries(
        Object.entries(props).filter(([key]) => !motionPropsToFilter.has(key)),
      ),
  }
})

// Mock motion/react
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: ComponentPropsWithoutRef<"div">) => (
      <div {...filterMotionProps(props)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

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

// Mock Radix DropdownMenu to render inline (no portal) - used by ExamActions
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
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
    if (asChild) return <div onClick={onClick}>{children}</div>
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
    _id: "exam123" as Id<"exams">,
    _creationTime: Date.now(),
    title: "Examen de cardiologie",
    description: "Un examen complet sur la cardiologie",
    startDate: new Date("2025-01-15").getTime(),
    endDate: new Date("2025-02-15").getTime(),
    questionIds: [
      "q1" as Id<"questions">,
      "q2" as Id<"questions">,
      "q3" as Id<"questions">,
    ],
    completionTime: 120,
    isActive: true,
    createdBy: "user1" as Id<"users">,
    participantCount: 45,
    ...overrides,
  }) as ExamWithoutParticipants

const defaultCallbacks = {
  onView: vi.fn(),
  onDeactivate: vi.fn(),
  onReactivate: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
}

describe("ExamCard", () => {
  it("affiche le titre et la description de l'examen", () => {
    render(<ExamCard exam={createMockExam()} {...defaultCallbacks} />)

    expect(screen.getByText("Examen de cardiologie")).toBeInTheDocument()
    expect(
      screen.getByText("Un examen complet sur la cardiologie"),
    ).toBeInTheDocument()
  })

  it("n'affiche pas de description quand elle est absente", () => {
    render(
      <ExamCard
        exam={createMockExam({ description: undefined })}
        {...defaultCallbacks}
      />,
    )

    expect(screen.getByText("Examen de cardiologie")).toBeInTheDocument()
    expect(
      screen.queryByText("Un examen complet sur la cardiologie"),
    ).not.toBeInTheDocument()
  })

  it("affiche les dates formatées en français", () => {
    render(<ExamCard exam={createMockExam()} {...defaultCallbacks} />)

    // date-fns format "d MMM yyyy" avec locale fr : "15 janv. 2025" et "15 févr. 2025"
    expect(screen.getByText(/janv\./)).toBeInTheDocument()
    expect(screen.getByText(/févr\./)).toBeInTheDocument()
  })

  it("affiche le nombre de questions", () => {
    render(<ExamCard exam={createMockExam()} {...defaultCallbacks} />)

    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("Questions")).toBeInTheDocument()
  })

  it("affiche le nombre de participants", () => {
    render(<ExamCard exam={createMockExam()} {...defaultCallbacks} />)

    expect(screen.getByText("45")).toBeInTheDocument()
    expect(screen.getByText("Participants")).toBeInTheDocument()
  })

  it("appelle onView au clic sur la carte", () => {
    const onView = vi.fn()
    render(
      <ExamCard
        exam={createMockExam()}
        {...defaultCallbacks}
        onView={onView}
      />,
    )

    const title = screen.getByText("Examen de cardiologie")
    fireEvent.click(title)

    expect(onView).toHaveBeenCalledWith("exam123")
  })

  it("n'appelle rien si onView n'est pas fourni", () => {
    render(
      <ExamCard
        exam={createMockExam()}
        {...defaultCallbacks}
        onView={undefined}
      />,
    )

    const title = screen.getByText("Examen de cardiologie")
    expect(() => fireEvent.click(title)).not.toThrow()
  })

  it("affiche les labels Début et Fin dans la grille de stats", () => {
    render(<ExamCard exam={createMockExam()} {...defaultCallbacks} />)

    expect(screen.getByText("Début")).toBeInTheDocument()
    expect(screen.getByText("Fin")).toBeInTheDocument()
  })
})
