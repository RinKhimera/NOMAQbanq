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
import type { ExamSchedule } from "@/lib/exam-phase"
import { PASS_THRESHOLD } from "@/lib/score"
import {
  type SubmittedStatus,
  finalizedDate,
  questionCountsByExam,
  submittedStatus,
} from "./dal.shared"
import type { ExamAudienceType } from "./schemas"

// ============================================
// Admin : vue de pilotage et chiffres d'un examen
// ============================================

/**
 * Chiffres d'un examen, comptés sur la population du classement d'examen
 * (`CONTEXT.md`) : participations d'étudiants, comptes admin et supprimés
 * exclus. Un admin qui teste un examen n'en devient ni participant ni
 * « Meilleur score ». Lecture admin : les scores sont bruts, jamais retenus.
 */
export type ExamFigures = {
  /** Participations commencées, soumises ou non. */
  started: number
  submitted: number
  /** Soumises automatiquement (temps écoulé, fermeture). */
  autoSubmitted: number
  inProgress: number
  /** Moyenne des participations soumises, au plancher ; `null` sans participation soumise. */
  average: number | null
  best: number | null
  /** Participations soumises au seuil de réussite ou au-dessus. */
  passed: number
  /**
   * Étudiants qui peuvent passer l'examen : la liste d'un examen restreint
   * (comptes supprimés exclus), sinon les étudiants avec un accès Examens
   * actif, hors comptes supprimés ou suspendus.
   */
  eligible: number
  /** Participations de tous les comptes, admin et supprimés compris. */
  participations: number
  /** Jeu de questions figé : au moins une participation (garde `HAS_PARTICIPATIONS`). */
  locked: boolean
}

const SUBMITTED = sql`${examParticipations.status} in ('completed', 'auto_submitted')`

const nullableNumber = (v: unknown) => (v === null ? null : Number(v))

const emptyFigures = (eligible: number, participations = 0): ExamFigures => ({
  started: 0,
  submitted: 0,
  autoSubmitted: 0,
  inProgress: 0,
  average: null,
  best: null,
  passed: 0,
  eligible,
  participations,
  locked: participations > 0,
})

/** Participations par examen, sur la population du classement. */
const participationFigures = async (
  examIds: string[],
): Promise<
  Map<string, Omit<ExamFigures, "eligible" | "participations" | "locked">>
> => {
  if (examIds.length === 0) return new Map()
  const rows = await db
    .select({
      examId: examParticipations.examId,
      started: sql<number>`count(*)`.mapWith(Number),
      submitted: sql<number>`count(*) filter (where ${SUBMITTED})`.mapWith(
        Number,
      ),
      autoSubmitted:
        sql<number>`count(*) filter (where ${examParticipations.status} = 'auto_submitted')`.mapWith(
          Number,
        ),
      inProgress:
        sql<number>`count(*) filter (where ${examParticipations.status} = 'in_progress')`.mapWith(
          Number,
        ),
      average: sql<
        number | null
      >`floor(avg(${examParticipations.score}) filter (where ${SUBMITTED}))`.mapWith(
        nullableNumber,
      ),
      best: sql<
        number | null
      >`max(${examParticipations.score}) filter (where ${SUBMITTED})`.mapWith(
        nullableNumber,
      ),
      passed:
        sql<number>`count(*) filter (where ${SUBMITTED} and ${examParticipations.score} >= ${PASS_THRESHOLD})`.mapWith(
          Number,
        ),
    })
    .from(examParticipations)
    .innerJoin(user, eq(user.id, examParticipations.userId))
    .where(
      and(
        inArray(examParticipations.examId, examIds),
        eq(user.role, "user"),
        isNull(user.deletedAt),
      ),
    )
    .groupBy(examParticipations.examId)
  return new Map(rows.map(({ examId, ...figures }) => [examId, figures]))
}

