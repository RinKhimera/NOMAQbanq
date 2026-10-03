import { eq, inArray, sql } from "drizzle-orm"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { cmcObjectives, questions } from "@/db/schema"
import {
  correctQuestionObjective,
  createObjective,
  deleteObjective,
  keepObjective,
  mergeObjectives,
  renameObjective,
} from "@/features/objectives/actions"
import { getPublicDomainObjectives } from "@/features/objectives/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { objectiveIdFor } from "../helpers/objective"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({ requireRole: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const suffix = createId().slice(0, 8)
const DOMAIN = `OBJ-${suffix}`
const createdQuestions: string[] = []

/** Libellé propre à ce passage : la branche de test est une copie de develop. */
const label = (text: string) => `${text} ${suffix}`

const newQuestion = async (objectiveId: string, deleted = false) => {
  const id = createId()
  createdQuestions.push(id)
  await db.insert(questions).values({
    id,
    question: `Énoncé ${id}`,
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectiveId,
    domain: DOMAIN,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    deletedAt: deleted ? new Date("2026-03-01T00:00:00Z") : null,
  })
  return id
}

const rowsOf = (ids: string[]) =>
  db
    .select()
    .from(questions)
    .where(inArray(questions.id, ids))
    .orderBy(questions.id)

const entry = async (id: string) =>
  (await db.select().from(cmcObjectives).where(eq(cmcObjectives.id, id)))[0]

/** Tout sauf l'objectif : ce qu'une fusion ou une correction ne touche pas. */
const withoutObjective = (rows: Awaited<ReturnType<typeof rowsOf>>) =>
  rows.map((row) => ({ ...row, objectiveId: undefined }))

beforeAll(() => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)
})

afterAll(async () => {
  await db.delete(questions).where(inArray(questions.id, createdQuestions))
})

describe("migration 0023 : remplissage du référentiel", () => {
  const backfill = readFileSync(
    fileURLToPath(
      new URL("../../drizzle/0023_cmc_objectives.sql", import.meta.url),
    ),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => /^(--[^\n]*\n)*\s*(INSERT|UPDATE)/.test(s))

  class Rollback extends Error {}

  it("rattache chaque question à une entrée, marque les valeurs invalides, ne change rien d'autre, et se rejoue sans effet", async () => {
    expect(backfill).toHaveLength(2)
    const legacy = {
      spaced: `  Douleur  abdominale aiguë ${suffix} `,
      dash: "-",
      tab: `Bordetella pertussis ${suffix} \t`,
      pasted: `Une jeune fille\tde 13 ans ${suffix} ${"x".repeat(130)}`,
    }
    const outcome = await db
      .transaction(async (tx) => {
        await tx.execute(
          sql`alter table questions alter column objective_id drop not null`,
        )
        const ids: Record<string, string> = {}
        for (const [key, value] of Object.entries(legacy)) {
          ids[key] = createId()
          await tx.insert(questions).values({
            id: ids[key],
            question: `Migration ${key} ${suffix}`,
            correctAnswer: "A",
            options: ["A", "B", "C", "D"],
            objectifCmc: value,
            objectiveId: sql`null`,
            domain: DOMAIN,
          })
        }
        const before = await tx
          .select()
          .from(questions)
          .where(inArray(questions.id, Object.values(ids)))
          .orderBy(questions.id)

        for (const statement of backfill) await tx.execute(sql.raw(statement))
        const read = () =>
          tx
            .select({
              id: questions.id,
              objectiveId: questions.objectiveId,
              label: cmcObjectives.label,
              needsFix: cmcObjectives.needsFix,
              reviewedAt: cmcObjectives.reviewedAt,
            })
            .from(questions)
            .innerJoin(
              cmcObjectives,
              eq(cmcObjectives.id, questions.objectiveId),
            )
            .where(inArray(questions.id, Object.values(ids)))
            .orderBy(questions.id)
        const first = await read()
        const after = await tx
          .select()
          .from(questions)
          .where(inArray(questions.id, Object.values(ids)))
          .orderBy(questions.id)

        for (const statement of backfill) await tx.execute(sql.raw(statement))
        const second = await read()
        throw new Rollback(
          JSON.stringify({ ids, before, after, first, second }),
        )
      })
      .catch((error: unknown) => {
        if (error instanceof Rollback) return JSON.parse(error.message)
        throw error
      })

    const byId = new Map<string, { label: string; needsFix: boolean }>(
      outcome.first.map((r: { id: string }) => [r.id, r]),
    )
    expect(byId.get(outcome.ids.spaced)).toMatchObject({
      label: `Douleur abdominale aiguë ${suffix}`,
      needsFix: false,
      reviewedAt: null,
    })
    expect(byId.get(outcome.ids.tab)).toMatchObject({
      label: `Bordetella pertussis ${suffix}`,
      needsFix: false,
    })
    expect(byId.get(outcome.ids.dash)).toMatchObject({
      label: "-",
      needsFix: true,
    })
    expect(byId.get(outcome.ids.pasted)).toMatchObject({ needsFix: true })
    expect(withoutObjective(outcome.after)).toEqual(
      withoutObjective(outcome.before),
    )
    expect(outcome.second).toEqual(outcome.first)
  })
})

