import { type SQL, sql } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it, vi } from "vitest"
import {
  AnswerKeyLock,
  excludeLocked,
  lockFor,
  scoreWithheldForOwner,
  viewerOf,
} from "@/features/questions/answer-key-lock"

// Vivent ici les court-circuits sans requête et la borne stricte des fragments
// SQL ; la lecture du verrou et la retenue du score sont prouvées sur une vraie
// base (tests/integration/exam-lock-source.test.ts, exams.test.ts).
const mocks = vi.hoisted(() => ({ db: { selectDistinct: vi.fn() } }))

vi.mock("@/db", () => ({ db: mocks.db }))

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

  it("reveal : seulement le marqueur « clé retenue » quand la question est verrouillée", () => {
    const lock = AnswerKeyLock.fromIds(["q1"])
    const withheld = { keyWithheld: true }
    expect(lock.reveal("q1", row, "key")).toEqual(withheld)
    expect(lock.reveal("q1", row, "correction")).toEqual(withheld)
    expect(lock.reveal("q1", row, "correction-with-images")).toEqual(withheld)
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

describe("lockFor — court-circuits sans requête", () => {
  it("admin : aucun verrou, aucune requête", async () => {
    const lock = await lockFor({ id: "adm", role: "admin" }, ["q1"])
    expect(lock.has("q1")).toBe(false)
    expect(mocks.db.selectDistinct).not.toHaveBeenCalled()
  })

  it("aucune candidate : aucun verrou, aucune requête", async () => {
    const lock = await lockFor({ id: "u1", role: "user" }, [])
    expect(lock.has("q1")).toBe(false)
    expect(mocks.db.selectDistinct).not.toHaveBeenCalled()
  })
})

describe("excludeLocked — court-circuit admin", () => {
  const render = (fragment: SQL) => new PgDialect().sqlToQuery(fragment)

  it("admin : aucune exclusion", () => {
    const { sql: text } = render(
      excludeLocked({ id: "adm", role: "admin" }, sql`q.id`),
    )
    expect(text).toBe("true")
  })
})

describe("borne stricte `end_date > now()` des fragments SQL", () => {
  // Un examen dont la fin tombe à l'instant même est CLOS : sa clé et son score
  // redeviennent lisibles. Une base ne prouve pas cette égalité (l'horloge JS
  // du seed et celle de Postgres divergent), d'où la lecture du SQL rendu.
  const render = (fragment: SQL) => new PgDialect().sqlToQuery(fragment).sql
  const answered = sql`select a.question_id from exam_answers a`

  it.each([
    ["excludeLocked anonyme", excludeLocked("anonymous", sql`q.id`), 1],
    [
      "excludeLocked utilisateur",
      excludeLocked({ id: "u1", role: "user" }, sql`q.id`),
      1,
    ],
    [
      "score d'une session d'entraînement",
      scoreWithheldForOwner(sql`s.user_id`, answered),
      1,
    ],
    [
      "score d'une participation (examen propre + réponses)",
      scoreWithheldForOwner(sql`p.user_id`, answered, sql`p.exam_id`),
      2,
    ],
  ] as const)("%s : %i borne(s) stricte(s), jamais >=", (_, fragment, n) => {
    const text = render(fragment)
    expect(text.match(/end_date > now\(\)/g)).toHaveLength(n)
    expect(text).not.toMatch(/end_date >= /)
  })
})
