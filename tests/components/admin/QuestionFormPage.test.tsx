import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QuestionFormPage } from "@/app/(admin)/admin/questions/_components/question-form-page"
import type { QuestionDetail } from "@/features/questions/dal"

// --- Mocks ----------------------------------------------------------------
// `vi.mock` est hoisté en haut du fichier → les fns référencées dans les
// factories doivent être créées via `vi.hoisted` (sinon TDZ « before init »).

const {
  push,
  toastError,
  toastSuccess,
  loadQuestionById,
  updateQuestion,
  createQuestion,
  setQuestionImages,
  loadUniqueObjectifsCMC,
} = vi.hoisted(() => ({
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  loadQuestionById: vi.fn(),
  updateQuestion: vi.fn(),
  createQuestion: vi.fn(),
  setQuestionImages: vi.fn(),
  loadUniqueObjectifsCMC: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))

// Server Actions : neutralisées (le module réel charge la DB / server-only).
vi.mock("@/features/questions/actions", () => ({
  loadQuestionById,
  updateQuestion,
  createQuestion,
  setQuestionImages,
  loadUniqueObjectifsCMC,
}))

// Uploader CDN-heavy (dnd-kit / react-dropzone) : hors sujet de ce test.
vi.mock("@/components/admin/question-image-uploader", () => ({
  QuestionImageUploader: () => <div data-testid="uploader-stub" />,
}))

// Le Radix Select ne se monte pas fidèlement sous happy-dom (le trigger n'est pas
// rendu et la valeur contrôlée est écrasée par un onValueChange parasite) — un
// artefact d'environnement, pas un comportement navigateur. On le remplace par un
// composant contrôlé fidèle : il EXPOSE la valeur reçue (`data-value`) sans la
// réécrire, exactement comme un vrai Select.
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

const makeQuestion = (over: Partial<QuestionDetail> = {}): QuestionDetail => ({
  id: "q1",
  question: "Quelle est la capitale du foie ?",
  options: ["A", "B", "C", "D"],
  correctAnswer: "A",
  objectifCMC: "Obj 1",
  domain: "Cardiologie",
  createdAt: 0,
  explanation: "Parce que.",
  references: ["Réf 1"],
  images: [],
  explanationImages: [],
  ...over,
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("QuestionFormPage — édition", () => {
  it("pré-remplit le domaine et autorise le submit (Bug 1 : plus d'échec silencieux)", async () => {
    const user = userEvent.setup()
    loadQuestionById.mockResolvedValue(makeQuestion({ domain: "Cardiologie" }))
    loadUniqueObjectifsCMC.mockResolvedValue([])
    updateQuestion.mockResolvedValue({ success: true })
    setQuestionImages.mockResolvedValue({ success: true })

    render(<QuestionFormPage mode="edit" questionId="q1" />)

    // Attendre que RHF ait synchronisé la prop `values` : un champ pré-rempli
    // visible garantit que TOUS les champs (dont le domaine) sont peuplés.
    await screen.findByDisplayValue("Quelle est la capitale du foie ?")

    // Le composant contrôlé du domaine reçoit la valeur dès le 1er rendu (le
    // formulaire est monté avec des `defaultValues` synchrones dérivés de la
    // question chargée — c'est ce qui débloque l'affichage du Radix Select).
    expect(screen.getByTestId("domain-select").getAttribute("data-value")).toBe(
      "Cardiologie",
    )

    await user.click(
      await screen.findByRole("button", {
        name: /Enregistrer les modifications/i,
      }),
    )

    // Le submit n'est plus bloqué par un domaine vide : updateQuestion part avec
    // la valeur pré-remplie, puis setQuestionImages persiste les images.
    await waitFor(() => {
      expect(updateQuestion).toHaveBeenCalledTimes(1)
    })
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1", domain: "Cardiologie" }),
    )
    expect(setQuestionImages).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: "q1" }),
    )
    expect(toastError).not.toHaveBeenCalled()
  })
})

