import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  QuestionActions,
  createAddAction,
  createDeleteAction,
  createEditAction,
  createPermanentDeleteAction,
  createRemoveAction,
  createViewAction,
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

    await user.click(screen.getByRole("button", { name: /Actions/i }))

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

    await user.click(screen.getByRole("button", { name: /Actions/i }))

    await waitFor(() => {
      expect(screen.getByText("Retirer de la banque")).toBeInTheDocument()
    })
    expect(
      screen.getByRole("menuitem", { name: "Retirer de la banque" }),
    ).toHaveAttribute("data-variant", "destructive")
  })

  it("shows separator between non-destructive and destructive actions", async () => {
    const user = userEvent.setup()
    const actions = [
      createViewAction(vi.fn()),
      createEditAction(vi.fn()),
      createDeleteAction(vi.fn()),
    ]
    render(<QuestionActions actions={actions} />)

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
