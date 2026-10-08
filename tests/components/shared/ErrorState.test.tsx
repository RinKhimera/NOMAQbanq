import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ErrorState } from "@/components/shared/error-state"
import { RouteError } from "@/components/shared/route-error"

const captureException = vi.hoisted(() => vi.fn())
vi.mock("@sentry/nextjs", () => ({ captureException }))

describe("ErrorState", () => {
  it("réessai par callback", async () => {
    const onRetry = vi.fn()
    render(
      <ErrorState
        title="Chargement impossible"
        description="Vérifiez votre connexion, puis réessayez."
        onRetry={onRetry}
      />,
    )
    expect(screen.getByText("Chargement impossible")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("réessai par lien", () => {
    render(
      <ErrorState
        title="Impossible de charger vos statistiques"
        retryHref="/tableau-de-bord"
      />,
    )
    expect(screen.getByRole("link", { name: "Réessayer" })).toHaveAttribute(
      "href",
      "/tableau-de-bord",
    )
  })

  it("actions secondaires et note", () => {
    render(
      <ErrorState
        title="Erreur"
        actions={<button type="button">Accueil</button>}
        footnote="Si le problème persiste, contactez le support."
      />,
    )
    expect(screen.getByRole("button", { name: "Accueil" })).toBeInTheDocument()
    expect(
      screen.getByText("Si le problème persiste, contactez le support."),
    ).toBeInTheDocument()
  })
})

describe("RouteError", () => {
  it("signale l'erreur à Sentry et propose de réessayer", async () => {
    const error = Object.assign(new Error("boom"), { digest: "d1" })
    const reset = vi.fn()
    render(<RouteError error={error} reset={reset} title="Oups" />)
    expect(captureException).toHaveBeenCalledWith(error)
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
