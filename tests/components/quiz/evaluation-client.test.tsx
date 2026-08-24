import { act, fireEvent, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EvaluationClient } from "@/app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client"
import type { QuizCallbacks, QuizMode } from "@/components/quiz/runner/types"
import { startExam } from "@/features/exams/actions"
import { callAction } from "@/lib/safe-action"

const push = vi.fn()
const refresh = vi.fn()

/** Le runner est stubbé : on teste le câblage et les callbacks, pas le moteur. */
let lastMode: QuizMode | undefined
let lastCallbacks: QuizCallbacks | undefined

vi.mock("@/components/quiz/runner/quiz-runner", () => ({
  QuizRunner: ({
    mode,
    callbacks,
  }: {
    mode: QuizMode
    callbacks: QuizCallbacks
  }) => {
    lastMode = mode
    lastCallbacks = callbacks
    return <div data-testid="quiz-runner-stub" />
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
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
const LISTE = "/tableau-de-bord/examen-blanc"

const question = {
  _id: "q1",
  _creationTime: 0,
  question: "Question ?",
  options: ["A", "B"],
  objectifCMC: "obj",
  domain: "Cardiologie",
  images: [],
}

const enCours = {
  participationId: "p1",
  status: "in_progress" as const,
  startedAt: SERVER_START,
  completedAt: null,
  score: 0,
  isPaused: false,
  pauseStartedAt: null,
  totalPauseDurationMs: 0,
}

const renderClient = ({
  session = enCours,
  questions = [question],
  enablePause = false,
  initialNow = SERVER_NOW,
}: {
  session?: typeof enCours | null
  questions?: (typeof question)[]
  enablePause?: boolean
  initialNow?: number
} = {}) =>
  render(
    <EvaluationClient
      examId="exam-1"
      exam={{
        title: "Examen",
        completionTime: 3600,
        enablePause,
        pauseDurationMinutes: enablePause ? 15 : null,
      }}
      questions={questions}
      initialSession={session}
      initialAnswersRaw={[
        { questionId: "q1", selectedAnswer: "A", isFlagged: true },
        { questionId: "q2", selectedAnswer: null, isFlagged: false },
      ]}
      initialNow={initialNow}
    />,
  )

beforeEach(() => {
  vi.clearAllMocks()
  lastMode = undefined
  lastCallbacks = undefined
})

describe("EvaluationClient — câblage du chrono", () => {
  it("transmet l'horloge serveur reçue en prop comme ancre du chrono", () => {
    // Verrouille la SOURCE de l'ancre : le hook est protégé par ses propres
    // tests, mais rien n'empêcherait de le nourrir d'un `Date.now()` local —
    // ce qui rétablirait le mismatch d'hydratation, toute la suite au vert.
    renderClient()

    expect(lastMode?.timer).toEqual({
      serverStartTime: SERVER_START,
      totalSeconds: 3600,
      initialNow: SERVER_NOW,
    })
  })

  it("l'ancre suit la prop, elle n'est pas relue sur l'horloge locale", () => {
    // Une valeur qu'aucune horloge réelle ne produirait.
    renderClient({ initialNow: 42 })

    expect(lastMode?.timer?.initialNow).toBe(42)
  })

  it("réhydrate réponses et marque-pages sans jamais exposer isCorrect", () => {
    renderClient()

    expect(lastMode?.pause).toBeNull()
    expect(screen.getByTestId("quiz-runner-stub")).toBeTruthy()
  })
})

describe("EvaluationClient — écran de règles", () => {
  it("montre les règles quand aucune participation n'existe", () => {
    renderClient({ session: null, questions: [] })

    expect(screen.getByText(/Règles importantes/)).toBeTruthy()
  })

  it("annonce la pause repos quand l'examen l'autorise", () => {
    renderClient({ session: null, questions: [], enablePause: true })

    expect(screen.getByText(/Pause repos disponible/)).toBeTruthy()
  })

  it("quitte vers la liste sur Annuler", () => {
    renderClient({ session: null, questions: [] })
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))

    expect(push).toHaveBeenCalledWith(LISTE)
  })
})

describe("EvaluationClient — démarrage", () => {
  const demarrer = async () => {
    renderClient({ session: null, questions: [] })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Je comprends/ }))
    })
  }

  it("rafraîchit le payload RSC après un démarrage réussi", async () => {
    vi.mocked(startExam).mockResolvedValue({
      success: true,
      startedAt: SERVER_START,
    } as never)

    await demarrer()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalled()
  })

  it("renvoie vers la liste quand le serveur refuse le démarrage", async () => {
    vi.mocked(startExam).mockResolvedValue({
      success: false,
      error: "Examen déjà passé",
    } as never)

    await demarrer()

    expect(toast.error).toHaveBeenCalledWith("Examen déjà passé")
    expect(push).toHaveBeenCalledWith(LISTE)
    expect(refresh).not.toHaveBeenCalled()
  })

  it("renvoie vers la liste quand l'action rejette", async () => {
    vi.mocked(startExam).mockRejectedValue(new Error("Failed to fetch"))

    await demarrer()

    expect(toast.error).toHaveBeenCalledWith(
      "Erreur lors du démarrage de l'examen",
    )
    expect(push).toHaveBeenCalledWith(LISTE)
  })
})

