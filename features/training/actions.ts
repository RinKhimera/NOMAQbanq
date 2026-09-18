"use server"

import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import {
  questionBookmarks,
  questionExplanations,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import { requireSession } from "@/lib/auth-guards"
import { getPgErrorCode } from "@/lib/db-errors"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
import { computeScorePercent } from "@/lib/score"
import { type Refusal, refusalMessage, requireAttempt } from "../attempts/guard"
import { hasAccess } from "../payments/dal"
import { lockFor, viewerOf } from "../questions/answer-key-lock"
import { expireTrainingSessions } from "./cron"
import {
  type ObjectifsView,
  type TrainingHistoryPage,
  getAvailableObjectifsCMC,
  getTrainingHistory,
} from "./dal"
import {
  type RevisionCounts,
  getRevisionCounts,
  pickRevisionQuestionIds,
} from "./revision"
import {
  type CreateTrainingSessionInput,
  type RevisionCountsScopeInput,
  type SaveTrainingAnswerInput,
  type SetQuestionBookmarkInput,
  createTrainingSessionSchema,
  revisionCountsScopeSchema,
  saveTrainingAnswerSchema,
  setQuestionBookmarkSchema,
} from "./schemas"

const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 h
const MAX_SESSIONS_PER_HOUR = 10

const fail = (error: string) => ({ success: false as const, error })

/** Refus de la garde de tentative (code) ou refus local (message). */
const refused = (r: Refusal | { message: string }) =>
  fail("code" in r ? refusalMessage(r.code, "training") : r.message)

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

/**
 * [Auth] Compteurs de révision de l'utilisateur courant (formulaire). Les
 * entrées passent par zod comme toute action : `objectifsCMCs` alimente une
 * clause `in (…)` et doit rester plafonné comme à la création de session.
 */
export const loadRevisionCounts = async (
  args: RevisionCountsScopeInput,
): Promise<RevisionCounts> => {
  const session = await requireSession()
  const parsed = revisionCountsScopeSchema.safeParse(args)
  if (!parsed.success) return { failed: 0, unseen: 0, bookmarked: 0 }
  return getRevisionCounts(viewerOf(session.user), parsed.data)
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
  | { success: true; sessionId: string; questionCount: number }
  | { success: false; error: string }

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
  const { questionCount, domain, objectifsCMCs, mode, revisionFilters } =
    parsed.data
  const criteria = revisionFilters ?? []
  const isRevision = criteria.length > 0

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
    // actives / dépassement de limite — READ COMMITTED ne sérialise pas seul).
    const selectedCount = await db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .for("update")

      if (!isAdmin) {
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
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
        if (existing.expiresAt.getTime() >= now.getTime()) {
          throw new Error("ACTIVE_EXISTS")
        }
        // La session expirée qui barre la place est close par l'écrivain du
        // cron (scorée, `completedAt` posé), sous le verrou courant.
        await expireTrainingSessions(tx, { now, sessionId: existing.id })
      }

      let picked: { id: string }[]
      if (isRevision) {
        const ids = await pickRevisionQuestionIds(tx, {
          viewer: viewerOf(session.user),
          criteria,
          domain,
          objectifsCMCs,
          limit: questionCount,
        })
        if (ids.length === 0) throw new Error("EMPTY_REVISION")
        picked = ids.map((id) => ({ id }))
      } else {
        const [avail] = await tx
          .select({ n: sql<number>`count(*)`.mapWith(Number) })
          .from(questions)
          .where(where)
        if ((avail?.n ?? 0) < questionCount) {
          throw new Error(`NOT_ENOUGH:${avail?.n ?? 0}`)
        }

        picked = await tx
          .select({ id: questions.id })
          .from(questions)
          .where(where)
          .orderBy(sql`random()`)
          .limit(questionCount)
      }

      await tx.insert(trainingSessions).values({
        id: sessionId,
        userId,
        status: "in_progress",
        mode,
        domain: domain && domain !== "all" ? domain : null,
        objectifCmc: null,
        // Le nombre RÉELLEMENT retenu : en révision le corpus peut être plus
        // court, et le score final se calcule sur ce dénominateur.
        questionCount: picked.length,
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
      return picked.length
    })

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true, sessionId, questionCount: selectedCount }
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
      if (error.message === "EMPTY_REVISION") {
        return fail(
          "Aucune question ne correspond à ces critères de révision. Élargissez la sélection.",
        )
      }
      if (error.message.startsWith("NOT_ENOUGH:")) {
        return fail(
          `Seulement ${error.message.split(":")[1]} questions disponibles. Réduisez le nombre demandé.`,
        )
      }
    }
    captureServerError("[createTrainingSession]", error, { userId })
    return fail("Erreur serveur. Réessayez.")
  }
}

