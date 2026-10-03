"use client"

import { type LucideIcon, RefreshCw, TriangleAlert } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ErrorStateProps = {
  title: string
  description?: string
  icon?: LucideIcon
  onRetry?: () => void
  retryHref?: string
  actions?: ReactNode
  footnote?: string
  /** Contenu technique affiché sous la description (message, digest). */
  details?: ReactNode
  /** `page` : écran entier centré ; `inline` : dans une zone de la page. */
  variant?: "page" | "inline"
}

export const ErrorState = ({
  title,
  description,
  icon: Icon = TriangleAlert,
  onRetry,
  retryHref,
  actions,
  footnote,
  details,
  variant = "inline",
}: ErrorStateProps) => {
  // Un seul h1 par page : la variante intégrée vit sous l'en-tête de la page.
  const Heading = variant === "page" ? "h1" : "h2"
  const retry = retryHref ? (
    <Button asChild className="gap-2">
      <Link href={retryHref}>
        <RefreshCw className="h-4 w-4" />
        Réessayer
      </Link>
    </Button>
  ) : onRetry ? (
    <Button type="button" onClick={onRetry} className="gap-2">
      <RefreshCw className="h-4 w-4" />
      Réessayer
    </Button>
  ) : null

  return (
    <div
      className={cn(
        "flex items-center justify-center p-4",
        variant === "page" ? "bg-background min-h-screen" : "min-h-40",
      )}
    >
      <div
        role="alert"
        className={cn(
          "w-full max-w-lg space-y-4 text-center",
          variant === "page" &&
            "bg-surface border-line shadow-1 rounded-lg border p-6",
        )}
      >
        <Icon aria-hidden className="text-danger-ink mx-auto size-8" />
        <Heading className="text-ink text-xl font-semibold">{title}</Heading>
        {description && <p className="text-ink-2">{description}</p>}
        {details}
        {(retry || actions) && (
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            {retry}
            {actions}
          </div>
        )}
        {footnote && <p className="text-ink-3 text-xs">{footnote}</p>}
      </div>
    </div>
  )
}
