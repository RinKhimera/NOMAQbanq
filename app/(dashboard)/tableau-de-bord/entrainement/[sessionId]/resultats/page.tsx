import { ArrowLeft } from "lucide-react"
import { redirect } from "next/navigation"
import {
  SessionResults,
  SessionResultsHeader,
} from "@/components/quiz/results/session-results"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import { getTrainingSessionResults } from "@/features/training/dal"

interface TrainingResultsPageProps {
  params: Promise<{ sessionId: string }>
}

// Server Component : charge les résultats (propriété/admin dans le DAL). Redirige
// vers l'entraînement si introuvable, vers la passation si non terminée.
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

  // Map DAL output → QuizQuestion[] (training results include correctAnswer + explanation)
  const questions: QuizQuestion[] = rawQuestions.map((q) => ({
    _id: q._id,
    question: q.question,
    options: q.options,
    images: q.images ?? [],
    domain: q.domain ?? undefined,
    objectifCMC: q.objectifCMC ?? undefined,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    references: q.references,
    // Images d'explication (correction uniquement) — `SessionResults` les rend
    // sous l'explication via `result.question.explanationImages`.
    explanationImages: q.explanationImages ?? [],
  }))

  // Map TrainingAnswerRecord → AnswersMap
  const answers: AnswersMap = {}
  for (const [questionId, entry] of Object.entries(rawAnswers)) {
    if (entry.selectedAnswer) {
      answers[questionId] = {
        selected: entry.selectedAnswer,
        isCorrect: entry.isCorrect,
      }
    }
  }

  // Compute summary counts
  const score = session.score
  let correct = 0
  let incorrect = 0
  for (const entry of Object.values(rawAnswers)) {
    if (!entry.selectedAnswer) continue
    if (entry.isCorrect) correct++
    else incorrect++
  }
  const unanswered = questions.length - Object.keys(rawAnswers).length

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
        summary={{ score, correct, incorrect, unanswered }}
        questions={questions}
        answers={answers}
        // Training results come eager (explanations embedded in questions),
        // no loadExplanations needed.
      />
    </>
  )
}
