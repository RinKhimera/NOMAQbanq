import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DeleteExamDialog } from "@/app/(admin)/admin/examens/[id]/_components/exam-detail-dialogs"
import {
  type DetailExam,
  audienceBadge,
  durationBadge,
  questionsBadge,
  rankOf,
  statItems,
  tracking,
} from "@/app/(admin)/admin/examens/[id]/_components/exam-detail-model"
import type { ExamFigures, LeaderboardEntry } from "@/features/exams/dal"

const { deleteExam, push } = vi.hoisted(() => ({
  deleteExam: vi.fn(),
  push: vi.fn(),
}))

vi.mock("@/features/exams/actions", () => ({ deleteExam }))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

const DAY = 86_400_000
const now = Date.parse("2026-10-01T16:00:00Z")

const exam = (over: Partial<DetailExam> = {}): DetailExam => ({
  id: "exam-1",
  title: "Examen blanc 27",
  description: null,
  startDate: now + 3 * DAY,
  endDate: now + 6 * DAY,
  completionTime: 230 * 83,
  finalizedAt: now - DAY,
  targetQuestionCount: 230,
  isActive: true,
  enablePause: true,
  pauseDurationMinutes: 45,
  questionCount: 230,
  deletedQuestionCount: 0,
  audienceType: "subscribers",
  isHidden: false,
  ...over,
})

const figures = (over: Partial<ExamFigures> = {}): ExamFigures => ({
  started: 0,
  submitted: 0,
  autoSubmitted: 0,
  inProgress: 0,
  average: null,
  best: null,
  passed: 0,
  eligible: 118,
  participations: 0,
  locked: false,
  ...over,
})

const values = (items: ReturnType<typeof statItems>) =>
  Object.fromEntries(items.map((i) => [i.label, i.value]))

describe("statItems", () => {
  it("bilan d'un examen terminé, réussite au plancher", () => {
    const v = values(
      statItems(
        "completed",
        figures({ started: 3, submitted: 3, average: 58, best: 91, passed: 2 }),
        "subscribers",
      ),
    )

    expect(v["Participants"]).toBe("3")
    expect(v["Score moyen"]).toBe("58 %")
    expect(v["Meilleur score"]).toBe("91 %")
    expect(v["Réussite (≥ 60 %)"]).toBe("2 / 3 · 66 %")
  })

  it("sans copie soumise, les scores restent « — », jamais 0 %", () => {
    const v = values(statItems("completed", figures(), "subscribers"))

    expect(v["Score moyen"]).toBe("—")
    expect(v["Meilleur score"]).toBe("—")
    expect(v["Réussite (≥ 60 %)"]).toBe("—")
  })

  it("suivi d'un examen ouvert ; un restreint compte ses invités", () => {
    const f = figures({
      started: 64,
      submitted: 41,
      inProgress: 23,
      eligible: 14,
    })

    expect(values(statItems("active", f, "subscribers"))).toMatchObject({
      "Ont commencé": "64",
      Soumis: "41",
      "En cours": "23",
      Éligibles: "14",
    })
    expect(values(statItems("upcoming", f, "restricted"))["Éligibles"]).toBe(
      "14 invités",
    )
  })
})

describe("badges", () => {
  it("en préparation : jeu en cours de composition et durée estimée", () => {
    const prep = exam({
      finalizedAt: null,
      completionTime: null,
      questionCount: 140,
    })

    expect(questionsBadge(prep)).toBe("140 / 230 questions")
    expect(durationBadge(prep)).toBe("5 h 18 (estimée)")
  })

  it("finalisé : nombre de questions et durée fixée", () => {
    expect(questionsBadge(exam())).toBe("230 questions")
    expect(durationBadge(exam())).toBe("5 h 18")
  })
})

describe("audienceBadge", () => {
  it("dit le masquage d'un examen d'abonnés, jamais d'un restreint", () => {
    expect(audienceBadge(exam())).toBe("Abonnés Examens")
    expect(audienceBadge(exam({ isHidden: true }))).toBe(
      "Abonnés Examens, masqué",
    )
    expect(
      audienceBadge(exam({ audienceType: "restricted", isHidden: true })),
    ).toBe("Audience restreinte")
  })
})

