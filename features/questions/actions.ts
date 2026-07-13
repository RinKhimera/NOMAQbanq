"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { questionExplanations, questionImages, questions } from "@/db/schema"
import { getOpenExamQuestionIds } from "@/features/exams/dal"
import { requireRole } from "@/lib/auth-guards"
import { copyInS3, createPresignedUpload } from "@/lib/aws"
import { createId } from "@/lib/ids"
import { consumeQuizRateLimit, getClientIpKey } from "@/lib/quiz-rate-limit"
import {
  assertSafeStoragePath,
  finalPathFromTmp,
  generateQuestionImageTmpPath,
  getExtensionFromMimeType,
  isStorageConfigured,
  tryDeleteFromStorage,
  validateImageFile,
} from "@/lib/storage"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"
import {
  type QuestionDetail,
  type QuestionExportRow,
  type QuestionFiltersInput,
  type QuestionsPage,
  type QuizQuestionView,
  getAllQuestionIds,
  getQuestionById,
  getQuestionsForExport,
  getQuestionsWithFilters,
  getQuizAnswerKey,
  getRandomQuizQuestions,
  getUniqueObjectifsCMC,
} from "./dal"
import { normalizeObjectifCMC } from "./lib"
import { signQuizToken, verifyQuizToken } from "./quiz-token"
import {
  type CreateQuestionInput,
  type SetQuestionImagesInput,
  type UpdateQuestionInput,
  createQuestionSchema,
  loadRandomQuizQuestionsSchema,
  scoreQuizAnswersSchema,
  setQuestionImagesSchema,
  updateQuestionSchema,
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
 * [Public] Questions aléatoires pour le quiz d'évaluation marketing. Sans
 * session (page publique) mais : rate-limit IP + jeton HMAC couvrant les ids
 * servis — `scoreQuizAnswers` ne corrige que ce que CE bundle a servi (#91).
 * La DAL masque `correctAnswer`/`explanation` et exclut les examens ouverts.
 */
export type QuizBundle = {
  questions: QuizQuestionView[]
  token: string | null
}

export const loadRandomQuizQuestions = async (args: {
  count: number
  domain?: string
}): Promise<QuizBundle> => {
  // zod AVANT le rate-limit : une entrée malformée ne consomme pas de slot
  // (et ne throw plus — l'ancien clamp propageait NaN jusqu'à LIMIT).
  const parsed = loadRandomQuizQuestionsSchema.safeParse(args)
  if (!parsed.success) return { questions: [], token: null }

  const ipKey = await getClientIpKey()
  if (!(await consumeQuizRateLimit(ipKey, "load"))) {
    return { questions: [], token: null }
  }
  const quizQuestions = await getRandomQuizQuestions(parsed.data)
  if (quizQuestions.length === 0) return { questions: [], token: null }
  return {
    questions: quizQuestions,
    token: signQuizToken(quizQuestions.map((q) => q._id)),
  }
}

export type QuizQuestionResult = {
  questionId: string
  isCorrect: boolean
  correctAnswer: string
  explanation: string
  references: string[]
  explanationImages: { url: string; storagePath: string; order: number }[]
}

export type QuizScore = {
  score: number
  totalQuestions: number
  questionResults: QuizQuestionResult[]
}

const EMPTY_SCORE: QuizScore = {
  score: 0,
  totalQuestions: 0,
  questionResults: [],
}

/**
 * [Public] Score le quiz marketing côté serveur. Refus TOUJOURS silencieux
 * (`QuizScore` vide, même shape) : pas d'oracle sur la raison — zod hors
 * bornes, rate-limit, jeton invalide/expiré. Séquence : zod → rate-limit IP
 * (consommé AVANT le travail) → jeton (intersection ids servis) → re-check
 * examens ouverts (un examen a pu OUVRIR pendant la vie du jeton — la clé
 * reste verrouillée sur TOUS les canaux pendant la fenêtre, cf. #86/#93).
 */
export const scoreQuizAnswers = async (args: {
  answers: { questionId: string; selectedAnswer: string | null }[]
  token: string
}): Promise<QuizScore> => {
  const parsed = scoreQuizAnswersSchema.safeParse(args)
  if (!parsed.success) return EMPTY_SCORE

  const ipKey = await getClientIpKey()
  if (!(await consumeQuizRateLimit(ipKey, "score"))) return EMPTY_SCORE

  const servedIds = verifyQuizToken(parsed.data.token)
  if (!servedIds) return EMPTY_SCORE

  const seen = new Set<string>()
  const answers = parsed.data.answers.filter((a) => {
    if (!servedIds.has(a.questionId) || seen.has(a.questionId)) return false
    seen.add(a.questionId)
    return true
  })
  if (answers.length === 0) return EMPTY_SCORE

  const answeredIds = answers.map((a) => a.questionId)
  const lockedIds = await getOpenExamQuestionIds(answeredIds)
  const keyMap = await getQuizAnswerKey(
    answeredIds.filter((id) => !lockedIds.has(id)),
  )

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
      explanationImages: key.explanationImages,
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
  { success: true; id: string } | { success: false; error: string }

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

/**
 * Violation de contrainte FK Postgres. `ON DELETE RESTRICT` lève `23001`
 * (restrict_violation) — PAS `23503` (foreign_key_violation, inserts/NO ACTION) ;
 * on accepte les deux. Drizzle enveloppe l'erreur pg (DrizzleQueryError →
 * cause) : on remonte la chaîne `cause` (bornée).
 */
const FK_VIOLATION_CODES = new Set(["23001", "23503"])

const isForeignKeyViolation = (error: unknown): boolean => {
  let cur: unknown = error
  for (let i = 0; i < 5 && cur; i++) {
    if (
      typeof cur === "object" &&
      "code" in cur &&
      typeof (cur as { code?: unknown }).code === "string" &&
      FK_VIOLATION_CODES.has((cur as { code: string }).code)
    ) {
      return true
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

export type DeleteQuestionResult =
  { success: true; mode: "hard" | "soft" } | { success: false; error: string }

/**
 * [Admin] Suppression HYBRIDE. On TENTE le hard delete ; les FK `restrict`
 * (exam_questions, exam_answers, training_session_items) arbitrent atomiquement :
 * - non référencée → DELETE passe : cascade DB (images/explication) + purge S3
 *   best-effort après commit ;
 * - référencée → Postgres lève 23503 → fallback SOFT delete (`deletedAt`),
 *   médias DB/S3 CONSERVÉS (encore servis en passation/correction — exams/dal
 *   ne filtre pas `deletedAt`).
 * Aucun check applicatif préalable → aucune race avec une insertion concurrente.
 * Course résiduelle assumée : un `setQuestionImages` concurrent qui commit entre
 * la collecte des chemins et le DELETE peut laisser un orphelin S3 (fenêtre
 * minuscule, purge best-effort) — rattrapé par `bun run audit:medias`.
 */
export const deleteQuestion = async (
  id: string,
): Promise<DeleteQuestionResult> => {
  await requireRole(["admin"])
  if (!id) return fail("Question requise")

  try {
    const imagePaths = await db.transaction(async (tx) => {
      const imgs = await tx
        .select({ storagePath: questionImages.storagePath })
        .from(questionImages)
        .where(eq(questionImages.questionId, id))
      const res = await tx
        .delete(questions)
        .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
        .returning({ id: questions.id })
      if (res.length === 0) throw new Error("Q_NOT_FOUND")
      return imgs.map((i) => i.storagePath)
    })

    // Hard delete commité : purge S3 best-effort (hors transaction).
    await Promise.all(imagePaths.map((p) => tryDeleteFromStorage(p)))
    revalidatePath("/admin/questions")
    return { success: true, mode: "hard" }
  } catch (error) {
    if (error instanceof Error && error.message === "Q_NOT_FOUND") {
      return fail("Question introuvable")
    }
    if (!isForeignKeyViolation(error)) {
      logDev("[deleteQuestion]", error)
      return fail("Erreur serveur. Réessayez.")
    }
  }

  try {
    const res = await db
      .update(questions)
      .set({ deletedAt: new Date() })
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
      .returning({ id: questions.id })
    if (res.length === 0) return fail("Question introuvable")

    revalidatePath("/admin/questions")
    return { success: true, mode: "soft" }
  } catch (error) {
    logDev("[deleteQuestion]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Remplace l'ensemble des images d'une question (storagePath + position).
 *
 * Anti-orphelins (« approche C ») : les nouveaux uploads arrivent sous `tmp/` →
 * on les COPIE vers leur chemin final (`questions/{id}/…`) puis on persiste le
 * chemin FINAL. Les images déjà persistées (préfixe `questions/…`) restent
 * inchangées. Les chemins finaux RETIRÉS et les sources `tmp/` sont supprimés
 * best-effort après commit (la Lifecycle S3 reste le filet de sécurité sur tmp/).
 * Si l'écriture DB échoue après une copie, les objets finaux fraîchement copiés
 * sont supprimés (pas d'orphelin dans `questions/`, cf. `confirmAvatarUpload`).
 */
export const setQuestionImages = async (
  input: SetQuestionImagesInput,
): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])

  const parsed = setQuestionImagesSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { questionId, kind, images } = parsed.data

  // Chemin final de chaque image entrante : tampon `tmp/…` → à copier ;
  // chemin déjà final (`questions/…`) → conservé tel quel.
  const planned = images.map((img) => {
    const isTmp = img.storagePath.startsWith("tmp/")
    return {
      order: img.order,
      finalPath: isTmp ? finalPathFromTmp(img.storagePath) : img.storagePath,
      tmpPath: isTmp ? img.storagePath : null,
    }
  })

  // Garde de sécurité : valider TOUS les chemins (pas seulement les `tmp/`). Tout
  // chemin final DOIT appartenir au préfixe de CETTE question — les `tmp/` y sont
  // mappés par `finalPathFromTmp`, les images conservées y sont déjà. Sans ça, un
  // `storagePath` étranger forgé (`questions/AUTRE_ID/x.jpg`) serait stocké puis
  // supprimé de S3 à l'édition suivante → suppression croisée entre questions
  // (admin-only, défense en profondeur).
  //
  // Préfixe volontairement à la QUESTION (et non `questions/{id}/{kind}/`) : les
  // images persistées avant F3 ont un chemin plat (`questions/{id}/<ts>-<i>.jpg`,
  // kind=statement par défaut migration) — un préfixe par `kind` casserait la
  // ré-sauvegarde de toute question existante. L'isolation par `kind` (sauver
  // l'énoncé n'efface pas l'explication) est garantie par le scope DB
  // `(questionId, kind)` sur old/delete/insert ci-dessous, pas par le chemin.
  const finalPrefix = `questions/${questionId}/`
  try {
    for (const p of planned) {
      if (p.tmpPath) assertSafeStoragePath(p.tmpPath)
      assertSafeStoragePath(p.finalPath)
      if (!p.finalPath.startsWith(finalPrefix)) throw new Error("BAD_PREFIX")
    }
  } catch (error) {
    logDev("[setQuestionImages] validate", error)
    return fail("Chemin d'image invalide")
  }

  // Copie tmp → final AVANT toute écriture DB. En cas d'échec, on retire les
  // copies déjà faites (pas d'orphelin dans `questions/`) puis on échoue.
  const copiedFinalPaths: string[] = []
  try {
    for (const p of planned) {
      if (!p.tmpPath) continue
      await copyInS3(p.tmpPath, p.finalPath)
      copiedFinalPaths.push(p.finalPath)
    }
  } catch (error) {
    logDev("[setQuestionImages] copy", error)
    await Promise.all(copiedFinalPaths.map((p) => tryDeleteFromStorage(p)))
    return fail("Erreur serveur. Réessayez.")
  }

  try {
    const removedPaths = await db.transaction(async (tx) => {
      const [q] = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
        .limit(1)
      if (!q) throw new Error("Q_NOT_FOUND")

      // Scope `(questionId, kind)` : remplacer les images d'un `kind` ne touche
      // pas l'autre jeu (énoncé vs explication), ni leurs objets S3.
      const old = await tx
        .select({ storagePath: questionImages.storagePath })
        .from(questionImages)
        .where(
          and(
            eq(questionImages.questionId, questionId),
            eq(questionImages.kind, kind),
          ),
        )

      await tx
        .delete(questionImages)
        .where(
          and(
            eq(questionImages.questionId, questionId),
            eq(questionImages.kind, kind),
          ),
        )

      if (planned.length > 0) {
        await tx.insert(questionImages).values(
          planned.map((p) => ({
            questionId,
            kind,
            storagePath: p.finalPath,
            position: p.order,
          })),
        )
      }

      const newPaths = new Set(planned.map((p) => p.finalPath))
      return old
        .filter((o) => !newPaths.has(o.storagePath))
        .map((o) => o.storagePath)
    })

    // Best-effort après commit DB : chemins finaux retirés + sources tmp/ copiées.
    // Un échec de suppression CDN ne doit pas faire échouer la persistance.
    const tmpSources = planned.flatMap((p) => (p.tmpPath ? [p.tmpPath] : []))
    const toDelete = [...removedPaths, ...tmpSources]
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map((p) => tryDeleteFromStorage(p)))
    }
    revalidatePath("/admin/questions")
    return { success: true }
  } catch (error) {
    // Copie réussie mais écriture DB échouée → supprime les finaux copiés.
    await Promise.all(copiedFinalPaths.map((p) => tryDeleteFromStorage(p)))
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
 * presigned POST S3 vers le TAMPON `tmp/questions/{questionId}/…`. Ne persiste
 * PAS : au save, `setQuestionImages` copie `tmp/` → `questions/` et enregistre le
 * chemin final ; un upload non sauvegardé reste dans `tmp/` et expire (Lifecycle),
 * sans jamais polluer le vrai dossier. Le fichier ne transite PAS par le serveur.
 */
export const createQuestionImageUpload = async (input: {
  questionId: string
  kind?: "statement" | "explanation"
  imageIndex: number
  contentType: string
  size: number
}): Promise<CreateQuestionImageUploadResult> => {
  const session = await requireRole(["admin"])

  if (!QUESTION_ID_RE.test(input.questionId)) {
    return { success: false, error: "Question invalide" }
  }
  const kind: "statement" | "explanation" =
    input.kind === "explanation" ? "explanation" : "statement"
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

  const storagePath = generateQuestionImageTmpPath(
    input.questionId,
    kind,
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
