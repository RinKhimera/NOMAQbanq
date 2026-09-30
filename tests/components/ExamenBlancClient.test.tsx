import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ExamenBlancClient } from "@/app/(dashboard)/tableau-de-bord/examen-blanc/_components/examen-blanc-client"
import type { ExamListItem, ExamListParticipation } from "@/features/exams/dal"

const { push, refresh, toastError, startExam } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  startExam: vi.fn(),
}))

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh }),
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
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}))
vi.mock("@/features/exams/actions", () => ({ startExam }))

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.parse("2026-09-26T15:00:00Z")

const exam = (id: string, over: Partial<ExamListItem> = {}): ExamListItem => ({
  id,
  title: `Examen blanc ${id}`,
  description: "Examen complet couvrant l'ensemble des domaines.",
  startDate: NOW - DAY,
  endDate: NOW + 2 * DAY,
  questionCount: 230,
  completionTime: 318 * 60,
  isActive: true,
  enablePause: true,
  pauseDurationMinutes: 45,
  audienceType: "subscribers",
  userHasTaken: false,
  userParticipation: null,
  ...over,
})

const participation = (
  over: Partial<ExamListParticipation> = {},
): ExamListParticipation => ({
  status: "completed",
  score: 72,
  completedAt: NOW - 3 * DAY,
  answeredCount: 230,
  timing: null,
  withheldBy: null,
  ...over,
})

const past = (id: string, over: Partial<ExamListItem> = {}) =>
  exam(id, {
    startDate: NOW - 10 * DAY,
    endDate: NOW - 7 * DAY,
    userHasTaken: true,
    userParticipation: participation(),
    ...over,
  })

/** Carte de chiffre portant ce libellé (libellé → en-tête → carte). */
const vital = (label: string) =>
  screen.getByText(label).parentElement!.parentElement!

const renderList = (
  exams: ExamListItem[],
  props: Partial<Parameters<typeof ExamenBlancClient>[0]> = {},
) =>
  render(
    <ExamenBlancClient
      exams={exams}
      hasExamAccess
      accessExpiredAt={null}
      priceFromCents={5000}
      initialNow={NOW}
      {...props}
    />,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ExamenBlancClient — chiffres", () => {
  it("passés, réussis sur les scores lisibles, moyenne au plancher", () => {
    renderList([
      past("1", { userParticipation: participation({ score: 59.67 }) }),
      past("2", { userParticipation: participation({ score: 80 }) }),
      past("3", { userParticipation: participation({ score: null }) }),
      past("4", { userHasTaken: false, userParticipation: null }),
    ])
    expect(vital("Examens passés")).toHaveTextContent(/^Examens passés3/)
    expect(vital("Réussis")).toHaveTextContent("1 / 2")
    expect(vital("Score moyen")).toHaveTextContent(/69%/)
  })

  it("« — » sans score lisible, jamais 0 %", () => {
    renderList([
      past("3", { userParticipation: participation({ score: null }) }),
    ])
    expect(vital("Réussis")).toHaveTextContent("—")
    expect(vital("Score moyen")).toHaveTextContent("—")
    expect(vital("Score moyen")).not.toHaveTextContent("%")
  })
})

