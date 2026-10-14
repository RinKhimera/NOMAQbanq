import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ExamHistory } from "@/app/(dashboard)/tableau-de-bord/progression/_components/exam-history"
import type {
  ExamHistoryRow,
  MyExamHistoryPage,
} from "@/features/analytics/dal"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
  usePathname: () => "/tableau-de-bord/progression",
  useSearchParams: () => new URLSearchParams("periode=7"),
}))
vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => null,
}))

const NOW = Date.UTC(2026, 9, 13, 12)
const DAY = 24 * 60 * 60 * 1000

const exam = (over: Partial<ExamHistoryRow>): ExamHistoryRow => ({
  examId: "e1",
  title: "Examen blanc 25",
  questionCount: 230,
  score: 78,
  completedAt: NOW - 10 * DAY,
  endDate: NOW - 9 * DAY,
  ...over,
})

const page = (
  items: ExamHistoryRow[],
  over: Partial<MyExamHistoryPage> = {},
): MyExamHistoryPage => ({
  items,
  firstIndex: 0,
  total: items.length,
  prevCursor: null,
  nextCursor: null,
  ...over,
})

const rows = () => screen.getAllByTestId("exam-history-row")

describe("ExamHistory", () => {
  it("affiche score, verdict, percentile et lien vers les résultats d'un examen clos", () => {
    render(
      <ExamHistory
        history={page([exam({})])}
        percentiles={{ e1: 68 }}
        isAdmin={false}
        now={NOW}
      />,
    )
    const row = rows()[0]!
    expect(row).toHaveTextContent("78 %")
    expect(row).toHaveTextContent("Réussi")
    expect(row).toHaveTextContent("mieux que 68 %")
    expect(within(row).getByRole("link", { name: /Résultats/ })).toBeVisible()
  })

  it("rend « — » quand le percentile est absent", () => {
    render(
      <ExamHistory
        history={page([exam({})])}
        percentiles={{}}
        isAdmin={false}
        now={NOW}
      />,
    )
    expect(screen.getByTestId("exam-history-percentile")).toHaveTextContent("—")
  })

  it("un score retenu se lit « À la clôture », sans verdict, percentile ni lien", () => {
    render(
      <ExamHistory
        history={page([
          exam({ score: null, endDate: NOW + DAY, completedAt: NOW - DAY }),
        ])}
        percentiles={{ e1: 50 }}
        isAdmin={false}
        now={NOW}
      />,
    )
    const row = rows()[0]!
    expect(row).toHaveTextContent("À la clôture")
    expect(row).not.toHaveTextContent("Réussi")
    expect(row).not.toHaveTextContent("À améliorer")
    expect(screen.getByTestId("exam-history-percentile")).toHaveTextContent("—")
    expect(within(row).queryByRole("link")).toBeNull()
  })

  it("pagine par 10 et garde la période dans l'URL", async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      exam({ examId: `e${i}`, title: `Examen ${i}` }),
    )
    render(
      <ExamHistory
        history={page(items, {
          total: 23,
          firstIndex: 10,
          prevCursor: "haut",
          nextCursor: "bas",
        })}
        percentiles={{}}
        isAdmin={false}
        now={NOW}
      />,
    )
    expect(screen.getByText("11–20 sur 23 examens")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Page suivante" }))
    expect(push).toHaveBeenCalledWith(
      "/tableau-de-bord/progression?periode=7&apres=bas",
      { scroll: false },
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Page précédente" }),
    )
    expect(push).toHaveBeenLastCalledWith(
      "/tableau-de-bord/progression?periode=7&avant=haut",
      { scroll: false },
    )
  })

  it("ne montre pas de pagination sur une seule page", () => {
    render(
      <ExamHistory
        history={page([exam({})])}
        percentiles={{}}
        isAdmin={false}
        now={NOW}
      />,
    )
    expect(screen.queryByRole("button", { name: "Page suivante" })).toBeNull()
  })

  it("invite à passer un examen quand l'historique est vide", () => {
    render(
      <ExamHistory
        history={page([])}
        percentiles={{}}
        isAdmin={false}
        now={NOW}
      />,
    )
    expect(screen.getByText("Aucun examen blanc complété")).toBeInTheDocument()
  })
})
