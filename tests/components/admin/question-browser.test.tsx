import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionBrowser } from "@/components/admin/question-browser"

const loadQuestionsPage = vi.fn()
vi.mock("@/features/questions/actions", () => ({
  loadQuestionsPage: (...a: unknown[]) => loadQuestionsPage(...a),
  loadAllQuestionIds: vi.fn().mockResolvedValue([]),
}))

const makePage = () => ({
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
  total: 120, // → 3 pages (pageSize 50)
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

  it("taper une recherche recharge en page 1 (terme inclus)", async () => {
    render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    fireEvent.click(await screen.findByRole("button", { name: "2" }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    )
    fireEvent.change(
      screen.getByPlaceholderText(/rechercher dans les questions/i),
      { target: { value: "infarctus" } },
    )
    await waitFor(
      () =>
        expect(loadQuestionsPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 1, search: "infarctus" }),
        ),
      { timeout: 1500 },
    )
  })
})
