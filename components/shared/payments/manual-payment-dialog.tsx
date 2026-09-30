"use client"

import { ArrowRight, Check, ChevronsUpDown, MailX, Undo2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { loadSearchSelectableUsers } from "@/features/exams/actions"
import type { AccessType } from "@/features/payments/access-ledger"
import {
  type ManualGrant,
  deleteManualTransaction,
  recordManualPayment,
  updateManualTransaction,
} from "@/features/payments/actions"
import type { AdminTransactionView, ProductView } from "@/features/payments/dal"
import type { SelectableUser } from "@/features/users/dal"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  type Currency,
  amountInputError,
  centsToInputAmount,
  parseAmountToCents,
} from "@/lib/currency"
import { formatCurrency, formatMediumDate } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { TONE_SOFT } from "@/lib/tone"
import { cn } from "@/lib/utils"
import {
  MANUAL_NOTE_MAX,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  manualNoteError,
  paymentMethodSchema,
} from "@/schemas/payment"
import { ACCESS_TYPE_LABEL } from "./access-badge"
import { impactLines } from "./access-impact"
import {
  clientFileHref,
  coveredAccess,
  recordedGrantLine,
} from "./transaction-labels"
import { type AccessImpactState, useAccessImpact } from "./use-access-impact"

export type PaymentClient = { id: string; label: string }

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

const CURRENCIES = [
  { value: "CAD", label: "CAD" },
  { value: "XAF", label: "XAF" },
] as const

const METHODS = paymentMethodSchema.options

/** Montant de champ tel que l'admin le lit : « 50 », « 49,99 ». */
const amountInput = (cents: number, currency: Currency) =>
  centsToInputAmount(cents, currency).replace(/\.00$/, "").replace(".", ",")

const clientLabel = (u: Pick<SelectableUser, "name" | "email">) =>
  u.name.trim() || u.email

const Field = ({
  label,
  htmlFor,
  hint,
  error,
  help,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  help?: ReactNode
  children: ReactNode
}) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint && <span className="text-ink-3 text-xs">{hint}</span>}
    </div>
    {children}
    {error ? (
      <p className="text-danger-ink text-xs" role="alert">
        {error}
      </p>
    ) : (
      help && <p className="text-ink-3 text-xs">{help}</p>
    )}
  </div>
)

const ReadOnly = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-1 text-sm">
    <span className="type-label">{label}</span>
    {children}
  </div>
)

