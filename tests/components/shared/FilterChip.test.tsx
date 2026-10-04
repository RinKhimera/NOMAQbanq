import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FilterChip } from "@/components/shared/filter-chip"

describe("FilterChip", () => {
  it("se retire par son bouton nommé", async () => {
    const onRemove = vi.fn()
    render(
      <FilterChip onRemove={onRemove} removeLabel="Retirer Dyspnée">
        Dyspnée
      </FilterChip>,
    )
    expect(screen.getByText("Dyspnée")).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Retirer Dyspnée" }),
    )
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it("désactivée, ne se retire pas", () => {
    render(
      <FilterChip onRemove={vi.fn()} removeLabel="Retirer Paul" disabled>
        Paul
      </FilterChip>,
    )
    expect(screen.getByRole("button", { name: "Retirer Paul" })).toBeDisabled()
  })
})
