import { render, screen } from "@testing-library/react"
import { type ComponentProps, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed"

// Radix ScrollArea (ResizeObserver) -> stub passthrough en happy-dom.
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

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
  it("affiche l'etat vide quand il n'y a aucune activite", () => {
    render(<ActivityFeed activities={[]} />)
    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument()
  })

  it("rend chaque type d'activite (inscription, paiement, examen)", () => {
    const { container } = render(<ActivityFeed activities={activities} />)
    expect(screen.getByText("Activité récente")).toBeInTheDocument()
    // user_signup
    expect(container.textContent).toContain("Alice")
    expect(container.textContent).toContain("alice@example.com")
    // payment (+ badge "Manuel" sur paiement manuel)
    expect(container.textContent).toContain("a payé")
    expect(container.textContent).toContain("Manuel")
    // exam_completed (scores haut/moyen/bas + null)
    expect(container.textContent).toContain("85%")
    expect(container.textContent).toContain("Blanc 4")
  })
})
