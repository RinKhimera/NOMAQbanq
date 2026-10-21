import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  ComposerClient,
  type ComposerExam,
} from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-client"
import { DEFAULT_COMPOSER } from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-params"
import type { BankQuestion } from "@/features/questions/dal"
import { COMPOSER_NOW, bankQuestion } from "../../helpers/bank-question"

const {
  addExamQuestions,
  removeExamQuestions,
  previewExamCompletion,
  loadQuestionFile,
  replace,
  refresh,
  toastSuccess,
  toastError,
  toastInfo,
} = vi.hoisted(() => ({
  addExamQuestions: vi.fn(),
  removeExamQuestions: vi.fn(),
  previewExamCompletion: vi.fn(),
  loadQuestionFile: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}))

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  usePathname: () => "/admin/examens/e1/questions",
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError, info: toastInfo },
}))
vi.mock("@/features/exams/actions", () => ({
  addExamQuestions,
  removeExamQuestions,
  previewExamCompletion,
}))
vi.mock("@/features/questions/actions", () => ({ loadQuestionFile }))

const EXAM: ComposerExam = {
  id: "e1",
  title: "EB-27",
  targetQuestionCount: 5,
  finalized: false,
  openToStudents: false,
  phase: "preparation",
}

const SELECTION: BankQuestion[] = [
  bankQuestion("s1", { question: "Fièvre du nourrisson", domain: "Pédiatrie" }),
  bankQuestion("s2", { question: "Toux chronique", domain: "Pneumologie" }),
]
const BANK: BankQuestion[] = [
  bankQuestion("b1", { question: "Douleur rétrosternale" }),
  bankQuestion("b2", { question: "Souffle systolique" }),
]

const renderComposer = (
  over: Partial<Parameters<typeof ComposerClient>[0]> = {},
) =>
  render(
    <ComposerClient
      exam={EXAM}
      frozen={false}
      state={DEFAULT_COMPOSER}
      selection={SELECTION}
      plan={[]}
      bank={{ items: BANK, total: 2 }}
      bankPageSize={20}
      initialNow={COMPOSER_NOW}
      {...over}
    />,
  )

const bankRow = (id: string) =>
  within(screen.getByTestId("composer-bank"))
    .getAllByTestId("composer-bank-row")
    .find((r) => r.dataset.questionId === id)!

const addButton = (id: string) =>
  within(bankRow(id)).getByTestId("btn-composer-add")

