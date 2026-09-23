import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm"
import { cache } from "react"
import "server-only"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { db } from "@/db"
import {
  questionBookmarks,
  questionExplanations,
  questions,
  trainingSessionItems,
  trainingSessions,
} from "@/db/schema"
import { requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import {
  type LockUser,
  lockFor,
  scoreWithheldFor,
  viewerOf,
} from "../questions/answer-key-lock"
import { fetchImages, toQuizQuestion } from "../questions/quiz-bridge"

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(lo, Math.floor(n)), hi)

// Curseur keyset historique = base64("<completedAtISO>|<id>").
const encodeCursor = (completedAt: Date, id: string): string =>
  Buffer.from(`${completedAt.toISOString()}|${id}`, "utf8").toString("base64")

const decodeCursor = (
  cursor: string,
): { completedAt: Date; id: string } | null => {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8")
    const sep = decoded.indexOf("|")
    if (sep === -1) return null
    const completedAt = new Date(decoded.slice(0, sep))
    const id = decoded.slice(sep + 1)
    if (!id || Number.isNaN(completedAt.getTime())) return null
    return { completedAt, id }
  } catch {
    return null
  }
}

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

/** `mapWith(Number)` ferait de `null` un `0` — faux « 0 % » quand rien n'est lisible. */
const nullableNumber = (v: unknown) => (v === null ? null : Number(v))

/** Filtre d'agrégat : seules les sessions dont le score est lisible. */
const scoreReadable = (viewer: LockUser) =>
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
// Historique (keyset)
// ============================================

export type TrainingHistoryItem = {
  id: string
  questionCount: number
  /** `null` = score retenu (une réponse en correction différée). */
  score: number | null
  domain: string | null
  completedAt: number | null
  startedAt: number
}

export type TrainingHistoryPage = {
  items: TrainingHistoryItem[]
  nextCursor: string | null
}

/**
 * Historique des sessions **complétées** (keyset sur `(completedAt, id)` desc).
 * `null`/vide si non connecté.
 */
export const getTrainingHistory = async ({
  cursor,
  limit = 5,
}: {
  cursor?: string | null
  limit?: number
} = {}): Promise<TrainingHistoryPage> => {
  const session = await getCurrentSession()
  if (!session?.user) return { items: [], nextCursor: null }
  const viewer = viewerOf(session.user)

  const safeLimit = clamp(limit, 1, 50)
  const decoded = cursor ? decodeCursor(cursor) : null
  const afterCursor = decoded
    ? or(
        lt(trainingSessions.completedAt, decoded.completedAt),
        and(
          eq(trainingSessions.completedAt, decoded.completedAt),
          lt(trainingSessions.id, decoded.id),
        ),
      )
    : undefined

  const rows = await db
    .select({
      id: trainingSessions.id,
      questionCount: trainingSessions.questionCount,
      score: readableScore(viewer),
      domain: trainingSessions.domain,
      completedAt: trainingSessions.completedAt,
      startedAt: trainingSessions.startedAt,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, session.user.id),
        eq(trainingSessions.status, "completed"),
        afterCursor,
      ),
    )
    .orderBy(desc(trainingSessions.completedAt), desc(trainingSessions.id))
    .limit(safeLimit + 1)

  const hasMore = rows.length > safeLimit
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows

  const items: TrainingHistoryItem[] = pageRows.map((r) => ({
    id: r.id,
    questionCount: r.questionCount,
    score: r.score,
    domain: r.domain,
    completedAt: r.completedAt?.getTime() ?? null,
    startedAt: r.startedAt.getTime(),
  }))

  const last = pageRows.at(-1)
  const nextCursor =
    hasMore && last?.completedAt
      ? encodeCursor(last.completedAt, last.id)
      : null

  return { items, nextCursor }
}

// ============================================
// Stats résumé (page entraînement)
// ============================================

export type TrainingStats = {
  totalSessions: number
  totalQuestions: number
  /** `null` = aucun score lisible (rien de complété, ou tout retenu). */
  averageScore: number | null
} | null

