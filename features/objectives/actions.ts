"use server"

import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm"
import { revalidatePath, revalidateTag } from "next/cache"
import { OBJECTIVES_HREF } from "@/constants"
import { db } from "@/db"
import { cmcObjectives, questions } from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { getPgErrorCode, isPgUniqueViolation } from "@/lib/db-errors"
import { captureServerError } from "@/lib/observability"
import { OBJECTIVES_TAG } from "../marketing/cache-tags"
import { type ObjectiveQuestion, getObjectiveQuestions } from "./dal"
import { objectiveKey } from "./label"
import {
  type CorrectQuestionObjectiveInput,
  type CreateObjectiveInput,
  type KeepObjectiveInput,
  type MergeObjectivesInput,
  type RenameObjectiveInput,
  correctQuestionObjectiveSchema,
  createObjectiveSchema,
  keepObjectiveSchema,
  mergeObjectivesSchema,
  objectiveIdSchema,
  renameObjectiveSchema,
} from "./schemas"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type Objective = { id: string; label: string }

export type ObjectiveWriteResult<T = object> =
  | ({ success: true } & T)
  | {
      success: false
      error: string
      /** L'objectif dont la clé normalisée double le libellé refusé. */
      existing?: Objective
    }

const fail = (error: string, existing?: Objective) => ({
  success: false as const,
  error,
  ...(existing && { existing }),
})

class RefusalError extends Error {
  constructor(
    message: string,
    readonly existing?: Objective,
  ) {
    super(message)
  }
}

const STALE =
  "Un objectif a été modifié entre-temps. Rechargez la page et recommencez."

/**
 * Changer l'objectif d'une question depuis le référentiel ne la modifie pas :
 * sa date de modification ne bouge pas.
 */
const keepUpdatedAt = { updatedAt: sql`${questions.updatedAt}` }

/** Tout libellé écrit porte sa clé normalisée. */
const labelled = (label: string) => ({
  label,
  normalizedKey: objectiveKey(label),
})

const revalidateObjectives = () => {
  revalidatePath(OBJECTIVES_HREF)
  revalidatePath("/admin/questions")
  revalidateTag(OBJECTIVES_TAG, "max")
}

/**
 * Sérialise les écritures qui posent un libellé : sans ce verrou, deux
 * créations concurrentes de même clé passeraient toutes deux la vérification.
 */
const lockLabels = (tx: Tx) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext('cmc_objectives'))`)

/** Objectif valide de même clé normalisée que `label`, hors de `exceptIds`. */
const findTwin = async (
  executor: Tx | typeof db,
  label: string,
  exceptIds: string[] = [],
): Promise<Objective | undefined> => {
  const [twin] = await executor
    .select({ id: cmcObjectives.id, label: cmcObjectives.label })
    .from(cmcObjectives)
    .where(
      and(
        eq(cmcObjectives.normalizedKey, objectiveKey(label)),
        eq(cmcObjectives.needsFix, false),
        exceptIds.length > 0
          ? notInArray(cmcObjectives.id, exceptIds)
          : undefined,
      ),
    )
    .limit(1)
  return twin
}

const duplicateOf = (twin: Objective) =>
  new RefusalError(
    `L'objectif « ${twin.label} » existe déjà : choisissez-le plutôt.`,
    twin,
  )

/**
 * Refuse un libellé dont la clé normalisée double un objectif hors de
 * `exceptIds`. L'index unique garantit la règle ; cette vérification permet
 * de proposer l'objectif existant.
 */
const assertUniqueKey = async (tx: Tx, label: string, exceptIds: string[]) => {
  const twin = await findTwin(tx, label, exceptIds)
  if (twin) throw duplicateOf(twin)
}

/** Entrées verrouillées, dans l'ordre des ids pour ne jamais s'interbloquer. */
const lockEntries = async (tx: Tx, ids: string[]) => {
  const rows = await tx
    .select({
      id: cmcObjectives.id,
      label: cmcObjectives.label,
      needsFix: cmcObjectives.needsFix,
    })
    .from(cmcObjectives)
    .where(inArray(cmcObjectives.id, ids))
    .orderBy(asc(cmcObjectives.id))
    .for("update")
  if (rows.length !== new Set(ids).size) throw new RefusalError(STALE)
  return rows
}

/** Libellé que l'écriture pose, et objectifs qu'elle concerne. */
type LabelWrite = { label: string; exceptIds: string[] }

/**
 * Un doublon arrivé hors du verrou consultatif (écriture concurrente) n'est vu
 * que par l'index : même refus que `assertUniqueKey`, sans capture.
 */
