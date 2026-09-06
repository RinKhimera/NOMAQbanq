import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserBanSection } from "@/app/(admin)/admin/utilisateurs/[id]/_components/user-ban-section"
import type { UserBanView } from "@/features/users/dal"

const mocks = vi.hoisted(() => ({
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/features/users/actions", () => ({
  banUser: mocks.banUser,
  unbanUser: mocks.unbanUser,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

const baseUser = {
  id: "user-1",
  name: "Marie Curie",
  email: "marie@exemple.com",
  role: "user" as const,
  banned: false,
}

const activeBan: UserBanView = {
  id: "ban-1",
  reason: "Litige perdu, fraude",
  bannedAt: new Date("2026-09-05T14:00:00Z").getTime(),
  bannedByName: "Samuel",
  liftedAt: null,
  liftedByName: null,
  liftReason: null,
}

// Auteur distinct de l'épisode actif : `getByText(/par Samuel/)` lèverait
// « multiple elements » si les deux <p> le contenaient.
const pastBan: UserBanView = {
  id: "ban-0",
  reason: "Ancien épisode",
  bannedAt: new Date("2026-08-01T10:00:00Z").getTime(),
  bannedByName: "Ancien admin",
  liftedAt: new Date("2026-08-03T10:00:00Z").getTime(),
  liftedByName: "Autre",
  liftReason: "Erreur",
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.banUser.mockResolvedValue({ success: true })
  mocks.unbanUser.mockResolvedValue({ success: true })
})

describe("UserBanSection", () => {
  it("compte actif : bouton de suspension, motif obligatoire", async () => {
    render(<UserBanSection user={baseUser} bans={[]} currentUserId="viewer" />)
    fireEvent.click(screen.getByTestId("ban-open"))
    const confirm = screen.getByTestId("ban-confirm")
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "abc" },
    })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "Litige perdu, fraude" },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(mocks.banUser).toHaveBeenCalledWith({
        userId: "user-1",
        reason: "Litige perdu, fraude",
      }),
    )
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Compte suspendu.")
  })

  it("compte suspendu : détail de l'épisode et levée avec motif facultatif", async () => {
    render(
      <UserBanSection
        user={{ ...baseUser, banned: true }}
        bans={[activeBan, pastBan]}
        currentUserId="viewer"
      />,
    )
    expect(screen.getByTestId("ban-badge")).toHaveTextContent("Suspendu")
    expect(screen.getByText("Litige perdu, fraude")).toBeInTheDocument()
    expect(screen.getByText(/par Samuel/)).toBeInTheDocument()
    expect(screen.getByText("Ancien épisode")).toBeInTheDocument()
    expect(screen.getByText(/par Ancien admin/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("unban-open"))
    fireEvent.click(screen.getByTestId("unban-confirm"))
    await waitFor(() =>
      expect(mocks.unbanUser).toHaveBeenCalledWith({
        userId: "user-1",
        reason: undefined,
      }),
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Suspension levée.")
  })

  it("sa propre fiche : note, pas de bouton", () => {
    render(
      <UserBanSection user={baseUser} bans={[]} currentUserId={baseUser.id} />,
    )
    expect(screen.queryByTestId("ban-open")).toBeNull()
    expect(screen.getByTestId("ban-self-note")).toBeInTheDocument()
  })

  it("cible admin : note, pas de bouton", () => {
    render(
      <UserBanSection
        user={{ ...baseUser, role: "admin" }}
        bans={[]}
        currentUserId="viewer"
      />,
    )
    expect(screen.queryByTestId("ban-open")).toBeNull()
    expect(screen.getByTestId("ban-admin-note")).toHaveTextContent(
      "Retirez d'abord le rôle administrateur",
    )
  })

  it("erreur d'action : toast, dialog ouvert, pas de refresh", async () => {
    mocks.banUser.mockResolvedValue({
      success: false,
      error: "Ce compte est déjà suspendu.",
    })
    render(<UserBanSection user={baseUser} bans={[]} currentUserId="viewer" />)
    fireEvent.click(screen.getByTestId("ban-open"))
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "Motif suffisant" },
    })
    fireEvent.click(screen.getByTestId("ban-confirm"))
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Ce compte est déjà suspendu.",
      ),
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })
})
