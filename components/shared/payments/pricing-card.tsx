"use client"

import { ArrowRight, Check } from "lucide-react"
import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { formatCurrency } from "@/lib/format"
import type { PricedProduct, Savings } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { AccessBadge, getAccessStatus } from "./access-badge"

type CurrentAccess = { expiresAt: number; daysRemaining: number }

export type PricingCardProduct = PricedProduct & {
  id: string
  name: string
  description: string
}

type PricingCardProps = {
  product: PricingCardProduct
  /** `featured` : le Pack Premium, pleine largeur au-dessus des accès séparés. */
  variant?: "default" | "featured"
  popular?: boolean
  savings?: Savings | null
  /** Accès en cours que ce produit prolonge : le sien, ou les deux pour le Pack Premium. */
  currentAccess?: {
    exam?: CurrentAccess | null
    training?: CurrentAccess | null
  }
  onPurchase: () => void
  isLoading?: boolean
}

const ACCESS = {
  exam: {
    label: "Examens simulés",
    shortLabel: "Examens",
    badgeClass: "bg-accent-soft text-accent-ink border-transparent",
    dotClass: "bg-accent",
    features: [
      "Accès aux examens blancs complets",
      "Chronomètre et conditions d'examen",
      "Correction détaillée",
      "Statistiques de performance",
    ],
  },
  training: {
    label: "Banque d'entraînement",
    shortLabel: "Entraînement",
    badgeClass: "bg-success-soft text-success-ink border-transparent",
    dotClass: "bg-success",
    features: [
      "3000+ questions d'entraînement",
      "Mode tuteur avec explications",
      "Filtrage par domaine médical",
      "Suivi de progression",
    ],
  },
} as const

const PREMIUM_EXTRAS = [
  "Statistiques de performance avancées",
  "Support prioritaire",
]

const FeatureItem = ({ children }: { children: string }) => (
  <li className="text-ink-2 flex items-start gap-2.5 text-sm">
    <Check aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
    {children}
  </li>
)

const TypeBadge = ({ type }: { type: "exam" | "training" }) => (
  <Badge className={cn("font-mono", ACCESS[type].badgeClass)}>
    <span aria-hidden className={cn("size-1.5", ACCESS[type].dotClass)} />
    {ACCESS[type].label}
  </Badge>
)

/**
 * Carte de prix de la vitrine : un accès simple, ou le Pack Premium en
 * variante `featured`. Le prix affiché vient du catalogue (`products`) ;
 * Stripe facture le prix résolu au checkout.
 */
