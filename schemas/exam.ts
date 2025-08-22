import * as z from "zod"
import { Id } from "@/convex/_generated/dataModel"

// Schema de validation pour les examens
export const examFormSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  description: z.string().optional(),
  startDate: z.date({
    required_error: "Veuillez sélectionner une date de début",
  }),
  numberOfQuestions: z
    .number()
    .min(10, "Minimum 10 questions")
    .max(115, "Maximum 115 questions"),
  questionIds: z
    .array(z.custom<Id<"questions">>())
    .min(1, "Sélectionnez au moins une question"),
})

// Types dérivés
export type ExamFormValues = z.infer<typeof examFormSchema>

// Helper pour valider que le nombre de questions sélectionnées correspond au nombre requis
export const validateQuestionCount = (
  selectedQuestions: Id<"questions">[],
  requiredCount: number,
) => {
  return selectedQuestions.length === requiredCount
}

// Helper pour calculer la date de fin (2 jours après le début)
export const calculateEndDate = (startDate: Date) => {
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 2)
  endDate.setHours(23, 59, 59, 999)
  return endDate
}
