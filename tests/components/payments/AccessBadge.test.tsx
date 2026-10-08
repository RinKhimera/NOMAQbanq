import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  AccessBadge,
  getAccessStatus,
} from "@/components/shared/payments/access-badge"

describe("AccessBadge", () => {
  it.each([
    ["active", "Actif"],
    ["expiring", "Expire bientôt"],
    ["expired", "Expiré"],
    ["none", "Aucun accès"],
  ] as const)("statut %s sans jours restants → « %s »", (status, label) => {
    render(<AccessBadge accessType="exam" status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  describe("showDetails", () => {
    it("affiche le label du type d'accès exam quand showDetails est true", () => {
      render(<AccessBadge accessType="exam" status="active" showDetails />)
      expect(screen.getByText(/Examens/)).toBeInTheDocument()
    })

    it("affiche le label du type d'accès training quand showDetails est true", () => {
      render(<AccessBadge accessType="training" status="active" showDetails />)
      expect(screen.getByText(/Entraînement/)).toBeInTheDocument()
    })

    it("n'affiche pas le label du type d'accès quand showDetails est false", () => {
      render(
        <AccessBadge accessType="exam" status="active" showDetails={false} />,
      )
      expect(screen.queryByText(/Examens/)).not.toBeInTheDocument()
    })
  })

  describe("affichage des jours restants", () => {
    it("affiche les jours restants pour le statut expiring", () => {
      render(
        <AccessBadge accessType="exam" status="expiring" daysRemaining={3} />,
      )
      expect(screen.getByText("3j restants")).toBeInTheDocument()
    })

    it("affiche les jours restants pour le statut active", () => {
      render(
        <AccessBadge accessType="exam" status="active" daysRemaining={45} />,
      )
      expect(screen.getByText("45j restants")).toBeInTheDocument()
    })
  })
})

describe("getAccessStatus", () => {
  const DAY = 24 * 60 * 60 * 1000
  const future = Date.now() + 30 * DAY
  const past = Date.now() - 100_000

  it.each([
    ["expiresAt null", "none", null, 10],
    ["expiresAt undefined", "none", undefined, 10],
    ["daysRemaining tombé à 0", "expired", past, 0],
    ["daysRemaining = 7", "expiring", future, 7],
    ["daysRemaining > 7", "active", future, 30],
    ["daysRemaining null", "active", future, null],
    ["daysRemaining undefined", "active", future, undefined],
  ] as const)("%s → %s", (_, expected, expiresAt, daysRemaining) => {
    expect(getAccessStatus(expiresAt, daysRemaining)).toBe(expected)
  })

  it("ne lit pas l'horloge : daysRemaining fait seul foi contre expiresAt", () => {
    expect(getAccessStatus(Date.now() + 1000, 0)).toBe("expired")
    expect(getAccessStatus(past, 30)).toBe("active")
  })
})
