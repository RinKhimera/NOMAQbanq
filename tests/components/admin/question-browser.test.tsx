import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionBrowser } from "@/components/admin/question-browser"

const SEARCH_DEBOUNCE_MS = 300

const loadQuestionsPage = vi.fn()
vi.mock("@/features/questions/actions", () => ({
  loadQuestionsPage: (...a: unknown[]) => loadQuestionsPage(...a),
  loadAllQuestionIds: vi.fn().mockResolvedValue([]),
}))

const makePage = (total = 120) => ({
  total,
  items: Array.from({ length: 50 }, (_, i) => ({
    id: `q${i}`,
    question: `Question ${i}`,
    domain: "Cardiologie",
    objectifCMC: "OBJ",
    options: ["A", "B", "C", "D"],
    createdAt: 0,
    imageCount: 0,
    usageCount: 0,
  })),
})

describe("QuestionBrowser — pagination & reset", () => {
  beforeEach(() => {
    loadQuestionsPage.mockReset()
    loadQuestionsPage.mockResolvedValue(makePage())
  })

  it("charge la page 1 au montage", async () => {
    render(<QuestionBrowser mode="browse" />)
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 50 }),
      ),
    )
  })

  it("cliquer une page déclenche un fetch de cette page", async () => {
    render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    fireEvent.click(await screen.findByRole("button", { name: "2" }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    )
  })

  it("clamp hors-borne : une page devenue vide ramène à la dernière page valide", async () => {
    render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    // Des suppressions ont vidé la page 3 : il ne reste que 100 questions
    // (2 pages de 50). Cliquer « 3 » doit re-clamper sur la page 2.
    loadQuestionsPage.mockImplementation((args: { page?: number }) =>
      Promise.resolve(
        (args.page ?? 1) >= 3 ? { items: [], total: 100 } : makePage(100),
      ),
    )
    fireEvent.click(await screen.findByRole("button", { name: "3" }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    )
    // La table réaffiche du contenu (pas d'état vide bloqué).
    expect(await screen.findByText("Question 0")).toBeInTheDocument()
  })

  // Faux timers pour franchir le debounce de recherche sans attente réelle.
  // Corollaire : ni `waitFor` ni `findBy*` ici — @testing-library/dom ne
  // reconnaît que les faux timers de Jest (`typeof jest !== "undefined"`,
  // helpers.js), donc sous l'horloge de Vitest il attendrait un intervalle que
  // personne n'avance. Chaque étape est vidangée explicitement.
  it("taper une recherche recharge en page 1 (terme inclus)", async () => {
    vi.useFakeTimers()
    const settle = async (ms = 0) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }
    try {
      render(<QuestionBrowser mode="browse" />)
      await settle()
      expect(screen.getByText("Question 0")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "2" }))
      await settle()
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      )

      fireEvent.change(
        screen.getByPlaceholderText(/rechercher dans les questions/i),
        { target: { value: "infarctus" } },
      )
      await settle(SEARCH_DEBOUNCE_MS)
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, search: "infarctus" }),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
