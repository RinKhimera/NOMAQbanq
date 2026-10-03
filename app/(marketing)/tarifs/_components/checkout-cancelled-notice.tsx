"use client"

import { Info, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"

/** Retour de Stripe Checkout sans paiement : une information, pas une erreur. */
export const CheckoutCancelledNotice = () => {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div
      role="status"
      className="bg-surface-2 border-line flex items-center gap-3 rounded-md border py-2.5 pr-2.5 pl-4"
    >
      <Info aria-hidden className="text-ink-3 size-4 shrink-0" />
      <span className="text-ink min-w-0 flex-1 text-sm leading-normal">
        Paiement annulé&nbsp;: aucun montant n&apos;a été débité.
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Fermer"
        className={cn("shrink-0", TOUCH_TARGET)}
        onClick={() => setOpen(false)}
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}
