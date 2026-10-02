import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ExamForm,
  type ExamFormProps,
} from "@/app/(admin)/admin/examens/_components/exam-form"
import {
  blankExamForm,
  examFormFromSource,
} from "@/app/(admin)/admin/examens/_components/exam-form-model"
import { finalizePreparedExam, saveExam } from "@/features/exams/actions"
import type { BankQuestion } from "@/features/questions/dal"

const push = vi.fn()
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/exams/actions", () => ({
  saveExam: vi.fn(),
  finalizePreparedExam: vi.fn(),
}))

vi.mock("@/components/admin/user-multi-select", () => ({
  UserMultiSelect: () => null,
}))

const NOW = Date.parse("2026-10-01T12:00:00Z")
const DAY = 86_400_000

const question = (id: string, domain: string, extra = {}) =>
  ({ id, domain, keyToVerify: false, lastUse: null, ...extra }) as BankQuestion

const props = (over: Partial<ExamFormProps> = {}): ExamFormProps => ({
  initialNow: NOW,
  subscriberCount: 118,
  initialValues: blankExamForm(),
  saved: null,
  selection: [],
  reopening: null,
  ...over,
})

const finalizedExam = (over = {}) => ({
  id: "e1",
  title: "Examen blanc 27",
  startDate: NOW + 8 * DAY,
  endDate: NOW + 11 * DAY,
  finalizedAt: NOW - DAY,
  isActive: true,
  targetQuestionCount: 10,
  questionCount: 10,
  participations: 0,
  locked: false,
  ...over,
})

const typeTitle = (title: string) =>
  fireEvent.change(screen.getByTestId("exam-title-input"), {
    target: { value: title },
  })

beforeEach(() => {
  push.mockReset()
  vi.mocked(saveExam).mockReset()
  vi.mocked(finalizePreparedExam).mockReset()
})

describe("ExamForm — nouvel examen", () => {
  it("« Enregistrer » sans titre signale le champ sans rien envoyer", () => {
    render(<ExamForm {...props()} />)

    fireEvent.click(screen.getByTestId("btn-save-exam"))

    expect(screen.getByTestId("exam-title-error")).toHaveTextContent(
      "Donnez un titre à l'examen.",
    )
    expect(saveExam).not.toHaveBeenCalled()
  })

  it("un visé hors bornes est signalé et bloque l'enregistrement", () => {
    render(<ExamForm {...props()} />)
    typeTitle("Examen blanc 29")
    fireEvent.change(screen.getByTestId("exam-target-input"), {
      target: { value: "5" },
    })

    fireEvent.click(screen.getByTestId("btn-save-exam"))

    expect(screen.getByTestId("exam-target-error")).toHaveTextContent(
      "Entre 10 et 230.",
    )
    expect(saveExam).not.toHaveBeenCalled()
  })

  it("« Enregistrer » envoie l'état entier sans jeu de questions, puis ouvre la fiche", async () => {
    vi.mocked(saveExam).mockResolvedValue({
      success: true,
      examId: "e9",
      finalized: false,
    })
    render(<ExamForm {...props()} />)
    typeTitle("Examen blanc 29")

    fireEvent.click(screen.getByTestId("btn-save-exam"))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/examens/e9"))
    expect(saveExam).toHaveBeenCalledWith({
      title: "Examen blanc 29",
      description: "",
      targetQuestionCount: 230,
      startDate: null,
      endDate: null,
      enablePause: false,
      pauseDurationMinutes: undefined,
      audienceType: "subscribers",
      audienceUserIds: [],
    })
    expect(finalizePreparedExam).not.toHaveBeenCalled()
  })

  it("« Composer le jeu de questions » attend le premier enregistrement", () => {
    render(<ExamForm {...props()} />)

    expect(screen.getByTestId("btn-compose-questions")).toBeDisabled()
    expect(screen.getByText(/Enregistrez d'abord l'examen/)).toBeInTheDocument()
    expect(screen.getByText("Abonnés Examens")).toBeInTheDocument()
    expect(screen.getByText(/118 aujourd'hui/)).toBeInTheDocument()
  })

  it("une finalisation refusée garde l'examen créé, affiche les erreurs par étape et ne le recrée pas", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState")
    vi.mocked(saveExam).mockResolvedValue({
      success: true,
      examId: "e9",
      finalized: false,
    })
    vi.mocked(finalizePreparedExam).mockResolvedValue({
      success: false,
      error: "Date d'ouverture requise",
      fieldErrors: {
        startDate: "Date d'ouverture requise",
        questionIds: "Le jeu compte 0 questions sur 230 visées.",
      },
    })
    render(<ExamForm {...props()} />)
    typeTitle("Examen blanc 29")

    fireEvent.click(screen.getByTestId("btn-finalize-exam"))

    expect(await screen.findByTestId("exam-form-error")).toHaveTextContent(
      "L'examen ne peut pas encore être finalisé",
    )
    expect(finalizePreparedExam).toHaveBeenCalledWith({ examId: "e9" })
    expect(screen.getByTestId("exam-start-error")).toHaveTextContent(
      "Date d'ouverture requise",
    )
    expect(screen.getByTestId("exam-questions-error")).toHaveTextContent(
      "Le jeu compte 0 questions sur 230 visées.",
    )
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/admin/examens/modifier/e9",
    )
    expect(screen.getByTestId("btn-compose-questions")).toHaveAttribute(
      "href",
      "/admin/examens/e9/questions?retour=formulaire",
    )
    expect(push).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("btn-finalize-exam"))
    await waitFor(() => expect(saveExam).toHaveBeenCalledTimes(2))
    expect(vi.mocked(saveExam).mock.calls[1][0]).toMatchObject({ id: "e9" })
    replaceState.mockRestore()
  })

  it("une finalisation acceptée annonce la durée et ouvre la fiche", async () => {
    const { toast } = await import("sonner")
    vi.mocked(saveExam).mockResolvedValue({
      success: true,
      examId: "e9",
      finalized: false,
    })
    vi.mocked(finalizePreparedExam).mockResolvedValue({ success: true })
    render(<ExamForm {...props()} />)
    typeTitle("Examen blanc 29")

    fireEvent.click(screen.getByTestId("btn-finalize-exam"))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/examens/e9"))
    expect(toast.success).toHaveBeenCalledWith("Examen finalisé · durée 5 h 18")
  })
})

