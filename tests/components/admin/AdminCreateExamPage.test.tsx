import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"
import type { ExamFormProps } from "@/app/(admin)/admin/examens/_components/exam-form"
import AdminCreateExamPage from "@/app/(admin)/admin/examens/creer/page"
import {
  type ExamReopeningSource,
  getExamReopeningSource,
} from "@/features/exams/dal"
import { type BankQuestion, getExamSelection } from "@/features/questions/dal"

vi.mock("@/app/(admin)/admin/examens/_components/exam-form", () => ({
  ExamForm: () => null,
}))

vi.mock("@/features/exams/dal", () => ({
  getEligibleSubscriberCount: vi.fn(async () => 118),
  getExamReopeningSource: vi.fn(),
}))

vi.mock("@/features/questions/dal", () => ({
  getExamSelection: vi.fn(),
}))

const NOW = Date.parse("2026-10-01T12:00:00Z")
vi.mock("@/lib/clock", () => ({ currentTimeMs: () => NOW }))

const sourceWithEnd = (endDate: number): ExamReopeningSource => ({
  exam: {
    title: "Révision 3",
    description: null,
    endDate,
    enablePause: false,
    pauseDurationMinutes: null,
    questionCount: 3,
    audienceType: "subscribers",
    isHidden: false,
  },
  questionIds: ["q1", "q2"],
  audience: [],
})

const bankQuestion = (id: string) =>
  ({ id, domain: "Cardiologie" }) as BankQuestion

const renderPage = async (source?: string | string[]) =>
  (await AdminCreateExamPage({
    searchParams: Promise.resolve({ source }),
  })) as ReactElement<ExamFormProps>

describe("page de création d'examen", () => {
  it("pré-remplit une réouverture depuis une source close : visé de la source, questions non supprimées", async () => {
    vi.mocked(getExamReopeningSource).mockResolvedValue(sourceWithEnd(NOW - 1))
    // q3 a été supprimée depuis : la source ne la reprend pas.
    vi.mocked(getExamSelection).mockResolvedValue(
      ["q1", "q2", "q3"].map(bankQuestion),
    )

    const page = await renderPage("e1")

    expect(page.key).toBe("e1")
    expect(page.props.saved).toBeNull()
    expect(page.props.initialNow).toBe(NOW)
    expect(page.props.subscriberCount).toBe(118)
    expect(page.props.initialValues).toMatchObject({
      title: "Révision 3 (réouverture)",
      targetQuestionCount: 3,
      startDate: null,
      endDate: null,
    })
    expect(page.props.reopening).toEqual({
      title: "Révision 3",
      questionIds: ["q1", "q2"],
    })
    expect(page.props.selection.map((q) => q.id)).toEqual(["q1", "q2"])
  })

  it("formulaire vide pour une source encore ouverte", async () => {
    vi.mocked(getExamReopeningSource).mockResolvedValue(sourceWithEnd(NOW + 1))

    const page = await renderPage("e1")

    expect(page.props.reopening).toBeNull()
    expect(page.props.initialValues.title).toBe("")
    expect(getExamSelection).not.toHaveBeenCalled()
  })

  it("formulaire vide pour une source introuvable", async () => {
    vi.mocked(getExamReopeningSource).mockResolvedValue(null)

    const page = await renderPage("inconnu")

    expect(page.props.reopening).toBeNull()
    expect(page.props.selection).toEqual([])
  })

  it("ignore un paramètre répété et une page sans source", async () => {
    expect((await renderPage(["e1", "e2"])).props.reopening).toBeNull()
    expect((await renderPage()).props.reopening).toBeNull()
    expect(getExamReopeningSource).not.toHaveBeenCalled()
  })
})
