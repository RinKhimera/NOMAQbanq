import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_QUESTION_LIST } from "@/app/(admin)/admin/questions/_components/question-params"
import { QuestionsClient } from "@/app/(admin)/admin/questions/_components/questions-client"
import type { QuestionListPage } from "@/features/questions/dal"

const { replace, push } = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
  usePathname: () => "/admin/questions",
}))
vi.mock("@/features/questions/actions", () => ({
  loadQuestionsForExport: vi.fn(),
}))

const NOW = Date.UTC(2026, 8, 30)

const list = (over: Partial<QuestionListPage> = {}): QuestionListPage => ({
  items: [
    {
      id: "q1",
      question: "Une femme de 42 ans consulte pour une fatigue.",
      domain: "Hémato-oncologie",
      objectifCMC: "Anémie",
      options: ["A", "B", "C", "D"],
      createdAt: NOW - 86_400_000,
      updatedAt: NOW - 86_400_000,
      imageCount: 1,
      usageCount: 3,
      answerCount: 28,
      successRate: 32,
      keyToVerify: true,
    },
    {
      id: "q2",
      question: "Un homme de 58 ans s'effondre.",
      domain: "Anesthésie-Réanimation",
      objectifCMC: "Arrêt cardiorespiratoire",
      options: ["A", "B", "C", "D"],
      createdAt: NOW - 2 * 86_400_000,
      updatedAt: NOW - 86_400_000,
      imageCount: 0,
      usageCount: 1,
      answerCount: 6,
      successRate: null,
      keyToVerify: false,
    },
  ],
  total: 2,
  counts: { all: 2880, toVerify: 271, noReferences: 39 },
  ...over,
})

const renderList = (
  state = DEFAULT_QUESTION_LIST,
  page: QuestionListPage = list(),
) =>
  render(
    <QuestionsClient
      state={state}
      list={page}
      objectives={{
        objectives: [{ id: "obj-dt", label: "Douleur thoracique" }],
        byDomain: { Cardiologie: ["obj-dt"] },
      }}
      exams={[
        {
          id: "e1",
          title: "Examen blanc 26",
          startDate: NOW - 86_400_000,
          endDate: NOW + 3 * 86_400_000,
          finalizedAt: NOW - 3 * 86_400_000,
          isActive: true,
        },
      ]}
      initialNow={NOW}
    />,
  )

afterEach(() => vi.clearAllMocks())

describe("QuestionsClient", () => {
  it("onglets à compteur ; changer d'onglet écrit l'URL et revient en page 1", () => {
    renderList({ ...DEFAULT_QUESTION_LIST, page: 3 })
    expect(screen.getByTestId("tab-toVerify")).toHaveTextContent("271")
    fireEvent.click(screen.getByTestId("tab-toVerify"))
    expect(replace).toHaveBeenCalledWith(
      "/admin/questions?onglet=cle-a-verifier",
      { scroll: false },
    )
  })

  it("lignes : drapeaux, réussite ou « non significatif », lien de détail avec la liste", () => {
    renderList({ ...DEFAULT_QUESTION_LIST, q: "fatigue" })
    expect(screen.getAllByLabelText("Clé à vérifier").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Image d'énoncé").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Non significatif").length).toBeGreaterThan(0)
    expect(screen.getAllByTestId("question-row-link")[0]).toHaveAttribute(
      "href",
      "/admin/questions/q1?q=fatigue",
    )
  })

  it("tri : le premier clic sur Réussite trie les moins réussies d'abord", () => {
    renderList()
    fireEvent.click(screen.getByTestId("sort-successRate"))
    expect(replace).toHaveBeenCalledWith(
      "/admin/questions?tri=reussite&ordre=asc",
      { scroll: false },
    )
  })

  it("pastilles des filtres actifs ; « Tout effacer » garde l'onglet", () => {
    renderList({
      ...DEFAULT_QUESTION_LIST,
      tab: "noReferences",
      domain: "Cardiologie",
      notUsedSince: 3,
      exam: "e1",
    })
    expect(
      screen.getByText("Pas utilisée depuis 3 examens"),
    ).toBeInTheDocument()
    expect(screen.getByText("Examen blanc 26")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }))
    expect(replace).toHaveBeenCalledWith(
      "/admin/questions?onglet=sans-references",
      { scroll: false },
    )
  })

  it("« Nouvelle question » emporte la liste d'où l'on vient", () => {
    renderList({ ...DEFAULT_QUESTION_LIST, domain: "Cardiologie" })
    expect(
      screen.getByRole("link", { name: "Nouvelle question" }),
    ).toHaveAttribute("href", "/admin/questions/nouvelle?domaine=Cardiologie")
  })

  it("page hors borne : recours vers la première page", () => {
    renderList(
      { ...DEFAULT_QUESTION_LIST, page: 9 },
      list({ items: [], total: 2 }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Revenir à la première page" }),
    )
    expect(replace).toHaveBeenCalledWith("/admin/questions", { scroll: false })
  })

  it("un q d'URL venu d'ailleurs (retour arrière) réaligne le champ de recherche", () => {
    const { rerender } = renderList({ ...DEFAULT_QUESTION_LIST, q: "toux" })
    const field = screen.getByPlaceholderText(
      "Énoncé, choix de réponse, objectif ou identifiant",
    )
    expect(field).toHaveValue("toux")
    rerender(
      <QuestionsClient
        state={DEFAULT_QUESTION_LIST}
        list={list()}
        objectives={{ objectives: [], byDomain: {} }}
        exams={[]}
        initialNow={NOW}
      />,
    )
    expect(field).toHaveValue("")
  })

  it("aucun résultat : message et recours", () => {
    renderList(
      { ...DEFAULT_QUESTION_LIST, q: "brucellose" },
      list({ items: [], total: 0 }),
    )
    expect(
      screen.getByText("Aucune question ne correspond."),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }))
    expect(replace).toHaveBeenCalledWith("/admin/questions", { scroll: false })
  })
})
