import { type SQL, and, eq, gt, inArray, sql } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { examParticipations, examQuestions, exams } from "@/db/schema"

/**
 * Verrou de clé de réponse.
 *
 * La banque de questions est partagée entre l'entraînement, le quiz public et
 * les examens blancs. Tant qu'un examen contenant une question est OUVERT
 * (`endDate` future), sa clé de réponse ne doit fuiter par aucun canal —
 * correction d'entraînement, explications à la demande, quiz marketing, et
 * même l'appartenance de la question à un lot « mes ratées ». Compromis
 * assumé : la révision de ces questions est différée jusqu'à la clôture.
 *
 * Ce module est la seule définition de la règle : qui est concerné (le
 * `viewer`), quelles questions sont retenues, et ce que « retenir » blanchit.
 */

export type LockUser = { id: string; role: "user" | "admin" }
export type LockViewer = LockUser | "anonymous"

/** Projection d'un utilisateur de session Better Auth en lecteur du verrou. */
export const viewerOf = (user: {
  id: string
  role?: string | null
}): LockUser => ({
  id: user.id,
  role: user.role === "admin" ? "admin" : "user",
})

/** Niveaux de révélation, du plus étroit au plus large. */
export type RevealLevel = "key" | "correction" | "correction-with-images"

type RevealableRow<TImage> = {
  correctAnswer: string
  explanation?: string | null
  references?: string[] | null
  explanationImages?: TImage[]
}

/**
 * Champs de correction d'une question, ou le seul marqueur `keyWithheld`
 * quand la clé est retenue — pour qu'un lecteur en aval distingue « retenue »
 * de « pas encore corrigée » et ne compte pas la réponse comme fausse.
 */
export type Revealed<TImage> = {
  correctAnswer?: string
  explanation?: string
  references?: string[]
  explanationImages?: TImage[]
  keyWithheld?: true
}

export class AnswerKeyLock {
  private constructor(private readonly lockedIds: ReadonlySet<string>) {}

  static fromIds(ids: Iterable<string>): AnswerKeyLock {
    return new AnswerKeyLock(new Set(ids))
  }

  static none(): AnswerKeyLock {
    return new AnswerKeyLock(new Set())
  }

  has(questionId: string): boolean {
    return this.lockedIds.has(questionId)
  }

  /**
   * Champs de correction d'une question, selon le niveau demandé — ou le seul
   * marqueur `keyWithheld` si la clé est retenue. L'appelant décide s'il a le
   * droit de révéler (session terminée, mode tuteur…) ; le verrou décide si la
   * clé est disponible.
   */
  reveal<TImage>(
    questionId: string,
    row: RevealableRow<TImage>,
    level: RevealLevel,
  ): Revealed<TImage> {
    if (this.has(questionId)) return { keyWithheld: true }
    if (level === "key") return { correctAnswer: row.correctAnswer }
    const correction = {
      correctAnswer: row.correctAnswer,
      explanation: row.explanation ?? "",
      references: row.references ?? [],
    }
    if (level === "correction") return correction
    return { ...correction, explanationImages: row.explanationImages ?? [] }
  }
}

/**
 * Verrou d'un lecteur sur un ensemble de questions candidates. Un admin n'est
 * jamais verrouillé. Un utilisateur l'est sur les questions d'un examen ouvert
 * où il a une participation (tout statut) ; un anonyme sur toute question d'un
 * examen ouvert, quel qu'il soit. Borné par `candidates`.
 */
