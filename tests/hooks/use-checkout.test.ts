import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCheckout } from "@/hooks/use-checkout"
import { NETWORK_ERROR_MESSAGE } from "@/lib/safe-action"

const createStripeCheckout = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock("@/features/payments/actions", () => ({ createStripeCheckout }))
vi.mock("sonner", () => ({ toast: { error: toastError } }))
vi.mock("next/navigation", () => ({
  unstable_isUnrecognizedActionError: () => false,
}))

const paths = { successPath: "/succes", cancelPath: "/tarifs" }

describe("useCheckout", () => {
  it("redirige vers l'URL Stripe et marque le produit en attente", async () => {
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {})
    let resolve: (v: unknown) => void = () => {}
    createStripeCheckout.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const { result } = renderHook(() => useCheckout())

    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.checkout("exam_access", paths)
    })
    expect(result.current.pendingProduct).toBe("exam_access")

    await act(async () => {
      resolve({ checkoutUrl: "https://checkout.stripe.com/c/1" })
      await pending
    })
    expect(createStripeCheckout).toHaveBeenCalledWith({
      productCode: "exam_access",
      ...paths,
    })
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/1")
    expect(result.current.pendingProduct).toBeNull()
  })

  it("affiche l'erreur métier sans rediriger", async () => {
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {})
    createStripeCheckout.mockResolvedValue({ error: "Produit invalide" })
    const { result } = renderHook(() => useCheckout())
    await act(() => result.current.checkout("x", paths))
    expect(toastError).toHaveBeenCalledWith("Produit invalide")
    expect(assign).not.toHaveBeenCalled()
  })

  it("une panne réseau devient un message, jamais un rejet", async () => {
    createStripeCheckout.mockRejectedValue(new Error("Failed to fetch"))
    const { result } = renderHook(() => useCheckout())
    await act(() => result.current.checkout("x", paths))
    expect(toastError).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE)
    expect(result.current.pendingProduct).toBeNull()
  })
})
