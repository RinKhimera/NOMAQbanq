import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileNotifications } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-notifications"

const mocks = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock("@/features/notifications/actions", () => ({
  updateNotificationPreferences: mocks.update,
}))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  mocks.update.mockReset().mockResolvedValue({ success: true })
})

describe("ProfileNotifications", () => {
  it("reflète l'état initial et appelle l'action au toggle", async () => {
    render(
      <ProfileNotifications
        preferences={{
          examResults: true,
          accessExpiry: false,
          marketing: true,
        }}
      />,
    )
    const exam = screen.getByTestId("notif-toggle-exam-results")
    const access = screen.getByTestId("notif-toggle-access-expiry")
    expect(exam).toBeChecked()
    expect(access).not.toBeChecked()

    fireEvent.click(exam) // exam → false
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        examResults: false,
        accessExpiry: false,
        marketing: true,
      }),
    )
  })

  it("rollback si l'action échoue", async () => {
    mocks.update.mockResolvedValueOnce({ success: false, error: "boom" })
    render(
      <ProfileNotifications
        preferences={{
          examResults: false,
          accessExpiry: false,
          marketing: true,
        }}
      />,
    )
    const exam = screen.getByTestId("notif-toggle-exam-results")
    fireEvent.click(exam)
    await waitFor(() => expect(exam).not.toBeChecked()) // revenu à false
  })
})

describe("ProfileNotifications — rappels commerciaux", () => {
  it("expose l'interrupteur des rappels commerciaux", async () => {
    render(
      <ProfileNotifications
        preferences={{ examResults: true, accessExpiry: true, marketing: true }}
      />,
    )
    const marketing = screen.getByTestId("notif-toggle-marketing")
    expect(marketing).toBeChecked()
    fireEvent.click(marketing)
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        examResults: true,
        accessExpiry: true,
        marketing: false,
      }),
    )
  })
})