describe("création, renommage, garde et suppression", () => {
  it("crée un objectif revu ; refuse un libellé hors règles ou dont la clé double un objectif, en le proposant", async () => {
    const created = await createObjective({ label: `  ${label("Toux")}  ` })
    expect(created).toMatchObject({
      success: true,
      objective: { label: label("Toux") },
    })
    if (!created.success) return
    expect((await entry(created.objective.id))?.reviewedAt).not.toBeNull()

    expect(await createObjective({ label: label("toux.") })).toEqual({
      success: false,
      error: `L'objectif « ${label("Toux")} » existe déjà : choisissez-le plutôt.`,
      existing: created.objective,
    })
    expect(await createObjective({ label: "-" })).toMatchObject({
      success: false,
      error: expect.stringMatching(/3 caractères au moins/),
    })
  })

  it("renomme sous les mêmes règles, sans se compter comme doublon de lui-même", async () => {
    const id = await objectiveIdFor(label("Fievre"))
    const other = await objectiveIdFor(label("Céphalée"))
    expect(await renameObjective({ id, label: label("Fièvre") })).toEqual({
      success: true,
    })
    expect((await entry(id))?.label).toBe(label("Fièvre"))
    expect(
      await renameObjective({ id, label: label("cephalee") }),
    ).toMatchObject({ success: false, existing: { id: other } })
  })

  it("« Garder tel quel » marque l'entrée revue, mais pas si une variante de même clé existe", async () => {
    const alone = await objectiveIdFor(label("Ictère"))
    expect(await keepObjective(alone)).toEqual({ success: true })
    expect((await entry(alone))?.reviewedAt).not.toBeNull()

    const a = await objectiveIdFor(label("Hématurie"))
    await objectiveIdFor(label("hematurie"))
    expect(await keepObjective(a)).toMatchObject({ success: false })
    expect((await entry(a))?.reviewedAt).toBeNull()
  })

  it("refuse de supprimer un objectif utilisé, même par une question supprimée", async () => {
    const used = await objectiveIdFor(label("Syncope"))
    await newQuestion(used, true)
    expect(await deleteObjective(used)).toEqual({
      success: false,
      error:
        "Des questions utilisent encore cet objectif : fusionnez-le plutôt.",
    })
    const unused = await objectiveIdFor(label("Prurit"))
    expect(await deleteObjective(unused)).toEqual({ success: true })
    expect(await entry(unused)).toBeUndefined()
  })
})

