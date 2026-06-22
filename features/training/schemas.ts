import { z } from "zod"

// Bornes session d'entraînement (alignées sur l'ancienne logique Convex).
export const MIN_QUESTIONS = 5
export const MAX_QUESTIONS = 20

export const createTrainingSessionSchema = z.object({
  questionCount: z
    .number()
    .int()
    .min(MIN_QUESTIONS, `Au moins ${MIN_QUESTIONS} questions`)
    .max(MAX_QUESTIONS, `Au plus ${MAX_QUESTIONS} questions`),
  domain: z.string().trim().min(1).optional(),
  objectifsCMCs: z.array(z.string().trim().min(1)).max(50).optional(),
})
export type CreateTrainingSessionInput = z.infer<
  typeof createTrainingSessionSchema
>

export const saveTrainingAnswerSchema = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  selectedAnswer: z.string().min(1),
})
export type SaveTrainingAnswerInput = z.infer<typeof saveTrainingAnswerSchema>
