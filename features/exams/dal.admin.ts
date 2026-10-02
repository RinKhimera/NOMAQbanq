import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm"
import { cache } from "react"
import "server-only"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { db } from "@/db"
import {
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
  userAccess,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { AnswerKeyLock } from "../questions/answer-key-lock"
import { fetchImages, toQuizQuestion } from "../questions/quiz-bridge"
import { countQuestionsByExam, finalizedDate } from "./dal.shared"

// ============================================
// Admin : liste examens + comptes
// ============================================

export type AdminExamListItem = {
  id: string
  title: string
  description: string | null
  /** Dates et durée : `null` possible tant que l'examen est en préparation. */
  startDate: number | null
  endDate: number | null
  questionCount: number
  targetQuestionCount: number
  completionTime: number | null
  /** `null` = examen en préparation. */
  finalizedAt: number | null
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
        targetQuestionCount: exams.targetQuestionCount,
        finalizedAt: exams.finalizedAt,
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
      startDate: e.startDate?.getTime() ?? null,
      endDate: e.endDate?.getTime() ?? null,
      questionCount: countMap.get(e.id) ?? 0,
      targetQuestionCount: e.targetQuestionCount,
      completionTime: e.completionTime,
      finalizedAt: e.finalizedAt?.getTime() ?? null,
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
  /** Epoch ms ; `null` pour un examen en préparation sans dates. */
  startDate: number | null
  endDate: number | null
  /** Epoch ms ; `null` = examen en préparation. */
  finalizedAt: number | null
  isActive: boolean
}

/**
 * [Admin] Examens pour le filtre « examen précis » des questions. Colonnes
 * minimales, du plus récent au plus ancien, borné.
 */
export const getExamsForPicker = async (): Promise<ExamPickerOption[]> => {
  await requireRole(["admin"])
  const rows = await db
    .select({
      id: exams.id,
      title: exams.title,
      startDate: exams.startDate,
      endDate: exams.endDate,
      finalizedAt: exams.finalizedAt,
      isActive: exams.isActive,
    })
    .from(exams)
    .orderBy(desc(exams.startDate))
    .limit(500)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate?.getTime() ?? null,
    endDate: r.endDate?.getTime() ?? null,
    finalizedAt: r.finalizedAt?.getTime() ?? null,
    isActive: r.isActive,
  }))
}

export type AdminExam = {
  exam: {
    id: string
    title: string
    description: string | null
    /** Dates et durée : `null` possible tant que l'examen est en préparation. */
    startDate: number | null
    endDate: number | null
    completionTime: number | null
    /** `null` = examen en préparation. */
    finalizedAt: number | null
    targetQuestionCount: number
    isActive: boolean
    enablePause: boolean
    pauseDurationMinutes: number | null
    questionCount: number
    audienceType: "subscribers" | "restricted"
  }
  /** Avec la clé de réponse : un admin n'est jamais sous le verrou. */
  questions: QuizQuestion[]
}

/**
 * [Admin] Un examen dans toutes ses phases, préparation comprise, avec ses
 * questions dans leur ordre (fiche et formulaire admin). La lecture étudiante
 * `getExamWithQuestions` ignore les examens en préparation.
 */
