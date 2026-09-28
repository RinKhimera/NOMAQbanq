"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createStripeCheckout } from "@/features/payments/actions"

type CheckoutPaths = { successPath: string; cancelPath: string }

/**
 * Redirection vers Stripe Checkout. `pendingProduct` désigne le produit dont
 * la session est en cours de création, pour le spinner du bon bouton.
 */
export const useCheckout = () => {
  const [pendingProduct, setPendingProduct] = useState<string | null>(null)

  const checkout = async (productCode: string, paths: CheckoutPaths) => {
    setPendingProduct(productCode)
    try {
      const res = await createStripeCheckout({ productCode, ...paths })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      window.location.assign(res.checkoutUrl)
    } catch {
      toast.error(
        navigator.onLine
          ? "Une erreur est survenue. Veuillez réessayer."
          : "Pas de connexion internet. Vérifiez votre réseau.",
      )
    } finally {
      setPendingProduct(null)
    }
  }

  return { checkout, pendingProduct }
}
