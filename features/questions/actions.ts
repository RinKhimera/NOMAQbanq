"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { questionExplanations, questionImages, questions } from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

import {
  getQuestionsWithFilters,
  type QuestionFiltersInput,
  type QuestionsPage,
} from "./dal"
import { normalizeObjectifCMC } from "./lib"
import {
  createQuestionSchema,
  setQuestionImagesSchema,
  updateQuestionSchema,
  type CreateQuestionInput,
  type SetQuestionImagesInput,
  type UpdateQuestionInput,
} from "./schemas"

const fail = (error: string) => ({ success: false as const, error })

const logDev = (tag: string, error: unknown) => {
  if (process.env.NODE_ENV !== "production") console.error(tag, error)
}

/** [Admin] Charge une page de la liste filtrée (browser : filtres + « charger plus »). */
export const loadQuestionsPage = async (
  filters: QuestionFiltersInput,
): Promise<QuestionsPage> => {
  await requireRole(["admin"])
  return getQuestionsWithFilters(filters)
}

export type CreateQuestionResult =
  | { success: true; id: string }
  | { success: false; error: string }

/**
 * [Admin] Crée une question + sa ligne d'explication (1:1) atomiquement.
 * `explanation`/`references` vivent dans `questionExplanations` (split bandwidth).
 */
export const createQuestion = async (
  input: CreateQuestionInput,
): Promise<CreateQuestionResult> => {
  await requireRole(["admin"])

  const parsed = createQuestionSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const d = parsed.data
  const id = createId()

  try {
    await db.transaction(async (tx) => {
      await tx.insert(questions).values({
        id,
        question: d.question,
        correctAnswer: d.correctAnswer,
        options: d.options,
        objectifCmc: normalizeObjectifCMC(d.objectifCMC),
        domain: d.domain,
      })
      await tx.insert(questionExplanations).values({
        questionId: id,
        explanation: d.explanation,
        references: d.references ?? null,
      })
    })
    revalidatePath("/admin/questions")
    return { success: true, id }
  } catch (error) {
    logDev("[createQuestion]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Met à jour une question + upsert de son explication. Soft-delete
 * respecté (refuse une question supprimée). Atomique.
 */
export const updateQuestion = async (
  input: UpdateQuestionInput,
): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])

  const parsed = updateQuestionSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const d = parsed.data

  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(questions)
        .set({
          question: d.question,
          correctAnswer: d.correctAnswer,
          options: d.options,
          objectifCmc: normalizeObjectifCMC(d.objectifCMC),
          domain: d.domain,
        })
        .where(and(eq(questions.id, d.id), isNull(questions.deletedAt)))
        .returning({ id: questions.id })
      if (updated.length === 0) throw new Error("Q_NOT_FOUND")

      await tx
        .insert(questionExplanations)
        .values({
          questionId: d.id,
          explanation: d.explanation,
          references: d.references ?? null,
        })
        .onConflictDoUpdate({
          target: questionExplanations.questionId,
          set: {
            explanation: d.explanation,
            references: d.references ?? null,
          },
        })
    })
    revalidatePath("/admin/questions")
    revalidatePath(`/admin/questions/${d.id}/modifier`)
    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message === "Q_NOT_FOUND") {
      return fail("Question introuvable")
    }
    logDev("[updateQuestion]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Suppression SOUPLE (set `deletedAt`). Les reads filtrent `deletedAt IS NULL`. */
export const deleteQuestion = async (
  id: string,
): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!id) return fail("Question requise")

  try {
    const res = await db
      .update(questions)
      .set({ deletedAt: new Date() })
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
      .returning({ id: questions.id })
    if (res.length === 0) return fail("Question introuvable")

    revalidatePath("/admin/questions")
    return { success: true }
  } catch (error) {
    logDev("[deleteQuestion]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Remplace l'ensemble des images d'une question (storagePath + position).
 * Les chemins retirés sont calculés pour suppression Bunny — déléguée à la Phase 7
 * (uploaders neutralisés). Atomique.
 */
export const setQuestionImages = async (
  input: SetQuestionImagesInput,
): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])

  const parsed = setQuestionImagesSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { questionId, images } = parsed.data

  try {
    const removedPaths = await db.transaction(async (tx) => {
      const [q] = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
        .limit(1)
      if (!q) throw new Error("Q_NOT_FOUND")

      const old = await tx
        .select({ storagePath: questionImages.storagePath })
        .from(questionImages)
        .where(eq(questionImages.questionId, questionId))

      await tx
        .delete(questionImages)
        .where(eq(questionImages.questionId, questionId))

      if (images.length > 0) {
        await tx.insert(questionImages).values(
          images.map((img) => ({
            questionId,
            storagePath: img.storagePath,
            position: img.order,
          })),
        )
      }

      const newPaths = new Set(images.map((i) => i.storagePath))
      return old
        .filter((o) => !newPaths.has(o.storagePath))
        .map((o) => o.storagePath)
    })

    // TODO(Phase 7) : supprimer `removedPaths` du CDN Bunny (uploaders neutralisés).
    void removedPaths
    revalidatePath("/admin/questions")
    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message === "Q_NOT_FOUND") {
      return fail("Question introuvable")
    }
    logDev("[setQuestionImages]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
