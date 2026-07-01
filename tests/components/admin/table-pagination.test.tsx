import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TablePagination } from "@/components/admin/table-pagination"

describe("TablePagination", () => {
  const base = {
    page: 1,
    pageSize: 50,
    total: 240,
    onPageChange: vi.fn(),
    itemNoun: { one: "question", many: "questions" },
  }

  it("affiche le compteur X–Y sur N", () => {
    render(<TablePagination {...base} />)
    expect(screen.getByText(/1–50 sur 240 questions/i)).toBeInTheDocument()
  })

  it("appelle onPageChange au clic sur un numéro", () => {
    const onPageChange = vi.fn()
    render(<TablePagination {...base} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole("button", { name: "2" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("désactive Précédent sur la première page", () => {
    render(<TablePagination {...base} page={1} />)
    expect(screen.getByRole("button", { name: /précédent/i })).toBeDisabled()
  })

  it("ne rend pas les contrôles de page quand une seule page", () => {
    render(<TablePagination {...base} total={30} pageSize={50} />)
    expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument()
    expect(screen.getByText(/1–30 sur 30 questions/i)).toBeInTheDocument()
  })
})
