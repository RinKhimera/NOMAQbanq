import { and, asc, eq, inArray } from "drizzle-orm"
import "server-only"
import type { QuizImage, QuizQuestion } from "@/components/quiz/runner/types"
import { db } from "@/db"
import { questionImages } from "@/db/schema"
import { cdnUrl } from "@/lib/cdn"
import type { AnswerKeyLock, RevealLevel } from "./answer-key-lock"

/**
 * QuizBridge — un seul propriétaire de la forme-pont (`CONTEXT.md`) : la
 * question telle que les composants de quiz la consomment, quel que soit le
 * canal qui l'a chargée. Les champs de correction ne sont posés que par le
 * verrou de clé de réponse, jamais à la main.
 */

export type StatementRow = {
  questionId: string
  question: string
  options: string[]
  domain: string
  objectifCMC: string
}

export type CorrectionRow = {
  correctAnswer: string
  explanation?: string | null
  references?: string[] | null
  explanationImages?: QuizImage[]
}

/** Énoncé seul : aucun canal de révélation (passation, quiz public). */
export function toQuizQuestion(
  row: StatementRow,
  images: QuizImage[],
  lock: AnswerKeyLock,
  level: null,
): QuizQuestion
/**
 * Énoncé + correction au niveau demandé, blanchie par le verrou. Un niveau
 * décidé à l'exécution (`null` possible) exige quand même la clé dans la ligne.
 */
export function toQuizQuestion(
  row: StatementRow & CorrectionRow,
  images: QuizImage[],
  lock: AnswerKeyLock,
  level: RevealLevel | null,
): QuizQuestion
export function toQuizQuestion(
  row: StatementRow & Partial<CorrectionRow>,
  images: QuizImage[],
  lock: AnswerKeyLock,
  level: RevealLevel | null,
): QuizQuestion {
  const statement = {
    _id: row.questionId,
    question: row.question,
    options: row.options,
    domain: row.domain,
    objectifCMC: row.objectifCMC,
    images,
  }
  if (level === null || row.correctAnswer === undefined) return statement
  return {
    ...statement,
    ...lock.reveal(
      row.questionId,
      { ...row, correctAnswer: row.correctAnswer },
      level,
    ),
  }
}

export const groupImages = (
  rows: { questionId: string; storagePath: string; position: number }[],
): Map<string, QuizImage[]> => {
  const map = new Map<string, QuizImage[]>()
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

/**
 * Images d'un lot de questions, groupées par question, URL CDN dérivée. Le
 * canal `explanation` est un canal de révélation : jamais sur le pont
 * d'énoncé `images`. Pas de `.limit` : la lecture est bornée par le lot de
 * l'appelant (au plus `MAX_EXAM_QUESTIONS` ids) et tronquer ferait disparaître
 * en silence les images des dernières questions.
 */
export const fetchImages = async (
  questionIds: string[],
  kind: "statement" | "explanation" = "statement",
): Promise<Map<string, QuizImage[]>> => {
  if (questionIds.length === 0) return new Map()
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