/** Stats de l'utilisateur (sessions complétées). `null` si non connecté. */
export const getTrainingStats = cache(async (): Promise<TrainingStats> => {
  const session = await getCurrentSession()
  if (!session?.user) return null
  const viewer = viewerOf(session.user)

  const [row] = await db
    .select({
      totalSessions: sql<number>`count(*)`.mapWith(Number),
      totalQuestions:
        sql<number>`coalesce(sum(${trainingSessions.questionCount}), 0)`.mapWith(
          Number,
        ),
      // Une session au score retenu n'entre pas dans la moyenne : avant/après
      // la restituerait.
      averageScore: sql<
        number | null
      >`round(avg(${trainingSessions.score}) filter (where ${scoreReadable(viewer)}))`.mapWith(
        nullableNumber,
      ),
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, session.user.id),
        eq(trainingSessions.status, "completed"),
      ),
    )

  return {
    totalSessions: row?.totalSessions ?? 0,
    totalQuestions: row?.totalQuestions ?? 0,
    averageScore: row?.averageScore ?? null,
  }
})

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
// Historique de score (graphique dashboard)
// ============================================

export type TrainingScoreHistory = {
  sessions: {
    sessionId: string
    /** `null` = score retenu (une réponse en correction différée). */
    score: number | null
    completedAt: number
    questionCount: number
    domain: string
  }[]
}

/**
 * Historique de score d'entraînement pour le dashboard : 10 dernières sessions
 * complétées (ordre chronologique ASC). `domain` null → « Tous domaines ».
 * Vide si non connecté.
 */
export const getMyTrainingScoreHistory = cache(
  async (): Promise<TrainingScoreHistory> => {
    const session = await getCurrentSession()
    if (!session?.user) return { sessions: [] }
    const uid = session.user.id
    const viewer = viewerOf(session.user)

    const completedWhere = and(
      eq(trainingSessions.userId, uid),
      eq(trainingSessions.status, "completed"),
    )

    // 10 dernières complétées : lecture DESC + reverse → ASC chronologique.
    const recent = await db
      .select({
        id: trainingSessions.id,
        score: readableScore(viewer),
        completedAt: trainingSessions.completedAt,
        questionCount: trainingSessions.questionCount,
        domain: trainingSessions.domain,
      })
      .from(trainingSessions)
      .where(and(completedWhere, isNotNull(trainingSessions.completedAt)))
      .orderBy(desc(trainingSessions.completedAt))
      .limit(10)

    const sessions = recent.reverse().map((s) => ({
      sessionId: s.id,
      score: s.score,
      completedAt: s.completedAt?.getTime() ?? 0,
      questionCount: s.questionCount,
      domain: s.domain ?? "Tous domaines",
    }))

    return { sessions }
  },
)

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
  objectifs: { objectif: string; count: number }[]
  total: number
}

/**
 * Objectifs CMC + comptage (multi-select), optionnellement filtrés par domaine.
 * Remplace `getAvailableObjectifsCMC` (qui lisait la table d'agrégation).
 */
export const getAvailableObjectifsCMC = cache(
  async (domain?: string): Promise<ObjectifsView> => {
    await requireSession()
    const where = and(
      isNull(questions.deletedAt),
      domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
    )
    const rows = await db
      .select({
        objectif: questions.objectifCmc,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(questions)
      .where(where)
      .groupBy(questions.objectifCmc)

    const objectifs = rows
      .filter((r) => r.count > 0)
      .map((r) => ({ objectif: r.objectif, count: r.count }))
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
      objectifCMC: questions.objectifCmc,
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
        startedAt: number
        completedAt: number | null
        domain: string | null
      }
      questions: QuizQuestion[]
      answers: TrainingAnswerRecord
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
      objectifCMC: questions.objectifCmc,
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
  const [imgMap, explImgMap, lock] = await Promise.all([
    fetchImages(questionIds),
    fetchImages(questionIds, "explanation"),
    lockFor(viewerOf(session.user), questionIds),
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
      startedAt: s.startedAt.getTime(),
      completedAt: s.completedAt?.getTime() ?? null,
      domain: s.domain,
    },
    questions: questionsView,
    answers,
  }
}
