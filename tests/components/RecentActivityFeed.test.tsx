import { render, screen } from "@testing-library/react"
import { type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { RecentActivityFeed } from "@/app/(dashboard)/tableau-de-bord/_components/recent-activity-feed"
import { SCORE_WITHHELD_MESSAGE } from "@/components/quiz/runner/types"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => null,
}))

vi.mock("@/components/shared/relative-time", () => ({
  RelativeTime: () => <span>il y a peu</span>,
}))

const NOW = Date.UTC(2026, 8, 18, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

const closedExam = (id: string, score: number | null) => ({
  id,
  title: `Examen ${id}`,
  startDate: NOW - 5 * DAY,
  endDate: NOW - DAY,
  isCompleted: true,
  score,
  completedAt: NOW - 2 * DAY,
})

describe("RecentActivityFeed — score retenu", () => {
  it("rend « — » neutre et expliqué pour un score null, le pourcentage sinon", () => {
    render(
      <RecentActivityFeed
        recentExams={[closedExam("a", null), closedExam("b", 72)]}
        now={NOW}
      />,
    )
    const withheld = screen.getByTitle(SCORE_WITHHELD_MESSAGE)
    expect(withheld.textContent).toBe("—")
    expect(withheld.className).not.toMatch(/red|emerald/)
    expect(screen.getByText("72%")).toBeInTheDocument()
    expect(screen.queryByText("%")).toBeNull()
  })
})

describe("RecentActivityFeed — percentile d'examen", () => {
  it("situe chaque examen dont le percentile existe, et lui seul", () => {
    render(
      <RecentActivityFeed
        recentExams={[closedExam("a", 72), closedExam("b", 55)]}
        percentiles={{ a: 80, b: null }}
        now={NOW}
      />,
    )
    const shown = screen.getAllByTestId("exam-percentile")
    expect(shown).toHaveLength(1)
    expect(shown[0]).toHaveTextContent(
      "Vous avez fait mieux que 80 % des autres participants",
    )
  })
})
