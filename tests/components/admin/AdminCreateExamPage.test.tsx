import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ExamFormSource } from "@/app/(admin)/admin/examens/_components/exam-form"
import AdminCreateExamPage from "@/app/(admin)/admin/examens/creer/page"
import { getExamReopeningSource } from "@/features/exams/dal"

vi.mock("@/app/(admin)/admin/examens/_components/exam-form", () => ({
  ExamForm: () => null,
}))

vi.mock("@/features/exams/dal", () => ({
  getEligibleExamCandidates: vi.fn(async () => []),
  getExamsForPicker: vi.fn(async () => []),
  getExamReopeningSource: vi.fn(),
}))

const NOW = Date.parse("2026-10-01T12:00:00Z")
vi.mock("@/lib/clock", () => ({ currentTimeMs: () => NOW }))

const sourceWithEnd = (endDate: number): ExamFormSource => ({
  exam: {
    title: "Révision 3",
    description: null,
    endDate,
    enablePause: false,
    pauseDurationMinutes: null,
    questionCount: 3,
    audienceType: "subscribers",
  },
  questionIds: ["q1", "q2", "q3"],
  audience: [],
})

const renderPage = async (source?: string | string[]) =>
  (await AdminCreateExamPage({
    searchParams: Promise.resolve({ source }),
  })) as ReactElement<{ source?: ExamFormSource }>

describe("page de création d'examen", () => {
  beforeEach(() => {
    vi.mocked(getExamReopeningSource).mockReset()
  })

  it("pré-remplit depuis une source close", async () => {
    const source = sourceWithEnd(NOW - 1)
    vi.mocked(getExamReopeningSource).mockResolvedValue(source)

    const page = await renderPage("e1")

    expect(getExamReopeningSource).toHaveBeenCalledWith("e1")
    expect(page.props.source).toBe(source)
    expect(page.key).toBe("e1")
  })

  it("formulaire vide pour une source encore ouverte", async () => {
    vi.mocked(getExamReopeningSource).mockResolvedValue(sourceWithEnd(NOW + 1))

    const page = await renderPage("e1")

    expect(page.props.source).toBeUndefined()
  })

  it("formulaire vide pour une source introuvable", async () => {
    vi.mocked(getExamReopeningSource).mockResolvedValue(null)

    const page = await renderPage("inconnu")

    expect(page.props.source).toBeUndefined()
  })

  it("ignore un paramètre répété et une page sans source", async () => {
    expect((await renderPage(["e1", "e2"])).props.source).toBeUndefined()
    expect((await renderPage()).props.source).toBeUndefined()
    expect(getExamReopeningSource).not.toHaveBeenCalled()
  })
})
