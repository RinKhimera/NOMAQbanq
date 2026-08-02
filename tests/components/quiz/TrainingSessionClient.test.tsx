import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrainingSessionClient } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client"

const { setQuestionBookmark, toastError, runnerProps } = vi.hoisted(() => ({
  setQuestionBookmark: vi.fn(),
  toastError: vi.fn(),
  runnerProps: { current: null as Record<string, unknown> | null },
}))

// Mock COMPLET : `callAction` importe `unstable_isUnrecognizedActionError` de
// `next/navigation` — un mock partiel casse le chemin d'échec avec une erreur
// cryptique (piège documenté dans `.claude/rules/data-layer.md`).
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }))
vi.mock("@/features/training/actions", () => ({
  saveTrainingAnswer: vi.fn(),
  completeTrainingSession: vi.fn(),
  setQuestionBookmark,
}))
// Le runner complet (timers, Radix, motion) est hors sujet : on capture ses props.
vi.mock("@/components/quiz/runner/quiz-runner", () => ({
  QuizRunner: (props: Record<string, unknown>) => {
    runnerProps.current = props
    return <div data-testid="runner-stub" />
  },
}))

const initialData = {
  session: {
    id: "s1",
    questionCount: 1,
    status: "in_progress" as const,
    mode: "test" as const,
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
  callbacks: {
    onFlag: (id: string, flagged: boolean) => Promise<{ ok: boolean }>
  }
}

describe("TrainingSessionClient — marquage", () => {
  it("hydrate les signets et persiste la bascule", async () => {
    setQuestionBookmark.mockResolvedValue({ success: true })

    render(<TrainingSessionClient sessionId="s1" initialData={initialData} />)

    const props = runnerProps.current as unknown as CapturedProps
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

    render(<TrainingSessionClient sessionId="s1" initialData={initialData} />)
    const props = runnerProps.current as unknown as CapturedProps

    // `callAction` convertit le rejet réseau en `{ success: false }` — le garde
    // doit le voir passer, pas le laisser filer en rejet non géré.
    const res = await props.callbacks.onFlag("q1", true)
    expect(res.ok).toBe(false)
    expect(toastError).toHaveBeenCalledWith(
      "Marquage non enregistré, réessayez.",
    )
  })
})