const settle = async <T extends object>(
  tag: string,
  run: () => Promise<T>,
  write?: LabelWrite,
): Promise<ObjectiveWriteResult<T>> => {
  try {
    const value = await run()
    revalidateObjectives()
    return { success: true, ...value }
  } catch (error) {
    if (error instanceof RefusalError)
      return fail(error.message, error.existing)
    if (write && isPgUniqueViolation(error)) {
      const twin = await findTwin(db, write.label, write.exceptIds).catch(
        () => undefined,
      )
      if (twin) return fail(duplicateOf(twin).message, twin)
    }
    captureServerError(tag, error)
    return fail("Erreur serveur. Réessayez.")
  }
}

const firstIssue = (error: { issues: { message: string }[] }) =>
  fail(error.issues[0]?.message ?? "Données invalides")

/**
 * [Admin] Crée un objectif, revu d'emblée. Refusé si sa clé normalisée double
 * un objectif existant, que la réponse propose alors.
 */
export const createObjective = async (
  input: CreateObjectiveInput,
): Promise<ObjectiveWriteResult<{ objective: Objective }>> => {
  await requireRole(["admin"])
  const parsed = createObjectiveSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)
  const { label } = parsed.data

  return settle(
    "[createObjective]",
    () =>
      db.transaction(async (tx) => {
        await lockLabels(tx)
        await assertUniqueKey(tx, label, [])
        const [objective] = await tx
          .insert(cmcObjectives)
          .values({ ...labelled(label), reviewedAt: new Date() })
          .returning({ id: cmcObjectives.id, label: cmcObjectives.label })
        return { objective: objective! }
      }),
    { label, exceptIds: [] },
  )
}

/** [Admin] Renomme un objectif du référentiel, sous les règles de la création. */
export const renameObjective = async (
  input: RenameObjectiveInput,
): Promise<ObjectiveWriteResult> => {
  await requireRole(["admin"])
  const parsed = renameObjectiveSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)
  const { id, label } = parsed.data

  return settle(
    "[renameObjective]",
    () =>
      db.transaction(async (tx) => {
        await lockLabels(tx)
        const [entry] = await lockEntries(tx, [id])
        if (entry!.needsFix)
          throw new RefusalError(
            "Une valeur invalide se corrige question par question.",
          )
        await assertUniqueKey(tx, label, [id])
        await tx
          .update(cmcObjectives)
          .set(labelled(label))
          .where(eq(cmcObjectives.id, id))
        return {}
      }),
    { label, exceptIds: [id] },
  )
}

/**
 * [Admin] Fusion : les questions des objectifs fusionnés passent sur
 * l'objectif gardé, sans qu'aucun autre de leurs champs ne change (date de
 * modification comprise) ; les objectifs fusionnés sont supprimés et
 * l'objectif gardé prend le libellé final et devient revu. Sous verrou des
 * lignes : une fusion concurrente qui a supprimé l'un d'eux fait refuser
 * celle-ci, et aucune question n'est perdue.
 */
export const mergeObjectives = async (
  input: MergeObjectivesInput,
): Promise<ObjectiveWriteResult<{ moved: number }>> => {
  await requireRole(["admin"])
  const parsed = mergeObjectivesSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)
  const { keepId, mergeIds, label } = parsed.data
  const all = [keepId, ...mergeIds]

  return settle(
    "[mergeObjectives]",
    () =>
      db.transaction(async (tx) => {
        await lockLabels(tx)
        const entries = await lockEntries(tx, all)
        if (entries.some((e) => e.needsFix))
          throw new RefusalError(
            "Une valeur invalide ne se fusionne pas : corrigez ses questions.",
          )
        await assertUniqueKey(tx, label, all)
        const moved = await tx
          .update(questions)
          .set({ objectiveId: keepId, ...keepUpdatedAt })
          .where(inArray(questions.objectiveId, mergeIds))
          .returning({ id: questions.id })
        await tx
          .delete(cmcObjectives)
          .where(inArray(cmcObjectives.id, mergeIds))
        await tx
          .update(cmcObjectives)
          .set({ ...labelled(label), reviewedAt: new Date() })
          .where(eq(cmcObjectives.id, keepId))
        return { moved: moved.length }
      }),
    { label, exceptIds: all },
  )
}

/**
 * [Admin] « Garder tel quel » : l'objectif est revu, sous un libellé
 * éventuellement retouché (mêmes règles que le renommage). Refusé si une
 * autre entrée a la même clé normalisée : elles sont à fusionner.
 */
