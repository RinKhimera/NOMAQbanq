import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  ProgressionEmpty,
  ProgressionView,
} from "@/app/(dashboard)/tableau-de-bord/progression/_components/progression-view"
import type {
  DomainProgress,
  MyDashboard,
  MyExamHistoryPage,
  MyProgression,
} from "@/features/analytics/dal"

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/progression/u1",
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => null,
}))

const NOW = Date.UTC(2026, 9, 13, 12)
const DAY = 24 * 60 * 60 * 1000

const dashboard: MyDashboard = {
  exams: {
    averageScore: 64,
    averageTrend: -3,
    completedCount: 2,
    availableCount: 3,
    completedOfAvailableCount: 2,
    gradedCount: 1,
    passedCount: 1,
    periodGradedCount: 1,
    periodPassedCount: 1,
    overallAverage: 64,
    history: [],
  },
  training: { sessionCount: 2, questionCount: 40, weekly: [] },
  hasHistory: true,
}

const domain = (over: Partial<DomainProgress>): DomainProgress => ({
  domain: "Cardiologie",
  total: 170,
  answered: 138,
  mastery: 72,
  trend: 4,
  periodAnswers: 142,
  objectives: [],
  revision: { failed: 9, unseen: 32, bookmarked: 2 },
  ...over,
})

const progression: MyProgression = {
  domains: [
    domain({}),
    domain({
      domain: "Neurologie",
      answered: 0,
      mastery: null,
      trend: null,
      periodAnswers: 0,
    }),
  ],
  trainingAccess: true,
  activity: { days: 3, firstDay: "2026-10-01" },
}

const history: MyExamHistoryPage = {
  items: [
    {
      examId: "closed",
      title: "Examen clos",
      questionCount: 230,
      score: 64,
      completedAt: NOW - 10 * DAY,
      endDate: NOW - 9 * DAY,
    },
    // Encore ouvert : score retenu pour l'étudiant.
    {
      examId: "open",
      title: "Examen ouvert",
      questionCount: 230,
      score: null,
      completedAt: NOW - DAY,
      endDate: NOW + DAY,
    },
  ],
  firstIndex: 0,
  total: 2,
  prevCursor: null,
  nextCursor: null,
}

const student = { id: "u1", name: "Awa Diallo", ficheHref: "/fiche/u1" }

const renderAdmin = () =>
  render(
    <ProgressionView
      period="30"
      dashboard={dashboard}
      progression={progression}
      history={history}
      percentiles={{ closed: 40 }}
      isAdmin
      now={NOW}
      student={student}
    />,
  )

describe("ProgressionView — vue admin d'un étudiant", () => {
  it("titre au nom de l'étudiant et introduction à la troisième personne", () => {
    renderAdmin()
    expect(
      screen.getByRole("heading", { level: 1, name: "Awa Diallo" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Son score moyen a reculé de 3 points sur 30 jours. Cardiologie reste son domaine le plus faible.",
      ),
    ).toBeInTheDocument()
  })

  it("ne porte aucune action étudiante, même domaine déplié", async () => {
    renderAdmin()
    await userEvent.click(screen.getByRole("button", { name: "Cardiologie" }))

    const links = screen.getAllByRole("link").map((l) => l.textContent ?? "")
    for (const label of [
      "Commencer",
      "Revoir mes ratées",
      "Questions non vues",
      "Mes marquées",
      "Prolonger",
      "Historique des séries",
      "Résultats",
    ]) {
      expect(links.some((t) => t.includes(label))).toBe(false)
    }
  })

  it("mène chaque examen, ouvert compris, à la copie admin", () => {
    renderAdmin()
    const rows = screen.getAllByTestId("exam-history-row")
    expect(rows).toHaveLength(2)
    expect(rows[1]).toHaveTextContent("À la clôture")
    expect(
      rows.map((r) =>
        within(r)
          .getByRole("link", { name: /Voir la copie/ })
          .getAttribute("href"),
      ),
    ).toEqual([
      "/admin/examens/closed/resultats/u1",
      "/admin/examens/open/resultats/u1",
    ])
  })
})

describe("ProgressionEmpty — vue admin d'un étudiant", () => {
  it("dit l'absence d'activité et ne propose que la fiche", () => {
    render(<ProgressionEmpty trainingAccess student={student} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Awa Diallo" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Aucune activité pour le moment"),
    ).toBeInTheDocument()
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent("Voir la fiche")
    expect(links[0]).toHaveAttribute("href", "/fiche/u1")
  })
})
