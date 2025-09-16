import * as z from "zod"
import { Id } from "@/convex/_generated/dataModel"

export const examFormSchema = z
  .object({
    title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
    description: z.string().optional(),
    startDate: z.date({
      required_error: "Veuillez sélectionner une date de début",
    }),
    endDate: z.date({
      required_error: "Veuillez sélectionner une date de fin",
    }),
    numberOfQuestions: z
      .number()
      .min(10, "Minimum 10 questions")
      .max(115, "Maximum 115 questions"),
    questionIds: z
      .array(z.custom<Id<"questions">>())
      .min(1, "Sélectionnez au moins une question"),
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
      if (!data.endDate || !data.startDate) return false
      const diffTime = data.endDate.getTime() - data.startDate.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 14
    },
    {
      message: "La période d'examen ne peut pas dépasser 14 jours",
      path: ["endDate"],
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
