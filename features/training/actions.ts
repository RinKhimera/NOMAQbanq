"use server"

import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import {
  questionExplanations,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import { requireSession } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { getOpenExamLockedQuestionIds } from "../exams/dal"
import { hasAccess } from "../payments/dal"
import {
  type ObjectifsView,
  type TrainingHistoryPage,
  getAvailableObjectifsCMC,
  getTrainingHistory,
} from "./dal"
import {
  type CreateTrainingSessionInput,
  type SaveTrainingAnswerInput,
  createTrainingSessionSchema,
  saveTrainingAnswerSchema,
} from "./schemas"

const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 h
const MAX_SESSIONS_PER_HOUR = 10

const fail = (error: string) => ({ success: false as const, error })

const logDev = (tag: string, error: unknown) => {
  if (process.env.NODE_ENV !== "production") console.error(tag, error)
}

// ============================================
// Lectures (wrappers pour composants clients)
// ============================================

/** [Auth] Page d'historique (« voir plus »). */
export const loadTrainingHistory = async (args: {
  cursor?: string | null
  limit?: number
}): Promise<TrainingHistoryPage> => {
  await requireSession()
  return getTrainingHistory(args)
}

/** [Auth] Objectifs CMC filtrés par domaine (re-requête du formulaire). */
export const loadAvailableObjectifsCMC = async (
  domain?: string,
): Promise<ObjectifsView> => {
  await requireSession()
  return getAvailableObjectifsCMC(domain)
}

// ============================================
// Écritures
// ============================================

export type CreateTrainingSessionResult =
  { success: true; sessionId: string } | { success: false; error: string }

/**
 * [Auth] Crée une session : sélectionne N questions aléatoires (domaine +
 * objectifs CMC optionnels), insère la session + un item par question (position
 * ordonnée, réponse nulle). Garde accès training (bypass admin) + rate-limit
 * 10/h + refus si session en cours non expirée. Atomique.
 */
export const createTrainingSession = async (
  input: CreateTrainingSessionInput,
): Promise<CreateTrainingSessionResult> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"

  const parsed = createTrainingSessionSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { questionCount, domain, objectifsCMCs, mode } = parsed.data

  try {
    // Accès payant : hors verrou (ne court pas avec lui-même ; bypass admin).
    if (!isAdmin && !(await hasAccess("training"))) {
      return fail("Votre accès à l'entraînement a expiré.")
    }

    // Sélection des questions (domaine + objectifs CMC, logique ET, insensible
    // à la casse).
    const objLower = objectifsCMCs
      ?.map((o) => o.trim().toLowerCase())
      .filter(Boolean)
    const where = and(
      isNull(questions.deletedAt),
      domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
      objLower?.length
        ? inArray(sql`lower(${questions.objectifCmc})`, objLower)
        : undefined,
    )

    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRATION_MS)
    const sessionId = createId()

    // Verrou de ligne user : sérialise les créations concurrentes du même
    // utilisateur. Rate-limit + « session déjà en cours » + sélection + insert
    // deviennent atomiques (sinon, deux requêtes simultanées → 2 sessions
    // actives / dépassement de limite — Postgres ne sérialise pas comme Convex).
    await db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .for("update")

      if (!isAdmin) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const [rl] = await tx
          .select({ n: sql<number>`count(*)`.mapWith(Number) })
          .from(trainingSessions)
          .where(
            and(
              eq(trainingSessions.userId, userId),
              gt(trainingSessions.startedAt, oneHourAgo),
            ),
          )
        if ((rl?.n ?? 0) >= MAX_SESSIONS_PER_HOUR) {
          throw new Error("RATE_LIMIT")
        }
      }

      const [existing] = await tx
        .select({
          id: trainingSessions.id,
          expiresAt: trainingSessions.expiresAt,
        })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.userId, userId),
            eq(trainingSessions.status, "in_progress"),
          ),
        )
        .limit(1)
      if (existing) {
        if (existing.expiresAt.getTime() >= Date.now()) {
          throw new Error("ACTIVE_EXISTS")
        }
        await tx
          .update(trainingSessions)
          .set({ status: "abandoned" })
          .where(eq(trainingSessions.id, existing.id))
      }

      const [avail] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(questions)
        .where(where)
      if ((avail?.n ?? 0) < questionCount) {
        throw new Error(`NOT_ENOUGH:${avail?.n ?? 0}`)
      }

      const picked = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(where)
        .orderBy(sql`random()`)
        .limit(questionCount)

      await tx.insert(trainingSessions).values({
        id: sessionId,
        userId,
        status: "in_progress",
        mode,
        domain: domain && domain !== "all" ? domain : null,
        objectifCmc: null,
        questionCount,
        startedAt: now,
        expiresAt,
      })
      await tx.insert(trainingSessionItems).values(
        picked.map((p, idx) => ({
          sessionId,
          questionId: p.id,
          position: idx,
        })),
      )
    })

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true, sessionId }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RATE_LIMIT") {
        return fail(
          "Trop de sessions créées récemment. Réessayez dans une heure.",
        )
      }
      if (error.message === "ACTIVE_EXISTS") {
        return fail(
          "Vous avez déjà une session en cours. Terminez-la ou attendez son expiration.",
        )
      }
      if (error.message.startsWith("NOT_ENOUGH:")) {
        return fail(
          `Seulement ${error.message.split(":")[1]} questions disponibles. Réduisez le nombre demandé.`,
        )
      }
    }
    logDev("[createTrainingSession]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

export type SaveTrainingAnswerResult =
  | {
      success: true
      isCorrect?: boolean
      reveal?: {
        correctAnswer: string
        explanation?: string
        references?: string[]
      }
    }
  | { success: false; error: string }

/**
 * [Auth] Enregistre/met à jour la réponse d'un item (l'item existe déjà depuis
 * la création). Vérifie propriété + statut + expiration + accès. Pas de
 * revalidate (le client met à jour son état optimiste).
 */
export const saveTrainingAnswer = async (
  input: SaveTrainingAnswerInput,
): Promise<SaveTrainingAnswerResult> => {
  const session = await requireSession()

  const parsed = saveTrainingAnswerSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { sessionId, questionId, selectedAnswer } = parsed.data

  try {
    const [s] = await db
      .select({
        userId: trainingSessions.userId,
        status: trainingSessions.status,
        expiresAt: trainingSessions.expiresAt,
        mode: trainingSessions.mode,
      })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, sessionId))
      .limit(1)
    if (!s) return fail("Session introuvable")
    if (s.userId !== session.user.id) {
      return fail("Cette session ne vous appartient pas")
    }
    if (s.status !== "in_progress") {
      return fail("Cette session n'est plus active")
    }
    if (s.expiresAt.getTime() < Date.now()) {
      // Garde de statut : ne pas écraser une clôture concurrente (cron/autre onglet).
      await db
        .update(trainingSessions)
        .set({ status: "abandoned" })
        .where(
          and(
            eq(trainingSessions.id, sessionId),
            eq(trainingSessions.status, "in_progress"),
          ),
        )
      return fail("Cette session a expiré")
    }
    if (session.user.role !== "admin" && !(await hasAccess("training"))) {
      return fail("Votre accès à l'entraînement a expiré.")
    }

    // L'item doit appartenir à la session (sinon question hors session).
    const [item] = await db
      .select({
        itemId: trainingSessionItems.id,
        correctAnswer: questions.correctAnswer,
      })
      .from(trainingSessionItems)
      .innerJoin(questions, eq(questions.id, trainingSessionItems.questionId))
      .where(
        and(
          eq(trainingSessionItems.sessionId, sessionId),
          eq(trainingSessionItems.questionId, questionId),
        ),
      )
      .limit(1)
    if (!item) return fail("Cette question ne fait pas partie de la session")

    const isCorrect = selectedAnswer === item.correctAnswer
    await db
      .update(trainingSessionItems)
      .set({ selectedAnswer, isCorrect, answeredAt: new Date() })
      .where(eq(trainingSessionItems.id, item.itemId))

    // Mode tuteur : révéler la bonne réponse + explication immédiatement.
    if (s.mode === "tutor") {
      // Question d'un examen OUVERT où l'utilisateur participe : reveal différé
      // jusqu'à la clôture (même verrou que getTrainingSessionById) — la réponse
      // est enregistrée, seule la correction est retenue.
      if (session.user.role !== "admin") {
        const locked = await getOpenExamLockedQuestionIds(session.user.id, [
          questionId,
        ])
        if (locked.has(questionId)) return { success: true }
      }
      const [exp] = await db
        .select({
          explanation: questionExplanations.explanation,
          references: questionExplanations.references,
        })
        .from(questionExplanations)
        .where(eq(questionExplanations.questionId, questionId))
        .limit(1)
      return {
        success: true,
        isCorrect,
        reveal: {
          correctAnswer: item.correctAnswer,
          explanation: exp?.explanation ?? undefined,
          references: exp?.references ?? undefined,
        },
      }
    }

    // Mode test : ne pas exposer isCorrect sur le fil réseau (anti-triche).
    return { success: true }
  } catch (error) {
    logDev("[saveTrainingAnswer]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

export type CompleteTrainingSessionResult =
  | {
      success: true
      score: number
      correctCount: number
      totalQuestions: number
    }
  | { success: false; error: string }

/** [Auth] Termine la session : calcule le score (% de bonnes réponses). */
export const completeTrainingSession = async ({
  sessionId,
}: {
  sessionId: string
}): Promise<CompleteTrainingSessionResult> => {
  const session = await requireSession()
  if (!sessionId) return fail("Session requise")

  try {
    const [s] = await db
      .select({
        userId: trainingSessions.userId,
        status: trainingSessions.status,
        questionCount: trainingSessions.questionCount,
        expiresAt: trainingSessions.expiresAt,
      })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, sessionId))
      .limit(1)
    if (!s) return fail("Session introuvable")
    if (s.userId !== session.user.id) {
      return fail("Cette session ne vous appartient pas")
    }
    if (s.status !== "in_progress") {
      return fail("Cette session n'est plus active")
    }
    if (s.expiresAt.getTime() < Date.now()) {
      // Parité saveTrainingAnswer : une session expirée ne se score pas, elle
      // bascule abandonnée (garde de statut contre une clôture concurrente).
      await db
        .update(trainingSessions)
        .set({ status: "abandoned" })
        .where(
          and(
            eq(trainingSessions.id, sessionId),
            eq(trainingSessions.status, "in_progress"),
          ),
        )
      return fail("Cette session a expiré")
    }
    if (session.user.role !== "admin" && !(await hasAccess("training"))) {
      return fail("Votre accès à l'entraînement a expiré.")
    }

    const [c] = await db
      .select({
        correct:
          sql<number>`count(*) filter (where ${trainingSessionItems.isCorrect})`.mapWith(
            Number,
          ),
      })
      .from(trainingSessionItems)
      .where(eq(trainingSessionItems.sessionId, sessionId))

    const correctCount = c?.correct ?? 0
    const totalQuestions = s.questionCount
    const score =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    // Garde de statut (règle concurrence du repo) : le cron d'expiration ou un
    // appel concurrent peut avoir clos la session entre la lecture et l'écriture.
    const updated = await db
      .update(trainingSessions)
      .set({ status: "completed", score, completedAt: new Date() })
      .where(
        and(
          eq(trainingSessions.id, sessionId),
          eq(trainingSessions.status, "in_progress"),
        ),
      )
      .returning({ id: trainingSessions.id })
    if (updated.length === 0) {
      return fail("Cette session n'est plus active")
    }

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true, score, correctCount, totalQuestions }
  } catch (error) {
    logDev("[completeTrainingSession]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Auth] Abandonne une session en cours. */
export const abandonTrainingSession = async ({
  sessionId,
}: {
  sessionId: string
}): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  if (!sessionId) return fail("Session requise")

  try {
    const [s] = await db
      .select({
        userId: trainingSessions.userId,
        status: trainingSessions.status,
      })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, sessionId))
      .limit(1)
    if (!s) return fail("Session introuvable")
    if (s.userId !== session.user.id) {
      return fail("Cette session ne vous appartient pas")
    }
    if (s.status !== "in_progress") {
      return fail("Cette session n'est pas en cours")
    }

    // Garde de statut (pattern du cron) : ne jamais écraser une clôture
    // concurrente (ex. re-basculer une session completed en abandoned).
    const updated = await db
      .update(trainingSessions)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(trainingSessions.id, sessionId),
          eq(trainingSessions.status, "in_progress"),
        ),
      )
      .returning({ id: trainingSessions.id })
    if (updated.length === 0) {
      return fail("Cette session n'est pas en cours")
    }

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true }
  } catch (error) {
    logDev("[abandonTrainingSession]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Auth] Supprime une session terminée/abandonnée (items en cascade FK). */
export const deleteTrainingSession = async ({
  sessionId,
}: {
  sessionId: string
}): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  if (!sessionId) return fail("Session requise")

  try {
    const [s] = await db
      .select({
        userId: trainingSessions.userId,
        status: trainingSessions.status,
      })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, sessionId))
      .limit(1)
    if (!s) return fail("Session introuvable")
    if (s.userId !== session.user.id) {
      return fail("Cette session ne vous appartient pas")
    }
    if (s.status === "in_progress") {
      return fail(
        "Impossible de supprimer une session en cours. Terminez-la ou abandonnez-la d'abord.",
      )
    }

    await db.delete(trainingSessions).where(eq(trainingSessions.id, sessionId))

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true }
  } catch (error) {
    logDev("[deleteTrainingSession]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Auth] Supprime toutes les sessions terminées/abandonnées de l'utilisateur. */
export const deleteAllTrainingSessions = async (): Promise<{
  success: boolean
  deletedCount: number
  error?: string
}> => {
  const session = await requireSession()

  try {
    const deleted = await db
      .delete(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, session.user.id),
          inArray(trainingSessions.status, ["completed", "abandoned"]),
        ),
      )
      .returning({ id: trainingSessions.id })

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true, deletedCount: deleted.length }
  } catch (error) {
    logDev("[deleteAllTrainingSessions]", error)
    return { success: false, deletedCount: 0, error: "Erreur serveur." }
  }
}
