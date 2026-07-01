import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileSessions } from "@/app/(dashboard)/dashboard/profil/_components/profile-sessions"

const mocks = vi.hoisted(() => ({
  revokeUserSession: vi.fn(),
  revokeOtherUserSessions: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("@/features/users/actions", () => ({
  revokeUserSession: mocks.revokeUserSession,
  revokeOtherUserSessions: mocks.revokeOtherUserSessions,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

const base = {
  ipAddress: "1.2.3.4",
  lastActiveLabel: "30 juin 2026, 12:00",
}

beforeEach(() => {
  mocks.revokeUserSession.mockResolvedValue({ success: true })
  mocks.revokeOtherUserSessions.mockResolvedValue({ success: true })
})

describe("ProfileSessions", () => {
  it("marque la session courante et n'affiche pas son bouton révoquer", () => {
    render(
      <ProfileSessions
        sessions={[
          {
            id: "cur",
            deviceLabel: "Chrome · Windows",
            isCurrent: true,
            ...base,
          },
          {
            id: "oth",
            deviceLabel: "Firefox · Linux",
            isCurrent: false,
            ...base,
          },
        ]}
      />,
    )
    expect(screen.getByText(/Cet appareil/i)).toBeInTheDocument()
    expect(screen.queryByTestId("session-revoke-cur")).toBeNull()
    expect(screen.getByTestId("session-revoke-oth")).toBeInTheDocument()
  })

  it("appelle revokeUserSession au clic", () => {
    render(
      <ProfileSessions
        sessions={[
          {
            id: "oth",
            deviceLabel: "Firefox · Linux",
            isCurrent: false,
            ...base,
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByTestId("session-revoke-oth"))
    expect(mocks.revokeUserSession).toHaveBeenCalledWith("oth")
  })
})
