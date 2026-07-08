import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import {
  examAnswers,
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
  userAccess,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { cdnUrl } from "@/lib/cdn"
import { getCurrentSession } from "@/lib/dal"
import { hasAccess } from "../payments/dal"

// ============================================
// Images (forme « pont » partagée avec training)
// ============================================

export type ExamImageView = {
  url: string
  storagePath: string
  order: number
}

const groupImages = (
  rows: { questionId: string; storagePath: string; position: number }[],
): Map<string, ExamImageView[]> => {
  const map = new Map<string, ExamImageView[]>()
  for (const img of rows) {
    const list = map.get(img.questionId) ?? []
    list.push({
      url: cdnUrl(img.storagePath),
      storagePath: img.storagePath,
      order: img.position,
    })
    map.set(img.questionId, list)
  }
  return map
}

const fetchImages = async (
  questionIds: string[],
  kind: "statement" | "explanation" = "statement",
) => {
  if (questionIds.length === 0) return new Map<string, ExamImageView[]>()
  const rows = await db
    .select({
      questionId: questionImages.questionId,
      storagePath: questionImages.storagePath,
      position: questionImages.position,
    })
    .from(questionImages)
    .where(
      and(
        eq(questionImages.kind, kind),
        inArray(questionImages.questionId, questionIds),
      ),
    )
    .orderBy(asc(questionImages.position))
  return groupImages(rows)
}

// Forme « pont » alignée sur le doc Convex (`_id`/`_creationTime`/`images`) pour
// rester assignable au contrat `QuestionCardQuestion`/`Doc<"questions">` des
// composants quiz partagés. `correctAnswer`/`explanation`/`references` ne sont
// présents qu'en révision/admin — anti-triche en cours d'examen.
export type ExamQuestionView = {
  _id: string
  _creationTime: number
  question: string
  options: string[]
  objectifCMC: string
  domain: string
  images: ExamImageView[]
  correctAnswer?: string
  explanation?: string
  references?: string[]
}

// ============================================
// Liste examens + participation (étudiant)
// ============================================

export type ExamListItem = {
  id: string
  title: string
  description: string | null
  startDate: number
  endDate: number
  questionCount: number
  completionTime: number
  isActive: boolean
  enablePause: boolean
  pauseDurationMinutes: number | null
  // Type d'audience : un examen `restricted` présent dans cette liste implique que
  // l'utilisateur en est membre (filtre `audienceWhere`) → éligible à le démarrer
  // même sans abonnement (calcul d'éligibilité par-examen côté client).
  audienceType: "subscribers" | "restricted"
  userHasTaken: boolean
  userParticipation: { score: number; completedAt: number | null } | null
}

const countQuestionsByExam = async (
  examIds: string[],
): Promise<Map<string, number>> => {
  const map = new Map<string, number>()
  if (examIds.length === 0) return map
  const rows = await db
    .select({
      examId: examQuestions.examId,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(examQuestions)
    .where(inArray(examQuestions.examId, examIds))
    .groupBy(examQuestions.examId)
  for (const r of rows) map.set(r.examId, r.n)
  return map
}

/**
 * Tous les examens (récents d'abord) enrichis du statut de participation de
 * l'utilisateur courant. Remplace `getAllExamsWithUserParticipation`. La page
 * sépare actifs/à venir/passés selon les dates.
 */
export const getExamsWithParticipation = cache(
  async (): Promise<ExamListItem[]> => {
    const session = await getCurrentSession()
    const isAdmin = session?.user?.role === "admin"

    // Filtre d'audience : un admin voit tout (preview) ; sinon on inclut les
    // examens `subscribers` (ouverts) et — pour un utilisateur connecté — les
    // examens `restricted` dont il est membre (EXISTS corrélé, indexé sur
    // examAudience.userId). Non connecté → uniquement les `subscribers`.
    const audienceWhere = isAdmin
      ? undefined
      : or(
          eq(exams.audienceType, "subscribers"),
          session?.user
            ? exists(
                db
                  .select({ x: sql`1` })
                  .from(examAudience)
                  .where(
                    and(
                      eq(examAudience.examId, exams.id),
                      eq(examAudience.userId, session.user.id),
                    ),
                  ),
              )
            : sql`false`,
        )

    const rows = await db
      .select({
        id: exams.id,
        title: exams.title,
        description: exams.description,
        startDate: exams.startDate,
        endDate: exams.endDate,
        completionTime: exams.completionTime,
        isActive: exams.isActive,
        enablePause: exams.enablePause,
        pauseDurationMinutes: exams.pauseDurationMinutes,
        audienceType: exams.audienceType,
      })
      .from(exams)
      .where(audienceWhere)
      .orderBy(desc(exams.startDate))
      .limit(100)
    if (rows.length === 0) return []

    const examIds = rows.map((e) => e.id)
    const countMap = await countQuestionsByExam(examIds)

    const partMap = new Map<
      string,
      { score: number; status: string; completedAt: Date | null }
    >()
    if (session?.user) {
      const parts = await db
        .select({
          examId: examParticipations.examId,
          score: examParticipations.score,
          status: examParticipations.status,
          completedAt: examParticipations.completedAt,
        })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.userId, session.user.id),
            inArray(examParticipations.examId, examIds),
          ),
        )
      for (const p of parts) partMap.set(p.examId, p)
    }

    return rows.map((e) => {
      const p = partMap.get(e.id)
      const taken = p?.status === "completed" || p?.status === "auto_submitted"
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.startDate.getTime(),
        endDate: e.endDate.getTime(),
        questionCount: countMap.get(e.id) ?? 0,
        completionTime: e.completionTime,
        isActive: e.isActive,
        enablePause: e.enablePause,
        pauseDurationMinutes: e.pauseDurationMinutes,
        audienceType: e.audienceType,
        userHasTaken: taken,
        userParticipation: p
          ? { score: p.score, completedAt: p.completedAt?.getTime() ?? null }
          : null,
      }
    })
  },
)

