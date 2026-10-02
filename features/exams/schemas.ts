import { z } from "zod"

// Nombre de questions visé d'un examen, donc taille de son jeu une fois finalisé.
export const MIN_EXAM_QUESTIONS = 10
export const MAX_EXAM_QUESTIONS = 230
// Explications demandées d'un coup par l'écran de résultats : borne de lecture,
// indépendante du visé (un examen antérieur à cette borne peut la dépasser).
export const MAX_EXPLANATIONS_BATCH = 500
// Secondes allouées par question (completionTime = n×83).
export const SECONDS_PER_QUESTION = 83
export const MIN_PAUSE_MINUTES = 1
export const MAX_PAUSE_MINUTES = 60
export const DEFAULT_PAUSE_MINUTES = 15

const examFields = {
  title: z
    .string()
    .trim()
    .min(1, "Le titre est requis")
    .max(200, "Le titre ne peut pas dépasser 200 caractères"),
  description: z.string().trim().max(2000).optional(),
  // Epoch ms (le formulaire convertit ses Date en ms avant l'appel).
  startDate: z.number().int("Date de début invalide"),
  endDate: z.number().int("Date de fin invalide"),
  questionIds: z
    .array(z.string().min(1))
    .min(MIN_EXAM_QUESTIONS, `Au moins ${MIN_EXAM_QUESTIONS} questions`)
    .max(MAX_EXAM_QUESTIONS, `Au plus ${MAX_EXAM_QUESTIONS} questions`),
  enablePause: z.boolean().default(false),
  pauseDurationMinutes: z
    .number()
    .int()
    .min(MIN_PAUSE_MINUTES)
    .max(MAX_PAUSE_MINUTES)
    .optional(),
  // Audience : ouvert aux abonnés (défaut) ou restreint à une liste choisie.
  audienceType: z.enum(["subscribers", "restricted"]).default("subscribers"),
  audienceUserIds: z.array(z.string().min(1)).max(5000).default([]),
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
// Audience restreinte → au moins un utilisateur sélectionné.
const audienceValid = (d: {
  audienceType: "subscribers" | "restricted"
  audienceUserIds: string[]
}) => d.audienceType === "subscribers" || d.audienceUserIds.length >= 1
const audienceIssue = {
  message: "Sélectionnez au moins un utilisateur",
  path: ["audienceUserIds"],
}

export const createExamSchema = z
  .object(examFields)
  .refine(datesOrdered, datesIssue)
  .refine(uniqueQuestions, uniqueIssue)
  .refine(audienceValid, audienceIssue)
// `z.input` : les champs à défaut (`enablePause`, `audienceType`,
// `audienceUserIds`) restent optionnels pour l'appelant ; le parse applique les
// défauts et le corps d'action lit `parsed.data` (type de sortie complet).
export type CreateExamInput = z.input<typeof createExamSchema>

export const updateExamSchema = z
  .object({ id: z.string().min(1), ...examFields })
  .refine(datesOrdered, datesIssue)
  .refine(uniqueQuestions, uniqueIssue)
  .refine(audienceValid, audienceIssue)
export type UpdateExamInput = z.input<typeof updateExamSchema>

const targetIssue = `Entre ${MIN_EXAM_QUESTIONS} et ${MAX_EXAM_QUESTIONS} questions`

/**
 * « Enregistrer » un examen : le titre et le nombre visé suffisent à le rendre
 * valide. Dates, pause et audience sont toujours envoyées (le formulaire porte
 * l'état entier) et écrites telles quelles, même vides : un champ omis ne
 * vaut jamais « effacer ». Seul `questionIds` est facultatif, car le jeu se
 * compose ailleurs : absent, il est conservé. La validation complète est celle
 * de la finalisation, ou de l'enregistrement d'un examen qui reste finalisé.
 */
export const saveExamSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: examFields.title,
    description: examFields.description,
    targetQuestionCount: z
      .number()
      .int(targetIssue)
      .min(MIN_EXAM_QUESTIONS, targetIssue)
      .max(MAX_EXAM_QUESTIONS, targetIssue),
    startDate: z.number().int("Date de début invalide").nullable(),
    endDate: z.number().int("Date de fin invalide").nullable(),
    questionIds: z
      .array(z.string().min(1))
      .max(MAX_EXAM_QUESTIONS, `Au plus ${MAX_EXAM_QUESTIONS} questions`)
      .optional(),
    enablePause: z.boolean(),
    pauseDurationMinutes: examFields.pauseDurationMinutes,
    audienceType: z.enum(["subscribers", "restricted"]),
    audienceUserIds: z.array(z.string().min(1)).max(5000),
  })
  .refine(
    (d) =>
      d.startDate === null || d.endDate === null || d.endDate > d.startDate,
    datesIssue,
  )
  .refine(
    (d) => !d.questionIds || uniqueQuestions({ questionIds: d.questionIds }),
    uniqueIssue,
  )
  .refine(
    (d) => !d.questionIds || d.questionIds.length <= d.targetQuestionCount,
    {
      message: "Le jeu de questions dépasse le nombre visé",
      path: ["questionIds"],
    },
  )
export type SaveExamInput = z.input<typeof saveExamSchema>

export const finalizePreparedExamSchema = z.object({
  examId: z.string().min(1),
})

export const saveExamAnswerSchema = z.object({
  examId: z.string().min(1),
  questionId: z.string().min(1),
  selectedAnswer: z.string().min(1),
})
export type SaveExamAnswerInput = z.infer<typeof saveExamAnswerSchema>

export const saveExamFlagSchema = z.object({
  examId: z.string().min(1),
  questionId: z.string().min(1),
  isFlagged: z.boolean(),
})
export type SaveExamFlagInput = z.infer<typeof saveExamFlagSchema>

export const finalizeExamSchema = z.object({
  examId: z.string().min(1),
  isAutoSubmit: z.boolean().optional(),
})
export type FinalizeExamInput = z.infer<typeof finalizeExamSchema>

export const loadExamQuestionExplanationsSchema = z
  .array(z.string())
  .min(1)
  .max(MAX_EXPLANATIONS_BATCH)
