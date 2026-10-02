import { finalizePreparedExam, saveExam } from "@/features/exams/actions"

/** Un examen complet tel que le formulaire le soumet, jeu choisi d'un bloc. */
type CompleteExam = {
  title: string
  description?: string
  startDate: number
  endDate: number
  questionIds: string[]
  enablePause?: boolean
  pauseDurationMinutes?: number
  audienceType?: "subscribers" | "restricted"
  audienceUserIds?: string[]
}

const settings = (input: CompleteExam) => ({
  enablePause: false,
  audienceType: "subscribers" as const,
  audienceUserIds: [],
  ...input,
  targetQuestionCount: input.questionIds.length,
})

/**
 * Ce que fait le formulaire d'un nouvel examen complet : « Enregistrer » puis
 * « Finaliser ». Un refus de la finalisation laisse l'examen en préparation.
 */
export const createFinalizedExam = async (
  input: CompleteExam,
): Promise<
  { success: true; examId: string } | { success: false; error: string }
> => {
  const saved = await saveExam(settings(input))
  if (!saved.success) return saved
  const finalized = await finalizePreparedExam({ examId: saved.examId })
  return finalized.success
    ? { success: true, examId: saved.examId }
    : { success: false, error: finalized.error }
}

/**
 * Ce que fait le formulaire d'un examen existant : « Enregistrer », puis
 * « Finaliser » s'il est repassé en préparation (jeu changé).
 */
export const saveAndFinalize = async (
  input: CompleteExam & { id: string },
): Promise<{ success: true } | { success: false; error: string }> => {
  const saved = await saveExam(settings(input))
  if (!saved.success) return { success: false, error: saved.error }
  if (saved.finalized) return { success: true }
  const finalized = await finalizePreparedExam({ examId: input.id })
  return finalized.success
    ? { success: true }
    : { success: false, error: finalized.error }
}
