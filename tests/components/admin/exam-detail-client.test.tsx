import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExamDetailClient } from "@/app/(admin)/admin/examens/[id]/_components/exam-detail-client"
import type { DetailExam } from "@/app/(admin)/admin/examens/[id]/_components/exam-detail-model"
import type {
  ExamAudienceUser,
  ExamFigures,
  LeaderboardEntry,
} from "@/features/exams/dal"
import { detailExam } from "../../helpers/detail-exam"
import { DAY } from "../../helpers/time"

vi.mock("@/features/exams/actions", () => ({
  suspendExam: vi.fn(),
  liftExamSuspension: vi.fn(),
  setExamHidden: vi.fn(),
  deleteExam: vi.fn(),
}))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const now = Date.parse("2026-10-01T16:00:00Z")

const figures = (over: Partial<ExamFigures> = {}): ExamFigures => ({
  started: 0,
  submitted: 0,
  autoSubmitted: 0,
  inProgress: 0,
  average: null,
  best: null,
  passed: 0,
  eligible: 118,
  participations: 0,
  locked: false,
  ...over,
})

const leaderboard: LeaderboardEntry[] = [
  {
    participationId: "p1",
    user: {
      id: "u1",
      name: "Hélène Martin",
      username: "helene",
      image: null,
      flag: null,
    },
    score: 92,
    completedAt: now - DAY / 2,
    status: "completed",
  },
]

const audience: ExamAudienceUser[] = [
  { id: "u1", name: "Hélène Martin", email: "helene@example.com" },
]

const renderClient = (
  over: Partial<DetailExam> = {},
  figuresOver: Partial<ExamFigures> = {},
) =>
  render(
    <ExamDetailClient
      exam={detailExam(now, over)}
      figures={figures(figuresOver)}
      leaderboard={leaderboard}
      audience={audience}
      initialNow={now}
    />,
  )

describe("ExamDetailClient — préparation", () => {
  it("en retard : l'alerte porte « Finaliser », pas la carte de suivi", () => {
    renderClient({ finalizedAt: null, startDate: now - DAY })

    const alert = screen.getByTestId("alert-late-to-open")
    expect(within(alert).getByTestId("btn-finalize-exam")).toHaveAttribute(
      "href",
      "/admin/examens/modifier/exam-1",
    )
    expect(
      within(screen.getByTestId("exam-tracking-card")).queryByTestId(
        "btn-finalize-exam",
      ),
    ).toBeNull()
  })

  it("à l'heure : pas d'alerte, « Finaliser » dans la carte de suivi", () => {
    renderClient({ finalizedAt: null, startDate: now + 3 * DAY })

    expect(screen.queryByTestId("alert-late-to-open")).toBeNull()
    expect(
      within(screen.getByTestId("exam-tracking-card")).getByTestId(
        "btn-finalize-exam",
      ),
    ).toBeInTheDocument()
  })
})

describe("ExamDetailClient — suivi", () => {
  it("examen en cours : soumissions et classement provisoire", () => {
    renderClient({}, { started: 64, submitted: 41 })

    const card = screen.getByTestId("exam-tracking-card")
    expect(card).toHaveTextContent("41 soumis sur 64 commencés")
    expect(card.querySelector("[data-slot=progress-indicator]")).toHaveStyle({
      transform: "translateX(-35.9375%)",
    })
    expect(screen.getByTestId("leaderboard-provisional")).toBeInTheDocument()
  })

  it("examen terminé : ni suivi ni classement provisoire", () => {
    renderClient({ startDate: now - 5 * DAY, endDate: now - DAY })

    expect(screen.queryByTestId("exam-tracking-card")).toBeNull()
    expect(screen.queryByTestId("leaderboard-provisional")).toBeNull()
  })

  it("participations existantes : jeu de questions figé", () => {
    renderClient({}, { locked: true })

    expect(screen.getByTestId("alert-frozen-questions")).toBeInTheDocument()
  })

  it("sans participation : pas d'alerte de gel", () => {
    renderClient()

    expect(screen.queryByTestId("alert-frozen-questions")).toBeNull()
  })
})

describe("ExamDetailClient — audience", () => {
  it("abonnés : carte des éligibles, menant à l'étape Audience", () => {
    renderClient({ isHidden: true })

    expect(screen.getByTestId("subscribers-audience-card")).toHaveTextContent(
      "118 aujourd'hui.",
    )
    expect(screen.getByTestId("btn-edit-audience")).toHaveAttribute(
      "href",
      "/admin/examens/modifier/exam-1#audience",
    )
    expect(screen.getByTestId("exam-badges")).toHaveTextContent(
      "Abonnés Examens, masqué",
    )
    expect(screen.queryByTestId("restricted-audience-card")).toBeNull()
  })

  it("restreinte : la liste des invités", () => {
    renderClient({ audienceType: "restricted" })

    expect(screen.getByTestId("restricted-audience-card")).toBeInTheDocument()
    expect(screen.getByTestId("audience-member-u1")).toBeInTheDocument()
    expect(screen.queryByTestId("subscribers-audience-card")).toBeNull()
  })
})
