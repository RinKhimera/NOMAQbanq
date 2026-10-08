import { act, renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { useOnline } from "@/hooks/use-online"

const Probe = () => <span>{useOnline() ? "en ligne" : "hors ligne"}</span>

describe("useOnline", () => {
  it("vaut true au rendu serveur, quel que soit le navigateur", () => {
    expect(renderToString(<Probe />)).toContain("en ligne")
  })

  it("suit les événements online / offline du navigateur", () => {
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event("offline"))
    })
    expect(result.current).toBe(false)

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event("online"))
    })
    expect(result.current).toBe(true)
  })
})
