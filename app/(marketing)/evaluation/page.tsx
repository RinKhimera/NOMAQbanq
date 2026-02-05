import { Metadata } from "next"
import StartQuizCTA from "../_components/start-quiz-cta"
import EvaluationHeader from "./_components/evaluation-header"
import EvaluationInstructions from "./_components/evaluation-instructions"
import EvaluationStats from "./_components/evaluation-stats"

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

export default function EvaluationPage() {
  return (
    <div className="theme-bg">
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <EvaluationHeader />
        <EvaluationInstructions />
        <EvaluationStats />
        <StartQuizCTA />
      </div>
    </div>
  )
}
