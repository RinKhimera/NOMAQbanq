import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { KeysetPagination } from "@/components/shared/data-table/keyset-pagination"

describe("KeysetPagination", () => {
  it("sans total : « lignes 11–20 », sans numéros de page", () => {
    render(
      <KeysetPagination
        firstIndex={10}
        count={10}
        pageSize={10}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByText("lignes 11–20")).toBeInTheDocument()
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument()
  })

  it("Précédent / Suivant désactivés au bord de la liste", () => {
    const onNext = vi.fn()
    render(
      <KeysetPagination
        firstIndex={0}
        count={4}
        pageSize={10}
        onNext={onNext}
      />,
    )
    expect(screen.getByRole("button", { name: /précédent/i })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /suivant/i }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it("avec total : « 21–40 sur 153 clients » et « 2 / 8 »", () => {
    render(
      <KeysetPagination
        firstIndex={20}
        count={20}
        total={153}
        pageSize={20}
        noun={{ one: "client", many: "clients" }}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByText("21–40 sur 153 clients")).toBeInTheDocument()
    expect(screen.getByText("2 / 8")).toBeInTheDocument()
    // Flèches seules, nommées pour un lecteur d'écran.
    expect(
      screen.getByRole("button", { name: "Page précédente" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Page suivante" }),
    ).toHaveTextContent("")
  })

  it("une seule page : ni boutons ni « page / pages »", () => {
    render(
      <KeysetPagination
        firstIndex={0}
        count={1}
        total={1}
        pageSize={20}
        noun={{ one: "client", many: "clients" }}
      />,
    )
    expect(screen.getByText("1–1 sur 1 client")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("rechargement en cours : boutons désactivés", () => {
    render(
      <KeysetPagination
        firstIndex={10}
        count={10}
        pageSize={10}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isPending
      />,
    )
    for (const button of screen.getAllByRole("button"))
      expect(button).toBeDisabled()
  })
})
