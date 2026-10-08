import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  it("ne suit la valeur qu'après le délai, en ne gardant que la dernière", () => {
    const onSettle = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300, onSettle),
      { initialProps: { value: "" } },
    )
    act(() => vi.advanceTimersByTime(300))
    onSettle.mockClear()

    rerender({ value: "pa" })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: "paul" })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe("")
    expect(onSettle).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe("paul")
    expect(onSettle).toHaveBeenCalledExactlyOnceWith("paul")
  })
})
