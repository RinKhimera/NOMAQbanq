import { ArrowRight } from "lucide-react"
import { Metadata } from "next"
import Link from "next/link"
import { CtaBand } from "@/components/marketing/cta-band"
import { DemoQuestion } from "@/components/marketing/demo-question"
import { FeatureCells } from "@/components/marketing/feature-cells"
import { MarketingFigures } from "@/components/marketing/marketing-figures"
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
import { TimerDemo } from "./_components/timer-demo"

export const metadata: Metadata = {
  title: "Évaluation gratuite",
  description:
    "Testez gratuitement NOMAQbanq avec notre évaluation EACMC. Découvrez notre interface, la qualité de nos questions et évaluez votre niveau avant de vous abonner.",
  alternates: {
    canonical: "https://nomaqbanq.ca/evaluation",
    languages: {
      "fr-CA": "https://nomaqbanq.ca/evaluation",
    },
  },
  openGraph: {
    title: "Évaluation gratuite EACMC | NOMAQbanq",
    description:
      "Testez gratuitement notre plateforme de préparation EACMC. Découvrez la qualité de nos questions et évaluez votre niveau.",
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - Évaluation gratuite EACMC",
      },
    ],
  },
}

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

const STEPS = [
  {
    title: "Temps limité",
    description:
      "20 secondes par question pour simuler les conditions réelles de l'examen.",
  },
  {
    title: "Questions variées",
    description:
      "Sélection aléatoire couvrant tous les domaines médicaux de l'EACMC.",
  },
  {
    title: "Résultats détaillés",
    description:
      "Analyse de vos performances par domaine, avec des recommandations pour la suite.",
  },
]

const StartButton = () => (
  <Button asChild size="lg">
    <Link href="/evaluation/quiz">
      Commencer l&apos;évaluation
      <ArrowRight aria-hidden />
    </Link>
  </Button>
)

export default async function EvaluationPage() {
  const stats = await getCachedMarketingStats()
  return (
    <>
      <MarketingHero
        size="display"
        label="Évaluation gratuite · EACMC Partie I"
        title="Testez vos connaissances en conditions réelles."
        description="Évaluez votre niveau avec des questions adaptées à l'examen d'aptitude du Conseil médical du Canada, et obtenez un bilan détaillé pour orienter votre préparation."
        aside={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="type-label">Aperçu · mode chronométré</span>
              <TimerDemo />
            </div>
            <DemoQuestion
              question={HERO_QUESTION_KEY_ONLY}
              mode="exam"
              questionNumber={12}
              totalQuestions={50}
            />
          </div>
        }
        band={
          <MarketingFigures
            figures={[
              { value: stats.totalQuestions, label: "questions disponibles" },
              { value: stats.successRate, label: "taux de réussite moyen" },
              { value: String(DOMAINS.length), label: "domaines médicaux" },
              { value: stats.totalUsers, label: "candidats préparés" },
            ]}
          />
        }
      >
        <div className="flex flex-wrap gap-2.5">
          <StartButton />
          <Button asChild size="lg" variant="outline">
            <Link href="/tarifs">Voir les tarifs</Link>
          </Button>
        </div>
      </MarketingHero>

      <section className={MARKETING_SECTION}>
        <div className={MARKETING_WRAP}>
          <div className="mb-10 flex max-w-160 flex-col gap-3.5">
            <Eyebrow>Comment ça fonctionne</Eyebrow>
            <h2 className="type-h1 text-ink">
              Trois choses à savoir avant de commencer
            </h2>
          </div>
          <FeatureCells items={STEPS} titleSize="h3" />
          <div className="bg-surface border-line mt-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-6">
            <div>
              <p className="text-ink text-base font-semibold">Prêt ?</p>
              <p className="text-ink-3 text-sm">
                Le chronomètre démarre à la première question.
              </p>
            </div>
            <StartButton />
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
