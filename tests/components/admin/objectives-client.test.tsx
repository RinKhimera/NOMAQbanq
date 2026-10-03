import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ObjectivesClient } from "@/app/(admin)/admin/questions/objectifs/_components/objectives-client"
import {
  type ObjectivesState,
  parseObjectivesState,
  serializeObjectivesState,
} from "@/app/(admin)/admin/questions/objectifs/_components/objectives-model"
import type { ObjectiveEntryView } from "@/features/objectives/groups"

const {
  mergeObjectives,
  keepObjective,
  correctQuestionObjective,
  loadObjectiveQuestions,
  refresh,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  mergeObjectives: vi.fn(),
  keepObjective: vi.fn(),
  correctQuestionObjective: vi.fn(),
  loadObjectiveQuestions: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh, push: vi.fn() }),
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}))
vi.mock("@/features/objectives/actions", () => ({
  mergeObjectives,
  keepObjective,
  createObjective: vi.fn(),
  renameObjective: vi.fn(),
  deleteObjective: vi.fn(),
  correctQuestionObjective,
  loadObjectiveQuestions,
}))

const entry = (
  id: string,
  label: string,
  over: Partial<ObjectiveEntryView> = {},
): ObjectiveEntryView => ({
  id,
  label,
  needsFix: false,
  reviewedAt: null,
  questionCount: 1,
  domains: ["Gastro-entérologie"],
  ...over,
})

const ENTRIES = [
  entry("aigue", "Douleur abdominale aigue", { questionCount: 61 }),
  entry("aiguee", "Douleur abdominale aiguë", {
    questionCount: 13,
    domains: ["Chirurgie"],
  }),
  entry("toux", "Toux", { domains: ["Pneumologie"] }),
  entry("dyspnee", "Dyspnée", { reviewedAt: 1, questionCount: 91 }),
  entry("dash", "-", { needsFix: true, questionCount: 21 }),
]

const renderScreen = (state: ObjectivesState = { tab: "todo", domain: "" }) =>
  render(<ObjectivesClient entries={ENTRIES} initialState={state} />)

describe("état de l'écran dans l'URL", () => {
  it("lit et réécrit l'onglet et le domaine", () => {
    const state = parseObjectivesState(
      new URLSearchParams("onglet=traites&domaine=Chirurgie"),
    )
    expect(state).toEqual({ tab: "done", domain: "Chirurgie" })
    expect(serializeObjectivesState(state).toString()).toBe(
      "onglet=traites&domaine=Chirurgie",
    )
    expect(
      serializeObjectivesState({ tab: "todo", domain: "" }).toString(),
    ).toBe("")
  })
})

describe("ObjectivesClient", () => {
  it("montre la progression par groupes et les valeurs invalides à part", () => {
    renderScreen()
    expect(screen.getByTestId("objectives-progress")).toHaveTextContent("1 / 3")
    expect(
      screen.getByText("2 variantes ·", { exact: false }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("invalid-objectives")).getByText(
        "Moins de 3 caractères · Aucune lettre",
      ),
    ).toBeInTheDocument()
  })

  it("fusionne le groupe sous le libellé choisi, puis recharge", async () => {
    const user = userEvent.setup()
    mergeObjectives.mockResolvedValue({ success: true, moved: 13 })
    renderScreen()
    const card = screen.getByTestId("objective-group-douleurabdominaleaigue")
    await user.click(within(card).getByLabelText("Douleur abdominale aiguë"))
    await user.click(within(card).getByTestId("btn-merge-objectives"))

    expect(mergeObjectives).toHaveBeenCalledWith({
      keepId: "aiguee",
      mergeIds: ["aigue"],
      label: "Douleur abdominale aiguë",
    })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(toastSuccess).toHaveBeenCalledWith(
      "74 questions regroupées sous « Douleur abdominale aiguë »",
    )
  })

  it("détacher une variante laisse une valeur seule, qui se garde telle quelle", async () => {
    const user = userEvent.setup()
    keepObjective.mockResolvedValue({ success: true })
    renderScreen()
    const card = screen.getByTestId("objective-group-douleurabdominaleaigue")
    await user.click(
      within(card).getByRole("button", {
        name: "Détacher « Douleur abdominale aiguë »",
      }),
    )
    await user.click(within(card).getByTestId("btn-keep-objective"))
    expect(keepObjective).toHaveBeenCalledWith({ id: "aigue" })
  })

  it("un refus du serveur s'affiche sans recharger", async () => {
    const user = userEvent.setup()
    mergeObjectives.mockResolvedValue({
      success: false,
      error: "L'objectif « X » existe déjà : choisissez-le plutôt.",
    })
    renderScreen()
    const card = screen.getByTestId("objective-group-douleurabdominaleaigue")
    await user.click(within(card).getByTestId("btn-merge-objectives"))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "L'objectif « X » existe déjà : choisissez-le plutôt.",
      ),
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it("le domaine filtre les groupes", () => {
    renderScreen({ tab: "todo", domain: "Pneumologie" })
    expect(screen.getByTestId("objective-group-toux")).toBeInTheDocument()
    expect(
      screen.queryByTestId("objective-group-douleurabdominaleaigue"),
    ).not.toBeInTheDocument()
  })

  it("« Traités » liste les objectifs revus", () => {
    renderScreen({ tab: "done", domain: "" })
    expect(screen.getByText("Dyspnée")).toBeInTheDocument()
    expect(screen.queryByText("Toux")).not.toBeInTheDocument()
  })
})

describe("correction d'une valeur invalide", () => {
  it("chaque objectif choisi s'enregistre aussitôt et fait avancer le compteur", async () => {
    const user = userEvent.setup()
    loadObjectiveQuestions.mockResolvedValue([
      {
        id: "q1",
        question: "Un homme de 54 ans…",
        domain: "Gastro-entérologie",
      },
    ])
    correctQuestionObjective.mockResolvedValue({ success: true, remaining: 0 })
    renderScreen()
    await user.click(screen.getByTestId("btn-fix-dash"))

    expect(await screen.findByText("0 / 1 corrigée")).toBeInTheDocument()
    expect(loadObjectiveQuestions).toHaveBeenCalledWith("dash")
    await user.click(
      screen.getByRole("combobox", { name: "Objectif de la question" }),
    )
    await user.click(await screen.findByRole("option", { name: /Dyspnée/ }))

    expect(correctQuestionObjective).toHaveBeenCalledWith({
      questionId: "q1",
      objectiveId: "dyspnee",
    })
    expect(await screen.findByText("1 / 1 corrigée")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Terminé" }))
    expect(refresh).toHaveBeenCalled()
  })
})
