import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnsubscribeFlow } from "@/app/(marketing)/desabonnement/_components/unsubscribe-flow"

const mocks = vi.hoisted(() => ({ unsubscribe: vi.fn(), resubscribe: vi.fn() }))
vi.mock("@/features/notifications/actions", () => ({
  unsubscribeWithToken: mocks.unsubscribe,
  resubscribeWithToken: mocks.resubscribe,
}))

beforeEach(() => {
  mocks.unsubscribe.mockResolvedValue({ success: true })
  mocks.resubscribe.mockResolvedValue({ success: true })
})

describe("UnsubscribeFlow", () => {
  it("demande confirmation, désabonne au clic, puis réactive", async () => {
    render(<UnsubscribeFlow token="tok" />)
    expect(screen.getByText(/Ne plus recevoir nos rappels/)).toBeInTheDocument()
    expect(mocks.unsubscribe).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /Me désabonner/ }))
    await waitFor(() =>
      expect(mocks.unsubscribe).toHaveBeenCalledWith({ token: "tok" }),
    )
    expect(
      await screen.findByText(/ne recevrez plus nos rappels/),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: /Réactiver les rappels/ }),
    )
    await waitFor(() =>
      expect(mocks.resubscribe).toHaveBeenCalledWith({ token: "tok" }),
    )
    expect(
      await screen.findByText(/rappels sont réactivés/),
    ).toBeInTheDocument()
  })

  it("rend le focus au titre de la confirmation, le bouton cliqué ayant disparu", async () => {
    const user = userEvent.setup()
    render(<UnsubscribeFlow token="tok" />)
    await user.click(screen.getByRole("button", { name: /Me désabonner/ }))

    const title = await screen.findByRole("heading", {
      level: 1,
      name: /ne recevrez plus nos rappels/,
    })
    await waitFor(() => expect(title).toHaveFocus())
  })

  it("rend aussi le focus au titre après la réactivation", async () => {
    const user = userEvent.setup()
    render(<UnsubscribeFlow token="tok" />)
    await user.click(screen.getByRole("button", { name: /Me désabonner/ }))
    await user.click(
      await screen.findByRole("button", { name: /Réactiver les rappels/ }),
    )

    const title = await screen.findByRole("heading", {
      level: 1,
      name: /rappels sont réactivés/,
    })
    await waitFor(() => expect(title).toHaveFocus())
  })

  it("action refusée : message, état inchangé", async () => {
    mocks.unsubscribe.mockResolvedValueOnce({
      success: false,
      error: "Ce lien n'est plus valide",
    })
    render(<UnsubscribeFlow token="tok" />)
    fireEvent.click(screen.getByRole("button", { name: /Me désabonner/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/plus valide/)
    expect(screen.getByText(/Ne plus recevoir nos rappels/)).toBeInTheDocument()
  })

  it("jeton invalide : message neutre, aucun bouton, lien vers les préférences", () => {
    render(<UnsubscribeFlow token={null} />)
    expect(screen.getByText(/pas valide/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.getByRole("link", { name: /préférences/ })).toHaveAttribute(
      "href",
      "/tableau-de-bord/profil",
    )
  })
})
