"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { questionExplanations, questionImages, questions } from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { createPresignedUpload } from "@/lib/aws"
import { createId } from "@/lib/ids"
import {
  generateQuestionImagePath,
  getExtensionFromMimeType,
  isStorageConfigured,
  tryDeleteFromStorage,
  validateImageFile,
} from "@/lib/storage"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"

import {
  getAllQuestionIds,
  getQuestionById,
  getQuestionsForExport,
  getQuestionsWithFilters,
  getQuizAnswerKey,
  getRandomQuizQuestions,
  getUniqueObjectifsCMC,
  type QuestionDetail,
  type QuestionExportRow,
  type QuestionFiltersInput,
  type QuestionsPage,
  type QuizQuestionView,
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

/** [Admin] Détail complet d'une question (panel / édition). `null` si introuvable. */
export const loadQuestionById = async (
  id: string,
): Promise<QuestionDetail | null> => {
  await requireRole(["admin"])
  return getQuestionById(id)
}

/** [Admin] Tous les ids de questions (auto-complete sélection examen). */
export const loadAllQuestionIds = async (): Promise<string[]> => {
  await requireRole(["admin"])
  return getAllQuestionIds()
}

/** [Admin] Objectifs CMC distincts (combobox du formulaire création/édition). */
export const loadUniqueObjectifsCMC = async (): Promise<string[]> => {
  await requireRole(["admin"])
  return getUniqueObjectifsCMC()
}

// ============================================
// [Public] Quiz marketing (sans auth)
// ============================================

/**
 * [Public] Questions aléatoires pour le quiz d'évaluation marketing. Sans garde
 * (page publique). La DAL masque `correctAnswer`/`explanation`.
 */
export const loadRandomQuizQuestions = async (args: {
  count: number
  domain?: string
}): Promise<QuizQuestionView[]> => {
  return getRandomQuizQuestions(args)
}

export type QuizQuestionResult = {
  questionId: string
  isCorrect: boolean
  correctAnswer: string
  explanation: string
  references: string[]
}

export type QuizScore = {
  score: number
  totalQuestions: number
  questionResults: QuizQuestionResult[]
}

/**
 * [Public] Score le quiz marketing côté serveur. Sans garde (page publique).
 * La clé de correction n'est révélée qu'au moment de la soumission (parité avec
 * l'ancienne mutation Convex publique). Borne anti-abus sur la taille du lot.
 */
export const scoreQuizAnswers = async (args: {
  answers: { questionId: string; selectedAnswer: string | null }[]
}): Promise<QuizScore> => {
  const answers = args.answers.slice(0, 50)
  const keyMap = await getQuizAnswerKey(answers.map((a) => a.questionId))

  let score = 0
  const questionResults: QuizQuestionResult[] = []
  for (const a of answers) {
    const key = keyMap.get(a.questionId)
    if (!key) continue
    const isCorrect = a.selectedAnswer === key.correctAnswer
    if (isCorrect) score++
    questionResults.push({
      questionId: a.questionId,
      isCorrect,
      correctAnswer: key.correctAnswer,
      explanation: key.explanation,
      references: key.references,
    })
  }

  return { score, totalQuestions: questionResults.length, questionResults }
}

/** [Admin] Questions filtrées pour l'export (CSV/XLSX/JSON). */
export const loadQuestionsForExport = async (filters: {
  search?: string
  domain?: string
  hasImages?: boolean
}): Promise<QuestionExportRow[]> => {
  await requireRole(["admin"])
  return getQuestionsForExport(filters)
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

    // Supprime du CDN Bunny les images retirées (best-effort, après commit DB).
    // Un échec de suppression CDN ne doit pas faire échouer la persistance.
    if (removedPaths.length > 0) {
      await Promise.all(removedPaths.map((p) => tryDeleteFromStorage(p)))
    }
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

// Anti path-traversal : un id légitime (createId) ne contient que des caractères
// d'URL sûrs ; on rejette tout le reste avant de l'interpoler dans le chemin.
const QUESTION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export type CreateQuestionImageUploadResult =
  | {
      success: true
      url: string
      fields: Record<string, string>
      storagePath: string
    }
  | { success: false; error: string }

/**
 * [Admin] Étape 1 de l'upload d'image question : garde admin → questionId validé
 * (anti path-traversal) + existant → validation type/taille → rate-limit (50/h) →
 * presigned POST S3 (`questions/{questionId}/…`). Ne persiste PAS : la liste
 * finale est enregistrée par `setQuestionImages` au save du formulaire. Le fichier
 * ne transite PAS par le serveur.
 */
export const createQuestionImageUpload = async (input: {
  questionId: string
  imageIndex: number
  contentType: string
  size: number
}): Promise<CreateQuestionImageUploadResult> => {
  const session = await requireRole(["admin"])

  if (!QUESTION_ID_RE.test(input.questionId)) {
    return { success: false, error: "Question invalide" }
  }
  const imageIndex = Math.max(
    0,
    Math.min(
      999,
      Number.isFinite(input.imageIndex) ? Math.trunc(input.imageIndex) : 0,
    ),
  )

  const validationError = validateImageFile(input.contentType, input.size)
  if (validationError) {
    return { success: false, error: validationError }
  }

  if (!isStorageConfigured()) {
    return {
      success: false,
      error: "Le téléversement d'images n'est pas configuré.",
    }
  }

  // La question doit exister et ne pas être supprimée (évite des orphelins CDN).
  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, input.questionId), isNull(questions.deletedAt)))
    .limit(1)
  if (!q) {
    return { success: false, error: "Question introuvable" }
  }

  const limit = await consumeUploadRateLimit(session.user.id, "question-image")
  if (!limit.allowed) {
    return {
      success: false,
      error: `Limite d'uploads atteinte. Réessayez dans ${limit.retryAfterMinutes} minute(s).`,
    }
  }

  const storagePath = generateQuestionImagePath(
    input.questionId,
    imageIndex,
    getExtensionFromMimeType(input.contentType),
  )
  try {
    const { url, fields } = await createPresignedUpload(
      storagePath,
      input.contentType,
    )
    return { success: true, url, fields, storagePath }
  } catch (error) {
    logDev("[createQuestionImageUpload]", error)
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}
