import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import FaqPageClient from "@/app/(marketing)/faq/_components/faq-page-client"
import type { FaqCategory } from "@/app/(marketing)/faq/_data/faq-data"

vi.mock("@/app/(marketing)/faq/_data/faq-data", () => ({
  faqCategories: [
    {
      id: "examen",
      title: "Examen",
      questions: [
        { q: "Combien de temps dure l'examen ?", a: "Trois heures." },
        { q: "Peut-on le passer en français ?", a: "Oui, en français." },
      ],
    },
    {
      id: "tarifs",
      title: "Tarifs",
      questions: [{ q: "Quel est le prix ?", a: "Voir la page Tarifs." }],
    },
  ] satisfies FaqCategory[],
}))

const categoryHeadings = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)

const search = (user: ReturnType<typeof userEvent.setup>, text: string) =>
  user.type(
    screen.getByRole("textbox", { name: "Rechercher une question" }),
    text,
  )

const question = (name: string) => screen.getByRole("button", { name })

describe("FaqPageClient", () => {
  it("sans recherche, montre toutes les catégories, réponses fermées", () => {
    render(<FaqPageClient />)

    expect(categoryHeadings()).toEqual(["Examen", "Tarifs"])
    expect(question("Combien de temps dure l'examen ?")).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(screen.queryByText(/résultat/)).not.toBeInTheDocument()
  })

  it("la recherche ignore les accents, compte les résultats et rouvre la première réponse", async () => {
    const user = userEvent.setup()
    render(<FaqPageClient />)

    await search(user, "francais")

    expect(categoryHeadings()).toEqual(["Examen"])
    expect(
      screen.queryByRole("button", {
        name: "Combien de temps dure l'examen ?",
      }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("1 résultat pour « francais »")).toBeInTheDocument()
    expect(question("Peut-on le passer en français ?")).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("une recherche qui change rouvre la première réponse de la nouvelle liste", async () => {
    const user = userEvent.setup()
    render(<FaqPageClient />)

    await search(user, "e")
    expect(screen.getByText("3 résultats pour « e »")).toBeInTheDocument()
    await user.click(question("Combien de temps dure l'examen ?"))
    expect(question("Combien de temps dure l'examen ?")).toHaveAttribute(
      "aria-expanded",
      "false",
    )

    await search(user, "x")

    expect(screen.getByText("1 résultat pour « ex »")).toBeInTheDocument()
    expect(question("Combien de temps dure l'examen ?")).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("une catégorie restreint la liste, sommaire et pastilles synchronisés", async () => {
    const user = userEvent.setup()
    render(<FaqPageClient />)

    const chips = within(screen.getByRole("group", { name: "Catégories" }))
    await user.click(chips.getByRole("button", { name: "Tarifs" }))

    expect(categoryHeadings()).toEqual(["Tarifs"])
    expect(chips.getByRole("button", { name: "Tarifs" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    const sidebar = within(
      screen.getByRole("navigation", { name: "Catégories" }),
    )
    expect(sidebar.getByRole("button", { name: /^Tarifs/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(sidebar.getByRole("button", { name: /^Toutes/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("sans correspondance, renvoie vers l'adresse de contact", async () => {
    const user = userEvent.setup()
    render(<FaqPageClient />)

    await search(user, "zzz")

    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0)
    expect(screen.getByText("0 résultat pour « zzz »")).toBeInTheDocument()
    expect(screen.getByText(/Aucune question ne correspond/)).toContainElement(
      screen.getByRole("link", { name: "nomaqbanq@outlook.com" }),
    )
  })
})
