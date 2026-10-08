import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { QuizRunner } from "@/components/quiz/runner/quiz-runner"
import type {
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
} from "@/components/quiz/runner/types"

const questions: QuizQuestion[] = ["q1", "q2", "q3"].map((id) => ({
  _id: id,
  question: `Vignette ${id}`,
  options: ["Aspirine", "Héparine", "Warfarine"],
  domain: "Cardiologie",
  objectifCMC: "Obj",
  images: [],
}))

const mode = (overrides: Partial<QuizMode> = {}): QuizMode => ({
  kind: "training",
  timer: null,
  pause: null,
  feedback: "deferred",
  showMeta: false,
  labels: { title: "Entraînement" },
  ...overrides,
})

const callbacks = (overrides: Partial<QuizCallbacks> = {}): QuizCallbacks => ({
  onAnswer: vi.fn().mockResolvedValue({ ok: true }),
  onFlag: vi.fn().mockResolvedValue({ ok: true }),
  onFinish: vi.fn().mockResolvedValue({ ok: true }),
  ...overrides,
})

const navigatorCell = (n: number) =>
  within(
    screen.getByRole("navigation", { name: "Navigation des questions" }),
  ).getByRole("button", { name: new RegExp(`^Question ${n},`) })

describe("QuizRunner", () => {
  it("pendant une pause repos, aucun contenu de question n'est dans le DOM", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        initialPause={{
          isPaused: true,
          totalPauseDurationMs: 0,
          pauseStartedAtMs: 1_000_000,
        }}
        mode={mode({
          kind: "exam",
          pause: "rest",
          timer: {
            serverStartTime: 1_000_000,
            totalSeconds: 3600,
            initialNow: 1_000_000,
          },
        })}
        callbacks={callbacks({
          onPause: vi.fn().mockResolvedValue({ ok: true }),
          onResume: vi.fn().mockResolvedValue({ ok: true }),
        })}
      />,
    )

    expect(screen.getByTestId("pause-overlay")).toBeInTheDocument()
    expect(screen.queryByText("Vignette q1")).not.toBeInTheDocument()
    expect(screen.queryByTestId("answer-option-0")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Navigation des questions" }),
    ).not.toBeInTheDocument()
  })

  it("mode tuteur : « Valider ma réponse » n'apparaît qu'après un choix", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode({ feedback: "immediate" })}
        callbacks={callbacks()}
      />,
    )

    expect(screen.queryByTestId("btn-validate-answer")).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("answer-option-1"))
    expect(screen.getByTestId("btn-validate-answer")).toBeInTheDocument()
  })

  it("marquer la question se lit dans le navigateur", async () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )

    expect(navigatorCell(1)).toHaveAccessibleName("Question 1, sans réponse")
    fireEvent.click(screen.getByTestId("btn-flag"))
    await waitFor(() =>
      expect(navigatorCell(1)).toHaveAccessibleName(
        "Question 1, sans réponse, marquée",
      ),
    )
    expect(navigatorCell(1)).toHaveAttribute("aria-current", "step")
  })

  it("le navigateur mène à la question choisie", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )

    fireEvent.click(navigatorCell(3))
    expect(screen.getByText("Vignette q3")).toBeInTheDocument()
    expect(screen.getByTestId("btn-finish")).toHaveTextContent(
      "Terminer la série",
    )
  })

  it("la calculatrice s'ouvre en panneau et Échap rend le focus à son bouton", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )

    const button = screen.getByTestId("btn-calculator")
    fireEvent.click(button)
    const panel = screen.getByRole("dialog", { name: "Calculatrice" })
    expect(panel).toHaveFocus()

    fireEvent.keyDown(panel, { key: "7" })
    fireEvent.keyDown(panel, { key: "*" })
    fireEvent.keyDown(panel, { key: "6" })
    fireEvent.keyDown(panel, { key: "Enter" })
    expect(within(panel).getByRole("status")).toHaveTextContent("42")

    fireEvent.keyDown(panel, { key: "Escape" })
    expect(
      screen.queryByRole("dialog", { name: "Calculatrice" }),
    ).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it("« Suivante » garde le focus clavier d'une question à l'autre, jusqu'à la fin de la série", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )

    const next = screen.getByTestId("btn-next")
    next.focus()
    fireEvent.click(next)
    expect(screen.getByText("Vignette q2")).toBeInTheDocument()
    expect(screen.getByTestId("btn-next")).toHaveFocus()

    fireEvent.click(screen.getByTestId("btn-next"))
    expect(screen.getByTestId("btn-finish")).toHaveFocus()
  })

  it("mode tuteur : l'explication repliée sur une question est rouverte sur la suivante", () => {
    const reveal = {
      correctAnswer: "Aspirine",
      explanation: "Parce que.",
      references: [],
    }
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{
          q1: { selected: "Héparine", isCorrect: false },
          q2: { selected: "Aspirine", isCorrect: true },
        }}
        initialRevealed={{ q1: reveal, q2: reveal }}
        mode={mode({ feedback: "immediate" })}
        callbacks={callbacks()}
      />,
    )

    fireEvent.click(screen.getByTestId("panel-explanation"))
    expect(screen.getByTestId("panel-explanation")).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    fireEvent.click(screen.getByTestId("btn-next"))
    expect(screen.getByText("Vignette q2")).toBeInTheDocument()
    expect(screen.getByTestId("panel-explanation")).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("les flèches pilotent un panneau ouvert sans changer la question derrière", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )

    fireEvent.click(screen.getByTestId("btn-calculator"))
    const panel = screen.getByRole("dialog", { name: "Calculatrice" })
    fireEvent.keyDown(panel, { key: "ArrowRight" })
    expect(screen.getByText("Vignette q1")).toBeInTheDocument()

    // Jumeau : hors panneau, la flèche change bien de question.
    fireEvent.keyDown(document.body, { key: "ArrowRight" })
    expect(screen.getByText("Vignette q2")).toBeInTheDocument()
  })

  it("Entrée sur « Fermer la calculatrice » la ferme au lieu de calculer", async () => {
    const user = userEvent.setup()
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )

    await user.click(screen.getByTestId("btn-calculator"))
    screen.getByRole("button", { name: "Fermer la calculatrice" }).focus()
    await user.keyboard("{Enter}")
    expect(
      screen.queryByRole("dialog", { name: "Calculatrice" }),
    ).not.toBeInTheDocument()
  })
})

