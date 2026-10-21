import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StudentProgressNav } from "@/app/(admin)/admin/progression/[id]/_components/student-progress-nav"
import {
  DEFAULT_PROGRESSION_LIST,
  type ProgressionListState,
} from "@/app/(admin)/admin/progression/_components/progression-params"

const list: ProgressionListState = {
  ...DEFAULT_PROGRESSION_LIST,
  access: "expired",
  page: 2,
}

const LIST_HREF = "/admin/progression?acces=expire&page=2"

const neighbor = (name: string) =>
  screen.getByRole("link", { name }) as HTMLAnchorElement

describe("StudentProgressNav", () => {
  it("fil d'Ariane : retour au tableau d'origine, nom de l'étudiant en page courante", () => {
    render(
      <StudentProgressNav
        name="Awa Diallo"
        list={list}
        neighbors={null}
        listHref={LIST_HREF}
      />,
    )

    const crumbs = screen.getByRole("navigation", { name: "Fil d'Ariane" })
    expect(crumbs.querySelector("a")).toHaveAttribute("href", LIST_HREF)
    expect(crumbs.querySelector("[aria-current='page']")).toHaveTextContent(
      "Awa Diallo",
    )
  })

  it("dans la liste : voisins liés à la page du tableau qui les contient, filtres gardés", () => {
    render(
      <StudentProgressNav
        name="Awa Diallo"
        list={list}
        neighbors={{
          position: 21,
          total: 1234,
          previousId: "prev-id",
          nextId: "next-id",
        }}
        listHref={LIST_HREF}
      />,
    )

    // Position 21 en page 2 : le précédent (20) retombe en page 1, le suivant
    // (22) reste en page 2.
    expect(neighbor("Étudiant précédent")).toHaveAttribute(
      "href",
      "/admin/progression/prev-id?acces=expire&liste=1",
    )
    expect(neighbor("Étudiant suivant")).toHaveAttribute(
      "href",
      "/admin/progression/next-id?acces=expire&page=2&liste=1",
    )
    expect(screen.getByTestId("student-position")).toHaveTextContent(
      /^21 sur 1\s234$/,
    )
  })

  it("premier de la liste : « précédent » est un bouton désactivé, pas un lien", () => {
    render(
      <StudentProgressNav
        name="Awa Diallo"
        list={list}
        neighbors={{ position: 1, total: 3, previousId: null, nextId: "b" }}
        listHref={LIST_HREF}
      />,
    )

    expect(
      screen.queryByRole("link", { name: "Étudiant précédent" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Étudiant précédent" }),
    ).toBeDisabled()
    expect(neighbor("Étudiant suivant")).toBeInTheDocument()
  })

  it("dernier de la liste : « suivant » est désactivé", () => {
    render(
      <StudentProgressNav
        name="Awa Diallo"
        list={list}
        neighbors={{ position: 3, total: 3, previousId: "b", nextId: null }}
        listHref={LIST_HREF}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Étudiant suivant" }),
    ).toBeDisabled()
    expect(neighbor("Étudiant précédent")).toBeInTheDocument()
  })

  it("hors de la liste filtrée : ni flèches ni position", () => {
    render(
      <StudentProgressNav
        name="Awa Diallo"
        list={list}
        neighbors={null}
        listHref={LIST_HREF}
      />,
    )

    expect(screen.getByTestId("student-position")).toHaveTextContent(
      "Hors de la liste filtrée",
    )
    expect(
      screen.queryByRole("navigation", {
        name: "Étudiant précédent ou suivant",
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Étudiant suivant/)).not.toBeInTheDocument()
  })

  it("« Voir la fiche » seulement quand la page ne la porte pas elle-même", () => {
    const { rerender } = render(
      <StudentProgressNav
        name="Awa Diallo"
        list={list}
        neighbors={null}
        listHref={LIST_HREF}
        ficheHref="/admin/utilisateurs/u-1"
      />,
    )
    expect(screen.getByRole("link", { name: "Voir la fiche" })).toHaveAttribute(
      "href",
      "/admin/utilisateurs/u-1",
    )
    expect(
      screen.getByRole("link", { name: "Retour à la liste" }),
    ).toHaveAttribute("href", LIST_HREF)

    rerender(
      <StudentProgressNav
        name="Awa Diallo"
        list={list}
        neighbors={null}
        listHref={LIST_HREF}
      />,
    )
    expect(
      screen.queryByRole("link", { name: "Voir la fiche" }),
    ).not.toBeInTheDocument()
  })
})
