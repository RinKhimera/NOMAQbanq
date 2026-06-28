import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type {
  AnswersMap,
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
} from "@/components/quiz/runner/types"
import { useQuizSession } from "@/components/quiz/runner/use-quiz-session"

// ---- Helpers ----

const makeQuestions = (count: number): QuizQuestion[] =>
  Array.from({ length: count }, (_, i) => ({
    _id: `q${i + 1}`,
    question: `Question ${i + 1} ?`,
    options: ["A", "B", "C", "D"],
  }))

const makeMode = (overrides: Partial<QuizMode> = {}): QuizMode => ({
  kind: "training",
  accent: "emerald",
  timer: null,
  pause: null,
  feedback: "deferred",
  showMeta: false,
  labels: { title: "Entraînement", finishCta: "Terminer" },
  backUrl: "/entrainement",
  ...overrides,
})

const makeCallbacks = (
  overrides: Partial<QuizCallbacks> = {},
): QuizCallbacks => ({
  onAnswer: vi.fn().mockResolvedValue({ ok: true }),
  onFlag: vi.fn().mockResolvedValue(undefined),
  onFinish: vi.fn().mockResolvedValue({ ok: true }),
  ...overrides,
})

// ---- Tests ----

describe("useQuizSession — navigation", () => {
  it("démarre à l'index 0", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(5),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentQuestion?._id).toBe("q1")
  })

  it("goNext avance et est borné", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    act(() => result.current.goNext())
    expect(result.current.currentIndex).toBe(1)
    act(() => result.current.goNext())
    act(() => result.current.goNext())
    expect(result.current.currentIndex).toBe(2) // bornée à totalQuestions-1
  })

  it("goPrevious recule et est borné", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    act(() => result.current.goPrevious())
    expect(result.current.currentIndex).toBe(0) // déjà à 0
    act(() => result.current.goNext())
    act(() => result.current.goPrevious())
    expect(result.current.currentIndex).toBe(0)
  })

  it("goTo navigue vers un index valide", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(5),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    act(() => result.current.goTo(3))
    expect(result.current.currentIndex).toBe(3)
  })

  it("goTo ignore les index hors-limites", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    act(() => result.current.goTo(99))
    expect(result.current.currentIndex).toBe(0) // inchangé
    act(() => result.current.goTo(-1))
    expect(result.current.currentIndex).toBe(0) // inchangé
  })
})

describe("useQuizSession — answerSelect", () => {
  it("answerSelect persiste et applique la révélation en mode immédiat", async () => {
    const onAnswer = vi.fn().mockResolvedValue({
      ok: true,
      reveal: { correctAnswer: "B", explanation: "e", references: [] },
    })
    const { result } = renderHook(() =>
      useQuizSession({
        questions: [{ _id: "q1", question: "?", options: ["A", "B"] }],
        initialAnswers: {},
        mode: makeMode({
          kind: "training",
          feedback: "immediate",
        }),
        callbacks: makeCallbacks({ onAnswer }),
      }),
    )
    await act(async () => {
      await result.current.answerSelect(1) // "B"
    })
    expect(onAnswer).toHaveBeenCalledWith("q1", "B")
    expect(result.current.answers["q1"]).toEqual({
      selected: "B",
      isCorrect: true,
    })
    expect(result.current.revealed["q1"]).toBeTruthy()
    expect(result.current.revealed["q1"]?.correctAnswer).toBe("B")
  })

  it("answerSelect en mode deferred ne stocke pas isCorrect", async () => {
    const onAnswer = vi.fn().mockResolvedValue({ ok: true }) // no reveal
    const { result } = renderHook(() =>
      useQuizSession({
        questions: [{ _id: "q1", question: "?", options: ["A", "B"] }],
        initialAnswers: {},
        mode: makeMode({ feedback: "deferred" }),
        callbacks: makeCallbacks({ onAnswer }),
      }),
    )
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answers["q1"]?.selected).toBe("A")
    expect(result.current.answers["q1"]?.isCorrect).toBeUndefined()
    expect(result.current.revealed["q1"]).toBeUndefined()
  })

  it("answerSelect ne met pas à jour si onAnswer retourne ok:false", async () => {
    const onAnswer = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Serveur KO" })
    const { result } = renderHook(() =>
      useQuizSession({
        questions: [{ _id: "q1", question: "?", options: ["A", "B"] }],
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks({ onAnswer }),
      }),
    )
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answers["q1"]).toBeUndefined()
  })

  it("answeredCount augmente à chaque nouvelle réponse", async () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.answeredCount).toBe(0)
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answeredCount).toBe(1)
  })
})

