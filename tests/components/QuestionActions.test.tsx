import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  createViewAction,
  createEditAction,
  createDeleteAction,
  createAddAction,
  createPermanentDeleteAction,
  createRemoveAction,
  QuestionActions,
  QuestionHeader,
  QuestionMetadata,
} from "@/components/quiz/question-card/question-actions"

describe("Action Creators", () => {
  describe("createViewAction", () => {
    it("creates a view action config", () => {
      const onClick = vi.fn()
      const action = createViewAction(onClick)

      expect(action.type).toBe("view")
      expect(action.label).toBe("Voir les détails")
      expect(action.onClick).toBe(onClick)
      expect(action.icon).toBeDefined()
      expect(action.variant).toBeUndefined()
    })
  })

  describe("createEditAction", () => {
    it("creates an edit action config", () => {
      const onClick = vi.fn()
      const action = createEditAction(onClick)

      expect(action.type).toBe("edit")
      expect(action.label).toBe("Modifier")
      expect(action.onClick).toBe(onClick)
      expect(action.icon).toBeDefined()
      expect(action.variant).toBeUndefined()
    })
  })

  describe("createDeleteAction", () => {
    it("creates a delete action config with destructive variant", () => {
      const onClick = vi.fn()
      const action = createDeleteAction(onClick)

      expect(action.type).toBe("delete")
      expect(action.label).toBe("Retirer de la banque")
      expect(action.onClick).toBe(onClick)
      expect(action.icon).toBeDefined()
      expect(action.variant).toBe("destructive")
    })
  })

  describe("createAddAction", () => {
    it("creates an add action config", () => {
      const onClick = vi.fn()
      const action = createAddAction(onClick)

      expect(action.type).toBe("add")
      expect(action.label).toBe("Ajouter à la banque")
      expect(action.onClick).toBe(onClick)
      expect(action.icon).toBeDefined()
      expect(action.variant).toBeUndefined()
    })
  })

  describe("createPermanentDeleteAction", () => {
    it("creates a permanent delete action config with destructive variant", () => {
      const onClick = vi.fn()
      const action = createPermanentDeleteAction(onClick)

      expect(action.type).toBe("permanent-delete")
      expect(action.label).toBe("Supprimer définitivement")
      expect(action.onClick).toBe(onClick)
      expect(action.icon).toBeDefined()
      expect(action.variant).toBe("destructive")
    })
  })

  describe("createRemoveAction", () => {
    it("creates a remove action config with destructive variant", () => {
      const onClick = vi.fn()
      const action = createRemoveAction(onClick)

      expect(action.type).toBe("remove")
      expect(action.label).toBe("Retirer de l'examen")
      expect(action.onClick).toBe(onClick)
      expect(action.icon).toBeDefined()
      expect(action.variant).toBe("destructive")
    })
  })
})

