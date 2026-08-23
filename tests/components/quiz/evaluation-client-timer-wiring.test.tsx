import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EvaluationClient } from "@/app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client"
import type { QuizMode } from "@/components/quiz/runner/types"

const receivedModes: QuizMode[] = []

vi.mock("@/components/quiz/runner/quiz-runner", () => ({
  QuizRunner: ({ mode }: { mode: QuizMode }) => {
    receivedModes.push(mode)
    return <div data-testid="quiz-runner-stub" />
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/features/exams/actions", () => ({
  finalizeExam: vi.fn(),
  pauseExam: vi.fn(),
  resumeExam: vi.fn(),
  saveExamAnswer: vi.fn(),
  saveExamFlag: vi.fn(),
  startExam: vi.fn(),
}))

vi.mock("@/lib/safe-action", () => ({
  callAction: vi.fn(),
}))

const SERVER_START = 1_700_000_000_000
const SERVER_NOW = SERVER_START + 120_000

const renderResumed = (initialNow: number) =>
  render(
    <EvaluationClient
      examId="exam-1"
      exam={{
        title: "Examen",
        completionTime: 3600,
        enablePause: false,
        pauseDurationMinutes: null,
      }}
      questions={[
        {
          _id: "q1",
          _creationTime: 0,
          question: "Question ?",
          options: ["A", "B"],
          objectifCMC: "obj",
          domain: "Cardiologie",
          images: [],
        },
      ]}
      initialSession={{
        participationId: "p1",
        status: "in_progress",
        startedAt: SERVER_START,
        completedAt: null,
        score: 0,
        isPaused: false,
        pauseStartedAt: null,
        totalPauseDurationMs: 0,
      }}
      initialAnswersRaw={[]}
      initialNow={initialNow}
    />,
  )

beforeEach(() => {
  receivedModes.length = 0
})

describe("EvaluationClient — câblage du chrono", () => {
  it("transmet l'horloge serveur reçue en prop comme ancre du chrono", () => {
    // Verrouille la SOURCE de l'ancre : le hook est déjà protégé par ses propres
    // tests, mais rien n'empêcherait de le nourrir avec un `Date.now()` local —
    // ce qui rétablirait le mismatch d'hydratation avec toute la suite au vert.
    renderResumed(SERVER_NOW)

    expect(receivedModes).toHaveLength(1)
    expect(receivedModes[0].timer).toEqual({
      serverStartTime: SERVER_START,
      totalSeconds: 3600,
      initialNow: SERVER_NOW,
    })
  })

  it("l'ancre suit la prop, elle n'est pas relue sur l'horloge locale", () => {
    // Test jumeau : une valeur qu'aucune horloge réelle ne produirait. Si
    // l'ancre venait de `Date.now()`, elle ne pourrait pas valoir ceci.
    renderResumed(42)

    expect(receivedModes[0].timer?.initialNow).toBe(42)
  })
})
