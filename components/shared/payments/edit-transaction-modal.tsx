"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { motion, AnimatePresence } from "motion/react"
import {
  Pencil,
  User,
  Package,
  DollarSign,
  CreditCard,
  FileText,
  Loader2,
  CheckCircle,
  Banknote,
  AlertTriangle,
} from "lucide-react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import {
  editTransactionSchema,
  type EditTransactionFormValues,
  type PaymentMethod,
} from "@/schemas/payment"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import type { Transaction } from "./transaction-table"

interface EditTransactionModalProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

const parseAmountToCents = (
  input: string,
  currency: "CAD" | "XAF"
): number | null => {
  if (!input || input.trim() === "") return null

  const normalized = input.replace(",", ".").trim()
  const num = parseFloat(normalized)

  if (isNaN(num) || num <= 0) return null

  if (currency === "XAF") {
    if (!Number.isInteger(num)) return null
    return num * 100
  } else {
    const decimalPart = normalized.split(".")[1]
    const decimalPlaces = decimalPart ? decimalPart.length : 0
    if (decimalPlaces > 2) return null
    return Math.round(num * 100)
  }
}

const centsToDisplayAmount = (cents: number, currency: string): string => {
  const amount = cents / 100
  if (currency === "XAF") {
    return Math.round(amount).toString()
  }
  return amount.toFixed(2)
}

export const EditTransactionModal = ({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: EditTransactionModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const updateTransaction = useMutation(api.payments.updateManualTransaction)
  const accessImpact = useQuery(
    api.payments.getTransactionAccessImpact,
    transaction ? { transactionId: transaction._id as Id<"transactions"> } : "skip"
  )

  const form = useForm<EditTransactionFormValues>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      amountInput: "",
      currency: "CAD",
      paymentMethod: "interac",
      notes: "",
      status: undefined,
    },
  })

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction && open) {
      form.reset({
        amountInput: centsToDisplayAmount(transaction.amountPaid, transaction.currency),
        currency: transaction.currency as "CAD" | "XAF",
        paymentMethod: (transaction.paymentMethod || "autre") as PaymentMethod,
        notes: transaction.notes || "",
        status: transaction.status as "completed" | "refunded" | undefined,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form is stable from useForm
  }, [transaction, open])

  const watchedStatus = form.watch("status")
  const showRefundWarning = watchedStatus === "refunded" && transaction?.status === "completed"

  const onSubmit = async (data: EditTransactionFormValues) => {
    if (!transaction) return

    setIsSubmitting(true)
    try {
      const amountCents = parseAmountToCents(data.amountInput, data.currency)

      if (amountCents === null) {
        toast.error("Montant invalide")
        setIsSubmitting(false)
        return
      }

      await updateTransaction({
        transactionId: transaction._id as Id<"transactions">,
        amountPaid: amountCents,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        notes: data.notes || undefined,
        status: data.status,
      })

      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onOpenChange(false)
        onSuccess?.()
      }, 1500)

      const message = data.status === "refunded"
        ? "Transaction remboursée et accès révoqué"
        : "Transaction modifiée avec succès"
      toast.success(message)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(errorMessage)
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!transaction) return null

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
                Modification enregistrée
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Les changements ont été sauvegardés
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
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
                <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
                <div className="relative">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                    <Pencil className="h-6 w-6 text-white" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-white">
                    Modifier la transaction
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-slate-300">
                    Modifiez les détails du paiement manuel
                  </DialogDescription>
                </div>
              </div>

              {/* Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 p-6">
                  {/* Read-only User Info */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Utilisateur
                        </p>
                        <p className="truncate font-semibold text-gray-900 dark:text-white">
                          {transaction.user?.name || "Utilisateur inconnu"}
                        </p>
                        <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {transaction.user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Read-only Product Info */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Produit
                        </p>
                        <p className="truncate font-semibold text-gray-900 dark:text-white">
                          {transaction.product?.name || "Produit inconnu"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {transaction.durationDays} jours · {transaction.accessType === "exam" ? "Examens" : "Entraînement"}
                        </p>
                      </div>
                    </div>
                  </div>

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
                                placeholder={currency === "XAF" ? "5000" : "50.00"}
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
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {currencies.map((currency) => (
                                <SelectItem key={currency.value} value={currency.value}>
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
                                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
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

                  {/* Status - Only show if current status is completed */}
                  {transaction.status === "completed" && (
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="completed">Complété</SelectItem>
                              <SelectItem value="refunded">Remboursé</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Refund Warning */}
                  {showRefundWarning && accessImpact?.willRevokeAccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20"
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Attention : Révocation d{"'"}accès
                        </p>
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                          Le remboursement révoquera l{"'"}accès {accessImpact.accessType === "exam" ? "aux examens" : "à l'entraînement"} de l{"'"}utilisateur car c{"'"}est sa dernière transaction pour ce type d{"'"}accès.
                        </p>
                      </div>
                    </motion.div>
                  )}

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
                      className={cn(
                        "flex-1 rounded-xl text-white",
                        showRefundWarning
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90"
                      )}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enregistrement...
                        </span>
                      ) : showRefundWarning ? (
                        "Rembourser et révoquer"
                      ) : (
                        "Enregistrer les modifications"
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