describe("fusion", () => {
  it("ne change que l'objectif des questions concernées, supprime les variantes et marque l'entrée gardée", async () => {
    const keep = await objectiveIdFor(label("Douleur abdominale aigue"))
    const variant = await objectiveIdFor(label("Douleur abdominale aiguë"))
    const bystander = await objectiveIdFor(label("Dysphagie"))
    const moved = [await newQuestion(variant), await newQuestion(variant, true)]
    const stays = [await newQuestion(keep), await newQuestion(bystander)]
    const before = await rowsOf([...moved, ...stays])

    expect(
      await mergeObjectives({
        keepId: keep,
        mergeIds: [variant],
        label: label("Douleur abdominale aiguë"),
      }),
    ).toEqual({ success: true, moved: 2 })

    const after = await rowsOf([...moved, ...stays])
    expect(withoutObjective(after)).toEqual(withoutObjective(before))
    const objectiveOf = new Map(after.map((r) => [r.id, r.objectiveId]))
    expect(moved.map((id) => objectiveOf.get(id))).toEqual([keep, keep])
    expect(objectiveOf.get(stays[1]!)).toBe(bystander)
    expect(await entry(variant)).toBeUndefined()
    expect(await entry(keep)).toMatchObject({
      label: label("Douleur abdominale aiguë"),
      reviewedAt: expect.any(Date),
    })
  })

  it("refuse un libellé final qui double un objectif resté hors de la fusion", async () => {
    const a = await objectiveIdFor(label("Anémie"))
    const b = await objectiveIdFor(label("Anemie ferriprive"))
    const outsider = await objectiveIdFor(label("anémie!"))
    expect(
      await mergeObjectives({
        keepId: a,
        mergeIds: [b],
        label: label("Anémie"),
      }),
    ).toMatchObject({ success: false, existing: { id: outsider } })
    expect(await entry(b)).toBeDefined()
  })

  it("refuse de fusionner une valeur invalide", async () => {
    const a = await objectiveIdFor(label("Toux chronique"))
    const invalid = await objectiveIdFor(label("--"), { needsFix: true })
    expect(
      await mergeObjectives({
        keepId: a,
        mergeIds: [invalid],
        label: label("Toux chronique"),
      }),
    ).toMatchObject({ success: false })
  })

  it("deux fusions simultanées sur la même entrée ne perdent aucune question", async () => {
    const k = await objectiveIdFor(label("Vertige"))
    const x = await objectiveIdFor(label("Vertiges"))
    const y = await objectiveIdFor(label("Vertige rotatoire"))
    const ids = [
      await newQuestion(k),
      await newQuestion(x),
      await newQuestion(x),
      await newQuestion(y),
    ]

    const results = await Promise.all([
      mergeObjectives({ keepId: k, mergeIds: [x], label: label("Vertige") }),
      mergeObjectives({ keepId: x, mergeIds: [y], label: label("Vertiges") }),
    ])
    expect(results.some((r) => r.success)).toBe(true)

    const rows = await rowsOf(ids)
    expect(rows).toHaveLength(4)
    const remaining = await db
      .select({ id: cmcObjectives.id })
      .from(cmcObjectives)
      .where(
        inArray(
          cmcObjectives.id,
          rows.map((r) => r.objectiveId),
        ),
      )
    expect(new Set(rows.map((r) => r.objectiveId)).size).toBe(remaining.length)
  })
})

describe("correction d'une valeur invalide", () => {
  it("ne change que l'objectif de la question, et l'entrée disparaît avec sa dernière question", async () => {
    const invalid = await objectiveIdFor(label("- "), { needsFix: true })
    const target = await objectiveIdFor(label("Hémoptysie"))
    const [q1, q2] = [await newQuestion(invalid), await newQuestion(invalid)]
    const before = await rowsOf([q1!, q2!])

    expect(
      await correctQuestionObjective({ questionId: q1!, objectiveId: target }),
    ).toEqual({ success: true, remaining: 1 })
    expect(await entry(invalid)).toBeDefined()
    expect(
      await correctQuestionObjective({ questionId: q2!, objectiveId: target }),
    ).toEqual({ success: true, remaining: 0 })

    const after = await rowsOf([q1!, q2!])
    expect(withoutObjective(after)).toEqual(withoutObjective(before))
    expect(after.map((r) => r.objectiveId)).toEqual([target, target])
    expect(await entry(invalid)).toBeUndefined()
  })

  it("refuse une cible à corriger et une question dont l'objectif est valide", async () => {
    const invalid = await objectiveIdFor(label("?"), { needsFix: true })
    const other = await objectiveIdFor(label("??"), { needsFix: true })
    const valid = await objectiveIdFor(label("Hypotension"))
    const q = await newQuestion(invalid)
    expect(
      await correctQuestionObjective({ questionId: q, objectiveId: other }),
    ).toEqual({
      success: false,
      error: "Choisissez un objectif du référentiel.",
    })

    const fine = await newQuestion(valid)
    expect(
      await correctQuestionObjective({ questionId: fine, objectiveId: valid }),
    ).toMatchObject({ success: false })
  })
})

describe("vitrine", () => {
  it("liste les objectifs des questions actives du domaine, du plus utilisé au moins utilisé, sans valeur invalide", async () => {
    const frequent = await objectiveIdFor(label("Palpitations"))
    const rare = await objectiveIdFor(label("Orthopnée"))
    const invalid = await objectiveIdFor(label("_"), { needsFix: true })
    const onlyDeleted = await objectiveIdFor(label("Œdème"))
    await newQuestion(frequent)
    await newQuestion(frequent)
    await newQuestion(rare)
    await newQuestion(invalid)
    await newQuestion(onlyDeleted, true)

    const objectives = (await getPublicDomainObjectives())[DOMAIN] ?? []
    expect(objectives.indexOf(label("Palpitations"))).toBeLessThan(
      objectives.indexOf(label("Orthopnée")),
    )
    expect(objectives).not.toContain(label("_"))
    expect(objectives).not.toContain(label("Œdème"))
  })
})
