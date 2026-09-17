import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { describe, expect, it, vi } from "vitest"
import { SiteHeader } from "@/components/shared/site-header"

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))

// `SidebarTrigger` exige `SidebarProvider` et `ThemeToggle` next-themes ;
// le sujet du test est le titre du <h1>, pas ces contrôles.
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">menu</button>,
}))
vi.mock("@/components/shared/theme-toggle", () => ({
  default: () => null,
}))

const renderTitle = (pathname: string, isAdmin = false) => {
  vi.mocked(usePathname).mockReturnValue(pathname)
  render(<SiteHeader isAdmin={isAdmin} />)
  return screen.getByRole("heading", { level: 1 }).textContent
}

describe("SiteHeader — titre étudiant", () => {
  it.each([
    ["/tableau-de-bord", "Tableau de bord"],
    ["/tableau-de-bord/examen-blanc", "Examen Blanc"],
    ["/tableau-de-bord/profil", "Profil"],
  ])("page du menu %s → « %s »", (pathname, title) => {
    expect(renderTitle(pathname)).toBe(title)
  })

  it.each([
    ["/tableau-de-bord/examen-blanc/ex_1/evaluation", "Examen Blanc"],
    ["/tableau-de-bord/examen-blanc/ex_1/resultats", "Examen Blanc"],
    ["/tableau-de-bord/entrainement/s_1", "Entraînement"],
    ["/tableau-de-bord/entrainement/s_1/resultats", "Entraînement"],
    ["/tableau-de-bord/abonnements/examen", "Abonnements"],
  ])(
    "sous-page hors menu %s garde le titre de sa section « %s »",
    (pathname, title) => {
      expect(renderTitle(pathname)).toBe(title)
    },
  )

  it.each([
    ["/tableau-de-bord/bienvenue", "Bienvenue"],
    ["/tableau-de-bord/paiement/succes", "Paiement"],
  ])("page sans lien de menu %s → « %s »", (pathname, title) => {
    expect(renderTitle(pathname)).toBe(title)
  })

  it("retombe en français sur une route inconnue, jamais « Dashboard »", () => {
    expect(renderTitle("/tableau-de-bord/inconnue")).toBe("Tableau de bord")
  })
})

describe("SiteHeader — titre admin", () => {
  it.each([
    ["/admin", "Tableau de bord"],
    ["/admin/questions/q_1/modifier", "Questions"],
    ["/admin/examens/creer", "Examens"],
    ["/admin/examens/ex_1/resultats/u_1", "Examens"],
    ["/admin/utilisateurs/u_1", "Utilisateurs"],
    ["/admin/transactions", "Transactions"],
  ])("%s → « %s »", (pathname, title) => {
    expect(renderTitle(pathname, true)).toBe(title)
  })

  it("la racine /admin ne préfixe pas la zone : route inconnue → « Administration »", () => {
    expect(renderTitle("/admin/inconnue", true)).toBe("Administration")
  })
})
