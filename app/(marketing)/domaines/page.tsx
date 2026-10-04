import { ArrowRight } from "lucide-react"
import { Metadata } from "next"
import Link from "next/link"
import { CtaBand } from "@/components/marketing/cta-band"
import { DemoQuestion } from "@/components/marketing/demo-question"
import {
  Eyebrow,
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { Button } from "@/components/ui/button"
import { DOMAINS } from "@/constants/domains"
import { HERO_QUESTION_KEY_ONLY } from "@/constants/sample-questions"
import { getCachedMarketingStats } from "@/features/marketing/cached"
import { cn } from "@/lib/utils"
import { DomainsBrowser } from "./_components/domains-browser"

export const metadata: Metadata = {
  title: "Domaines médicaux",
  description: `Explorez nos ${DOMAINS.length} domaines médicaux : cardiologie, pédiatrie, chirurgie, neurologie et plus. Questions EACMC organisées par spécialité pour une préparation ciblée.`,
  alternates: {
    canonical: "https://nomaqbanq.ca/domaines",
    languages: {
      "fr-CA": "https://nomaqbanq.ca/domaines",
    },
  },
  openGraph: {
    title: "Domaines médicaux | NOMAQbanq",
    description: `${DOMAINS.length} domaines médicaux pour préparer l'EACMC : cardiologie, pédiatrie, chirurgie, neurologie. Questions organisées par spécialité.`,
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - Domaines médicaux EACMC",
      },
    ],
  },
}

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

export default async function DomainesPage() {
  const stats = await getCachedMarketingStats()
  return (
    <>
      <MarketingHero
        label="Domaines"
        title={`${DOMAINS.length} domaines, organisés selon les objectifs du CMC.`}
        description={`Ciblez une discipline pour la réviser en profondeur, ou combinez-en plusieurs pour vous tester en conditions d'examen. ${stats.totalQuestions} QCM au total.`}
      />
      <section className={MARKETING_SECTION}>
        <div className={MARKETING_WRAP}>
          <DomainsBrowser />
        </div>
      </section>
      <section className={cn(MARKETING_SECTION, "bg-surface-2")}>
        <div
          className={cn(
            MARKETING_WRAP,
            "grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14",
          )}
        >
          <div className="flex flex-col gap-4">
            <Eyebrow>Évaluation gratuite</Eyebrow>
            <h2 className="type-h1 text-ink">Situez-vous avant de choisir.</h2>
            <p className="type-body-lg">
              Une série de questions tirées de plusieurs domaines, en conditions
              réelles, pour repérer vos points forts et vos lacunes.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild size="lg">
                <Link href="/evaluation/quiz">
                  Commencer l&apos;évaluation
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <DemoQuestion
            question={HERO_QUESTION_KEY_ONLY}
            mode="tutor"
            questionNumber={12}
            totalQuestions={50}
            caption="Exemple de question"
          />
        </div>
      </section>
      <CtaBand />
    </>
  )
}
