import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useFirstChangeGuard } from "@/app/(admin)/admin/examens/[id]/questions/_components/use-first-change-guard"

describe("confirmation avant la première modification du jeu", () => {
  it("examen en préparation : aucune confirmation", () => {
    const run = vi.fn()
    const { result } = renderHook(() => useFirstChangeGuard(false))
    act(() => result.current.guard(run))
    expect(run).toHaveBeenCalledOnce()
    expect(result.current.dialog.open).toBe(false)
  })

  it("examen finalisé : demande tant que le serveur le dit finalisé", async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(
      ({ needed }) => useFirstChangeGuard(needed),
      { initialProps: { needed: true } },
    )

    act(() => result.current.guard(first))
    expect(first).not.toHaveBeenCalled()
    expect(result.current.dialog.open).toBe(true)
    await act(() => result.current.dialog.onConfirm())
    expect(first).toHaveBeenCalledOnce()
    act(() => result.current.dialog.onOpenChange(false))

    // Écriture refusée : l'examen reste finalisé, la confirmation revient.
    act(() => result.current.guard(second))
    expect(result.current.dialog.open).toBe(true)
    act(() => result.current.dialog.onOpenChange(false))

    // Écriture réussie : le rafraîchissement le dit en préparation.
    rerender({ needed: false })
    act(() => result.current.guard(second))
    expect(second).toHaveBeenCalledOnce()
    expect(result.current.dialog.open).toBe(false)
  })

  it("annuler n'exécute rien et redemande la fois suivante", () => {
    const run = vi.fn()
    const { result } = renderHook(() => useFirstChangeGuard(true))
    act(() => result.current.guard(run))
    act(() => result.current.dialog.onOpenChange(false))
    expect(run).not.toHaveBeenCalled()
    act(() => result.current.guard(run))
    expect(result.current.dialog.open).toBe(true)
    expect(run).not.toHaveBeenCalled()
  })
})
