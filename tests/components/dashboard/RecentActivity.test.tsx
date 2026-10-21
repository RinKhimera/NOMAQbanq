import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RecentActivity } from "@/app/(dashboard)/tableau-de-bord/_components/recent-activity"
import type { ActivityItem } from "@/features/analytics/dal"

const AT = Date.parse("2026-09-27T15:00:00Z")

const rowOf = (title: string) => screen.getByText(title).closest("li")

describe("RecentActivity", () => {
  it("sans activité : état vide", () => {
    render(<RecentActivity items={[]} />)
    expect(
      screen.getByText("Aucune activité pour le moment"),
    ).toBeInTheDocument()
    expect(screen.queryByRole("list")).toBeNull()
  })

  it("une ligne par action, libellée selon son genre", () => {
    const items: ActivityItem[] = [
      {
        kind: "exam",
        id: "e1",
        title: "Examen blanc de septembre",
        questionCount: 230,
        score: 72,
        at: AT,
      },
      {
        kind: "series",
        id: "s1",
        domain: "Pédiatrie",
        questionCount: 1,
        score: null,
        at: AT,
      },
      {
        kind: "series",
        id: "s2",
        domain: null,
        questionCount: 20,
        score: 55,
        at: AT,
      },
      {
        kind: "purchase",
        id: "p1",
        product: "Pack Premium",
        manual: false,
        at: AT,
      },
      { kind: "purchase", id: "p2", product: null, manual: true, at: AT },
    ]
    render(<RecentActivity items={items} />)

    expect(screen.getAllByRole("listitem")).toHaveLength(5)
    expect(rowOf("Examen blanc de septembre")).toHaveTextContent(
      "Examen blanc soumis · 230 questions · 72 %",
    )
    expect(rowOf("Série terminée · Pédiatrie")).toHaveTextContent(
      "1 question · —",
    )
    expect(rowOf("Série terminée · Tous domaines")).toHaveTextContent(
      "20 questions · 55 %",
    )
    expect(rowOf("Pack Premium")).toHaveTextContent("Paiement confirmé")
    expect(rowOf("Accès")).toHaveTextContent("Accès activé")
    expect(rowOf("Pack Premium")).toHaveTextContent("27 sept.")
  })
})
