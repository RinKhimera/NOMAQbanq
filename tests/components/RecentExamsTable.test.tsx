import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RecentExamsTable } from "@/app/(dashboard)/tableau-de-bord/_components/recent-exams-table"
import type { RecentParticipation } from "@/features/analytics/dal"

const NOW = Date.parse("2026-10-08T15:00:00Z")
const DAY = 24 * 60 * 60 * 1000

const participation = (
  over: Partial<RecentParticipation> = {},
): RecentParticipation => ({
  examId: "ex-25",
  title: "Examen blanc 25",
  questionCount: 230,
  score: 72,
  completedAt: NOW - 10 * DAY,
  endDate: NOW - 7 * DAY,
  ...over,
})

const renderTable = (p: RecentParticipation, isAdmin = false) =>
  render(
    <RecentExamsTable
      participations={[p]}
      percentiles={{}}
      isAdmin={isAdmin}
      now={NOW}
    />,
  )

describe("RecentExamsTable", () => {
  it("examen clos : « Résultats » mène au classement", () => {
    renderTable(participation())

    expect(screen.getByRole("link", { name: /Résultats/ })).toHaveAttribute(
      "href",
      "/tableau-de-bord/examen-blanc/ex-25",
    )
  })

  it("examen encore ouvert : aucun lien pour un étudiant", () => {
    renderTable(participation({ score: null, endDate: NOW + DAY }))

    expect(
      screen.queryByRole("link", { name: /Résultats/ }),
    ).not.toBeInTheDocument()
  })

  it("examen encore ouvert lu par un admin : la correction, le classement n'existant qu'à la clôture", () => {
    renderTable(participation({ endDate: NOW + DAY }), true)

    expect(screen.getByRole("link", { name: /Résultats/ })).toHaveAttribute(
      "href",
      "/tableau-de-bord/examen-blanc/ex-25/resultats",
    )
  })
})
