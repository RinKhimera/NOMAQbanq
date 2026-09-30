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

const objectifs = [
  { objectif: "Douleur thoracique", count: 40 },
  { objectif: "Dyspnée", count: 3 },
]

const props = {
  domains: [
    { domain: "Cardiologie", count: 120 },
    { domain: "Neurologie", count: 80 },
  ],
  totalQuestions: 3000,
  initialDomain: null,
  initialObjectifs: [],
  hasActiveSeries: false,
}

const counts = {
  failed: 7,
  unseen: 812,
  bookmarked: 3,
  bookmarkedFailed: 1,
  bookmarkedUnseen: 0,
}

const primeActions = () => {
  loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
  loadRevisionCounts.mockResolvedValue(counts)
}

const start = () => screen.getByTestId("btn-start-training")
const pool = () => screen.getByTestId("training-pool")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TrainingConfigForm — révision ciblée", () => {
  it("affiche les compteurs de révision dans les pastilles", async () => {
    primeActions()
    render(<TrainingConfigForm {...props} />)

    await waitFor(() => {
      expect(screen.getByTestId("revision-failed")).toHaveTextContent("7")
    })
    expect(screen.getByTestId("revision-bookmarked")).toHaveTextContent("3")
    expect(screen.getByTestId("revision-unseen")).toHaveTextContent("812")
  })

  it("transmet les critères cochés, annonce le nombre retenu et navigue", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s1",
      questionCount: 7,
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toHaveTextContent("3 000 questions"))

    await userEvent.click(screen.getByTestId("revision-failed"))
    await userEvent.click(start())

    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ revisionFilters: ["failed"] }),
      )
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      "Série créée !",
      expect.objectContaining({ description: expect.stringContaining("7") }),
    )
    expect(push).toHaveBeenCalledWith("/tableau-de-bord/entrainement/s1")
  })

  it("« Disponibles » compte les questions distinctes des critères cochés, et le minimum tombe à 1", async () => {
    primeActions()
    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toHaveTextContent("3 000 questions"))

    await userEvent.click(screen.getByTestId("revision-failed"))
    await userEvent.click(screen.getByTestId("revision-bookmarked"))
    // 7 ratées + 3 marquées − 1 en commun.
    expect(pool()).toHaveTextContent("9 questions")
    expect(screen.getByText(/jusqu'à 9/)).toBeInTheDocument()
    expect(
      screen.getByText(
        "Avec la révision ciblée, une série peut compter dès 1 question.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument()

    await userEvent.click(start())
    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({
          questionCount: 9,
          revisionFilters: ["failed", "bookmarked"],
        }),
      )
    })
  })

  it("décocher un critère le retire de l'envoi", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s2",
      questionCount: 10,
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toBeInTheDocument())

    const chip = screen.getByTestId("revision-bookmarked")
    await userEvent.click(chip)
    expect(chip).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(chip)
    expect(chip).toHaveAttribute("aria-pressed", "false")

    await userEvent.click(start())
    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ revisionFilters: undefined }),
      )
    })
  })

  it("une pastille à 0 est désactivée", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    loadRevisionCounts.mockResolvedValue({ ...counts, bookmarked: 0 })
    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toBeInTheDocument())
    expect(screen.getByTestId("revision-bookmarked")).toBeDisabled()
    expect(screen.getByTestId("revision-failed")).not.toBeDisabled()
  })

  it("un refus du serveur s'affiche sous le bouton, jamais en toast", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: false,
      error: "Trop de séries créées récemment. Réessayez dans une heure.",
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(start())

    await waitFor(() => {
      expect(screen.getByTestId("training-refusal")).toHaveTextContent(
        "Trop de séries créées récemment. Réessayez dans une heure.",
      )
    })
    expect(toastError).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()

    // Changer un réglage retire l'alerte.
    await userEvent.click(screen.getByTestId("revision-failed"))
    expect(screen.queryByTestId("training-refusal")).not.toBeInTheDocument()
  })

  it("prévient quand les compteurs sont injoignables", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    loadRevisionCounts.mockRejectedValue(new Error("Failed to fetch"))

    render(<TrainingConfigForm {...props} />)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Impossible de charger vos compteurs de révision. Vérifiez votre réseau.",
      )
    })
  })
})

describe("TrainingConfigForm — nombre de questions", () => {
  it("bloque la création quand la banque est plus petite que la demande", async () => {
    primeActions()
    render(<TrainingConfigForm {...props} totalQuestions={3} />)
    await waitFor(() => expect(loadRevisionCounts).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.getByText(
          "Seulement 3 questions disponibles avec ces filtres. Élargissez la sélection.",
        ),
      ).toBeInTheDocument(),
    )
    expect(start()).toBeDisabled()
    await userEvent.click(start())
    expect(createTrainingSession).not.toHaveBeenCalled()
  })

  it("accorde le singulier, et dit « aucune » à zéro", async () => {
    primeActions()
    const { unmount } = render(
      <TrainingConfigForm {...props} totalQuestions={1} />,
    )
    await waitFor(() =>
      expect(
        screen.getByText(/Seulement 1 question disponible avec ces filtres/),
      ).toBeInTheDocument(),
    )
    unmount()
    render(<TrainingConfigForm {...props} totalQuestions={0} />)
    await waitFor(() =>
      expect(
        screen.getByText(
          "Aucune question ne correspond à ces filtres. Élargissez la sélection.",
        ),
      ).toBeInTheDocument(),
    )
  })

  it("les repères du curseur choisissent le nombre demandé", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s3",
      questionCount: 5,
    })
    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toBeInTheDocument())

    await userEvent.click(screen.getByRole("button", { name: "5" }))
    await userEvent.click(start())
    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ questionCount: 5 }),
      )
    })
  })
})

