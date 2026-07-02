import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileDangerZone } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-danger-zone"

const mocks = vi.hoisted(() => ({
  deleteMyAccount: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("@/features/users/actions", () => ({
  deleteMyAccount: mocks.deleteMyAccount,
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: mocks.signOut },
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

beforeEach(() => {
  mocks.deleteMyAccount.mockResolvedValue({ success: true })
  mocks.signOut.mockResolvedValue({})
  mocks.replace.mockReset()
})

describe("ProfileDangerZone", () => {
  it("désactive la suppression tant que l'email saisi ne correspond pas", () => {
    render(<ProfileDangerZone email="a@b.com" />)
    fireEvent.click(screen.getByTestId("danger-open-delete"))
    const confirm = screen.getByTestId(
      "danger-confirm-delete",
    ) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByTestId("danger-confirm-email"), {
      target: { value: "a@b.com" },
    })
    expect(confirm.disabled).toBe(false)
  })

  it("supprime puis déconnecte et redirige", async () => {
    render(<ProfileDangerZone email="a@b.com" />)
    fireEvent.click(screen.getByTestId("danger-open-delete"))
    fireEvent.change(screen.getByTestId("danger-confirm-email"), {
      target: { value: "a@b.com" },
    })
    fireEvent.click(screen.getByTestId("danger-confirm-delete"))
    await waitFor(() =>
      expect(mocks.deleteMyAccount).toHaveBeenCalledWith({
        confirmEmail: "a@b.com",
      }),
    )
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/compte-supprime"),
    )
  })
})
