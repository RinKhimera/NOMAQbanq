"use client"

import { MailX } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type ManualGrant,
  recordManualPayment,
} from "@/features/payments/actions"
import type { ProductView } from "@/features/payments/dal"
import {
  type Currency,
  amountInputError,
  parseAmountToCents,
} from "@/lib/currency"
import { formatCurrency } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import {
  MANUAL_NOTE_MAX,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  manualNoteError,
} from "@/schemas/payment"
import { ACCESS_TYPE_LABEL } from "./access-badge"
import {
  AmountFields,
  type AmountState,
  ClientPicker,
  Field,
  FreeAccessNote,
  KV,
  MethodField,
  NoteField,
  type PaymentClient,
  ReadOnly,
  SubmitButton,
  amountInput,
} from "./manual-payment-fields"
import { clientFileHref, recordedGrantLine } from "./transaction-labels"

export type { PaymentClient } from "./manual-payment-fields"

/** Ce que le dialogue « Paiement enregistré » affiche. */
export type RecordedPayment = {
  transactionId: string
  client: PaymentClient
  productName: string
  isCombo: boolean
  durationDays: number
  amountPaid: number
  currency: Currency
  paymentMethod: string | null
  note: string
  grants: ManualGrant[]
  recordedAt: number
}

const defaultProduct = (products: ProductView[]) =>
  products.find((p) => p.code === "exam_access") ?? products[0]

