import { RotateCcw } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { SessionResults } from "@/components/quiz/results/session-results"
import type { AnswersMap } from "@/components/quiz/runner/types"
import { Button } from "@/components/ui/button"
import { getTrainingSessionResults } from "@/features/training/dal"

interface TrainingResultsPageProps {
  params: Promise<{ sessionId: string }>
}

// Server Component : charge les résultats (propriété/admin dans le DAL). Redirige
// vers l'entraînement si introuvable, vers la passation si non terminée.
export const metadata: Metadata = { title: "Résultats de la série" }

export default async function TrainingResultsPage({
  params,
}: TrainingResultsPageProps) {
  const { sessionId } = await params
  const results = await getTrainingSessionResults(sessionId)

  if (!results) redirect("/tableau-de-bord/entrainement")
  if ("error" in results) {
    redirect(`/tableau-de-bord/entrainement/${sessionId}`)
  }

  const { session, questions, answers: rawAnswers, bookmarkedIds } = results

  const answers: AnswersMap = {}
  for (const [questionId, entry] of Object.entries(rawAnswers)) {
    if (entry.selectedAnswer) {
      answers[questionId] = {
        selected: entry.selectedAnswer,
        isCorrect: entry.isCorrect,
      }
    }
  }

  return (
    <SessionResults
      kind="training"
      // `null` = score retenu par la DAL, jamais transmis au client.
      score={session.score}
      questions={questions}
      answers={answers}
      flaggedIds={bookmarkedIds}
      eyebrow={`Série terminée · mode ${session.mode === "tutor" ? "tuteur" : "test"}`}
      actions={
        <>
          <Button asChild className="max-md:h-11">
            <Link href="/tableau-de-bord/entrainement">
              <RotateCcw aria-hidden />
              Nouvelle série
            </Link>
          </Button>
          <Button asChild variant="outline" className="max-md:h-11">
            <Link href="/tableau-de-bord">Ma progression</Link>
          </Button>
        </>
      }
      backHref="/tableau-de-bord/entrainement"
      backLabel="Entraînement"
      // Training results come eager (explanations embedded in questions),
      // no loadExplanations needed.
    />
  )
}