export const keepObjective = async (
  input: KeepObjectiveInput,
): Promise<ObjectiveWriteResult> => {
  await requireRole(["admin"])
  const parsed = keepObjectiveSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)
  const { id } = parsed.data

  return settle(
    "[keepObjective]",
    () =>
      db.transaction(async (tx) => {
        await lockLabels(tx)
        const [entry] = await lockEntries(tx, [id])
        if (entry!.needsFix)
          throw new RefusalError(
            "Une valeur invalide se corrige question par question.",
          )
        const label = parsed.data.label ?? entry!.label
        await assertUniqueKey(tx, label, [id])
        await tx
          .update(cmcObjectives)
          .set({ ...labelled(label), reviewedAt: new Date() })
          .where(eq(cmcObjectives.id, id))
        return {}
      }),
    parsed.data.label === undefined
      ? undefined
      : { label: parsed.data.label, exceptIds: [id] },
  )
}

/**
 * [Admin] Supprime un objectif que plus aucune question n'utilise, supprimées
 * comprises. Un objectif utilisé se fusionne : la clé étrangère `restrict`
 * arbitre, sans vérification préalable ni course.
 */
export const deleteObjective = async (
  id: string,
): Promise<ObjectiveWriteResult> => {
  await requireRole(["admin"])
  const parsed = objectiveIdSchema.safeParse(id)
  if (!parsed.success) return firstIssue(parsed.error)

  try {
    const deleted = await db
      .delete(cmcObjectives)
      .where(eq(cmcObjectives.id, id))
      .returning({ id: cmcObjectives.id })
    if (deleted.length === 0) return fail(STALE)
    revalidateObjectives()
    return { success: true }
  } catch (error) {
    const code = getPgErrorCode(error)
    if (code === "23001" || code === "23503")
      return fail(
        "Des questions utilisent encore cet objectif : fusionnez-le plutôt.",
      )
    captureServerError("[deleteObjective]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Correction d'une valeur invalide, question par question : seul
 * l'objectif de la question change. L'entrée à corriger disparaît quand plus
 * aucune question ne l'utilise.
 */
export const correctQuestionObjective = async (
  input: CorrectQuestionObjectiveInput,
): Promise<ObjectiveWriteResult<{ remaining: number }>> => {
  await requireRole(["admin"])
  const parsed = correctQuestionObjectiveSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)
  const { questionId, objectiveId } = parsed.data

  return settle("[correctQuestionObjective]", () =>
    db.transaction(async (tx) => {
      const activeQuestion = and(
        eq(questions.id, questionId),
        isNull(questions.deletedAt),
      )
      const [seen] = await tx
        .select({ objectiveId: questions.objectiveId })
        .from(questions)
        .where(activeQuestion)
      if (!seen) throw new RefusalError("Question introuvable.")
      const fromId = seen.objectiveId
      // Objectifs puis question, comme la fusion : l'ordre inverse interbloque.
      const entries = await lockEntries(tx, [fromId, objectiveId])
      const [question] = await tx
        .select({ objectiveId: questions.objectiveId })
        .from(questions)
        .where(activeQuestion)
        .for("update")
      if (question?.objectiveId !== fromId) throw new RefusalError(STALE)
      const from = entries.find((e) => e.id === fromId)!
      const to = entries.find((e) => e.id === objectiveId)!
      if (!from.needsFix || to.needsFix)
        throw new RefusalError(
          to.needsFix
            ? "Choisissez un objectif du référentiel."
            : "L'objectif de cette question n'est plus à corriger.",
        )
      await tx
        .update(questions)
        .set({ objectiveId, ...keepUpdatedAt })
        .where(eq(questions.id, questionId))
      // Les questions supprimées retiennent l'entrée (clé étrangère) sans
      // compter parmi celles qui restent à corriger.
      const [rest] = await tx
        .select({
          all: sql<number>`count(*)`.mapWith(Number),
          active:
            sql<number>`count(*) filter (where ${questions.deletedAt} is null)`.mapWith(
              Number,
            ),
        })
        .from(questions)
        .where(eq(questions.objectiveId, fromId))
      if ((rest?.all ?? 0) === 0)
        await tx.delete(cmcObjectives).where(eq(cmcObjectives.id, fromId))
      return { remaining: rest?.active ?? 0 }
    }),
  )
}

/** [Admin] Questions d'une valeur invalide, pour l'écran de correction. */
export const loadObjectiveQuestions = async (
  objectiveId: string,
): Promise<ObjectiveQuestion[]> => {
  await requireRole(["admin"])
  return getObjectiveQuestions(objectiveId)
}