export const PricingCard = ({
  product,
  variant = "default",
  popular = false,
  savings,
  currentAccess,
  onPurchase,
  isLoading = false,
}: PricingCardProps) => {
  // Un double-clic partirait avant que `isLoading` ne désactive le bouton.
  const clickedRef = useRef(false)
  useEffect(() => {
    if (!isLoading) clickedRef.current = false
  }, [isLoading])
  const handleClick = () => {
    if (clickedRef.current || isLoading) return
    clickedRef.current = true
    onPurchase()
  }

  const accesses = (
    product.isCombo ? (["exam", "training"] as const) : [product.accessType]
  ).map((type) => ({ type, access: currentAccess?.[type] ?? null }))
  const hasAccess = accesses.some((a) => a.access)

  const accessDetails = hasAccess && (
    <div className="bg-surface-2 border-line flex flex-col gap-2 rounded-md border p-3">
      <p className="text-ink-2 text-[13px] font-medium">
        {product.isCombo ? "Vos accès actuels" : "Votre accès actuel"}
      </p>
      <div className="flex flex-wrap gap-2">
        {accesses.map(({ type, access }) =>
          access ? (
            <AccessBadge
              key={type}
              accessType={type}
              status={getAccessStatus(access.expiresAt, access.daysRemaining)}
              daysRemaining={access.daysRemaining}
              size="sm"
            />
          ) : (
            <span key={type} className="text-ink-3 text-[13px]">
              {ACCESS[type].shortLabel} : aucun
            </span>
          ),
        )}
      </div>
    </div>
  )

  const buttonContent = isLoading ? (
    <>
      <Spinner size="sm" />
      Chargement…
    </>
  ) : (
    <>
      {variant === "featured"
        ? hasAccess
          ? "Prolonger mes accès"
          : "Choisir Premium"
        : hasAccess
          ? "Prolonger l'accès"
          : "Choisir"}
      {variant === "featured" && <ArrowRight aria-hidden />}
    </>
  )

  if (variant === "featured") {
    return (
      <article className="bg-surface border-line-strong grid overflow-hidden rounded-lg border lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4.5 p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-warning-line bg-warning-soft text-warning-ink font-mono">
              Meilleure offre
            </Badge>
            <Badge variant="outline" className="font-mono">
              Examens + Entraînement
            </Badge>
          </div>
          <h2 className="type-h2 text-ink">{product.name}</h2>
          <p className="text-ink-2 max-w-110 text-base leading-relaxed">
            {product.description}
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-ink font-serif text-[3.5rem] leading-none font-semibold tracking-[-0.02em]">
              {formatCurrency(product.priceCAD)}
            </span>
            {savings && (
              <span className="text-ink-3 text-lg line-through">
                {formatCurrency(savings.referenceCAD)}
              </span>
            )}
          </div>
          <p className="text-ink-2 font-mono text-[13px]">
            CAD · valide {product.durationDays}j
            {savings &&
              ` · vous économisez ${formatCurrency(savings.savedCAD)}`}
          </p>
          {accessDetails}
          <div className="mt-1">
            <Button
              size="lg"
              onClick={handleClick}
              disabled={isLoading}
              className="max-sm:w-full"
            >
              {buttonContent}
            </Button>
          </div>
        </div>
        <div className="bg-surface-2 border-line flex flex-col gap-5.5 border-t p-6 sm:p-8 lg:border-t-0 lg:border-l">
          {(["exam", "training"] as const).map((type) => (
            <div key={type} className="flex flex-col gap-2.5">
              <h3 className="type-label">{ACCESS[type].shortLabel}</h3>
              <ul className="flex flex-col gap-2.5">
                {ACCESS[type].features.slice(0, 3).map((f) => (
                  <FeatureItem key={f}>{f}</FeatureItem>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-col gap-2.5">
            <h3 className="type-label">Inclus</h3>
            <ul className="flex flex-col gap-2.5">
              {PREMIUM_EXTRAS.map((f) => (
                <FeatureItem key={f}>{f}</FeatureItem>
              ))}
            </ul>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        "bg-surface flex h-full flex-col rounded-lg border",
        popular ? "border-line-strong" : "border-line",
      )}
    >
      <div className="border-line flex flex-col gap-3 border-b px-5.5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TypeBadge type={product.accessType} />
          {popular && (
            <Badge variant="outline" className="font-mono">
              Populaire
            </Badge>
          )}
        </div>
        <h3 className="text-ink text-base font-semibold">{product.name}</h3>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-ink font-serif text-[2.5rem] leading-none font-semibold tracking-[-0.02em]">
            {formatCurrency(product.priceCAD)}
          </span>
          <span className="text-ink-3 font-mono text-xs">
            CAD · {product.durationDays}j
          </span>
        </div>
        <p
          className={cn(
            "min-h-4.5 text-[13px]",
            savings ? "text-success-ink" : "text-ink-3",
          )}
        >
          {savings
            ? `Économisez ${savings.percent} % par rapport au mensuel`
            : "Sans engagement"}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5.5 py-4.5">
        {accessDetails}
        <ul className="flex flex-1 flex-col gap-2.5">
          {ACCESS[product.accessType].features.map((f) => (
            <FeatureItem key={f}>{f}</FeatureItem>
          ))}
        </ul>
      </div>
      <div className="px-5.5 pb-5.5">
        <Button
          variant={popular ? "default" : "outline"}
          onClick={handleClick}
          disabled={isLoading}
          className="w-full max-md:h-11"
        >
          {buttonContent}
        </Button>
      </div>
    </article>
  )
}
