import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AlertsPanel } from "@/components/admin/dashboard/alerts-panel"

// Mock motion/react
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../../helpers/motion-mock")
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

const createExpiringAccess = (
  overrides: {
    accessType?: "exam" | "training"
    daysRemaining?: number
    name?: string | null
  } = {},
) => ({
  _id: `access-${Math.random()}`,
  userId: "user1",
  accessType: overrides.accessType ?? "exam",
  daysRemaining: overrides.daysRemaining ?? 3,
  user: {
    name: "name" in overrides ? overrides.name : "Jean Dupont",
    email: "jean@example.com",
  },
})

describe("AlertsPanel", () => {
  it("affiche l'état vide quand il n'y a pas d'alertes", () => {
    render(
      <AlertsPanel expiringAccess={[]} failedPaymentsCount={0} />,
    )

    expect(screen.getByText("Tout va bien")).toBeInTheDocument()
    expect(
      screen.getByText("Aucune alerte à signaler"),
    ).toBeInTheDocument()
  })

  it("affiche le titre 'Alertes' dans les deux cas", () => {
    const { rerender } = render(
      <AlertsPanel expiringAccess={[]} failedPaymentsCount={0} />,
    )
    expect(screen.getByText("Alertes")).toBeInTheDocument()

    rerender(
      <AlertsPanel
        expiringAccess={[createExpiringAccess()]}
        failedPaymentsCount={0}
      />,
    )
    expect(screen.getByText("Alertes")).toBeInTheDocument()
  })

  it("affiche une alerte pour les accès examens expirant", () => {
    render(
      <AlertsPanel
        expiringAccess={[createExpiringAccess({ accessType: "exam" })]}
        failedPaymentsCount={0}
      />,
    )

    expect(
      screen.getByText("Accès examens expirant"),
    ).toBeInTheDocument()
  })

  it("affiche une alerte pour les accès entraînement expirant", () => {
    render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({ accessType: "training" }),
        ]}
        failedPaymentsCount={0}
      />,
    )

    expect(
      screen.getByText("Accès entraînement expirant"),
    ).toBeInTheDocument()
  })

  it("affiche la description pour un seul utilisateur avec accès expirant", () => {
    render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({
            accessType: "exam",
            daysRemaining: 5,
            name: "Marie Martin",
          }),
        ]}
        failedPaymentsCount={0}
      />,
    )

    expect(
      screen.getByText("Marie Martin - 5j restants"),
    ).toBeInTheDocument()
  })

  it("affiche la description au singulier pour 1 jour restant", () => {
    render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({
            accessType: "exam",
            daysRemaining: 1,
            name: "Paul Tremblay",
          }),
        ]}
        failedPaymentsCount={0}
      />,
    )

    expect(
      screen.getByText("Paul Tremblay - 1j restant"),
    ).toBeInTheDocument()
  })

  it("affiche la description pour plusieurs utilisateurs", () => {
    render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({
            accessType: "exam",
            daysRemaining: 5,
          }),
          createExpiringAccess({
            accessType: "exam",
            daysRemaining: 2,
          }),
          createExpiringAccess({
            accessType: "exam",
            daysRemaining: 7,
          }),
        ]}
        failedPaymentsCount={0}
      />,
    )

    expect(
      screen.getByText("3 utilisateurs, 2j minimum"),
    ).toBeInTheDocument()
  })

  it("affiche l'alerte de paiements échoués au singulier", () => {
    render(
      <AlertsPanel expiringAccess={[]} failedPaymentsCount={1} />,
    )

    expect(screen.getByText("Paiements échoués")).toBeInTheDocument()
    expect(
      screen.getByText("1 paiement ces 7 derniers jours"),
    ).toBeInTheDocument()
  })

  it("affiche l'alerte de paiements échoués au pluriel", () => {
    render(
      <AlertsPanel expiringAccess={[]} failedPaymentsCount={4} />,
    )

    expect(
      screen.getByText("4 paiements ces 7 derniers jours"),
    ).toBeInTheDocument()
  })

  it("affiche le nombre en badge pour les alertes avec compteur", () => {
    render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({ accessType: "exam" }),
          createExpiringAccess({ accessType: "exam" }),
        ]}
        failedPaymentsCount={3}
      />,
    )

    // Badge count pour accès examens
    expect(screen.getByText("2")).toBeInTheDocument()
    // Badge count pour paiements échoués
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("crée des liens vers les pages appropriées", () => {
    const { container } = render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({ accessType: "exam" }),
        ]}
        failedPaymentsCount={2}
      />,
    )

    const links = container.querySelectorAll("a")
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"))

    expect(hrefs).toContain("/admin/users")
    expect(hrefs).toContain("/admin/transactions?status=failed")
  })

  it("utilise le fallback quand le nom de l'utilisateur est null", () => {
    render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({
            accessType: "exam",
            daysRemaining: 3,
            name: null,
          }),
        ]}
        failedPaymentsCount={0}
      />,
    )

    expect(
      screen.getByText("1 utilisateur - 3j restants"),
    ).toBeInTheDocument()
  })
})
