import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Spinner } from "@/components/ui/spinner"

describe("Spinner", () => {
  it("expose un role status et un libellé lecteur d'écran", () => {
    render(<Spinner />)
    const status = screen.getByRole("status")
    expect(status).toBeInTheDocument()
    expect(screen.getByText("Chargement…")).toBeInTheDocument()
  })

  it("accepte un libellé personnalisé", () => {
    render(<Spinner label="Envoi en cours…" />)
    expect(screen.getByText("Envoi en cours…")).toBeInTheDocument()
  })

  it("applique la taille demandée", () => {
    const { rerender } = render(<Spinner size="sm" />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass("size-4")

    rerender(<Spinner size="lg" />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass("size-8")
  })

  it("désactive l'animation quand le mouvement est réduit", () => {
    render(<Spinner />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass(
      "motion-reduce:animate-none",
    )
  })

  it("fusionne les classes fournies par l'appelant", () => {
    render(<Spinner className="text-white" />)
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass(
      "text-white",
    )
  })
})
