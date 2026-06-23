import { z } from "zod"

// Bornes examen (alignées sur le formulaire admin : slider 10–230). Le backend
// reste tolérant (1–500) ; le formulaire contraint la plage « normale ».
export const MIN_EXAM_QUESTIONS = 1
export const MAX_EXAM_QUESTIONS = 500
// Secondes allouées par question (source de vérité Convex : completionTime = n×83).
export const SECONDS_PER_QUESTION = 83
export const MIN_PAUSE_MINUTES = 1
export const MAX_PAUSE_MINUTES = 60
export const DEFAULT_PAUSE_MINUTES = 15

const examFields = {
  title: z.string().trim().min(1, "Le titre est requis").max(200),
  description: z.string().trim().max(2000).optional(),
  // Epoch ms (le formulaire convertit ses Date en ms avant l'appel).
  startDate: z.number().int("Date de début invalide"),
  endDate: z.number().int("Date de fin invalide"),
  questionIds: z
    .array(z.string().min(1))
    .min(MIN_EXAM_QUESTIONS, "Au moins une question")
    .max(MAX_EXAM_QUESTIONS, `Au plus ${MAX_EXAM_QUESTIONS} questions`),
  enablePause: z.boolean().default(false),
  pauseDurationMinutes: z
    .number()
    .int()
    .min(MIN_PAUSE_MINUTES)
    .max(MAX_PAUSE_MINUTES)
    .optional(),
}

const datesOrdered = (d: { startDate: number; endDate: number }) =>
  d.endDate > d.startDate
const datesIssue = {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["endDate"],
}
// Pas de doublon dans la sélection de questions (sinon position dupliquée).
const uniqueQuestions = (d: { questionIds: string[] }) =>
  new Set(d.questionIds).size === d.questionIds.length
const uniqueIssue = {
  message: "Des questions sont sélectionnées en double",
  path: ["questionIds"],
}

export const createExamSchema = z
  .object(examFields)
  .refine(datesOrdered, datesIssue)
  .refine(uniqueQuestions, uniqueIssue)
export type CreateExamInput = z.infer<typeof createExamSchema>

export const updateExamSchema = z
  .object({ id: z.string().min(1), ...examFields })
  .refine(datesOrdered, datesIssue)
  .refine(uniqueQuestions, uniqueIssue)
export type UpdateExamInput = z.infer<typeof updateExamSchema>

// Soumission finale (anti-triche : le score est recalculé serveur). On borne le
// nombre de réponses au plafond de questions par examen.
export const submitExamAnswersSchema = z.object({
  examId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedAnswer: z.string().min(1),
        isFlagged: z.boolean().optional(),
      }),
    )
    .max(MAX_EXAM_QUESTIONS),
  isAutoSubmit: z.boolean().optional(),
})
export type SubmitExamAnswersInput = z.infer<typeof submitExamAnswersSchema>