describe("QuestionFormPage — formulaire invalide", () => {
  it("affiche un toast au lieu d'échouer en silence (onError)", async () => {
    const user = userEvent.setup()
    loadUniqueObjectifsCMC.mockResolvedValue([])

    // Mode création : champs requis vides → la validation zod échoue au submit.
    render(<QuestionFormPage mode="create" />)

    const submit = await screen.findByRole("button", {
      name: /Créer la question/i,
    })
    await user.click(submit)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Veuillez corriger les champs en rouge.",
      )
    })
    expect(createQuestion).not.toHaveBeenCalled()
  })
})

describe("QuestionFormPage — options", () => {
  const openEdit = async (question: QuestionDetail) => {
    loadQuestionById.mockResolvedValue(question)
    loadUniqueObjectifsCMC.mockResolvedValue([])
    updateQuestion.mockResolvedValue({ success: true })
    setQuestionImages.mockResolvedValue({ success: true })
    render(<QuestionFormPage mode="edit" questionId="q1" />)
    await screen.findByDisplayValue(question.question)
  }

  const submit = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(
      screen.getByRole("button", { name: /Enregistrer les modifications/i }),
    )

  it("renommer l'option-clé déplace la clé avec elle", async () => {
    const user = userEvent.setup()
    await openEdit(makeQuestion())
    await user.type(screen.getByPlaceholderText("Option A"), " bis")
    await submit(user)

    await waitFor(() => expect(updateQuestion).toHaveBeenCalledTimes(1))
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ correctAnswer: "A bis" }),
    )
  })

  it("jumeau : renommer un doublon de la clé ne déplace pas la clé", async () => {
    const user = userEvent.setup()
    await openEdit(makeQuestion({ options: ["A", "A", "C", "D"] }))
    await user.type(screen.getByPlaceholderText("Option B"), "2")
    await submit(user)

    await waitFor(() => expect(updateQuestion).toHaveBeenCalledTimes(1))
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ["A", "A2", "C", "D"],
        correctAnswer: "A",
      }),
    )
  })

  it("deux options identiques : pas d'envoi, les deux options en rouge et désignées dans le message", async () => {
    const user = userEvent.setup()
    await openEdit(makeQuestion({ options: ["A", "a", "C", "D"] }))
    await submit(user)

    expect(
      await screen.findByText(
        "L'option B est identique à l'option A (casse et espaces ignorés)",
      ),
    ).toBeInTheDocument()
    expect(updateQuestion).not.toHaveBeenCalled()
    for (const [placeholder, invalid] of [
      ["Option A", "true"],
      ["Option B", "true"],
      ["Option C", "false"],
    ])
      expect(screen.getByPlaceholderText(placeholder)).toHaveAttribute(
        "aria-invalid",
        invalid,
      )
  })

  it("amène les options à l'écran", async () => {
    const scrolled: Element[] = []
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(function (this: Element) {
        scrolled.push(this)
      })
    try {
      const user = userEvent.setup()
      await openEdit(makeQuestion({ options: ["A", "a", "C", "D"] }))
      await submit(user)

      await waitFor(() =>
        expect(scrolled).toContain(
          document.querySelector("[data-field=options]"),
        ),
      )
    } finally {
      scrollIntoView.mockRestore()
    }
  })

  it("le message disparaît dès que le doublon est corrigé", async () => {
    const user = userEvent.setup()
    await openEdit(makeQuestion({ options: ["A", "a", "C", "D"] }))
    await submit(user)
    await screen.findByText(
      "L'option B est identique à l'option A (casse et espaces ignorés)",
    )

    await user.type(screen.getByPlaceholderText("Option B"), "2")

    await waitFor(() =>
      expect(
        screen.queryByText(
          "L'option B est identique à l'option A (casse et espaces ignorés)",
        ),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByPlaceholderText("Option B")).toHaveAttribute(
      "aria-invalid",
      "false",
    )
  })
})

