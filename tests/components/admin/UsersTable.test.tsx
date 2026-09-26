import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type EnrichedUser,
  UsersTable,
} from "@/app/(admin)/admin/utilisateurs/_components/users-table"
import { TIER_MIN_REM } from "@/components/shared/data-table/column-visibility"

const makeUser = (overrides: Partial<EnrichedUser> = {}): EnrichedUser => ({
  id: "u1",
  name: "Hélène Martin",
  username: "helene",
  email: "helene@example.com",
  image: null,
  bio: null,
  role: "user",
  banned: false,
  createdAt: 1700000000000,
  examAccess: null,
  trainingAccess: null,
  ...overrides,
})

const users = [
  makeUser(),
  makeUser({
    id: "u2",
    name: "Paul Admin",
    username: null,
    email: "paul@example.com",
    role: "admin",
    banned: true,
  }),
]

function renderTable(props: Partial<Parameters<typeof UsersTable>[0]> = {}) {
  const onUserSelect = vi.fn()
  const onSort = vi.fn()
  render(
    <UsersTable
      users={users}
      selectedUserId={null}
      onUserSelect={onUserSelect}
      sortBy="name"
      sortOrder="asc"
      onSort={onSort}
      {...props}
    />,
  )
  return { onUserSelect, onSort }
}

const header = (name: string) =>
  screen.getByRole("columnheader", { name: new RegExp(name) })

afterEach(() => {
  localStorage.clear()
})

describe("UsersTable", () => {
  it("n'a plus de colonne de numérotation", () => {
    renderTable()

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent)
    expect(headers).toEqual([
      "Utilisateur",
      "Email",
      "Rôle",
      "Accès",
      "Inscrit",
    ])
  })

  it("Utilisateur et Accès par défaut, Rôle et Email au palier moyen, Inscrit au palier large", () => {
    renderTable()

    const medium = `@min-[${TIER_MIN_REM.medium}rem]:table-cell`
    const wide = `@min-[${TIER_MIN_REM.wide}rem]:table-cell`
    expect(header("Utilisateur")).not.toHaveClass("hidden")
    expect(header("Accès")).not.toHaveClass("hidden")
    expect(header("Rôle")).toHaveClass("hidden", medium)
    expect(header("Email")).toHaveClass("hidden", medium)
    expect(header("Inscrit")).toHaveClass("hidden", wide)
  })

  it("le menu « Colonnes » ne propose jamais de masquer l'utilisateur", async () => {
    renderTable()
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Colonnes/ }))
    const items = within(await screen.findByRole("menu"))
      .getAllByRole("menuitemcheckbox")
      .map((item) => item.textContent)

    expect(items).not.toContain("Utilisateur")
    expect(items).toEqual(
      expect.arrayContaining(["Email", "Rôle", "Accès", "Inscrit"]),
    )
  })

  it("cliquer une ligne sélectionne son utilisateur", async () => {
    const { onUserSelect } = renderTable()

    await userEvent.setup().click(screen.getByText("Paul Admin"))

    expect(onUserSelect).toHaveBeenCalledWith(users[1])
  })

  it("chaque en-tête triable trie sur son champ", async () => {
    const { onSort } = renderTable()
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Utilisateur/ }))
    await user.click(screen.getByRole("button", { name: /Rôle/ }))
    await user.click(screen.getByRole("button", { name: /Inscrit/ }))

    expect(onSort.mock.calls).toEqual([["name"], ["role"], ["createdAt"]])
  })

  it("signale un compte suspendu", () => {
    renderTable()

    const row = screen.getByText("Paul Admin").closest("tr")
    expect(row).not.toBeNull()
    expect(within(row!).getByTestId("ban-badge")).toBeInTheDocument()
  })

  it("met en évidence la ligne ouverte dans le panneau", () => {
    renderTable({ selectedUserId: "u2" })

    const open = screen.getByText("Paul Admin").closest("tr")
    const other = screen.getByText("Hélène Martin").closest("tr")
    expect(open?.className).not.toEqual(other?.className)
  })

  it("un rechargement garde les lignes, grisées", () => {
    renderTable({ isPending: true })

    expect(
      screen.getByText("Hélène Martin").closest("[aria-busy='true']"),
    ).not.toBeNull()
  })

  it("une recherche vide affiche « Aucun utilisateur trouvé », grisé pendant le rechargement", () => {
    renderTable({ users: [], isPending: true })

    expect(
      screen
        .getByText("Aucun utilisateur trouvé")
        .closest("[aria-busy='true']"),
    ).not.toBeNull()
  })

  it("rend le pied de tableau fourni", () => {
    renderTable({ footer: <p>Pagination</p> })

    expect(screen.getByText("Pagination")).toBeInTheDocument()
  })
})
