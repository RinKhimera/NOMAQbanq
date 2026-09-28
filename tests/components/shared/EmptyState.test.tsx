import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Inbox } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import { EmptyState } from "@/components/ui/empty-state"

describe("EmptyState", () => {
  it.each(["default", "compact"] as const)(
    "%s : titre, description et action",
    async (size) => {
      const onClick = vi.fn()
      render(
        <EmptyState
          size={size}
          icons={[Inbox]}
          title="Aucune transaction"
          description="Les achats apparaîtront ici."
          action={{ label: "Créer", onClick }}
        />,
      )
      expect(screen.getByText("Aucune transaction")).toBeInTheDocument()
      expect(
        screen.getByText("Les achats apparaîtront ici."),
      ).toBeInTheDocument()
      await userEvent.click(screen.getByRole("button", { name: "Créer" }))
      expect(onClick).toHaveBeenCalledOnce()
    },
  )

  it("compact sans description ni icône : le titre seul", () => {
    const { container } = render(
      <EmptyState size="compact" title="Aucune activité récente" />,
    )
    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeNull()
  })

  it("rend une action libre", () => {
    render(
      <EmptyState size="compact" title="Aucun examen">
        <button type="button">Créer un examen</button>
      </EmptyState>,
    )
    expect(
      screen.getByRole("button", { name: "Créer un examen" }),
    ).toBeInTheDocument()
  })
})
