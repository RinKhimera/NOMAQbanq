import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ExamLeaderboard } from "@/app/(admin)/admin/examens/[id]/_components/exam-leaderboard"
import type { LeaderboardEntry } from "@/features/exams/dal"

const { deleteParticipation } = vi.hoisted(() => ({
  deleteParticipation: vi.fn(),
}))

vi.mock("@/features/exams/actions", () => ({ deleteParticipation }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const entry = (
  participationId: string,
  name: string,
  username: string | null,
  score: number | null,
): LeaderboardEntry => ({
  participationId,
  user: { id: `user-${participationId}`, name, username, image: null },
  score,
  completedAt: 1700000000000,
})

const leaderboard = [
  entry("p1", "Hélène Martin", "helene", 92),
  entry("p2", "Paul Durand", "pdurand", 85),
  entry("p3", "Amine Kaci", "zorro", 71),
]

function renderLeaderboard() {
  render(<ExamLeaderboard examId="exam-1" leaderboard={leaderboard} isAdmin />)
  return userEvent.setup()
}

const search = () => screen.getByPlaceholderText("Rechercher un participant...")
const visibleNames = () =>
  screen
    .getAllByRole("listitem")
    .map((item) => within(item).getAllByRole("paragraph")[0].textContent)

describe("ExamLeaderboard — recherche", () => {
  it("filtre les participants par nom", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "paul")

    expect(visibleNames()).toEqual(["Paul Durand"])
  })

  it("filtre aussi par @username", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "zorro")

    expect(visibleNames()).toEqual(["Amine Kaci"])
  })

  it("ignore la casse et les accents", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "HELENE")

    expect(visibleNames()).toEqual(["Hélène Martin"])
  })

  it("chaque participant garde son rang dans le classement complet", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "amine")

    const [row] = screen.getAllByRole("listitem")
    expect(within(row).getByText("3")).toBeInTheDocument()
  })

  it("annonce qu'aucun participant ne correspond", async () => {
    const user = renderLeaderboard()

    await user.type(search(), "inconnu")

    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
    expect(
      screen.getByText("Aucun participant ne correspond à « inconnu »."),
    ).toBeInTheDocument()
  })

  it("« Supprimer » vise la participation de la ligne filtrée", async () => {
    deleteParticipation.mockResolvedValue({ success: true, data: null })
    const user = renderLeaderboard()

    await user.type(search(), "paul")
    await user.click(
      screen.getByTitle("Supprimer la participation de Paul Durand"),
    )
    await user.click(
      await screen.findByRole("button", { name: "Supprimer définitivement" }),
    )

    expect(deleteParticipation).toHaveBeenCalledWith({ participationId: "p2" })
  })
})
