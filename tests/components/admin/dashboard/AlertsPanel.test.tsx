import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AlertsPanel } from "@/components/admin/dashboard/alerts-panel"

const createExpiringAccess = (
  overrides: {
    accessType?: "exam" | "training"
    daysRemaining?: number
    name?: string | null
  } = {},
) => ({
  id: `access-${Math.random()}`,
  userId: "user1",
  accessType: overrides.accessType ?? ("exam" as const),
  daysRemaining: overrides.daysRemaining ?? 3,
  user: {
    name: ("name" in overrides ? (overrides.name ?? null) : "Jean Dupont") as
      string | null,
    email: "jean@example.com" as string | undefined,
  },
})

describe("AlertsPanel", () => {
  it("affiche l'état vide quand il n'y a pas d'alertes", () => {
    render(<AlertsPanel expiringAccess={[]} failedClientsCount={0} />)

    expect(screen.getByText("Alertes")).toBeInTheDocument()
    expect(screen.getByText("Tout va bien")).toBeInTheDocument()
    expect(screen.getByText(/Aucune alerte à signaler/)).toBeInTheDocument()
  })

  it.each([
    ["exam", "Accès examens expirant"],
    ["training", "Accès entraînement expirant"],
  ] as const)("accès %s expirant → alerte « %s »", (accessType, title) => {
    render(
      <AlertsPanel
        expiringAccess={[createExpiringAccess({ accessType })]}
        failedClientsCount={0}
      />,
    )

    expect(screen.getByText(title)).toBeInTheDocument()
  })

  it.each([
    [
      "un utilisateur, pluriel",
      [{ daysRemaining: 5, name: "Marie Martin" }],
      "Marie Martin - 5 j restants",
    ],
    [
      "un utilisateur, singulier à 1 jour",
      [{ daysRemaining: 1, name: "Paul Tremblay" }],
      "Paul Tremblay - 1 j restant",
    ],
    [
      "nom absent → repli",
      [{ daysRemaining: 3, name: null }],
      "1 utilisateur - 3 j restants",
    ],
    [
      "plusieurs utilisateurs → minimum",
      [{ daysRemaining: 5 }, { daysRemaining: 2 }, { daysRemaining: 7 }],
      "3 utilisateurs, 2 j minimum",
    ],
  ])("description : %s", (_, items, description) => {
    render(
      <AlertsPanel
        expiringAccess={items.map((item) => createExpiringAccess(item))}
        failedClientsCount={0}
      />,
    )

    // getByText normalise l'espace insécable : le texte exact se vérifie à part.
    expect(screen.getByText(description).textContent).toBe(
      description.replace(" j ", " j "),
    )
  })

  it.each([
    [1, "1 client dont la dernière tentative a échoué"],
    [4, "4 clients dont la dernière tentative a échoué"],
  ])("%i paiement(s) échoué(s) → « %s »", (failedClientsCount, description) => {
    render(
      <AlertsPanel
        expiringAccess={[]}
        failedClientsCount={failedClientsCount}
      />,
    )

    expect(screen.getByText("Paiements échoués")).toBeInTheDocument()
    expect(screen.getByText(description)).toBeInTheDocument()
  })

  it("affiche le nombre en badge pour les alertes avec compteur", () => {
    render(
      <AlertsPanel
        expiringAccess={[
          createExpiringAccess({ accessType: "exam" }),
          createExpiringAccess({ accessType: "exam" }),
        ]}
        failedClientsCount={3}
      />,
    )

    expect(screen.getByText("Alertes")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("crée des liens vers les pages appropriées", () => {
    render(
      <AlertsPanel
        expiringAccess={[createExpiringAccess({ accessType: "exam" })]}
        failedClientsCount={2}
      />,
    )

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"))

    expect(hrefs).toContain("/admin/utilisateurs?segment=bientot")
    expect(hrefs).toContain("/admin/transactions?filtre=echec")
  })
})
