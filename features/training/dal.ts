import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { db } from "@/db"
import {
  cmcObjectives,
  questionBookmarks,
  questionExplanations,
  questions,
  trainingSessionItems,
  trainingSessions,
} from "@/db/schema"
import { requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { objectiveLabelSql } from "../objectives/sql"
import {
  type LockUser,
  lockFor,
  scoreWithheldFor,
  viewerOf,
} from "../questions/answer-key-lock"
import { fetchImages, toQuizQuestion } from "../questions/quiz-bridge"

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(lo, Math.floor(n)), hi)

// Questions RÉPONDUES d'une session, corrélées à la ligne `training_sessions`
// lue — la forme attendue par `scoreWithheldFor`.
const answeredQuestionIds = sql`
  select i.question_id
    from training_session_items i
   where i.session_id = ${trainingSessions.id}
     and i.selected_answer is not null
     and i.selected_answer <> ''`

/** Score enregistré, ou `null` s'il est retenu pour le lecteur (voir `scoreWithheldFor`). */
const readableScore = (viewer: LockUser) =>
  sql<
    number | null
  >`case when ${scoreWithheldFor(viewer, answeredQuestionIds)} then null else coalesce(${trainingSessions.score}, 0) end`

/** Filtre d'agrégat : seules les sessions dont le score est lisible. */
export const sessionScoreReadable = (viewer: LockUser) =>
  sql`not ${scoreWithheldFor(viewer, answeredQuestionIds)}`

// ============================================
// Types de vue
// ============================================

export type TrainingAnswerRecord = Record<
  string,
  { selectedAnswer: string; isCorrect?: boolean }
>

// ============================================
// Session active (carte « reprendre »)
// ============================================

export type ActiveTrainingSession = {
  session: {
    id: string
    questionCount: number
    /** Réponses déjà données : « N / M répondues » de la carte « Série en cours ». */
    answeredCount: number
    mode: "tutor" | "test"
    domain: string | null
    startedAt: number
    expiresAt: number
  }
  isExpired: boolean
  canResume: boolean
  remainingTimeMs: number
} | null

/** Session `in_progress` de l'utilisateur courant (ou `null`). */
export const getActiveTrainingSession = cache(
  async (): Promise<ActiveTrainingSession> => {
    const session = await getCurrentSession()
    if (!session?.user) return null

    const [active] = await db
      .select({
        id: trainingSessions.id,
        questionCount: trainingSessions.questionCount,
        answeredCount:
          sql<number>`(select count(*) from (${answeredQuestionIds}) answered)`.mapWith(
            Number,
          ),
        mode: trainingSessions.mode,
        domain: trainingSessions.domain,
        startedAt: trainingSessions.startedAt,
        expiresAt: trainingSessions.expiresAt,
      })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, session.user.id),
          eq(trainingSessions.status, "in_progress"),
        ),
      )
      .orderBy(desc(trainingSessions.startedAt))
      .limit(1)
    if (!active) return null

    const now = Date.now()
    const expiresMs = active.expiresAt.getTime()
    const isExpired = expiresMs < now
    return {
      session: {
        id: active.id,
        questionCount: active.questionCount,
        answeredCount: active.answeredCount,
        mode: active.mode,
        domain: active.domain,
        startedAt: active.startedAt.getTime(),
        expiresAt: expiresMs,
      },
      isExpired,
      canResume: !isExpired,
      remainingTimeMs: isExpired ? 0 : expiresMs - now,
    }
  },
)

// ============================================
// Historique (pagination numérotée)
// ============================================

export type TrainingHistoryItem = {
  id: string
  questionCount: number
  /** `null` = score retenu (une réponse en correction différée). */
  score: number | null
  domain: string | null
  mode: "tutor" | "test"
  completedAt: number | null
  startedAt: number
}

export type TrainingHistoryPage = {
  items: TrainingHistoryItem[]
  /** Séries complétées de l'utilisateur, toutes pages confondues. */
  total: number
  page: number
  pageSize: number
}

export const TRAINING_HISTORY_PAGE_SIZE = 10

/**
 * Historique des sessions **complétées**, par pages numérotées (`completedAt`
 * puis `id` décroissants). Une page hors bornes rend une page vide, jamais une
 * erreur. Vide si non connecté.
 */