describe("QuestionActions", () => {
  it("returns null when actions array is empty", () => {
    const { container } = render(<QuestionActions actions={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders dropdown trigger when actions exist", () => {
    const actions = [createViewAction(vi.fn())]
    render(<QuestionActions actions={actions} />)

    expect(screen.getByRole("button", { name: /Actions/i })).toBeInTheDocument()
  })

  it("shows action labels in dropdown", async () => {
    const user = userEvent.setup()
    const actions = [createViewAction(vi.fn()), createEditAction(vi.fn())]
    render(<QuestionActions actions={actions} />)

    // Open dropdown
    await user.click(screen.getByRole("button", { name: /Actions/i }))

    await waitFor(() => {
      expect(screen.getByText("Voir les détails")).toBeInTheDocument()
      expect(screen.getByText("Modifier")).toBeInTheDocument()
    })
  })

  it("calls onClick when action is clicked", async () => {
    const user = userEvent.setup()
    const viewClick = vi.fn()
    const actions = [createViewAction(viewClick)]
    render(<QuestionActions actions={actions} />)

    // Open dropdown
    await user.click(screen.getByRole("button", { name: /Actions/i }))

    // Click action
    await waitFor(() => {
      expect(screen.getByText("Voir les détails")).toBeInTheDocument()
    })
    await user.click(screen.getByText("Voir les détails"))
    expect(viewClick).toHaveBeenCalled()
  })

  it("applies destructive styling to destructive actions", async () => {
    const user = userEvent.setup()
    const actions = [createDeleteAction(vi.fn())]
    render(<QuestionActions actions={actions} />)

    // Open dropdown
    await user.click(screen.getByRole("button", { name: /Actions/i }))

    await waitFor(() => {
      expect(screen.getByText("Retirer de la banque")).toBeInTheDocument()
    })
    const actionItem = screen.getByText("Retirer de la banque").closest("div")
    expect(actionItem).toHaveClass("text-red-600")
  })

  it("shows separator between non-destructive and destructive actions", async () => {
    const user = userEvent.setup()
    const actions = [
      createViewAction(vi.fn()),
      createEditAction(vi.fn()),
      createDeleteAction(vi.fn()),
    ]
    render(<QuestionActions actions={actions} />)

    // Open dropdown
    await user.click(screen.getByRole("button", { name: /Actions/i }))

    // Wait for dropdown to open and check for separator in the document body (portal)
    await waitFor(() => {
      expect(screen.getByText("Voir les détails")).toBeInTheDocument()
    })
    // There should be a separator element (hr or div with role separator) in the portal
    const separators = document.querySelectorAll('[role="separator"]')
    expect(separators.length).toBeGreaterThan(0)
  })
})

describe("QuestionHeader", () => {
  it("renders without question number", () => {
    render(<QuestionHeader />)

    expect(screen.queryByText(/Question/)).not.toBeInTheDocument()
  })

  it("renders question number badge when provided", () => {
    render(<QuestionHeader questionNumber={5} />)

    expect(screen.getByText("Question 5")).toBeInTheDocument()
  })

  it("renders domain badge when showDomainBadge is true and domain provided", () => {
    render(
      <QuestionHeader domain="Cardiologie" showDomainBadge={true} />,
    )

    expect(screen.getByText("Cardiologie")).toBeInTheDocument()
  })

  it("hides domain badge when showDomainBadge is false", () => {
    render(
      <QuestionHeader domain="Cardiologie" showDomainBadge={false} />,
    )

    expect(screen.queryByText("Cardiologie")).not.toBeInTheDocument()
  })

  it("does not render domain badge when domain is undefined", () => {
    render(<QuestionHeader showDomainBadge={true} />)

    // Should render without error
    expect(screen.queryByText("Cardiologie")).not.toBeInTheDocument()
  })

  it("renders actions dropdown when actions provided", () => {
    const actions = [createViewAction(vi.fn())]
    render(<QuestionHeader actions={actions} />)

    expect(screen.getByRole("button", { name: /Actions/i })).toBeInTheDocument()
  })

  it("does not render actions when array is empty", () => {
    render(<QuestionHeader actions={[]} />)

    expect(
      screen.queryByRole("button", { name: /Actions/i }),
    ).not.toBeInTheDocument()
  })

  it("combines question number and domain", () => {
    render(
      <QuestionHeader
        questionNumber={3}
        domain="Neurologie"
        showDomainBadge={true}
      />,
    )

    expect(screen.getByText("Question 3")).toBeInTheDocument()
    expect(screen.getByText("Neurologie")).toBeInTheDocument()
  })
})

describe("QuestionMetadata", () => {
  it("returns null when showObjectifBadge is false", () => {
    const { container } = render(
      <QuestionMetadata objectifCMC="Objectif 1" showObjectifBadge={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("returns null when objectifCMC is undefined", () => {
    const { container } = render(
      <QuestionMetadata showObjectifBadge={true} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders objectifCMC badge", () => {
    render(
      <QuestionMetadata
        objectifCMC="Identifier les signes cliniques"
        showObjectifBadge={true}
      />,
    )

    expect(
      screen.getByText("Identifier les signes cliniques"),
    ).toBeInTheDocument()
  })

  it("renders references count when provided and greater than 0", () => {
    render(
      <QuestionMetadata
        objectifCMC="Objectif"
        showObjectifBadge={true}
        referencesCount={5}
      />,
    )

    expect(screen.getByText("5 réf.")).toBeInTheDocument()
  })

  it("does not render references count when 0", () => {
    render(
      <QuestionMetadata
        objectifCMC="Objectif"
        showObjectifBadge={true}
        referencesCount={0}
      />,
    )

    expect(screen.queryByText("0 réf.")).not.toBeInTheDocument()
  })

  it("does not render references count when undefined", () => {
    render(
      <QuestionMetadata
        objectifCMC="Objectif"
        showObjectifBadge={true}
      />,
    )

    expect(screen.queryByText(/réf\./)).not.toBeInTheDocument()
  })
})
