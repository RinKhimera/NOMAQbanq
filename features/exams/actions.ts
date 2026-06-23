"use server"

import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
  userAccess,
} from "@/db/schema"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { hasAccess } from "../payments/dal"
import {
  type QuestionExplanationView,
  getExamQuestionExplanations,
} from "./dal"
import {
  type CreateExamInput,
  DEFAULT_PAUSE_MINUTES,
  MAX_PAUSE_MINUTES,
  SECONDS_PER_QUESTION,
  type SubmitExamAnswersInput,
  type UpdateExamInput,
  createExamSchema,
  submitExamAnswersSchema,
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

// ============================================
// Admin : CRUD examens
// ============================================

export type CreateExamResult =
  | { success: true; examId: string }
  | { success: false; error: string }

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
        createdBy: session.user.id,
      })
      await tx.insert(examQuestions).values(
        questionIds.map((questionId, position) => ({
          examId,
          questionId,
          position,
        })),
      )
    })

    revalidatePath("/admin/exams")
    return { success: true, examId }
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_QUESTIONS") {
      return fail("Certaines questions sélectionnées sont introuvables.")
    }
    logDev("[createExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Admin] Met à jour un examen et remplace l'ensemble de ses questions.
 * Recalcule `completionTime`. Refuse si l'examen a déjà des participations
 * (modifier le jeu de questions fausserait les scores enregistrés).
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
  } = parsed.data

  try {
    await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({ id: exams.id })
        .from(exams)
        .where(eq(exams.id, id))
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const [parts] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(examParticipations)
        .where(eq(examParticipations.examId, id))
      if ((parts?.n ?? 0) > 0) throw new Error("HAS_PARTICIPATIONS")

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
        })
        .where(eq(exams.id, id))

      await tx.delete(examQuestions).where(eq(examQuestions.examId, id))
      await tx.insert(examQuestions).values(
        questionIds.map((questionId, position) => ({
          examId: id,
          questionId,
          position,
        })),
      )
    })

    revalidatePath("/admin/exams")
    revalidatePath(`/admin/exams/${id}`)
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
    revalidatePath("/admin/exams")
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
    revalidatePath("/admin/exams")
    revalidatePath(`/admin/exams/${examId}`)
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
    revalidatePath("/admin/exams")
    revalidatePath(`/admin/exams/${examId}`)
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

    revalidatePath(`/admin/exams/${p.examId}`)
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
  | {
      success: true
      participationId: string
      startedAt: number
      pausePhase: "before_pause" | "during_pause" | "after_pause" | null
    }
  | { success: false; error: string }

/**
 * [Auth] Démarre (ou reprend) un examen. Garde accès payant (bypass admin),
 * fenêtre de dates, une seule participation (idempotent si en cours, refus si
 * déjà passé). Verrou de ligne user → sérialise les démarrages concurrents.
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
    if (!isAdmin && !(await hasAccess("exam"))) {
      return fail("Votre accès aux examens a expiré.")
    }

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
          enablePause: exams.enablePause,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const now = Date.now()
      if (now < exam.startDate.getTime() || now > exam.endDate.getTime()) {
        throw new Error("OUTSIDE_WINDOW")
      }

      const [existing] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          startedAt: examParticipations.startedAt,
          pausePhase: examParticipations.pausePhase,
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
            pausePhase: existing.pausePhase,
          }
        }
      }

      const participationId = createId()
      const pausePhase = exam.enablePause ? ("before_pause" as const) : null
      await tx.insert(examParticipations).values({
        id: participationId,
        examId,
        userId,
        status: "in_progress",
        score: 0,
        startedAt: new Date(now),
        pausePhase,
      })
      return { participationId, startedAt: now, pausePhase }
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
    }
    logDev("[startExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

export type SubmitExamResult =
  | {
      success: true
      score: number
      correctAnswers: number
      totalQuestions: number
    }
  | { success: false; error: string }

/**
 * [Auth] Soumet les réponses : score recalculé serveur (anti-triche), budget-temps
 * validé (`elapsed = now − startedAt − pause`, grâce 5 s sauf auto-submit), pause
 * appliquée (questions verrouillées). Verrou de ligne participation → soumission
 * unique. Réponses upsert dans `examAnswers`.
 */