export const getTrainingHistory = async ({
  page = 1,
  pageSize = TRAINING_HISTORY_PAGE_SIZE,
}: {
  page?: number
  pageSize?: number
} = {}): Promise<TrainingHistoryPage> => {
  const safeSize = clamp(pageSize, 1, 50)
  // Borne haute : 100 pages de 50, au-delà de ce qu'un historique atteint.
  const safePage = clamp(Number.isFinite(page) ? page : 1, 1, 100)
  const empty = { items: [], total: 0, page: safePage, pageSize: safeSize }
  const session = await getCurrentSession()
  if (!session?.user) return empty
  const viewer = viewerOf(session.user)

  const owned = and(
    eq(trainingSessions.userId, session.user.id),
    eq(trainingSessions.status, "completed"),
  )
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: trainingSessions.id,
        questionCount: trainingSessions.questionCount,
        score: readableScore(viewer),
        domain: trainingSessions.domain,
        mode: trainingSessions.mode,
        completedAt: trainingSessions.completedAt,
        startedAt: trainingSessions.startedAt,
      })
      .from(trainingSessions)
      .where(owned)
      .orderBy(desc(trainingSessions.completedAt), desc(trainingSessions.id))
      .offset((safePage - 1) * safeSize)
      .limit(safeSize),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(trainingSessions)
      .where(owned),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      questionCount: r.questionCount,
      score: r.score,
      domain: r.domain,
      mode: r.mode,
      completedAt: r.completedAt?.getTime() ?? null,
      startedAt: r.startedAt.getTime(),
    })),
    total: count?.n ?? 0,
    page: safePage,
    pageSize: safeSize,
  }
}

/**
 * Signets de **l'utilisateur courant** parmi `questionIds`. Un signet est un
 * état personnel : les appelants qui affichent la session d'un autre
 * utilisateur (admin) ne doivent pas les demander.
 */
export const getBookmarkedQuestionIds = async (
  questionIds: string[],
): Promise<string[]> => {
  const session = await getCurrentSession()
  if (!session?.user || questionIds.length === 0) return []

  const rows = await db
    .select({ questionId: questionBookmarks.questionId })
    .from(questionBookmarks)
    .where(
      and(
        eq(questionBookmarks.userId, session.user.id),
        inArray(questionBookmarks.questionId, questionIds),
      ),
    )
  return rows.map((r) => r.questionId)
}

// ============================================
// Domaines + objectifs CMC (config form)
// ============================================

export type DomainsView = {
  domains: { domain: string; count: number }[]
  totalQuestions: number
}

