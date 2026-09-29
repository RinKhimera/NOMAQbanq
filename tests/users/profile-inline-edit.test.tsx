import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { InlineEditField } from "@/app/(dashboard)/tableau-de-bord/profil/_components/inline-edit-field"
import { ProfilePreferences } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-preferences"
import { nameSchema } from "@/features/users/schemas"

const setTheme = vi.fn()
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme }),
}))

const field = (onSave = vi.fn().mockResolvedValue({ success: true })) =>
  render(
    <InlineEditField
      testId="profile-field-name"
      label="Nom complet"
      value="Amina Diallo"
      schema={nameSchema}
      onSave={onSave}
    />,
  )

describe("InlineEditField", () => {
  it("Annuler rend le focus au crayon, sans enregistrer", async () => {
    const onSave = vi.fn()
    field(onSave)
    await userEvent.click(screen.getByTestId("profile-field-name-edit"))
    expect(screen.getByTestId("profile-field-name-input")).toHaveFocus()
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(screen.getByTestId("profile-field-name-edit")).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("Échap annule aussi et rend le focus au crayon", async () => {
    field()
    await userEvent.click(screen.getByTestId("profile-field-name-edit"))
    await userEvent.keyboard("{Escape}")
    expect(screen.getByTestId("profile-field-name-edit")).toHaveFocus()
  })

  it("enregistre la nouvelle valeur, puis rend le focus au crayon", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true })
    field(onSave)
    await userEvent.click(screen.getByTestId("profile-field-name-edit"))
    const input = screen.getByTestId("profile-field-name-input")
    await userEvent.clear(input)
    await userEvent.type(input, "Amina D{Enter}")
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Amina D"))
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-name-edit")).toHaveFocus(),
    )
  })

  it("une erreur serveur reste affichée et liée au champ", async () => {
    field(vi.fn().mockResolvedValue({ success: false, error: "Nom refusé" }))
    await userEvent.click(screen.getByTestId("profile-field-name-edit"))
    await userEvent.type(
      screen.getByTestId("profile-field-name-input"),
      " X{Enter}",
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("Nom refusé")
    expect(screen.getByTestId("profile-field-name-input")).toHaveAttribute(
      "aria-describedby",
      "profile-field-name-error",
    )
  })
})

describe("InlineEditField — pendant l'enregistrement", () => {
  it("ni Entrée ni Échap ni Annuler n'agissent tant que la sauvegarde court", async () => {
    let settle: (r: { success: boolean }) => void = () => {}
    const onSave = vi.fn(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          settle = resolve
        }),
    )
    field(onSave)
    await userEvent.click(screen.getByTestId("profile-field-name-edit"))
    await userEvent.type(
      screen.getByTestId("profile-field-name-input"),
      " D{Enter}",
    )
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{Escape}")
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("profile-field-name-input")).toBeInTheDocument()
    settle({ success: true })
    await waitFor(() =>
      expect(screen.getByTestId("profile-field-name-edit")).toHaveFocus(),
    )
  })
})

describe("ProfilePreferences", () => {
  it("reflète le thème choisi et le change au clic", async () => {
    render(<ProfilePreferences />)
    expect(screen.getByRole("button", { name: "Sombre" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await userEvent.click(screen.getByRole("button", { name: "Auto" }))
    expect(setTheme).toHaveBeenCalledWith("system")
  })
})
