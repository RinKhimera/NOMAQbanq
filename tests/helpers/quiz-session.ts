import { renderHook } from "@testing-library/react"
import { vi } from "vitest"
import type {
  AnswersMap,
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
} from "@/components/quiz/runner/types"
import {
  type UseQuizSessionOptions,
  useQuizSession,
} from "@/components/quiz/runner/use-quiz-session"

export const makeQuestion = (
  id: string,
  options = ["A", "B", "C", "D"],
): QuizQuestion => ({
  _id: id,
  question: `Question ${id} ?`,
  options,
  domain: "Cardiologie",
  objectifCMC: "Obj",
  images: [],
})

export const makeQuestions = (count: number): QuizQuestion[] =>
  Array.from({ length: count }, (_, i) => makeQuestion(`q${i + 1}`))

type SessionOptions = {
  /** Questions q1…qn générées ; ignoré quand `questions` est fourni. */
  n?: number
  questions?: QuizQuestion[]
  mode?: Partial<QuizMode>
  /** Chrono d'examen : budget de 3600 s et ancre au départ par défaut. */
  timer?: { start: number; totalSeconds?: number; initialNow?: number }
  callbacks?: Partial<QuizCallbacks>
  initialAnswers?: AnswersMap
  initialFlags?: Set<string>
  initialPause?: UseQuizSessionOptions["initialPause"]
}

export function renderSession({
  n = 2,
  questions = makeQuestions(n),
  mode,
  timer,
  callbacks: overrides,
  initialAnswers = {},
  initialFlags,
  initialPause,
}: SessionOptions = {}) {
  const callbacks: QuizCallbacks = {
    onAnswer: vi.fn().mockResolvedValue({ ok: true }),
    onFlag: vi.fn().mockResolvedValue({ ok: true }),
    onFinish: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
  const fullMode: QuizMode = {
    kind: "training",
    timer: timer
      ? {
          serverStartTime: timer.start,
          totalSeconds: timer.totalSeconds ?? 3600,
          initialNow: timer.initialNow ?? timer.start,
        }
      : null,
    pause: null,
    feedback: "deferred",
    showMeta: false,
    labels: { title: "Entraînement" },
    ...mode,
  }
  const hook = renderHook(() =>
    useQuizSession({
      questions,
      initialAnswers,
      initialFlags,
      initialPause,
      mode: { ...fullMode },
      // Comme les callbacks inline d'une page : une identité neuve à chaque
      // rendu (un par tick de chrono). Le moteur ne doit rien en mémoriser.
      callbacks: Object.fromEntries(
        Object.entries(callbacks)
          .filter(([, fn]) => typeof fn === "function")
          .map(([name, fn]) => [
            name,
            (...args: unknown[]) =>
              (fn as (...a: unknown[]) => unknown)(...args),
          ]),
      ) as unknown as QuizCallbacks,
    }),
  )
  return { ...hook, callbacks }
}
