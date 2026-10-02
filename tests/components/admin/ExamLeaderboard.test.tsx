import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ExamLeaderboard } from "@/app/(admin)/admin/examens/[id]/_components/exam-leaderboard"
import type { LeaderboardEntry } from "@/features/exams/dal"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const entry = (
  participationId: string,
  name: string,
  username: string | null,
  score: number | null,
  {
    flag = null,
    status = "completed",
  }: {
    flag?: "admin" | "deleted" | null
    status?: LeaderboardEntry["status"]
  } = {},
): LeaderboardEntry => ({
  participationId,
  user: { id: `user-${participationId}`, name, username, image: null, flag },
  score,
  completedAt: 1700000000000,
  status,
})

const leaderboard = [
  entry("p1", "Hélène Martin", "helene", 92),
  entry("p2", "Paul Durand", "pdurand", 85, { status: "auto_submitted" }),
  entry("p3", "Amine Kaci", "zorro", 71),
]

const renderLeaderboard = (rows = leaderboard) => {
  render(<ExamLeaderboard examId="exam-1" leaderboard={rows} isAdmin />)
  return userEvent.setup()
}

const search = () => screen.getByPlaceholderText("Rechercher un participant…")
const row = (participationId: string) =>
  screen.getByTestId(`leaderboard-row-${participationId}`).closest("tr")!
const shownIds = () =>
  screen
    .queryAllByTestId(/^leaderboard-row-/)
    .map((el) => el.dataset.testid?.replace("leaderboard-row-", ""))

describe("ExamLeaderboard — lignes", () => {
  it("signale un compte admin et un compte supprimé", () => {
    renderLeaderboard([
      entry("p1", "Équipe NOMAQbanq", null, 98, { flag: "admin" }),
      entry("p2", "Utilisateur supprimé", null, 90, { flag: "deleted" }),
      entry("p3", "Paul Durand", "pdurand", 85),
    ])

    expect(within(row("p1")).getByText("Admin")).toBeInTheDocument()
    expect(within(row("p2")).getByText("Supprimé")).toBeInTheDocument()
    expect(within(row("p3")).queryByText(/^(Admin|Supprimé)$/)).toBeNull()
  })

  it("distingue une soumission automatique d'une soumission manuelle", () => {
    renderLeaderboard()

    expect(within(row("p2")).getByText("Automatique")).toBeInTheDocument()
    expect(within(row("p1")).getByText("Manuelle")).toBeInTheDocument()
  })

  it("« Voir la copie » mène à la copie de l'étudiant", () => {
    renderLeaderboard()

    expect(screen.getByTestId("btn-view-copy-p3").getAttribute("href")).toBe(
      "/admin/examens/exam-1/resultats/user-p3",
    )
  })

  it("annonce un classement provisoire", () => {
    render(
      <ExamLeaderboard
        examId="exam-1"
        leaderboard={leaderboard}
        isAdmin
        provisional
      />,
    )

    expect(screen.getByTestId("leaderboard-provisional")).toBeInTheDocument()
  })

  it("dit qu'il n'y a pas encore de participation", () => {
    renderLeaderboard([])

    expect(screen.getByTestId("leaderboard-empty")).toHaveTextContent(
      "Aucune participation pour l'instant.",
    )
  })
})

describe("ExamLeaderboard — dix premiers", () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    entry(`p${i + 1}`, `Étudiant ${i + 1}`, null, 90 - i),
  )

  it("montre les dix premiers puis le reste à la demande", async () => {
    const user = renderLeaderboard(many)

    expect(shownIds()).toHaveLength(10)
    expect(screen.getByTestId("leaderboard-summary")).toHaveTextContent(
      "10 premiers sur 12.",
    )

    await user.click(screen.getByTestId("btn-leaderboard-show-all"))

    expect(shownIds()).toHaveLength(12)
  })

  it("cherche dans tout le classement, au-delà des dix premiers", async () => {
    const user = renderLeaderboard(many)

    await user.type(search(), "Étudiant 12")

    expect(shownIds()).toEqual(["p12"])
    expect(within(row("p12")).getByText("12")).toBeInTheDocument()
  })
})

describe("ExamLeaderboard — recherche", () => {
  it("filtre par nom et par @username, sans casse ni accents", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "HELENE")
    expect(shownIds()).toEqual(["p1"])

    await user.clear(search())
    await user.type(search(), "zorro")
    expect(shownIds()).toEqual(["p3"])
  })

  it("chaque participant garde son rang dans le classement complet", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "amine")

    expect(within(row("p3")).getByText("3")).toBeInTheDocument()
  })

  it("annonce qu'aucun participant ne correspond", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "inconnu")

    expect(shownIds()).toHaveLength(0)
    expect(
      screen.getByText("Aucun participant ne correspond à « inconnu »."),
    ).toBeInTheDocument()
  })
})

describe("ExamLeaderboard — étudiant", () => {
  it("n'ouvre que sa propre copie et masque la colonne Soumission", () => {
    render(
      <ExamLeaderboard
        examId="exam-1"
        leaderboard={leaderboard}
        currentUserId="user-p2"
      />,
    )

    expect(screen.getByTestId("btn-view-copy-p2").getAttribute("href")).toBe(
      "/tableau-de-bord/examen-blanc/exam-1/resultats",
    )
    expect(screen.queryByTestId("btn-view-copy-p1")).toBeNull()
    expect(screen.queryByText("Automatique")).toBeNull()
  })

  it("ne rend rien sans participation", () => {
    const { container } = render(
      <ExamLeaderboard examId="exam-1" leaderboard={[]} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
