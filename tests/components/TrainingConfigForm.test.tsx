import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
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
  })
})
