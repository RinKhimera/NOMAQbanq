import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
    answerCount: i === 0 ? 10 : 4,
    successRate: i === 0 ? 70 : null,
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

describe("QuestionBrowser — filtres exposés à l'export", () => {
  beforeEach(() => {
    loadQuestionsPage.mockReset()
    loadQuestionsPage.mockResolvedValue(makePage())
  })

  // Faux timers : même contrainte que le test de recherche ci-dessus.
  it("expose la recherche appliquée à la liste, pas la saisie en cours", async () => {
    vi.useFakeTimers()
    const settle = async (ms = 0) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }
    const onFiltersChange = vi.fn()
    try {
      render(
        <QuestionBrowser mode="browse" onFiltersChange={onFiltersChange} />,
      )
      await settle()

      fireEvent.change(
        screen.getByPlaceholderText(/rechercher dans les questions/i),
        { target: { value: "infarctus" } },
      )
      await settle()
      expect(onFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchQuery: "" }),
      )

      await settle(SEARCH_DEBOUNCE_MS)
      expect(onFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchQuery: "infarctus" }),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("QuestionBrowser — taux de réussite", () => {
  beforeEach(() => {
    loadQuestionsPage.mockReset()
    loadQuestionsPage.mockResolvedValue(makePage())
  })

  it("affiche le taux et le nombre de réponses, ou « données insuffisantes » sous le seuil", async () => {
    render(<QuestionBrowser mode="browse" />)
    const cells = await screen.findAllByTestId("success-rate")
    expect(cells[0]).toHaveTextContent("70 %")
    expect(cells[0]).toHaveTextContent("10 rép.")
    expect(cells[1]).toHaveTextContent("Données insuffisantes")
    expect(cells[1]).not.toHaveTextContent("%")
  })

  it("trie par taux de réussite depuis l'en-tête de colonne", async () => {
    render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    fireEvent.click(screen.getByRole("button", { name: /Réussite/ }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "successRate", page: 1 }),
      ),
    )
  })

  it("filtre les questions « À vérifier »", async () => {
    render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    fireEvent.click(screen.getByRole("button", { name: /À vérifier/ }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ toVerify: true, page: 1 }),
      ),
    )
  })
})

describe("QuestionBrowser — tri sous « À vérifier »", () => {
  beforeEach(() => {
    loadQuestionsPage.mockReset()
    loadQuestionsPage.mockResolvedValue(makePage())
  })

  it("n'annonce plus un tri par date que la liste ne suit pas", async () => {
    render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    const byDate = screen.getByRole("button", { name: /Créée/ })
    expect(byDate).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: /À vérifier/ }))
    await waitFor(() => expect(byDate).toBeDisabled())
    expect(byDate).toHaveAttribute(
      "title",
      "Sous « À vérifier », triées par nombre de réponses",
    )
  })
})

describe("QuestionBrowser — mode sélection", () => {
  beforeEach(() => {
    loadQuestionsPage.mockReset()
    loadQuestionsPage.mockResolvedValue(makePage())
  })

  // Le formulaire de création d'examen englobe le navigateur : aucun clic
  // dans le tableau ne doit le soumettre.
  const renderInForm = () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <QuestionBrowser mode="select" maxSelection={2} />
      </form>,
    )
    return { onSubmit }
  }

  const counter = () => screen.getByText(/\d+ \/ 2 questions/)
  const checkboxes = () =>
    screen.getAllByRole("checkbox", { name: "Sélectionner la question" })

  it("la case et la ligne sélectionnent chacune une question, une seule fois", async () => {
    renderInForm()
    await screen.findByText("Question 0")

    fireEvent.click(checkboxes()[0])
    expect(counter()).toHaveTextContent("1 / 2 questions")
    expect(checkboxes()[0]).toBeChecked()

    fireEvent.click(screen.getByText("Question 1"))
    expect(counter()).toHaveTextContent("2 / 2 questions")
    expect(checkboxes()[1]).toBeChecked()
  })

  it("au quota, une autre question ne peut plus être sélectionnée", async () => {
    renderInForm()
    await screen.findByText("Question 0")
    fireEvent.click(checkboxes()[0])
    fireEvent.click(checkboxes()[1])

    expect(checkboxes()[2]).toBeDisabled()
    fireEvent.click(screen.getByText("Question 2"))
    expect(counter()).toHaveTextContent("2 / 2 questions")
    expect(checkboxes()[2]).not.toBeChecked()
  })

  it("prévisualiser ou changer de page ne sélectionne rien et ne soumet pas le formulaire", async () => {
    const { onSubmit } = renderInForm()
    await screen.findByText("Question 0")

    fireEvent.click(
      screen.getAllByRole("button", { name: "Prévisualiser la question" })[0],
    )
    expect(counter()).toHaveTextContent("0 / 2 questions")

    fireEvent.click(screen.getByRole("button", { name: "2" }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("QuestionBrowser — colonnes", () => {
  beforeEach(() => {
    loadQuestionsPage.mockReset()
    loadQuestionsPage.mockResolvedValue(makePage())
  })
  afterEach(() => localStorage.clear())

  const hideColumn = async (name: string) => {
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Colonnes/ }))
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitemcheckbox", {
        name,
      }),
    )
    await user.keyboard("{Escape}")
  }
  const hasHeader = (name: string) =>
    screen
      .queryAllByRole("columnheader")
      .some((header) => header.textContent === name)

  it("le choix fait en navigation ne touche pas la constitution d'examen", async () => {
    const { unmount } = render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    await hideColumn("Réussite")
    expect(hasHeader("Réussite")).toBe(false)
    unmount()

    render(<QuestionBrowser mode="select" />)
    await screen.findByText("Question 0")
    expect(hasHeader("Réussite")).toBe(true)
  })

  it("masquer la colonne qui sert au tri ne change pas le tri", async () => {
    render(<QuestionBrowser mode="browse" />)
    await screen.findByText("Question 0")
    fireEvent.click(screen.getByRole("button", { name: /Réussite/ }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "successRate" }),
      ),
    )

    await hideColumn("Réussite")
    fireEvent.click(await screen.findByRole("button", { name: "2" }))
    await waitFor(() =>
      expect(loadQuestionsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, sortBy: "successRate" }),
      ),
    )
  })
})