// ============================================
// Examen + questions (passation / admin / détails)
// ============================================

export type ExamWithQuestions = {
  exam: {
    id: string
    title: string
    description: string | null
    startDate: number
    endDate: number
    completionTime: number
    isActive: boolean
    enablePause: boolean
    pauseDurationMinutes: number | null
    questionCount: number
    audienceType: "subscribers" | "restricted"
  }
  questions: ExamQuestionView[]
} | null

/**
 * Examen + questions ordonnées (forme « pont »). `correctAnswer` masqué pour les
 * non-admins (anti-triche pendant la passation), révélé pour les admins.
 * `explanation`/`references` jamais inclus ici (lazy-load séparé). Auth requise.
 */
export const getExamWithQuestions = async (
  examId: string,
): Promise<ExamWithQuestions> => {
  const session = await getCurrentSession()
  if (!session?.user) return null
  const isAdmin = session.user.role === "admin"

  const [exam] = await db
    .select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      startDate: exams.startDate,
      endDate: exams.endDate,
      completionTime: exams.completionTime,
      isActive: exams.isActive,
      enablePause: exams.enablePause,
      pauseDurationMinutes: exams.pauseDurationMinutes,
      audienceType: exams.audienceType,
    })
    .from(exams)
    .where(eq(exams.id, examId))
    .limit(1)
  if (!exam) return null

  // Garde d'audience (anti-fuite du TEXTE des questions d'un examen restreint
  // confidentiel) : un non-admin n'accède à un examen `restricted` que s'il est
  // membre de l'audience OU possède déjà une participation (n'importe quel
  // statut). La double condition couvre le membre AVANT démarrage et le membre
  // RETIRÉ de l'audience en cours de passation (#6) — il garde l'accès à ses
  // questions. Inchangé pour les admins et les examens `subscribers`.
  if (!isAdmin && exam.audienceType === "restricted") {
    const [allowed] = await db
      .select({ ok: sql<number>`1` })
      .from(examAudience)
      .where(
        and(
          eq(examAudience.examId, examId),
          eq(examAudience.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!allowed) {
      const [part] = await db
        .select({ id: examParticipations.id })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, session.user.id),
          ),
        )
        .limit(1)
      if (!part) return null
    }
  }

  const items = await db
    .select({
      questionId: examQuestions.questionId,
      qCreatedAt: questions.createdAt,
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: questions.objectifCmc,
      domain: questions.domain,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position))

  const imgMap = await fetchImages(items.map((i) => i.questionId))

  const questionsView: ExamQuestionView[] = items.map((i) => ({
    _id: i.questionId,
    _creationTime: i.qCreatedAt.getTime(),
    question: i.question,
    options: i.options,
    objectifCMC: i.objectifCMC,
    domain: i.domain,
    images: imgMap.get(i.questionId) ?? [],
    ...(isAdmin ? { correctAnswer: i.correctAnswer } : {}),
  }))

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      startDate: exam.startDate.getTime(),
      endDate: exam.endDate.getTime(),
      completionTime: exam.completionTime,
      isActive: exam.isActive,
      enablePause: exam.enablePause,
      pauseDurationMinutes: exam.pauseDurationMinutes,
      questionCount: items.length,
      audienceType: exam.audienceType,
    },
    questions: questionsView,
  }
}

// ============================================
// Session d'examen courante (passation)
// ============================================

export type ExamSessionView = {
  participationId: string
  status: "in_progress" | "completed" | "auto_submitted"
  startedAt: number | null
  completedAt: number | null
  score: number
  isPaused: boolean
  pauseStartedAt: number | null
  totalPauseDurationMs: number | null
} | null

