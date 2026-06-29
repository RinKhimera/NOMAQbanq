import { z } from "zod"

// Champs communs création/édition. Une question QCM = 2..8 options, la bonne
// réponse devant figurer parmi elles (refine sur l'objet complet).
const questionFields = {
  question: z.string().trim().min(1, "La question est requise"),
  options: z
    .array(z.string().trim().min(1))
    .min(2, "Au moins 2 options")
    .max(8, "Au plus 8 options"),
  correctAnswer: z.string().trim().min(1, "La bonne réponse est requise"),
  explanation: z.string().trim().min(1, "L'explication est requise"),
  references: z.array(z.string().trim().min(1)).max(50).optional(),
  objectifCMC: z.string().trim().min(1, "L'objectif CMC est requis"),
  domain: z.string().trim().min(1, "Le domaine est requis"),
}

const correctAnswerInOptions = (d: {
  options: string[]
  correctAnswer: string
}) => d.options.includes(d.correctAnswer)
const correctAnswerIssue = {
  message: "La bonne réponse doit figurer parmi les options",
  path: ["correctAnswer"],
}

export const createQuestionSchema = z
  .object(questionFields)
  .refine(correctAnswerInOptions, correctAnswerIssue)

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>

export const updateQuestionSchema = z
  .object({ id: z.string().min(1), ...questionFields })
  .refine(correctAnswerInOptions, correctAnswerIssue)

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>

export const setQuestionImagesSchema = z.object({
  questionId: z.string().min(1),
  kind: z.enum(["statement", "explanation"]).default("statement"),
  images: z
    .array(
      z.object({
        storagePath: z.string().min(1),
        order: z.number().int().nonnegative(),
        // `url` est dérivée du CDN côté client ; on ne persiste que storagePath+position.
        url: z.string().optional(),
      }),
    )
    .max(20),
})

// `z.input` (pas `z.infer`/output) : `kind` a un `.default("statement")`, donc
// optionnel à l'appel (callers existants `{ questionId, images }`) mais toujours
// défini après `safeParse`.
export type SetQuestionImagesInput = z.input<typeof setQuestionImagesSchema>
