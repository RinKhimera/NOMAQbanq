import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Spinner } from "@/components/ui/spinner"

const svg = () => screen.getByRole("status").querySelector("svg")

describe("Spinner", () => {
  it.each([
    [undefined, "Chargement…"],
    ["Envoi en cours…", "Envoi en cours…"],
  ])("rôle status annoncé avec le libellé %s → « %s »", (label, announced) => {
    render(<Spinner label={label} />)
    expect(screen.getByRole("status")).toHaveTextContent(announced)
  })

  it.each([
    ["sm", "size-4"],
    ["md", "size-5"],
    ["lg", "size-8"],
  ] as const)("taille %s → %s", (size, sizeClass) => {
    render(<Spinner size={size} />)
    expect(svg()).toHaveClass(sizeClass)
  })

  it("coupe l'animation en mouvement réduit et fusionne les classes de l'appelant", () => {
    render(<Spinner className="text-white" />)
    expect(svg()).toHaveClass("motion-reduce:animate-none", "text-white")
  })
})
