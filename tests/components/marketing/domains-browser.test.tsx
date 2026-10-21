import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { DomainsBrowser } from "@/app/(marketing)/domaines/_components/domains-browser"
import { DOMAINS, DOMAIN_GROUPS } from "@/constants/domains"

const countIn = (groupId: string) =>
  DOMAINS.filter((d) => d.group.id === groupId).length

const groupHeadings = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)

const pill = (name: string) =>
  within(screen.getByRole("group", { name: "Groupes de domaines" })).getByRole(
    "button",
    { name },
  )

const search = (user: ReturnType<typeof userEvent.setup>, text: string) =>
  user.type(
    screen.getByRole("textbox", { name: "Rechercher un domaine" }),
    text,
  )

describe("DomainsBrowser", () => {
  it("affiche tous les groupes avec leur nombre de domaines", () => {
    render(<DomainsBrowser />)

    expect(groupHeadings()).toEqual(DOMAIN_GROUPS.map((g) => g.label))
    expect(screen.getByText(`${countIn("med")} domaines`)).toBeInTheDocument()
    expect(pill("Tous")).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.queryByText(/Aucun domaine ne correspond/),
    ).not.toBeInTheDocument()
  })

  it("la recherche ignore les accents et masque les groupes vides", async () => {
    const user = userEvent.setup()
    render(<DomainsBrowser />)

    await search(user, "enterologie")

    expect(groupHeadings()).toEqual(["Médecine"])
    expect(screen.getByText("1 domaine")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Gastro-entérologie/ }),
    ).toHaveAttribute("href", "/domaines/gastro-enterologie")
  })

  it("une pastille de groupe ne garde que ce groupe", async () => {
    const user = userEvent.setup()
    render(<DomainsBrowser />)

    await user.click(pill("Mère et enfant"))

    expect(groupHeadings()).toEqual(["Mère et enfant"])
    expect(screen.getAllByRole("link")).toHaveLength(countIn("me"))
    expect(pill("Mère et enfant")).toHaveAttribute("aria-pressed", "true")
    expect(pill("Tous")).toHaveAttribute("aria-pressed", "false")
  })

  it("sans correspondance, l'état vide reprend la saisie", async () => {
    const user = userEvent.setup()
    render(<DomainsBrowser />)

    await search(user, "  xyz ")

    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0)
    // getByText normalise les espaces : seul textContent prouve le trim.
    expect(screen.getByText(/Aucun domaine ne correspond/).textContent).toBe(
      "Aucun domaine ne correspond à « xyz ».",
    )
  })
})
