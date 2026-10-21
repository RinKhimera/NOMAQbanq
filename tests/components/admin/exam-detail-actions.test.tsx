import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ExamDetailActions } from "@/app/(admin)/admin/examens/[id]/_components/exam-detail-actions"
import type { DetailExam } from "@/app/(admin)/admin/examens/[id]/_components/exam-detail-model"
import { detailExam } from "../../helpers/detail-exam"
import { DAY } from "../../helpers/time"

const { suspendExam, liftExamSuspension, setExamHidden, refresh, toast } =
  vi.hoisted(() => ({
    suspendExam: vi.fn(),
    liftExamSuspension: vi.fn(),
    setExamHidden: vi.fn(),
    refresh: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
  }))

vi.mock("@/features/exams/actions", () => ({
  suspendExam,
  liftExamSuspension,
  setExamHidden,
  deleteExam: vi.fn(),
}))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), refresh }),
}))
vi.mock("sonner", () => ({ toast }))

const now = Date.parse("2026-10-01T16:00:00Z")

const renderActions = (over: Partial<DetailExam> = {}, participations = 0) => {
  render(
    <ExamDetailActions
      exam={detailExam(now, over)}
      participations={participations}
      now={now}
    />,
  )
  return userEvent.setup()
}

describe("ExamDetailActions — liens", () => {
  it("en préparation : modifier et composer le jeu de questions", () => {
    renderActions({ finalizedAt: null })

    expect(screen.getByTestId("btn-edit-exam")).toHaveAttribute(
      "href",
      "/admin/examens/modifier/exam-1",
    )
    expect(screen.getByTestId("btn-compose-questions")).toHaveAttribute(
      "href",
      "/admin/examens/exam-1/questions?retour=fiche",
    )
    expect(screen.queryByTestId("btn-view-questions")).toBeNull()
  })

  it("finalisé : voir les questions plutôt que les composer", () => {
    renderActions()

    expect(screen.getByTestId("btn-view-questions")).toBeInTheDocument()
    expect(screen.queryByTestId("btn-compose-questions")).toBeNull()
  })
})

describe("ExamDetailActions — masquer / afficher", () => {
  it("masque un examen d'abonnés visible", async () => {
    setExamHidden.mockResolvedValue({ success: true })
    const user = renderActions()

    await user.click(screen.getByTestId("btn-hide-exam"))

    expect(setExamHidden).toHaveBeenCalledWith({
      examId: "exam-1",
      hidden: true,
    })
    expect(toast.success).toHaveBeenCalledWith("Examen masqué")
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("réaffiche un examen masqué", async () => {
    setExamHidden.mockResolvedValue({ success: true })
    const user = renderActions({ isHidden: true })

    await user.click(screen.getByTestId("btn-show-exam"))

    expect(setExamHidden).toHaveBeenCalledWith({
      examId: "exam-1",
      hidden: false,
    })
    expect(toast.success).toHaveBeenCalledWith("Examen affiché")
  })

  it("bouton désactivé pendant l'appel", async () => {
    let settle!: (value: { success: boolean }) => void
    setExamHidden.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )
    const user = renderActions()

    await user.click(screen.getByTestId("btn-hide-exam"))
    expect(screen.getByTestId("btn-hide-exam")).toBeDisabled()

    settle({ success: true })
    await vi.waitFor(() =>
      expect(screen.getByTestId("btn-hide-exam")).toBeEnabled(),
    )
  })

  it("échec : toast d'erreur, pas de rafraîchissement", async () => {
    setExamHidden.mockResolvedValue({ success: false, error: "Refusé" })
    const user = renderActions()

    await user.click(screen.getByTestId("btn-hide-exam"))

    expect(toast.error).toHaveBeenCalledWith("Refusé")
    expect(toast.success).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it("jamais pour un examen à audience restreinte", () => {
    renderActions({ audienceType: "restricted" })

    expect(screen.queryByTestId("btn-hide-exam")).toBeNull()
    expect(screen.queryByTestId("btn-show-exam")).toBeNull()
  })
})

describe("ExamDetailActions — suspension", () => {
  it("suspend un examen ouvert après confirmation", async () => {
    suspendExam.mockResolvedValue({ success: true })
    const user = renderActions()

    await user.click(screen.getByTestId("btn-suspend-exam"))
    await user.click(screen.getByTestId("btn-suspend-exam-confirm"))

    expect(suspendExam).toHaveBeenCalledWith({ examId: "exam-1" })
    expect(toast.success).toHaveBeenCalledWith("Examen suspendu")
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("échec de la suspension : toast d'erreur, le dialogue reste ouvert", async () => {
    suspendExam.mockResolvedValue({ success: false, error: "Déjà fermé" })
    const user = renderActions()

    await user.click(screen.getByTestId("btn-suspend-exam"))
    await user.click(screen.getByTestId("btn-suspend-exam-confirm"))

    expect(toast.error).toHaveBeenCalledWith("Déjà fermé")
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.getByTestId("btn-suspend-exam-confirm")).toBeInTheDocument()
  })

  it("lève la suspension d'un examen ouvert suspendu", async () => {
    liftExamSuspension.mockResolvedValue({ success: true })
    const user = renderActions({ isActive: false })

    expect(screen.queryByTestId("btn-suspend-exam")).toBeNull()
    await user.click(screen.getByTestId("btn-lift-suspension"))

    expect(liftExamSuspension).toHaveBeenCalledWith({ examId: "exam-1" })
    expect(toast.success).toHaveBeenCalledWith("Suspension levée")
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("échec de la levée : toast d'erreur, pas de rafraîchissement", async () => {
    liftExamSuspension.mockResolvedValue({
      success: false,
      error: "Examen introuvable",
    })
    const user = renderActions({ isActive: false })

    await user.click(screen.getByTestId("btn-lift-suspension"))

    expect(toast.error).toHaveBeenCalledWith("Examen introuvable")
    expect(toast.success).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it("examen clos : ni suspendre ni lever, mais rouvrir", () => {
    renderActions({ startDate: now - 5 * DAY, endDate: now - DAY })

    expect(screen.queryByTestId("btn-suspend-exam")).toBeNull()
    expect(screen.queryByTestId("btn-lift-suspension")).toBeNull()
    expect(screen.getByTestId("btn-reopen-exam")).toBeInTheDocument()
  })

  it("examen en préparation : ni suspendre ni lever", () => {
    renderActions({ finalizedAt: null })

    expect(screen.queryByTestId("btn-suspend-exam")).toBeNull()
    expect(screen.queryByTestId("btn-lift-suspension")).toBeNull()
  })
})

describe("ExamDetailActions — suppression", () => {
  it("« Supprimer » ouvre la confirmation, qui propose la suspension à la place", async () => {
    const user = renderActions({}, 3)

    await user.click(screen.getByTestId("btn-delete-exam"))
    expect(
      screen.getByText("3 participations seront effacées"),
    ).toBeInTheDocument()

    await user.click(screen.getByTestId("btn-suspend-instead"))

    expect(screen.queryByTestId("btn-delete-exam-confirm")).toBeNull()
    expect(screen.getByTestId("btn-suspend-exam-confirm")).toBeInTheDocument()
  })

  it("pas de suspension proposée pour un examen déjà suspendu", async () => {
    const user = renderActions({ isActive: false }, 3)

    await user.click(screen.getByTestId("btn-delete-exam"))

    expect(screen.queryByTestId("btn-suspend-instead")).toBeNull()
  })
})
