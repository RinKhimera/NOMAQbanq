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
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

const baseUser = {
  id: "user-1",
  name: "Marie Curie",
  email: "marie@exemple.com",
  role: "user" as const,
}

beforeEach(() => {
  mocks.updateUserRole.mockReset()
  mocks.refresh.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  mocks.updateUserRole.mockResolvedValue({ success: true })
})

describe("UserRoleSection", () => {
  it("affiche « Promouvoir administrateur » pour un utilisateur simple", () => {
    render(<UserRoleSection user={baseUser} currentUserId="viewer-1" />)
    expect(screen.getByTestId("role-toggle-open")).toHaveTextContent(
      "Promouvoir administrateur",
    )
  })

  it("affiche « Retirer le rôle administrateur » pour un admin", () => {
    render(
      <UserRoleSection
        user={{ ...baseUser, role: "admin" }}
        currentUserId="viewer-1"
      />,
    )
    expect(screen.getByTestId("role-toggle-open")).toHaveTextContent(
      "Retirer le rôle administrateur",
    )
  })

  it("masque le bouton sur sa propre fiche et affiche la note", () => {
    render(<UserRoleSection user={baseUser} currentUserId={baseUser.id} />)
    expect(screen.queryByTestId("role-toggle-open")).toBeNull()
    expect(screen.getByTestId("role-self-note")).toHaveTextContent(
      "Vous ne pouvez pas modifier votre propre rôle",
    )
  })

  it("confirme la promotion : dialog avec nom + email, appel action, refresh", async () => {
    render(<UserRoleSection user={baseUser} currentUserId="viewer-1" />)
    fireEvent.click(screen.getByTestId("role-toggle-open"))
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Marie Curie")
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "marie@exemple.com",
    )
    fireEvent.click(screen.getByTestId("role-toggle-confirm"))
    await waitFor(() =>
      expect(mocks.updateUserRole).toHaveBeenCalledWith({
        userId: "user-1",
        role: "admin",
      }),
    )
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Utilisateur promu administrateur.",
    )
  })

  it("demande role=user pour rétrograder un admin", async () => {
    render(
      <UserRoleSection
        user={{ ...baseUser, role: "admin" }}
        currentUserId="viewer-1"
      />,
    )
    fireEvent.click(screen.getByTestId("role-toggle-open"))
    fireEvent.click(screen.getByTestId("role-toggle-confirm"))
    await waitFor(() =>
      expect(mocks.updateUserRole).toHaveBeenCalledWith({
        userId: "user-1",
        role: "user",
      }),
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
