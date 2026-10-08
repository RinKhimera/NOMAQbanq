import { render, screen } from "@testing-library/react"
import { type ComponentProps } from "react"
import { describe, expect, it } from "vitest"
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed"

type Activities = ComponentProps<typeof ActivityFeed>["activities"]

const activities: Activities = [
  {
    type: "user_signup",
    timestamp: 1_700_000_000_000,
    data: { userName: "Alice", userEmail: "alice@example.com" },
  },
  {
    type: "payment",
    timestamp: 1_700_000_001_000,
    data: {
      userName: "Bob",
      amount: 5000,
      currency: "CAD",
      productName: "Premium",
      paymentType: "stripe",
    },
  },
  {
    type: "payment",
    timestamp: 1_700_000_002_000,
    data: {
      userName: "Carl",
      amount: 9900,
      currency: "CAD",
      productName: "Annuel",
      paymentType: "manual",
    },
  },
  {
    type: "exam_completed",
    timestamp: 1_700_000_003_000,
    data: { userName: "Dina", examTitle: "Blanc 1", score: 85 },
  },
  {
    type: "exam_completed",
    timestamp: 1_700_000_004_000,
    data: { userName: "Eve", examTitle: "Blanc 2", score: 55 },
  },
  {
    type: "exam_completed",
    timestamp: 1_700_000_005_000,
    data: { userName: "Fay", examTitle: "Blanc 3", score: 30 },
  },
  {
    type: "exam_completed",
    timestamp: 1_700_000_006_000,
    data: { userName: "Gus", examTitle: "Blanc 4", score: null },
  },
]

describe("ActivityFeed", () => {
  it("affiche l'état vide quand il n'y a aucune activité", () => {
    render(<ActivityFeed activities={[]} />)
    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument()
  })

  it("rend chaque type d'activité (inscription, paiement, examen)", () => {
    const { container } = render(<ActivityFeed activities={activities} />)
    expect(screen.getByText("Dernières actions")).toBeInTheDocument()
    expect(container.textContent).toContain("Alice")
    expect(container.textContent).toContain("alice@example.com")
    expect(container.textContent).toContain("Paiement reçu")
    expect(container.textContent).toContain("Manuel")
    expect(container.textContent).toMatch(/85\s%/)
    expect(container.textContent).toContain("Blanc 4")
  })
})
