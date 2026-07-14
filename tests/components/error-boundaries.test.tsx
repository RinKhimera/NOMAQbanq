import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import AdminError from "@/app/(admin)/error"
import DashboardError from "@/app/(dashboard)/error"
import RootError from "@/app/error"

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ captureException }))

afterEach(() => {
  captureException.mockClear()
})

describe.each([
  ["racine", RootError],
  ["(dashboard)", DashboardError],
  ["(admin)", AdminError],
])("error boundary %s", (_name, Boundary) => {
  it("remonte l'erreur à Sentry au montage", () => {
    const error = Object.assign(new Error("crash rendu"), { digest: "d1" })
    render(<Boundary error={error} reset={() => {}} />)
    expect(captureException).toHaveBeenCalledWith(error)
  })
})
