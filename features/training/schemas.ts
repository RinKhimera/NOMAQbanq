import { z } from "zod"

// Bornes session d'entraînement.
export const MIN_QUESTIONS = 5
export const MAX_QUESTIONS = 20

export const REVISION_CRITERIA = ["failed", "unseen", "bookmarked"] as const
export type RevisionCriterion = (typeof REVISION_CRITERIA)[number]
export const revisionCriterionSchema = z.enum(REVISION_CRITERIA)

export const REVISION_CRITERION_LABELS: Record<RevisionCriterion, string> = {
  failed: "Ratées",
  unseen: "Non vues",
  bookmarked: "Marquées",
}

export const createTrainingSessionSchema = z
  .object({
    questionCount: z
      .number()
      .int()
      .min(1, "Au moins une question")
      .max(MAX_QUESTIONS, `Au plus ${MAX_QUESTIONS} questions`),
    domain: z.string().trim().min(1).optional(),
    objectifsCMCs: z.array(z.string().trim().min(1)).max(50).optional(),
    mode: z.enum(["tutor", "test"]).optional().default("test"),
    revisionFilters: z.array(revisionCriterionSchema).max(3).optional(),
  })
  // Le plancher de 5 questions n'a de sens que pour un tirage aléatoire : trois
  // questions ratées font une session de révision légitime.
  .superRefine((value, ctx) => {
    const isRevision = (value.revisionFilters?.length ?? 0) > 0
    if (!isRevision && value.questionCount < MIN_QUESTIONS) {
      ctx.addIssue({
        code: "custom",
        message: `Au moins ${MIN_QUESTIONS} questions`,
        path: ["questionCount"],
      })
    }
  })
export type CreateTrainingSessionInput = z.infer<
  typeof createTrainingSessionSchema
>

export const revisionCountsScopeSchema = z.object({
  domain: z.string().trim().min(1).optional(),
  objectifsCMCs: z.array(z.string().trim().min(1)).max(50).optional(),
})
export type RevisionCountsScopeInput = z.infer<typeof revisionCountsScopeSchema>

export const setQuestionBookmarkSchema = z.object({
  questionId: z.string().min(1),
  isBookmarked: z.boolean(),
})
export type SetQuestionBookmarkInput = z.infer<typeof setQuestionBookmarkSchema>

export const saveTrainingAnswerSchema = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  selectedAnswer: z.string().min(1),
})
export type SaveTrainingAnswerInput = z.infer<typeof saveTrainingAnswerSchema>
