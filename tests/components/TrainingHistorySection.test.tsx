import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TrainingHistorySection } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section"
import type {
  TrainingHistoryItem,
  TrainingHistoryPage,
} from "@/features/training/dal"

const {
  refresh,
  toastError,
  toastSuccess,
  loadTrainingHistory,
  deleteTrainingSession,
  deleteAllTrainingSessions,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  loadTrainingHistory: vi.fn(),
  deleteTrainingSession: vi.fn(),
  deleteAllTrainingSessions: vi.fn(),
}))

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh, push: vi.fn() }),
}))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))
vi.mock("@/features/training/actions", () => ({
  loadTrainingHistory,
  deleteTrainingSession,
  deleteAllTrainingSessions,
}))

const item = (
  id: string,
  over: Partial<TrainingHistoryItem> = {},
): TrainingHistoryItem => ({
  id,
  questionCount: 10,
  score: 70,
  domain: "Cardiologie",
  mode: "test",
  completedAt: Date.parse("2026-09-26T14:00:00Z"),
  startedAt: Date.parse("2026-09-26T13:00:00Z"),
  ...over,
})

const page = (
  items: TrainingHistoryItem[],
  over: Partial<TrainingHistoryPage> = {},
): TrainingHistoryPage => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 10,
  ...over,
})

// Tableau (≥ 1100 px) et lignes empilées coexistent dans le DOM : on lit le tableau.
const table = () => within(screen.getByRole("table"))

describe("TrainingHistorySection", () => {
  it("vide : message, sans « Tout supprimer »", () => {
    render(<TrainingHistorySection initialHistory={page([])} />)
    expect(screen.getByText("Aucune série pour le moment.")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Tout supprimer/ }),
    ).not.toBeInTheDocument()
  })

  it("une ligne par série : date, domaine, mode, questions, score, actions", () => {
    render(
      <TrainingHistorySection
        initialHistory={page([
          item("s1", { mode: "tutor" }),
          item("s2", { domain: null, score: 55 }),
        ])}
      />,
    )
    const t = table()
    expect(t.getAllByText("26 sept. 2026")).toHaveLength(2)
    expect(t.getByText("Cardiologie")).toBeInTheDocument()
    expect(t.getByText("Tous les domaines")).toBeInTheDocument()
    expect(t.getByText("Tuteur")).toBeInTheDocument()
    expect(t.getByText("Test")).toBeInTheDocument()
    expect(t.getAllByTestId("history-score").map((s) => s.textContent)).toEqual(
      ["70 %", "55 %"],
    )
    expect(t.getAllByRole("link", { name: /Revoir/ })[0]).toHaveAttribute(
      "href",
      "/tableau-de-bord/entrainement/s1/resultats",
    )
  })

  it("score retenu : sablier et info-bulle, « Revoir » conservé", () => {
    render(
      <TrainingHistorySection
        initialHistory={page([item("s1", { score: null })])}
      />,
    )
    const t = table()
    const held = t.getByTestId("history-score-withheld")
    expect(held).toHaveTextContent("Score retenu")
    expect(held).toHaveAttribute(
      "aria-label",
      "Score retenu. Score disponible après la clôture de l'examen.",
    )
    expect(t.queryByTestId("history-score")).not.toBeInTheDocument()
    expect(t.getByRole("link", { name: /Revoir/ })).toBeInTheDocument()
  })

  it("pagination numérotée au-delà de 10 lignes : « Page 1 sur 4 », la page 2 se charge en place", async () => {
    const items = Array.from({ length: 10 }, (_, i) => item(`s${i}`))
    loadTrainingHistory.mockResolvedValue(
      page([item("s10", { domain: "Neurologie" })], { total: 34, page: 2 }),
    )
    render(
      <TrainingHistorySection initialHistory={page(items, { total: 34 })} />,
    )
    expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "2" }))
    expect(loadTrainingHistory).toHaveBeenCalledWith({ page: 2 })
    await waitFor(() =>
      expect(screen.getByText("Page 2 sur 4")).toBeInTheDocument(),
    )
    expect(table().getByText("Neurologie")).toBeInTheDocument()
  })

  it("moins de 11 lignes : pas de pagination", () => {
    render(<TrainingHistorySection initialHistory={page([item("s1")])} />)
    expect(screen.queryByText(/Page 1 sur/)).not.toBeInTheDocument()
  })

  it("supprimer une série : confirmation, puis relecture de la page", async () => {
    deleteTrainingSession.mockResolvedValue({ success: true })
    loadTrainingHistory.mockResolvedValue(page([]))
    render(<TrainingHistorySection initialHistory={page([item("s1")])} />)

    await userEvent.click(
      table().getByRole("button", { name: "Supprimer cette série" }),
    )
    expect(
      screen.getByRole("heading", { name: "Supprimer cette série ?" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }))

    expect(deleteTrainingSession).toHaveBeenCalledWith({ sessionId: "s1" })
    expect(loadTrainingHistory).toHaveBeenCalledWith({ page: 1 })
    // L'action a revalidé la route : pas de refresh en plus.
    expect(refresh).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(
        screen.getByText("Aucune série pour le moment."),
      ).toBeInTheDocument(),
    )
  })

  it("supprimer la dernière ligne d'une page recule d'une page", async () => {
    deleteTrainingSession.mockResolvedValue({ success: true })
    loadTrainingHistory.mockResolvedValue(page([item("s0")], { total: 10 }))
    render(
      <TrainingHistorySection
        initialHistory={page([item("s10")], { total: 11, page: 2 })}
      />,
    )
    await userEvent.click(
      table().getByRole("button", { name: "Supprimer cette série" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    expect(loadTrainingHistory).toHaveBeenCalledWith({ page: 1 })
  })

  it("tout supprimer : le texte prévient que la révision ciblée garde les examens et les signets", async () => {
    deleteAllTrainingSessions.mockResolvedValue({
      success: true,
      deletedCount: 2,
    })
    loadTrainingHistory.mockResolvedValue(page([]))
    render(
      <TrainingHistorySection
        initialHistory={page([item("s1"), item("s2")])}
      />,
    )
    await userEvent.click(
      screen.getByRole("button", { name: /Tout supprimer/ }),
    )
    expect(
      screen.getByText(
        "Les séries terminées et leurs résultats seront supprimés. Vos réponses d'examens blancs et vos questions marquées restent prises en compte dans la révision ciblée.",
      ),
    ).toBeInTheDocument()
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Tout supprimer",
      }),
    )
    expect(deleteAllTrainingSessions).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith("2 séries supprimées")
  })

  it("un refus de suppression laisse le dialogue ouvert", async () => {
    deleteTrainingSession.mockResolvedValue({
      success: false,
      error: "Série introuvable",
    })
    render(<TrainingHistorySection initialHistory={page([item("s1")])} />)
    await userEvent.click(
      table().getByRole("button", { name: "Supprimer cette série" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    expect(toastError).toHaveBeenCalledWith("Série introuvable")
    expect(loadTrainingHistory).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })
})