describe("ExamenBlancClient — examens ouverts", () => {
  it("ouvert : badge, fenêtre, chiffres, fermeture et « Commencer l'examen »", async () => {
    renderList([exam("26")])
    const card = screen.getByTestId("exam-card-26")
    expect(card).toHaveAttribute("data-state", "eligible")
    expect(within(card).getByText("Ouvert maintenant")).toBeInTheDocument()
    expect(within(card).getByText("Fermeture dans")).toBeInTheDocument()
    expect(within(card).getByText("2 j 0 h")).toBeInTheDocument()
    expect(within(card).getByText("5 h 18")).toBeInTheDocument()
    expect(within(card).getByText("45 min")).toBeInTheDocument()

    await userEvent.click(
      within(card).getByRole("button", { name: "Commencer l'examen" }),
    )
    const dialog = screen.getByTestId("exam-start-dialog")
    expect(dialog).toHaveTextContent("Commencer Examen blanc 26 ?")
    expect(within(dialog).getByTestId("btn-start-exam")).toBeDisabled()
  })

  it("le départ exige les consignes lues, puis crée la participation et navigue", async () => {
    startExam.mockResolvedValue({
      success: true,
      participationId: "p1",
      startedAt: NOW,
    })
    renderList([exam("26")])
    await userEvent.click(
      screen.getByRole("button", { name: "Commencer l'examen" }),
    )
    const dialog = screen.getByTestId("exam-start-dialog")
    await userEvent.click(within(dialog).getByTestId("exam-consignes-ack"))
    await userEvent.click(within(dialog).getByTestId("btn-start-exam"))
    expect(startExam).toHaveBeenCalledWith({ examId: "26" })
    expect(push).toHaveBeenCalledWith(
      "/tableau-de-bord/examen-blanc/26/evaluation",
    )
  })

  it("un refus du serveur au départ relit la liste", async () => {
    startExam.mockResolvedValue({
      success: false,
      error: "Votre accès aux examens a expiré.",
    })
    renderList([exam("26")])
    await userEvent.click(
      screen.getByRole("button", { name: "Commencer l'examen" }),
    )
    const dialog = screen.getByTestId("exam-start-dialog")
    await userEvent.click(within(dialog).getByTestId("exam-consignes-ack"))
    await userEvent.click(within(dialog).getByTestId("btn-start-exam"))
    expect(toastError).toHaveBeenCalledWith("Votre accès aux examens a expiré.")
    expect(refresh).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it("sans accès : la liste reste, bandeau et « Réservé aux abonnés » ; sur invitation reste passable", () => {
    renderList([exam("26"), exam("26C", { audienceType: "restricted" })], {
      hasExamAccess: false,
    })
    expect(screen.getByTestId("exam-access-banner")).toHaveTextContent(
      "Accès Examens requis",
    )
    expect(screen.getByTestId("exam-access-banner")).toHaveTextContent(/50\s\$/)
    const locked = screen.getByTestId("exam-card-26")
    expect(locked).toHaveAttribute("data-state", "locked")
    expect(within(locked).getByText("Réservé aux abonnés")).toBeInTheDocument()
    expect(
      within(locked).getByRole("link", { name: /Voir les tarifs/ }),
    ).toHaveAttribute("href", "/tarifs")
    const invited = screen.getByTestId("exam-card-26C")
    expect(invited).toHaveAttribute("data-state", "eligible")
    expect(within(invited).getByText("Sur invitation")).toBeInTheDocument()
  })

  it("accès expiré : le bandeau donne la date et « Prolonger l'accès »", () => {
    renderList([exam("26")], {
      hasExamAccess: false,
      accessExpiredAt: Date.parse("2026-09-20T12:00:00Z"),
    })
    expect(screen.getByTestId("exam-access-banner")).toHaveTextContent(
      "Votre accès Examens a expiré le 20 septembre 2026",
    )
    expect(
      screen.getByRole("link", { name: /Prolonger l'accès/ }),
    ).toHaveAttribute("href", "/tarifs")
  })

  it("en cours : temps restant, répondues et « Reprendre l'examen »", () => {
    renderList([
      exam("26", {
        userParticipation: participation({
          status: "in_progress",
          score: null,
          completedAt: null,
          answeredCount: 87,
          timing: {
            startedAt: NOW - 2 * HOUR,
            budgetSeconds: 318 * 60,
            pauseCreditMs: 0,
            pauseInProgress: null,
          },
        }),
      }),
    ])
    const card = screen.getByTestId("exam-card-26")
    expect(card).toHaveAttribute("data-state", "started")
    expect(within(card).getByText("En cours")).toBeInTheDocument()
    expect(within(card).getByText("3 h 18")).toBeInTheDocument()
    expect(within(card).getByText("87 / 230")).toBeInTheDocument()
    expect(
      within(card).getByRole("link", { name: "Reprendre l'examen" }),
    ).toHaveAttribute("href", "/tableau-de-bord/examen-blanc/26/evaluation")
  })

  it("ferme avant la fin du temps : le plus court des deux, en avertissement", () => {
    renderList([
      exam("26", {
        endDate: NOW + HOUR,
        userParticipation: participation({
          status: "in_progress",
          score: null,
          completedAt: null,
          answeredCount: 87,
          timing: {
            startedAt: NOW - HOUR,
            budgetSeconds: 318 * 60,
            pauseCreditMs: 0,
            pauseInProgress: null,
          },
        }),
      }),
    ])
    const card = screen.getByTestId("exam-card-26")
    expect(within(card).getByText("1 h 00")).toBeInTheDocument()
    expect(
      within(card).getByText("L'examen ferme avant la fin de votre temps."),
    ).toBeInTheDocument()
  })

  it("en pause : temps figé et reprise automatique annoncée", () => {
    renderList([
      exam("26", {
        userParticipation: participation({
          status: "in_progress",
          score: null,
          completedAt: null,
          answeredCount: 112,
          timing: {
            startedAt: NOW - 2 * HOUR,
            budgetSeconds: 318 * 60,
            pauseCreditMs: 0,
            pauseInProgress: { startedAt: NOW - 22 * 60_000, capMinutes: 45 },
          },
        }),
      }),
    ])
    const card = screen.getByTestId("exam-card-26")
    expect(card).toHaveAttribute("data-state", "paused")
    expect(within(card).getByText("En pause")).toBeInTheDocument()
    expect(
      within(card).getByText(/Reprise automatique dans 23 min/),
    ).toBeInTheDocument()
  })

  it("temps écoulé, examen ouvert : « Voir la soumission »", () => {
    renderList([
      exam("26", {
        userParticipation: participation({
          status: "in_progress",
          score: null,
          completedAt: null,
          answeredCount: 214,
          timing: {
            startedAt: NOW - 6 * HOUR,
            budgetSeconds: 318 * 60,
            pauseCreditMs: 0,
            pauseInProgress: null,
          },
        }),
      }),
    ])
    const card = screen.getByTestId("exam-card-26")
    expect(card).toHaveAttribute("data-state", "elapsed")
    expect(within(card).getAllByText("Temps écoulé")).not.toHaveLength(0)
    expect(
      within(card).getByRole("link", { name: /Voir la soumission/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/examen-blanc/26/evaluation")
  })

  it("déjà soumis : carte discrète, sans score ni bouton", () => {
    renderList([
      exam("26", {
        userHasTaken: true,
        userParticipation: participation({
          score: null,
          completedAt: NOW - HOUR,
        }),
      }),
    ])
    const card = screen.getByTestId("exam-card-26")
    expect(card).toHaveAttribute("data-state", "submitted")
    expect(within(card).getByText("Soumis")).toBeInTheDocument()
    expect(within(card).getByText(/Résultats publiés le/)).toBeInTheDocument()
    expect(within(card).queryByRole("button")).not.toBeInTheDocument()
    expect(within(card).queryByText(/%/)).not.toBeInTheDocument()
  })

  it("aucun examen ouvert : le prochain et « S'entraîner en attendant »", () => {
    renderList([
      exam("28", { startDate: NOW + 5 * DAY, endDate: NOW + 8 * DAY }),
    ])
    expect(
      screen.getByText("Aucun examen ouvert pour le moment"),
    ).toBeInTheDocument()
    expect(screen.getByText(/Prochain : Examen blanc 28/)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /S'entraîner en attendant/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/entrainement")
    expect(screen.getByText("À venir", { selector: "h2" })).toBeInTheDocument()
  })

  it("aucun examen du tout : état vide vers une série", () => {
    renderList([])
    expect(
      screen.getByText("Aucun examen blanc pour l'instant"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Commencer une série" }),
    ).toHaveAttribute("href", "/tableau-de-bord/entrainement")
  })
})

describe("ExamenBlancClient — terminés", () => {
  it("score au plancher avec « Résultats », retenu avec sablier, non passé, clôture en cours", () => {
    renderList([
      past("25A", {
        userParticipation: participation({
          status: "auto_submitted",
          score: 59.67,
        }),
      }),
      past("25B", {
        userParticipation: participation({
          score: null,
          withheldBy: "Examen blanc 27",
        }),
      }),
      past("24", { userHasTaken: false, userParticipation: null }),
      past("26", {
        endDate: NOW - HOUR,
        userHasTaken: false,
        userParticipation: participation({
          status: "in_progress",
          score: null,
          completedAt: null,
        }),
      }),
    ])
    const a = screen.getByTestId("exam-row-25A")
    expect(within(a).getByTestId("exam-score")).toHaveTextContent(/59\s%/)
    expect(within(a).getByText("Soumis automatiquement")).toBeInTheDocument()
    expect(within(a).getByRole("link", { name: /Résultats/ })).toHaveAttribute(
      "href",
      "/tableau-de-bord/examen-blanc/25A/resultats",
    )

    const b = screen.getByTestId("exam-row-25B")
    expect(within(b).getByTestId("exam-score-withheld")).toHaveAttribute(
      "aria-label",
      "Score retenu. Publié à la fermeture de Examen blanc 27.",
    )
    expect(
      within(b).getByRole("link", { name: /Résultats/ }),
    ).toBeInTheDocument()

    expect(
      within(screen.getByTestId("exam-row-24")).getByText("Non passé"),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("exam-row-26")).getByText(
        "Résultats en cours de publication",
      ),
    ).toBeInTheDocument()
  })

  it("sans accès, « Résultats » porte un cadenas vers les tarifs, sauf sur invitation", () => {
    renderList([past("25A"), past("25C", { audienceType: "restricted" })], {
      hasExamAccess: false,
    })
    expect(
      within(screen.getByTestId("exam-row-25A")).getByRole("link", {
        name: "Résultats, accès requis pour la correction",
      }),
    ).toHaveAttribute("href", "/tarifs")
    expect(
      within(screen.getByTestId("exam-row-25C")).getByRole("link", {
        name: /Résultats/,
      }),
    ).toHaveAttribute("href", "/tableau-de-bord/examen-blanc/25C/resultats")
  })

  it("groupés par mois ; au-delà de trois mois, repli avec le détail", async () => {
    const months = [0, 1, 2, 3, 4].map((m) =>
      past(`m${m}`, {
        startDate: Date.parse(`2026-0${9 - m}-05T00:00:00Z`),
        endDate: Date.parse(`2026-0${9 - m}-10T00:00:00Z`),
      }),
    )
    renderList(months)
    expect(screen.getByText("Septembre 2026")).toBeInTheDocument()
    expect(screen.queryByTestId("exam-row-m3")).not.toBeInTheDocument()
    const more = screen.getByRole("button", {
      name: /Afficher les mois précédents/,
    })
    expect(more).toHaveTextContent("(2 mois · 2 examens)")
    await userEvent.click(more)
    expect(screen.getByTestId("exam-row-m3")).toBeInTheDocument()
    expect(screen.getByText("Mai 2026")).toBeInTheDocument()
  })
})
