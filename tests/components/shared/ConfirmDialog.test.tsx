import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"

const renderWithTrigger = (onConfirm: () => unknown) =>
  render(
    <ConfirmDialog
      trigger={<Button>Supprimer la série</Button>}
      title="Supprimer cette série ?"
      description="Cette action est irréversible."
      confirmLabel="Supprimer"
      pendingLabel="Suppression..."
      variant="destructive"
      onConfirm={onConfirm}
    >
      <p>Détail de la série</p>
    </ConfirmDialog>,
  )

describe("ConfirmDialog", () => {
  it("s'ouvre depuis son déclencheur et montre titre, description et contenu", async () => {
    renderWithTrigger(vi.fn())
    await userEvent.click(
      screen.getByRole("button", { name: "Supprimer la série" }),
    )
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Supprimer cette série ?",
    )
    expect(
      screen.getByText("Cette action est irréversible."),
    ).toBeInTheDocument()
    expect(screen.getByText("Détail de la série")).toBeInTheDocument()
  })

  it("se ferme après une confirmation réussie", async () => {
    const onConfirm = vi.fn(async () => {})
    renderWithTrigger(onConfirm)
    await userEvent.click(
      screen.getByRole("button", { name: "Supprimer la série" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
  })

  it("reste ouvert quand la confirmation échoue (false)", async () => {
    renderWithTrigger(async () => false)
    await userEvent.click(
      screen.getByRole("button", { name: "Supprimer la série" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Supprimer" })).toBeEnabled(),
    )
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("pendant l'attente : libellé d'attente, boutons désactivés", async () => {
    let resolve: () => void = () => {}
    const onConfirm = () =>
      new Promise<void>((r) => {
        resolve = r
      })
    renderWithTrigger(onConfirm)
    await userEvent.click(
      screen.getByRole("button", { name: "Supprimer la série" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    expect(screen.getByRole("button", { name: /Suppression/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled()
    resolve()
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
  })

  it("contrôlé : signale la fermeture par Annuler", async () => {
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Désactiver l'examen ?"
        confirmLabel="Désactiver"
        onConfirm={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("confirmation bloquée tant que confirmDisabled", async () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Supprimer ?"
        confirmLabel="Supprimer"
        confirmDisabled
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeDisabled()
  })
})
