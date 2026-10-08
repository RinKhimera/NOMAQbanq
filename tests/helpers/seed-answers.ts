import { db } from "@/db"
import { trainingSessionItems, trainingSessions, user } from "@/db/schema"
import { createId } from "@/lib/ids"

const ANSWERED_AT = new Date(Date.UTC(2020, 0, 1))

/**
 * Une première réponse d'entraînement par choix, chacune d'un nouvel étudiant
 * dans une session terminée : la population que lisent les taux de réussite et
 * la détection de clé suspecte. Trois inserts groupés quel que soit le nombre
 * de réponses.
 */
export const seedAnswers = async (
  questionId: string,
  choices: string[],
  opts: { key?: string; answeredAt?: Date } = {},
): Promise<void> => {
  if (choices.length === 0) return
  const key = opts.key ?? "A"
  const answeredAt = opts.answeredAt ?? ANSWERED_AT
  const rows = choices.map((selected) => ({
    userId: createId(),
    sessionId: createId(),
    selected,
  }))
  await db.insert(user).values(
    rows.map(({ userId }) => ({
      id: userId,
      name: "Répondant",
      email: `answer-${userId}@test.invalid`,
    })),
  )
  await db.insert(trainingSessions).values(
    rows.map(({ userId, sessionId }) => ({
      id: sessionId,
      userId,
      status: "completed" as const,
      mode: "test" as const,
      questionCount: 1,
      startedAt: answeredAt,
      expiresAt: new Date(answeredAt.getTime() + 3600_000),
    })),
  )
  await db.insert(trainingSessionItems).values(
    rows.map(({ sessionId, selected }) => ({
      sessionId,
      questionId,
      position: 0,
      selectedAnswer: selected,
      isCorrect: selected === key,
      answeredAt,
    })),
  )
}
