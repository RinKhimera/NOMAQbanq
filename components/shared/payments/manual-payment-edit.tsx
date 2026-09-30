"use client"

import { Undo2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  deleteManualTransaction,
  updateManualTransaction,
} from "@/features/payments/actions"
import type { AdminTransactionView } from "@/features/payments/dal"
import { amountInputError, parseAmountToCents } from "@/lib/currency"
import { formatCurrency } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { MANUAL_NOTE_MAX, manualNoteError } from "@/schemas/payment"
import { AccessImpactPanel } from "./access-impact-panel"
import {
  AmountFields,
  type AmountState,
  Field,
  FreeAccessNote,
  MethodField,
  NoteField,
  ReadOnly,
  SubmitButton,
  amountInput,
} from "./manual-payment-fields"
import { coveredAccess } from "./transaction-labels"
import { useAccessImpact } from "./use-access-impact"

const EditForm = ({
  transaction,
  startRefund,
  onCancel,
  onSaved,
}: {
  transaction: AdminTransactionView
  startRefund: boolean
  onCancel: () => void
  onSaved: (refunded: boolean) => void
}) => {
  const initialAmount = amountInput(
    transaction.amountPaid,
    transaction.currency,
  )
  const [money, setMoney] = useState<AmountState>({
    amount: initialAmount,
    currency: transaction.currency,
  })
  const [method, setMethod] = useState<string>(
    transaction.paymentMethod ?? "interac",
  )
  const [note, setNote] = useState(transaction.notes ?? "")
  // Un paiement en attente ou échoué garde son statut : seule la bascule
  // complété ↔ remboursé se fait ici.
  const statusEditable =
    transaction.status === "completed" || transaction.status === "refunded"
  const [status, setStatus] = useState<"completed" | "refunded">(
    startRefund || transaction.status === "refunded" ? "refunded" : "completed",
  )
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)

  const amountError = amountInputError(money.amount, money.currency)
  const cents = parseAmountToCents(money.amount, money.currency)
  const free = cents === 0
  const noteError = manualNoteError(note, free)
  const refund =
    statusEditable && status === "refunded" && transaction.status !== "refunded"
  const impact = useAccessImpact(transaction.id, refund)

  const submit = async () => {
    setTouched(true)
    if (cents === null || noteError) return
    setPending(true)
    const res = await callAction(() =>
      updateManualTransaction({
        transactionId: transaction.id,
        amountPaid: cents,
        currency: money.currency,
        paymentMethod: free ? null : method,
        notes: note.trim() || undefined,
        status: statusEditable ? status : undefined,
      }),
    )
    setPending(false)
    if (!res.success) {
      toast.error(res.error ?? "Modification impossible. Réessayez.")
      return
    }
    onSaved(refund)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <ReadOnly label="Produit">
          <span className="text-ink">
            {transaction.product?.name ?? "Produit inconnu"}
          </span>
          <span className="text-ink-3 text-xs">
            Le produit ne se modifie pas. Supprimez le paiement et
            enregistrez-en un autre si nécessaire.
          </span>
        </ReadOnly>
        <AmountFields
          value={money}
          onChange={setMoney}
          error={touched || money.amount !== initialAmount ? amountError : null}
        />
        {free ? (
          <FreeAccessNote />
        ) : (
          <MethodField value={method} onChange={setMethod} />
        )}
        {statusEditable && (
          <Field label="Statut">
            <SegmentedControl
              label="Statut"
              value={status}
              options={[
                { value: "completed", label: "Complété" },
                { value: "refunded", label: "Remboursé" },
              ]}
              onValueChange={setStatus}
              className="w-full *:flex-1"
            />
          </Field>
        )}
        {refund && (
          <AccessImpactPanel
            state={impact}
            covered={coveredAccess(transaction)}
          />
        )}
        <NoteField
          value={note}
          onChange={setNote}
          free={free}
          error={touched || note.length > MANUAL_NOTE_MAX ? noteError : null}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        {refund ? (
          <SubmitButton
            variant="destructive"
            pending={pending}
            disabled={Boolean(amountError) || impact.status === "loading"}
            onClick={submit}
          >
            <Undo2 aria-hidden="true" />
            Rembourser et révoquer
          </SubmitButton>
        ) : (
          <SubmitButton
            pending={pending}
            disabled={Boolean(amountError)}
            onClick={submit}
          >
            Enregistrer
          </SubmitButton>
        )}
      </DialogFooter>
    </>
  )
}

/** Modification d'un paiement manuel ; passer à Remboursé montre l'impact sur l'accès. */
export const EditManualPaymentDialog = ({
  transaction,
  startRefund = false,
  onOpenChange,
  onSaved,
}: {
  transaction: AdminTransactionView | null
  startRefund?: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (refunded: boolean) => void
}) => (
  <Dialog open={transaction !== null} onOpenChange={onOpenChange}>
    {transaction && (
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-130">
        <DialogHeader>
          <DialogTitle>Modifier le paiement manuel</DialogTitle>
          <DialogDescription>
            {transaction.user.name.trim() || transaction.user.email} ·{" "}
            {transaction.product?.name ?? "Produit inconnu"}
          </DialogDescription>
        </DialogHeader>
        <EditForm
          transaction={transaction}
          startRefund={startRefund}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    )}
  </Dialog>
)

/** Suppression d'un paiement manuel, avec l'impact sur l'accès (qui ne bloque pas). */
export const DeleteManualPaymentDialog = ({
  transaction,
  onOpenChange,
  onDeleted,
}: {
  transaction: AdminTransactionView | null
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) => {
  const impact = useAccessImpact(transaction?.id ?? null, transaction !== null)
  return (
    <ConfirmDialog
      open={transaction !== null}
      onOpenChange={onOpenChange}
      variant="destructive"
      title="Supprimer ce paiement manuel ?"
      description={
        transaction
          ? `${transaction.user.name.trim() || transaction.user.email} · ${transaction.product?.name ?? "Produit inconnu"} · ${formatCurrency(transaction.amountPaid, transaction.currency)}. L'accès est recalculé sans ce paiement.`
          : undefined
      }
      confirmLabel="Supprimer"
      pendingLabel="Suppression…"
      confirmDisabled={impact.status === "loading"}
      onConfirm={async () => {
        if (!transaction) return false
        const res = await callAction(() =>
          deleteManualTransaction(transaction.id),
        )
        if (!res.success) {
          toast.error(res.error ?? "Suppression impossible. Réessayez.")
          return false
        }
        onDeleted()
      }}
    >
      {transaction && (
        <AccessImpactPanel
          state={impact}
          covered={coveredAccess(transaction)}
        />
      )}
    </ConfirmDialog>
  )
}