/** Participation de l'utilisateur courant pour `examId` (ou `null`). */
export const getExamSession = cache(
  async (examId: string): Promise<ExamSessionView> => {
    const session = await getCurrentSession()
    if (!session?.user) return null

    const [p] = await db
      .select({
        id: examParticipations.id,
        status: examParticipations.status,
        startedAt: examParticipations.startedAt,
        completedAt: examParticipations.completedAt,
        score: examParticipations.score,
        pauseStartedAt: examParticipations.pauseStartedAt,
        totalPauseDurationMs: examParticipations.totalPauseDurationMs,
      })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!p) return null

    return {
      participationId: p.id,
      status: p.status,
      startedAt: p.startedAt?.getTime() ?? null,
      completedAt: p.completedAt?.getTime() ?? null,
      score: p.score,
      isPaused: p.pauseStartedAt != null,
      pauseStartedAt: p.pauseStartedAt?.getTime() ?? null,
      totalPauseDurationMs: p.totalPauseDurationMs,
    }
  },
)

// ============================================
// Réponses de passation (anti-triche : jamais isCorrect)
// ============================================

export type ExamAnswerForParticipation = {
  questionId: string
  selectedAnswer: string | null
  isFlagged: boolean
}

/**
 * Réponses enregistrées de la participation courante pour `examId`.
 * Anti-triche : ne sélectionne JAMAIS `isCorrect`.
 */
export const getExamAnswersForParticipation = cache(
  async (examId: string): Promise<ExamAnswerForParticipation[]> => {
    const session = await getCurrentSession()
    if (!session?.user) return []

    const [p] = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!p) return []

    return db
      .select({
        questionId: examAnswers.questionId,
        selectedAnswer: examAnswers.selectedAnswer,
        isFlagged: examAnswers.isFlagged,
        // NEVER select isCorrect (anti-cheat)
      })
      .from(examAnswers)
      .where(eq(examAnswers.participationId, p.id))
  },
)

// ============================================
// Résultats participant (étudiant après fin / admin)
// ============================================

export type ExamParticipantUser = {
  id: string
  name: string
  username: string | null
  email: string
  image: string | null
} | null

export type ExamResultsView =
  | {
      error: "NO_PARTICIPATION"
      message: string
      exam: ExamResultsExam
      participantUser: ExamParticipantUser
    }
  | {
      error: "NOT_COMPLETED"
      message: string
      status: "in_progress" | "completed" | "auto_submitted"
      exam: ExamResultsExam
      participantUser: ExamParticipantUser
    }
  | {
      exam: ExamResultsExam
      participant: {
        participationId: string
        userId: string
        score: number
        completedAt: number | null
        startedAt: number | null
        answers: {
          questionId: string
          selectedAnswer: string | null
          isCorrect: boolean | null
        }[]
      }
      participantUser: ExamParticipantUser
      questions: ExamQuestionView[]
    }
  | null

type ExamResultsExam = {
  id: string
  title: string
  description: string | null
  startDate: number
  endDate: number
  completionTime: number
}

/**
 * Résultats d'un participant. Admin : toujours. Non-admin : uniquement ses
 * propres résultats ET après `endDate`. Renvoie une union NO_PARTICIPATION /
 * NOT_COMPLETED (admin) / succès / `null`. Questions en forme « pont » avec
 * `correctAnswer` (explications lazy-loadées séparément). Remplace
 * `getParticipantExamResults`.
 */