export const getAdminExam = cache(
  async (examId: string): Promise<AdminExam | null> => {
    await requireRole(["admin"])
    const [exam] = await db
      .select({
        id: exams.id,
        title: exams.title,
        description: exams.description,
        startDate: exams.startDate,
        endDate: exams.endDate,
        completionTime: exams.completionTime,
        finalizedAt: exams.finalizedAt,
        targetQuestionCount: exams.targetQuestionCount,
        isActive: exams.isActive,
        enablePause: exams.enablePause,
        pauseDurationMinutes: exams.pauseDurationMinutes,
        audienceType: exams.audienceType,
      })
      .from(exams)
      .where(eq(exams.id, examId))
      .limit(1)
    if (!exam) return null

    const items = await db
      .select({
        questionId: examQuestions.questionId,
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
      .limit(1000)
    const imgMap = await fetchImages(items.map((i) => i.questionId))

    return {
      exam: {
        ...exam,
        startDate: exam.startDate?.getTime() ?? null,
        endDate: exam.endDate?.getTime() ?? null,
        finalizedAt: exam.finalizedAt?.getTime() ?? null,
        questionCount: items.length,
      },
      questions: items.map((i) =>
        toQuizQuestion(
          i,
          imgMap.get(i.questionId) ?? [],
          AnswerKeyLock.none(),
          "key",
        ),
      ),
    }
  },
)

// ============================================
// Admin : statistiques examens
// ============================================

export type ExamsStats = {
  total: number
  preparation: number
  active: number
  upcoming: number
  past: number
  inactive: number
  eligibleCandidates: number
}

/**
 * [Admin] Compteurs par phase + candidats éligibles. « Désactivé » prime, et un
 * examen en préparation ne compte dans aucune phase datée, même s'il garde des
 * dates.
 */
export const getExamsStats = cache(async (): Promise<ExamsStats> => {
  await requireRole(["admin"])
  const now = new Date()

  const finalized = sql`${exams.isActive} and ${exams.finalizedAt} is not null`
  const [counts] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      inactive:
        sql<number>`count(*) filter (where not ${exams.isActive})`.mapWith(
          Number,
        ),
      preparation:
        sql<number>`count(*) filter (where ${exams.isActive} and ${exams.finalizedAt} is null)`.mapWith(
          Number,
        ),
      active:
        sql<number>`count(*) filter (where ${finalized} and ${exams.startDate} <= ${now} and ${exams.endDate} >= ${now})`.mapWith(
          Number,
        ),
      upcoming:
        sql<number>`count(*) filter (where ${finalized} and ${exams.startDate} > ${now})`.mapWith(
          Number,
        ),
      past: sql<number>`count(*) filter (where ${exams.finalizedAt} is not null and ${exams.endDate} < ${now})`.mapWith(
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
    preparation: counts?.preparation ?? 0,
    active: counts?.active ?? 0,
    upcoming: counts?.upcoming ?? 0,
    past: counts?.past ?? 0,
    inactive: counts?.inactive ?? 0,
    eligibleCandidates: elig?.n ?? 0,
  }
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

export type ExamReopeningSource = {
  exam: {
    title: string
    description: string | null
    endDate: number
    enablePause: boolean
    pauseDurationMinutes: number | null
    /** Questions de la source, supprimées comprises : le formulaire signale l'écart. */
    questionCount: number
    audienceType: "subscribers" | "restricted"
  }
  /** Questions non supprimées, dans leur ordre. */
  questionIds: string[]
  /** Audience restreinte sans les comptes supprimés (vide pour `subscribers`). */
  audience: ExamAudienceUser[]
}

/**
 * [Admin] Ce qu'une réouverture reprend d'un examen (`CONTEXT.md`). Une
 * question ou un compte supprimé ferait refuser la création de la copie :
 * ils sont écartés ici plutôt que laissés à l'admin, qui ne les voit pas dans
 * les sélecteurs.
 */
export const getExamReopeningSource = cache(
  async (examId: string): Promise<ExamReopeningSource | null> => {
    await requireRole(["admin"])
    const [[exam], questionRows, audience] = await Promise.all([
      db
        .select({
          title: exams.title,
          description: exams.description,
          endDate: exams.endDate,
          enablePause: exams.enablePause,
          pauseDurationMinutes: exams.pauseDurationMinutes,
          audienceType: exams.audienceType,
        })
        .from(exams)
        // Une réouverture reprend un examen clos, donc finalisé.
        .where(and(eq(exams.id, examId), isNotNull(exams.finalizedAt)))
        .limit(1),
      db
        .select({ id: questions.id, deletedAt: questions.deletedAt })
        .from(examQuestions)
        .innerJoin(questions, eq(questions.id, examQuestions.questionId))
        .where(eq(examQuestions.examId, examId))
        .orderBy(asc(examQuestions.position))
        .limit(1000),
      db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(examAudience)
        .innerJoin(user, eq(user.id, examAudience.userId))
        .where(and(eq(examAudience.examId, examId), isNull(user.deletedAt)))
        .orderBy(asc(user.name))
        .limit(1000),
    ])
    if (!exam) return null
    return {
      exam: {
        ...exam,
        endDate: finalizedDate(exam.endDate),
        questionCount: questionRows.length,
      },
      questionIds: questionRows.filter((q) => !q.deletedAt).map((q) => q.id),
      audience: exam.audienceType === "restricted" ? audience : [],
    }
  },
)
