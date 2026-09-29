import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EvaluationClient } from "@/app/(passation)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client"
import type { QuizCallbacks, QuizMode } from "@/components/quiz/runner/types"
import { startExam } from "@/features/exams/actions"
import { callAction } from "@/lib/safe-action"

const push = vi.fn()
const refresh = vi.fn()

/** Le runner est stubbé : on teste le câblage et les callbacks, pas le moteur. */
let lastMode: QuizMode | undefined
let lastCallbacks: QuizCallbacks | undefined
let lastBanners: ReactNode

vi.mock("@/components/quiz/runner/quiz-runner", () => ({
  QuizRunner: ({
    mode,
    callbacks,
    banners,
  }: {
    mode: QuizMode
    callbacks: QuizCallbacks
    banners?: ReactNode
  }) => {
    lastMode = mode
    lastCallbacks = callbacks
    lastBanners = banners
    return (
      <div data-testid="quiz-runner-stub">
        <div data-testid="banners">{banners}</div>
      </div>
    )
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
  readServerClock: vi.fn(),
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
  endDate = SERVER_NOW + 3 * 24 * 3_600_000,
}: {
  session?: typeof enCours | null
  questions?: (typeof question)[]
  enablePause?: boolean
  initialNow?: number
  endDate?: number
} = {}) =>
  render(
    <EvaluationClient
      examId="exam-1"
      exam={{
        title: "Examen blanc 26",
        questionCount: 230,
        completionTime: 3600,
        enablePause,
        pauseDurationMinutes: enablePause ? 15 : null,
        endDate,
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
  lastBanners = undefined
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

  it("une reprise annonce les réponses conservées, pas un démarrage", () => {
    renderClient()
    expect(screen.getByTestId("resume-alert")).toHaveTextContent(
      "Vos 1 réponse et vos marquages sont conservés.",
    )
    expect(lastBanners).toBeTruthy()
  })
})

describe("EvaluationClient — écran de consignes", () => {
  it("montre les consignes quand aucune participation n'existe, bouton inactif avant lecture", () => {
    renderClient({ session: null, questions: [] })

    expect(
      screen.getByRole("heading", { name: "Commencer Examen blanc 26 ?" }),
    ).toBeTruthy()
    expect(screen.getByText(/230 questions/)).toBeTruthy()
    expect(screen.getByText("Aucune pause pour cet examen.")).toBeTruthy()
    expect(screen.getByTestId("btn-start-exam")).toBeDisabled()
    expect(screen.queryByTestId("quiz-runner-stub")).toBeNull()
  })

  it("annonce la pause quand l'examen l'autorise", () => {
    renderClient({ session: null, questions: [], enablePause: true })

    expect(screen.getByText(/Une seule pause, jusqu'à/)).toBeTruthy()
    expect(screen.getByText(/15 min/)).toBeTruthy()
  })

  it("prévient quand l'examen ferme avant la fin de la durée prévue", () => {
    renderClient({
      session: null,
      questions: [],
      endDate: SERVER_NOW + 20 * 60_000,
    })
    expect(screen.getByText(/il sera soumis à la fermeture/)).toBeTruthy()
  })

  it("« Annuler » ramène à la liste", () => {
    renderClient({ session: null, questions: [] })
    expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute(
      "href",
      LISTE,
    )
  })
})

describe("EvaluationClient — démarrage", () => {
  const demarrer = async () => {
    renderClient({ session: null, questions: [] })
    fireEvent.click(screen.getByTestId("exam-consignes-ack"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-start-exam"))
    })
  }

  it("rafraîchit le payload RSC après un démarrage réussi", async () => {
    vi.mocked(callAction).mockResolvedValue({
      success: true,
      startedAt: SERVER_START,
    } as never)

    await demarrer()

    expect(vi.mocked(callAction)).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it("passe par startExam", async () => {
    vi.mocked(callAction).mockImplementation(async (fn) => {
      await (fn as () => Promise<unknown>)()
      return { success: true, startedAt: SERVER_START } as never
    })
    vi.mocked(startExam).mockResolvedValue({
      success: true,
      participationId: "p1",
      startedAt: SERVER_START,
    })

    await demarrer()

    expect(startExam).toHaveBeenCalledWith({ examId: "exam-1" })
  })

  it("renvoie vers la liste quand le serveur refuse le démarrage", async () => {
    vi.mocked(callAction).mockResolvedValue({
      success: false,
      error: "Vous avez déjà passé cet examen.",
    } as never)

    await demarrer()

    expect(toast.error).toHaveBeenCalledWith("Vous avez déjà passé cet examen.")
    expect(push).toHaveBeenCalledWith(LISTE)
    expect(refresh).not.toHaveBeenCalled()
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

  it("temps écoulé côté serveur : message distinct (pas « réessayez ») et signal timeUp au moteur", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({
      success: false,
      error: "Temps écoulé.",
      code: "TIME_UP",
    } as never)

    const res = await lastCallbacks!.onAnswer!("q1", "A")

    expect(res).toEqual({ ok: false, error: "Temps écoulé.", timeUp: true })
    expect(toast.error).toHaveBeenCalledWith(
      "Temps écoulé : cette réponse n'a pas été enregistrée.",
    )
    expect(toast.error).not.toHaveBeenCalledWith(
      "Réponse non enregistrée, réessayez.",
    )
  })

  it("option modifiée depuis l'ouverture de la page : demande de recharger, pas de réessayer", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({
      success: false,
      error: "Cette question a été modifiée. Rechargez la page.",
      code: "OPTION_CHANGED",
    } as never)

    const res = await lastCallbacks!.onAnswer!("q1", "A")

    expect(res).toMatchObject({ ok: false })
    expect(toast.error).toHaveBeenCalledWith(
      "Cette question a été modifiée. Rechargez la page.",
    )
    expect(toast.error).not.toHaveBeenCalledWith(
      "Réponse non enregistrée, réessayez.",
    )
  })

  it("relit l'heure du serveur en silence au réveil de l'onglet, et avale l'échec", async () => {
    renderClient()
    vi.mocked(callAction).mockResolvedValue({
      success: true,
      serverNow: 12_345,
    } as never)
    expect(await lastCallbacks!.onSyncClock!()).toEqual({
      ok: true,
      serverNow: 12_345,
    })

    vi.mocked(callAction).mockResolvedValue({
      success: false,
      error: "Réseau",
    } as never)
    expect(await lastCallbacks!.onSyncClock!()).toEqual({ ok: false })
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.info).not.toHaveBeenCalled()
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

  it("confirme la mise en pause sans toast, et la signale quand elle échoue", async () => {
    renderClient({ enablePause: true })
    vi.mocked(callAction).mockResolvedValue({
      success: true,
      pauseStartedAt: 4_000,
      serverNow: 4_000,
    } as never)
    // Le début de pause est l'instant SERVEUR : l'overlay ne lit jamais
    // l'horloge locale. L'overlay plein écran suffit : pas de toast.
    expect(await lastCallbacks!.onPause!()).toEqual({
      ok: true,
      pauseStartedAt: 4_000,
      serverNow: 4_000,
    })
    expect(toast.info).not.toHaveBeenCalled()

    vi.mocked(callAction).mockResolvedValue({ success: false } as never)
    expect(await lastCallbacks!.onPause!()).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith("Erreur lors de la mise en pause")
  })
})
