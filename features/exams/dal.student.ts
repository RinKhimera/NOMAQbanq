import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { cache } from "react"
import "server-only"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { db } from "@/db"
import {
  examAnswers,
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questionExplanations,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import type { AttemptTiming } from "@/lib/attempt-clock"
import { getCurrentSession } from "@/lib/dal"
import { canReadResults, isOpen } from "@/lib/exam-phase"
import { objectiveLabelSql } from "../objectives/sql"
import { hasAccess } from "../payments/dal"
import {
  AnswerKeyLock,
  type LockUser,
  lockFor,
  scoreWithheldFor,
  scoreWithheldForOwner,
  viewerOf,
} from "../questions/answer-key-lock"
import { fetchImages, toQuizQuestion } from "../questions/quiz-bridge"
import {
  type SubmittedStatus,
  countQuestionsByExam,
  finalizedDate,
  finalizedDates,
} from "./dal.shared"
import { DEFAULT_PAUSE_MINUTES } from "./schemas"
import type { ExamAudienceType } from "./schemas"

// Questions RÉPONDUES d'une participation, corrélées à la ligne
// `exam_participations` lue — la forme attendue par `scoreWithheldFor`. Avec
// l'examen propre de la participation en plus : son score est retenu tant que
// cet examen est ouvert, réponses ou non (une participation sans réponse a un
// score `0` enregistré) — un score d'examen ne se lit qu'après la clôture.
const answeredQuestionIds = sql`
  select a.question_id
    from exam_answers a
   where a.participation_id = ${examParticipations.id}
     and a.selected_answer is not null
     and a.selected_answer <> ''`
const ownExamId = sql`${examParticipations.examId}`

/** Score enregistré, ou `null` s'il est retenu pour le lecteur (voir `scoreWithheldFor`). */
export const readableParticipationScore = (viewer: LockUser) =>
  sql<
    number | null
  >`case when ${scoreWithheldFor(viewer, answeredQuestionIds, ownExamId)} then null else ${examParticipations.score} end`

/** Filtre d'agrégat : seules les participations dont le score est lisible. */
export const participationScoreReadable = (viewer: LockUser) =>
  sql`not ${scoreWithheldFor(viewer, answeredQuestionIds, ownExamId)}`

/**
 * Titre de l'examen encore OUVERT qui retient le score de la ligne lue (une
 * de ses questions y a été répondue), pour « Publié à la fermeture de … » ;
 * `null` si le score est lisible, ou pour un admin. L'examen propre est
 * écarté : ouvert, la ligne se rend « Soumis », sans score. Il se compare via
 * `ownExamId` (un `sql` imbriqué) : une colonne placée directement dans ce
 * gabarit serait déqualifiée par le select mono-table et `exam_id` devient
 * ambigu au milieu des jointures.
 */
const withheldByOpenExamTitle = (viewer: LockUser) =>
  viewer.role === "admin"
    ? sql<string | null>`null`
    : sql<
        string | null
      >`case when ${scoreWithheldFor(viewer, answeredQuestionIds, ownExamId)} then (
        select akl_e.title
          from exam_questions akl_q
          join exams akl_e on akl_e.id = akl_q.exam_id
          join exam_participations akl_p
            on akl_p.exam_id = akl_q.exam_id and akl_p.user_id = ${viewer.id}
         where akl_q.question_id in (${answeredQuestionIds})
           and akl_e.end_date > now()
           and akl_e.id <> ${ownExamId}
         order by akl_e.end_date, akl_e.id
         limit 1
      ) end`

/** Réponses données d'une participation (la colonne lue est celle de la ligne). */
const answeredCountSql = sql<number>`(select count(*) from (${answeredQuestionIds}) answered)`

/**
 * Score de la ligne lue, ou `null` s'il est retenu pour son PROPRIÉTAIRE —
 * pour les lectures où le lecteur n'est pas le propriétaire (classement,
 * courriel de clôture). Un lecteur admin lit `examParticipations.score`.
 */
export const ownerReadableScore = sql<
  number | null
>`case when ${scoreWithheldForOwner(sql`${examParticipations.userId}`, answeredQuestionIds, ownExamId)} then null else ${examParticipations.score} end`

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
  audienceType: ExamAudienceType
  userHasTaken: boolean
  userParticipation: ExamListParticipation | null
}

