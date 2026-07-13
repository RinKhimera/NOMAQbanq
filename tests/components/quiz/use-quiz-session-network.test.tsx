import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type {
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
} from "@/components/quiz/runner/types"
import { useQuizSession } from "@/components/quiz/runner/use-quiz-session"

const QUESTIONS: QuizQuestion[] = [
  { _id: "q1", question: "Q ?", options: ["A", "B", "C"], domain: "Cardio" },
]

const DEFERRED_MODE: QuizMode = {
  kind: "exam",
  accent: "blue",
  timer: null,
  pause: null,
  feedback: "deferred",
  showMeta: false,
  labels: { title: "t", finishCta: "Terminer" },
  backUrl: "/x",
}

const networkReject = () => Promise.reject(new TypeError("Failed to fetch"))

const makeCallbacks = (over: Partial<QuizCallbacks>): QuizCallbacks => ({
  onAnswer: vi.fn(async () => ({ ok: true }) as const),
  onFlag: vi.fn(async () => ({ ok: true })),
  onFinish: vi.fn(async () => ({ ok: true })),
  ...over,
})

const renderSession = (
  callbacks: QuizCallbacks,
  initialPause?: { isPaused: boolean; totalPauseDurationMs: number },
) =>
  renderHook(() =>
    useQuizSession({
      questions: QUESTIONS,
      initialAnswers: {},
      initialPause,
      mode: DEFERRED_MODE,
      callbacks,
    }),
  )

describe("use-quiz-session — rejets réseau des callbacks", () => {
  it("answerSelect : rollback de l'optimiste quand onAnswer rejette", async () => {
    const callbacks = makeCallbacks({ onAnswer: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answers["q1"]).toBeUndefined()
  })

  it("sérialisation : un clic pendant un envoi en vol est coalescé, envoyé après, sans rollback", async () => {
    let rejectA!: (e: unknown) => void
    const inFlightA = new Promise<never>((_, reject) => {
      rejectA = reject
    })
    const onAnswer = vi
      .fn()
      .mockReturnValueOnce(inFlightA) // clic A : reste en vol
      .mockResolvedValueOnce({ ok: true }) // clic B : réussit
    const { result } = renderSession(makeCallbacks({ onAnswer }))
    await act(async () => {
      void result.current.answerSelect(0) // A
    })
    await act(async () => {
      void result.current.answerSelect(1) // B pendant que A est en vol
    })
    expect(onAnswer).toHaveBeenCalledTimes(1) // B coalescé, pas encore parti
    await act(async () => {
      rejectA(new TypeError("Failed to fetch"))
    })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2))
    expect(onAnswer).toHaveBeenLastCalledWith("q1", "B")
    // L'échec de A (supersédé) ne rollback PAS l'optimiste de B
    expect(result.current.answers["q1"]?.selected).toBe("B")
  })

  it("un envoi supersédé qui RÉUSSIT devient la valeur confirmée (rollback vers A, pas vers rien)", async () => {
    let resolveA!: (v: { ok: true }) => void
    const inFlightA = new Promise<{ ok: true }>((resolve) => {
      resolveA = resolve
    })
    const onAnswer = vi
      .fn()
      .mockReturnValueOnce(inFlightA) // clic A : en vol
      .mockRejectedValueOnce(new TypeError("Failed to fetch")) // clic B : échoue
    const { result } = renderSession(makeCallbacks({ onAnswer }))
    await act(async () => {
      void result.current.answerSelect(0) // A
    })
    await act(async () => {
      void result.current.answerSelect(1) // B coalescé pendant que A est en vol
    })
    await act(async () => {
      resolveA({ ok: true }) // A réussit APRÈS le clic B → doit être confirmée
    })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2))
    // B échoue → rollback vers A (persistée), pas vers « sans réponse »
    await waitFor(() =>
      expect(result.current.answers["q1"]?.selected).toBe("A"),
    )
  })

  it("3 clics rapides : seuls le premier et le DERNIER partent (coalescing écrasé)", async () => {
    let resolveA!: (v: { ok: true }) => void
    const inFlightA = new Promise<{ ok: true }>((resolve) => {
      resolveA = resolve
    })
    const onAnswer = vi
      .fn()
      .mockReturnValueOnce(inFlightA)
      .mockResolvedValue({ ok: true })
    const { result } = renderSession(makeCallbacks({ onAnswer }))
    await act(async () => {
      void result.current.answerSelect(0) // A part
    })
    await act(async () => {
      void result.current.answerSelect(1) // B coalescé…
    })
    await act(async () => {
      void result.current.answerSelect(2) // …écrasé par C
    })
    await act(async () => {
      resolveA({ ok: true })
    })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2))
    expect(onAnswer).toHaveBeenLastCalledWith("q1", "C")
    expect(result.current.answers["q1"]?.selected).toBe("C")
  })

  it("rollback vers la dernière valeur CONFIRMÉE, pas l'état d'avant-clic", async () => {
    const onAnswer = vi
      .fn()
      .mockResolvedValueOnce({ ok: true }) // A persisté
      .mockRejectedValueOnce(new TypeError("Failed to fetch")) // B échoue
    const { result } = renderSession(makeCallbacks({ onAnswer }))
    await act(async () => {
      await result.current.answerSelect(0) // A confirmé serveur
    })
    await act(async () => {
      await result.current.answerSelect(1) // B échoue
    })
    expect(result.current.answers["q1"]?.selected).toBe("A")
  })

  it("toggleFlag : rollback du flag quand onFlag rejette", async () => {
    const callbacks = makeCallbacks({ onFlag: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    act(() => {
      result.current.toggleFlag()
    })
    await waitFor(() => expect(result.current.flagged.has("q1")).toBe(false))
  })

  it("toggleFlag : rollback du flag quand onFlag renvoie { ok: false }", async () => {
    const callbacks = makeCallbacks({
      onFlag: vi.fn(async () => ({ ok: false })),
    })
    const { result } = renderSession(callbacks)
    act(() => {
      result.current.toggleFlag()
    })
    await waitFor(() => expect(result.current.flagged.has("q1")).toBe(false))
  })

  it("confirmFinish : pas de crash quand onFinish rejette, dialog réouvrable", async () => {
    const callbacks = makeCallbacks({ onFinish: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    await act(async () => {
      await result.current.confirmFinish()
    })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it("pause : pas de crash quand onPause rejette", async () => {
    const callbacks = makeCallbacks({ onPause: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    await act(async () => {
      await result.current.pause()
    })
    expect(result.current.isPaused).toBe(false)
  })

  it("resume : pas de crash quand onResume rejette (session montée en pause)", async () => {
    // initialPause obligatoire : sinon le early-return `!isPaused` de resume()
    // fait passer le test à vide sans toucher le callback
    const callbacks = makeCallbacks({ onResume: vi.fn(networkReject) })
    const { result } = renderSession(callbacks, {
      isPaused: true,
      totalPauseDurationMs: 0,
    })
    await act(async () => {
      await result.current.resume()
    })
    expect(callbacks.onResume).toHaveBeenCalledTimes(1)
    expect(result.current.isPaused).toBe(true)
  })
})
