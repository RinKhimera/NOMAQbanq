import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ExportQuestionsButton } from "@/app/(admin)/admin/questions/_components/export-questions-button"
import type { QuestionExportRow } from "@/features/questions/dal"

const mocks = vi.hoisted(() => ({
  loadQuestionsForExport: vi.fn(),
  downloadCsv: vi.fn(),
  downloadBlob: vi.fn(),
  exportRowsToXlsx: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock("@/features/questions/actions", () => ({
  loadQuestionsForExport: mocks.loadQuestionsForExport,
}))
vi.mock("@/lib/export", async (orig) => ({
  ...(await orig<typeof import("@/lib/export")>()),
  downloadCsv: mocks.downloadCsv,
  downloadBlob: mocks.downloadBlob,
  exportRowsToXlsx: mocks.exportRowsToXlsx,
}))
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))

const row = (
  overrides: Partial<QuestionExportRow> = {},
): QuestionExportRow => ({
  id: "q1",
  question: "Quel est le traitement ?",
  options: ["A", "B", "C"],
  correctAnswer: "B",
  explanation: "Parce que.",
  references: ["UpToDate", "Harrison"],
  objectifCMC: "Dyspnée",
  domain: "Cardiologie",
  hasImages: true,
  imagesCount: 2,
  createdAt: Date.UTC(2026, 8, 30),
  answerCount: 12,
  successRate: null,
  ...overrides,
})

const selection = { domain: "Cardiologie", hasImages: true }

const exportAs = async (format: RegExp) => {
  const user = userEvent.setup()
  render(<ExportQuestionsButton selection={selection} questionCount={2} />)
  await user.click(screen.getByRole("button", { name: "Exporter" }))
  await user.click(await screen.findByRole("menuitem", { name: format }))
}

describe("ExportQuestionsButton", () => {
  it("le menu annonce le nombre de questions selon les filtres", async () => {
    const user = userEvent.setup()
    render(<ExportQuestionsButton selection={selection} questionCount={2} />)
    await user.click(screen.getByRole("button", { name: "Exporter" }))

    expect(
      await screen.findByRole("menuitem", {
        name: /2 questions selon les filtres/,
      }),
    ).toBeInTheDocument()
  })

  it("CSV : charge la sélection affichée et télécharge le fichier", async () => {
    mocks.loadQuestionsForExport.mockResolvedValue([row(), row({ id: "q2" })])
    await exportAs(/CSV/)

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "2 questions exportées en CSV",
      ),
    )
    expect(mocks.loadQuestionsForExport).toHaveBeenCalledExactlyOnceWith(
      selection,
    )
    expect(mocks.downloadCsv).toHaveBeenCalledOnce()
    expect(mocks.downloadCsv.mock.lastCall?.[1]).toMatch(
      /^questions-export.*\.csv$/,
    )
  })

  it("JSON : le fichier contient les questions chargées", async () => {
    const questions = [row()]
    mocks.loadQuestionsForExport.mockResolvedValue(questions)
    await exportAs(/JSON/)

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "1 questions exportées en JSON",
      ),
    )
    const [blob, filename] = mocks.downloadBlob.mock.lastCall ?? []
    expect(filename).toMatch(/^questions-export.*\.json$/)
    expect(JSON.parse(await (blob as Blob).text())).toEqual(questions)
  })

  it("Excel : une ligne par question, options manquantes vides", async () => {
    mocks.loadQuestionsForExport.mockResolvedValue([row()])
    await exportAs(/Excel/)

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "1 questions exportées en Excel",
      ),
    )
    const [data, options] = mocks.exportRowsToXlsx.mock.lastCall ?? []
    expect(data).toEqual([
      expect.objectContaining({
        ID: "q1",
        "Option C": "C",
        "Option D": "",
        "Clé de réponse": "B",
        Références: "UpToDate; Harrison",
        "Avec images": "Oui",
        "Réussite (%)": "",
      }),
    ])
    expect(options).toMatchObject({ sheetName: "Questions" })
  })

  it("sélection vide : toast d'erreur, aucun téléchargement", async () => {
    mocks.loadQuestionsForExport.mockResolvedValue([])
    await exportAs(/CSV/)

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Aucune question à exporter",
      ),
    )
    expect(mocks.downloadCsv).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it("échec du chargement : toast d'erreur et bouton réactivé", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.loadQuestionsForExport.mockRejectedValue(new Error("réseau"))
    await exportAs(/JSON/)

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Erreur lors de l'export"),
    )
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Exporter" })).toBeEnabled(),
    )
  })
})
