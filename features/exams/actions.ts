"use server"

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import {
  examAnswers,
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import { pauseCredit } from "@/lib/attempt-clock"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { isOpen } from "@/lib/exam-phase"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
import { computeScorePercent } from "@/lib/score"
import {
  type Refusal,
  type RefusalCode,
  refusalMessage,
  requireAttempt,
} from "../attempts/guard"
import { hasActiveAccess } from "../payments/dal"
import { viewerOf } from "../questions/answer-key-lock"
import { type SelectableUser, searchSelectableUsers } from "../users/dal"
import {
  type ExamAudienceUser,
  type QuestionExplanationView,
  getExamAudience,
  getExamQuestionExplanations,
} from "./dal"
import {
  type CreateExamInput,
  DEFAULT_PAUSE_MINUTES,
  type FinalizeExamInput,
  MAX_PAUSE_MINUTES,
  SECONDS_PER_QUESTION,
  type SaveExamAnswerInput,
  type SaveExamFlagInput,
  type UpdateExamInput,
  createExamSchema,
  finalizeExamSchema,
  loadExamQuestionExplanationsSchema,
  saveExamAnswerSchema,
  saveExamFlagSchema,
  updateExamSchema,
} from "./schemas"

const fail = (error: string) => ({ success: false as const, error })

const resolvePause = (enablePause: boolean, minutes?: number) => {
  if (!enablePause) return null
  return Math.min(minutes ?? DEFAULT_PAUSE_MINUTES, MAX_PAUSE_MINUTES)
}

// ============================================
// Lectures (wrappers composants clients)
// ============================================

/** [Auth] Explications à la demande (déplier une question — résultats). */
export const loadExamQuestionExplanations = async (
  questionIds: string[],
): Promise<QuestionExplanationView[]> => {
  await requireSession()
  const parsed = loadExamQuestionExplanationsSchema.safeParse(questionIds)
  if (!parsed.success) return []
  return getExamQuestionExplanations(parsed.data)
}

/** [Admin] Recherche serveur d'utilisateurs sélectionnables (picker d'audience). */
export const loadSearchSelectableUsers = async (params: {
  query?: string
  limit?: number
}): Promise<SelectableUser[]> => {
  await requireRole(["admin"])
  return searchSelectableUsers(params)
}

/** [Admin] Audience restreinte d'un examen (pré-remplissage du picker en édition). */
export const loadExamAudience = async (
  examId: string,
): Promise<ExamAudienceUser[]> => {
  await requireRole(["admin"])
  return getExamAudience(examId)
}

// ============================================
// Admin : CRUD examens
// ============================================

export type CreateExamResult =
  { success: true; examId: string } | { success: false; error: string }

/**
 * [Admin] Crée un examen + ses questions ordonnées (table de jonction).
 * `completionTime = n × 83 s`. Valide l'existence/non-suppression des questions.
 */
export const createExam = async (
  input: CreateExamInput,
): Promise<CreateExamResult> => {
  const session = await requireRole(["admin"])

  const parsed = createExamSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const {
    title,
    description,
    startDate,
    endDate,
    questionIds,
    enablePause,
    pauseDurationMinutes,
    audienceType,
    audienceUserIds,
  } = parsed.data

  try {
    const examId = createId()
    await db.transaction(async (tx) => {
      const [valid] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(questions)
        .where(
          and(
            inArray(questions.id, questionIds),
            sql`${questions.deletedAt} is null`,
          ),
        )
      if ((valid?.n ?? 0) !== questionIds.length) {
        throw new Error("INVALID_QUESTIONS")
      }

      await tx.insert(exams).values({
        id: examId,
        title,
        description: description ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        completionTime: questionIds.length * SECONDS_PER_QUESTION,
        enablePause,
        pauseDurationMinutes: resolvePause(enablePause, pauseDurationMinutes),
        audienceType,
        createdBy: session.user.id,
      })
      await tx.insert(examQuestions).values(
        questionIds.map((questionId, position) => ({
          examId,
          questionId,
          position,
        })),
      )

      if (audienceType === "restricted") {
        const uniqueIds = [...new Set(audienceUserIds)]
        const validUsers = await tx
          .select({ id: user.id })
          .from(user)
          .where(and(inArray(user.id, uniqueIds), isNull(user.deletedAt)))
        if (validUsers.length !== uniqueIds.length) {
          throw new Error("INVALID_USERS")
        }
        await tx
          .insert(examAudience)
          .values(uniqueIds.map((userId) => ({ examId, userId })))
      }
    })

    revalidatePath("/admin/examens")
    return { success: true, examId }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_QUESTIONS") {
        return fail("Certaines questions sélectionnées sont introuvables.")
      }
      if (error.message === "INVALID_USERS") {
        return fail("Certains utilisateurs sélectionnés sont introuvables.")
      }
    }
    captureServerError("[createExam]", error, { userId: session.user.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Met à jour un examen. Les **métadonnées** (titre, description, dates,
 * pause) restent modifiables en tout temps.
 * Le **jeu de questions** ne peut être remplacé qu'avant toute participation
 * (le changer ensuite fausserait les scores déjà enregistrés) : si l'examen a
 * des participations et que le set envoyé diffère du set courant, refus
 * (`HAS_PARTICIPATIONS`). Recalcule `completionTime`.
 */
export const updateExam = async (
  input: UpdateExamInput,
): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])

  const parsed = updateExamSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const {
    id,
    title,
    description,
    startDate,
    endDate,
    questionIds,
    enablePause,
    pauseDurationMinutes,
    audienceType,
    audienceUserIds,
  } = parsed.data

  try {
    await db.transaction(async (tx) => {
      // Verrou de ligne examen : commun avec startExam → sérialise le
      // remplacement du set de questions et le démarrage d'une participation
      // (sinon le count ci-dessous peut lire 0 avant qu'un startExam concurrent
      // ne commite sa participation).
      const [exam] = await tx
        .select({ id: exams.id })
        .from(exams)
        .where(eq(exams.id, id))
        .for("update")
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const [valid] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(questions)
        .where(
          and(
            inArray(questions.id, questionIds),
            sql`${questions.deletedAt} is null`,
          ),
        )
      if ((valid?.n ?? 0) !== questionIds.length) {
        throw new Error("INVALID_QUESTIONS")
      }

      const [parts] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(examParticipations)
        .where(eq(examParticipations.examId, id))
      const hasParticipations = (parts?.n ?? 0) > 0

      // Une fois des participations enregistrées, le jeu de questions est figé
      // (le changer fausserait les scores déjà calculés). Refus uniquement si le
      // set envoyé diffère du set courant (ordre compris) ; les métadonnées,
      // elles, restent modifiables.
      if (hasParticipations) {
        const current = await tx
          .select({ questionId: examQuestions.questionId })
          .from(examQuestions)
          .where(eq(examQuestions.examId, id))
          .orderBy(asc(examQuestions.position))
        const currentIds = current.map((r) => r.questionId)
        const unchanged =
          currentIds.length === questionIds.length &&
          currentIds.every((qid, i) => qid === questionIds[i])
        if (!unchanged) throw new Error("HAS_PARTICIPATIONS")
      }

      await tx
        .update(exams)
        .set({
          title,
          description: description ?? null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          completionTime: questionIds.length * SECONDS_PER_QUESTION,
          enablePause,
          pauseDurationMinutes: resolvePause(enablePause, pauseDurationMinutes),
          audienceType,
        })
        .where(eq(exams.id, id))

      // Réécriture de la table de jonction uniquement sans participations
      // (sinon le set est garanti inchangé ci-dessus → rien à faire).
      if (!hasParticipations) {
        await tx.delete(examQuestions).where(eq(examQuestions.examId, id))
        await tx.insert(examQuestions).values(
          questionIds.map((questionId, position) => ({
            examId: id,
            questionId,
            position,
          })),
        )
      }

      // Audience éditable à tout moment (indépendamment des participations) :
      // delete + réinsert dédupliqué si restreint, vidée si bascule subscribers.
      // Ne JAMAIS toucher examParticipations (participations conservées).
      await tx.delete(examAudience).where(eq(examAudience.examId, id))
      if (audienceType === "restricted") {
        const uniqueIds = [...new Set(audienceUserIds)]
        const validUsers = await tx
          .select({ id: user.id })
          .from(user)
          .where(and(inArray(user.id, uniqueIds), isNull(user.deletedAt)))
        if (validUsers.length !== uniqueIds.length) {
          throw new Error("INVALID_USERS")
        }
        await tx
          .insert(examAudience)
          .values(uniqueIds.map((userId) => ({ examId: id, userId })))
      }
    })

    revalidatePath("/admin/examens")
    revalidatePath(`/admin/examens/${id}`)
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return fail("Examen introuvable.")
      if (error.message === "HAS_PARTICIPATIONS") {
        return fail(
          "Cet examen a déjà des participations ; ses questions ne peuvent plus être modifiées.",
        )
      }
      if (error.message === "INVALID_QUESTIONS") {
        return fail("Certaines questions sélectionnées sont introuvables.")
      }
      if (error.message === "INVALID_USERS") {
        return fail("Certains utilisateurs sélectionnés sont introuvables.")
      }
    }
    captureServerError("[updateExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Supprime un examen (participations + réponses + jonctions en cascade FK). */
export const deleteExam = async ({
  examId,
}: {
  examId: string
}): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!examId) return fail("Examen requis")

  try {
    await db.delete(exams).where(eq(exams.id, examId))
    revalidatePath("/admin/examens")
    return { success: true }
  } catch (error) {
    captureServerError("[deleteExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Désactive un examen (soft delete, sans cascade). */
export const deactivateExam = async ({
  examId,
}: {
  examId: string
}): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!examId) return fail("Examen requis")

  try {
    await db.update(exams).set({ isActive: false }).where(eq(exams.id, examId))
    revalidatePath("/admin/examens")
    revalidatePath(`/admin/examens/${examId}`)
    return { success: true }
  } catch (error) {
    captureServerError("[deactivateExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Réactive un examen. */
export const reactivateExam = async ({
  examId,
}: {
  examId: string
}): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!examId) return fail("Examen requis")

  try {
    await db.update(exams).set({ isActive: true }).where(eq(exams.id, examId))
    revalidatePath("/admin/examens")
    revalidatePath(`/admin/examens/${examId}`)
    return { success: true }
  } catch (error) {
    captureServerError("[reactivateExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Supprime une participation (réponses en cascade) — depuis le leaderboard. */
export const deleteParticipation = async ({
  participationId,
}: {
  participationId: string
}): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!participationId) return fail("Participation requise")

  try {
    const [p] = await db
      .select({ examId: examParticipations.examId })
      .from(examParticipations)
      .where(eq(examParticipations.id, participationId))
      .limit(1)
    if (!p) return fail("Participation introuvable")

    await db
      .delete(examParticipations)
      .where(eq(examParticipations.id, participationId))

    revalidatePath(`/admin/examens/${p.examId}`)
    return { success: true }
  } catch (error) {
    captureServerError("[deleteParticipation]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

// ============================================
// Étudiant : cycle de vie de la passation
// ============================================

/**
 * Refus de la garde de tentative (code) ou refus local (message). Le code
 * accompagne le message : le client distingue `TIME_UP` (soumettre, ne pas
 * faire réessayer) sans comparer des libellés.
 */
const refused = (r: Refusal | { message: string }) =>
  "code" in r
    ? { ...fail(refusalMessage(r.code, "exam")), code: r.code }
    : fail(r.message)

export type StartExamResult =
  | { success: true; participationId: string; startedAt: number }
  | { success: false; error: string }

/**
 * [Auth] Démarre (ou reprend) un examen. Garde accès payant (bypass admin),
 * fenêtre de dates, une seule participation (idempotent si en cours, refus si
 * déjà passé). Verrou de ligne user → sérialise les démarrages concurrents.
 * Pré-crée les lignes examAnswers (une par question) avec selectedAnswer=null.
 */
export const startExam = async ({
  examId,
}: {
  examId: string
}): Promise<StartExamResult> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"
  if (!examId) return fail("Examen requis")

  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .for("update")

      // Verrou de ligne examen (après le verrou user, ordre déterministe) :
      // commun avec updateExam → un remplacement du set de questions ne peut pas
      // s'intercaler entre la création de la participation et la pré-création des
      // examAnswers.
      const [exam] = await tx
        .select({
          startDate: exams.startDate,
          endDate: exams.endDate,
          audienceType: exams.audienceType,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .for("update")
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const now = Date.now()
      const window = {
        startDate: exam.startDate.getTime(),
        endDate: exam.endDate.getTime(),
      }
      if (now < window.startDate || !isOpen(window, now)) {
        throw new Error("OUTSIDE_WINDOW")
      }

      // Garde d'accès « sélection = accès » :
      // - restricted → appartenance à examAudience requise (pas d'abonnement) ;
      // - subscribers → abonnement examen actif, lu par la transaction.
      if (!isAdmin) {
        if (exam.audienceType === "restricted") {
          const [member] = await tx
            .select({ userId: examAudience.userId })
            .from(examAudience)
            .where(
              and(
                eq(examAudience.examId, examId),
                eq(examAudience.userId, userId),
              ),
            )
            .limit(1)
          if (!member) throw new Error("NOT_IN_AUDIENCE")
        } else if (
          !(await hasActiveAccess(tx, { userId, type: "exam", now }))
        ) {
          throw new Error("ACCESS_EXPIRED")
        }
      }

      const [existing] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          startedAt: examParticipations.startedAt,
        })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, userId),
          ),
        )
        .limit(1)

      if (existing) {
        if (
          existing.status === "completed" ||
          existing.status === "auto_submitted"
        ) {
          throw new Error("ALREADY_TAKEN")
        }
        if (existing.status === "in_progress") {
          return {
            participationId: existing.id,
            startedAt: existing.startedAt?.getTime() ?? now,
          }
        }
      }

      const participationId = createId()
      await tx.insert(examParticipations).values({
        id: participationId,
        examId,
        userId,
        status: "in_progress",
        score: 0,
        startedAt: new Date(now),
      })

      const examQs = await tx
        .select({ questionId: examQuestions.questionId })
        .from(examQuestions)
        .where(eq(examQuestions.examId, examId))
      if (examQs.length > 0) {
        await tx.insert(examAnswers).values(
          examQs.map((q) => ({
            participationId,
            questionId: q.questionId,
            selectedAnswer: null,
            isCorrect: null,
            isFlagged: false,
          })),
        )
      }

      return { participationId, startedAt: now }
    })

    return { success: true, ...result }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return fail("Examen introuvable.")
      if (error.message === "OUTSIDE_WINDOW") {
        return fail("L'examen n'est pas disponible à cette période.")
      }
      if (error.message === "ALREADY_TAKEN") {
        return fail("Vous avez déjà passé cet examen.")
      }
      if (error.message === "NOT_IN_AUDIENCE") {
        return fail("Cet examen ne vous est pas destiné.")
      }
      if (error.message === "ACCESS_EXPIRED") {
        return fail("Votre accès aux examens a expiré.")
      }
    }
    captureServerError("[startExam]", error, { userId })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Enregistre ou met à jour la réponse d'une question sous la garde
 * `answer` de la participation (fenêtre, accès, pause, budget de temps à
 * L'ÉCRITURE). Anti-triche : isCorrect jamais retourné au client.
 */
export const saveExamAnswer = async (
  input: SaveExamAnswerInput,
): Promise<{
  success: boolean
  error?: string
  code?: RefusalCode
  serverNow?: number
}> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)

  const parsed = saveExamAnswerSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, selectedAnswer } = parsed.data

  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "answer",
      })
      if (!guard.ok) return guard

      // Appartenance + clé, lues APRÈS la garde : avant elle, le message
      // distinguerait une question de l'examen d'une question étrangère pour
      // un examen à venir ou un non-abonné.
      const [q] = await tx
        .select({ correctAnswer: questions.correctAnswer })
        .from(examQuestions)
        .innerJoin(questions, eq(questions.id, examQuestions.questionId))
        .where(
          and(
            eq(examQuestions.examId, examId),
            eq(examQuestions.questionId, questionId),
          ),
        )
        .limit(1)
      if (!q) {
        return {
          ok: false as const,
          message: "Cette question ne fait pas partie de l'examen.",
        }
      }
      const isCorrect = q.correctAnswer === selectedAnswer

      const updated = await tx
        .update(examAnswers)
        .set({ selectedAnswer, isCorrect })
        .where(
          and(
            eq(examAnswers.participationId, guard.attempt.id),
            eq(examAnswers.questionId, questionId),
          ),
        )
        .returning({ id: examAnswers.id })
      if (updated.length === 0) {
        return {
          ok: false as const,
          message: "Réponse non enregistrée (session incohérente).",
        }
      }
      return { ok: true as const }
    })

    if (!outcome.ok) return refused(outcome)
    // Jamais isCorrect (anti-triche) ; `serverNow` ré-ancre le chrono client.
    return { success: true, serverNow: now }
  } catch (error) {
    captureServerError("[saveExamAnswer]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Auth] Marque ou démarque une question (garde `flag` : statut seul). */
export const saveExamFlag = async (
  input: SaveExamFlagInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  const parsed = saveExamFlagSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, isFlagged } = parsed.data
  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "flag",
      })
      if (!guard.ok) return guard
      const updated = await tx
        .update(examAnswers)
        .set({ isFlagged })
        .where(
          and(
            eq(examAnswers.participationId, guard.attempt.id),
            eq(examAnswers.questionId, questionId),
          ),
        )
        .returning({ id: examAnswers.id })
      if (updated.length === 0) {
        return {
          ok: false as const,
          message: "Marquage non enregistré (session incohérente).",
        }
      }
      return { ok: true as const }
    })
    if (!outcome.ok) return refused(outcome)
    return { success: true }
  } catch (error) {
    captureServerError("[saveExamFlag]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

export type FinalizeExamResult =
  { success: true } | { success: false; error: string }

/**
 * [Auth] Finalise un examen sous la garde `close` : calcule le score depuis
 * les lignes examAnswers pré-existantes, crédite une pause en cours, met à
 * jour le statut. `isAutoSubmit` vient du client : la garde ne lui accorde
 * que l'exemption du budget (les réponses sont gardées à l'écriture).
 * Anti-triche : ni isCorrect ni le décompte des justes ne repartent vers le
 * navigateur (voir `scoreWithheldFor`) ; les résultats se lisent par la DAL
 * après clôture.
 */
export const finalizeExam = async (
  input: FinalizeExamInput,
): Promise<FinalizeExamResult> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)

  const parsed = finalizeExamSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, isAutoSubmit } = parsed.data

  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "close",
        isAutoSubmit,
      })
      if (!guard.ok) return guard
      const { id, timing } = guard.attempt

      const [agg] = await tx
        .select({
          correct:
            sql<number>`count(*) filter (where ${examAnswers.isCorrect})`.mapWith(
              Number,
            ),
          total: sql<number>`count(*)`.mapWith(Number),
        })
        .from(examAnswers)
        .where(eq(examAnswers.participationId, id))
      const score = computeScorePercent(agg?.correct ?? 0, agg?.total ?? 0)

      await tx
        .update(examParticipations)
        .set({
          status: isAutoSubmit ? "auto_submitted" : "completed",
          score,
          completedAt: new Date(now),
          pauseStartedAt: null,
          totalPauseDurationMs: pauseCredit(timing, now),
        })
        .where(eq(examParticipations.id, id))
      return { ok: true as const }
    })
    if (!outcome.ok) return refused(outcome)
    return { success: true }
  } catch (error) {
    captureServerError("[finalizeExam]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Démarre la pause (garde `pause` : statut seul). Vérifie que la pause
 * est activée et qu'aucune pause n'a déjà été utilisée.
 */
export const pauseExam = async ({
  examId,
}: {
  examId: string
}): Promise<{
  success: boolean
  error?: string
  pauseStartedAt?: number
  pauseDurationMinutes?: number
  serverNow?: number
}> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  if (!examId) return fail("Examen requis")
  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "pause",
      })
      if (!guard.ok) return guard
      const { id, timing, exam } = guard.attempt
      if (!exam.enablePause) {
        return {
          ok: false as const,
          message: "La pause n'est pas activée pour cet examen.",
        }
      }
      if (timing.pauseInProgress) {
        return { ok: false as const, message: "Vous êtes déjà en pause." }
      }
      if (timing.pauseCreditMs > 0) {
        return { ok: false as const, message: "La pause a déjà été utilisée." }
      }
      await tx
        .update(examParticipations)
        .set({ pauseStartedAt: new Date(now) })
        .where(eq(examParticipations.id, id))
      return {
        ok: true as const,
        pauseDurationMinutes:
          exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
      }
    })
    if (!outcome.ok) return refused(outcome)
    return {
      success: true,
      pauseStartedAt: now,
      pauseDurationMinutes: outcome.pauseDurationMinutes,
      serverNow: now,
    }
  } catch (error) {
    captureServerError("[pauseExam]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Reprend après la pause (garde `resume` : statut seul). Crédite la
 * durée réelle écoulée, plafonnée à la durée de pause de l'examen.
 */
export const resumeExam = async ({
  examId,
}: {
  examId: string
}): Promise<{
  success: boolean
  error?: string
  totalPauseDurationMs?: number
  serverNow?: number
}> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  if (!examId) return fail("Examen requis")
  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "resume",
      })
      if (!guard.ok) return guard
      const { id, timing } = guard.attempt
      if (!timing.pauseInProgress) {
        return { ok: false as const, message: "Vous n'êtes pas en pause." }
      }
      const total = pauseCredit(timing, now)
      await tx
        .update(examParticipations)
        .set({ pauseStartedAt: null, totalPauseDurationMs: total })
        .where(eq(examParticipations.id, id))
      return { ok: true as const, total }
    })
    if (!outcome.ok) return refused(outcome)
    return {
      success: true,
      totalPauseDurationMs: outcome.total,
      serverNow: now,
    }
  } catch (error) {
    captureServerError("[resumeExam]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}
