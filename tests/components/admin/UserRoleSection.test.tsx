import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserRoleSection } from "@/app/(admin)/admin/utilisateurs/[id]/_components/user-role-section"

const mocks = vi.hoisted(() => ({
  updateUserRole: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/features/users/actions", () => ({
  updateUserRole: mocks.updateUserRole,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
const baseUser = {
  id: "user-1",
  name: "Marie Curie",
  email: "marie@exemple.com",
  role: "user" as const,
  banned: false,
}

beforeEach(() => {
  mocks.updateUserRole.mockResolvedValue({ success: true })
})

describe("UserRoleSection", () => {
  it.each([
    ["user", "Promouvoir administrateur", "admin"],
    ["admin", "Retirer le rôle administrateur", "user"],
  ] as const)(
    "rôle %s : bouton « %s », la confirmation demande role=%s",
    async (role, label, requested) => {
      render(
        <UserRoleSection
          user={{ ...baseUser, role }}
          currentUserId="viewer-1"
        />,
      )
      expect(screen.getByTestId("role-toggle-open")).toHaveTextContent(label)

      fireEvent.click(screen.getByTestId("role-toggle-open"))
      fireEvent.click(screen.getByTestId("role-toggle-confirm"))
      await waitFor(() =>
        expect(mocks.updateUserRole).toHaveBeenCalledWith({
          userId: "user-1",
          role: requested,
        }),
      )
    },
  )

  it.each([
    [
      "sa propre fiche",
      { currentUserId: baseUser.id, banned: false },
      "role-self-note",
      "Vous ne pouvez pas modifier votre propre rôle",
    ],
    [
      "compte suspendu",
      { currentUserId: "viewer-1", banned: true },
      "role-banned-note",
      "Levez d'abord la suspension de ce compte.",
    ],
  ])(
    "%s : bouton indisponible, avec son explication",
    (_, { currentUserId, banned }, noteTestId, note) => {
      render(
        <UserRoleSection
          user={{ ...baseUser, banned }}
          currentUserId={currentUserId}
        />,
      )
      expect(screen.getByTestId("role-toggle-open")).toBeDisabled()
      expect(screen.getByTestId(noteTestId)).toHaveTextContent(note)
    },
  )

  it("confirme la promotion : dialog avec nom + email, refresh et toast", async () => {
    render(<UserRoleSection user={baseUser} currentUserId="viewer-1" />)
    fireEvent.click(screen.getByTestId("role-toggle-open"))
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Marie Curie")
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "marie@exemple.com",
    )
    fireEvent.click(screen.getByTestId("role-toggle-confirm"))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Rôle administrateur accordé",
    )
  })

  it("affiche le toast d'erreur et n'appelle pas refresh quand l'action échoue", async () => {
    mocks.updateUserRole.mockResolvedValue({
      success: false,
      error: "Utilisateur introuvable.",
    })
    render(<UserRoleSection user={baseUser} currentUserId="viewer-1" />)
    fireEvent.click(screen.getByTestId("role-toggle-open"))
    fireEvent.click(screen.getByTestId("role-toggle-confirm"))
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Utilisateur introuvable."),
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })
})
