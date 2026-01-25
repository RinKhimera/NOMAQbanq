"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import {
  Banknote,
  Check,
  CheckCircle,
  ChevronsUpDown,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Package,
  User,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  type ManualPaymentFormValues,
  type ProductCode,
  manualPaymentSchema,
} from "@/schemas/payment"

interface ManualPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultUserId?: Id<"users">
  onSuccess?: () => void
}

const paymentMethods = [
  { value: "cash", label: "Espèces", icon: Banknote },
  { value: "interac", label: "Interac", icon: CreditCard },
  { value: "virement", label: "Virement bancaire", icon: CreditCard },
  { value: "autre", label: "Autre", icon: FileText },
] as const

const currencies = [
  { value: "CAD", label: "CAD ($)", symbol: "$" },
  { value: "XAF", label: "XAF (FCFA)", symbol: "FCFA" },
] as const

/**
 * Parse un montant saisi par l'utilisateur en centimes
 * Retourne null si invalide pour la devise donnée
 */
const parseAmountToCents = (
  input: string,
  currency: "CAD" | "XAF",
): number | null => {
  if (!input || input.trim() === "") return null

  const normalized = input.replace(",", ".").trim()
  const num = parseFloat(normalized)

  if (isNaN(num) || num <= 0) return null

  if (currency === "XAF") {
    // XAF n'a pas de centimes - doit être un entier
    if (!Number.isInteger(num)) return null
    return num * 100
  } else {
    // CAD: max 2 décimales
    const decimalPart = normalized.split(".")[1]
    const decimalPlaces = decimalPart ? decimalPart.length : 0
    if (decimalPlaces > 2) return null
    return Math.round(num * 100)
  }
}

export const ManualPaymentModal = ({
  open,
  onOpenChange,
  defaultUserId,
  onSuccess,
}: ManualPaymentModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [userPopoverOpen, setUserPopoverOpen] = useState(false)

  const products = useQuery(api.payments.getAvailableProducts)
  const users = useQuery(api.users.getAllUsers)
  const recordPayment = useMutation(api.payments.recordManualPayment)

  const form = useForm<ManualPaymentFormValues>({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: {
      userId: defaultUserId || "",
      productCode: "exam_access",
      amountInput: "50.00",
      currency: "CAD",
      paymentMethod: "interac",
      notes: "",
    },
  })

  const selectedProduct = products?.find(
    (p) => p.code === form.watch("productCode"),
  )

  const onSubmit = async (data: ManualPaymentFormValues) => {
    setIsSubmitting(true)
    try {
      const amountCents = parseAmountToCents(data.amountInput, data.currency)

      if (amountCents === null) {
        toast.error("Montant invalide")
        setIsSubmitting(false)
        return
      }

      await recordPayment({
        userId: data.userId as Id<"users">,
        productCode: data.productCode as ProductCode,
        amountPaid: amountCents,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        notes: data.notes || undefined,
      })

      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onOpenChange(false)
        form.reset()
        onSuccess?.()
      }, 1500)

      toast.success("Paiement enregistré avec succès")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue"
      if (errorMessage.includes("non trouvé")) {
        toast.error("Utilisateur ou produit non trouvé")
      } else {
        toast.error("Erreur lors de l'enregistrement du paiement")
      }
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg"
              >
                <CheckCircle className="h-10 w-10 text-white" />
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Paiement enregistré !
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                L{"'"}accès a été activé pour l{"'"}utilisateur
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header with gradient */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-8">
                <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
                <div className="relative">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                    <Banknote className="h-6 w-6 text-white" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-white">
                    Enregistrer un paiement manuel
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-slate-300">
                    Ajoutez un paiement reçu en espèces, Interac ou virement
                  </DialogDescription>
                </div>
              </div>

              {/* Form */}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-5 p-6"
                >
                  {/* User */}
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => {
                      const selectedUser = users?.find(
                        (u) => u._id === field.value,
                      )
                      return (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Utilisateur
                          </FormLabel>
                          <Popover
                            open={userPopoverOpen}
                            onOpenChange={setUserPopoverOpen}
                            modal={true}
                          >
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={userPopoverOpen}
                                  className={cn(
                                    "w-full justify-between rounded-xl",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {selectedUser
                                    ? selectedUser.name
                                    : "Sélectionner un utilisateur..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[400px] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Rechercher par nom ou email..." />
                                <CommandEmpty>
                                  Aucun utilisateur trouvé.
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-72">
                                    {users
                                      ?.filter((user) => user.role !== "admin")
                                      .map((user) => (
                                        <CommandItem
                                          key={user._id}
                                          value={`${user.name} ${user.email}`}
                                          onSelect={() => {
                                            field.onChange(user._id)
                                            setUserPopoverOpen(false)
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === user._id
                                                ? "opacity-100"
                                                : "opacity-0",
                                            )}
                                          />
                                          <div className="flex-1">
                                            <p className="font-medium">
                                              {user.name}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                              {user.email}
                                            </p>
                                          </div>
                                        </CommandItem>
                                      ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {selectedUser && (
                            <FormDescription className="text-xs">
                              {selectedUser.email}
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />

                  {/* Product */}
                  <FormField
                    control={form.control}
                    name="productCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Produit
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Sélectionnez un produit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem
                                key={product.code}
                                value={product.code}
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <span>{product.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {formatCurrency(product.priceCAD)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedProduct && (
                          <FormDescription className="text-xs">
                            {selectedProduct.durationDays} jours d{"'"}accès ·
                            Prix suggéré:{" "}
                            {formatCurrency(selectedProduct.priceCAD)}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount and Currency in row */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amountInput"
                      render={({ field }) => {
                        const currency = form.watch("currency")
                        const cents = parseAmountToCents(field.value, currency)
                        return (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Montant
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder={
                                  currency === "XAF" ? "5000" : "50.00"
                                }
                                className="rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {cents !== null
                                ? formatCurrency(cents, currency)
                                : currency === "XAF"
                                  ? "Entrez un nombre entier"
                                  : "Ex: 50.00 ou 50,75"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <span className="h-4 w-4" />
                            Devise
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {currencies.map((currency) => (
                                <SelectItem
                                  key={currency.value}
                                  value={currency.value}
                                >
                                  {currency.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            {form.watch("currency") === "XAF"
                              ? "Entiers uniquement"
                              : "Max 2 décimales"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Payment Method */}
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Méthode de paiement
                        </FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {paymentMethods.map((method) => {
                            const Icon = method.icon
                            return (
                              <button
                                key={method.value}
                                type="button"
                                onClick={() => field.onChange(method.value)}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all",
                                  field.value === method.value
                                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                {method.label}
                              </button>
                            )
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Notes (optionnel)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: Paiement reçu le 15 janvier par Interac..."
                            className="min-h-[80px] resize-none rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="flex-1 rounded-xl"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enregistrement...
                        </span>
                      ) : (
                        "Enregistrer le paiement"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
