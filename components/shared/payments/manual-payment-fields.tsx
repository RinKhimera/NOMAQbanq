"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import type { SelectableUser } from "@/features/users/dal"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  type Currency,
  centsToInputAmount,
  parseAmountToCents,
} from "@/lib/currency"
import { cn } from "@/lib/utils"
import {
  MANUAL_NOTE_MAX,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  paymentMethodSchema,
} from "@/schemas/payment"

// Champs et briques du dialogue de paiement manuel (saisie et modification).

export type PaymentClient = { id: string; label: string }

export const CURRENCIES = [
  { value: "CAD", label: "CAD" },
  { value: "XAF", label: "XAF" },
] as const

export const METHODS = paymentMethodSchema.options

/** Montant de champ tel que l'admin le lit : « 50 », « 49,99 ». */
export const amountInput = (cents: number, currency: Currency) =>
  centsToInputAmount(cents, currency).replace(/\.00$/, "").replace(".", ",")

export const clientLabel = (u: Pick<SelectableUser, "name" | "email">) =>
  u.name.trim() || u.email

export const Field = ({
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

export const ReadOnly = ({
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
export const ClientPicker = ({
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

export type AmountState = { amount: string; currency: Currency }

/** Montant (règle de la devise) et devise ; passer en XAF arrondit à l'entier. */
export const AmountFields = ({
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

export const MethodField = ({
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

export const FreeAccessNote = () => (
  <ReadOnly label="Accès offert">
    <span className="text-ink-2 text-[0.8125rem]">
      Montant à 0, à la discrétion de l&apos;administrateur. Aucun moyen de
      paiement ; le motif est obligatoire.
    </span>
  </ReadOnly>
)

export const NoteField = ({
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

export const SubmitButton = ({
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

export const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
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
