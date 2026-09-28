"use client"

import {
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Mail,
  Plus,
  User,
} from "lucide-react"
import { motion } from "motion/react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AccessCard } from "@/components/shared/payments/access-card"
import { RolePill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProductView } from "@/features/payments/dal"
import { loadUserPanelData } from "@/features/users/actions"
import type {
  PanelTransaction,
  SelectableUser,
  UserPanelData,
} from "@/features/users/dal"
import {
  formatCurrency,
  formatExpiration,
  formatMediumDate,
  formatPresentmentAmount,
} from "@/lib/format"
import { cn } from "@/lib/utils"

// Lazy-load ManualPaymentModal to reduce initial bundle size
const ManualPaymentModal = dynamic(
  () =>
    import("@/components/shared/payments/manual-payment-modal").then((mod) => ({
      default: mod.ManualPaymentModal,
    })),
  { ssr: false },
)

interface UserSidePanelProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductView[]
  users: SelectableUser[]
  /** Appelé après un octroi d'accès → laisse le parent rafraîchir la liste. */
  onMutated?: () => void
}

function TransactionItem({ transaction }: { transaction: PanelTransaction }) {
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
            {formatMediumDate(transaction.createdAt)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          +{formatCurrency(transaction.amountPaid, transaction.currency)}
        </span>
        {transaction.presentmentCurrency !== null &&
          transaction.presentmentAmount !== null && (
            <p className="text-xs text-gray-500">
              présenté :{" "}
              {formatPresentmentAmount(
                transaction.presentmentAmount,
                transaction.presentmentCurrency,
              )}
            </p>
          )}
      </div>
    </div>
  )
}

function PanelContent({
  userId,
  products,
  users,
  onMutated,
}: {
  userId: string
  products: ProductView[]
  users: SelectableUser[]
  onMutated?: () => void
}) {
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [panelData, setPanelData] = useState<UserPanelData | null | undefined>(
    undefined,
  )

  // Recharge les données du panel (depuis un handler, après un octroi d'accès).
  const refresh = () => {
    setPanelData(undefined)
    loadUserPanelData(userId)
      .then(setPanelData)
      .catch(() => {
        setPanelData(null)
        toast.error("Chargement impossible. Vérifiez votre réseau.")
      })
  }
  // Chargement initial. `PanelContent` est monté avec `key={userId}` → un nouvel
  // utilisateur = nouveau montage (état `undefined` = skeleton), pas de setState
  // synchrone dans l'effet (uniquement dans le callback async).
  useEffect(() => {
    let active = true
    loadUserPanelData(userId)
      .then((d) => {
        if (active) setPanelData(d)
      })
      .catch(() => {
        if (!active) return
        setPanelData(null)
        toast.error("Chargement impossible. Vérifiez votre réseau.")
      })
    return () => {
      active = false
    }
  }, [userId])

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

  const {
    user,
    examAccess,
    trainingAccess,
    recentTransactions,
    totalTransactionCount,
  } = panelData

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 p-1"
      >
        {/* User Header */}
        <div className="flex flex-col items-center pt-2">
          <UserAvatar
            name={user.name}
            image={user.image}
            className="h-20 w-20 border-4 border-white shadow-lg dark:border-gray-800"
            fallbackClassName="bg-linear-to-br from-blue-500 to-indigo-600 text-xl font-semibold text-white"
          />
          <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
            {user.name && user.name !== "null null" ? user.name : "Non défini"}
          </h3>
          {user.username && (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              @{user.username}
            </p>
          )}
          <RolePill role={user.role} className="mt-2" />
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
              Inscrit le {formatExpiration(user.createdAt)}
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
          <AccessCard type="exam" access={examAccess} size="compact" />
          <AccessCard type="training" access={trainingAccess} size="compact" />
        </div>

        {/* Transactions Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Transactions récentes
            </h4>
            {totalTransactionCount > 0 && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
              >
                <Link href={`/admin/utilisateurs/${userId}`}>
                  Voir tout ({totalTransactionCount})
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
          {recentTransactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              Aucune transaction
            </p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </div>

        {/* View Full Profile Link */}
        <Button asChild variant="outline" className="w-full gap-2">
          <Link href={`/admin/utilisateurs/${userId}`}>
            <ExternalLink className="h-4 w-4" />
            Voir le profil complet
          </Link>
        </Button>
      </motion.div>

      {/* Manual Payment Modal - lazy loaded on demand */}
      {showPaymentModal && (
        <ManualPaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          defaultUserId={userId}
          products={products}
          users={users}
          onSuccess={() => {
            refresh()
            onMutated?.()
          }}
        />
      )}
    </>
  )
}

export function UserSidePanel({
  userId,
  open,
  onOpenChange,
  products,
  users,
  onMutated,
}: UserSidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-105 overflow-y-auto sm:max-w-105"
        data-testid="user-side-panel"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Détails de l&apos;utilisateur</SheetTitle>
          <SheetDescription>
            Informations et gestion de l&apos;utilisateur
          </SheetDescription>
        </SheetHeader>
        {userId ? (
          <PanelContent
            key={userId}
            userId={userId}
            products={products}
            users={users}
            onMutated={onMutated}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">Sélectionnez un utilisateur</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
