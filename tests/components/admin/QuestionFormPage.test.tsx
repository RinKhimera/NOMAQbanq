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
// artefact d'environnement, pas un comportement navigateur (le fix `values` a été
// vérifié en prod). On le remplace par un composant contrôlé fidèle : il EXPOSE la
// valeur reçue (`data-value`) sans la réécrire, exactement comme un vrai Select.
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
