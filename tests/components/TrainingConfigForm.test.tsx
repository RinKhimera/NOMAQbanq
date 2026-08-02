import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrainingConfigForm } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form"

const {
  push,
  toastError,
  toastSuccess,
  createTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
} = vi.hoisted(() => ({
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  createTrainingSession: vi.fn(),
  loadAvailableObjectifsCMC: vi.fn(),
  loadRevisionCounts: vi.fn(),
}))

// Factory async : `vi.mock` est hoisté, donc le helper doit être importé DEDANS.
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../helpers/motion-mock")
  return motionMockFactory
})
// Mock COMPLET : `callAction` importe `unstable_isUnrecognizedActionError` de
// `next/navigation` — un mock partiel casse le chemin d'échec.
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))
vi.mock("@/features/training/actions", () => ({
  createTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
}))

const props = {
  domains: [{ domain: "Cardiologie", count: 120 }],
  totalQuestions: 3000,
  objectifs: [{ objectif: "Obj A", count: 40 }],
}

const primeActions = () => {
  loadAvailableObjectifsCMC.mockResolvedValue({ objectifs: props.objectifs })
  loadRevisionCounts.mockResolvedValue({
    failed: 7,
    unseen: 812,
    bookmarked: 3,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TrainingConfigForm — révision", () => {
  it("affiche les compteurs de révision", async () => {
    primeActions()

    render(<TrainingConfigForm {...props} />)

    await waitFor(() => {
      expect(screen.getByTestId("revision-failed")).toHaveTextContent("7")
    })
    expect(screen.getByTestId("revision-bookmarked")).toHaveTextContent("3")
  })

  it("transmet les critères cochés et annonce le nombre réellement retenu", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s1",
      questionCount: 7,
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())

    await userEvent.click(screen.getByTestId("revision-failed"))
    await userEvent.click(
      screen.getByRole("button", { name: /Commencer l'entraînement/i }),
    )

    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ revisionFilters: ["failed"] }),
      )
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      "Session créée !",
      expect.objectContaining({ description: expect.stringContaining("7") }),
    )
    expect(push).toHaveBeenCalledWith("/tableau-de-bord/entrainement/s1")
  })

  it("décocher un critère le retire de l'envoi", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s2",
      questionCount: 10,
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())

    const chip = screen.getByTestId("revision-bookmarked")
    await userEvent.click(chip)
    expect(chip).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(chip)
    expect(chip).toHaveAttribute("aria-pressed", "false")

    await userEvent.click(
      screen.getByRole("button", { name: /Commencer l'entraînement/i }),
    )

    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ revisionFilters: undefined }),
      )
    })
  })

  it("signale un corpus vide renvoyé par le serveur", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: false,
      error: "Aucune question ne correspond à ces critères de révision.",
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())

    await userEvent.click(screen.getByTestId("revision-failed"))
    await userEvent.click(
      screen.getByRole("button", { name: /Commencer l'entraînement/i }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Erreur", {
        description:
          "Aucune question ne correspond à ces critères de révision.",
      })
    })
    expect(push).not.toHaveBeenCalled()
  })

  it("prévient quand les compteurs sont injoignables", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs: props.objectifs })
    loadRevisionCounts.mockRejectedValue(new Error("Failed to fetch"))

    render(<TrainingConfigForm {...props} />)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Impossible de charger vos compteurs de révision. Vérifiez votre réseau.",
      )
    })
  })

  it("prévient quand les objectifs sont injoignables", async () => {
    loadRevisionCounts.mockResolvedValue({
      failed: 0,
      unseen: 0,
      bookmarked: 0,
    })
    loadAvailableObjectifsCMC.mockRejectedValue(new Error("Failed to fetch"))

    render(<TrainingConfigForm {...props} />)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Impossible de charger les objectifs du domaine. Vérifiez votre réseau.",
      )
    })
  })

  it("bloque la création quand la banque est plus petite que la demande", async () => {
    primeActions()

    render(<TrainingConfigForm {...props} totalQuestions={3} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())

    expect(
      screen.getByText(/Seulement 3 questions disponibles/i),
    ).toBeInTheDocument()

    const submit = screen.getByRole("button", {
      name: /Commencer l'entraînement/i,
    })
    expect(submit).toBeDisabled()
    await userEvent.click(submit)
    expect(createTrainingSession).not.toHaveBeenCalled()
  })

  it("accorde le singulier quand une seule question est disponible", async () => {
    primeActions()

    render(<TrainingConfigForm {...props} totalQuestions={1} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())

    expect(
      screen.getByText(/Seulement 1 question disponible/i),
    ).toBeInTheDocument()
  })

  it("bascule en mode tuteur et le transmet", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s3",
      questionCount: 10,
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())

    await userEvent.click(screen.getByLabelText(/Mode tuteur/i))
    await userEvent.click(
      screen.getByRole("button", { name: /Commencer l'entraînement/i }),
    )

    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "tutor" }),
      )
    })
  })
})