const ManualPaymentForm = ({
  products,
  client: presetClient,
  initialAmount,
  onCancel,
  onRecorded,
}: {
  products: ProductView[]
  client?: PaymentClient
  initialAmount?: string
  onCancel: () => void
  onRecorded: (recorded: RecordedPayment) => void
}) => {
  const first = defaultProduct(products)
  const [client, setClient] = useState<PaymentClient | null>(
    presetClient ?? null,
  )
  const [productCode, setProductCode] = useState<string>(first?.code ?? "")
  const product = products.find((p) => p.code === productCode)
  const startAmount =
    initialAmount ?? (first ? amountInput(first.priceCAD, "CAD") : "")
  const [money, setMoney] = useState<AmountState>({
    amount: startAmount,
    currency: "CAD",
  })
  const [method, setMethod] = useState<PaymentMethod>("interac")
  const [note, setNote] = useState("")
  const [touched, setTouched] = useState(initialAmount !== undefined)
  const [pending, setPending] = useState(false)

  const amountError = amountInputError(money.amount, money.currency)
  const cents = parseAmountToCents(money.amount, money.currency)
  const free = cents === 0
  const noteError = manualNoteError(note, free)
  const showAmountError = touched || money.amount !== startAmount
  const priceHint =
    !amountError &&
    money.currency === "CAD" &&
    product &&
    cents !== product.priceCAD
      ? `Prix du produit : ${formatCurrency(product.priceCAD)}`
      : undefined

  const submit = async () => {
    setTouched(true)
    if (!client || !product || cents === null || noteError) return
    setPending(true)
    const res = await callAction(() =>
      recordManualPayment({
        userId: client.id,
        productCode: product.code,
        amountPaid: cents,
        currency: money.currency,
        paymentMethod: free ? null : method,
        notes: note.trim() || undefined,
      }),
    )
    setPending(false)
    if (!res.success || !res.transactionId) {
      toast.error(res.error ?? "Enregistrement impossible. Réessayez.")
      return
    }
    onRecorded({
      transactionId: res.transactionId,
      client,
      productName: product.name,
      isCombo: product.isCombo,
      durationDays: product.durationDays,
      amountPaid: cents,
      currency: money.currency,
      paymentMethod: free ? null : method,
      note: note.trim(),
      grants: res.grants ?? [],
      recordedAt: res.recordedAt ?? Date.now(),
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {presetClient ? (
          <ReadOnly label="Client">
            <span className="text-ink">{presetClient.label}</span>
          </ReadOnly>
        ) : (
          <Field label="Client" htmlFor="manual-client">
            <ClientPicker value={client} onChange={setClient} />
          </Field>
        )}
        <Field label="Produit" htmlFor="manual-product">
          <Select
            value={productCode}
            onValueChange={(code) => {
              setProductCode(code)
              const next = products.find((p) => p.code === code)
              if (next && money.currency === "CAD")
                setMoney({
                  ...money,
                  amount: amountInput(next.priceCAD, "CAD"),
                })
            }}
          >
            <SelectTrigger id="manual-product" className="w-full">
              <SelectValue placeholder="Choisir un produit" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name} · {formatCurrency(p.priceCAD)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <AmountFields
          value={money}
          onChange={setMoney}
          error={showAmountError ? amountError : null}
          help={priceHint}
        />
        {free ? (
          <FreeAccessNote />
        ) : (
          <MethodField value={method} onChange={setMethod} />
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
        <SubmitButton
          pending={pending}
          disabled={!client || Boolean(amountError)}
          onClick={submit}
        >
          {free ? "Offrir l'accès" : "Enregistrer et accorder l'accès"}
        </SubmitButton>
      </DialogFooter>
    </>
  )
}

/** Saisie d'un paiement manuel ou d'un accès offert. */
export const ManualPaymentDialog = ({
  open,
  onOpenChange,
  products,
  client,
  initialAmount,
  onRecorded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductView[]
  /** Client déjà choisi (dossier, fiche) : affiché en lecture seule. */
  client?: PaymentClient
  initialAmount?: string
  onRecorded: (recorded: RecordedPayment) => void
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-130">
      <DialogHeader>
        <DialogTitle>Enregistrer un paiement manuel</DialogTitle>
        <DialogDescription>
          L&apos;accès est accordé dès l&apos;enregistrement. Aucun courriel
          n&apos;est envoyé au client.
        </DialogDescription>
      </DialogHeader>
      <ManualPaymentForm
        products={products}
        client={client}
        initialAmount={initialAmount}
        onCancel={() => onOpenChange(false)}
        onRecorded={onRecorded}
      />
    </DialogContent>
  </Dialog>
)

/** Confirmation après l'enregistrement : accès accordé, lu dans le registre. */
export const PaymentRecordedDialog = ({
  recorded,
  onClose,
  onView,
  viewLabel = "Voir la transaction",
}: {
  recorded: RecordedPayment | null
  onClose: () => void
  onView?: () => void
  viewLabel?: string
}) => {
  const free = recorded?.amountPaid === 0
  return (
    <Dialog open={recorded !== null} onOpenChange={(o) => !o && onClose()}>
      {recorded && (
        <DialogContent className="sm:max-w-120">
          <DialogHeader>
            <DialogTitle>
              {free ? "Accès offert" : "Paiement enregistré"}
            </DialogTitle>
            <DialogDescription>
              {recorded.client.label} · {recorded.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="border-line bg-surface-2 flex flex-col gap-2 rounded-md border p-3">
              <span className="type-label">Accès accordé</span>
              {recorded.grants.map((g) => (
                <div
                  key={g.accessType}
                  className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"
                >
                  <span className="text-ink font-medium">
                    Accès {ACCESS_TYPE_LABEL[g.accessType]}
                  </span>
                  <span className="text-success-ink font-mono text-[0.8125rem]">
                    {recordedGrantLine(g, recorded)}
                  </span>
                </div>
              ))}
            </div>
            <KV
              rows={[
                [
                  "Montant",
                  <span key="m" className="font-mono">
                    {formatCurrency(recorded.amountPaid, recorded.currency)}
                  </span>,
                ],
                recorded.paymentMethod
                  ? [
                      "Moyen",
                      PAYMENT_METHOD_LABEL[
                        recorded.paymentMethod as PaymentMethod
                      ] ?? recorded.paymentMethod,
                    ]
                  : ["Type", "Accès offert"],
                ...(recorded.note
                  ? ([
                      [
                        free ? "Motif de la gratuité" : "Note interne",
                        recorded.note,
                      ],
                    ] as [string, ReactNode][])
                  : []),
              ]}
            />
            <p className="text-ink-2 flex gap-2 text-[0.8125rem] leading-normal">
              <MailX
                aria-hidden="true"
                className="text-ink-3 mt-0.5 size-4 shrink-0"
              />
              Aucun courriel n&apos;est envoyé au client. Prévenez-le si
              nécessaire.
            </p>
          </div>
          <DialogFooter>
            {onView && (
              <Button type="button" variant="ghost" onClick={onView}>
                {viewLabel}
              </Button>
            )}
            <Button type="button" onClick={onClose}>
              Terminé
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}

/**
 * Seul point d'entrée du paiement manuel hors de la page Transactions (tableau
 * de bord, fiche utilisateur) : saisie, puis confirmation, puis rafraîchissement
 * de la page. « Voir la transaction » ouvre le dossier du client.
 */
export const ManualPaymentFlow = ({
  open,
  onOpenChange,
  products,
  client,
  viewLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductView[]
  client?: PaymentClient
  viewLabel?: string
}) => {
  const router = useRouter()
  const [recorded, setRecorded] = useState<RecordedPayment | null>(null)
  return (
    <>
      <ManualPaymentDialog
        open={open && recorded === null}
        onOpenChange={onOpenChange}
        products={products}
        client={client}
        onRecorded={(r) => {
          setRecorded(r)
          router.refresh()
        }}
      />
      <PaymentRecordedDialog
        recorded={recorded}
        viewLabel={viewLabel}
        onClose={() => {
          setRecorded(null)
          onOpenChange(false)
        }}
        onView={() => {
          if (!recorded) return
          const href = clientFileHref(
            recorded.client.id,
            recorded.transactionId,
          )
          setRecorded(null)
          onOpenChange(false)
          router.push(href)
        }}
      />
    </>
  )
}
