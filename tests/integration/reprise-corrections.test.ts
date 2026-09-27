import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { questionExplanations, questions } from "@/db/schema"
import { createId } from "@/lib/ids"
import {
  type StoredCorrection,
  repairCorrections,
  writeCorrection,
} from "@/scripts/reprise-corrections"

const BLOCK =
  "1.\nSource A. Journal A. 2020.\n\n\n2.\nSource B. Journal B. 2021."
const SPLIT = ["Source A. Journal A. 2020.", "Source B. Journal B. 2021."]
const GAP = "1.\nSource A. Journal A. 2020.\n3.\nSource C. Journal C. 2022."

const ids = {
  block: createId(),
  clean: createId(),
  gap: createId(),
  noRefs: createId(),
  deleted: createId(),
}
const all = Object.values(ids)

const seed: Record<keyof typeof ids, StoredCorrection> = {
  block: { id: ids.block, explanation: "Texte [1].\n[2]", references: [BLOCK] },
  clean: {
    id: ids.clean,
    explanation: "Texte [1].",
    references: ["Source A."],
  },
  gap: { id: ids.gap, explanation: "Texte.", references: [GAP] },
  noRefs: { id: ids.noRefs, explanation: "Texte   espacé.", references: null },
  deleted: { id: ids.deleted, explanation: "Texte.", references: [BLOCK] },
}

const stored = async (id: string) => {
  const [row] = await db
    .select({
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(questionExplanations)
    .where(eq(questionExplanations.questionId, id))
  return row
}

beforeAll(async () => {
  await db.insert(questions).values(
    all.map((id) => ({
      id,
      question: `Q reprise ${id}`,
      correctAnswer: "A",
      options: ["A", "B"],
      objectifCmc: "obj test",
      domain: "Autres",
      deletedAt: id === ids.deleted ? new Date() : null,
    })),
  )
  await db.insert(questionExplanations).values(
    Object.values(seed).map((row) => ({
      questionId: row.id,
      explanation: row.explanation,
      references: row.references,
    })),
  )
})

afterAll(async () => {
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, all))
  await db.delete(questions).where(inArray(questions.id, all))
})

const actions = (outcomes: Awaited<ReturnType<typeof repairCorrections>>) =>
  Object.fromEntries(outcomes.map((o) => [o.id, o.action]))

describe("reprise des corrections", () => {
  it("passage à blanc : planifie sans rien écrire et ignore les questions supprimées", async () => {
    const outcomes = await repairCorrections(db, { apply: false, ids: all })

    expect(actions(outcomes)).toEqual({
      [ids.block]: "write",
      [ids.clean]: "skip",
      [ids.gap]: "review",
      [ids.noRefs]: "write",
    })
    expect(await stored(ids.block)).toEqual({
      explanation: seed.block.explanation,
      references: [BLOCK],
    })
  })

  it("une question modifiée ou supprimée depuis la lecture est sautée, pas écrasée", async () => {
    const next = { explanation: "Texte [1] [2].", references: SPLIT }
    const edited = "Texte revu par un admin [1]."
    await db
      .update(questionExplanations)
      .set({ explanation: edited })
      .where(eq(questionExplanations.questionId, ids.block))

    expect(await writeCorrection(db, seed.block, next)).toBe(false)
    expect((await stored(ids.block))?.explanation).toBe(edited)

    expect(await writeCorrection(db, seed.deleted, next)).toBe(false)
    expect(await stored(ids.deleted)).toEqual({
      explanation: seed.deleted.explanation,
      references: [BLOCK],
    })

    await db
      .update(questionExplanations)
      .set({ explanation: seed.block.explanation })
      .where(eq(questionExplanations.questionId, ids.block))
  })

  it("application : écrit les cas sûrs, puis un second passage n'écrit plus rien", async () => {
    const first = await repairCorrections(db, { apply: true, ids: all })
    expect(
      first
        .filter((o) => o.action === "write")
        .map((o) => o.id)
        .sort(),
    ).toEqual([ids.block, ids.noRefs].sort())

    expect(await stored(ids.block)).toEqual({
      explanation: "Texte [1]. [2]",
      references: SPLIT,
    })
    expect(await stored(ids.noRefs)).toEqual({
      explanation: "Texte espacé.",
      references: null,
    })
    expect(await stored(ids.gap)).toEqual({
      explanation: "Texte.",
      references: [GAP],
    })

    const second = await repairCorrections(db, { apply: true, ids: all })
    expect(actions(second)).toEqual({
      [ids.block]: "skip",
      [ids.clean]: "skip",
      [ids.gap]: "review",
      [ids.noRefs]: "skip",
    })
  })
})