describe("tracking", () => {
  it("en préparation : questions restantes et « Finaliser »", () => {
    const t = tracking(
      exam({ finalizedAt: null, questionCount: 140 }),
      "preparation",
      figures(),
      now,
    )

    expect(t?.description).toContain("Il reste 90 questions à choisir.")
    expect(t?.finalize).toBe(true)
  })

  it("en retard, « Finaliser » passe à l'alerte", () => {
    const t = tracking(
      exam({ finalizedAt: null, startDate: now - DAY }),
      "preparation",
      figures(),
      now,
    )

    expect(t?.description).toContain("Le jeu de questions est complet")
    expect(t?.finalize).toBe(false)
  })

  it("en cours : fermeture et barre des soumissions", () => {
    const t = tracking(
      exam({ startDate: now - DAY }),
      "active",
      figures({ started: 64, submitted: 41 }),
      now,
    )

    expect(t?.title).toBe("Examen en cours")
    expect(t?.progress).toEqual({ submitted: 41, started: 64 })
  })

  it("suspendu : l'effet de la suspension et la barre des soumissions", () => {
    const t = tracking(
      exam({ startDate: now - DAY, isActive: false }),
      "suspended",
      figures({ started: 12, submitted: 5 }),
      now,
    )

    expect(t?.title).toBe("Examen suspendu")
    expect(t?.description).toContain(
      "Plus aucun candidat ne pourra commencer cet examen.",
    )
    expect(t?.progress).toEqual({ submitted: 5, started: 12 })
  })

  it("suspendu avant son ouverture : ni candidat en cours ni barre", () => {
    const t = tracking(exam({ isActive: false }), "suspended", figures(), now)

    expect(t?.description).toContain(
      "Aucun candidat ne pourra le commencer à son ouverture",
    )
    expect(t?.description).not.toContain("composent déjà")
    expect(t?.progress).toBeNull()
  })

  it("rien une fois l'examen terminé", () => {
    expect(tracking(exam(), "completed", figures(), now)).toBeNull()
  })
})

const lbEntry = (id: string, flag: "admin" | "deleted" | null) =>
  ({
    participationId: id,
    user: { id: `u-${id}`, name: id, username: null, image: null, flag },
    score: 80,
    completedAt: now,
    status: "completed",
  }) satisfies LeaderboardEntry

describe("rankOf", () => {
  const board = [
    lbEntry("a", "admin"),
    lbEntry("b", null),
    lbEntry("c", "deleted"),
  ]

  it("rang sur la population du classement", () => {
    // Copies admin et supprimées listées sans rang : seule b est classée.
    expect(rankOf(board, "u-b")).toEqual({ rank: 1, total: 1 })
    expect(rankOf(board, "u-c")).toBeNull()
    expect(rankOf(board, "u-z")).toBeNull()
  })
})

describe("DeleteExamDialog", () => {
  const renderDialog = (participations: number, suspendable = true) => {
    const onSuspendInstead = vi.fn()
    render(
      <DeleteExamDialog
        exam={exam()}
        participations={participations}
        suspendable={suspendable}
        open
        onOpenChange={vi.fn()}
        onSuspendInstead={onSuspendInstead}
      />,
    )
    return { user: userEvent.setup(), onSuspendInstead }
  }

  it("sans participation, supprime sans saisie puis revient à la liste", async () => {
    deleteExam.mockResolvedValue({ success: true })
    const { user } = renderDialog(0)

    expect(
      screen.getByText(
        "Aucune participation : l'examen et son jeu de questions seront retirés.",
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByTestId("btn-delete-exam-confirm"))

    expect(deleteExam).toHaveBeenCalledWith({
      examId: "exam-1",
      expectedParticipations: 0,
    })
    expect(push).toHaveBeenCalledWith("/admin/examens")
  })

  it("avec participations, exige l'identifiant de l'examen", async () => {
    const { user } = renderDialog(3)

    expect(
      screen.getByText("3 participations seront effacées"),
    ).toBeInTheDocument()
    const confirm = screen.getByTestId("btn-delete-exam-confirm")
    expect(confirm).toBeDisabled()

    await user.type(screen.getByTestId("delete-exam-confirm-input"), "exam-")
    expect(confirm).toBeDisabled()

    await user.type(screen.getByTestId("delete-exam-confirm-input"), "1")
    expect(confirm).toBeEnabled()
  })

  it("propose la suspension à la place d'un examen suspendable", async () => {
    const { user, onSuspendInstead } = renderDialog(2)

    await user.click(screen.getByTestId("btn-suspend-instead"))
    expect(onSuspendInstead).toHaveBeenCalled()
  })

  it("pas de suspension à la place d'un examen clos ou déjà suspendu", () => {
    renderDialog(2, false)

    expect(screen.queryByTestId("btn-suspend-instead")).toBeNull()
  })
})
