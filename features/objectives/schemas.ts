import { z } from "zod"
import { normalizeObjectiveLabel, objectiveLabelError } from "./label"

const objectiveId = z.string().trim().min(1, "Objectif requis").max(64)

export const objectiveIdSchema = objectiveId

/** Libellé saisi : nettoyé, puis soumis aux règles du référentiel. */
export const objectiveLabelField = z
  .string()
  .transform(normalizeObjectiveLabel)
  .superRefine((label, ctx) => {
    const error = objectiveLabelError(label)
    if (error) ctx.addIssue({ code: "custom", message: error })
  })

export const createObjectiveSchema = z.object({ label: objectiveLabelField })

export const renameObjectiveSchema = z.object({
  id: objectiveId,
  label: objectiveLabelField,
})

export const keepObjectiveSchema = z.object({
  id: objectiveId,
  /** Libellé retouché ; absent, l'objectif garde le sien. */
  label: objectiveLabelField.optional(),
})

export const mergeObjectivesSchema = z
  .object({
    keepId: objectiveId,
    mergeIds: z
      .array(objectiveId)
      .min(1, "Choisissez au moins un objectif à fusionner")
      .max(50),
    label: objectiveLabelField,
  })
  .refine(
    (d) =>
      !d.mergeIds.includes(d.keepId) &&
      new Set(d.mergeIds).size === d.mergeIds.length,
    { message: "Objectifs à fusionner en double", path: ["mergeIds"] },
  )

export const correctQuestionObjectiveSchema = z.object({
  questionId: z.string().trim().min(1).max(64),
  objectiveId,
})

export type CreateObjectiveInput = z.input<typeof createObjectiveSchema>
export type RenameObjectiveInput = z.input<typeof renameObjectiveSchema>
export type KeepObjectiveInput = z.input<typeof keepObjectiveSchema>
export type MergeObjectivesInput = z.input<typeof mergeObjectivesSchema>
export type CorrectQuestionObjectiveInput = z.input<
  typeof correctQuestionObjectiveSchema
>