/** Participations par examen, de n'importe quel compte. */
const allParticipations = async (
  examIds: string[],
): Promise<Map<string, number>> => {
  if (examIds.length === 0) return new Map()
  const rows = await db
    .select({
      examId: examParticipations.examId,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(examParticipations)
    .where(inArray(examParticipations.examId, examIds))
    .groupBy(examParticipations.examId)
  return new Map(rows.map((r) => [r.examId, r.n]))
}

/** Taille de la liste d'un examen restreint, comptes supprimés exclus. */
const audienceSizes = async (
  examIds: string[],
): Promise<Map<string, number>> => {
  if (examIds.length === 0) return new Map()
  const rows = await db
    .select({
      examId: examAudience.examId,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(examAudience)
    .innerJoin(user, eq(user.id, examAudience.userId))
    .where(and(inArray(examAudience.examId, examIds), isNull(user.deletedAt)))
    .groupBy(examAudience.examId)
  return new Map(rows.map((r) => [r.examId, r.n]))
}

/**
 * Étudiants avec un accès Examens actif, hors comptes supprimés ou suspendus :
 * les éligibles d'un examen ouvert aux abonnés.
 */
const countEligibleSubscribers = async (now: Date): Promise<number> => {
  const [row] = await db
    .select({
      n: sql<number>`count(distinct ${userAccess.userId})`.mapWith(Number),
    })
    .from(userAccess)
    .innerJoin(user, eq(user.id, userAccess.userId))
    .where(
      and(
        eq(userAccess.accessType, "exam"),
        gt(userAccess.expiresAt, now),
        eq(user.role, "user"),
        isNull(user.deletedAt),
        eq(user.banned, false),
      ),
    )
  return row?.n ?? 0
}

/** [Admin] Étudiants éligibles à un examen ouvert aux abonnés (formulaire, fiche). */
export const getEligibleSubscriberCount = cache(async (): Promise<number> => {
  await requireRole(["admin"])
  return countEligibleSubscribers(new Date())
})

/** Chiffres de plusieurs examens d'un coup (liste) ou d'un seul (fiche). */
const examFigures = async (
  list: { id: string; audienceType: ExamAudienceType }[],
): Promise<Map<string, ExamFigures>> => {
  const restrictedIds = list
    .filter((e) => e.audienceType === "restricted")
    .map((e) => e.id)
  const ids = list.map((e) => e.id)
  const [participations, counts, audiences, subscribers] = await Promise.all([
    participationFigures(ids),
    allParticipations(ids),
    audienceSizes(restrictedIds),
    list.some((e) => e.audienceType === "subscribers")
      ? countEligibleSubscribers(new Date())
      : Promise.resolve(0),
  ])
  return new Map(
    list.map((e) => {
      const eligible =
        e.audienceType === "restricted"
          ? (audiences.get(e.id) ?? 0)
          : subscribers
      const p = participations.get(e.id)
      const all = counts.get(e.id) ?? 0
      return [
        e.id,
        p
          ? { ...p, eligible, participations: all, locked: all > 0 }
          : emptyFigures(eligible, all),
      ]
    }),
  )
}

/** [Admin] Chiffres d'un examen (fiche), voir `ExamFigures`. */
export const getExamFigures = cache(
  async (examId: string): Promise<ExamFigures | null> => {
    await requireRole(["admin"])
    const [exam] = await db
      .select({ id: exams.id, audienceType: exams.audienceType })
      .from(exams)
      .where(eq(exams.id, examId))
      .limit(1)
    if (!exam) return null
    return (await examFigures([exam])).get(exam.id) ?? null
  },
)

export type AdminExamOverviewItem = ExamSchedule & {
  id: string
  title: string
  isActive: boolean
  audienceType: ExamAudienceType
  /** Taille du jeu actuel ; égale au visé une fois l'examen finalisé. */
  questionCount: number
  /** Questions du jeu supprimées depuis leur ajout : la finalisation les refuse. */
  deletedQuestionCount: number
  targetQuestionCount: number
  figures: ExamFigures
}

/** Examens lus par la vue de pilotage : bien au-delà d'une année d'examens blancs. */
const OVERVIEW_LIMIT = 200

/**
 * [Admin] Vue de pilotage des examens : tous les examens, du plus récent au
 * plus ancien par date d'ouverture (en préparation sans dates en tête), avec
 * leurs chiffres. La page les range par phase.
 */
export const getExamsOverview = cache(
  async (): Promise<AdminExamOverviewItem[]> => {
    await requireRole(["admin"])
    const rows = await db
      .select({
        id: exams.id,
        title: exams.title,
        startDate: exams.startDate,
        endDate: exams.endDate,
        finalizedAt: exams.finalizedAt,
        isActive: exams.isActive,
        audienceType: exams.audienceType,
        targetQuestionCount: exams.targetQuestionCount,
      })
      .from(exams)
      .orderBy(
        sql`${exams.startDate} desc nulls first`,
        desc(exams.createdAt),
        desc(exams.id),
      )
      .limit(OVERVIEW_LIMIT)
    if (rows.length === 0) return []

    const ids = rows.map((e) => e.id)
    const [questionCounts, figures] = await Promise.all([
      questionCountsByExam(ids),
      examFigures(rows),
    ])
    return rows.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate?.getTime() ?? null,
      endDate: e.endDate?.getTime() ?? null,
      finalizedAt: e.finalizedAt?.getTime() ?? null,
      isActive: e.isActive,
      audienceType: e.audienceType,
      questionCount: questionCounts.get(e.id)?.total ?? 0,
      deletedQuestionCount: questionCounts.get(e.id)?.deleted ?? 0,
      targetQuestionCount: e.targetQuestionCount,
      figures: figures.get(e.id) ?? emptyFigures(0),
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
    /** Questions du jeu supprimées depuis leur ajout. */
    deletedQuestionCount: number
    audienceType: ExamAudienceType
  }
}

/**
 * [Admin] Un examen dans toutes ses phases, préparation comprise (fiche,
 * formulaire, compositeur ; son jeu se lit par `getExamSelection`). La lecture
 * étudiante `getExamWithQuestions` ignore les examens en préparation.
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

    const counts = (await questionCountsByExam([examId])).get(examId)

    return {
      exam: {
        ...exam,
        startDate: exam.startDate?.getTime() ?? null,
        endDate: exam.endDate?.getTime() ?? null,
        finalizedAt: exam.finalizedAt?.getTime() ?? null,
        questionCount: counts?.total ?? 0,
        deletedQuestionCount: counts?.deleted ?? 0,
      },
    }
  },
)

// ============================================
// Admin : classement d'un examen
// ============================================

/** Compte hors de la population du classement d'examen. */
export type LeaderboardFlag = "admin" | "deleted"

export type LeaderboardEntry = {
  participationId: string
  user: {
    id: string
    name: string
    username: string | null
    image: string | null
    /** Compte hors population, listé avec son badge et sans rang. Un admin supprimé est `deleted`. */
    flag: LeaderboardFlag | null
  } | null
  score: number
  completedAt: number | null
  /** Soumission manuelle (`completed`) ou automatique à la fin du temps ou à la fermeture. */
  status: SubmittedStatus
}

const leaderboardFlag = (u: {
  role: string
  deletedAt: Date | null
}): LeaderboardFlag | null => {
  if (u.deletedAt) return "deleted"
  if (u.role === "admin") return "admin"
  return null
}

/**
 * [Admin] Classement d'un examen finalisé : toutes les participations soumises,
 * score décroissant, comptes admin et supprimés signalés par `flag` (le rang se
 * compte sur la population, côté écran). Lecture admin : scores bruts, jamais
 * retenus. Un candidat lit sa forme réduite, sans nom complet ni copie des
 * autres : `getExamRanking`.
 */
export const getExamLeaderboard = async (
  examId: string,
): Promise<LeaderboardEntry[]> => {
  await requireRole(["admin"])
  const rows = await db
    .select({
      participationId: examParticipations.id,
      score: examParticipations.score,
      completedAt: examParticipations.completedAt,
      status: examParticipations.status,
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      role: user.role,
      deletedAt: user.deletedAt,
    })
    .from(examParticipations)
    .innerJoin(user, eq(user.id, examParticipations.userId))
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .where(
      and(
        eq(examParticipations.examId, examId),
        isNotNull(exams.finalizedAt),
        inArray(examParticipations.status, ["completed", "auto_submitted"]),
      ),
    )
    .orderBy(
      desc(examParticipations.score),
      asc(examParticipations.completedAt),
      // Un lot auto-soumis partage le même `completedAt` : sans clé unique,
      // l'ordre des ex æquo changerait d'un rendu à l'autre.
      asc(examParticipations.id),
    )
    .limit(500)

  return rows.map((r) => ({
    participationId: r.participationId,
    user: {
      id: r.userId,
      name: r.name,
      username: r.username,
      image: r.image ?? null,
      flag: leaderboardFlag(r),
    },
    score: r.score,
    completedAt: r.completedAt?.getTime() ?? null,
    status: submittedStatus(r.status),
  }))
}

/**
 * [Admin] Places restantes avant le visé du jeu d'un examen, `null` s'il est
 * introuvable (aperçu de complétion).
 */
export const getRemainingSeats = async (
  examId: string,
): Promise<number | null> => {
  await requireRole(["admin"])
  const [exam] = await db
    .select({ target: exams.targetQuestionCount })
    .from(exams)
    .where(eq(exams.id, examId))
    .limit(1)
  if (!exam) return null
  const count = (await questionCountsByExam([examId])).get(examId)?.total ?? 0
  return Math.max(0, exam.target - count)
}

export type ExamAudienceUser = { id: string; name: string; email: string }

/**
 * [Admin] Utilisateurs composant l'audience restreinte d'un examen (page détail /
 * pré-remplissage du picker en édition). Triés par nom, bornés. Garde admin.
 */
export const getExamAudience = cache(
  async (examId: string): Promise<ExamAudienceUser[]> => {
    await requireRole(["admin"])
    return (
      db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(examAudience)
        .innerJoin(user, eq(user.id, examAudience.userId))
        // Un compte supprimé ne compte plus dans la liste : l'enregistrement le
        // refuserait (`writeAudience`), et les chiffres l'excluent déjà.
        .where(and(eq(examAudience.examId, examId), isNull(user.deletedAt)))
        .orderBy(asc(user.name))
        .limit(1000)
    )
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
    audienceType: ExamAudienceType
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
