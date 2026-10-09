import { describe, expect, it, vi } from "vitest"
import EvaluationPage from "@/app/(passation)/tableau-de-bord/examen-blanc/[examId]/evaluation/page"
import {
  type ExamSessionView,
  type ExamWithQuestions,
  getExamAnswersForParticipation,
  getExamSession,
  getExamWithQuestions,
} from "@/features/exams/dal"

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock("next/navigation", () => ({ redirect }))
vi.mock(
  "@/app/(passation)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client",
  () => ({ EvaluationClient: () => null }),
)
vi.mock("@/features/exams/dal", () => ({
  getExamSession: vi.fn(),
  getExamWithQuestions: vi.fn(),
  getExamAnswersForParticipation: vi.fn(),
}))
vi.mock("@/lib/clock", () => ({ currentTimeMs: () => 0 }))

const data = (isActive: boolean): ExamWithQuestions => ({
  exam: {
    id: "e1",
    title: "Examen blanc 30",
    description: null,
    startDate: 0,
    endDate: 1,
    completionTime: 60,
    isActive,
    enablePause: false,
    pauseDurationMinutes: null,
    questionCount: 0,
    audienceType: "subscribers",
  },
  questions: [],
})

const inProgress: ExamSessionView = {
  participationId: "p1",
  status: "in_progress",
  startedAt: 0,
  completedAt: null,
  isPaused: false,
  pauseStartedAt: null,
  totalPauseDurationMs: null,
}

const renderPage = () =>
  EvaluationPage({ params: Promise.resolve({ examId: "e1" }) })

describe("page de passation d'un examen blanc", () => {
  it("examen suspendu sans participation : renvoie vers la liste, rien à commencer", async () => {
    vi.mocked(getExamSession).mockResolvedValue(null)
    vi.mocked(getExamWithQuestions).mockResolvedValue(data(false))

    await expect(renderPage()).rejects.toThrow(
      "REDIRECT /tableau-de-bord/examen-blanc",
    )
  })

  it("examen suspendu avec une participation en cours : la passation continue", async () => {
    vi.mocked(getExamSession).mockResolvedValue(inProgress)
    vi.mocked(getExamWithQuestions).mockResolvedValue(data(false))
    vi.mocked(getExamAnswersForParticipation).mockResolvedValue([])

    await expect(renderPage()).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
