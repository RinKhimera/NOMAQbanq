import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProgressionListClient } from "@/app/(admin)/admin/progression/_components/progression-list-client"
import {
  DEFAULT_PROGRESSION_LIST,
  type ProgressionListState,
} from "@/app/(admin)/admin/progression/_components/progression-params"
import type { StudentProgressPage } from "@/features/analytics/dal.admin-progression"

const { replace, push } = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
  usePathname: () => "/admin/progression",
}))

const empty: StudentProgressPage = { items: [], total: 0 }

const filtered: ProgressionListState = {
  ...DEFAULT_PROGRESSION_LIST,
  access: "expired",
  activeOnly: true,
  period: "7",
}

/** Les props d'un retour serveur. */
const client = (state: ProgressionListState, page = empty) => (
  <ProgressionListClient state={state} page={page} />
)

const urls = () => replace.mock.calls.map(([url]) => url)

describe("ProgressionListClient — serveur lent", () => {
  it("« Effacer les filtres » après une recherche ne rétablit pas les filtres effacés", () => {
    vi.useFakeTimers()
    const { rerender } = render(client(filtered))
    fireEvent.change(screen.getByPlaceholderText("Nom ou courriel…"), {
      target: { value: "awa" },
    })
    act(() => vi.advanceTimersByTime(300))
    rerender(client({ ...filtered, q: "awa" }))

    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }))
    act(() => vi.advanceTimersByTime(2000))

    expect(urls()).toEqual([
      "/admin/progression?q=awa&acces=expire&actifs=1&periode=7",
      "/admin/progression?periode=7",
    ])
  })

  it("deux changements pendant un rechargement : le second garde le premier", () => {
    render(client(DEFAULT_PROGRESSION_LIST))
    fireEvent.click(screen.getByTestId("filter-active-only"))
    fireEvent.click(screen.getByTestId("period-tout"))

    expect(urls()).toEqual([
      "/admin/progression?actifs=1",
      "/admin/progression?actifs=1&periode=tout",
    ])
  })
})
