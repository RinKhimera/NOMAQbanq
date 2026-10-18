import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_USER_LIST,
  type UserListState,
} from "@/app/(admin)/admin/utilisateurs/_components/user-params"
import { UsersClient } from "@/app/(admin)/admin/utilisateurs/_components/users-client"
import type { AdminUsersPage } from "@/features/users/dal"

const { replace, push } = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
  usePathname: () => "/admin/utilisateurs",
}))
vi.mock("@/features/users/actions", () => ({ loadUsersForExport: vi.fn() }))

const NOW = Date.UTC(2026, 9, 18)

const empty: AdminUsersPage = {
  items: [],
  total: 0,
  segmentCounts: { all: 0, active: 0, expiring: 0, expired: 0, never: 0 },
}

const filtered: UserListState = {
  ...DEFAULT_USER_LIST,
  role: "user",
  suspended: true,
}

/** Les props d'un retour serveur. */
const client = (state: UserListState) => (
  <UsersClient
    state={state}
    page={empty}
    headline={{ total: 0, newLast30Days: 0 }}
    initialNow={NOW}
  />
)

const urls = () => replace.mock.calls.map(([url]) => url)

describe("UsersClient — serveur lent", () => {
  it("« Effacer les filtres » après une recherche ne rétablit pas les filtres effacés", () => {
    vi.useFakeTimers()
    const { rerender } = render(client(filtered))
    fireEvent.change(screen.getByPlaceholderText(/Retrouver un compte/), {
      target: { value: "awa" },
    })
    act(() => vi.advanceTimersByTime(300))
    rerender(client({ ...filtered, q: "awa" }))

    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }))
    act(() => vi.advanceTimersByTime(2000))

    expect(urls()).toEqual([
      "/admin/utilisateurs?q=awa&role=etudiants&suspendus=1",
      "/admin/utilisateurs",
    ])
  })

  it("deux changements pendant un rechargement : le second garde le premier", () => {
    render(client(DEFAULT_USER_LIST))
    fireEvent.click(screen.getByTestId("filter-suspended"))
    fireEvent.click(screen.getByTestId("segment-never"))

    expect(urls()).toEqual([
      "/admin/utilisateurs?suspendus=1",
      "/admin/utilisateurs?suspendus=1&segment=jamais",
    ])
  })
})