export type SaveTrainingAnswerResult =
  | {
      success: true
      isCorrect?: boolean
      reveal?:
        | {
            correctAnswer: string
            explanation?: string
            references?: string[]
          }
        | { keyWithheld: true }
    }
  | { success: false; error: string }

/**
 * [Auth] Enregistre/met à jour la réponse d'un item (l'item existe déjà depuis
 * la création), sous la garde `answer` de la tentative (propriété, statut,
 * TTL, accès). Pas de revalidate (le client met à jour son état optimiste).
 */
export const saveTrainingAnswer = async (
  input: SaveTrainingAnswerInput,
): Promise<SaveTrainingAnswerResult> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)

  const parsed = saveTrainingAnswerSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { sessionId, questionId, selectedAnswer } = parsed.data

  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "training",
        ref: sessionId,
        actor,
        now,
        verb: "answer",
      })
      if (!guard.ok) return guard

      // L'item doit appartenir à la session (sinon question hors session).
      const [item] = await tx
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
      if (!item) {
        return {
          ok: false as const,
          message: "Cette question ne fait pas partie de la session",
        }
      }

      const isCorrect = selectedAnswer === item.correctAnswer
      await tx
        .update(trainingSessionItems)
        .set({ selectedAnswer, isCorrect, answeredAt: new Date(now) })
        .where(eq(trainingSessionItems.id, item.itemId))
      return {
        ok: true as const,
        mode: guard.attempt.mode,
        isCorrect,
        correctAnswer: item.correctAnswer,
      }
    })
    if (!outcome.ok) return refused(outcome)

    // Mode test : ne pas exposer isCorrect sur le fil réseau (anti-triche).
    if (outcome.mode !== "tutor") return { success: true }

    // Mode tuteur : révéler la bonne réponse + explication immédiatement, sauf
    // clé retenue par un examen ouvert (la réponse est enregistrée, seule la
    // correction est retenue). Lectures hors transaction : `lockFor` emprunte
    // le `db` global.
    const lock = await lockFor(actor, [questionId])
    if (lock.has(questionId)) {
      return { success: true, reveal: { keyWithheld: true } }
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
      isCorrect: outcome.isCorrect,
      reveal: {
        correctAnswer: outcome.correctAnswer,
        explanation: exp?.explanation ?? undefined,
        references: exp?.references ?? undefined,
      },
    }
  } catch (error) {
    captureServerError("[saveTrainingAnswer]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Pose ou retire le signet de révision d'une question. Idempotente :
 * l'état voulu est passé en entrée (pas une bascule), donc une reprise réseau de
 * `callAction` ne l'inverse pas. Aucun `revalidatePath` : l'état vit dans le
 * runner côté client.
 */
export const setQuestionBookmark = async (
  input: SetQuestionBookmarkInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const parsed = setQuestionBookmarkSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { questionId, isBookmarked } = parsed.data
  const userId = session.user.id

  try {
    if (isBookmarked) {
      await db
        .insert(questionBookmarks)
        .values({ userId, questionId })
        .onConflictDoNothing()
    } else {
      await db
        .delete(questionBookmarks)
        .where(
          and(
            eq(questionBookmarks.userId, userId),
            eq(questionBookmarks.questionId, questionId),
          ),
        )
    }
    return { success: true }
  } catch (error) {
    // 23503 : le client a envoyé une question qui n'existe pas. Erreur métier
    // mappée → pas de capture Sentry.
    if (getPgErrorCode(error) === "23503") return fail("Question introuvable.")
    captureServerError("[setQuestionBookmark]", error, { userId })
    return fail("Erreur serveur. Réessayez.")
  }
}

export type CompleteTrainingSessionResult =
  { success: true } | { success: false; error: string }

/**
 * [Auth] Termine la session sous la garde `close` : score = % de bonnes
 * réponses sur le nombre de questions de la session. Une session expirée est
 * refusée sans écriture, le cron la clôt.
 */
export const completeTrainingSession = async ({
  sessionId,
}: {
  sessionId: string
}): Promise<CompleteTrainingSessionResult> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  if (!sessionId) return fail("Session requise")

  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "training",
        ref: sessionId,
        actor,
        now,
        verb: "close",
      })
      if (!guard.ok) return guard

      const [c] = await tx
        .select({
          correct:
            sql<number>`count(*) filter (where ${trainingSessionItems.isCorrect})`.mapWith(
              Number,
            ),
        })
        .from(trainingSessionItems)
        .where(eq(trainingSessionItems.sessionId, sessionId))
      const score = computeScorePercent(
        c?.correct ?? 0,
        guard.attempt.questionCount,
      )

      await tx
        .update(trainingSessions)
        .set({ status: "completed", score, completedAt: new Date(now) })
        .where(eq(trainingSessions.id, guard.attempt.id))
      return { ok: true as const }
    })
    if (!outcome.ok) return refused(outcome)

    revalidatePath("/tableau-de-bord/entrainement")
    // Le décompte des justes compte les réponses différées : il ne repart pas
    // vers le navigateur (voir `scoreWithheldFor`), la page de résultats lit
    // la DAL.
    return { success: true }
  } catch (error) {
    captureServerError("[completeTrainingSession]", error, {
      userId: actor.id,
    })
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Auth] Abandonne une session en cours (garde `abandon` : statut seul). */
export const abandonTrainingSession = async ({
  sessionId,
}: {
  sessionId: string
}): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  if (!sessionId) return fail("Session requise")

  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "training",
        ref: sessionId,
        actor,
        now,
        verb: "abandon",
      })
      if (!guard.ok) return guard
      await tx
        .update(trainingSessions)
        .set({ status: "abandoned" })
        .where(eq(trainingSessions.id, guard.attempt.id))
      return { ok: true as const }
    })
    if (!outcome.ok) return refused(outcome)

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true }
  } catch (error) {
    captureServerError("[abandonTrainingSession]", error, {
      userId: actor.id,
    })
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
    // La propriété vit dans le WHERE : la session d'autrui est introuvable,
    // jamais « ne vous appartient pas » (qui confirmerait son existence).
    const owned = and(
      eq(trainingSessions.id, sessionId),
      eq(trainingSessions.userId, session.user.id),
    )
    const [s] = await db
      .select({ status: trainingSessions.status })
      .from(trainingSessions)
      .where(owned)
      .limit(1)
    if (!s) return fail("Session introuvable")
    if (s.status === "in_progress") {
      return fail(
        "Impossible de supprimer une session en cours. Terminez-la ou abandonnez-la d'abord.",
      )
    }

    await db.delete(trainingSessions).where(owned)

    revalidatePath("/tableau-de-bord/entrainement")
    return { success: true }
  } catch (error) {
    captureServerError("[deleteTrainingSession]", error, {
      userId: session.user.id,
    })
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
    captureServerError("[deleteAllTrainingSessions]", error, {
      userId: session.user.id,
    })
    return { success: false, deletedCount: 0, error: "Erreur serveur." }
  }
}