describe("QuizRunner — alertes et temps écoulé", () => {
  const examMode = (initialNow: number) =>
    mode({
      kind: "exam",
      timer: { serverStartTime: 1_000_000, totalSeconds: 3600, initialNow },
    })

  it("rend les bannières de la page au-dessus de la question", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
        banners={<p>Reprise de la série</p>}
      />,
    )
    expect(screen.getByText("Reprise de la série")).toBeInTheDocument()
  })

  it("hors ligne : une alerte prévient que les réponses ne s'enregistrent pas", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )
    expect(screen.getByTestId("offline-alert")).toHaveTextContent(
      "Connexion perdue",
    )
  })

  it("en ligne : aucune alerte de connexion", () => {
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={mode()}
        callbacks={callbacks()}
      />,
    )
    expect(screen.queryByTestId("offline-alert")).not.toBeInTheDocument()
  })

  it("moins de cinq minutes : le chronomètre seul change de palier, aucune alerte ni dialogue", () => {
    // 3600 s de budget, 57 min écoulées → 3 min restantes.
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={examMode(1_000_000 + 57 * 60_000)}
        callbacks={callbacks()}
      />,
    )
    expect(
      screen.getByRole("timer", { name: "Temps restant" }),
    ).toHaveAttribute("data-zone", "critical")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByTestId("time-up-dialog")).not.toBeInTheDocument()
  })

  it("budget épuisé : dialogue « Temps écoulé » non fermable pendant l'auto-soumission", async () => {
    const onFinish = vi.fn().mockResolvedValue({ ok: true })
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{ q1: { selected: "Aspirine" } }}
        mode={examMode(1_000_000 + 2 * 3_600_000)}
        callbacks={callbacks({ onFinish })}
      />,
    )
    const dialog = await screen.findByTestId("time-up-dialog")
    expect(dialog).toHaveTextContent("Temps écoulé")
    expect(dialog).toHaveTextContent("1 réponse sur 3")
    expect(
      within(dialog).queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith({ isAutoSubmit: true }),
    )
  })

  it("auto-soumission échouée : « Soumettre » la relance", async () => {
    const onFinish = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true })
    render(
      <QuizRunner
        questions={questions}
        initialAnswers={{}}
        mode={examMode(1_000_000 + 2 * 3_600_000)}
        callbacks={callbacks({ onFinish })}
      />,
    )
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1))
    const retry = await screen.findByTestId("btn-time-up-submit")
    fireEvent.click(retry)
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(2))
    expect(onFinish).toHaveBeenLastCalledWith({ isAutoSubmit: true })
  })
})