/** Sélecteur de client : recherche serveur par nom ou courriel, comptes sans nom compris. */
const ClientPicker = ({
  value,
  onChange,
}: {
  value: PaymentClient | null
  onChange: (client: PaymentClient) => void
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const term = useDebouncedValue(query, 250)
  const [results, setResults] = useState<{
    term: string
    users: SelectableUser[]
  } | null>(null)

  useEffect(() => {
    if (!open) return
    let current = true
    loadSearchSelectableUsers({ query: term, limit: 20 })
      .then((users) => {
        if (current) setResults({ term, users })
      })
      .catch(() => {
        if (current) setResults({ term, users: [] })
      })
    return () => {
      current = false
    }
  }, [open, term])

  const loading = open && results?.term !== term

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id="manual-client"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-ink-3",
          )}
        >
          <span className="truncate">
            {value ? value.label : "Choisir un utilisateur"}
          </span>
          <ChevronsUpDown aria-hidden="true" className="text-ink-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Nom ou courriel…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className="text-ink-3 flex items-center gap-2 p-3 text-sm">
                <Spinner size="sm" />
                Recherche…
              </div>
            ) : (
              <>
                <CommandEmpty>Aucun utilisateur trouvé.</CommandEmpty>
                <CommandGroup>
                  {results?.users.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      onSelect={() => {
                        onChange({ id: u.id, label: clientLabel(u) })
                        setOpen(false)
                      }}
                    >
                      <Check
                        aria-hidden="true"
                        className={cn(
                          value?.id === u.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            "truncate",
                            !u.name.trim() && "text-ink-3 italic",
                          )}
                        >
                          {u.name.trim() || "Non défini"}
                        </span>
                        <span className="text-ink-3 truncate text-xs">
                          {u.email}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type AmountState = { amount: string; currency: Currency }

/** Montant (règle de la devise) et devise ; passer en XAF arrondit à l'entier. */
const AmountFields = ({
  value,
  onChange,
  error,
  help,
}: {
  value: AmountState
  onChange: (value: AmountState) => void
  error: string | null
  help?: string
}) => (
  <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
    <Field label="Montant" htmlFor="manual-amount" error={error} help={help}>
      <Input
        id="manual-amount"
        inputMode="decimal"
        className="font-mono"
        aria-invalid={Boolean(error)}
        value={value.amount}
        onChange={(e) =>
          onChange({
            ...value,
            amount: e.target.value.replace(/[^\d.,]/g, ""),
          })
        }
      />
    </Field>
    <Field label="Devise">
      <SegmentedControl
        label="Devise"
        value={value.currency}
        options={CURRENCIES}
        onValueChange={(currency) => {
          const cents = parseAmountToCents(
            value.amount,
            value.currency === "XAF" ? "XAF" : "CAD",
          )
          onChange({
            currency,
            amount:
              currency === "XAF" && cents !== null
                ? String(Math.round(cents / 100))
                : value.amount,
          })
        }}
        className="w-full *:flex-1"
      />
    </Field>
  </div>
)

const MethodField = ({
  value,
  onChange,
}: {
  value: string
  onChange: (method: PaymentMethod) => void
}) => (
  <Field label="Moyen de paiement" htmlFor="manual-method">
    <Select value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
      <SelectTrigger id="manual-method" className="w-full">
        <SelectValue placeholder="Choisir un moyen" />
      </SelectTrigger>
      <SelectContent>
        {METHODS.map((m) => (
          <SelectItem key={m} value={m}>
            {PAYMENT_METHOD_LABEL[m]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
)

const FreeAccessNote = () => (
  <ReadOnly label="Accès offert">
    <span className="text-ink-2 text-[0.8125rem]">
      Montant à 0, à la discrétion de l&apos;administrateur. Aucun moyen de
      paiement ; le motif est obligatoire.
    </span>
  </ReadOnly>
)

const NoteField = ({
  value,
  onChange,
  free,
  error,
}: {
  value: string
  onChange: (note: string) => void
  free: boolean
  error: string | null
}) => (
  <Field
    label={free ? "Motif de la gratuité" : "Note interne"}
    htmlFor="manual-note"
    hint={free ? "Obligatoire" : "Optionnel"}
    error={error}
    help={`${value.length} / ${MANUAL_NOTE_MAX} · visible par les administrateurs seulement`}
  >
    <Textarea
      id="manual-note"
      rows={2}
      value={value}
      aria-invalid={Boolean(error)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        free
          ? "Ex. : accès offert pour compenser l'incident du 12 septembre"
          : "Numéro de reçu, référence du virement…"
      }
    />
  </Field>
)

/** Impact d'un retrait sur chaque accès couvert par la transaction. */
export const AccessImpactPanel = ({
  state,
  covered,
}: {
  state: AccessImpactState
  covered: AccessType[]
}) => {
  if (state.status === "failed")
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col gap-1 rounded-md border p-3 text-sm",
          TONE_SOFT.warning,
        )}
      >
        <p className="font-medium">Impact sur l&apos;accès indisponible</p>
        <p>
          Le calcul n&apos;a pas pu être chargé. L&apos;opération reste possible
          ; vérifiez ensuite l&apos;accès du client dans sa fiche.
        </p>
      </div>
    )

  return (
    <div
      aria-busy={state.status === "loading"}
      className="border-line bg-surface-2 flex flex-col gap-2 rounded-md border p-3"
    >
      <span className="type-label">Impact sur l&apos;accès</span>
      {state.status === "loading" ? (
        <span className="text-ink-2 inline-flex items-center gap-2 text-sm">
          <Spinner size="sm" />
          Calcul de l&apos;impact sur l&apos;accès…
        </span>
      ) : (
        impactLines(state.impacts, covered, state.loadedAt).map((line) => (
          <div
            key={line.accessType}
            className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"
          >
            <span className="text-ink font-medium">
              Accès {ACCESS_TYPE_LABEL[line.accessType]}
            </span>
            {line.affected ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[0.8125rem]">
                <span className="text-ink-2">
                  expire le {formatMediumDate(line.current!)}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="text-ink-3 size-3.5"
                />
                <span
                  className={cn(
                    "font-medium",
                    line.after ? "text-warning-ink" : "text-danger-ink",
                  )}
                >
                  {line.after
                    ? `expire le ${formatMediumDate(line.after)}`
                    : "retiré"}
                </span>
              </span>
            ) : (
              <span className="text-ink-3">
                Non affecté
                {line.current !== null && line.current <= state.loadedAt
                  ? ` · expiré le ${formatMediumDate(line.current)}`
                  : ""}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  )
}

const SubmitButton = ({
  pending,
  disabled,
  onClick,
  variant = "default",
  children,
}: {
  pending: boolean
  disabled?: boolean
  onClick: () => void
  variant?: "default" | "destructive"
  children: ReactNode
}) => (
  <Button
    type="button"
    variant={variant}
    disabled={pending || disabled}
    onClick={onClick}
  >
    {pending && <Spinner size="sm" />}
    {children}
  </Button>
)

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

const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="flex flex-col">
    {rows.map(([k, v]) => (
      <div
        key={k}
        className="border-line grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-t py-2.5 text-sm first:border-t-0 max-md:grid-cols-1 max-md:gap-0.5"
      >
        <dt className="text-ink-3">{k}</dt>
        <dd className="text-ink wrap-anywhere">{v}</dd>
      </div>
    ))}
  </dl>
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
