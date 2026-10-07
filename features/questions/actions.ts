"use server"

import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm"
import { revalidatePath, revalidateTag } from "next/cache"
import type { QuestionFile } from "@/components/admin/question-detail/question-detail-content"
import type { QuizImage, QuizQuestion } from "@/components/quiz/runner/types"
import { db } from "@/db"
import {
  cmcObjectives,
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { copyInS3, createPresignedUpload } from "@/lib/aws"
import { getPgErrorCode, isPgUniqueViolation } from "@/lib/db-errors"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
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
import { questionSuccessStats } from "../analytics/answers-sql"
import { getQuestionAnswerBreakdown } from "../analytics/dal"
import { MARKETING_STATS_TAG, OBJECTIVES_TAG } from "../marketing/cache-tags"
import { lockFor } from "./answer-key-lock"
import {
  type QuestionExportRow,
  type QuestionSelection,
  getQuestionById,
  getQuestionExams,
  getQuestionsForExport,
  getQuizAnswerKey,
  getRandomQuizQuestions,
} from "./dal"
import { keyReview } from "./key-review"
import { diagnoseCorrection } from "./normalization"
import { signQuizToken, verifyQuizToken } from "./quiz-token"
import {
  type ConfirmQuestionKeyInput,
  type CreateQuestionInput,
  QUESTION_ID_PATTERN,
  type SetQuestionImagesInput,
  type UpdateQuestionInput,
  confirmQuestionKeySchema,
  createQuestionSchema,
  loadRandomQuizQuestionsSchema,
  scoreQuizAnswersSchema,
  setQuestionImagesSchema,
  updateQuestionSchema,
} from "./schemas"

const fail = (error: string) => ({ success: false as const, error })

/**
 * [Admin] Fiche d'une question pour un aperçu (compositeur d'examen) : le même
 * contenu que la page de détail. `null` si introuvable ou supprimée.
 */
export const loadQuestionFile = async (
  id: string,
): Promise<QuestionFile | null> => {
  await requireRole(["admin"])
  const [question, breakdown, exams] = await Promise.all([
    getQuestionById(id),
    getQuestionAnswerBreakdown(id),
    getQuestionExams(id),
  ])
  if (!question) return null
  return {
    question,
    breakdown,
    exams,
    review: keyReview({
      answerCount: breakdown.answerCount,
      keySuspect: breakdown.keySuspect,
      confirmation: question.keyConfirmation,
    }),
    formatIssues: diagnoseCorrection({
      explanation: question.explanation,
      references: question.references ?? [],
    }),
  }
}

// ============================================
// [Public] Quiz marketing (sans auth)
// ============================================

/**
 * [Public] Questions aléatoires pour le quiz d'évaluation marketing. Sans
 * session (page publique) mais : rate-limit IP + jeton HMAC couvrant les ids
 * servis — `scoreQuizAnswers` ne corrige que ce que CE bundle a servi.
 * La DAL masque `correctAnswer`/`explanation` et exclut les examens ouverts.
 */
export type QuizBundle = {
  questions: QuizQuestion[]
  token: string | null
}

export const loadRandomQuizQuestions = async (args: {
  count: number
  domain?: string
}): Promise<QuizBundle> => {
  // zod AVANT le rate-limit : une entrée malformée ne consomme pas de slot, et
  // un `count` non numérique ne doit jamais atteindre le LIMIT SQL.
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
  explanationImages: QuizImage[]
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
 * reste verrouillée sur TOUS les canaux pendant la fenêtre).
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
  // Un examen a pu OUVRIR pendant la vie du jeton : la clé reste retenue.
  const lock = await lockFor("anonymous", answeredIds)
  const keyMap = await getQuizAnswerKey(
    answeredIds.filter((id) => !lock.has(id)),
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
export const loadQuestionsForExport = async (
  selection: QuestionSelection,
): Promise<QuestionExportRow[]> => {
  await requireRole(["admin"])
  return getQuestionsForExport(selection)
}

export type CreateQuestionResult =
  | { success: true; id: string }
  | { success: false; error: string; alreadyExists?: true }

const revalidateQuestion = (id: string, objectivesChanged: boolean) => {
  revalidatePath("/admin/questions")
  revalidatePath(`/admin/questions/${id}`)
  revalidateTag(MARKETING_STATS_TAG, "max")
  if (objectivesChanged) revalidateTag(OBJECTIVES_TAG, "max")
}

class ObjectiveRefusedError extends Error {
  constructor() {
    super("OBJECTIVE_REFUSED")
  }
}

const OBJECTIVE_REFUSED = "Choisissez un objectif du référentiel."

/**
 * Exige un objectif du référentiel qui ne soit pas à corriger. Le verrou partagé tient jusqu'à l'écriture : une fusion
 * concurrente ne peut pas le supprimer entre-temps. Il se prend AVANT celui
 * de la question, dans l'ordre des écritures du référentiel (objectif puis
 * questions), sans quoi une fusion concurrente interbloque.
 */
const assertSelectableObjective = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  objectiveId: string,
) => {
  const [objective] = await tx
    .select({ id: cmcObjectives.id })
    .from(cmcObjectives)
    .where(
      and(eq(cmcObjectives.id, objectiveId), eq(cmcObjectives.needsFix, false)),
    )
    .for("share")
  if (!objective) throw new ObjectiveRefusedError()
}

/**
 * [Admin] Crée une question + sa ligne d'explication (1:1) atomiquement.
 * `explanation`/`references` vivent dans `questionExplanations` (split bandwidth).
 * L'identifiant peut venir du formulaire, qui l'a réservé pour envoyer les
 * images avant la création.
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
  const id = d.id ?? createId()

  try {
    await db.transaction(async (tx) => {
      await assertSelectableObjective(tx, d.objectiveId)
      await tx.insert(questions).values({
        id,
        question: d.question,
        correctAnswer: d.correctAnswer,
        options: d.options,
        objectiveId: d.objectiveId,
        domain: d.domain,
      })
      await tx.insert(questionExplanations).values({
        questionId: id,
        explanation: d.explanation,
        references: d.references ?? null,
      })
    })
    revalidateQuestion(id, true)
    return { success: true, id }
  } catch (error) {
    if (error instanceof ObjectiveRefusedError) return fail(OBJECTIVE_REFUSED)
    // Identifiant réservé déjà pris : une création précédente a abouti sans
    // que sa réponse arrive au navigateur, qui reprend en mise à jour.
    if (isPgUniqueViolation(error)) {
      return {
        ...fail("Cette question est déjà enregistrée."),
        alreadyExists: true,
      }
    }
    captureServerError("[createQuestion]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

const sameOptions = (a: string[], b: string[]) =>
  a.length === b.length && a.every((option, i) => option === b[i])

class FrozenChoicesError extends Error {
  constructor(readonly examTitle: string) {
    super("FROZEN_CHOICES")
  }
}

/**
 * [Admin] Met à jour une question + upsert de son explication, sous verrou de
 * la ligne. Choix figés : tant qu'un examen ouvert la contient, sa clé et le
 * texte de ses options ne changent pas, puisque le verdict de chaque réponse
 * est fixé au moment où elle est donnée. Modifier l'énoncé, les options ou la
 * clé efface la clé confirmée. Refuse une question supprimée.
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
    const objectivesChanged = await db.transaction(async (tx) => {
      await assertSelectableObjective(tx, d.objectiveId)
      const [current] = await tx
        .select({
          question: questions.question,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          domain: questions.domain,
          objectiveId: questions.objectiveId,
        })
        .from(questions)
        .where(and(eq(questions.id, d.id), isNull(questions.deletedAt)))
        .for("update")
      if (!current) throw new Error("Q_NOT_FOUND")

      const choicesChanged =
        current.correctAnswer !== d.correctAnswer ||
        !sameOptions(current.options, d.options)
      if (choicesChanged) {
        // Même borne que le verrou de clé de réponse : `end_date > now()`. Un
        // examen en préparation ne fige rien : l'admin corrige pendant qu'il
        // compose.
        const [open] = await tx
          .select({ title: exams.title })
          .from(examQuestions)
          .innerJoin(exams, eq(exams.id, examQuestions.examId))
          .where(
            and(
              eq(examQuestions.questionId, d.id),
              isNotNull(exams.finalizedAt),
              gt(exams.endDate, sql`now()`),
            ),
          )
          .orderBy(desc(exams.endDate))
          .limit(1)
        if (open) throw new FrozenChoicesError(open.title)
      }
      // L'énoncé reçu est rogné : un énoncé hérité à espaces de bord n'a pas
      // changé pour autant.
      const clearsConfirmation =
        choicesChanged || current.question.trim() !== d.question

      await tx
        .update(questions)
        .set({
          question: d.question,
          correctAnswer: d.correctAnswer,
          options: d.options,
          objectiveId: d.objectiveId,
          domain: d.domain,
          ...(clearsConfirmation && {
            keyConfirmedAt: null,
            keyConfirmedBy: null,
            keyConfirmedAnswerCount: null,
            keyConfirmedNote: null,
          }),
        })
        .where(eq(questions.id, d.id))

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
      return (
        current.domain !== d.domain || current.objectiveId !== d.objectiveId
      )
    })
    revalidateQuestion(d.id, objectivesChanged)
    return { success: true }
  } catch (error) {
    if (error instanceof ObjectiveRefusedError) return fail(OBJECTIVE_REFUSED)
    if (error instanceof FrozenChoicesError) {
      return fail(
        `Cette question est dans l'examen ouvert « ${error.examTitle} » : ses choix et sa clé sont verrouillés jusqu'à la fermeture.`,
      )
    }
    if (error instanceof Error && error.message === "Q_NOT_FOUND") {
      return fail("Question introuvable")
    }
    captureServerError("[updateQuestion]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Clé confirmée : l'admin juge la clé juste malgré la répartition.
 * Remplace la confirmation précédente et retient le nombre de réponses du
 * moment, d'où partira le doublement. Refusée si la répartition ne désigne
 * plus d'autre option. Ne touche pas à la date de modification : la question
 * n'a pas changé.
 */
export const confirmQuestionKey = async (
  input: ConfirmQuestionKeyInput,
): Promise<{ success: true } | { success: false; error: string }> => {
  const session = await requireRole(["admin"])

  const parsed = confirmQuestionKeySchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { id, note } = parsed.data

  try {
    const outcome = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ updatedAt: questions.updatedAt })
        .from(questions)
        .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
        .for("update")
      if (!current) return "not_found" as const

      const stats = questionSuccessStats([id])
      const [s] = await tx
        .with(stats)
        .select({
          answerCount: stats.answerCount,
          keySuspect: stats.keySuspect,
        })
        .from(stats)
      if (!s?.keySuspect) return "not_suspect" as const

      await tx
        .update(questions)
        .set({
          keyConfirmedAt: new Date(),
          keyConfirmedBy: session.user.id,
          keyConfirmedAnswerCount: s.answerCount,
          keyConfirmedNote: note ? note : null,
          updatedAt: current.updatedAt,
        })
        .where(eq(questions.id, id))
      return "confirmed" as const
    })
    if (outcome === "not_found") return fail("Question introuvable")
    if (outcome === "not_suspect") {
      return fail(
        "La répartition ne désigne plus d'autre option que la clé : rien à confirmer.",
      )
    }
    revalidatePath("/admin/questions")
    revalidatePath(`/admin/questions/${id}`)
    return { success: true }
  } catch (error) {
    captureServerError("[confirmQuestionKey]", error)
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
  const code = getPgErrorCode(error)
  return code !== undefined && FK_VIOLATION_CODES.has(code)
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
    revalidateTag(MARKETING_STATS_TAG, "max")
    revalidateTag(OBJECTIVES_TAG, "max")
    return { success: true, mode: "hard" }
  } catch (error) {
    if (error instanceof Error && error.message === "Q_NOT_FOUND") {
      return fail("Question introuvable")
    }
    if (!isForeignKeyViolation(error)) {
      captureServerError("[deleteQuestion]", error)
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
    revalidateTag(MARKETING_STATS_TAG, "max")
    revalidateTag(OBJECTIVES_TAG, "max")
    return { success: true, mode: "soft" }
  } catch (error) {
    captureServerError("[deleteQuestion]", error)
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
  // Préfixe volontairement à la QUESTION (et non `questions/{id}/{kind}/`) : une
  // partie des images en base a un chemin plat (`questions/{id}/<ts>-<i>.jpg`,
  // `kind=statement`) — un préfixe par `kind` casserait la ré-sauvegarde de ces
  // questions. L'isolation par `kind` (sauver
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
    captureServerError("[setQuestionImages] validate", error)
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
    captureServerError("[setQuestionImages] copy", error)
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
    captureServerError("[setQuestionImages]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

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
 * (anti path-traversal) et non supprimé, éventuellement pas encore créé
 * (identifiant réservé par le formulaire) → validation type/taille → rate-limit (50/h) →
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

  if (!QUESTION_ID_PATTERN.test(input.questionId)) {
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

  // Identifiant réservé par le formulaire de création : la question n'existe
  // pas encore. Une question supprimée, elle, ne reçoit plus d'images.
  const [q] = await db
    .select({ deletedAt: questions.deletedAt })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1)
  if (q?.deletedAt) {
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
    captureServerError("[createQuestionImageUpload]", error, {
      userId: session.user.id,
    })
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}