describe("ExamForm — réouverture", () => {
  const source = {
    exam: {
      title: "Examen blanc 25",
      description: "Format complet",
      endDate: NOW - DAY,
      enablePause: true,
      pauseDurationMinutes: 45,
      questionCount: 12,
      audienceType: "subscribers" as const,
    },
    questionIds: ["q1", "q2"],
    audience: [],
  }

  it("envoie les questions de la source à la création, et le visé de la source", async () => {
    vi.mocked(saveExam).mockResolvedValue({
      success: true,
      examId: "e9",
      finalized: false,
    })
    render(
      <ExamForm
        {...props({
          initialValues: examFormFromSource(source),
          selection: [
            question("q1", "Cardiologie"),
            question("q2", "Pédiatrie"),
          ],
          reopening: { title: "Examen blanc 25", questionIds: ["q1", "q2"] },
        })}
      />,
    )

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Rouvrir Examen blanc 25",
      }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("exam-title-input")).toHaveValue(
      "Examen blanc 25 (réouverture)",
    )
    expect(screen.getByTestId("exam-questions-count")).toHaveTextContent(
      "2 / 12",
    )
    expect(
      screen.getByText(
        "Questions reprises de Examen blanc 25, sauf celles supprimées depuis.",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("btn-save-exam"))

    await waitFor(() => expect(saveExam).toHaveBeenCalled())
    expect(saveExam).toHaveBeenCalledWith(
      expect.objectContaining({
        questionIds: ["q1", "q2"],
        targetQuestionCount: 12,
        enablePause: true,
        pauseDurationMinutes: 45,
      }),
    )
  })
})

