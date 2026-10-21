import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DomainPlan } from "@/app/(admin)/admin/examens/[id]/questions/_components/domain-plan"
import type { DomainPlanRow } from "@/features/questions/dal"

const ROWS: DomainPlanRow[] = [
  { domain: "Cardiologie", chosen: 4, available: 1234, recent: 2 },
  { domain: "Pédiatrie", chosen: 0, available: 50, recent: 0 },
]

const matchWidth = (wide: boolean) =>
  vi
    .spyOn(window, "matchMedia")
    .mockReturnValue({ matches: wide } as MediaQueryList)

const renderPlan = (activeDomain = "") => {
  const onPickDomain = vi.fn()
  render(
    <DomainPlan
      rows={ROWS}
      activeDomain={activeDomain}
      onPickDomain={onPickDomain}
    />,
  )
  return { onPickDomain }
}

const toggleButton = () =>
  screen.getByRole("button", { name: /Plan par domaine/ })

describe("DomainPlan", () => {
  it("une ligne par domaine, nombres formatés, domaine actif marqué", () => {
    renderPlan("Cardiologie")
    const rows = screen.getAllByTestId("composer-plan-row")
    expect(rows).toHaveLength(2)
    const cells = within(rows[0])
      .getAllByRole("cell")
      .map((c) => c.textContent)
    expect(cells.slice(0, 2)).toEqual(["Cardiologie", "4"])
    expect(cells[2]).toMatch(/^1\s234$/)
    expect(cells[3]).toBe("2")
    expect(rows[0]).toHaveAttribute("aria-current", "true")
    expect(rows[1]).not.toHaveAttribute("aria-current")
  })

  it("clic, Entrée ou Espace sur une ligne filtre la banque par ce domaine", () => {
    const { onPickDomain } = renderPlan()
    const [cardio, pedia] = screen.getAllByTestId("composer-plan-row")
    fireEvent.click(cardio)
    fireEvent.keyDown(pedia, { key: "Enter" })
    fireEvent.keyDown(pedia, { key: " " })
    fireEvent.keyDown(pedia, { key: "a" })
    expect(onPickDomain.mock.calls).toEqual([
      ["Cardiologie"],
      ["Pédiatrie"],
      ["Pédiatrie"],
    ])
  })

  it("avant le premier clic, la largeur décide ; le clic replie un plan ouvert en large", () => {
    matchWidth(true)
    renderPlan()
    const table = document.getElementById("composer-domain-plan-table")
    expect(toggleButton()).not.toHaveAttribute("aria-expanded")
    expect(table).toHaveClass("max-lg:hidden")

    fireEvent.click(toggleButton())
    expect(toggleButton()).toHaveAttribute("aria-expanded", "false")
    expect(table).toHaveClass("hidden")

    fireEvent.click(toggleButton())
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true")
    expect(table).not.toHaveClass("hidden")
  })

  it("en étroit, le premier clic déplie le plan replié", () => {
    matchWidth(false)
    renderPlan()
    fireEvent.click(toggleButton())
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true")
  })
})
