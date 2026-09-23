import { eq, sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import { questions, trainingSessions } from "@/db/schema"

// La branche de test hérite des données de `develop`, qui contient des lignes
// dans l'ancienne graphie : ce test rougit si la migration de fusion manque.
describe("fusion du domaine Gastro-entérologie", () => {
  const count = async (
    table: typeof questions | typeof trainingSessions,
    domain: string,
  ) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(table)
      .where(eq(table.domain, domain))
    return row?.n ?? 0
  }

  it("ne laisse aucune question dans l'ancienne graphie", async () => {
    expect(await count(questions, "Gastroentérologie")).toBe(0)
  })

  it("rattache l'historique d'entraînement à la graphie retenue", async () => {
    expect(await count(trainingSessions, "Gastroentérologie")).toBe(0)
  })
})
