import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import {
  SessionResults,
  SessionResultsHeader,
} from "@/components/quiz/results/session-results"
import type { AnswersMap } from "@/components/quiz/runner/types"
import { getTrainingSessionResults } from "@/features/training/dal"

interface TrainingResultsPageProps {
  params: Promise<{ sessionId: string }>
}

// Server Component : charge les résultats (propriété/admin dans le DAL). Redirige
// vers l'entraînement si introuvable, vers la passation si non terminée.
export const metadata: Metadata = { title: "Résultats d'entraînement" }

export default async function TrainingResultsPage({
  params,
}: TrainingResultsPageProps) {
  const { sessionId } = await params
  const results = await getTrainingSessionResults(sessionId)

  if (!results) redirect("/tableau-de-bord/entrainement")
  if ("error" in results) {
    redirect(`/tableau-de-bord/entrainement/${sessionId}`)
  }

  const { session, questions: rawQuestions, answers: rawAnswers } = results

  const questions = rawQuestions

  const answers: AnswersMap = {}
  for (const [questionId, entry] of Object.entries(rawAnswers)) {
    if (entry.selectedAnswer) {
      answers[questionId] = {
        selected: entry.selectedAnswer,
        isCorrect: entry.isCorrect,
      }
    }
  }

  // `null` = score retenu par la DAL, jamais transmis au client.
  const score = session.score

  return (
    <>
      <SessionResultsHeader
        title="Résultats"
        subtitle="Session d'entraînement"
        score={score}
        backHref="/tableau-de-bord/entrainement"
        backLabel="Retour"
        backIcon={<ArrowLeft className="h-4 w-4" />}
      />
      <SessionResults
        accent="emerald"
        score={score}
        questions={questions}
        answers={answers}
        // Training results come eager (explanations embedded in questions),
        // no loadExplanations needed.
      />
    </>
  )
}
