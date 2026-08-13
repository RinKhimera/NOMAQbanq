import { renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { useMounted } from "@/hooks/use-mounted"

const Probe = () => <span>{useMounted() ? "monté" : "non monté"}</span>

describe("useMounted", () => {
  it("vaut false au snapshot serveur (donc au rendu d'hydratation)", () => {
    expect(renderToString(<Probe />)).toContain("non monté")
  })

  it("vaut true côté client", () => {
    const { result } = renderHook(() => useMounted())
    expect(result.current).toBe(true)
  })
})
