import { render, screen } from "@testing-library/react"
import { ComponentPropsWithoutRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

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
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Composant icone factice pour les tests
const MockIcon = ({ className }: { className?: string }) => (
  <svg data-testid="header-icon" className={className} />
)

describe("AdminPageHeader", () => {
  it("affiche le titre de la page", () => {
    render(
      <AdminPageHeader
        icon={MockIcon}
        title="Gestion des examens"
        subtitle="Créez et gérez vos examens"
        colorScheme="blue"
      />,
    )

    expect(screen.getByText("Gestion des examens")).toBeInTheDocument()
  })

  it("affiche le sous-titre", () => {
    render(
      <AdminPageHeader
        icon={MockIcon}
        title="Gestion des examens"
        subtitle="Créez et gérez vos examens"
        colorScheme="blue"
      />,
    )

    expect(
      screen.getByText("Créez et gérez vos examens"),
    ).toBeInTheDocument()
  })

  it("affiche l'icône passée en composant", () => {
    render(
      <AdminPageHeader
        icon={MockIcon}
        title="Questions"
        subtitle="Gérer les questions"
        colorScheme="violet"
      />,
    )

    expect(screen.getByTestId("header-icon")).toBeInTheDocument()
  })

  it("affiche le badge quand il est fourni", () => {
    render(
      <AdminPageHeader
        icon={MockIcon}
        title="Examens"
        subtitle="Gérer les examens"
        colorScheme="blue"
        badge={{ count: 42, label: "examens" }}
      />,
    )

    // Le badge affiche "42 examens"
    const badge = screen.getByText(/42/)
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toContain("examens")
  })

  it("n'affiche pas de badge quand il n'est pas fourni", () => {
    render(
      <AdminPageHeader
        icon={MockIcon}
        title="Dashboard"
        subtitle="Tableau de bord"
        colorScheme="blue"
      />,
    )

    // Pas de badge contenant un nombre
    const badge = screen.queryByText(/\d+ examens/)
    expect(badge).not.toBeInTheDocument()
  })

  it("affiche les boutons d'action quand ils sont fournis", () => {
    render(
      <AdminPageHeader
        icon={MockIcon}
        title="Examens"
        subtitle="Gérer les examens"
        colorScheme="emerald"
        actions={<button>Créer un examen</button>}
      />,
    )

    expect(screen.getByText("Créer un examen")).toBeInTheDocument()
  })

  it("n'affiche pas la zone droite sans badge ni actions", () => {
    const { container } = render(
      <AdminPageHeader
        icon={MockIcon}
        title="Dashboard"
        subtitle="Vue d'ensemble"
        colorScheme="slate"
      />,
    )

    // La zone droite (shrink-0 flex-wrap) ne devrait pas exister
    const rightSection = container.querySelector(".shrink-0.flex-wrap")
    expect(rightSection).toBeNull()
  })

  it("accepte un badge avec un count en string", () => {
    render(
      <AdminPageHeader
        icon={MockIcon}
        title="Utilisateurs"
        subtitle="Gestion"
        colorScheme="amber"
        badge={{ count: "1 200", label: "utilisateurs" }}
      />,
    )

    expect(screen.getByText(/1 200/)).toBeInTheDocument()
  })
})