export const getParticipantExamResults = async (
  examId: string,
  userId: string,
): Promise<ExamResultsView> => {
  const session = await getCurrentSession()
  if (!session?.user) return null

  const isAdmin = session.user.role === "admin"
  const isOwn = session.user.id === userId
  if (!isAdmin && !isOwn) return null

  const [exam] = await db
    .select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      startDate: exams.startDate,
      endDate: exams.endDate,
      completionTime: exams.completionTime,
    })
    .from(exams)
    .where(eq(exams.id, examId))
    .limit(1)
  if (!exam) return null

  // Non-admin : résultats visibles seulement après la fin de l'examen.
  if (!isAdmin && Date.now() < exam.endDate.getTime()) return null

  const examView: ExamResultsExam = {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    startDate: exam.startDate.getTime(),
    endDate: exam.endDate.getTime(),
    completionTime: exam.completionTime,
  }

  const [pUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const participantUser: ExamParticipantUser = pUser
    ? {
        id: pUser.id,
        name: pUser.name,
        username: null,
        email: pUser.email,
        image: pUser.image ?? null,
      }
    : null

  const [p] = await db
    .select({
      id: examParticipations.id,
      userId: examParticipations.userId,
      status: examParticipations.status,
      score: examParticipations.score,
      startedAt: examParticipations.startedAt,
      completedAt: examParticipations.completedAt,
    })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, userId),
      ),
    )
    .limit(1)

  if (!p) {
    if (isAdmin) {
      return {
        error: "NO_PARTICIPATION",
        message: participantUser
          ? "Ce participant n'a pas encore commencé cet examen"
          : "Utilisateur introuvable",
        exam: examView,
        participantUser,
      }
    }
    return null
  }

  if (p.status !== "completed" && p.status !== "auto_submitted") {
    if (isAdmin) {
      return {
        error: "NOT_COMPLETED",
        message: "Ce participant n'a pas encore terminé l'examen",
        status: p.status,
        exam: examView,
        participantUser,
      }
    }
    return null
  }

  const items = await db
    .select({
      questionId: examQuestions.questionId,
      qCreatedAt: questions.createdAt,
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: questions.objectifCmc,
      domain: questions.domain,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position))

  const resultQuestionIds = items.map((i) => i.questionId)
  // Questions figurant AUSSI dans un examen encore ouvert où le lecteur
  // participe : correction différée jusqu'à la clôture (clé de réponse).
  const [imgMap, lockedIds] = await Promise.all([
    fetchImages(resultQuestionIds),
    isAdmin
      ? new Set<string>()
      : getOpenExamLockedQuestionIds(session.user.id, resultQuestionIds),
  ])

  const questionsView: ExamQuestionView[] = items.map((i) => ({
    _id: i.questionId,
    _creationTime: i.qCreatedAt.getTime(),
    question: i.question,
    options: i.options,
    objectifCMC: i.objectifCMC,
    domain: i.domain,
    images: imgMap.get(i.questionId) ?? [],
    ...(lockedIds.has(i.questionId) ? {} : { correctAnswer: i.correctAnswer }),
  }))

  const answerRows = await db
    .select({
      questionId: examAnswers.questionId,
      selectedAnswer: examAnswers.selectedAnswer,
      isCorrect: examAnswers.isCorrect,
    })
    .from(examAnswers)
    .where(eq(examAnswers.participationId, p.id))
    .limit(500)

  return {
    exam: examView,
    participant: {
      participationId: p.id,
      userId: p.userId,
      score: p.score,
      completedAt: p.completedAt?.getTime() ?? null,
      startedAt: p.startedAt?.getTime() ?? null,
      answers: answerRows.map((a) => ({
        questionId: a.questionId,
        selectedAnswer: a.selectedAnswer ?? null,
        // isCorrect + selectedAnswer révèle la clé → masqué si verrouillée.
        isCorrect: lockedIds.has(a.questionId) ? null : (a.isCorrect ?? null),
      })),
    },
    participantUser,
    questions: questionsView,
  }
}

// ============================================
// Explications lazy (révision résultats)
// ============================================

export type QuestionExplanationView = {
  questionId: string
  explanation: string
  references?: string[]
  explanationImages: { url: string; storagePath: string; order: number }[] // [F3 le peuplera ; vide tant que F3 absente]
}

/**
 * Parmi `questionIds`, celles appartenant à un examen OUVERT (`endDate` future)
 * où `userId` a une participation (tout statut). La banque de questions étant
 * partagée training/examens, la clé de réponse de ces questions ne doit fuiter
 * par AUCUN canal de révision pendant la fenêtre d'examen (explications lazy,
 * correction d'entraînement). Compromis assumé : la révision training de ces
 * questions est différée jusqu'à la clôture de l'examen.
 */
