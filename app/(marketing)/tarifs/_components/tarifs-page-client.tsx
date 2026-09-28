import { CtaBand } from "@/components/marketing/cta-band"
import { type FaqItem, FaqSection } from "@/components/marketing/faq-section"
import {
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { ProofLine } from "@/components/marketing/proof-line"
import type { MarketingStats } from "@/features/marketing/dal"
import type { AccessStatus, ProductView } from "@/features/payments/dal"
import { formatCurrency } from "@/lib/format"
import { savingsOf } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { PricingGrid } from "./pricing-grid"

const FACTS = [
  {
    title: "Temps cumulable",
    description:
      "Prolongez avant l'expiration : le temps restant s'ajoute au nouvel achat.",
  },
  {
    title: "Paiement sécurisé",
    description:
      "Visa, Mastercard et Amex via Stripe. Accès activé immédiatement.",
  },
  {
    title: "Garantie 14 jours",
    description: "Remboursement complet si la plateforme ne vous convient pas.",
  },
]

const ACCESS_TYPES_INTRO =
  "Deux types d'accès : l'accès Examens (examens simulés en mode réaliste) et l'accès Entraînement (banque de 3000+ questions avec mode tuteur)."

/** Prix de la réponse lus dans le catalogue, comme ceux des cartes au-dessus. */
const accessTypesAnswer = (products: ProductView[]): string => {
  const exam = products.filter((p) => !p.isCombo && p.accessType === "exam")
  const monthly = exam.find((p) => p.durationDays === 30)
  const halfYear = exam.find((p) => p.durationDays === 180)
  if (!monthly || !halfYear) {
    return `${ACCESS_TYPES_INTRO} Chacun est offert en formule 1 mois ou 6 mois.`
  }
  const price = (cents: number) => formatCurrency(cents, "CAD", { whole: true })
  const savings = savingsOf(products, halfYear)
  return `${ACCESS_TYPES_INTRO} Chacun est offert en formule 1 mois (${price(monthly.priceCAD)} CA) ou 6 mois (${price(halfYear.priceCAD)} CA${savings ? `, soit environ ${savings.percent} % d'économie` : ""}).`
}

const faqOf = (products: ProductView[]): FaqItem[] => [
  {
    question: "Quels sont les types d'accès disponibles ?",
    answer: accessTypesAnswer(products),
  },
  {
    question: "Comment fonctionne le temps cumulable ?",
    answer:
      "Si vous prolongez votre accès avant son expiration, le temps restant s'ajoute à votre nouvel achat. Par exemple, s'il vous reste 15 jours et que vous achetez 30 jours, vous aurez 45 jours au total.",
  },
  {
    question: "Quels modes de paiement acceptez-vous ?",
    answer:
      "Les cartes de crédit et de débit (Visa, Mastercard, Amex) via Stripe. L'accès est activé dès la confirmation du paiement.",
  },
  {
    question: "Puis-je obtenir un remboursement ?",
    answer:
      "Une garantie de satisfaction de 14 jours s'applique. Contactez-nous dans les 14 premiers jours pour un remboursement complet.",
  },
]

export default function TarifsPageClient({
  products,
  accessStatus,
  stats,
  isAuthenticated,
}: {
  products: ProductView[]
  accessStatus: AccessStatus | null
  stats: MarketingStats
  isAuthenticated: boolean
}) {
  return (
    <>
      <MarketingHero
        label="Tarifs"
        title="Choisissez votre accès."
        description="Des formules d'accès flexibles, en dollars canadiens. Les offres 6 mois reviennent moins cher que le mensuel."
      >
        <div className="pt-1">
          <ProofLine totalUsers={stats.totalUsers} />
        </div>
      </MarketingHero>

      <section className={MARKETING_SECTION}>
        <div className={cn(MARKETING_WRAP, "flex flex-col gap-14")}>
          <PricingGrid
            products={products}
            accessStatus={accessStatus}
            isAuthenticated={isAuthenticated}
          />
          <ul className="border-line bg-line grid gap-px overflow-hidden rounded-lg border md:grid-cols-2 lg:grid-cols-3">
            {FACTS.map((fact) => (
              <li
                key={fact.title}
                className="bg-background flex flex-col gap-1.5 px-6 py-5.5"
              >
                <span className="text-ink text-[15px] font-semibold">
                  {fact.title}
                </span>
                <span className="text-ink-2 text-sm leading-normal">
                  {fact.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FaqSection title="Abonnements et tarifs" items={faqOf(products)} />
      <CtaBand />
    </>
  )
}
