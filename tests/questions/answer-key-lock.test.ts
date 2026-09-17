import { type SQL, sql } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AnswerKeyLock,
  excludeLocked,
  lockFor,
  viewerOf,
} from "@/features/questions/answer-key-lock"

const mocks = vi.hoisted(() => {
  const rows: { current: { questionId: string }[] } = { current: [] }
  const calls = { selectDistinct: 0, innerJoin: 0 }
  const chain = () => {
    const c: Record<string, unknown> = {}
    c.from = () => c
    c.innerJoin = () => {
      calls.innerJoin++
      return c
    }
    c.where = () => Promise.resolve(rows.current)
    return c
  }
  return {
    rows,
    calls,
    db: {
      selectDistinct: vi.fn(() => {
        calls.selectDistinct++
        return chain()
      }),
    },
  }
})

vi.mock("@/db", () => ({ db: mocks.db }))

beforeEach(() => {
  mocks.rows.current = []
  mocks.calls.selectDistinct = 0
  mocks.calls.innerJoin = 0
})

const row = {
  correctAnswer: "B",
  explanation: "Parce que.",
  references: ["Ref 1"],
  explanationImages: [{ url: "u", storagePath: "p", order: 0 }],
}

describe("AnswerKeyLock — partie pure", () => {
  it("has : vrai pour une question verrouillée, faux sinon", () => {
    const lock = AnswerKeyLock.fromIds(["q1"])
    expect(lock.has("q1")).toBe(true)
    expect(lock.has("q2")).toBe(false)
  })

  it("none : ne verrouille rien", () => {
    expect(AnswerKeyLock.none().has("q1")).toBe(false)
  })

  it("reveal key : la clé seule quand la question n'est pas verrouillée", () => {
    const lock = AnswerKeyLock.none()
    expect(lock.reveal("q1", row, "key")).toEqual({ correctAnswer: "B" })
  })

  it("reveal : rien du tout quand la question est verrouillée", () => {
    const lock = AnswerKeyLock.fromIds(["q1"])
    expect(lock.reveal("q1", row, "key")).toEqual({})
    expect(lock.reveal("q1", row, "correction")).toEqual({})
    expect(lock.reveal("q1", row, "correction-with-images")).toEqual({})
  })

  it("reveal correction : clé + explication + références, sans images", () => {
    const lock = AnswerKeyLock.none()
    expect(lock.reveal("q1", row, "correction")).toEqual({
      correctAnswer: "B",
      explanation: "Parce que.",
      references: ["Ref 1"],
    })
  })

  it("reveal correction : explication et références absentes → valeurs vides", () => {
    const lock = AnswerKeyLock.none()
    expect(
      lock.reveal(
        "q1",
        { correctAnswer: "A", explanation: null, references: null },
        "correction",
      ),
    ).toEqual({ correctAnswer: "A", explanation: "", references: [] })
  })

  it("reveal correction-with-images : ajoute les images d'explication", () => {
    const lock = AnswerKeyLock.none()
    expect(lock.reveal("q1", row, "correction-with-images")).toEqual({
      correctAnswer: "B",
      explanation: "Parce que.",
      references: ["Ref 1"],
      explanationImages: row.explanationImages,
    })
    expect(
      lock.reveal(
        "q1",
        { correctAnswer: "A", explanation: "x", references: [] },
        "correction-with-images",
      ),
    ).toEqual({
      correctAnswer: "A",
      explanation: "x",
      references: [],
      explanationImages: [],
    })
  })
})

describe("viewerOf — projection de l'utilisateur de session", () => {
  it("admin reste admin, tout autre rôle (ou absent) devient user", () => {
    expect(viewerOf({ id: "a", role: "admin" })).toEqual({
      id: "a",
      role: "admin",
    })
    expect(viewerOf({ id: "u", role: "user" })).toEqual({
      id: "u",
      role: "user",
    })
    expect(viewerOf({ id: "n", role: null })).toEqual({ id: "n", role: "user" })
    expect(viewerOf({ id: "m" })).toEqual({ id: "m", role: "user" })
  })
})

describe("lockFor — requête et bypass", () => {
  it("admin : aucun verrou, aucune requête", async () => {
    const lock = await lockFor({ id: "adm", role: "admin" }, ["q1"])
    expect(lock.has("q1")).toBe(false)
    expect(mocks.calls.selectDistinct).toBe(0)
  })

  it("aucune candidate : aucun verrou, aucune requête", async () => {
    const lock = await lockFor({ id: "u1", role: "user" }, [])
    expect(lock.has("q1")).toBe(false)
    expect(mocks.calls.selectDistinct).toBe(0)
  })

  it("utilisateur : verrouille les ids renvoyés par la requête", async () => {
    mocks.rows.current = [{ questionId: "q1" }]
    const lock = await lockFor({ id: "u1", role: "user" }, ["q1", "q2"])
    expect(lock.has("q1")).toBe(true)
    expect(lock.has("q2")).toBe(false)
    expect(mocks.calls.selectDistinct).toBe(1)
  })

  it("anonyme : verrouille sans dimension utilisateur (une seule jointure)", async () => {
    mocks.rows.current = [{ questionId: "q2" }]
    const lock = await lockFor("anonymous", ["q1", "q2"])
    expect(lock.has("q2")).toBe(true)
    expect(mocks.calls.innerJoin).toBe(1)
  })

  it("utilisateur : joint les participations (deux jointures)", async () => {
    await lockFor({ id: "u1", role: "user" }, ["q1"])
    expect(mocks.calls.innerJoin).toBe(2)
  })
})

describe("excludeLocked — exclusion à la sélection (fragment SQL)", () => {
  const render = (fragment: SQL) => new PgDialect().sqlToQuery(fragment)

  it("anonyme : not exists sur les examens ouverts, sans participation", () => {
    const { sql: text, params } = render(excludeLocked("anonymous", sql`q.id`))
    expect(text).toMatch(/not exists/i)
    expect(text).toMatch(/exam_questions/)
    expect(text).toMatch(/end_date > now\(\)/)
    expect(text).not.toMatch(/exam_participations/)
    expect(params).toEqual([])
  })

  it("utilisateur : borné à ses participations", () => {
    const { sql: text, params } = render(
      excludeLocked({ id: "u1", role: "user" }, sql`q.id`),
    )
    expect(text).toMatch(/not exists/i)
    expect(text).toMatch(/exam_participations/)
    expect(text).toMatch(/user_id = \$1/)
    expect(params).toEqual(["u1"])
  })

  it("admin : aucune exclusion", () => {
    const { sql: text } = render(
      excludeLocked({ id: "adm", role: "admin" }, sql`q.id`),
    )
    expect(text).toBe("true")
  })
})