describe("ComposerClient : écritures", () => {
  it("ajouter une question l'envoie au serveur, annonce le changement et recharge", async () => {
    addExamQuestions.mockResolvedValue({
      success: true,
      count: 3,
      finalized: false,
    })
    renderComposer()
    fireEvent.click(addButton("b1"))
    expect(addExamQuestions).toHaveBeenCalledWith({
      examId: "e1",
      questionIds: ["b1"],
    })
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("1 question ajoutée"),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it("refus du serveur : toast d'erreur, pas de rechargement", async () => {
    addExamQuestions.mockResolvedValue({
      success: false,
      error: "Le jeu dépasse le nombre visé.",
    })
    renderComposer()
    fireEvent.click(addButton("b1"))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Le jeu dépasse le nombre visé."),
    )
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it("retirer une question de la sélection", async () => {
    removeExamQuestions.mockResolvedValue({
      success: true,
      count: 1,
      finalized: false,
    })
    renderComposer()
    fireEvent.click(
      screen.getByRole("button", { name: /^Retirer\s:\sToux chronique$/ }),
    )
    expect(removeExamQuestions).toHaveBeenCalledWith({
      examId: "e1",
      questionIds: ["s2"],
    })
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("1 question retirée"),
    )
  })

  it("examen finalisé : confirmation avant d'écrire, puis annonce du retour en préparation", async () => {
    addExamQuestions.mockResolvedValue({
      success: true,
      count: 3,
      finalized: false,
    })
    renderComposer({ exam: { ...EXAM, finalized: true, openToStudents: true } })
    fireEvent.click(addButton("b1"))
    expect(addExamQuestions).not.toHaveBeenCalled()
    expect(
      screen.getByText(/il disparaîtra de la liste des étudiants/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("btn-composer-confirm-change"))
    await waitFor(() =>
      expect(addExamQuestions).toHaveBeenCalledWith({
        examId: "e1",
        questionIds: ["b1"],
      }),
    )
    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith(
        expect.stringMatching(/^L'examen est repassé en préparation\s:/),
      ),
    )
  })

  it("examen finalisé, confirmation annulée : rien n'est écrit", () => {
    renderComposer({ exam: { ...EXAM, finalized: true } })
    fireEvent.click(addButton("b1"))
    expect(
      screen.queryByText(/il disparaîtra de la liste des étudiants/),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(addExamQuestions).not.toHaveBeenCalled()
  })
})

describe("ComposerClient : complétion automatique", () => {
  it("« Compléter » tire au serveur, l'aperçu s'ouvre, « Ajouter » écrit le tirage et ferme", async () => {
    previewExamCompletion.mockResolvedValue({
      success: true,
      questionIds: ["b1", "b2", "x3"],
      lines: [{ domain: "Cardiologie", count: 3, fallback: 0 }],
    })
    addExamQuestions.mockResolvedValue({
      success: true,
      count: 5,
      finalized: false,
    })
    renderComposer()
    fireEvent.click(screen.getByTestId("btn-composer-complete"))
    expect(previewExamCompletion).toHaveBeenCalledWith({ examId: "e1" })
    const dialog = await screen.findByTestId("composer-completion-dialog")
    expect(dialog).toHaveTextContent("Compléter les 3 restantes")

    fireEvent.click(screen.getByTestId("btn-composer-apply-completion"))
    expect(addExamQuestions).toHaveBeenCalledWith({
      examId: "e1",
      questionIds: ["b1", "b2", "x3"],
    })
    await waitFor(() =>
      expect(
        screen.queryByTestId("composer-completion-dialog"),
      ).not.toBeInTheDocument(),
    )
    expect(toastSuccess).toHaveBeenCalledWith("3 questions ajoutées")
  })

  it("ajout du tirage refusé : l'aperçu reste ouvert", async () => {
    previewExamCompletion.mockResolvedValue({
      success: true,
      questionIds: ["b1"],
      lines: [{ domain: "Cardiologie", count: 1, fallback: 0 }],
    })
    addExamQuestions.mockResolvedValue({ success: false, error: "Refusé." })
    renderComposer()
    fireEvent.click(screen.getByTestId("btn-composer-complete"))
    fireEvent.click(await screen.findByTestId("btn-composer-apply-completion"))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Refusé."))
    expect(screen.getByTestId("composer-completion-dialog")).toBeInTheDocument()
  })

  it("tirage refusé : toast d'erreur, pas d'aperçu", async () => {
    previewExamCompletion.mockResolvedValue({
      success: false,
      error: "Examen introuvable",
    })
    renderComposer()
    fireEvent.click(screen.getByTestId("btn-composer-complete"))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Examen introuvable"),
    )
    expect(
      screen.queryByTestId("composer-completion-dialog"),
    ).not.toBeInTheDocument()
  })

  it("« Relancer le tirage » remplace l'aperçu ; « Annuler » le ferme sans écrire", async () => {
    previewExamCompletion
      .mockResolvedValueOnce({
        success: true,
        questionIds: ["b1"],
        lines: [{ domain: "Cardiologie", count: 1, fallback: 0 }],
      })
      .mockResolvedValueOnce({
        success: true,
        questionIds: ["s9"],
        lines: [{ domain: "Pédiatrie", count: 1, fallback: 0 }],
      })
    renderComposer()
    fireEvent.click(screen.getByTestId("btn-composer-complete"))
    fireEvent.click(await screen.findByTestId("btn-composer-redraw"))
    await waitFor(() =>
      expect(screen.getByTestId("composer-completion-line")).toHaveTextContent(
        "Pédiatrie",
      ),
    )
    expect(previewExamCompletion).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    await waitFor(() =>
      expect(
        screen.queryByTestId("composer-completion-dialog"),
      ).not.toBeInTheDocument(),
    )
    expect(addExamQuestions).not.toHaveBeenCalled()
  })
})

describe("ComposerClient : aperçu d'une question", () => {
  it("lecture échouée : « Réessayer » relit la même question", async () => {
    loadQuestionFile.mockResolvedValue(null)
    renderComposer()
    fireEvent.click(
      within(bankRow("b1")).getByTestId("composer-question-preview"),
    )
    fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }))
    expect(loadQuestionFile.mock.calls).toEqual([["b1"], ["b1"]])
  })

  it("l'énoncé ouvre l'aperçu ; « Ajouter à l'examen » le ferme et écrit", async () => {
    loadQuestionFile.mockResolvedValue(null)
    addExamQuestions.mockResolvedValue({
      success: true,
      count: 3,
      finalized: false,
    })
    renderComposer()
    fireEvent.click(
      within(bankRow("b2")).getByTestId("composer-question-preview"),
    )
    expect(loadQuestionFile).toHaveBeenCalledWith("b2")
    fireEvent.click(await screen.findByTestId("btn-composer-preview-add"))
    expect(addExamQuestions).toHaveBeenCalledWith({
      examId: "e1",
      questionIds: ["b2"],
    })
    await waitFor(() =>
      expect(
        screen.queryByTestId("composer-preview-dialog"),
      ).not.toBeInTheDocument(),
    )
  })

  it("une question de la sélection se retire depuis l'aperçu", async () => {
    loadQuestionFile.mockResolvedValue(null)
    removeExamQuestions.mockResolvedValue({
      success: true,
      count: 1,
      finalized: false,
    })
    renderComposer()
    const selectionRow = within(screen.getByTestId("composer-selection"))
      .getAllByTestId("composer-selection-row")
      .find((r) => r.dataset.questionId === "s1")!
    fireEvent.click(
      within(selectionRow).getByTestId("composer-question-preview"),
    )
    fireEvent.click(await screen.findByTestId("btn-composer-preview-remove"))
    expect(removeExamQuestions).toHaveBeenCalledWith({
      examId: "e1",
      questionIds: ["s1"],
    })
  })
})

