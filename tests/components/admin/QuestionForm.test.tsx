import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type QuestionEditContext,
  QuestionForm,
} from "@/app/(admin)/admin/questions/_components/question-form"
import {
  type QuestionFormValues,
  blankQuestionForm,
} from "@/app/(admin)/admin/questions/_components/question-form-model"
import { DEFAULT_QUESTION_LIST } from "@/app/(admin)/admin/questions/_components/question-params"

const {
  push,
  toastError,
  toastSuccess,
  updateQuestion,
  createQuestion,
  setQuestionImages,
} = vi.hoisted(() => ({
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateQuestion: vi.fn(),
  createQuestion: vi.fn(),
  setQuestionImages: vi.fn(),
}))

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))
vi.mock("@/features/questions/actions", () => ({
  updateQuestion,
  createQuestion,
  setQuestionImages,
}))
// Uploader (dnd-kit, react-dropzone) : hors sujet ici.
vi.mock("@/components/admin/question-image-uploader", () => ({
  QuestionImageUploader: () => <div data-testid="uploader-stub" />,
}))
// Radix Select et le combobox ne se montent pas fidèlement sous happy-dom :
// composants contrôlés qui exposent la valeur reçue.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react")
  const h = React.createElement
  type P = { value?: string; children?: unknown; placeholder?: string }
  return {
    Select: ({ value, children }: P) =>
      h(
        "div",
        { "data-testid": "domain-select", "data-value": value ?? "" },
        children as never,
      ),
    SelectTrigger: ({ children }: P) => h("div", null, children as never),
    SelectValue: ({ placeholder }: P) => h("span", null, placeholder),
    SelectContent: ({ children }: P) => h("div", null, children as never),
    SelectItem: ({ children }: P) => h("div", null, children as never),
  }
})
vi.mock("@/components/shared/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (v: string) => void
  }) => (
    <input
      aria-label="Objectif du CMC"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

const filled = (
  over: Partial<QuestionFormValues> = {},
): QuestionFormValues => ({
  domain: "Cardiologie",
  objective: "Douleur thoracique",
  question: "Quelle est la prochaine étape ?",
  options: ["A", "B", "C", "D"],
  sources: [0, 1, 2, 3],
  keyIndex: 0,
  explanation: "Parce que.",
  references: ["Réf 1"],
  statementImages: [],
  explanationImages: [],
  ...over,
})

const editContext = (
  over: Partial<QuestionEditContext> = {},
): QuestionEditContext => ({
  title: "Question du 1 janv. 2026",
  pastCounts: [0, 0, 0, 0],
  originalOptions: ["A", "B", "C", "D"],
  originalKeyIndex: 0,
  confirmation: null,
  lockingExam: null,
  ...over,
})

const openEdit = (
  values: QuestionFormValues = filled(),
  edit: QuestionEditContext = editContext(),
) => {
  updateQuestion.mockResolvedValue({ success: true })
  setQuestionImages.mockResolvedValue({ success: true })
  render(
    <QuestionForm
      mode="edit"
      initialQuestionId="q1"
      initial={values}
      objectivesByDomain={{}}
      list={DEFAULT_QUESTION_LIST}
      edit={edit}
    />,
  )
}

const saveEdit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByTestId("btn-save-question"))

afterEach(() => {
  vi.clearAllMocks()
})

describe("QuestionForm — édition", () => {
  it("enregistre, réécrit les deux jeux d'images et ouvre le détail", async () => {
    const user = userEvent.setup()
    openEdit()
    await saveEdit(user)

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/questions/q1"),
    )
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "q1",
        domain: "Cardiologie",
        correctAnswer: "A",
        references: ["Réf 1"],
      }),
    )
    expect(setQuestionImages).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "q1",
        kind: "statement",
        images: [],
      }),
    )
    expect(setQuestionImages).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "q1",
        kind: "explanation",
        images: [],
      }),
    )
    expect(toastSuccess).toHaveBeenCalledWith("Question mise à jour")
  })

  it("la clé suit le renommage de l'option-clé", async () => {
    const user = userEvent.setup()
    openEdit()
    await user.type(screen.getByTestId("option-input-0"), " bis")
    await saveEdit(user)

    await waitFor(() => expect(updateQuestion).toHaveBeenCalledTimes(1))
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ correctAnswer: "A bis" }),
    )
  })

  it("une erreur serveur s'affiche et ne quitte pas la page", async () => {
    const user = userEvent.setup()
    openEdit()
    updateQuestion.mockResolvedValue({
      success: false,
      error:
        "Cette question est dans l'examen ouvert « EB » : ses choix et sa clé sont verrouillés jusqu'à la fermeture.",
    })
    await saveEdit(user)

    expect(await screen.findByTestId("save-error")).toHaveTextContent(
      "examen ouvert « EB »",
    )
    expect(push).not.toHaveBeenCalled()
  })
})