/** Domaines + comptage (sélecteur du formulaire). Remplace `getAvailableDomains`. */
export const getAvailableDomains = cache(async (): Promise<DomainsView> => {
  await requireSession()
  const rows = await db
    .select({
      domain: questions.domain,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(questions)
    .where(isNull(questions.deletedAt))
    .groupBy(questions.domain)

  const domains = rows
    .map((r) => ({ domain: r.domain, count: r.count }))
    .sort((a, b) => b.count - a.count)
  const totalQuestions = domains.reduce((s, d) => s + d.count, 0)
  return { domains, totalQuestions }
})

export type ObjectifsView = {
  objectifs: { id: string; objectif: string; count: number }[]
  total: number
}

/**
 * Objectifs du référentiel + comptage (multi-select), optionnellement filtrés
 * par domaine. Les entrées à corriger ne sont jamais proposées.
 */
export const getAvailableObjectifsCMC = cache(
  async (domain?: string): Promise<ObjectifsView> => {
    await requireSession()
    const where = and(
      isNull(questions.deletedAt),
      eq(cmcObjectives.needsFix, false),
      domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
    )
    const rows = await db
      .select({
        id: cmcObjectives.id,
        objectif: cmcObjectives.label,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(questions)
      .innerJoin(cmcObjectives, eq(cmcObjectives.id, questions.objectiveId))
      .where(where)
      .groupBy(cmcObjectives.id, cmcObjectives.label)
      .limit(5000)

    const objectifs = rows
      .filter((r) => r.count > 0)
      .map((r) => ({ id: r.id, objectif: r.objectif, count: r.count }))
      .sort((a, b) =>
        b.count !== a.count
          ? b.count - a.count
          : a.objectif.localeCompare(b.objectif, "fr"),
      )
    const total = objectifs.reduce((s, o) => s + o.count, 0)
    return { objectifs, total }
  },
)

// ============================================
// Session par id (passation) + résultats
// ============================================

export type TrainingSessionView = {
  session: {
    id: string
    questionCount: number
    status: "in_progress" | "completed" | "abandoned"
    mode: "tutor" | "test"
    domain: string | null
    startedAt: number
    completedAt: number | null
    expiresAt: number
  }
  questions: QuizQuestion[]
  answers: TrainingAnswerRecord
  /** Signets de l'utilisateur courant parmi les questions de la session. */
  bookmarkedIds: string[]
  isExpired: boolean
} | null

/**
 * Session par id (passation). Propriété requise (ou admin). `correctAnswer`
 * masqué tant que la session n'est pas complétée (anti-triche). Remplace
 * `getTrainingSessionById`.
 */
export const getTrainingSessionById = async (
  sessionId: string,
): Promise<TrainingSessionView> => {
  const session = await getCurrentSession()
  if (!session?.user) return null

  const [s] = await db
    .select({
      id: trainingSessions.id,
      userId: trainingSessions.userId,
      questionCount: trainingSessions.questionCount,
      status: trainingSessions.status,
      mode: trainingSessions.mode,
      domain: trainingSessions.domain,
      startedAt: trainingSessions.startedAt,
      completedAt: trainingSessions.completedAt,
      expiresAt: trainingSessions.expiresAt,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .limit(1)
  if (!s) return null
  if (s.userId !== session.user.id && session.user.role !== "admin") return null

  const isCompleted = s.status === "completed"
  const isTutor = s.mode === "tutor"

  const items = await db
    .select({
      questionId: trainingSessionItems.questionId,
      selectedAnswer: trainingSessionItems.selectedAnswer,
      isCorrect: trainingSessionItems.isCorrect,
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: objectiveLabelSql,
      domain: questions.domain,
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(trainingSessionItems)
    .innerJoin(questions, eq(questions.id, trainingSessionItems.questionId))
    .leftJoin(
      questionExplanations,
      eq(questionExplanations.questionId, trainingSessionItems.questionId),
    )
    .where(eq(trainingSessionItems.sessionId, sessionId))
    .orderBy(asc(trainingSessionItems.position))

  const sessionQuestionIds = items.map((i) => i.questionId)
  const isOwner = s.userId === session.user.id
  const [imgMap, lock, bookmarkedIds] = await Promise.all([
    fetchImages(sessionQuestionIds),
    lockFor(viewerOf(session.user), sessionQuestionIds),
    // Un signet est personnel : un admin qui inspecte la session d'un étudiant
    // verrait les SIENS, donc des drapeaux incohérents avec ce qu'il regarde.
    isOwner ? getBookmarkedQuestionIds(sessionQuestionIds) : [],
  ])

  const questionsView = items.map((i) => {
    // Session terminée, ou question déjà répondue en mode tuteur.
    const mayReveal = isCompleted || (isTutor && i.selectedAnswer !== null)
    const images = imgMap.get(i.questionId) ?? []
    return toQuizQuestion(i, images, lock, mayReveal ? "correction" : null)
  })

  // Reveal isCorrect in answers only when session is completed or in tutor mode.
  // In test mode in_progress: no isCorrect leak. isCorrect + selectedAnswer
  // révèle la clé → masqué aussi pour les questions verrouillées.
  const revealAnswers = isCompleted || isTutor
  const answers: TrainingAnswerRecord = {}
  for (const i of items) {
    if (i.selectedAnswer !== null) {
      answers[i.questionId] =
        revealAnswers && !lock.has(i.questionId)
          ? {
              selectedAnswer: i.selectedAnswer,
              isCorrect: i.isCorrect ?? false,
            }
          : { selectedAnswer: i.selectedAnswer }
    }
  }

  return {
    session: {
      id: s.id,
      questionCount: s.questionCount,
      status: s.status,
      mode: s.mode,
      domain: s.domain,
      startedAt: s.startedAt.getTime(),
      completedAt: s.completedAt?.getTime() ?? null,
      expiresAt: s.expiresAt.getTime(),
    },
    questions: questionsView,
    answers,
    bookmarkedIds,
    isExpired: s.expiresAt.getTime() < Date.now(),
  }
}

export type TrainingResultsView =
  | { error: "SESSION_NOT_COMPLETED" }
  | {
      session: {
        id: string
        /** `null` = score retenu (une réponse en correction différée). */
        score: number | null
        questionCount: number
        mode: "tutor" | "test"
        startedAt: number
        completedAt: number | null
        domain: string | null
      }
      questions: QuizQuestion[]
      answers: TrainingAnswerRecord
      /** Signets de l'utilisateur courant parmi les questions : filtre « Marquées ». */
      bookmarkedIds: string[]
    }
  | null

/**
 * Résultats d'une session **complétée** (révision). Propriété requise (ou admin).
 * Inclut `correctAnswer` + explication + références (jointes), images. Remplace
 * `getTrainingSessionResults` (sans le lazy-load `getQuestionExplanations`).
 */
export const getTrainingSessionResults = async (
  sessionId: string,
): Promise<TrainingResultsView> => {
  const session = await getCurrentSession()
  if (!session?.user) return null

  const [s] = await db
    .select({
      id: trainingSessions.id,
      userId: trainingSessions.userId,
      status: trainingSessions.status,
      score: trainingSessions.score,
      questionCount: trainingSessions.questionCount,
      mode: trainingSessions.mode,
      startedAt: trainingSessions.startedAt,
      completedAt: trainingSessions.completedAt,
      domain: trainingSessions.domain,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .limit(1)
  if (!s) return null
  if (s.userId !== session.user.id && session.user.role !== "admin") return null
  if (s.status !== "completed") return { error: "SESSION_NOT_COMPLETED" }

  const items = await db
    .select({
      questionId: trainingSessionItems.questionId,
      selectedAnswer: trainingSessionItems.selectedAnswer,
      isCorrect: trainingSessionItems.isCorrect,
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: objectiveLabelSql,
      domain: questions.domain,
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(trainingSessionItems)
    .innerJoin(questions, eq(questions.id, trainingSessionItems.questionId))
    .leftJoin(
      questionExplanations,
      eq(questionExplanations.questionId, trainingSessionItems.questionId),
    )
    .where(eq(trainingSessionItems.sessionId, sessionId))
    .orderBy(asc(trainingSessionItems.position))

  const questionIds = items.map((i) => i.questionId)
  // Session complétée → révélation : images d'énoncé ET d'explication. Le canal
  // explication reste séparé du pont d'énoncé `images` (anti-fuite en passation).
  const [imgMap, explImgMap, lock, bookmarkedIds] = await Promise.all([
    fetchImages(questionIds),
    fetchImages(questionIds, "explanation"),
    lockFor(viewerOf(session.user), questionIds),
    // Un admin qui relit la série d'un étudiant ne voit pas ses propres signets.
    s.userId === session.user.id ? getBookmarkedQuestionIds(questionIds) : [],
  ])

  const questionsView = items.map((i) =>
    toQuizQuestion(
      { ...i, explanationImages: explImgMap.get(i.questionId) },
      imgMap.get(i.questionId) ?? [],
      lock,
      "correction-with-images",
    ),
  )

  const answers: TrainingAnswerRecord = {}
  let scoreWithheld = false
  for (const i of items) {
    if (i.selectedAnswer !== null && i.selectedAnswer !== "") {
      const withheld = lock.has(i.questionId)
      scoreWithheld ||= withheld
      answers[i.questionId] = {
        selectedAnswer: i.selectedAnswer,
        // isCorrect + selectedAnswer révèle la clé → masqué si verrouillée.
        ...(withheld ? {} : { isCorrect: i.isCorrect ?? undefined }),
      }
    }
  }

  return {
    session: {
      id: s.id,
      // Le score compte les réponses différées : retenu avec elles (voir
      // `scoreWithheldFor`), jamais transmis au client.
      score: scoreWithheld ? null : (s.score ?? 0),
      questionCount: s.questionCount,
      mode: s.mode,
      startedAt: s.startedAt.getTime(),
      completedAt: s.completedAt?.getTime() ?? null,
      domain: s.domain,
    },
    questions: questionsView,
    answers,
    bookmarkedIds,
  }
}
