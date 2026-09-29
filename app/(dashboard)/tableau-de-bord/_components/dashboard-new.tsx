import {
  BookOpen,
  CircleCheck,
  ClipboardCheck,
  Info,
  Lock,
  Percent,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { PageIntro } from "@/components/shared/page-intro"
import { VitalCard } from "@/components/shared/vital-card"
import { Button } from "@/components/ui/button"
import type { ProductView } from "@/features/payments/dal"
import { formatCurrency } from "@/lib/format"
import { MONTH_DAYS } from "@/lib/pricing"
import { TONE_SOFT, TONE_TEXT } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { GRID_4 } from "./dashboard-view"

/**
 * « Examens ou Entraînement dès 50 $ pour 1 mois, ou le Pack Premium : les
 * deux pendant 6 mois pour 350 $. » Prix et durées lus dans le catalogue ;
 * une offre absente du catalogue disparaît de la phrase.
 */
export const accessOffer = (products: readonly ProductView[]): string => {
  const monthly = products
    .filter((p) => !p.isCombo && p.durationDays === MONTH_DAYS)
    .toSorted((a, b) => a.priceCAD - b.priceCAD)[0]
  const combo = products.find((p) => p.isCombo)
  const parts = [
    monthly &&
      `Examens ou Entraînement dès ${formatCurrency(monthly.priceCAD, "CAD", { whole: true })} pour 1 mois`,
    combo &&
      `le Pack Premium : les deux pendant ${Math.round(combo.durationDays / MONTH_DAYS)} mois pour ${formatCurrency(combo.priceCAD, "CAD", { whole: true })}`,
  ].filter(Boolean)
  if (parts.length === 0)
    return "Choisissez un accès Examens, Entraînement ou le Pack Premium."
  return `${parts.join(", ou ")}.`
}

type Step = {
  title: string
  description: string
  action: ReactNode
  locked?: boolean
}

/** Tableau de bord d'un nouvel inscrit : aucun accès, aucun historique. */
export const DashboardNew = ({
  firstName,
  products,
}: {
  firstName: string
  products: ProductView[]
}) => {
  const steps: Step[] = [
    {
      title: "Faites l'évaluation gratuite",
      description:
        "10 questions, 20 secondes par question, pour vous situer. Environ 3 minutes.",
      action: (
        <Button asChild size="sm" variant="outline" className="max-md:h-11">
          <Link href="/evaluation">Commencer</Link>
        </Button>
      ),
    },
    {
      title: "Activez un accès",
      description: accessOffer(products),
      action: (
        <Button asChild size="sm" className="max-md:h-11">
          <Link href="/tarifs">Voir les tarifs</Link>
        </Button>
      ),
    },
    {
      title: "Lancez votre première série",
      description: "Choisissez un domaine et révisez en mode tuteur.",
      locked: true,
      action: (
        <Button size="sm" variant="outline" disabled className="max-md:h-11">
          Nouvelle série
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageIntro
        eyebrow="Bienvenue"
        title={`Bonjour ${firstName}.`}
        description="Votre compte est créé. Trois étapes pour commencer votre préparation à l'EACMC Partie I."
      />

      <ol className="bg-surface border-line shadow-1 rounded-lg border">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "border-line grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-4 border-t px-6 py-5 first:border-t-0 max-md:grid-cols-[1.5rem_minmax(0,1fr)] max-md:p-4.5",
              step.locked && "opacity-70",
            )}
          >
            <span className="text-accent-ink font-mono text-[0.8125rem]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-ink flex items-center gap-2 font-semibold">
                {step.title}
                {step.locked && (
                  <Lock
                    className="text-ink-3 size-3.5"
                    aria-label="Verrouillé"
                  />
                )}
              </p>
              <p className="text-ink-2 text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
            <div className="shrink-0 max-md:col-start-2">{step.action}</div>
          </li>
        ))}
      </ol>

      <div className={GRID_4}>
        <VitalCard
          label="Score moyen"
          value="—"
          icon={Percent}
          subtitle="Aucun examen"
        />
        <VitalCard
          label="Examens complétés"
          value="0"
          icon={ClipboardCheck}
          subtitle="Accès Examens requis"
        />
        <VitalCard
          label="Entraînements"
          value="0"
          icon={BookOpen}
          subtitle="Accès Entraînement requis"
        />
        <VitalCard
          label="Taux de complétion"
          value="—"
          icon={CircleCheck}
          subtitle="Aucun examen"
        />
      </div>

      <div
        className={cn(
          "flex flex-wrap items-start gap-3 rounded-lg border p-4",
          TONE_SOFT.info,
        )}
      >
        <Info
          className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT.info)}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
          <p className="text-ink text-sm font-semibold">
            Vos statistiques apparaîtront ici
          </p>
          <p className="text-ink-2 text-sm">
            Score par domaine, évolution et historique des examens se
            remplissent dès votre première série.
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="max-md:h-11 max-md:w-full"
        >
          <Link href="/tableau-de-bord/abonnements">Mes accès</Link>
        </Button>
      </div>
    </>
  )
}