describe("TrainingConfigForm — mode et série en cours", () => {
  it("bascule en mode tuteur et le transmet", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s3",
      questionCount: 10,
    })

    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/Tuteur/))
    await userEvent.click(start())

    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "tutor" }),
      )
    })
  })

  it("une série en cours désactive le départ et l'explique, le formulaire reste", async () => {
    primeActions()
    render(<TrainingConfigForm {...props} hasActiveSeries />)
    await waitFor(() => expect(pool()).toBeInTheDocument())
    expect(start()).toBeDisabled()
    expect(
      screen.getByText(
        "Terminez ou abandonnez votre série en cours pour en commencer une autre.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Nombre de questions")).toBeInTheDocument()
  })
})

describe("TrainingConfigForm — domaine et objectifs", () => {
  it("sans domaine, les objectifs sont fermés", async () => {
    primeActions()
    render(<TrainingConfigForm {...props} />)
    expect(
      screen.getByText("Choisissez un domaine pour cibler ses objectifs."),
    ).toBeInTheDocument()
    await waitFor(() => expect(pool()).toBeInTheDocument())
    expect(loadAvailableObjectifsCMC).not.toHaveBeenCalled()
  })

  it("part du domaine demandé avec ses objectifs, sans les recharger", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s4",
      questionCount: 10,
    })

    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() =>
      expect(loadRevisionCounts).toHaveBeenCalledWith(
        expect.objectContaining({ domain: "Cardiologie" }),
      ),
    )
    expect(loadAvailableObjectifsCMC).not.toHaveBeenCalled()
    await waitFor(() => expect(pool()).toHaveTextContent("120 questions"))
    expect(
      screen.getByRole("checkbox", { name: /Douleur thoracique/ }),
    ).toBeInTheDocument()

    await userEvent.click(start())
    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ domain: "Cardiologie" }),
      )
    })
    expect(push).toHaveBeenCalledWith("/tableau-de-bord/entrainement/s4")
  })

  it("un objectif coché restreint les disponibles, recalcule les compteurs et part dans l'envoi", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s5",
      questionCount: 3,
    })
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() => expect(pool()).toHaveTextContent("120 questions"))

    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    await waitFor(() =>
      expect(loadRevisionCounts).toHaveBeenLastCalledWith({
        domain: "Cardiologie",
        objectifsCMCs: ["Dyspnée"],
      }),
    )
    // 3 questions pour cet objectif : trop peu hors révision.
    await waitFor(() =>
      expect(
        screen.getByText(/Seulement 3 questions disponibles/),
      ).toBeInTheDocument(),
    )
    expect(start()).toBeDisabled()

    // En révision ciblée, la série peut partir dès 1 question.
    await userEvent.click(screen.getByTestId("revision-failed"))
    await waitFor(() => expect(start()).not.toBeDisabled())
    await userEvent.click(start())
    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "Cardiologie",
          objectifsCMCs: ["Dyspnée"],
          questionCount: 3,
        }),
      )
    })
  })

  it("suit un nouveau domaine demandé par l'URL sans remontage", async () => {
    primeActions()
    const { rerender } = render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() =>
      expect(loadRevisionCounts).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: "Cardiologie" }),
      ),
    )

    rerender(
      <TrainingConfigForm
        {...props}
        initialDomain="Neurologie"
        initialObjectifs={[]}
      />,
    )
    await waitFor(() =>
      expect(loadRevisionCounts).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: "Neurologie" }),
      ),
    )
    // Les objectifs du nouveau domaine sont demandés au serveur.
    await waitFor(() =>
      expect(loadAvailableObjectifsCMC).toHaveBeenCalledWith("Neurologie"),
    )
  })

  it("objectifs injoignables : message en place et « Réessayer », le reste du formulaire vit", async () => {
    loadRevisionCounts.mockResolvedValue(counts)
    loadAvailableObjectifsCMC.mockRejectedValueOnce(
      new Error("Failed to fetch"),
    )
    const { rerender } = render(<TrainingConfigForm {...props} />)
    rerender(
      <TrainingConfigForm
        {...props}
        initialDomain="Neurologie"
        initialObjectifs={[]}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByText("Impossible de charger les objectifs de ce domaine."),
      ).toBeInTheDocument(),
    )
    await waitFor(() => expect(start()).not.toBeDisabled())

    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /Dyspnée/ }),
      ).toBeInTheDocument(),
    )
  })

  it("compteurs injoignables : le formulaire repart à vide au lieu de rester grisé", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    loadRevisionCounts.mockRejectedValue(new Error("Failed to fetch"))
    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    await waitFor(() => expect(start()).not.toBeDisabled())
    expect(pool()).toHaveTextContent("3 000 questions")
    expect(screen.getByTestId("revision-failed")).toBeDisabled()
  })

  it("une réponse de compteurs arrivée en retard pour une autre portée est ignorée", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    let resolveFirst: (v: typeof counts) => void = () => {}
    loadRevisionCounts
      .mockImplementationOnce(
        () =>
          new Promise<typeof counts>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValue({ ...counts, failed: 99 })
    const { rerender } = render(
      <TrainingConfigForm {...props} initialDomain="Cardiologie" />,
    )
    rerender(
      <TrainingConfigForm
        {...props}
        initialDomain="Neurologie"
        initialObjectifs={[]}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId("revision-failed")).toHaveTextContent("99"),
    )
    // La réponse de Cardiologie arrive après : elle ne remplace pas Neurologie.
    resolveFirst({ ...counts, failed: 7 })
    await waitFor(() => expect(start()).not.toBeDisabled())
    expect(screen.getByTestId("revision-failed")).toHaveTextContent("99")
  })
})
