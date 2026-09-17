import { and, eq, gt, inArray } from "drizzle-orm"
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

export type LockViewer = { id: string; role: "user" | "admin" } | "anonymous"

/** Projection d'un utilisateur de session Better Auth en lecteur du verrou. */
export const viewerOf = (user: {
  id: string
  role?: string | null
}): LockViewer => ({
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

export type Revealed<TImage> = {
  correctAnswer?: string
  explanation?: string
  references?: string[]
  explanationImages?: TImage[]
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
   * Champs de correction d'une question, selon le niveau demandé — ou rien si
   * la clé est retenue. L'appelant décide s'il a le droit de révéler (session
   * terminée, mode tuteur…) ; le verrou décide si la clé est disponible.
   */
  reveal<TImage>(
    questionId: string,
    row: RevealableRow<TImage>,
    level: RevealLevel,
  ): Revealed<TImage> {
    if (this.has(questionId)) return {}
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