export const getOpenExamLockedQuestionIds = async (
  userId: string,
  questionIds: string[],
): Promise<Set<string>> => {
  if (questionIds.length === 0) return new Set()
  const rows = await db
    .selectDistinct({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .innerJoin(
      examParticipations,
      eq(examParticipations.examId, examQuestions.examId),
    )
    .where(
      and(
        eq(examParticipations.userId, userId),
        gt(exams.endDate, new Date()),
        inArray(examQuestions.questionId, questionIds),
      ),
    )
  return new Set(rows.map((r) => r.questionId))
}

/**
 * Explications à la demande (déplier une question dans les résultats). Sécurité :
 * admin (bypass) OU l'utilisateur a une session de training COMPLÉTÉE contenant
 * la question, OU une participation COMPLÉTÉE à un examen **CLOS** (`endDate`
 * passée) contenant la question. Les IDs non autorisés sont silencieusement
 * absents. Remplace `exams.getQuestionExplanations`.
 *
 * Anti-triche : la garde `endDate` sur la branche examen empêche un candidat qui
 * termine tôt de tirer explications + références + images (= les bonnes réponses)
 * AVANT l'ouverture des résultats et de les partager pendant la fenêtre d'examen.
 * Parité avec `getParticipantExamResults` (résultats visibles après `endDate`).
 * Les DEUX branches sont ensuite filtrées par `getOpenExamLockedQuestionIds`
 * (banque partagée : ni le training ni un examen clos ne doivent révéler une
 * question d'un examen encore ouvert).
 */
export const getExamQuestionExplanations = async (
  questionIds: string[],
): Promise<QuestionExplanationView[]> => {
  if (questionIds.length === 0) return []
  const session = await getCurrentSession()
  if (!session?.user) return []

  const requested = [...new Set(questionIds)]
  let authorized: string[]

  if (session.user.role === "admin") {
    authorized = requested
  } else {
    const uid = session.user.id
    const nowDate = new Date()
    const [viaExam, viaTraining, locked] = await Promise.all([
      db
        .selectDistinct({ questionId: examQuestions.questionId })
        .from(examQuestions)
        .innerJoin(
          examParticipations,
          eq(examParticipations.examId, examQuestions.examId),
        )
        .innerJoin(exams, eq(exams.id, examQuestions.examId))
        .where(
          and(
            eq(examParticipations.userId, uid),
            inArray(examParticipations.status, ["completed", "auto_submitted"]),
            // Examen CLOS uniquement : pas de révélation avant l'ouverture des
            // résultats (anti-fuite pendant la fenêtre d'examen).
            lte(exams.endDate, nowDate),
            inArray(examQuestions.questionId, requested),
          ),
        ),
      db
        .selectDistinct({ questionId: trainingSessionItems.questionId })
        .from(trainingSessionItems)
        .innerJoin(
          trainingSessions,
          eq(trainingSessions.id, trainingSessionItems.sessionId),
        )
        .where(
          and(
            eq(trainingSessions.userId, uid),
            eq(trainingSessions.status, "completed"),
            inArray(trainingSessionItems.questionId, requested),
          ),
        ),
      getOpenExamLockedQuestionIds(uid, requested),
    ])
    // Les DEUX branches sont filtrées : un examen clos complété ne doit pas
    // révéler une question qui figure aussi dans un examen encore ouvert.
    authorized = [
      ...new Set([
        ...viaExam.map((r) => r.questionId),
        ...viaTraining.map((r) => r.questionId),
      ]),
    ].filter((id) => !locked.has(id))
  }

  if (authorized.length === 0) return []

  const rows = await db
    .select({
      questionId: questionExplanations.questionId,
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(questionExplanations)
    .where(inArray(questionExplanations.questionId, authorized))

  // Images d'explication (`kind='explanation'`) sur le canal de révélation —
  // jamais sur le pont d'énoncé. Lecture scopée via le même `fetchImages`.
  const explImgMap = await fetchImages(authorized, "explanation")

  return rows.map((r) => ({
    questionId: r.questionId,
    explanation: r.explanation,
    references: r.references ?? undefined,
    explanationImages: explImgMap.get(r.questionId) ?? [],
  }))
}

// ============================================
// Confirmation post-soumission (C2)
// ============================================

export type ExamSubmissionSummary = {
  examTitle: string
  answeredCount: number
  flaggedCount: number
  endDate: number
  status: "completed" | "auto_submitted"
} | null

/**
 * Résumé post-soumission pour l'écran de confirmation `/soumis`.
 * Renvoie `null` si l'utilisateur n'a pas de participation complétée/auto-soumise.
 * Guarded : session courante uniquement (pas admin bypass — écran étudiant).
 */
export const getExamSubmissionSummary = cache(
  async (examId: string): Promise<ExamSubmissionSummary> => {
    const session = await getCurrentSession()
    if (!session?.user) return null

    const userId = session.user.id

    const [row] = await db
      .select({
        title: exams.title,
        endDate: exams.endDate,
        participationId: examParticipations.id,
        status: examParticipations.status,
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, userId),
          inArray(examParticipations.status, ["completed", "auto_submitted"]),
        ),
      )
      .limit(1)

    if (!row) return null

    // Count answered and flagged questions for this participation
    const [counts] = await db
      .select({
        answeredCount:
          sql<number>`count(*) filter (where ${examAnswers.selectedAnswer} is not null)`.mapWith(
            Number,
          ),
        flaggedCount:
          sql<number>`count(*) filter (where ${examAnswers.isFlagged})`.mapWith(
            Number,
          ),
      })
      .from(examAnswers)
      .where(eq(examAnswers.participationId, row.participationId))

    return {
      examTitle: row.title,
      answeredCount: counts?.answeredCount ?? 0,
      flaggedCount: counts?.flaggedCount ?? 0,
      endDate: row.endDate.getTime(),
      status: row.status as "completed" | "auto_submitted",
    }
  },
)

// ============================================
// Admin : liste examens + comptes
// ============================================

export type AdminExamListItem = {
  id: string
  title: string
  description: string | null
  startDate: number
  endDate: number
  questionCount: number
  completionTime: number
  isActive: boolean
  enablePause: boolean
  pauseDurationMinutes: number | null
  participantCount: number
  createdAt: number
}

/** [Admin] Tous les examens + nombre de participants. Remplace `getAllExams`. */
export const getAllExamsAdmin = cache(
  async (): Promise<AdminExamListItem[]> => {
    await requireRole(["admin"])

    const rows = await db
      .select({
        id: exams.id,
        title: exams.title,
        description: exams.description,
        startDate: exams.startDate,
        endDate: exams.endDate,
        completionTime: exams.completionTime,
        isActive: exams.isActive,
        enablePause: exams.enablePause,
        pauseDurationMinutes: exams.pauseDurationMinutes,
        createdAt: exams.createdAt,
      })
      .from(exams)
      .orderBy(desc(exams.createdAt))
      .limit(100)
    if (rows.length === 0) return []

    const examIds = rows.map((e) => e.id)
    const countMap = await countQuestionsByExam(examIds)

    const partRows = await db
      .select({
        examId: examParticipations.examId,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(examParticipations)
      .where(inArray(examParticipations.examId, examIds))
      .groupBy(examParticipations.examId)
    const partMap = new Map(partRows.map((r) => [r.examId, r.n]))

    return rows.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startDate: e.startDate.getTime(),
      endDate: e.endDate.getTime(),
      questionCount: countMap.get(e.id) ?? 0,
      completionTime: e.completionTime,
      isActive: e.isActive,
      enablePause: e.enablePause,
      pauseDurationMinutes: e.pauseDurationMinutes,
      participantCount: partMap.get(e.id) ?? 0,
      createdAt: e.createdAt.getTime(),
    }))
  },
)

export type ExamPickerOption = {
  id: string
  title: string
  /** Epoch ms. */
  startDate: number
}

/**
 * [Admin] Examens pour le combobox de filtre « utilisée dans l'examen… » du
 * QuestionBrowser. Colonnes minimales, du plus récent au plus ancien, borné.
 */
export const getExamsForPicker = async (): Promise<ExamPickerOption[]> => {
  await requireRole(["admin"])
  const rows = await db
    .select({ id: exams.id, title: exams.title, startDate: exams.startDate })
    .from(exams)
    .orderBy(desc(exams.startDate))
    .limit(500)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate.getTime(),
  }))
}