export type ExamListParticipation = {
  status: "in_progress" | "completed" | "auto_submitted"
  /** `null` = retenu (examen encore ouvert, ou réponse en correction différée). */
  score: number | null
  completedAt: number | null
  answeredCount: number
  /** Présent dès que la participation est démarrée : temps restant, pause. */
  timing: AttemptTiming | null
  /** Examen ouvert qui retient le score (« Publié à la fermeture de … »). */
  withheldBy: string | null
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

    // Un examen désactivé n'est livré qu'à qui y a participé (reprise d'une
    // épreuve en cours, relecture des résultats) ; `partition` le classe.
    const activeOrTakenWhere = isAdmin
      ? undefined
      : or(
          eq(exams.isActive, true),
          session?.user
            ? exists(
                db
                  .select({ x: sql`1` })
                  .from(examParticipations)
                  .where(
                    and(
                      eq(examParticipations.examId, exams.id),
                      eq(examParticipations.userId, session.user.id),
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
      // Un examen en préparation n'existe pas côté étudiant, admin compris.
      .where(
        and(isNotNull(exams.finalizedAt), audienceWhere, activeOrTakenWhere),
      )
      .orderBy(desc(exams.startDate))
      .limit(100)
    if (rows.length === 0) return []

    const examIds = rows.map((e) => e.id)
    const countMap = await countQuestionsByExam(examIds)

    type ParticipationRow = {
      examId: string
      score: number | null
      status: "in_progress" | "completed" | "auto_submitted"
      startedAt: Date | null
      completedAt: Date | null
      pauseStartedAt: Date | null
      totalPauseDurationMs: number | null
      answeredCount: number
      withheldBy: string | null
    }
    const partMap = new Map<string, ParticipationRow>()
    if (session?.user) {
      const viewer = viewerOf(session.user)
      const parts = await db
        .select({
          examId: examParticipations.examId,
          score: readableParticipationScore(viewer),
          status: examParticipations.status,
          startedAt: examParticipations.startedAt,
          completedAt: examParticipations.completedAt,
          pauseStartedAt: examParticipations.pauseStartedAt,
          totalPauseDurationMs: examParticipations.totalPauseDurationMs,
          answeredCount: answeredCountSql.mapWith(Number),
          withheldBy: withheldByOpenExamTitle(viewer),
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

    return rows.map((row) => {
      const e = { ...row, ...finalizedDates(row) }
      const p = partMap.get(e.id)
      const taken = p?.status === "completed" || p?.status === "auto_submitted"
      const timing: AttemptTiming | null = p?.startedAt
        ? {
            startedAt: p.startedAt.getTime(),
            budgetSeconds: e.completionTime,
            pauseCreditMs: Number(p.totalPauseDurationMs ?? 0),
            pauseInProgress: p.pauseStartedAt
              ? {
                  startedAt: p.pauseStartedAt.getTime(),
                  capMinutes: e.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
                }
              : null,
          }
        : null
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.startDate,
        endDate: e.endDate,
        questionCount: countMap.get(e.id) ?? 0,
        completionTime: e.completionTime,
        isActive: e.isActive,
        enablePause: e.enablePause,
        pauseDurationMinutes: e.pauseDurationMinutes,
        audienceType: e.audienceType,
        userHasTaken: taken,
        userParticipation: p
          ? {
              status: p.status,
              score: p.score,
              completedAt: p.completedAt?.getTime() ?? null,
              answeredCount: p.answeredCount,
              timing,
              withheldBy: p.withheldBy,
            }
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
    audienceType: ExamAudienceType
  }
  questions: QuizQuestion[]
} | null

/** L'utilisateur a une participation à l'examen, quel qu'en soit le statut. */
const hasParticipation = async (examId: string, userId: string) => {
  const [part] = await db
    .select({ id: examParticipations.id })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, userId),
      ),
    )
    .limit(1)
  return Boolean(part)
}

/**
 * Examen + questions ordonnées (forme-pont). La clé de réponse n'est jointe que
 * sur `revealKey`, et seulement pour un admin (fiches de détail) : jamais sur la
 * page de passation. `explanation`/`references` jamais inclus ici (lazy-load
 * séparé). Auth requise.
 */
export const getExamWithQuestions = async (
  examId: string,
  opts?: {
    /** Admin seulement : joint la clé de réponse (fiche admin, jamais la passation). */
    revealKey?: boolean
  },
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
    // En préparation : introuvable ici pour tous. La fiche admin lit
    // `getAdminExam`.
    .where(and(eq(exams.id, examId), isNotNull(exams.finalizedAt)))
    .limit(1)
  if (!exam) return null

  // Examen désactivé : introuvable pour un non-admin, sauf participation
  // existante (épreuve en cours à finir, résultats à relire après clôture).
  if (
    !isAdmin &&
    !exam.isActive &&
    !(await hasParticipation(examId, session.user.id))
  )
    return null

  // Garde d'audience (anti-fuite du TEXTE des questions d'un examen restreint
  // confidentiel) : un non-admin n'accède à un examen `restricted` que s'il est
  // membre de l'audience OU possède déjà une participation (n'importe quel
  // statut). La double condition couvre le membre AVANT démarrage et le membre
  // RETIRÉ de l'audience en cours de passation — il garde l'accès à ses
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
    if (!allowed && !(await hasParticipation(examId, session.user.id)))
      return null
  }

  // Examen `subscribers` : l'abonnement actif EST l'autorisation (symétrique
  // startExam/saveExamAnswer). Anti-fuite du texte des questions à un
  // utilisateur sans entitlement. La fenêtre de dates est gardée par les
  // appelants (page evaluation via participation in_progress ; page détail via
  // isClosed) — pas ici, car le DAL sert aussi la revue après clôture.
  if (
    !isAdmin &&
    exam.audienceType === "subscribers" &&
    !(await hasAccess("exam"))
  ) {
    return null
  }

  const items = await db
    .select({
      questionId: examQuestions.questionId,
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: objectiveLabelSql,
      domain: questions.domain,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position))

  const imgMap = await fetchImages(items.map((i) => i.questionId))

  // Un admin n'est jamais soumis au verrou ; personne d'autre ne reçoit la clé ici.
  const level = opts?.revealKey && isAdmin ? "key" : null
  const questionsView = items.map((i) =>
    toQuizQuestion(
      i,
      imgMap.get(i.questionId) ?? [],
      AnswerKeyLock.none(),
      level,
    ),
  )

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      ...finalizedDates(exam),
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
// Classement d'un examen clos (participant / admin)
// ============================================

/** Lignes affichées au plus ; la ligne du lecteur s'y ajoute au-delà. */
export const EXAM_RANKING_LIMIT = 500

/** Une ligne du classement : jamais le nom complet, l'e-mail ni l'id d'un autre candidat. */
export type ExamRankingRow = {
  rank: number
  username: string | null
  image: string | null
  score: number
  isSelf: boolean
}

export type ExamRanking = {
  exam: { id: string; title: string; endDate: number; questionCount: number }
  /** Effectif classé : participations d'étudiants au score lisible. */
  total: number
  rows: ExamRankingRow[]
  /** Position du lecteur ; `null` pour un admin sans participation. */
  mine:
    | { held: false; rank: number; score: number }
    | { held: true; withheldBy: string | null }
    | null
  /** « Voir mes réponses » verrouillé : même règle que `ACCESS_REQUIRED` des résultats. */
  correctionLocked: boolean
}

/**
 * Classement d'un examen clos pour un candidat qui l'a terminé (ou un admin).
 * Population et ordre du classement admin et du percentile : participations
 * terminées d'étudiants, hors admin et supprimés, score décroissant puis
 * première soumission. Un score retenu pour son propriétaire
 * (`ownerReadableScore`) sort du classement : le rang et le percentile
 * comptent les mêmes participants. `null` = pas d'accès.
 */
export const getExamRanking = cache(
  async (examId: string): Promise<ExamRanking | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    const viewer = viewerOf(session.user)
    const isAdmin = viewer.role === "admin"

    const [[exam], [own]] = await Promise.all([
      db
        .select({
          id: exams.id,
          title: exams.title,
          endDate: exams.endDate,
          audienceType: exams.audienceType,
        })
        .from(exams)
        .where(and(eq(exams.id, examId), isNotNull(exams.finalizedAt)))
        .limit(1),
      db
        .select({
          status: examParticipations.status,
          score: readableParticipationScore(viewer),
          withheldBy: withheldByOpenExamTitle(viewer),
        })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, viewer.id),
          ),
        )
        .limit(1),
    ])
    if (!exam) return null
    const endDate = finalizedDate(exam.endDate)
    if (isOpen({ endDate }, Date.now())) return null

    const ownFinished =
      own?.status === "completed" || own?.status === "auto_submitted"
    if (!ownFinished && !isAdmin) return null

    const cohort = db
      .select({
        id: examParticipations.id,
        userId: examParticipations.userId,
        username: user.username,
        image: user.image,
        score: ownerReadableScore.as("score"),
        completedAt: examParticipations.completedAt,
      })
      .from(examParticipations)
      .innerJoin(user, eq(user.id, examParticipations.userId))
      .where(
        and(
          eq(examParticipations.examId, examId),
          inArray(examParticipations.status, ["completed", "auto_submitted"]),
          eq(user.role, "user"),
          isNull(user.deletedAt),
        ),
      )

    const [ranked, questionCounts, correctionLocked] = await Promise.all([
      db.execute<{
        rank: number
        total: number
        username: string | null
        image: string | null
        score: number
        is_self: boolean
      }>(sql`
        with cohort as (${cohort}),
        ranked as (
          select c.*,
                 row_number() over (
                   order by c.score desc, c.completed_at asc, c.id asc
                 )::int as rank,
                 count(*) over ()::int as total
            from cohort c
           where c.score is not null
        )
        select rank, total, username, image, score,
               user_id = ${viewer.id} as is_self
          from ranked
         where rank <= ${EXAM_RANKING_LIMIT} or user_id = ${viewer.id}
         order by rank`),
      countQuestionsByExam([examId]),
      !isAdmin && exam.audienceType === "subscribers"
        ? hasAccess("exam").then((ok) => !ok)
        : false,
    ])

    const rows = ranked.rows.map((r) => ({
      rank: r.rank,
      username: r.username,
      image: r.image,
      score: r.score,
      isSelf: r.is_self,
    }))
    const selfRow = rows.find((r) => r.isSelf)
    let mine: ExamRanking["mine"] = null
    if (selfRow)
      mine = { held: false, rank: selfRow.rank, score: selfRow.score }
    else if (ownFinished && own.score === null)
      mine = { held: true, withheldBy: own.withheldBy }

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        endDate,
        questionCount: questionCounts.get(examId) ?? 0,
      },
      total: ranked.rows[0]?.total ?? 0,
      rows,
      mine,
      correctionLocked,
    }
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
      /** Étudiant sans accès Examens sur un examen `subscribers` : la correction attend un accès actif. */
      error: "ACCESS_REQUIRED"
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
        /** `null` = score retenu (une réponse en correction différée). */
        score: number | null
        completedAt: number | null
        startedAt: number | null
        status: SubmittedStatus
        answers: {
          questionId: string
          selectedAnswer: string | null
          isCorrect: boolean | null
          /** Marquée pendant la passation : filtre « Marquées » de la correction. */
          isFlagged: boolean
        }[]
      }
      participantUser: ExamParticipantUser
      questions: QuizQuestion[]
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
 * propres résultats, après `endDate`, et avec un accès Examens actif sur un
 * examen `subscribers` (le score reste lisible dans la liste ; la correction,
 * elle, est le service payant — l'audience d'un examen sur invitation vaut
 * accès). Renvoie une union NO_PARTICIPATION / NOT_COMPLETED (admin) /
 * ACCESS_REQUIRED (étudiant) / succès / `null`. Questions en forme « pont »
 * avec `correctAnswer` (explications lazy-loadées séparément).
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
      audienceType: exams.audienceType,
    })
    .from(exams)
    .where(and(eq(exams.id, examId), isNotNull(exams.finalizedAt)))
    .limit(1)
  if (!exam) return null
  const dates = finalizedDates(exam)

  if (!canReadResults({ endDate: dates.endDate }, session.user, Date.now()))
    return null

  const examView: ExamResultsExam = {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    ...dates,
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

  // Après la participation : sans elle, il n'y a pas de correction à réserver.
  if (
    !isAdmin &&
    exam.audienceType === "subscribers" &&
    !(await hasAccess("exam"))
  ) {
    return {
      error: "ACCESS_REQUIRED",
      message: "Accès Examens requis pour la correction.",
      exam: examView,
      participantUser: null,
    }
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
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: objectiveLabelSql,
      domain: questions.domain,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position))

  const resultQuestionIds = items.map((i) => i.questionId)
  const [imgMap, lock] = await Promise.all([
    fetchImages(resultQuestionIds),
    lockFor(viewerOf(session.user), resultQuestionIds),
  ])

  const questionsView = items.map((i) =>
    toQuizQuestion(i, imgMap.get(i.questionId) ?? [], lock, "key"),
  )

  const answerRows = await db
    .select({
      questionId: examAnswers.questionId,
      selectedAnswer: examAnswers.selectedAnswer,
      isCorrect: examAnswers.isCorrect,
      isFlagged: examAnswers.isFlagged,
    })
    .from(examAnswers)
    .where(eq(examAnswers.participationId, p.id))
    .limit(500)

  return {
    exam: examView,
    participant: {
      participationId: p.id,
      userId: p.userId,
      // Le score compte les réponses différées : retenu avec elles (voir
      // `scoreWithheldFor`), jamais transmis au client.
      score: answerRows.some(
        (a) =>
          a.selectedAnswer !== null &&
          a.selectedAnswer !== "" &&
          lock.has(a.questionId),
      )
        ? null
        : p.score,
      completedAt: p.completedAt?.getTime() ?? null,
      startedAt: p.startedAt?.getTime() ?? null,
      status: p.status,
      answers: answerRows.map((a) => ({
        questionId: a.questionId,
        selectedAnswer: a.selectedAnswer ?? null,
        // isCorrect + selectedAnswer révèle la clé → masqué si verrouillée.
        isCorrect: lock.has(a.questionId) ? null : (a.isCorrect ?? null),
        isFlagged: a.isFlagged ?? false,
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
  explanationImages: { url: string; storagePath: string; order: number }[]
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
 * Les DEUX branches sont ensuite filtrées par le verrou de clé de réponse
 * (`lockFor`, banque partagée : ni le training ni un examen clos ne doivent
 * révéler une question d'un examen encore ouvert).
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
    const [viaExam, viaTraining, lock] = await Promise.all([
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
      lockFor(viewerOf(session.user), requested),
    ])
    // Les DEUX branches sont filtrées : un examen clos complété ne doit pas
    // révéler une question qui figure aussi dans un examen encore ouvert.
    authorized = [
      ...new Set([
        ...viaExam.map((r) => r.questionId),
        ...viaTraining.map((r) => r.questionId),
      ]),
    ].filter((id) => !lock.has(id))
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
// Confirmation post-soumission
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
      endDate: finalizedDate(row.endDate),
      status: row.status as "completed" | "auto_submitted",
    }
  },
)

// ============================================
// Dashboard étudiant
// ============================================

// Prédicat d'audience pour les lectures « mes examens » du dashboard : inclut
// les examens ouverts (`subscribers`) et les examens restreints dont `uid` est
// membre (EXISTS corrélé, indexé sur examAudience.userId). Masque les examens
// restreints confidentiels aux non-membres, même abonnés. Parité avec le
// filtre de `getExamsWithParticipation`.
export const memberAudienceWhere = (uid: string) =>
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
