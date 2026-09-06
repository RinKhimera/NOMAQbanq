import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import SuspendedPage, { metadata } from "@/app/(auth)/compte-suspendu/page"

vi.mock("@/lib/env/server", () => ({
  env: { SUPPORT_EMAIL: "support@test.invalid" },
}))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe("page /compte-suspendu", () => {
  it("explique, donne l'adresse de contact et ne montre aucun motif", () => {
    render(<SuspendedPage />)
    expect(
      screen.getByRole("heading", { name: "Compte suspendu" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "support@test.invalid" }),
    ).toHaveAttribute("href", "mailto:support@test.invalid")
    expect(
      screen.getByRole("link", { name: /Retour à l'accueil/ }),
    ).toHaveAttribute("href", "/")
    expect(screen.queryByText(/motif/i)).toBeNull()
  })

  it("n'est pas indexée", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
