import { redirect } from "next/navigation"
import { getTrainingSessionResults } from "@/features/training/dal"
import { TrainingResultsClient } from "../../_components/training-results-client"

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

  if (!results) redirect("/dashboard/entrainement")
  if ("error" in results) {
    redirect(`/dashboard/entrainement/${sessionId}`)
  }

  return <TrainingResultsClient results={results} />
}
