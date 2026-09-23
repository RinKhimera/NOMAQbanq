import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionAnswerBreakdown } from "@/app/(admin)/admin/questions/_components/question-answer-breakdown"

const loadQuestionAnswerBreakdown = vi.fn()
vi.mock("@/features/questions/actions", () => ({
  loadQuestionAnswerBreakdown: (...a: unknown[]) =>
    loadQuestionAnswerBreakdown(...a),
}))

describe("QuestionAnswerBreakdown", () => {
  beforeEach(() => loadQuestionAnswerBreakdown.mockReset())

  it("montre la part de chaque option, la clé mise en évidence", async () => {
    loadQuestionAnswerBreakdown.mockResolvedValue({
      answerCount: 12,
      successRate: 42,
      options: [
        { option: "Aspirine", count: 5, share: 42, isKey: true },
        { option: "Héparine", count: 7, share: 58, isKey: false },
      ],
    })
    render(<QuestionAnswerBreakdown questionId="q1" />)

    const rows = await screen.findAllByTestId("answer-share")
    expect(rows[0]).toHaveTextContent("Aspirine")
    expect(rows[0]).toHaveTextContent("42 %")
    expect(rows[0]).toHaveTextContent("5")
    expect(rows[0].dataset.key).toBe("true")
    expect(rows[1].dataset.key).toBe("false")
    expect(screen.getByTestId("answer-breakdown-summary")).toHaveTextContent(
      "42 % de réussite sur 12 réponses",
    )
    expect(loadQuestionAnswerBreakdown).toHaveBeenCalledWith("q1")
  })

  it("signale un échantillon insuffisant sans afficher de taux", async () => {
    loadQuestionAnswerBreakdown.mockResolvedValue({
      answerCount: 4,
      successRate: null,
      options: [
        { option: "Aspirine", count: 3, share: 75, isKey: true },
        { option: "Héparine", count: 1, share: 25, isKey: false },
      ],
    })
    render(<QuestionAnswerBreakdown questionId="q1" />)

    expect(
      await screen.findByTestId("answer-breakdown-summary"),
    ).toHaveTextContent("Données insuffisantes (4 réponses)")
  })

  it("annonce qu'aucun étudiant n'a encore répondu", async () => {
    loadQuestionAnswerBreakdown.mockResolvedValue({
      answerCount: 0,
      successRate: null,
      options: [{ option: "Aspirine", count: 0, share: 0, isKey: true }],
    })
    render(<QuestionAnswerBreakdown questionId="q1" />)

    expect(
      await screen.findByText("Aucun étudiant n'a encore répondu"),
    ).toBeInTheDocument()
    expect(screen.queryAllByTestId("answer-share")).toHaveLength(0)
  })
})
