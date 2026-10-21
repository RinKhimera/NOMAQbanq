import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import {
  ExamSessionDemo,
  SeriesComposerDemo,
} from "@/app/(marketing)/fonctionnement/_components/demos"

describe("SeriesComposerDemo", () => {
  const domains = () => within(screen.getByRole("group", { name: "Domaines" }))
  const sizes = () =>
    within(screen.getByRole("group", { name: "Nombre de questions" }))

  it("part de deux domaines présélectionnés et 20 questions", () => {
    render(<SeriesComposerDemo />)

    expect(
      domains().getByRole("button", { name: "Cardiologie" }),
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      domains().getByRole("button", { name: "Pédiatrie" }),
    ).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("20 questions · 2 domaines")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Commencer" })).toHaveAttribute(
      "href",
      "/inscription",
    )
  })

  it("un clic ajoute ou retire un domaine, la taille se choisit", async () => {
    const user = userEvent.setup()
    render(<SeriesComposerDemo />)

    await user.click(domains().getByRole("button", { name: "Neurologie" }))
    await user.click(sizes().getByRole("button", { name: "50" }))

    expect(
      domains().getByRole("button", { name: "Neurologie" }),
    ).toHaveAttribute("aria-pressed", "false")
    expect(sizes().getByRole("button", { name: "50" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(sizes().getByRole("button", { name: "20" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByText("50 questions · 1 domaine")).toBeInTheDocument()

    await user.click(domains().getByRole("button", { name: "Pédiatrie" }))
    expect(screen.getByText("50 questions · 2 domaines")).toBeInTheDocument()
  })

  it("sans domaine, « Commencer » est désactivé et ne mène nulle part", async () => {
    const user = userEvent.setup()
    render(<SeriesComposerDemo />)

    await user.click(domains().getByRole("button", { name: "Cardiologie" }))
    await user.click(domains().getByRole("button", { name: "Neurologie" }))

    expect(screen.getByText("20 questions · 0 domaine")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Commencer" })).toBeDisabled()
  })
})

describe("ExamSessionDemo", () => {
  it("une case du navigateur devient la question courante de la barre", async () => {
    const user = userEvent.setup()
    render(<ExamSessionDemo />)

    expect(screen.getByText("14 / 40")).toBeInTheDocument()

    const target = screen.getByRole("button", { name: /^Question 2,/ })
    await user.click(target)

    expect(screen.getByText("2 / 40")).toBeInTheDocument()
    expect(target).toHaveAttribute("aria-current", "step")
  })
})