describe("ComposerClient : banque dans l'URL", () => {
  it("la recherche part dans l'URL une fois la frappe posée, en page 1", async () => {
    renderComposer({ state: { ...DEFAULT_COMPOSER, page: 2 } })
    fireEvent.change(
      screen.getByPlaceholderText(
        "Énoncé, choix de réponse, objectif ou identifiant",
      ),
      { target: { value: "souffle" } },
    )
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/admin/examens/e1/questions?q=souffle&retour=formulaire",
        { scroll: false },
      ),
    )
  })

  it("un domaine du plan filtre la banque ; le recliquer retire le filtre", () => {
    renderComposer({ state: { ...DEFAULT_COMPOSER, page: 3 } })
    const cardio = screen
      .getAllByTestId("composer-plan-row")
      .find((r) => r.textContent?.startsWith("Cardiologie"))!
    fireEvent.click(cardio)
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/examens/e1/questions?domaine=Cardiologie&retour=formulaire",
      { scroll: false },
    )
    fireEvent.click(cardio)
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/examens/e1/questions?retour=formulaire",
      { scroll: false },
    )
  })

  it("banque vide : « Effacer les filtres » garde le tri et le retour", () => {
    renderComposer({
      state: {
        ...DEFAULT_COMPOSER,
        q: "zzz",
        domain: "Cardiologie",
        sort: "successRate",
        back: "fiche",
      },
      bank: { items: [], total: 0 },
    })
    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }))
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/examens/e1/questions?tri=reussite&retour=fiche",
      { scroll: false },
    )
  })

  it("pagination : la page demandée part dans l'URL", () => {
    renderComposer({ bank: { items: BANK, total: 45 } })
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }))
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/examens/e1/questions?page=2&retour=formulaire",
      { scroll: false },
    )
  })

  it("« Terminé » ramène à la fiche quand on en vient", () => {
    renderComposer({ state: { ...DEFAULT_COMPOSER, back: "fiche" } })
    expect(screen.getByTestId("btn-composer-done")).toHaveAttribute(
      "href",
      "/admin/examens/e1",
    )
  })
})

describe("ComposerClient : affichage", () => {
  it("onglets en étroit : « Sélection » masque la banque", () => {
    renderComposer()
    expect(screen.getByTestId("composer-bank")).not.toHaveClass("max-lg:hidden")
    expect(screen.getByTestId("composer-selection")).toHaveClass(
      "max-lg:hidden",
    )
    fireEvent.click(screen.getByTestId("composer-tab-selection"))
    expect(screen.getByTestId("composer-bank")).toHaveClass("max-lg:hidden")
    expect(screen.getByTestId("composer-selection")).not.toHaveClass(
      "max-lg:hidden",
    )
  })

  it("choisir un domaine du plan ramène sur l'onglet Banque", () => {
    renderComposer()
    fireEvent.click(screen.getByTestId("composer-tab-selection"))
    fireEvent.click(screen.getAllByTestId("composer-plan-row")[0])
    expect(screen.getByTestId("composer-bank")).not.toHaveClass("max-lg:hidden")
  })

  it("jeu figé : lecture seule, ni banque, ni onglets, ni retrait", () => {
    renderComposer({ frozen: true, bank: null })
    expect(screen.getByTestId("composer-frozen-alert")).toHaveTextContent(
      "Lecture seule",
    )
    expect(screen.queryByTestId("composer-bank")).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("composer-tab-selection"),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("btn-composer-remove")).not.toBeInTheDocument()
    expect(screen.getByTestId("composer-selection")).not.toHaveClass(
      "max-lg:hidden",
    )
  })

  it("compteur : décompte du jeu face au visé", () => {
    renderComposer()
    expect(screen.getAllByTestId("composer-count")[0]).toHaveTextContent(
      "2 / 5",
    )
  })
})
