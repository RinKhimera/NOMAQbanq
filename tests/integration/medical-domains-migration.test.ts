import { eq, inArray, sql } from "drizzle-orm"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { questions, trainingSessions, user } from "@/db/schema"
import { createId } from "@/lib/ids"

// La branche de test est déjà migrée : on rejoue le SQL de la migration sur des
// lignes créées ici dans l'ancienne graphie, pour qu'il puisse échouer.
const migrationStatements = readFileSync(
  fileURLToPath(
    new URL("../../drizzle/0020_merge_gastro_domain.sql", import.meta.url),
  ),
  "utf8",
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean)

const runMigration = async () => {
  for (const statement of migrationStatements) {
    await db.execute(sql.raw(statement))
  }
}

const suffix = createId().slice(0, 8)
const userId = createId()
const questionId = createId()
const sessionId = createId()

const domainsOf = async () => {
  const [question] = await db
    .select({ domain: questions.domain })
    .from(questions)
    .where(eq(questions.id, questionId))
  const [session] = await db
    .select({ domain: trainingSessions.domain })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
  return { question: question?.domain, session: session?.domain }
}

afterAll(async () => {
  await db.delete(trainingSessions).where(eq(trainingSessions.id, sessionId))
  await db.delete(questions).where(inArray(questions.id, [questionId]))
  await db.delete(user).where(eq(user.id, userId))
})

describe("migration de fusion du domaine Gastro-entérologie", () => {
  it("réécrit l'ancienne graphie dans la banque et dans l'historique d'entraînement, et se rejoue sans effet", async () => {
    await db.insert(user).values({
      id: userId,
      name: "Migration",
      email: `migration-${suffix}@test.invalid`,
    })
    await db.insert(questions).values({
      id: questionId,
      question: `Migration ${suffix}`,
      correctAnswer: "A",
      options: ["A", "B"],
      objectifCmc: "Objectif",
      domain: "Gastroentérologie",
    })
    await db.insert(trainingSessions).values({
      id: sessionId,
      userId,
      status: "completed",
      domain: "Gastroentérologie",
      questionCount: 1,
      startedAt: new Date(),
      expiresAt: new Date(),
    })

    await runMigration()
    expect(await domainsOf()).toEqual({
      question: "Gastro-entérologie",
      session: "Gastro-entérologie",
    })

    await runMigration()
    expect(await domainsOf()).toEqual({
      question: "Gastro-entérologie",
      session: "Gastro-entérologie",
    })
  })
})
