import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { SearchInput } from "@/components/shared/search-input"

describe("SearchInput", () => {
  it("transmet la saisie, champ nommé par son placeholder", async () => {
    const onValueChange = vi.fn()
    const Harness = () => {
      const [value, setValue] = useState("")
      return (
        <SearchInput
          placeholder="Rechercher par titre..."
          value={value}
          onValueChange={(v) => {
            setValue(v)
            onValueChange(v)
          }}
        />
      )
    }
    render(<Harness />)
    await userEvent.type(
      screen.getByRole("textbox", { name: "Rechercher par titre..." }),
      "ab",
    )
    expect(onValueChange).toHaveBeenLastCalledWith("ab")
  })

  it("annonce une recherche en cours", () => {
    render(
      <SearchInput
        placeholder="Rechercher"
        value="pa"
        onValueChange={vi.fn()}
        isSearching
      />,
    )
    expect(screen.getByRole("status")).toBeInTheDocument()
  })
})
