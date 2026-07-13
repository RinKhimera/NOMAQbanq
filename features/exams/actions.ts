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
  userAccess,
} from "@/db/schema"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { computeScorePercent } from "@/lib/score"
import { hasAccess } from "../payments/dal"
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
  saveExamAnswerSchema,
  saveExamFlagSchema,
  updateExamSchema,
} from "./schemas"

const fail = (error: string) => ({ success: false as const, error })

const logDev = (tag: string, error: unknown) => {
  if (process.env.NODE_ENV !== "production") console.error(tag, error)
}

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
  return getExamQuestionExplanations(questionIds)
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
    logDev("[createExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Met à jour un examen. Les **métadonnées** (titre, description, dates,
 * pause) restent modifiables en tout temps — parité avec l'ancien Convex.
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
      const [exam] = await tx
        .select({ id: exams.id })
        .from(exams)
        .where(eq(exams.id, id))
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
    logDev("[updateExam]", error)
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
    logDev("[deleteExam]", error)
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
    logDev("[deactivateExam]", error)
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
    logDev("[reactivateExam]", error)
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
    logDev("[deleteParticipation]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

// ============================================
// Étudiant : cycle de vie de la passation
// ============================================

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

      const [exam] = await tx
        .select({
          startDate: exams.startDate,
          endDate: exams.endDate,
          audienceType: exams.audienceType,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const now = Date.now()
      if (now < exam.startDate.getTime() || now > exam.endDate.getTime()) {
        throw new Error("OUTSIDE_WINDOW")
      }

      // Garde d'accès « sélection = accès » :
      // - restricted → appartenance à examAudience requise (pas d'abonnement) ;
      // - subscribers → abonnement examen actif (comportement historique).
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
        } else {
          // subscribers : abonnement examen actif requis. Lecture via `tx`
          // (et non `hasAccess`, qui emprunterait une 2e connexion du pool
          // pendant la transaction → risque d'épuisement du pool sous
          // concurrence). Parité avec la re-vérification de finalizeExam.
          const [acc] = await tx
            .select({ expiresAt: userAccess.expiresAt })
            .from(userAccess)
            .where(
              and(
                eq(userAccess.userId, userId),
                eq(userAccess.accessType, "exam"),
              ),
            )
            .limit(1)
          if (!acc || acc.expiresAt.getTime() <= now) {
            throw new Error("ACCESS_EXPIRED")
          }
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
    logDev("[startExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Enregistre ou met à jour la réponse d'une question (anti-triche :
 * isCorrect jamais retourné au client). Vérifie fenêtre de dates, statut de
 * participation, pause active, et appartenance de la question à l'examen.
 */
export const saveExamAnswer = async (
  input: SaveExamAnswerInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  const parsed = saveExamAnswerSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, selectedAnswer } = parsed.data

  try {
    const now = Date.now()
    const [exam] = await db
      .select({
        startDate: exams.startDate,
        endDate: exams.endDate,
        audienceType: exams.audienceType,
      })
      .from(exams)
      .where(eq(exams.id, examId))
      .limit(1)
    if (!exam) return fail("Examen introuvable.")
    if (now < exam.startDate.getTime() || now > exam.endDate.getTime())
      return fail("L'examen n'est pas disponible à cette période.")

    // Accès asymétrique (parité startExam/finalizeExam) : restricted → la
    // participation in_progress (vérifiée plus bas) EST l'autorisation, pas
    // besoin d'abonnement (la sélection octroie l'accès) ; subscribers →
    // abonnement examen actif requis.
    if (
      !isAdmin &&
      exam.audienceType === "subscribers" &&
      !(await hasAccess("exam"))
    )
      return fail("Votre accès aux examens a expiré.")

    const [p] = await db
      .select({
        id: examParticipations.id,
        status: examParticipations.status,
        pauseStartedAt: examParticipations.pauseStartedAt,
      })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, userId),
        ),
      )
      .limit(1)
    if (!p) return fail("Participation introuvable.")
    if (p.status !== "in_progress")
      return fail("Cette session d'examen n'est plus active.")
    if (p.pauseStartedAt) return fail("Réponse impossible pendant la pause.")

    const [q] = await db
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
    if (!q) return fail("Cette question ne fait pas partie de l'examen.")

    const isCorrect = q.correctAnswer === selectedAnswer
    const updated = await db
      .update(examAnswers)
      .set({ selectedAnswer, isCorrect })
      .where(
        and(
          eq(examAnswers.participationId, p.id),
          eq(examAnswers.questionId, questionId),
        ),
      )
      .returning({ id: examAnswers.id })
    if (updated.length === 0)
      return fail("Réponse non enregistrée (session incohérente).")

    return { success: true } // never return isCorrect (anti-cheat)
  } catch (error) {
    logDev("[saveExamAnswer]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Marque ou démarque une question (flag). Vérifie statut de participation.
 */
export const saveExamFlag = async (
  input: SaveExamFlagInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const parsed = saveExamFlagSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, isFlagged } = parsed.data
  try {
    const [p] = await db
      .select({ id: examParticipations.id, status: examParticipations.status })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!p) return fail("Participation introuvable.")
    if (p.status !== "in_progress")
      return fail("Cette session d'examen n'est plus active.")
    const updated = await db
      .update(examAnswers)
      .set({ isFlagged })
      .where(
        and(
          eq(examAnswers.participationId, p.id),
          eq(examAnswers.questionId, questionId),
        ),
      )
      .returning({ id: examAnswers.id })
    if (updated.length === 0)
      return fail("Marquage non enregistré (session incohérente).")
    return { success: true }
  } catch (error) {
    logDev("[saveExamFlag]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

export type FinalizeExamResult =
  | {
      success: true
      score: number
      correctAnswers: number
      totalQuestions: number
    }
  | { success: false; error: string }

/**
 * [Auth] Finalise un examen : calcule le score depuis les lignes examAnswers
 * pré-existantes, valide le budget-temps, met à jour le statut. Verrou de ligne
 * participation → soumission unique. Anti-triche : isCorrect jamais retourné.
 */
export const finalizeExam = async (
  input: FinalizeExamInput,
): Promise<FinalizeExamResult> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  const parsed = finalizeExamSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, isAutoSubmit } = parsed.data

  try {
    const result = await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({
          startDate: exams.startDate,
          endDate: exams.endDate,
          completionTime: exams.completionTime,
          pauseDurationMinutes: exams.pauseDurationMinutes,
          audienceType: exams.audienceType,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const now = Date.now()
      if (now < exam.startDate.getTime() || now > exam.endDate.getTime())
        throw new Error("OUTSIDE_WINDOW")

      const [p] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          startedAt: examParticipations.startedAt,
          pauseStartedAt: examParticipations.pauseStartedAt,
          totalPauseDurationMs: examParticipations.totalPauseDurationMs,
        })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, userId),
          ),
        )
        .for("update")
        .limit(1)
      if (!p) throw new Error("NOT_FOUND_PART")
      if (p.status === "completed" || p.status === "auto_submitted")
        throw new Error("ALREADY_TAKEN")
      if (p.status !== "in_progress") throw new Error("NOT_IN_PROGRESS")

      // Re-vérification d'accès ASYMÉTRIQUE :
      // - subscribers → re-vérifier l'abonnement (empêche de soumettre après
      //   expiration) ;
      // - restricted → AUCUNE re-vérification d'appartenance : une participation
      //   in_progress n'existe que si startExam a déjà autorisé l'accès ; un
      //   membre retiré de l'audience en cours doit pouvoir finaliser (revue #6).
      if (!isAdmin && exam.audienceType === "subscribers") {
        const [acc] = await tx
          .select({ expiresAt: userAccess.expiresAt })
          .from(userAccess)
          .where(
            and(
              eq(userAccess.userId, userId),
              eq(userAccess.accessType, "exam"),
            ),
          )
          .limit(1)
        if (!acc || acc.expiresAt.getTime() <= now)
          throw new Error("ACCESS_EXPIRED")
      }

      let pauseMs = p.totalPauseDurationMs ?? 0
      if (p.pauseStartedAt) {
        const capMs =
          (exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES) * 60 * 1000
        pauseMs += Math.min(now - p.pauseStartedAt.getTime(), capMs)
      }

      if (!p.startedAt) throw new Error("NOT_STARTED")
      const elapsed = now - p.startedAt.getTime() - pauseMs
      if (!isAutoSubmit && elapsed > exam.completionTime * 1000 + 5000)
        throw new Error("TIME_UP")

      const [agg] = await tx
        .select({
          correct:
            sql<number>`count(*) filter (where ${examAnswers.isCorrect})`.mapWith(
              Number,
            ),
          total: sql<number>`count(*)`.mapWith(Number),
        })
        .from(examAnswers)
        .where(eq(examAnswers.participationId, p.id))
      const correctAnswers = agg?.correct ?? 0
      const totalQuestions = agg?.total ?? 0
      const score = computeScorePercent(correctAnswers, totalQuestions)

      await tx
        .update(examParticipations)
        .set({
          status: isAutoSubmit ? "auto_submitted" : "completed",
          score,
          completedAt: new Date(now),
          pauseStartedAt: null,
          totalPauseDurationMs: pauseMs,
        })
        .where(eq(examParticipations.id, p.id))

      return { score, correctAnswers, totalQuestions }
    })
    return { success: true, ...result }
  } catch (error) {
    if (error instanceof Error) {
      const map: Record<string, string> = {
        NOT_FOUND: "Examen introuvable.",
        OUTSIDE_WINDOW: "L'examen n'est pas disponible à cette période.",
        NOT_FOUND_PART: "Participation introuvable.",
        ALREADY_TAKEN: "Vous avez déjà passé cet examen.",
        NOT_IN_PROGRESS: "Cette session d'examen n'est plus active.",
        ACCESS_EXPIRED: "Votre accès aux examens a expiré.",
        NOT_STARTED: "L'examen n'a pas encore été démarré.",
        TIME_UP:
          "Temps écoulé ! La soumission n'a pas pu être traitée à temps.",
      }
      const msg = map[error.message]
      if (msg) return fail(msg)
    }
    logDev("[finalizeExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Démarre la pause. Vérifie que la pause est activée, que l'examen est
 * en cours, et qu'aucune pause n'a déjà été utilisée. Verrou de ligne.
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
}> => {
  const session = await requireSession()
  if (!examId) return fail("Examen requis")
  try {
    return await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({
          enablePause: exams.enablePause,
          pauseDurationMinutes: exams.pauseDurationMinutes,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) return fail("Examen introuvable.")
      if (!exam.enablePause)
        return fail("La pause n'est pas activée pour cet examen.")
      const [p] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          pauseStartedAt: examParticipations.pauseStartedAt,
          total: examParticipations.totalPauseDurationMs,
        })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, session.user.id),
          ),
        )
        .for("update")
        .limit(1)
      if (!p) return fail("Participation introuvable.")
      if (p.status !== "in_progress")
        return fail("L'examen n'est pas en cours.")
      if (p.pauseStartedAt) return fail("Vous êtes déjà en pause.")
      if ((p.total ?? 0) > 0) return fail("La pause a déjà été utilisée.")
      const now = Date.now()
      await tx
        .update(examParticipations)
        .set({ pauseStartedAt: new Date(now) })
        .where(eq(examParticipations.id, p.id))
      return {
        success: true as const,
        pauseStartedAt: now,
        pauseDurationMinutes:
          exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
      }
    })
  } catch (error) {
    logDev("[pauseExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Reprend après la pause. Calcule la durée réelle écoulée (plafonnée à
 * la durée max de pause) et la soustrait du budget-temps à la finalisation.
 */
export const resumeExam = async ({
  examId,
}: {
  examId: string
}): Promise<{
  success: boolean
  error?: string
  totalPauseDurationMs?: number
}> => {
  const session = await requireSession()
  if (!examId) return fail("Examen requis")
  try {
    return await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({ pauseDurationMinutes: exams.pauseDurationMinutes })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) return fail("Examen introuvable.")
      const [p] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          pauseStartedAt: examParticipations.pauseStartedAt,
          total: examParticipations.totalPauseDurationMs,
        })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, session.user.id),
          ),
        )
        .for("update")
        .limit(1)
      if (!p) return fail("Participation introuvable.")
      if (p.status !== "in_progress")
        return fail("L'examen n'est pas en cours.")
      if (!p.pauseStartedAt) return fail("Vous n'êtes pas en pause.")
      const now = Date.now()
      const capMs =
        (exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES) * 60 * 1000
      const elapsed = Math.min(now - p.pauseStartedAt.getTime(), capMs)
      const total = (p.total ?? 0) + elapsed
      await tx
        .update(examParticipations)
        .set({ pauseStartedAt: null, totalPauseDurationMs: total })
        .where(eq(examParticipations.id, p.id))
      return { success: true as const, totalPauseDurationMs: total }
    })
  } catch (error) {
    logDev("[resumeExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
