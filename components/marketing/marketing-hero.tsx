import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Conteneur de la vitrine : 1152 px, marge 24 px (16 px sous 640 px). */
export const MARKETING_WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6"

/** Section de contenu : filet bas, 96 px de marge verticale (64 px sur mobile). */
export const MARKETING_SECTION = "border-line border-b py-16 md:py-20 lg:py-24"

type EyebrowProps = {
  children: ReactNode
  /** Carré d'accent devant le libellé : réservé aux en-têtes de page. */
  square?: boolean
  className?: string
}

export const Eyebrow = ({
  children,
  square = false,
  className,
}: EyebrowProps) => (
  <span
    className={cn(
      "text-accent-ink flex items-center gap-2 font-mono text-xs font-medium tracking-[0.06em] uppercase",
      className,
    )}
  >
    {square && <span aria-hidden className="bg-accent size-1.5 shrink-0" />}
    {children}
  </span>
)

type MarketingHeroProps = {
  label: ReactNode
  title: ReactNode
  description?: ReactNode
  /** `display` : titre de héros (accueil, évaluation), avec `aside` à droite. */
  size?: "page" | "display"
  /** Au-dessus du libellé (fil d'Ariane). */
  breadcrumb?: ReactNode
  /** Colonne de droite, dès 1024 px ; dessous en deçà. */
  aside?: ReactNode
  /** Bande pleine largeur sous le héros (grille de chiffres). */
  band?: ReactNode
  /** Sous le paragraphe : actions, recherche, preuve sociale. */
  children?: ReactNode
}

/**
 * En-tête des pages de la vitrine sur trame de points : libellé, `h1` unique
 * de la page, paragraphe.
 */
export const MarketingHero = ({
  label,
  title,
  description,
  size = "page",
  breadcrumb,
  aside,
  band,
  children,
}: MarketingHeroProps) => {
  const isDisplay = size === "display"
  const text = (
    <div className={cn("flex flex-col", isDisplay ? "gap-6" : "gap-5")}>
      {breadcrumb}
      <Eyebrow square>{label}</Eyebrow>
      <h1
        className={cn(
          "text-ink max-w-205",
          isDisplay ? "type-display" : "type-h1",
        )}
      >
        {title}
      </h1>
      {description && (
        <p
          className={cn(
            "type-body-lg",
            isDisplay || aside ? "max-w-130" : "max-w-160",
          )}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  )

  return (
    <section className="bg-dots-fade border-line border-b">
      <div
        className={cn(
          MARKETING_WRAP,
          "relative",
          isDisplay
            ? "pt-16 pb-14 lg:pt-22 lg:pb-18"
            : "pt-14 pb-12 lg:pt-18 lg:pb-14",
          aside &&
            "grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14",
        )}
      >
        {text}
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
      {band && (
        <div className="border-line bg-surface relative border-t">
          <div className="mx-auto max-w-6xl">{band}</div>
        </div>
      )}
    </section>
  )
}
