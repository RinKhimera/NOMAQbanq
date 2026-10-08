import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import { questionExplanations, questions } from "@/db/schema"
import { createId } from "@/lib/ids"
import {
  type StoredRow,
  repairCorrections,
  writeCorrection,
} from "@/scripts/reprise-corrections"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

const BLOCK =
  "1.\nSource A. Journal A. 2020.\n\n\n2.\nSource B. Journal B. 2021."
const SPLIT = ["Source A. Journal A. 2020.", "Source B. Journal B. 2021."]
const GAP = "1.\nSource A. Journal A. 2020.\n3.\nSource C. Journal C. 2022."

const CASES = {
  block: { explanation: "Texte [1].\n[2]", references: [BLOCK] },
  clean: { explanation: "Texte [1].", references: ["Source A."] },
  gap: { explanation: "Texte.", references: [GAP] },
  noRefs: { explanation: "Texte   espacé.", references: null },
  deleted: { explanation: "Texte.", references: [BLOCK] },
} satisfies Record<string, Omit<StoredRow, "id">>

type Case = keyof typeof CASES

/** Sème les cinq cas sous des identifiants neufs (`deleted` en suppression douce). */
const seedCases = async () => {
  const rows = Object.fromEntries(
    Object.entries(CASES).map(([name, row]) => [
      name,
      { id: createId(), ...row },
    ]),
  ) as Record<Case, StoredRow>

  await db.insert(questions).values(
    Object.entries(rows).map(([name, row]) => ({
      id: row.id,
      question: `Q reprise ${row.id}`,
      correctAnswer: "A",
      options: ["A", "B"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Autres",
      deletedAt: name === "deleted" ? new Date() : null,
    })),
  )
  await db.insert(questionExplanations).values(
    Object.values(rows).map((row) => ({
      questionId: row.id,
      explanation: row.explanation,
      references: row.references,
    })),
  )
  return { rows, ids: Object.values(rows).map((row) => row.id) }
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

const edit = (
  id: string,
  change: Partial<Pick<StoredRow, "explanation" | "references">>,
) =>
  db
    .update(questionExplanations)
    .set(change)
    .where(eq(questionExplanations.questionId, id))

const actions = (outcomes: Awaited<ReturnType<typeof repairCorrections>>) =>
  Object.fromEntries(outcomes.map((o) => [o.id, o.action]))

const next = { explanation: "Texte [1] [2].", references: SPLIT }

describe("reprise des corrections", () => {
  it("passage à blanc : planifie sans rien écrire et ignore les questions supprimées", async () => {
    const { rows, ids } = await seedCases()
    const outcomes = await repairCorrections(db, { apply: false, ids })

    expect(actions(outcomes)).toEqual({
      [rows.block.id]: "write",
      [rows.clean.id]: "skip",
      [rows.gap.id]: "review",
      [rows.noRefs.id]: "write",
    })
    expect(await stored(rows.block.id)).toEqual({
      explanation: CASES.block.explanation,
      references: [BLOCK],
    })
  })

  it.each([
    ["l'explication", { explanation: "Texte revu par un admin [1]." }],
    ["les références", { references: ["Source revue par un admin."] }],
  ])(
    "une question modifiée depuis la lecture (%s) est sautée, pas écrasée",
    async (_, change) => {
      const { rows } = await seedCases()
      await edit(rows.block.id, change)
      const edited = await stored(rows.block.id)
      expect(await writeCorrection(db, rows.block, next)).toBe(false)
      expect(await stored(rows.block.id)).toEqual(edited)
    },
  )

  it("des références ajoutées depuis la lecture à un champ vide ne sont pas écrasées", async () => {
    const { rows } = await seedCases()
    await edit(rows.noRefs.id, { references: ["Ajoutée."] })
    expect(
      await writeCorrection(db, rows.noRefs, {
        explanation: "Texte espacé.",
        references: null,
      }),
    ).toBe(false)
    expect((await stored(rows.noRefs.id))?.references).toEqual(["Ajoutée."])
  })

  it("une question supprimée n'est pas écrite", async () => {
    const { rows } = await seedCases()
    expect(await writeCorrection(db, rows.deleted, next)).toBe(false)
    expect(await stored(rows.deleted.id)).toEqual({
      explanation: CASES.deleted.explanation,
      references: [BLOCK],
    })
  })

  it("application : écrit les cas sûrs, puis un second passage n'écrit plus rien", async () => {
    const { rows, ids } = await seedCases()
    const first = await repairCorrections(db, { apply: true, ids })
    expect(
      first
        .filter((o) => o.action === "write")
        .map((o) => o.id)
        .sort(),
    ).toEqual([rows.block.id, rows.noRefs.id].sort())

    expect(await stored(rows.block.id)).toEqual({
      explanation: "Texte [1]. [2]",
      references: SPLIT,
    })
    expect(await stored(rows.noRefs.id)).toEqual({
      explanation: "Texte espacé.",
      references: null,
    })
    expect(await stored(rows.gap.id)).toEqual({
      explanation: "Texte.",
      references: [GAP],
    })

    const second = await repairCorrections(db, { apply: true, ids })
    expect(actions(second)).toEqual({
      [rows.block.id]: "skip",
      [rows.clean.id]: "skip",
      [rows.gap.id]: "review",
      [rows.noRefs.id]: "skip",
    })
  })
})
