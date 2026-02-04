"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { motion } from "motion/react"
import dynamic from "next/dynamic"
import {
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Mail,
  Plus,
  Sparkles,
  User,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn, getInitials } from "@/lib/utils"
import { formatExpiration } from "@/lib/format"

// Lazy-load ManualPaymentModal to reduce initial bundle size
const ManualPaymentModal = dynamic(
  () =>
    import("@/components/shared/payments/manual-payment-modal").then((mod) => ({
      default: mod.ManualPaymentModal,
    })),
  { ssr: false },
)

interface UserSidePanelProps {
  userId: Id<"users"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const accessTypeConfig = {
  exam: {
    icon: Zap,
    label: "Examens Simulés",
    gradient: "from-blue-600 to-indigo-600",
    bgGradient:
      "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
  },
  training: {
    icon: Sparkles,
    label: "Banque d'Entraînement",
    gradient: "from-emerald-600 to-teal-600",
    bgGradient:
      "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
  },
}

function AccessCard({
  type,
  access,
}: {
  type: "exam" | "training"
  access: {
    expiresAt: number
    daysRemaining: number
    isActive: boolean
  } | null
}) {
  const config = accessTypeConfig[type]
  const Icon = config.icon
  const isActive = access?.isActive ?? false
  const progressPercent = access
    ? Math.min((access.daysRemaining / 180) * 100, 100)
    : 0

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all",
        isActive
          ? "border-transparent bg-white shadow-sm dark:bg-gray-800"
          : "border-dashed border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              isActive
                ? cn("bg-gradient-to-br", config.gradient)
                : "bg-gray-200 dark:bg-gray-700",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                isActive ? "text-white" : "text-gray-400",
              )}
            />
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {config.label}
          </span>
        </div>
        {isActive && access ? (
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              access.daysRemaining <= 7
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
            )}
          >
            {access.daysRemaining}j restants
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-gray-200 text-xs text-gray-400 dark:border-gray-700"
          >
            Aucun accès
          </Badge>
        )}
      </div>

      {isActive && access && (
        <div className="mt-3 space-y-2">
          <Progress
            value={progressPercent}
            className="h-1.5"
            aria-label={`${access.daysRemaining} jours restants`}
          />
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            Expire le {formatExpiration(access.expiresAt)}
          </p>
        </div>
      )}
    </div>
  )
}

function TransactionItem({
  transaction,
}: {
  transaction: {
    _id: Id<"transactions">
    _creationTime: number
    status: "pending" | "completed" | "failed" | "refunded"
    amountPaid: number
    currency: string
    type: "stripe" | "manual"
    product: {
      name: string
    } | null
  }
}) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: currency === "XAF" ? "XAF" : "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === "XAF" ? 0 : 2,
    }).format(amount / 100)
  }

  const statusConfig = {
    completed: {
      icon: Check,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    pending: {
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    },
    failed: {
      icon: Clock,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
    refunded: {
      icon: Clock,
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-100 dark:bg-gray-800",
    },
  }

  const status = statusConfig[transaction.status]
  const StatusIcon = status.icon

  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50/80 px-3 py-2 dark:bg-gray-800/50">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-full p-1.5", status.bg)}>
          <StatusIcon className={cn("h-3 w-3", status.color)} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {transaction.product?.name ?? "Produit inconnu"}
          </p>
          <p className="text-xs text-gray-500">
            {format(new Date(transaction._creationTime), "d MMM yyyy", {
              locale: fr,
            })}
          </p>
        </div>
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">
        +{formatCurrency(transaction.amountPaid, transaction.currency)}
      </span>
    </div>
  )
}

function PanelContent({ userId }: { userId: Id<"users"> }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const panelData = useQuery(api.users.getUserPanelData, { userId })

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId)
    toast.success("ID copié")
  }

  if (panelData === undefined) {
    return (
      <div className="space-y-6 p-1">
        {/* Header skeleton */}
        <div className="flex flex-col items-center pt-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="mt-3 h-6 w-32" />
          <Skeleton className="mt-1 h-4 w-24" />
        </div>

        {/* Info skeleton */}
        <div className="space-y-3 rounded-xl bg-gray-50/80 p-4 dark:bg-gray-800/50">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>

        {/* Access skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!panelData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Utilisateur non trouvé</p>
      </div>
    )
  }

  const { user, examAccess, trainingAccess, recentTransactions, totalTransactionCount } =
    panelData

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 p-1"
      >
        {/* User Header */}
        <div className="flex flex-col items-center pt-2">
          <Avatar className="h-20 w-20 border-4 border-white shadow-lg dark:border-gray-800">
            <AvatarImage src={user.image} alt={user.name || "Utilisateur"} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-semibold text-white">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
            {user.name && user.name !== "null null" ? user.name : "Non défini"}
          </h3>
          {user.username && (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              @{user.username}
            </p>
          )}
          <Badge
            variant="outline"
            className={cn(
              "mt-2",
              user.role === "admin"
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400",
            )}
          >
            {user.role === "admin" ? "Administrateur" : "Utilisateur"}
          </Badge>
        </div>

        {/* User Info */}
        <div className="space-y-2 rounded-xl bg-gray-50/80 p-4 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {user.email}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Inscrit le{" "}
              {format(new Date(user._creationTime), "d MMMM yyyy", {
                locale: fr,
              })}
            </span>
          </div>
          {user.bio && (
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user.bio}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-xs text-gray-400">
              ID: {userId.slice(0, 12)}...
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={handleCopyId}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Access Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Accès
            </h4>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-xs"
              onClick={() => setShowPaymentModal(true)}
            >
              <Plus className="h-3 w-3" />
              Ajouter
            </Button>
          </div>
          <AccessCard type="exam" access={examAccess} />
          <AccessCard type="training" access={trainingAccess} />
        </div>

        {/* Transactions Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Transactions récentes
            </h4>
            {totalTransactionCount > 0 && (
              <Link href={`/admin/users/${userId}`}>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                  Voir tout ({totalTransactionCount})
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
          {recentTransactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              Aucune transaction
            </p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <TransactionItem key={tx._id} transaction={tx} />
              ))}
            </div>
          )}
        </div>

        {/* View Full Profile Link */}
        <Link href={`/admin/users/${userId}`} className="block">
          <Button variant="outline" className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            Voir le profil complet
          </Button>
        </Link>
      </motion.div>

      {/* Manual Payment Modal - lazy loaded on demand */}
      {showPaymentModal && (
        <ManualPaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          defaultUserId={userId}
        />
      )}
    </>
  )
}

export function UserSidePanel({
  userId,
  open,
  onOpenChange,
}: UserSidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] overflow-y-auto sm:max-w-[420px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Détails de l&apos;utilisateur</SheetTitle>
          <SheetDescription>
            Informations et gestion de l&apos;utilisateur
          </SheetDescription>
        </SheetHeader>
        {userId ? (
          <PanelContent userId={userId} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">Sélectionnez un utilisateur</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
