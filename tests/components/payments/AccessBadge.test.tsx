import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccessBadge, getAccessStatus } from "@/components/shared/payments/access-badge"

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
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock formatExpiration pour contrôler le rendu
vi.mock("@/lib/format", () => ({
  formatExpiration: (ts: number) => `formatted-${ts}`,
}))

describe("AccessBadge", () => {
  describe("rendu pour chaque statut", () => {
    it("affiche 'Actif' pour le statut active", () => {
      render(
        <AccessBadge accessType="exam" status="active" />,
      )
      expect(screen.getByText("Actif")).toBeInTheDocument()
    })

    it("affiche 'Expire bientôt' pour le statut expiring", () => {
      render(
        <AccessBadge accessType="exam" status="expiring" />,
      )
      expect(screen.getByText("Expire bientôt")).toBeInTheDocument()
    })

    it("affiche 'Expiré' pour le statut expired", () => {
      render(
        <AccessBadge accessType="exam" status="expired" />,
      )
      expect(screen.getByText("Expiré")).toBeInTheDocument()
    })

    it("affiche 'Aucun accès' pour le statut none", () => {
      render(
        <AccessBadge accessType="exam" status="none" />,
      )
      expect(screen.getByText("Aucun accès")).toBeInTheDocument()
    })
  })

  describe("tailles", () => {
    it("utilise la taille sm", () => {
      const { container } = render(
        <AccessBadge accessType="exam" status="active" size="sm" />,
      )
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain("px-2.5")
      expect(badge.className).toContain("gap-1.5")
    })

    it("utilise la taille md par défaut", () => {
      const { container } = render(
        <AccessBadge accessType="exam" status="active" />,
      )
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain("px-3.5")
      expect(badge.className).toContain("gap-2")
    })

    it("utilise la taille lg", () => {
      const { container } = render(
        <AccessBadge accessType="exam" status="active" size="lg" />,
      )
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain("px-4")
      expect(badge.className).toContain("gap-2.5")
    })
  })

  describe("showDetails", () => {
    it("affiche le label du type d'accès exam quand showDetails est true", () => {
      render(
        <AccessBadge
          accessType="exam"
          status="active"
          showDetails
        />,
      )
      expect(screen.getByText(/Examens/)).toBeInTheDocument()
    })

    it("affiche le label du type d'accès training quand showDetails est true", () => {
      render(
        <AccessBadge
          accessType="training"
          status="active"
          showDetails
        />,
      )
      expect(screen.getByText(/Entraînement/)).toBeInTheDocument()
    })

    it("n'affiche pas le label du type d'accès quand showDetails est false", () => {
      render(
        <AccessBadge accessType="exam" status="active" showDetails={false} />,
      )
      expect(screen.queryByText(/Examens/)).not.toBeInTheDocument()
    })
  })

  describe("affichage de expiresAt", () => {
    it("affiche la date d'expiration quand showDetails et statut active", () => {
      const expiresAt = 1700000000000
      render(
        <AccessBadge
          accessType="exam"
          status="active"
          expiresAt={expiresAt}
          showDetails
        />,
      )
      expect(screen.getByText(/formatted-1700000000000/)).toBeInTheDocument()
    })

    it("affiche la date d'expiration quand showDetails et statut expiring", () => {
      const expiresAt = 1700000000000
      render(
        <AccessBadge
          accessType="exam"
          status="expiring"
          expiresAt={expiresAt}
          showDetails
        />,
      )
      expect(screen.getByText(/formatted-1700000000000/)).toBeInTheDocument()
    })

    it("n'affiche pas la date d'expiration quand statut none", () => {
      render(
        <AccessBadge
          accessType="exam"
          status="none"
          expiresAt={1700000000000}
          showDetails
        />,
      )
      expect(screen.queryByText(/formatted-/)).not.toBeInTheDocument()
    })

    it("n'affiche pas la date d'expiration quand statut expired", () => {
      render(
        <AccessBadge
          accessType="exam"
          status="expired"
          expiresAt={1700000000000}
          showDetails
        />,
      )
      expect(screen.queryByText(/formatted-/)).not.toBeInTheDocument()
    })

    it("n'affiche pas la date d'expiration sans showDetails", () => {
      render(
        <AccessBadge
          accessType="exam"
          status="active"
          expiresAt={1700000000000}
        />,
      )
      expect(screen.queryByText(/formatted-/)).not.toBeInTheDocument()
    })
  })

  describe("affichage des jours restants", () => {
    it("affiche les jours restants pour le statut expiring", () => {
      render(
        <AccessBadge
          accessType="exam"
          status="expiring"
          daysRemaining={3}
        />,
      )
      expect(screen.getByText("3j restants")).toBeInTheDocument()
    })

    it("affiche les jours restants pour le statut active", () => {
      render(
        <AccessBadge
          accessType="exam"
          status="active"
          daysRemaining={45}
        />,
      )
      expect(screen.getByText("45j restants")).toBeInTheDocument()
    })

    it("affiche le label par défaut sans daysRemaining pour active", () => {
      render(
        <AccessBadge accessType="exam" status="active" />,
      )
      expect(screen.getByText("Actif")).toBeInTheDocument()
    })
  })
})

describe("getAccessStatus", () => {
  it("retourne 'none' quand expiresAt est null", () => {
    expect(getAccessStatus(null, 10)).toBe("none")
  })

  it("retourne 'none' quand expiresAt est undefined", () => {
    expect(getAccessStatus(undefined, 10)).toBe("none")
  })

  it("retourne 'expired' quand expiresAt est dans le passé", () => {
    const pastTimestamp = Date.now() - 100000
    expect(getAccessStatus(pastTimestamp, 0)).toBe("expired")
  })

  it("retourne 'expiring' quand daysRemaining <= 7", () => {
    const futureTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000
    expect(getAccessStatus(futureTimestamp, 7)).toBe("expiring")
  })

  it("retourne 'expiring' quand daysRemaining est 0 mais expiresAt est dans le futur", () => {
    const futureTimestamp = Date.now() + 1000
    expect(getAccessStatus(futureTimestamp, 0)).toBe("expiring")
  })

  it("retourne 'active' quand daysRemaining > 7", () => {
    const futureTimestamp = Date.now() + 30 * 24 * 60 * 60 * 1000
    expect(getAccessStatus(futureTimestamp, 30)).toBe("active")
  })

  it("retourne 'active' quand daysRemaining est null et expiresAt est futur", () => {
    const futureTimestamp = Date.now() + 30 * 24 * 60 * 60 * 1000
    expect(getAccessStatus(futureTimestamp, null)).toBe("active")
  })

  it("retourne 'active' quand daysRemaining est undefined et expiresAt est futur", () => {
    const futureTimestamp = Date.now() + 30 * 24 * 60 * 60 * 1000
    expect(getAccessStatus(futureTimestamp, undefined)).toBe("active")
  })
})
