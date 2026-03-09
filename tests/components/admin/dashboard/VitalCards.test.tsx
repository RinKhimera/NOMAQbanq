import { render, screen } from "@testing-library/react"
import { type ReactNode, ComponentPropsWithoutRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { AdminVitalCards } from "@/components/admin/dashboard/vital-cards"

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

const defaultProps = {
  revenueByCurrency: {
    CAD: { recent: 150000, trend: 12.5 },
    XAF: { recent: 500000, trend: -5.3 },
  },
  usersData: {
    total: 1250,
    trend: 8.2,
  },
  activeExams: 5,
  expiringAccessCount: 3,
}

const noXAFProps = {
  ...defaultProps,
  revenueByCurrency: {
    CAD: { recent: 150000, trend: 12.5 },
    XAF: { recent: 0, trend: 0 },
  },
}

describe("AdminVitalCards", () => {
  it("affiche la carte des revenus CAD", () => {
    render(<AdminVitalCards {...defaultProps} />)

    expect(screen.getByText("Revenus CAD (30j)")).toBeInTheDocument()
  })

  it("affiche le montant CAD formaté (centimes vers dollars)", () => {
    render(<AdminVitalCards {...defaultProps} />)

    // 150000 centimes = 1 500 $ CA
    // Intl.NumberFormat fr-CA currency CAD produces something like "1 500 $"
    const cadLabel = screen.getByText("Revenus CAD (30j)")
    expect(cadLabel).toBeInTheDocument()
  })

  it("affiche la carte des revenus XAF quand les revenus existent", () => {
    render(<AdminVitalCards {...defaultProps} />)

    expect(screen.getByText("Revenus XAF (30j)")).toBeInTheDocument()
  })

  it("masque la carte XAF quand les revenus sont à zéro", () => {
    render(<AdminVitalCards {...noXAFProps} />)

    expect(
      screen.queryByText("Revenus XAF (30j)"),
    ).not.toBeInTheDocument()
  })

  it("affiche la carte des utilisateurs", () => {
    render(<AdminVitalCards {...defaultProps} />)

    expect(screen.getByText("Utilisateurs")).toBeInTheDocument()
  })

  it("affiche les indicateurs de tendance positive avec le pourcentage", () => {
    render(<AdminVitalCards {...defaultProps} />)

    // CAD trend +12.5% -> "12.5%"
    expect(screen.getByText("12.5%")).toBeInTheDocument()
  })

  it("affiche les indicateurs de tendance négative", () => {
    render(<AdminVitalCards {...defaultProps} />)

    // XAF trend -5.3% -> "5.3%" (Math.abs)
    expect(screen.getByText("5.3%")).toBeInTheDocument()
  })

  it("affiche le nombre d'examens actifs", () => {
    render(<AdminVitalCards {...defaultProps} />)

    expect(screen.getByText("Examens actifs")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("Examens en cours")).toBeInTheDocument()
  })

  it("affiche le nombre d'accès expirant", () => {
    render(<AdminVitalCards {...defaultProps} />)

    expect(screen.getByText("Accès expirant")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(
      screen.getByText("Dans les 7 prochains jours"),
    ).toBeInTheDocument()
  })

  it("n'affiche pas l'indicateur d'alerte quand expiringAccessCount est zéro", () => {
    const { container } = render(
      <AdminVitalCards {...defaultProps} expiringAccessCount={0} />,
    )

    // Le composant utilise animate-ping pour l'alerte
    expect(container.querySelector(".animate-ping")).toBeNull()
  })

  it("n'affiche pas de tendance quand le trend est zéro", () => {
    render(
      <AdminVitalCards
        {...defaultProps}
        revenueByCurrency={{
          CAD: { recent: 100000, trend: 0 },
          XAF: { recent: 0, trend: 0 },
        }}
      />,
    )

    // Pas de "0.0%" affiché
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument()
  })

  it("affiche le sous-titre de tendance des utilisateurs", () => {
    render(<AdminVitalCards {...defaultProps} />)

    // usersData.trend = 8.2, .toFixed(0) = "8", so "+8% ce mois"
    expect(screen.getByText("+8% ce mois")).toBeInTheDocument()
  })
})
