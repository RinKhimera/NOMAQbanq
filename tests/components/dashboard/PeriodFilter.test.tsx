import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PeriodFilter } from "@/app/(dashboard)/tableau-de-bord/_components/period-filter"

const replace = vi.fn()
let search = ""

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/tableau-de-bord",
  useSearchParams: () => new URLSearchParams(search),
}))

describe("PeriodFilter", () => {
  beforeEach(() => {
    search = ""
  })

  it("marque la période reçue et rend la zone filtrée", () => {
    render(<PeriodFilter value="30">contenu</PeriodFilter>)
    expect(screen.getByRole("button", { name: "30 jours" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "7 jours" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByText("contenu")).toBeInTheDocument()
  })

  it("écrit la période dans l'URL, sans défiler", async () => {
    render(<PeriodFilter value="30">contenu</PeriodFilter>)
    await userEvent.click(screen.getByRole("button", { name: "7 jours" }))
    expect(replace).toHaveBeenCalledWith("/tableau-de-bord?periode=7", {
      scroll: false,
    })
  })

  it("revenir à 30 jours retire le paramètre, les autres restent", async () => {
    search = "periode=tout&x=1"
    render(<PeriodFilter value="tout">contenu</PeriodFilter>)
    await userEvent.click(screen.getByRole("button", { name: "30 jours" }))
    expect(replace).toHaveBeenCalledWith("/tableau-de-bord?x=1", {
      scroll: false,
    })
  })

  it("la période déjà choisie ne relance rien", async () => {
    render(<PeriodFilter value="7">contenu</PeriodFilter>)
    await userEvent.click(screen.getByRole("button", { name: "7 jours" }))
    expect(replace).not.toHaveBeenCalled()
  })
})