describe("QuestionFormPage — correction collée", () => {
  const BLOCK =
    "1.\nSource A.\nLancet. 2020.\n\n2.\nSource B.\nBMJ. 2021.\n\n3.\nSource C.\nJAMA. 2022."

  const openEdit = async (over: Partial<QuestionDetail>) => {
    const question = makeQuestion(over)
    loadQuestionById.mockResolvedValue(question)
    loadUniqueObjectifsCMC.mockResolvedValue([])
    updateQuestion.mockResolvedValue({ success: true })
    setQuestionImages.mockResolvedValue({ success: true })
    render(<QuestionFormPage mode="edit" questionId="q1" />)
    await screen.findByDisplayValue(question.question)
  }

  const referenceValues = () =>
    screen
      .getAllByPlaceholderText("Référence bibliographique complète...")
      .map((el) => (el as HTMLTextAreaElement).value)

  it("un bloc collé produit un champ par source, à la position du champ collé", async () => {
    const user = userEvent.setup()
    await openEdit({ references: ["Réf A", "", "Réf C"] })

    await user.click(screen.getByTestId("reference-input-1"))
    await user.paste(BLOCK)

    expect(referenceValues()).toEqual([
      "Réf A",
      "Source A. Lancet. 2020.",
      "Source B. BMJ. 2021.",
      "Source C. JAMA. 2022.",
      "Réf C",
    ])
    expect(screen.getByTestId("format-undo-banner")).toHaveTextContent(
      "Mise en forme appliquée",
    )
  })

  it("« Annuler » rétablit le texte brut collé", async () => {
    const user = userEvent.setup()
    await openEdit({ references: ["Réf A", "", "Réf C"] })

    await user.click(screen.getByTestId("reference-input-1"))
    await user.paste(BLOCK)
    await user.click(screen.getByTestId("btn-format-undo"))

    expect(referenceValues()).toEqual(["Réf A", BLOCK, "Réf C"])
    expect(screen.queryByTestId("format-undo-banner")).not.toBeInTheDocument()
  })

  it("« Découper » sépare un bloc sans numéro selon les lignes vides", async () => {
    const user = userEvent.setup()
    await openEdit({
      references: ["Source A. Lancet. 2020.\n\nSource B. BMJ. 2021."],
    })

    await user.click(screen.getByTestId("btn-split-reference-0"))

    expect(referenceValues()).toEqual([
      "Source A. Lancet. 2020.",
      "Source B. BMJ. 2021.",
    ])
  })

  it("avertit dès l'ouverture sans empêcher l'enregistrement", async () => {
    const user = userEvent.setup()
    await openEdit({ explanation: "Voir [1] et [3].", references: [BLOCK] })

    expect(screen.getByTestId("format-warning-reference-0")).toHaveTextContent(
      "Ce champ contient 3 sources numérotées",
    )
    expect(screen.getByTestId("format-warning-explanation")).toHaveTextContent(
      "au-delà de la liste",
    )

    await user.click(
      screen.getByRole("button", { name: /Enregistrer les modifications/i }),
    )
    await waitFor(() => expect(updateQuestion).toHaveBeenCalledTimes(1))
    expect(updateQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ references: [BLOCK] }),
    )
  })

  it("une explication collée est remise en forme sur place", async () => {
    const user = userEvent.setup()
    await openEdit({ explanation: "" })

    await user.click(screen.getByTestId("explanation-input"))
    await user.paste("Premier point.\n[1]\n\n\n\nSecond   point.")

    expect(screen.getByTestId("explanation-input")).toHaveValue(
      "Premier point. [1]\n\nSecond point.",
    )
    await user.click(screen.getByTestId("btn-format-undo"))
    expect(screen.getByTestId("explanation-input")).toHaveValue(
      "Premier point.\n[1]\n\n\n\nSecond   point.",
    )
  })

  it("coller un mot propre ne reformate pas une explication ancienne", async () => {
    const user = userEvent.setup()
    await openEdit({ explanation: "Ancien  texte.\n[1]" })

    await user.click(screen.getByTestId("explanation-input"))
    await user.paste(" ajout")

    expect(screen.getByTestId("explanation-input")).toHaveValue(
      "Ancien  texte.\n[1] ajout",
    )
    expect(screen.queryByTestId("format-undo-banner")).not.toBeInTheDocument()
  })

  it("un collage déjà propre n'est pas intercepté", async () => {
    const user = userEvent.setup()
    await openEdit({ references: [""] })

    await user.click(screen.getByTestId("reference-input-0"))
    await user.paste("Source A. Lancet. 2020.")

    expect(referenceValues()).toEqual(["Source A. Lancet. 2020."])
    expect(screen.queryByTestId("format-undo-banner")).not.toBeInTheDocument()
  })
})