// ============================================
// Admin : statistiques examens
// ============================================

export type ExamsStats = {
  total: number
  active: number
  upcoming: number
  past: number
  inactive: number
  eligibleCandidates: number
}

/** [Admin] Compteurs par statut + candidats éligibles. Remplace `getExamsStats`. */
export const getExamsStats = cache(async (): Promise<ExamsStats> => {
  await requireRole(["admin"])
  const now = new Date()

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      inactive:
        sql<number>`count(*) filter (where not ${exams.isActive})`.mapWith(
          Number,
        ),
      active:
        sql<number>`count(*) filter (where ${exams.isActive} and ${exams.startDate} <= ${now} and ${exams.endDate} >= ${now})`.mapWith(
          Number,
        ),
      upcoming:
        sql<number>`count(*) filter (where ${exams.isActive} and ${exams.startDate} > ${now})`.mapWith(
          Number,
        ),
      past: sql<number>`count(*) filter (where ${exams.endDate} < ${now})`.mapWith(
        Number,
      ),
    })
    .from(exams)

  const [elig] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(userAccess)
    .where(
      and(eq(userAccess.accessType, "exam"), gt(userAccess.expiresAt, now)),
    )

  return {
    total: counts?.total ?? 0,
    active: counts?.active ?? 0,
    upcoming: counts?.upcoming ?? 0,
    past: counts?.past ?? 0,
    inactive: counts?.inactive ?? 0,
    eligibleCandidates: elig?.n ?? 0,
  }
})

/** [Admin] Nombre d'utilisateurs avec un accès examen actif (panneau latéral). */
export const getActiveExamAccessCount = cache(async (): Promise<number> => {
  await requireRole(["admin"])
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.accessType, "exam"),
        gt(userAccess.expiresAt, new Date()),
      ),
    )
  return row?.n ?? 0
})

export type EligibleCandidate = {
  user: {
    id: string
    name: string
    email: string
    image: string | null
    username: string | null
  }
  expiresAt: number
  daysRemaining: number
}

/**
 * [Admin] Utilisateurs avec un accès examen actif (candidats éligibles, page
 * détails). Remplace `users.getUsersWithActiveExamAccess`.
 */
export const getEligibleExamCandidates = cache(
  async (): Promise<EligibleCandidate[]> => {
    await requireRole(["admin"])
    const now = Date.now()
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        expiresAt: userAccess.expiresAt,
      })
      .from(userAccess)
      .innerJoin(user, eq(user.id, userAccess.userId))
      .where(
        and(
          eq(userAccess.accessType, "exam"),
          gt(userAccess.expiresAt, new Date(now)),
        ),
      )
      .orderBy(asc(userAccess.expiresAt))
      .limit(100)

    return rows.map((r) => ({
      user: {
        id: r.id,
        name: r.name,
        email: r.email,
        image: r.image ?? null,
        username: null,
      },
      expiresAt: r.expiresAt.getTime(),
      daysRemaining: Math.max(
        0,
        Math.ceil((r.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)),
      ),
    }))
  },
)

export type ExamAudienceUser = { id: string; name: string; email: string }

/**
 * [Admin] Utilisateurs composant l'audience restreinte d'un examen (page détail /
 * pré-remplissage du picker en édition). Triés par nom, bornés. Garde admin.
 */