describe("QuestionForm — formulaire incomplet", () => {
  it("n'envoie rien et passe les vérifications en échec en erreur", async () => {
    const user = userEvent.setup()
    render(
      <QuestionForm
        mode="create"
        initialQuestionId="reserved-1"
        initial={blankQuestionForm()}
        objectivesByDomain={{}}
        list={DEFAULT_QUESTION_LIST}
        edit={null}
      />,
    )
    await user.click(screen.getByTestId("btn-save-question"))

    expect(createQuestion).not.toHaveBeenCalled()
    const checks = screen.getByTestId("form-checks")
    expect(
      checks.querySelectorAll('[data-state="error"]').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText("Rédigez l'énoncé.")).toBeInTheDocument()
    expect(
      screen.getByText("Désignez la clé de réponse : cliquez sur une lettre."),
    ).toBeInTheDocument()
  })
})

describe("QuestionForm — création", () => {
  const openCreate = () => {
    createQuestion.mockResolvedValue({ success: true, id: "reserved-1" })
    setQuestionImages.mockResolvedValue({ success: true })
    render(
      <QuestionForm
        mode="create"
        initialQuestionId="reserved-1"
        initial={filled({ sources: [null, null, null, null] })}
        objectivesByDomain={{}}
        list={DEFAULT_QUESTION_LIST}
        edit={null}
      />,
    )
  }

  it("crée sous l'identifiant réservé, sans réécrire d'images absentes, puis ouvre le détail", async () => {
    const user = userEvent.setup()
    openCreate()
    await user.click(screen.getByTestId("btn-save-question"))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/questions/reserved-1"),
    )
    expect(createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "reserved-1",
        question: "Quelle est la prochaine étape ?",
      }),
    )
    expect(setQuestionImages).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith("Question enregistrée")
  })

  it("une création déjà aboutie (réponse perdue) reprend en mise à jour", async () => {
    const user = userEvent.setup()
    openCreate()
    createQuestion.mockResolvedValue({
      success: false,
      error: "Cette question est déjà enregistrée.",
      alreadyExists: true,
    })
    updateQuestion.mockResolvedValue({ success: true })
    await user.click(screen.getByTestId("btn-save-question"))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/questions/reserved-1"),
    )
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: "reserved-1" }),
    )
  })

  it("« Enregistrer et en créer une autre » garde le domaine et l'objectif", async () => {
    const user = userEvent.setup()
    openCreate()
    await user.click(screen.getByTestId("btn-save-and-new"))

    await waitFor(() => expect(createQuestion).toHaveBeenCalledTimes(1))
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByTestId("question-input")).toHaveValue("")
    expect(screen.getByTestId("domain-select")).toHaveAttribute(
      "data-value",
      "Cardiologie",
    )
    expect(screen.getByLabelText("Objectif du CMC")).toHaveValue(
      "Douleur thoracique",
    )
  })
})

