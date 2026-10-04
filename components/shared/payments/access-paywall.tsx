import { ArrowRight, CircleAlert, Lock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { AccessType } from "@/features/payments/access-ledger"
import { formatCurrency, formatExpiration } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ACCESS_TYPE_LABEL } from "./access-badge"

type Copy = {
  title: string
  pitch: string
  expiredNext: string
  /** Bandeau : la page reste lisible, une ligne dit ce qui manque. */
  banner: { pitch: string; pitchTail: string; expired: string }
}

const COPY: Record<AccessType, Copy> = {
  exam: {
    title: "Examens blancs non disponibles",
    pitch: "Les examens blancs demandent un accès Examens ou le Pack Premium.",
    expiredNext:
      "Vos résultats passés restent consultables dans votre progression. Prolongez l'accès pour passer les prochains examens blancs.",
    banner: {
      pitch:
        "Les examens réservés aux abonnés demandent un accès Examens ou le Pack Premium",
      pitchTail: ". Les examens sur invitation restent accessibles.",
      expired:
        "Vos scores restent affichés. La correction et les examens réservés aux abonnés demandent un accès actif.",
    },
  },
  training: {
    title: "Entraînement non disponible",
    pitch:
      "La banque de 3000+ questions, le mode tuteur et votre historique d'entraînement demandent un accès Entraînement ou le Pack Premium.",
    expiredNext:
      "Vos séries passées restent consultables dans votre progression. Prolongez l'accès pour composer de nouvelles séries.",
    banner: {
      pitch:
        "Les séries d'entraînement demandent un accès Entraînement ou le Pack Premium",
      pitchTail: ".",
      expired:
        "Vos séries passées restent consultables. Composer une nouvelle série demande un accès actif.",
    },
  },
}

type AccessPaywallProps = {
  type: AccessType
  /** Échéance passée (epoch ms) : « Votre accès … a expiré le … ». */
  expiredAt?: number | null
  /** Prix d'appel mensuel du catalogue, en cents ; absent, la phrase s'en passe. */
  priceFromCents?: number | null
  /**
   * `card` : la page entière est derrière l'accès. `banner` : la page reste
   * (liste des examens), une ligne au-dessus dit ce qui manque.
   */
  variant?: "card" | "banner"
  testId?: string
  className?: string
}

const Price = ({ cents }: { cents: number }) => (
  <span className="text-ink font-mono">
    {formatCurrency(cents, "CAD", { whole: true })}
  </span>
)

/**
 * Surface d'une page qui exige un accès payant : sans accès, la présentation et
 * le prix d'appel lu dans le catalogue ; accès échu, la date et « Prolonger ».
 * Rendu serveur (liens, aucun état).
 */
export const AccessPaywall = ({
  type,
  expiredAt,
  priceFromCents,
  variant = "card",
  testId = "access-paywall",
  className,
}: AccessPaywallProps) => {
  const copy = COPY[type]
  const expired = expiredAt != null
  const Icon = expired ? CircleAlert : Lock
  const label = ACCESS_TYPE_LABEL[type]
  const expiredTitle = `Votre accès ${label} a expiré le ${formatExpiration(expiredAt ?? 0)}`

  if (variant === "banner") {
    return (
      <section
        aria-label={`Accès ${label}`}
        data-testid={testId}
        className={cn(
          "border-line-strong bg-surface flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-5 py-4",
          className,
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-4.5", expired ? "text-danger-ink" : "text-ink-3")}
        />
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
          <p className="text-ink text-base font-semibold">
            {expired ? expiredTitle : `Accès ${label} requis`}
          </p>
          <p className="text-ink-2 text-sm leading-normal text-pretty">
            {expired ? (
              copy.banner.expired
            ) : (
              <>
                {copy.banner.pitch}
                {priceFromCents != null && (
                  <>
                    , à partir de <Price cents={priceFromCents} /> pour 1 mois
                  </>
                )}
                {copy.banner.pitchTail}
              </>
            )}
          </p>
        </div>
        <Button asChild className="max-md:h-11 max-md:w-full">
          <Link href="/tarifs">
            {expired ? "Prolonger l'accès" : "Voir les tarifs"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    )
  }

  return (
    <section
      data-testid={testId}
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
        {expired ? expiredTitle : copy.title}
      </h2>
      <p className="text-ink-2 max-w-130 text-base leading-relaxed">
        {expired ? (
          copy.expiredNext
        ) : (
          <>
            {copy.pitch}
            {priceFromCents != null && (
              <>
                {" "}
                À partir de <Price cents={priceFromCents} /> pour 1 mois ; le
                temps se cumule si vous prolongez.
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
