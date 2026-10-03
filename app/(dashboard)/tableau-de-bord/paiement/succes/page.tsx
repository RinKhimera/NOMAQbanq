import type { Metadata } from "next"
import { Suspense } from "react"
import { env } from "@/lib/env/server"
import { PaymentStatusSkeleton } from "../_components/payment-status-skeleton"
import { PaymentSuccessContent } from "../_components/payment-success-client"

// Même adresse que le pied de page quand SUPPORT_EMAIL n'est pas configurée.
const FALLBACK_SUPPORT_EMAIL = "nomaqbanq@outlook.com"

// Le titre d'onglet suit ensuite l'état de la vérification (client).
export const metadata: Metadata = { title: "Paiement" }

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentStatusSkeleton />}>
      <PaymentSuccessContent
        supportEmail={env.SUPPORT_EMAIL ?? FALLBACK_SUPPORT_EMAIL}
      />
    </Suspense>
  )
}
