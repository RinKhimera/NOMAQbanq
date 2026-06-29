import * as z from "zod"

export const examFormSchema = z
  .object({
    title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
    description: z.string().optional(),
    startDate: z.date({
      error: "Veuillez sélectionner une date de début",
    }),
    endDate: z.date({
      error: "Veuillez sélectionner une date de fin",
    }),
    numberOfQuestions: z
      .number()
      .min(10, "Minimum 10 questions")
      .max(230, "Maximum 230 questions"),
    questionIds: z
      .array(z.string())
      .min(1, "Sélectionnez au moins une question"),
    // Pause settings (for 100+ questions)
    enablePause: z.boolean().optional(),
    pauseDurationMinutes: z
      .number()
      .min(1, "Minimum 1 minute")
      .max(60, "Maximum 60 minutes")
      .optional(),
    // Audience : ouvert aux abonnés (défaut) ou restreint à une liste choisie.
    // Pas de `.default()` ici : un défaut zod ferait diverger l'input et l'output
    // du schéma, cassant le typage du resolver `useForm<ExamFormValues>`. La
    // valeur initiale est fournie par les `defaultValues` du formulaire.
    audienceType: z.enum(["subscribers", "restricted"]),
    audienceUserIds: z.array(z.string()),
  })
  .refine(
    (data) => {
      if (!data.endDate || !data.startDate) return false
      return data.endDate > data.startDate
    },
    {
      message: "La date de fin doit être postérieure à la date de début",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      // If enablePause is true, pauseDurationMinutes is required (any question count)
      if (data.enablePause) {
        return (
          data.pauseDurationMinutes !== undefined &&
          data.pauseDurationMinutes >= 1 &&
          data.pauseDurationMinutes <= 60
        )
      }
      return true
    },
    {
      message: "La durée de pause est requise (1-60 minutes)",
      path: ["pauseDurationMinutes"],
    },
  )
  .refine(
    (data) =>
      data.audienceType === "subscribers" || data.audienceUserIds.length >= 1,
    {
      message: "Sélectionnez au moins un utilisateur",
      path: ["audienceUserIds"],
    },
  )

export type ExamFormValues = z.infer<typeof examFormSchema>

// Helper pour valider que le nombre de questions sélectionnées correspond au nombre requis
export const validateQuestionCount = (
  selectedQuestions: string[],
  requiredCount: number,
) => {
  return selectedQuestions.length === requiredCount
}

// Constants for pause feature
export const DEFAULT_PAUSE_DURATION_MINUTES = 15
export const MAX_PAUSE_DURATION_MINUTES = 60
export const MIN_PAUSE_DURATION_MINUTES = 1

// Helper to get default pause duration based on question count
export const getDefaultPauseDuration = (questionCount: number): number => {
  if (questionCount < 50) return 5
  if (questionCount < 100) return 10
  if (questionCount < 150) return 15
  return 20
}