export const submitExamAnswers = async (
  input: SubmitExamAnswersInput,
): Promise<SubmitExamResult> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  const parsed = submitExamAnswersSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { examId, answers, isAutoSubmit } = parsed.data

  try {
    const result = await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({
          startDate: exams.startDate,
          endDate: exams.endDate,
          completionTime: exams.completionTime,
          enablePause: exams.enablePause,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const now = Date.now()
      if (now < exam.startDate.getTime() || now > exam.endDate.getTime()) {
        throw new Error("OUTSIDE_WINDOW")
      }

      const [p] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          startedAt: examParticipations.startedAt,
          pausePhase: examParticipations.pausePhase,
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
      if (p.status === "completed" || p.status === "auto_submitted") {
        throw new Error("ALREADY_TAKEN")
      }
      if (p.status !== "in_progress") throw new Error("NOT_IN_PROGRESS")

      // Re-vérifier l'accès payant à la soumission (sur la connexion tx).
      if (!isAdmin) {
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

      // Budget-temps (le serveur fait foi). La pause est soustraite.
      if (!p.startedAt) throw new Error("NOT_STARTED")
      let elapsed = now - p.startedAt.getTime()
      if (p.totalPauseDurationMs) elapsed -= p.totalPauseDurationMs
      const maxMs = exam.completionTime * 1000
      if (!isAutoSubmit && elapsed > maxMs + 5000) {
        throw new Error("TIME_UP")
      }

      // Questions de l'examen : positions (pour la pause) + bonnes réponses
      // (pour le score), en une requête.
      const examQs = await tx
        .select({
          questionId: examQuestions.questionId,
          position: examQuestions.position,
          correctAnswer: questions.correctAnswer,
        })
        .from(examQuestions)
        .innerJoin(questions, eq(questions.id, examQuestions.questionId))
        .where(eq(examQuestions.examId, examId))
        .orderBy(asc(examQuestions.position))

      const totalQuestions = examQs.length
      const posMap = new Map(examQs.map((q) => [q.questionId, q.position]))
      const correctMap = new Map(
        examQs.map((q) => [q.questionId, q.correctAnswer]),
      )

      // Anti-triche pause : aucune réponse à une question verrouillée.
      if (exam.enablePause && p.pausePhase) {
        const midpoint = Math.floor(totalQuestions / 2)
        for (const a of answers) {
          const idx = posMap.get(a.questionId)
          if (idx === undefined) continue
          if (p.pausePhase === "before_pause" && idx >= midpoint) {
            throw new Error("FRAUD")
          }
          if (p.pausePhase === "during_pause") throw new Error("PAUSE_SUBMIT")
        }
      }

      // Dédup par questionId (dernière réponse gagne) : un doublon dans le
      // payload ferait échouer l'INSERT … ON CONFLICT (erreur Postgres 21000,
      // « affecte 2× la même ligne ») et donc toute la soumission.
      const deduped = [
        ...new Map(answers.map((a) => [a.questionId, a])).values(),
      ]

      // Score serveur. Seules les réponses appartenant à l'examen comptent et
      // sont persistées. Non répondues = fausses (dénominateur = total examen).
      let correctAnswers = 0
      const toInsert: {
        id: string
        participationId: string
        questionId: string
        selectedAnswer: string
        isCorrect: boolean
        isFlagged: boolean
      }[] = []
      for (const a of deduped) {
        if (!correctMap.has(a.questionId)) continue
        const isCorrect = correctMap.get(a.questionId) === a.selectedAnswer
        if (isCorrect) correctAnswers++
        toInsert.push({
          id: createId(),
          participationId: p.id,
          questionId: a.questionId,
          selectedAnswer: a.selectedAnswer,
          isCorrect,
          isFlagged: a.isFlagged ?? false,
        })
      }

      const score =
        totalQuestions > 0
          ? Math.round((correctAnswers / totalQuestions) * 100)
          : 0

      if (toInsert.length > 0) {
        await tx
          .insert(examAnswers)
          .values(toInsert)
          .onConflictDoUpdate({
            target: [examAnswers.participationId, examAnswers.questionId],
            set: {
              selectedAnswer: sql`excluded.selected_answer`,
              isCorrect: sql`excluded.is_correct`,
              isFlagged: sql`excluded.is_flagged`,
            },
          })
      }

      await tx
        .update(examParticipations)
        .set({
          status: isAutoSubmit ? "auto_submitted" : "completed",
          score,
          completedAt: new Date(now),
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
        FRAUD:
          "Tentative frauduleuse détectée : réponse à une question verrouillée.",
        PAUSE_SUBMIT:
          "Soumission non autorisée pendant la pause. Reprenez l'examen.",
      }
      const msg = map[error.message]
      if (msg) return fail(msg)
    }
    logDev("[submitExamAnswers]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

export type StartPauseResult =
  | { success: true; pauseStartedAt: number; pauseDurationMinutes: number }
  | { success: false; error: string }

/**
 * [Auth] Démarre la pause (before_pause → during_pause). Auto-pause uniquement
 * à mi-parcours (−10 s). Verrou de ligne participation.
 */
export const startPause = async ({
  examId,
  manualTrigger,
}: {
  examId: string
  manualTrigger?: boolean
}): Promise<StartPauseResult> => {
  const session = await requireSession()
  const userId = session.user.id
  if (!examId) return fail("Examen requis")

  try {
    const result = await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({
          enablePause: exams.enablePause,
          completionTime: exams.completionTime,
          pauseDurationMinutes: exams.pauseDurationMinutes,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")
      if (!exam.enablePause) throw new Error("PAUSE_DISABLED")

      const [p] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          startedAt: examParticipations.startedAt,
          pausePhase: examParticipations.pausePhase,
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
      if (p.status !== "in_progress") throw new Error("NOT_IN_PROGRESS")
      if (p.pausePhase !== "before_pause") throw new Error("ALREADY_PAUSED")

      const now = Date.now()
      if (!manualTrigger) {
        if (!p.startedAt) throw new Error("NOT_STARTED")
        const elapsed = now - p.startedAt.getTime()
        const half = (exam.completionTime * 1000) / 2
        if (elapsed < half - 10000) throw new Error("TOO_EARLY")
      }

      await tx
        .update(examParticipations)
        .set({ pausePhase: "during_pause", pauseStartedAt: new Date(now) })
        .where(eq(examParticipations.id, p.id))

      return {
        pauseStartedAt: now,
        pauseDurationMinutes:
          exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
      }
    })

    return { success: true, ...result }
  } catch (error) {
    if (error instanceof Error) {
      const map: Record<string, string> = {
        NOT_FOUND: "Examen introuvable.",
        PAUSE_DISABLED: "La pause n'est pas activée pour cet examen.",
        NOT_FOUND_PART: "Participation introuvable.",
        NOT_IN_PROGRESS: "L'examen n'est pas en cours.",
        ALREADY_PAUSED: "La pause ne peut être démarrée qu'une seule fois.",
        NOT_STARTED: "L'examen n'a pas encore été démarré.",
        TOO_EARLY:
          "La pause automatique ne peut être déclenchée qu'à la mi-parcours du chronomètre.",
      }
      const msg = map[error.message]
      if (msg) return fail(msg)
    }
    logDev("[startPause]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

export type ResumePauseResult =
  | {
      success: true
      pauseEndedAt: number
      isPauseCutShort: boolean
      totalPauseDurationMs: number
    }
  | { success: false; error: string }

/**
 * [Auth] Reprend après la pause (during_pause → after_pause). Calcule la durée
 * réelle de pause (soustraite du budget-temps à la soumission). Verrou de ligne.
 */
export const resumeFromPause = async ({
  examId,
}: {
  examId: string
}): Promise<ResumePauseResult> => {
  const session = await requireSession()
  const userId = session.user.id
  if (!examId) return fail("Examen requis")

  try {
    const result = await db.transaction(async (tx) => {
      const [exam] = await tx
        .select({ pauseDurationMinutes: exams.pauseDurationMinutes })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")

      const [p] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          pausePhase: examParticipations.pausePhase,
          pauseStartedAt: examParticipations.pauseStartedAt,
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
      if (p.status !== "in_progress") throw new Error("NOT_IN_PROGRESS")
      if (p.pausePhase !== "during_pause") throw new Error("NOT_PAUSED")

      const now = Date.now()
      const pauseStartedMs = p.pauseStartedAt?.getTime() ?? now
      const pauseDurationMs =
        (exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES) * 60 * 1000
      const isPauseCutShort = now < pauseStartedMs + pauseDurationMs
      const totalPauseDurationMs = now - pauseStartedMs

      await tx
        .update(examParticipations)
        .set({
          pausePhase: "after_pause",
          pauseEndedAt: new Date(now),
          isPauseCutShort,
          totalPauseDurationMs,
        })
        .where(eq(examParticipations.id, p.id))

      return { pauseEndedAt: now, isPauseCutShort, totalPauseDurationMs }
    })

    return { success: true, ...result }
  } catch (error) {
    if (error instanceof Error) {
      const map: Record<string, string> = {
        NOT_FOUND: "Examen introuvable.",
        NOT_FOUND_PART: "Participation introuvable.",
        NOT_IN_PROGRESS: "L'examen n'est pas en cours.",
        NOT_PAUSED: "Vous n'êtes pas actuellement en pause.",
      }
      const msg = map[error.message]
      if (msg) return fail(msg)
    }
    logDev("[resumeFromPause]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