describe("useQuizSession — initialAnswers & initialFlags", () => {
  it("initialise les réponses depuis initialAnswers", () => {
    const initialAnswers: AnswersMap = { q1: { selected: "A" } }
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers,
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.answers["q1"]).toEqual({ selected: "A" })
    expect(result.current.answeredCount).toBe(1)
  })

  it("réhydrate les flags depuis initialFlags", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        initialFlags: new Set(["q1", "q3"]),
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.flagged.has("q1")).toBe(true)
    expect(result.current.flagged.has("q3")).toBe(true)
    expect(result.current.flagged.has("q2")).toBe(false)
  })

  it("fonctionne sans initialFlags (défaut vide)", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(2),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.flagged.size).toBe(0)
  })
})

describe("useQuizSession — toggle flag", () => {
  it("toggleFlag ajoute et retire la question courante + appelle onFlag", () => {
    const onFlag = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks({ onFlag }),
      }),
    )
    act(() => result.current.toggleFlag())
    expect(result.current.flagged.has("q1")).toBe(true)
    expect(onFlag).toHaveBeenCalledWith("q1", true)

    act(() => result.current.toggleFlag())
    expect(result.current.flagged.has("q1")).toBe(false)
    expect(onFlag).toHaveBeenCalledWith("q1", false)
  })
})

describe("useQuizSession — finish dialog", () => {
  it("requestFinish ouvre le dialog", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(2),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.finishDialogOpen).toBe(false)
    act(() => result.current.requestFinish())
    expect(result.current.finishDialogOpen).toBe(true)
  })

  it("confirmFinish appelle onFinish avec isAutoSubmit false par défaut", async () => {
    const onFinish = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(2),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks({ onFinish }),
      }),
    )
    await act(async () => {
      await result.current.confirmFinish()
    })
    expect(onFinish).toHaveBeenCalledWith({ isAutoSubmit: false })
  })

  it("confirmFinish avec isAutoSubmit:true passe le flag", async () => {
    const onFinish = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(2),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks({ onFinish }),
      }),
    )
    await act(async () => {
      await result.current.confirmFinish({ isAutoSubmit: true })
    })
    expect(onFinish).toHaveBeenCalledWith({ isAutoSubmit: true })
  })
})

describe("useQuizSession — timer composé", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("timer est null quand mode.timer est null", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(2),
        initialAnswers: {},
        mode: makeMode({ timer: null }),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.timer).toBeNull()
  })

  it("timer expose remainingMs quand mode.timer est défini", () => {
    const start = Date.now()
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(2),
        initialAnswers: {},
        mode: makeMode({
          timer: { serverStartTime: start, totalSeconds: 3600 },
        }),
        callbacks: makeCallbacks(),
      }),
    )
    expect(result.current.timer).not.toBeNull()
    expect(result.current.timer?.remainingMs).toBeGreaterThan(0)
  })

  it("onExpire du timer appelle confirmFinish({isAutoSubmit:true})", async () => {
    const onFinish = vi.fn().mockResolvedValue({ ok: true })
    const start = Date.now()
    renderHook(() =>
      useQuizSession({
        questions: makeQuestions(2),
        initialAnswers: {},
        mode: makeMode({
          timer: { serverStartTime: start, totalSeconds: 1 },
        }),
        callbacks: makeCallbacks({ onFinish }),
      }),
    )
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(onFinish).toHaveBeenCalledWith({ isAutoSubmit: true })
  })
})

describe("useQuizSession — raccourcis clavier", () => {
  it("ArrowRight appelle goNext", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    expect(result.current.currentIndex).toBe(1)
  })

  it("ArrowLeft appelle goPrevious (borné à 0)", () => {
    const { result } = renderHook(() =>
      useQuizSession({
        questions: makeQuestions(3),
        initialAnswers: {},
        mode: makeMode(),
        callbacks: makeCallbacks(),
      }),
    )
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))
    })
    expect(result.current.currentIndex).toBe(0)
  })
})
