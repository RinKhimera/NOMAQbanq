import { render, screen, waitFor, within } from "@testing-library/react"
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
// Le Select Radix ne s'ouvre pas sous happy-dom : chaque domaine devient un
// bouton qui appelle `onValueChange`.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react")
  const h = React.createElement
  const Choose = React.createContext<(v: string) => void>(() => {})
  type P = { value?: string; children?: unknown }
  return {
    Select: ({
      children,
      onValueChange,
    }: P & { onValueChange: (v: string) => void }) =>
      h(Choose.Provider, { value: onValueChange }, children as never),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: P) => h("div", null, children as never),
    SelectItem: function SelectItem({ value, children }: P) {
      const choose = React.useContext(Choose)
      return h(
        "button",
        {
          type: "button",
          "data-testid": `domain-${value}`,
          onClick: () => choose(value!),
        },
        children as never,
      )
    },
  }
})

const objectifs = [
  { id: "obj-dt", objectif: "Douleur thoracique", count: 40 },
  { id: "obj-dyspnee", objectif: "Dyspnée", count: 3 },
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
        "Avec la révision ciblée, une série peut compter dès 1 question. Le nombre choisi est un maximum.",
      ),
    ).toBeInTheDocument()
    // Le maximum réel est proposé à côté des paliers, et retenu d'office.
    expect(screen.getByRole("button", { name: "9, maximum" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "10" })).toBeDisabled()

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

  it("sous 20 questions disponibles, les paliers au-delà sont fermés et le maximum réel est proposé", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s12",
      questionCount: 12,
    })
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={[{ id: "obj-12", objectif: "Syncope", count: 12 }]}
      />,
    )
    await waitFor(() => expect(pool()).toHaveTextContent("120 questions"))
    await userEvent.click(screen.getByRole("checkbox", { name: /Syncope/ }))
    await waitFor(() => expect(pool()).toHaveTextContent("12 questions"))

    expect(
      screen.getByText("12 questions au plus avec ces filtres."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "15" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "20" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "10" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    await userEvent.click(screen.getByRole("button", { name: "12, maximum" }))
    await userEvent.click(start())
    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({ questionCount: 12 }),
      )
    })
  })

  it("un ancien maximum retombe sur le palier inférieur quand les filtres s'élargissent", async () => {
    primeActions()
    loadAvailableObjectifsCMC.mockResolvedValue({
      objectifs: [{ id: "obj-12", objectif: "Syncope", count: 300 }],
    })
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={[{ id: "obj-12", objectif: "Syncope", count: 12 }]}
      />,
    )
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(screen.getByRole("checkbox", { name: /Syncope/ }))
    await userEvent.click(screen.getByRole("button", { name: "12, maximum" }))

    await userEvent.click(screen.getByTestId("domain-all"))
    await waitFor(() => expect(pool()).toHaveTextContent("300 questions"))
    expect(screen.getByRole("button", { name: "10" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByTestId("question-count")).toHaveTextContent("10")
  })

  it("en révision, un maximum sous 5 retombe sur le plus petit palier quand le corpus grandit", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    loadRevisionCounts.mockResolvedValue({ ...counts, failed: 3 })
    render(<TrainingConfigForm {...props} />)
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(screen.getByTestId("revision-failed"))
    await userEvent.click(screen.getByRole("button", { name: "3, maximum" }))

    await userEvent.click(screen.getByTestId("revision-unseen"))
    expect(screen.getByRole("button", { name: "5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByTestId("question-count")).toHaveTextContent("jusqu'à 5")
  })

  it("pendant le chargement des compteurs, le nombre se lit « — » et aucun palier n'est barré", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    loadRevisionCounts.mockImplementation(() => new Promise(() => {}))
    render(<TrainingConfigForm {...props} />)
    expect(screen.getByTestId("question-count")).toHaveTextContent("—")
    const twenty = screen.getByRole("button", { name: "20" })
    expect(twenty).toBeDisabled()
    expect(twenty).not.toHaveAttribute("data-unavailable")
  })

  it("trop peu de questions : aucun palier ne se choisit et le nombre se lit « — »", async () => {
    primeActions()
    render(<TrainingConfigForm {...props} totalQuestions={3} />)
    await waitFor(() => expect(start()).toBeDisabled())
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "5" })).toBeDisabled(),
    )
    expect(screen.getByTestId("question-count")).toHaveTextContent("—")
  })

  it("les paliers choisissent le nombre demandé", async () => {
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
  it("avec « Tous les domaines », les objectifs de toute la banque se cochent et partent sans domaine", async () => {
    primeActions()
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s-all",
      questionCount: 10,
    })
    render(<TrainingConfigForm {...props} initialObjectifs={objectifs} />)
    expect(
      screen.getAllByText("2 objectifs, tous domaines")[0],
    ).toBeInTheDocument()
    await waitFor(() => expect(pool()).toHaveTextContent("3 000 questions"))

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Douleur thoracique/ }),
    )
    await waitFor(() =>
      expect(loadRevisionCounts).toHaveBeenLastCalledWith({
        domain: undefined,
        objectiveIds: ["obj-dt"],
      }),
    )
    await waitFor(() => expect(pool()).toHaveTextContent("40 questions"))
    await userEvent.click(start())
    await waitFor(() => {
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: undefined,
          objectiveIds: ["obj-dt"],
        }),
      )
    })
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
        objectiveIds: ["obj-dyspnee"],
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
          objectiveIds: ["obj-dyspnee"],
          questionCount: 3,
        }),
      )
    })
  })

  it("changer de domaine garde les objectifs communs, retire les autres, et « Revenir à … » restaure tout", async () => {
    loadRevisionCounts.mockResolvedValue(counts)
    loadAvailableObjectifsCMC.mockImplementation(async (domain?: string) => ({
      objectifs:
        domain === "Neurologie"
          ? [{ id: "obj-dt", objectif: "Douleur thoracique", count: 12 }]
          : objectifs,
    }))
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() => expect(pool()).toHaveTextContent("120 questions"))
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Douleur thoracique/ }),
    )
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    await waitFor(() => expect(pool()).toHaveTextContent("43 questions"))

    await userEvent.click(screen.getByTestId("domain-Neurologie"))
    await waitFor(() =>
      expect(
        screen.getByText("1 objectif retiré : absent de Neurologie"),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("button", { name: "Retirer Douleur thoracique" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Retirer Dyspnée" }),
    ).not.toBeInTheDocument()
    // Le nombre de l'objectif gardé est celui du nouveau domaine.
    await waitFor(() => expect(pool()).toHaveTextContent("12 questions"))

    await userEvent.click(
      screen.getByRole("button", { name: "Revenir à Cardiologie" }),
    )
    await waitFor(() => expect(pool()).toHaveTextContent("43 questions"))
    expect(
      screen.getByRole("button", { name: "Retirer Dyspnée" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/objectif retiré/)).not.toBeInTheDocument()
  })

  it("objectifs du nouveau domaine injoignables : l'ancienne sélection ne part pas, « Réessayer » la rapproche", async () => {
    loadRevisionCounts.mockResolvedValue(counts)
    createTrainingSession.mockResolvedValue({
      success: true,
      sessionId: "s-neuro",
      questionCount: 10,
    })
    loadAvailableObjectifsCMC.mockRejectedValueOnce(
      new Error("Failed to fetch"),
    )
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Douleur thoracique/ }),
    )
    await userEvent.click(screen.getByTestId("domain-Neurologie"))
    await waitFor(() =>
      expect(
        screen.getByText("Impossible de charger les objectifs de ce domaine."),
      ).toBeInTheDocument(),
    )
    await waitFor(() => expect(pool()).toHaveTextContent("80 questions"))
    await userEvent.click(start())
    await waitFor(() =>
      expect(createTrainingSession).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "Neurologie",
          objectiveIds: undefined,
        }),
      ),
    )

    loadAvailableObjectifsCMC.mockResolvedValue({
      objectifs: [{ id: "obj-dt", objectif: "Douleur thoracique", count: 12 }],
    })
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retirer Douleur thoracique" }),
      ).toBeInTheDocument(),
    )
  })

  it("deux changements de domaine rapides : la note renvoie au domaine de départ", async () => {
    loadRevisionCounts.mockResolvedValue(counts)
    loadAvailableObjectifsCMC.mockImplementation((domain?: string) =>
      domain === "Neurologie"
        ? new Promise(() => {})
        : Promise.resolve({ objectifs: [] }),
    )
    render(
      <TrainingConfigForm
        {...props}
        domains={[...props.domains, { domain: "Pédiatrie", count: 60 }]}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    // Neurologie ne répond jamais : on repart vers Pédiatrie pendant l'attente.
    await userEvent.click(screen.getByTestId("domain-Neurologie"))
    await userEvent.click(screen.getByTestId("domain-Pédiatrie"))
    await waitFor(() =>
      expect(
        screen.getByText("1 objectif retiré : absent de Pédiatrie"),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("button", { name: "Revenir à Cardiologie" }),
    ).toBeInTheDocument()
  })

  it("la note de retrait disparaît dès que la sélection change", async () => {
    loadRevisionCounts.mockResolvedValue(counts)
    loadAvailableObjectifsCMC.mockImplementation(async (domain?: string) => ({
      objectifs:
        domain === "Neurologie"
          ? [
              { id: "obj-dt", objectif: "Douleur thoracique", count: 12 },
              { id: "obj-cephalee", objectif: "Céphalée", count: 20 },
            ]
          : objectifs,
    }))
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    await userEvent.click(screen.getByTestId("domain-Neurologie"))
    await waitFor(() =>
      expect(
        screen.getByText("1 objectif retiré : absent de Neurologie"),
      ).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole("checkbox", { name: /Céphalée/ }))
    expect(screen.queryByText(/objectif retiré/)).not.toBeInTheDocument()
  })

  it("la note de retrait se referme", async () => {
    loadRevisionCounts.mockResolvedValue(counts)
    loadAvailableObjectifsCMC.mockImplementation(async (domain?: string) => ({
      objectifs: domain === "Neurologie" ? [] : objectifs,
    }))
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    await userEvent.click(screen.getByTestId("domain-Neurologie"))
    await waitFor(() =>
      expect(
        screen.getByText("1 objectif retiré : absent de Neurologie"),
      ).toBeInTheDocument(),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Fermer la note" }),
    )
    expect(screen.queryByText(/objectif retiré/)).not.toBeInTheDocument()
  })

  it("passer à « Tous les domaines » garde toute la sélection, sans note", async () => {
    loadRevisionCounts.mockResolvedValue(counts)
    loadAvailableObjectifsCMC.mockResolvedValue({
      objectifs: [
        { id: "obj-dt", objectif: "Douleur thoracique", count: 90 },
        { id: "obj-dyspnee", objectif: "Dyspnée", count: 30 },
      ],
    })
    render(
      <TrainingConfigForm
        {...props}
        initialDomain="Cardiologie"
        initialObjectifs={objectifs}
      />,
    )
    await waitFor(() => expect(pool()).toBeInTheDocument())
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Douleur thoracique/ }),
    )
    await userEvent.click(screen.getByTestId("domain-all"))
    await waitFor(() => expect(pool()).toHaveTextContent("90 questions"))
    expect(loadAvailableObjectifsCMC).toHaveBeenLastCalledWith(undefined)
    expect(screen.queryByText(/retiré/)).not.toBeInTheDocument()
  })

  it("le récapitulatif nomme jusqu'à 3 objectifs, puis les compte", async () => {
    primeActions()
    const four = ["Asthme", "Bronchiolite", "Croup", "Dyspnée"].map(
      (objectif, i) => ({ id: `o${i}`, objectif, count: 30 }),
    )
    render(<TrainingConfigForm {...props} initialObjectifs={four} />)
    const recap = () => screen.getByTestId("recap-objectifs")
    await waitFor(() => expect(recap()).toHaveTextContent("Tous"))

    await userEvent.click(screen.getByRole("checkbox", { name: /Asthme/ }))
    await userEvent.click(screen.getByRole("checkbox", { name: /Croup/ }))
    expect(
      within(recap())
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Asthme", "Croup"])

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Bronchiolite/ }),
    )
    await userEvent.click(screen.getByRole("checkbox", { name: /Dyspnée/ }))
    expect(recap()).toHaveTextContent("4 objectifs")
    expect(within(recap()).queryAllByRole("listitem")).toHaveLength(0)
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

  it("compteurs injoignables : prévient, et le formulaire repart à vide au lieu de rester grisé", async () => {
    loadAvailableObjectifsCMC.mockResolvedValue({ objectifs })
    loadRevisionCounts.mockRejectedValue(new Error("Failed to fetch"))
    render(<TrainingConfigForm {...props} />)
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Impossible de charger vos compteurs de révision. Vérifiez votre réseau.",
      ),
    )
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