describe("ExamForm — examen finalisé", () => {
  const values = {
    ...blankExamForm(),
    title: "Examen blanc 27",
    targetQuestionCount: 10,
  }

  it("n'offre que « Enregistrer les modifications »", () => {
    render(
      <ExamForm
        {...props({ initialValues: values, saved: finalizedExam() })}
      />,
    )

    expect(screen.getByTestId("btn-save-exam-changes")).toBeInTheDocument()
    expect(screen.queryByTestId("btn-finalize-exam")).not.toBeInTheDocument()
    expect(screen.queryByTestId("btn-save-exam")).not.toBeInTheDocument()
  })

  it("prévient qu'un nouveau visé remet l'examen en préparation, sauf ramené au jeu", () => {
    render(
      <ExamForm
        {...props({
          initialValues: { ...values, targetQuestionCount: 12 },
          saved: finalizedExam({ targetQuestionCount: 12, questionCount: 10 }),
        })}
      />,
    )
    const target = screen.getByTestId("exam-target-input")
    expect(screen.queryByTestId("exam-target-reset-warning")).toBeNull()

    fireEvent.change(target, { target: { value: "10" } })
    expect(screen.queryByTestId("exam-target-reset-warning")).toBeNull()

    fireEvent.change(target, { target: { value: "20" } })
    expect(screen.getByTestId("exam-target-reset-warning")).toHaveTextContent(
      "il disparaît côté étudiant jusqu'à la refinalisation",
    )
  })

  it("un refus général (dates d'un examen clos) s'affiche en message", async () => {
    vi.mocked(saveExam).mockResolvedValue({
      success: false,
      error: "Cet examen est clos et a déjà des participations.",
    })
    render(
      <ExamForm
        {...props({ initialValues: values, saved: finalizedExam() })}
      />,
    )

    fireEvent.click(screen.getByTestId("btn-save-exam-changes"))

    expect(await screen.findByTestId("exam-form-error")).toHaveTextContent(
      "Modifications non enregistréesCet examen est clos et a déjà des participations.",
    )
    expect(push).not.toHaveBeenCalled()
  })

  it("figé par une participation : visé verrouillé, jeu en lecture seule", () => {
    render(
      <ExamForm
        {...props({
          initialValues: values,
          saved: finalizedExam({ participations: 3, locked: true }),
          selection: Array.from({ length: 10 }, (_, i) =>
            question(`q${i}`, "Cardiologie"),
          ),
        })}
      />,
    )

    expect(screen.getByTestId("exam-target-input")).toBeDisabled()
    expect(screen.getByTestId("exam-frozen-alert")).toHaveTextContent(
      "3 participations existent.",
    )
    expect(screen.getByTestId("btn-compose-questions")).toHaveTextContent(
      "Voir le jeu de questions",
    )
    expect(screen.getByText("Verrouillé")).toBeInTheDocument()
  })
})

describe("ExamForm — examen en préparation", () => {
  it("signale un examen en retard et résume le jeu enregistré", () => {
    render(
      <ExamForm
        {...props({
          initialValues: {
            ...blankExamForm(),
            title: "EB-28",
            targetQuestionCount: 10,
          },
          saved: finalizedExam({
            finalizedAt: null,
            startDate: Date.parse("2026-09-29T04:00:00Z"),
            questionCount: 3,
          }),
          selection: [
            question("q1", "Cardiologie", { keyToVerify: true }),
            question("q2", "Cardiologie"),
            question("q3", "Pédiatrie", {
              lastUse: {
                examId: "x",
                title: "EB-25",
                startDate: 0,
                recent: true,
              },
            }),
          ],
        })}
      />,
    )

    expect(screen.getByTestId("exam-late-alert")).toHaveTextContent(
      "Devait ouvrir le 29 sept. 2026",
    )
    expect(screen.getByTestId("exam-questions-count")).toHaveTextContent(
      "3 / 10",
    )
    expect(screen.getByText("1 question récente")).toBeInTheDocument()
    expect(screen.getByText("1 clé à vérifier")).toBeInTheDocument()
    expect(screen.getByTestId("btn-compose-questions")).toHaveAttribute(
      "href",
      "/admin/examens/e1/questions?retour=formulaire",
    )
    expect(screen.getByTestId("btn-finalize-exam")).toBeEnabled()
    expect(screen.getByTestId("btn-save-exam")).toBeEnabled()
  })
})
