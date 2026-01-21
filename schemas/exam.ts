import * as z from "zod"
import { Id } from "@/convex/_generated/dataModel"

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
      .array(z.custom<Id<"questions">>())
      .min(1, "Sélectionnez au moins une question"),
    // Pause settings (for 100+ questions)
    enablePause: z.boolean().optional(),
    pauseDurationMinutes: z
      .number()
      .min(1, "Minimum 1 minute")
      .max(60, "Maximum 60 minutes")
      .optional(),
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

export type ExamFormValues = z.infer<typeof examFormSchema>

// Helper pour valider que le nombre de questions sélectionnées correspond au nombre requis
export const validateQuestionCount = (
  selectedQuestions: Id<"questions">[],
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
