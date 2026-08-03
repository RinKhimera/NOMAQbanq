import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrainingSessionClient } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client"
// Type seulement : le module `server-only` est effacé à la compilation.
import type { TrainingSessionView } from "@/features/training/dal"

type SessionData = NonNullable<TrainingSessionView>

const {
  setQuestionBookmark,
  saveTrainingAnswer,
  completeTrainingSession,
  toastError,
  toastSuccess,
  push,
  runnerProps,
} = vi.hoisted(() => ({
  setQuestionBookmark: vi.fn(),
  saveTrainingAnswer: vi.fn(),
  completeTrainingSession: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  push: vi.fn(),
  runnerProps: { current: null as Record<string, unknown> | null },
}))

// Mock COMPLET : `callAction` importe `unstable_isUnrecognizedActionError` de
// `next/navigation` — un mock partiel casse le chemin d'échec avec une erreur
// cryptique (piège documenté dans `.claude/rules/data-layer.md`).
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))
vi.mock("@/features/training/actions", () => ({
  saveTrainingAnswer,
  completeTrainingSession,
  setQuestionBookmark,
}))
// Le runner complet (timers, Radix, motion) est hors sujet : on capture ses props.
vi.mock("@/components/quiz/runner/quiz-runner", () => ({
  QuizRunner: (props: Record<string, unknown>) => {
    runnerProps.current = props
    return <div data-testid="runner-stub" />
  },
}))

const initialData: SessionData = {
  session: {
    id: "s1",
    questionCount: 1,
    status: "in_progress",
    mode: "test",
    domain: null,
    startedAt: 0,
    completedAt: null,
    expiresAt: Date.now() + 3_600_000,
    score: null,
  },
  questions: [
    {
      _id: "q1",
      _creationTime: 0,
      question: "Q1 ?",
      options: ["A", "B"],
      objectifCMC: "Obj",
      domain: "Cardiologie",
      images: [],
    },
  ],
  answers: {},
  bookmarkedIds: ["q1"],
  isExpired: false,
}

type CapturedProps = {
  initialFlags: Set<string>
  initialRevealed?: Record<string, unknown>
  callbacks: {
    onFlag: (id: string, flagged: boolean) => Promise<{ ok: boolean }>
    onAnswer: (
      id: string,
      answer: string,
    ) => Promise<{ ok: boolean; reveal?: unknown }>
    onFinish: () => Promise<{ ok: boolean; redirectTo?: string }>
  }
}

const mount = (data: SessionData = initialData) => {
  render(<TrainingSessionClient sessionId="s1" initialData={data} />)
  return runnerProps.current as unknown as CapturedProps
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TrainingSessionClient — marquage", () => {
  it("hydrate les signets et persiste la bascule", async () => {
    setQuestionBookmark.mockResolvedValue({ success: true })

    const props = mount()
    expect(props.initialFlags.has("q1")).toBe(true)

    const res = await props.callbacks.onFlag("q1", false)
    expect(res.ok).toBe(true)
    expect(setQuestionBookmark).toHaveBeenCalledWith({
      questionId: "q1",
      isBookmarked: false,
    })
  })

  it("signale un échec de marquage au lieu de mentir", async () => {
    setQuestionBookmark.mockRejectedValue(new Error("Failed to fetch"))

    const props = mount()

    // `callAction` convertit le rejet réseau en `{ success: false }` — le garde
    // doit le voir passer, pas le laisser filer en rejet non géré.
    const res = await props.callbacks.onFlag("q1", true)
    expect(res.ok).toBe(false)
    expect(toastError).toHaveBeenCalledWith(
      "Marquage non enregistré, réessayez.",
    )
  })
})

describe("TrainingSessionClient — session expirée", () => {
  it("rend l'écran d'expiration au lieu du runner", () => {
    render(
      <TrainingSessionClient
        sessionId="s1"
        initialData={{ ...initialData, isExpired: true }}
      />,
    )
    expect(screen.getByText("Session expirée")).toBeInTheDocument()
    expect(screen.queryByTestId("runner-stub")).not.toBeInTheDocument()
  })

  it("le bouton de retour ramène à l'entraînement", async () => {
    render(
      <TrainingSessionClient
        sessionId="s1"
        initialData={{ ...initialData, isExpired: true }}
      />,
    )
    await userEvent.click(
      screen.getByRole("button", { name: /Retour à l'entraînement/i }),
    )
    expect(push).toHaveBeenCalledWith("/tableau-de-bord/entrainement")
  })
})

describe("TrainingSessionClient — réponses et fin de session", () => {
  it("mode tuteur : hydrate les révélations et propage celle du serveur", async () => {
    saveTrainingAnswer.mockResolvedValue({
      success: true,
      isCorrect: true,
      reveal: { correctAnswer: "A", explanation: "Parce que.", references: [] },
    })

    const props = mount({
      ...initialData,
      session: { ...initialData.session, mode: "tutor" },
      questions: [
        {
          ...initialData.questions[0],
          correctAnswer: "A",
          explanation: "Déjà répondue",
          references: ["Ref"],
        },
      ],
    })

    expect(props.initialRevealed).toHaveProperty("q1")

    const res = await props.callbacks.onAnswer("q1", "A")
    expect(res.ok).toBe(true)
    expect(res.reveal).toMatchObject({ correctAnswer: "A" })
  })

  it("signale une réponse non enregistrée", async () => {
    saveTrainingAnswer.mockResolvedValue({
      success: false,
      error: "Session expirée",
    })

    const props = mount()
    const res = await props.callbacks.onAnswer("q1", "A")

    expect(res.ok).toBe(false)
    expect(toastError).toHaveBeenCalledWith(
      "Réponse non enregistrée, réessayez.",
    )
  })

  it("redirige vers les résultats à la fin", async () => {
    completeTrainingSession.mockResolvedValue({ success: true, score: 100 })

    const props = mount()
    const res = await props.callbacks.onFinish()

    expect(res.ok).toBe(true)
    expect(res.redirectTo).toBe("/tableau-de-bord/entrainement/s1/resultats")
    expect(push).toHaveBeenCalledWith(
      "/tableau-de-bord/entrainement/s1/resultats",
    )
    expect(toastSuccess).toHaveBeenCalled()
  })

  it("ne redirige pas si la clôture échoue", async () => {
    completeTrainingSession.mockResolvedValue({
      success: false,
      error: "Session introuvable",
    })

    const props = mount()
    const res = await props.callbacks.onFinish()

    expect(res.ok).toBe(false)
    expect(res.redirectTo).toBeUndefined()
    expect(toastError).toHaveBeenCalledWith("Erreur", {
      description: "Session introuvable",
    })
  })
})
