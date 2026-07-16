import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import {
  examAudience,
  examParticipations,
  exams,
  user,
  userAccess,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { countQuestionsByExam } from "./dal.shared"

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
