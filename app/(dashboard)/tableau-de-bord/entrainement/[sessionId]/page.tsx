import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTrainingSessionById } from "@/features/training/dal"
import { TrainingSessionClient } from "../_components/training-session-client"

interface TrainingSessionPageProps {
  params: Promise<{ sessionId: string }>
}

// Server Component : charge la session (propriété/admin vérifiée dans le DAL),
// redirige si introuvable ou déjà terminée, puis délègue la passation au client.
export const metadata: Metadata = { title: "Session d'entraînement" }

export default async function TrainingSessionPage({
  params,
}: TrainingSessionPageProps) {
  const { sessionId } = await params
  const data = await getTrainingSessionById(sessionId)

  if (!data) redirect("/tableau-de-bord/entrainement")
  if (data.session.status === "completed") {
    redirect(`/tableau-de-bord/entrainement/${sessionId}/resultats`)
  }

  // CalculatorProvider est fourni par <QuizRunner> (pas de provider externe).
  return <TrainingSessionClient sessionId={sessionId} initialData={data} />
}