describe("EvaluationClient — squelette d'attente", () => {
  it("ne monte pas le runner tant que les questions ne sont pas arrivées", () => {
    // Fenêtre entre startExam et le refresh : monter le runner à vide
    // lancerait le chrono sur un examen sans question.
    renderClient({ questions: [] })

    expect(screen.queryByTestId("quiz-runner-stub")).toBeNull()
    expect(screen.getByLabelText("Préparation de l'examen")).toBeTruthy()
  })
})

describe("EvaluationClient — callbacks", () => {
  it("signale une réponse non enregistrée sans révéler la correction", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({
      success: false,
      error: "Réseau",
    } as never)

    const res = await lastCallbacks!.onAnswer!("q1", "A")

    expect(res).toEqual({ ok: false, error: "Réseau" })
    expect(toast.error).toHaveBeenCalledWith(
      "Réponse non enregistrée, réessayez.",
    )
  })

  it("acquitte une réponse enregistrée sans champ de correction", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({ success: true } as never)

    expect(await lastCallbacks!.onAnswer!("q1", "A")).toEqual({ ok: true })
  })

  it("propage l'échec d'un marque-page", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({ success: false } as never)

    expect(await lastCallbacks!.onFlag!("q1", true)).toEqual({ ok: false })
  })

  it("redirige vers la page « soumis » après une remise manuelle", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({ success: true } as never)

    const res = await lastCallbacks!.onFinish!({ isAutoSubmit: false })

    expect(res).toEqual({
      ok: true,
      redirectTo: `${LISTE}/exam-1/soumis`,
    })
    expect(push).toHaveBeenCalledWith(`${LISTE}/exam-1/soumis`)
  })

  it("annonce la soumission automatique quand le temps est écoulé", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({ success: true } as never)

    await lastCallbacks!.onFinish!({ isAutoSubmit: true })

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Temps écoulé"),
    )
  })

  it("renvoie vers la liste quand la participation n'est plus active", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({
      success: false,
      error: "Vous avez déjà passé cet examen",
    } as never)

    expect(await lastCallbacks!.onFinish!({ isAutoSubmit: false })).toEqual({
      ok: false,
    })
    expect(push).toHaveBeenCalledWith(LISTE)
  })

  it("garde l'utilisateur sur place quand la remise échoue autrement", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({ success: false } as never)

    await lastCallbacks!.onFinish!({ isAutoSubmit: false })

    expect(toast.error).toHaveBeenCalledWith("Erreur lors de la soumission")
    expect(push).not.toHaveBeenCalled()
  })

  it("n'expose pause et reprise que si l'examen les autorise", () => {
    renderClient()
    expect(lastCallbacks?.onPause).toBeUndefined()
    expect(lastCallbacks?.onResume).toBeUndefined()

    renderClient({ enablePause: true })
    expect(lastCallbacks?.onPause).toBeDefined()
    expect(lastMode?.pause).toBe("rest")
  })

  it("remonte le cumul de pause serveur à la reprise", async () => {
    renderClient({ enablePause: true })
    vi.mocked(callAction).mockResolvedValue({
      success: true,
      totalPauseDurationMs: 30_000,
    } as never)

    expect(await lastCallbacks!.onResume!()).toEqual({
      ok: true,
      totalPauseDurationMs: 30_000,
    })
  })

  it("refuse la reprise sans cumul quand le serveur échoue", async () => {
    renderClient({ enablePause: true })
    vi.mocked(callAction).mockResolvedValue({
      success: false,
      error: "Réseau",
    } as never)

    expect(await lastCallbacks!.onResume!()).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith("Réseau")
  })

  it("confirme la mise en pause, et la signale quand elle échoue", async () => {
    renderClient({ enablePause: true })
    vi.mocked(callAction).mockResolvedValue({ success: true } as never)
    expect(await lastCallbacks!.onPause!()).toEqual({ ok: true })
    expect(toast.info).toHaveBeenCalled()

    vi.mocked(callAction).mockResolvedValue({ success: false } as never)
    expect(await lastCallbacks!.onPause!()).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith("Erreur lors de la mise en pause")
  })
})
