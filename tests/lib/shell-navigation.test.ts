import { describe, expect, it } from "vitest"
import { activeNavUrl, pageTitle } from "@/lib/shell-navigation"

describe("activeNavUrl", () => {
  it.each([
    ["/tableau-de-bord", "student", "/tableau-de-bord"],
    [
      "/tableau-de-bord/examen-blanc/ex_1/resultats",
      "student",
      "/tableau-de-bord/examen-blanc",
    ],
    ["/admin/utilisateurs/u_1", "admin", "/admin/utilisateurs"],
  ] as const)("%s (%s) → lien %s", (pathname, zone, url) => {
    expect(activeNavUrl(pathname, zone)).toBe(url)
  })

  it("aucun lien actif sur une page hors menu ou inconnue", () => {
    expect(activeNavUrl("/tableau-de-bord/bienvenue", "student")).toBeNull()
    expect(activeNavUrl("/admin/inconnue", "admin")).toBeNull()
  })
})

describe("pageTitle — espace étudiant", () => {
  it.each([
    ["/tableau-de-bord", "Tableau de bord"],
    ["/tableau-de-bord/examen-blanc", "Examens blancs"],
    ["/tableau-de-bord/profil", "Profil"],
  ])("page du menu %s → « %s »", (pathname, title) => {
    expect(pageTitle(pathname, "student")).toBe(title)
  })

  it.each([
    ["/tableau-de-bord/examen-blanc/ex_1/evaluation", "Examens blancs"],
    ["/tableau-de-bord/examen-blanc/ex_1/resultats", "Examens blancs"],
    ["/tableau-de-bord/entrainement/s_1", "Entraînement"],
    ["/tableau-de-bord/entrainement/s_1/resultats", "Entraînement"],
    ["/tableau-de-bord/abonnements/examen", "Abonnements"],
  ])(
    "sous-page hors menu %s garde le titre de sa section « %s »",
    (pathname, title) => {
      expect(pageTitle(pathname, "student")).toBe(title)
    },
  )

  it.each([
    ["/tableau-de-bord/bienvenue", "Bienvenue"],
    ["/tableau-de-bord/paiement/succes", "Paiement"],
  ])("page sans lien de menu %s → « %s »", (pathname, title) => {
    expect(pageTitle(pathname, "student")).toBe(title)
  })

  it("retombe sur le titre de la zone pour une route inconnue", () => {
    expect(pageTitle("/tableau-de-bord/inconnue", "student")).toBe(
      "Tableau de bord",
    )
  })
})

describe("pageTitle — administration", () => {
  it.each([
    ["/admin", "Tableau de bord"],
    ["/admin/questions/q_1/modifier", "Questions"],
    ["/admin/examens/creer", "Examens blancs"],
    ["/admin/examens/ex_1/resultats/u_1", "Examens blancs"],
    ["/admin/utilisateurs/u_1", "Utilisateurs"],
    ["/admin/transactions", "Transactions"],
    ["/admin/profil", "Profil"],
  ])("%s → « %s »", (pathname, title) => {
    expect(pageTitle(pathname, "admin")).toBe(title)
  })

  it("la racine /admin ne préfixe pas la zone : route inconnue → « Administration »", () => {
    expect(pageTitle("/admin/inconnue", "admin")).toBe("Administration")
  })
})
