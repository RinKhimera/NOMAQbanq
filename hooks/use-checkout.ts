"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createStripeCheckout } from "@/features/payments/actions"
import { callAction } from "@/lib/safe-action"

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
      // callAction ne rejette pas : panne réseau et déploiement périmé
      // reviennent en `{ error }`, avec leur propre message.
      const res = await callAction(() =>
        createStripeCheckout({ productCode, ...paths }),
      )
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      window.location.assign(res.checkoutUrl)
    } finally {
      setPendingProduct(null)
    }
  }

  return { checkout, pendingProduct }
}