export const getExamAudience = cache(
  async (examId: string): Promise<ExamAudienceUser[]> => {
    await requireRole(["admin"])
    return db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(examAudience)
      .innerJoin(user, eq(user.id, examAudience.userId))
      .where(eq(examAudience.examId, examId))
      .orderBy(asc(user.name))
      .limit(1000)
  },
)

// ============================================
// Leaderboard
// ============================================

export type LeaderboardEntry = {
  participationId: string
  user: {
    id: string
    name: string
    username: string | null
    image: string | null
  } | null
  score: number
  completedAt: number | null
}

/**
 * Classement (participations complétées, score décroissant). Admin : toujours.
 * Non-admin : uniquement après `endDate` ET (a participé OU a un accès examen
 * actif). Sinon `[]`. Remplace `examStats.getExamLeaderboard`.
 */
export const getExamLeaderboard = async (
  examId: string,
): Promise<LeaderboardEntry[]> => {
  const session = await getCurrentSession()

  const [exam] = await db
    .select({ endDate: exams.endDate, audienceType: exams.audienceType })
    .from(exams)
    .where(eq(exams.id, examId))
    .limit(1)
  if (!exam) return []

  const isAdmin = session?.user?.role === "admin"
  if (!isAdmin) {
    if (!session?.user) return []
    if (Date.now() < exam.endDate.getTime()) return []

    if (exam.audienceType === "restricted") {
      // Examen restreint : seul un membre de l'audience voit le classement
      // (confidentiel) — l'abonnement ou une participation ne suffisent pas.
      const [member] = await db
        .select({ userId: examAudience.userId })
        .from(examAudience)
        .where(
          and(
            eq(examAudience.examId, examId),
            eq(examAudience.userId, session.user.id),
          ),
        )
        .limit(1)
      if (!member) return []
    } else {
      const [part] = await db
        .select({ id: examParticipations.id })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, session.user.id),
          ),
        )
        .limit(1)
      if (!part && !(await hasAccess("exam", session.user.id))) return []
    }
  }

  const rows = await db
    .select({
      participationId: examParticipations.id,
      score: examParticipations.score,
      completedAt: examParticipations.completedAt,
      userId: user.id,
      name: user.name,
      image: user.image,
    })
    .from(examParticipations)
    .innerJoin(user, eq(user.id, examParticipations.userId))
    .where(
      and(
        eq(examParticipations.examId, examId),
        inArray(examParticipations.status, ["completed", "auto_submitted"]),
      ),
    )
    .orderBy(
      desc(examParticipations.score),
      asc(examParticipations.completedAt),
    )
    .limit(500)

  return rows.map((r) => ({
    participationId: r.participationId,
    user: {
      id: r.userId,
      name: r.name,
      username: null,
      image: r.image ?? null,
    },
    score: r.score,
    completedAt: r.completedAt?.getTime() ?? null,
  }))
}

// ============================================
// Dashboard étudiant (5.6b)
// ============================================

export type MyDashboardStats = {
  availableExamsCount: number
  completedExamsCount: number
  averageScore: number
}

/**
 * Stats résumé du dashboard étudiant. `availableExamsCount` = nombre d'examens
 * actifs (sans filtre de fenêtre, parité Convex) si l'utilisateur a un accès
 * examen actif, sinon 0 — `hasAccess(uid)` interroge l'entitlement réel (pas de
 * bypass admin, comme l'original). Moyenne sur les participations complétées.
 * `null` si non connecté. Remplace `examStats.getMyDashboardStats`.
 */
// Prédicat d'audience pour les lectures « mes examens » du dashboard : inclut
// les examens ouverts (`subscribers`) et les examens restreints dont `uid` est
// membre (EXISTS corrélé, indexé sur examAudience.userId). Masque les examens
// restreints confidentiels aux non-membres, même abonnés (D3). Parité avec le
// filtre de `getExamsWithParticipation`.
const memberAudienceWhere = (uid: string) =>
  or(
    eq(exams.audienceType, "subscribers"),
    exists(
      db
        .select({ x: sql`1` })
        .from(examAudience)
        .where(
          and(eq(examAudience.examId, exams.id), eq(examAudience.userId, uid)),
        ),
    ),
  )

export const getMyDashboardStats = cache(
  async (): Promise<MyDashboardStats | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    const uid = session.user.id

    const hasExamAccess = await hasAccess("exam", uid)

    const [agg] = await db
      .select({
        completed:
          sql<number>`count(*) filter (where ${examParticipations.status} in ('completed','auto_submitted'))`.mapWith(
            Number,
          ),
        averageScore:
          sql<number>`coalesce(round(avg(${examParticipations.score}) filter (where ${examParticipations.status} in ('completed','auto_submitted'))), 0)`.mapWith(
            Number,
          ),
      })
      .from(examParticipations)
      .where(eq(examParticipations.userId, uid))

    let availableExamsCount = 0
    if (hasExamAccess) {
      const [c] = await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(exams)
        .where(and(eq(exams.isActive, true), memberAudienceWhere(uid)))
      availableExamsCount = c?.n ?? 0
    }

    return {
      availableExamsCount,
      completedExamsCount: agg?.completed ?? 0,
      averageScore: agg?.averageScore ?? 0,
    }
  },
)

