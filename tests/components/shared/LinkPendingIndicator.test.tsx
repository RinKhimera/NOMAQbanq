import { render, screen } from "@testing-library/react"
import { useLinkStatus } from "next/link"
import { describe, expect, it, vi } from "vitest"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"

vi.mock("next/link", () => ({ useLinkStatus: vi.fn() }))

describe("LinkPendingIndicator", () => {
  it("ne rend rien tant que le lien n'est pas en attente", () => {
    vi.mocked(useLinkStatus).mockReturnValue({ pending: false })

    render(<LinkPendingIndicator />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("rend le spinner du socle pendant la navigation", () => {
    vi.mocked(useLinkStatus).mockReturnValue({ pending: true })

    render(<LinkPendingIndicator />)

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ouverture de la page…",
    )
  })
})
