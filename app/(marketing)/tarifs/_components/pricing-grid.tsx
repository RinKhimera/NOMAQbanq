"use client"

import { PackageX } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Eyebrow } from "@/components/marketing/marketing-hero"
import {
  AccessBadge,
  getAccessStatus,
} from "@/components/shared/payments/access-badge"
import { PricingCard } from "@/components/shared/payments/pricing-card"
import { EmptyState } from "@/components/ui/empty-state"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { AccessStatus, ProductView } from "@/features/payments/dal"
import { useCheckout } from "@/hooks/use-checkout"
import { MONTH_DAYS, savingsOf } from "@/lib/pricing"
import { cn } from "@/lib/utils"

type AccessFilter = "all" | "exam" | "training"

const FILTERS: { value: AccessFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "exam", label: "Examens" },
  { value: "training", label: "Entraînement" },
]

interface PricingGridProps {
  products: ProductView[]
  accessStatus: AccessStatus | null
  isAuthenticated: boolean
}

export const PricingGrid = ({
  products,
  accessStatus,
  isAuthenticated,
}: PricingGridProps) => {
  const [filter, setFilter] = useState<AccessFilter>("all")
  const { checkout, pendingProduct } = useCheckout()
  const router = useRouter()

  const handlePurchase = async (productCode: string) => {
    if (!isAuthenticated) {
      router.push("/inscription")
      return
    }
    await checkout(productCode, {
      successPath: "/tableau-de-bord/paiement/succes",
      cancelPath: "/tarifs",
    })
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icons={[PackageX]}
        title="Aucune offre disponible"
        description="Les offres seront bientôt disponibles. Revenez plus tard."
        className="mx-auto"
      />
    )
  }

  const premium = products.find((p) => p.isCombo)
  const separate = products
    .filter((p) => !p.isCombo)
    .filter((p) => filter === "all" || p.accessType === filter)
    .toSorted((a, b) =>
      a.accessType !== b.accessType
        ? a.accessType === "exam"
          ? -1
          : 1
        : b.durationDays - a.durationDays,
    )

  const currentAccess = {
    exam: accessStatus?.examAccess ?? null,
    training: accessStatus?.trainingAccess ?? null,
  }
  const hasAnyAccess =
    isAuthenticated && !!(currentAccess.exam || currentAccess.training)

  return (
    <div className="flex flex-col gap-14">
      {hasAnyAccess && (
        <div className="bg-surface border-line flex flex-col gap-3 rounded-lg border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink text-[15px] font-semibold">
              Vos accès actuels
            </p>
            <div className="flex flex-wrap gap-2">
              {(["exam", "training"] as const).map((type) => {
                const access = currentAccess[type]
                return (
                  access && (
                    <AccessBadge
                      key={type}
                      accessType={type}
                      status={getAccessStatus(
                        access.expiresAt,
                        access.daysRemaining,
                      )}
                      daysRemaining={access.daysRemaining}
                      showDetails
                    />
                  )
                )
              })}
            </div>
          </div>
          <p className="text-ink-3 text-sm">
            Prolongez votre accès avant expiration pour cumuler le temps restant
            avec le nouvel achat.
          </p>
        </div>
      )}

      {premium && (
        <PricingCard
          variant="featured"
          product={premium}
          savings={savingsOf(products, premium)}
          currentAccess={currentAccess}
          onPurchase={() => handlePurchase(premium.code)}
          isLoading={pendingProduct === premium.code}
        />
      )}

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <Eyebrow>Accès séparés</Eyebrow>
            <h2 className="type-h3 text-ink">
              Examens ou entraînement, à la carte
            </h2>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            value={filter}
            onValueChange={(v) => v && setFilter(v as AccessFilter)}
            aria-label="Filtrer les offres par type d'accès"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem
                key={f.value}
                value={f.value}
                className="px-3.5 whitespace-nowrap max-md:h-11"
              >
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div
          className={cn(
            "grid gap-4 md:grid-cols-2",
            separate.length > 2 ? "lg:grid-cols-4" : "max-w-190",
          )}
        >
          {separate.map((product) => (
            <PricingCard
              key={product.id}
              product={product}
              popular={product.durationDays > MONTH_DAYS}
              savings={savingsOf(products, product)}
              currentAccess={currentAccess}
              onPurchase={() => handlePurchase(product.code)}
              isLoading={pendingProduct === product.code}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
