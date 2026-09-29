import { ArrowRight, CircleAlert, Lock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { AccessType } from "@/features/payments/access-ledger"
import { formatCurrency, formatExpiration } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ACCESS_TYPE_LABEL } from "./access-badge"

const COPY: Record<
  AccessType,
  { title: string; pitch: string; expiredNext: string }
> = {
  exam: {
    title: "Examens blancs non disponibles",
    pitch: "Les examens blancs demandent un accès Examens ou le Pack Premium.",
    expiredNext:
      "Vos résultats passés restent consultables dans votre progression. Prolongez l'accès pour passer les prochains examens blancs.",
  },
  training: {
    title: "Entraînement non disponible",
    pitch:
      "La banque de 3000+ questions, le mode tuteur et votre historique d'entraînement demandent un accès Entraînement ou le Pack Premium.",
    expiredNext:
      "Vos séries passées restent consultables dans votre progression. Prolongez l'accès pour composer de nouvelles séries.",
  },
}

type AccessPaywallProps = {
  type: AccessType
  /** Échéance passée (epoch ms) : « Votre accès … a expiré le … ». */
  expiredAt?: number | null
  /** Prix d'appel mensuel du catalogue, en cents ; absent, la phrase s'en passe. */
  priceFromCents?: number | null
  className?: string
}

/**
 * Carte d'une page qui exige un accès payant : sans accès, la présentation et
 * le prix d'appel lu dans le catalogue ; accès échu, la date et « Prolonger ».
 * Rendu serveur (liens, aucun état).
 */
export const AccessPaywall = ({
  type,
  expiredAt,
  priceFromCents,
  className,
}: AccessPaywallProps) => {
  const copy = COPY[type]
  const expired = expiredAt != null
  const Icon = expired ? CircleAlert : Lock

  return (
    <section
      data-testid="access-paywall"
      className={cn(
        "bg-surface border-line shadow-1 flex flex-col items-start gap-3.5 rounded-lg border p-6 sm:p-7",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-5", expired ? "text-danger" : "text-ink-3")}
      />
      <h2 className="type-h3 text-ink">
        {expired
          ? `Votre accès ${ACCESS_TYPE_LABEL[type]} a expiré le ${formatExpiration(expiredAt)}`
          : copy.title}
      </h2>
      <p className="text-ink-2 max-w-130 text-[15px] leading-relaxed">
        {expired ? (
          copy.expiredNext
        ) : (
          <>
            {copy.pitch}
            {priceFromCents != null && (
              <>
                {" "}
                À partir de{" "}
                <span className="text-ink font-mono">
                  {formatCurrency(priceFromCents, "CAD", { whole: true })}
                </span>{" "}
                pour 1 mois ; le temps se cumule si vous prolongez.
              </>
            )}
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2 pt-0.5 max-md:w-full max-md:*:flex-1">
        <Button asChild className="max-md:h-11">
          <Link href="/tarifs">
            {expired ? "Prolonger l'accès" : "Voir les tarifs"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="max-md:h-11">
          <Link href={expired ? "/tableau-de-bord" : "/evaluation"}>
            {expired ? "Voir ma progression" : "Faire l'évaluation gratuite"}
          </Link>
        </Button>
      </div>
    </section>
  )
}
