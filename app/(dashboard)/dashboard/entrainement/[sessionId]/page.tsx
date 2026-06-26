import { redirect } from "next/navigation"
import { getTrainingSessionById } from "@/features/training/dal"
import { CalculatorProvider } from "@/hooks/useCalculator"
import { TrainingSessionClient } from "../_components/training-session-client"

interface TrainingSessionPageProps {
  params: Promise<{ sessionId: string }>
}

// Server Component : charge la session (propriété/admin vérifiée dans le DAL),
// redirige si introuvable ou déjà terminée, puis délègue la passation au client.
export default async function TrainingSessionPage({
  params,
}: TrainingSessionPageProps) {
  const { sessionId } = await params
  const data = await getTrainingSessionById(sessionId)

  if (!data) redirect("/dashboard/entrainement")
  if (data.session.status === "completed") {
    redirect(`/dashboard/entrainement/${sessionId}/results`)
  }

  return (
    <CalculatorProvider>
      <TrainingSessionClient sessionId={sessionId} initialData={data} />
    </CalculatorProvider>
  )
}