describe("QuestionForm — choix de réponse", () => {
  it("deux choix identiques : messages en direct, rien n'est envoyé", async () => {
    const user = userEvent.setup()
    openEdit(filled({ options: ["A", "a", "C", "D"] }))

    expect(
      screen.getByText(
        "Le choix B est identique au choix A (casse et espaces ignorés).",
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId("option-input-1")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(screen.getByTestId("option-input-2")).not.toHaveAttribute(
      "aria-invalid",
    )
    await saveEdit(user)
    expect(updateQuestion).not.toHaveBeenCalled()

    await user.type(screen.getByTestId("option-input-1"), "2")
    expect(
      screen.queryByText(/Le choix B est identique/),
    ).not.toBeInTheDocument()
  })

  it("désigner une autre lettre d'une question répondue annonce la clé corrigée", async () => {
    const user = userEvent.setup()
    openEdit(filled(), editContext({ pastCounts: [5, 7, 1, 0] }))

    expect(screen.queryByTestId("key-corrected")).not.toBeInTheDocument()
    await user.click(screen.getByTestId("btn-key-1"))
    expect(screen.getByTestId("key-corrected")).toHaveTextContent(
      "Clé corrigée : A → B",
    )
  })

  it("reformuler un choix répondu annonce la formulation antérieure", async () => {
    const user = userEvent.setup()
    openEdit(filled(), editContext({ pastCounts: [5, 7, 1, 0] }))

    await user.type(screen.getByTestId("option-input-1"), " seulement")
    expect(
      screen.getByText(
        "Ses 7 réponses passées deviendront « formulation antérieure ».",
      ),
    ).toBeInTheDocument()
  })

  it("choix figés : choix et lettres verrouillés, le reste reste modifiable", async () => {
    openEdit(
      filled(),
      editContext({
        lockingExam: {
          title: "Examen blanc 26",
          endDate: Date.UTC(2026, 9, 3),
        },
      }),
    )
    expect(screen.getByTestId("frozen-choices")).toHaveTextContent(
      "Examen blanc 26",
    )
    expect(screen.getByTestId("option-input-0")).toBeDisabled()
    expect(screen.getByTestId("btn-key-1")).toBeDisabled()
    expect(screen.getByTestId("question-input")).toBeEnabled()
    expect(
      screen.getByText("Choix et clé verrouillés (examen ouvert)"),
    ).toBeInTheDocument()
  })
})

describe("QuestionForm — correction collée", () => {
  const BLOCK =
    "1.\nSource A.\nLancet. 2020.\n\n2.\nSource B.\nBMJ. 2021.\n\n3.\nSource C.\nJAMA. 2022."

  const referenceValues = () =>
    screen
      .getAllByLabelText(/^Référence \d+$/)
      .map((el) => (el as HTMLTextAreaElement).value)

  it("un bloc collé produit un champ par source, et « Annuler » rétablit le brut", async () => {
    const user = userEvent.setup()
    openEdit(filled({ references: ["Réf A", "", "Réf C"] }))

    await user.click(screen.getByTestId("reference-input-1"))
    await user.paste(BLOCK)
    expect(referenceValues()).toEqual([
      "Réf A",
      "Source A. Lancet. 2020.",
      "Source B. BMJ. 2021.",
      "Source C. JAMA. 2022.",
      "Réf C",
    ])

    await user.click(screen.getByTestId("btn-format-undo"))
    expect(referenceValues()).toEqual(["Réf A", BLOCK, "Réf C"])
  })

  it("« Découper » sépare un bloc sans numéro selon les lignes vides", async () => {
    const user = userEvent.setup()
    openEdit(
      filled({
        references: ["Source A. Lancet. 2020.\n\nSource B. BMJ. 2021."],
      }),
    )
    await user.click(screen.getByTestId("btn-split-reference-0"))
    expect(referenceValues()).toEqual([
      "Source A. Lancet. 2020.",
      "Source B. BMJ. 2021.",
    ])
  })

  it("avertit sans empêcher l'enregistrement", async () => {
    const user = userEvent.setup()
    openEdit(filled({ explanation: "Voir [1] et [3].", references: [BLOCK] }))

    expect(screen.getByTestId("explanation-format-warnings")).toHaveTextContent(
      "au-delà de la liste",
    )
    await saveEdit(user)
    await waitFor(() => expect(updateQuestion).toHaveBeenCalledTimes(1))
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ references: [BLOCK] }),
    )
  })

  it("une explication collée est remise en forme sur place", async () => {
    const user = userEvent.setup()
    openEdit(filled({ explanation: "" }))

    await user.click(screen.getByTestId("explanation-input"))
    await user.paste("Premier point.\n[1]\n\n\n\nSecond   point.")
    expect(screen.getByTestId("explanation-input")).toHaveValue(
      "Premier point. [1]\n\nSecond point.",
    )
  })
})