export type MyRecentExam = {
  id: string
  title: string
  startDate: number
  endDate: number
  isCompleted: boolean
  score: number | null
  completedAt: number | null
}

/**
 * Examens actifs de l'utilisateur (accès examen requis), enrichis du statut de
 * participation, complétés d'abord (par date desc), 5 max. Remplace
 * `examStats.getMyRecentExams`. `[]` sans accès / non connecté.
 */
export const getMyRecentExams = cache(async (): Promise<MyRecentExam[]> => {
  const session = await getCurrentSession()
  if (!session?.user) return []
  const uid = session.user.id

  if (!(await hasAccess("exam", uid))) return []

  const activeExams = await db
    .select({
      id: exams.id,
      title: exams.title,
      startDate: exams.startDate,
      endDate: exams.endDate,
    })
    .from(exams)
    .where(and(eq(exams.isActive, true), memberAudienceWhere(uid)))
    // Ordre stable : rend déterministe le sous-ensemble retenu au-delà de 200.
    .orderBy(desc(exams.startDate))
    .limit(200)
  if (activeExams.length === 0) return []

  const examIds = activeExams.map((e) => e.id)
  const parts = await db
    .select({
      examId: examParticipations.examId,
      status: examParticipations.status,
      score: examParticipations.score,
      completedAt: examParticipations.completedAt,
    })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.userId, uid),
        inArray(examParticipations.examId, examIds),
      ),
    )
  const partMap = new Map(parts.map((p) => [p.examId, p]))

  return activeExams
    .map((e) => {
      const p = partMap.get(e.id)
      const isCompleted =
        p?.status === "completed" || p?.status === "auto_submitted"
      return {
        id: e.id,
        title: e.title,
        startDate: e.startDate.getTime(),
        endDate: e.endDate.getTime(),
        isCompleted,
        score: isCompleted ? (p?.score ?? null) : null,
        completedAt: p?.completedAt?.getTime() ?? null,
      }
    })
    .sort((a, b) => {
      if (a.completedAt && b.completedAt) return b.completedAt - a.completedAt
      if (a.completedAt && !b.completedAt) return -1
      if (!a.completedAt && b.completedAt) return 1
      return b.startDate - a.startDate
    })
    .slice(0, 5)
})

export type MyScoreHistoryItem = {
  examId: string
  examTitle: string
  score: number
  completedAt: number
}

/**
 * 10 derniers examens complétés (ordre chronologique ASC pour le graphique).
 * Lecture DESC + `reverse()`. Remplace `examStats.getMyScoreHistory`.
 */
export const getMyScoreHistory = cache(
  async (): Promise<MyScoreHistoryItem[]> => {
    const session = await getCurrentSession()
    if (!session?.user) return []
    const uid = session.user.id

    const rows = await db
      .select({
        examId: examParticipations.examId,
        examTitle: exams.title,
        score: examParticipations.score,
        completedAt: examParticipations.completedAt,
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(
        and(
          eq(examParticipations.userId, uid),
          inArray(examParticipations.status, ["completed", "auto_submitted"]),
          isNotNull(examParticipations.completedAt),
        ),
      )
      .orderBy(desc(examParticipations.completedAt))
      .limit(10)

    return rows.reverse().map((r) => ({
      examId: r.examId,
      examTitle: r.examTitle,
      score: r.score,
      completedAt: r.completedAt?.getTime() ?? 0,
    }))
  },
)

export type MyAvailableExam = { id: string; title: string }

/**
 * Examens actifs DANS la fenêtre de dates. Admin : tous ; user : seulement avec
 * accès examen actif. Sert au panneau « prochaines actions » (compte). Remplace
 * `exams.getMyAvailableExams`. `[]` sans accès / non connecté.
 */
export const getMyAvailableExams = cache(
  async (): Promise<MyAvailableExam[]> => {
    const session = await getCurrentSession()
    if (!session?.user) return []
    const isAdmin = session.user.role === "admin"

    if (!isAdmin && !(await hasAccess("exam", session.user.id))) return []

    const now = new Date()
    return db
      .select({ id: exams.id, title: exams.title })
      .from(exams)
      .where(
        and(
          eq(exams.isActive, true),
          lte(exams.startDate, now),
          gte(exams.endDate, now),
          // Admin : preview de tout (D3). Sinon : ouverts + restreints dont
          // l'utilisateur est membre — masque les restreints aux non-membres.
          isAdmin ? undefined : memberAudienceWhere(session.user.id),
        ),
      )
      .limit(100)
  },
)