export const lockFor = async (
  viewer: LockViewer,
  candidates: string[],
): Promise<AnswerKeyLock> => {
  if (candidates.length === 0) return AnswerKeyLock.none()
  if (viewer !== "anonymous" && viewer.role === "admin") {
    return AnswerKeyLock.none()
  }

  const openExamQuestions = db
    .selectDistinct({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
  const isOpen = gt(exams.endDate, new Date())
  const inCandidates = inArray(examQuestions.questionId, candidates)

  const rows =
    viewer === "anonymous"
      ? await openExamQuestions.where(and(isOpen, inCandidates))
      : await openExamQuestions
          .innerJoin(
            examParticipations,
            eq(examParticipations.examId, examQuestions.examId),
          )
          .where(
            and(eq(examParticipations.userId, viewer.id), isOpen, inCandidates),
          )
  return AnswerKeyLock.fromIds(rows.map((r) => r.questionId))
}

/**
 * Même règle que `lockFor`, mais appliquée à la SÉLECTION : un prédicat à
 * insérer dans le WHERE d'un tirage (corpus de révision, quiz public), pour
 * qu'une question retenue n'entre jamais dans un lot — son appartenance au
 * lot « mes ratées » dirait déjà « tu t'es trompé ». Corrélé sur
 * `questionId` (colonne de la requête appelante), donc ni liste d'ids à
 * résoudre au préalable, ni lecture non bornée.
 */
export const excludeLocked = (viewer: LockViewer, questionId: SQL): SQL => {
  if (viewer !== "anonymous" && viewer.role === "admin") return sql`true`
  const participation =
    viewer === "anonymous"
      ? sql``
      : sql`join exam_participations akl_p
              on akl_p.exam_id = akl_q.exam_id and akl_p.user_id = ${viewer.id}`
  return sql`not exists (
    select 1
      from exam_questions akl_q
      join exams akl_e on akl_e.id = akl_q.exam_id
      ${participation}
     where akl_q.question_id = ${questionId}
       and akl_e.end_date > now()
  )`
}

/**
 * Même règle, appliquée aux LECTURES DE SCORE. Le score enregistré compte
 * toutes les réponses, différées comprises ; le restituer à côté des compteurs
 * qui les excluent donnerait, par soustraction, la justesse des réponses
 * différées. Un score retenu se lit `null` — il n'est ni recalculé ni réécrit,
 * seulement retenu à la lecture, et un agrégat l'exclut (une moyenne
 * avant/après le rendrait).
 *
 * La retenue s'indexe sur le PROPRIÉTAIRE du score, pas sur le lecteur : c'est
 * lui qui connaît ses réponses, et son score lu par un camarade lui revient.
 * `ownerId` est une colonne SQL (`exam_participations.user_id`,
 * `training_sessions.user_id`) ; `answeredQuestionIds`, une sous-requête des
 * questions RÉPONDUES de la ligne lue, corrélée à elle. Un lecteur admin ne
 * passe pas par ici : il lit le score brut.
 *
 * `ownExamId` est l'examen propre d'une participation
 * (`exam_participations.exam_id`) : son score est retenu tant que cet examen
 * est ouvert, réponses ou non — une participation sans réponse a un score
 * `0` enregistré, qu'un examen encore ouvert ne doit pas plus livrer qu'un
 * autre. Une session d'entraînement n'a pas d'examen propre.
 */
export const scoreWithheldForOwner = (
  ownerId: SQL,
  answeredQuestionIds: SQL,
  ownExamId?: SQL,
): SQL<boolean> => {
  const byAnsweredQuestions = sql<boolean>`exists (
    select 1
      from exam_questions akl_q
      join exams akl_e on akl_e.id = akl_q.exam_id
      join exam_participations akl_p
        on akl_p.exam_id = akl_q.exam_id and akl_p.user_id = ${ownerId}
     where akl_q.question_id in (${answeredQuestionIds})
       and akl_e.end_date > now()
  )`
  if (!ownExamId) return byAnsweredQuestions
  return sql<boolean>`(exists (
    select 1
      from exams akl_o
     where akl_o.id = ${ownExamId}
       and akl_o.end_date > now()
  ) or ${byAnsweredQuestions})`
}

/**
 * Forme « lecteur » de `scoreWithheldForOwner`, pour les lectures où le
 * lecteur est aussi le propriétaire (« mes sessions », « mes examens ») :
 * un admin n'est jamais retenu.
 */
export const scoreWithheldFor = (
  viewer: LockUser,
  answeredQuestionIds: SQL,
  ownExamId?: SQL,
): SQL<boolean> =>
  viewer.role === "admin"
    ? sql<boolean>`false`
    : scoreWithheldForOwner(sql`${viewer.id}`, answeredQuestionIds, ownExamId)
