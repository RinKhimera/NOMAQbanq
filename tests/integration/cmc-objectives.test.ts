import { eq, inArray, sql } from "drizzle-orm"
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
import { objectiveKey } from "@/features/objectives/label"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
import { objectiveIdFor } from "../helpers/objective"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/observability", () => ({ captureServerError: vi.fn() }))
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

/** Attend qu'une insertion dans le référentiel soit bloquée sur un verrou. */
const waitForInsertWaiter = async () => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const res = await db.execute(sql`
      select count(*)::int as n from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'
        and query ilike 'insert into "cmc_objectives"%'
    `)
    if ((res.rows[0] as { n: number }).n >= 1) return
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error("Aucune attente de verrou observée")
}

const entry = async (id: string) =>
  (await db.select().from(cmcObjectives).where(eq(cmcObjectives.id, id)))[0]

/** Tout sauf l'objectif : ce qu'une fusion ou une correction ne touche pas. */
const withoutObjective = (rows: Awaited<ReturnType<typeof rowsOf>>) =>
  rows.map((row) => ({
    ...row,
    objectiveId: undefined,
  }))

beforeAll(() => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)
})

afterAll(async () => {
  await db.delete(questions).where(inArray(questions.id, createdQuestions))
})

describe("création, renommage, garde et suppression", () => {
  it("crée un objectif revu ; refuse un libellé hors règles ou dont la clé double un objectif, en le proposant", async () => {
    const created = await createObjective({ label: `  ${label("Toux")}  ` })
    expect(created).toMatchObject({
      success: true,
      objective: { label: label("Toux") },
    })
    if (!created.success) return
    expect(await entry(created.objective.id)).toMatchObject({
      reviewedAt: expect.any(Date),
      normalizedKey: objectiveKey(label("Toux")),
    })

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
    expect(await entry(id)).toMatchObject({
      label: label("Fièvre"),
      normalizedKey: objectiveKey(label("Fièvre")),
    })
    expect(
      await renameObjective({ id, label: label("cephalee") }),
    ).toMatchObject({ success: false, existing: { id: other } })
  })

  it("« Garder tel quel » marque l'entrée revue, mais pas sous un libellé qui double un autre objectif", async () => {
    const alone = await objectiveIdFor(label("Ictère"))
    expect(await keepObjective({ id: alone })).toEqual({ success: true })
    expect((await entry(alone))?.reviewedAt).not.toBeNull()

    const retouched = await objectiveIdFor(label("ictere neonatal"))
    expect(
      await keepObjective({ id: retouched, label: label("Ictère néonatal") }),
    ).toEqual({ success: true })
    expect(await entry(retouched)).toMatchObject({
      label: label("Ictère néonatal"),
      normalizedKey: objectiveKey(label("Ictère néonatal")),
      reviewedAt: expect.any(Date),
    })

    // Jumeau : un libellé retouché qui double un autre objectif ne touche à rien.
    const other = await objectiveIdFor(label("Prurit anal"))
    const clashing = await objectiveIdFor(label("Prurit vulvaire"))
    expect(
      await keepObjective({ id: clashing, label: label("prurit anal") }),
    ).toMatchObject({ success: false, existing: { id: other } })
    expect(await entry(clashing)).toMatchObject({
      label: label("Prurit vulvaire"),
      reviewedAt: null,
    })
  })

  it("un doublon que seul l'index voit (écriture concurrente hors du verrou) est refusé de même, l'objectif existant proposé", async () => {
    const twinLabel = label("Hémoptysie massive")
    let commit!: () => void
    const committed = new Promise<void>((r) => (commit = r))
    let inserted!: (id: string) => void
    const isInserted = new Promise<string>((r) => (inserted = r))
    const holder = db.transaction(async (tx) => {
      const [row] = await tx
        .insert(cmcObjectives)
        .values({ label: twinLabel, normalizedKey: objectiveKey(twinLabel) })
        .returning({ id: cmcObjectives.id })
      inserted(row!.id)
      await committed
    })
    const twinId = await isInserted

    // La vérification d'usage ne voit pas la ligne non validée : l'insertion
    // attend la décision de l'index, puis échoue en 23505.
    const pending = createObjective({ label: label("hemoptysie massive") })
    await waitForInsertWaiter().finally(commit)
    await holder

    expect(await pending).toEqual({
      success: false,
      error: `L'objectif « ${twinLabel} » existe déjà : choisissez-le plutôt.`,
      existing: { id: twinId, label: twinLabel },
    })
    expect(captureServerError).not.toHaveBeenCalled()
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
    const variant = await objectiveIdFor(label("Douleurs abdominales aiguës"))
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
      normalizedKey: objectiveKey(label("Douleur abdominale aiguë")),
      reviewedAt: expect.any(Date),
    })
  })

  it("fusionne sous le libellé exact d'une entrée fusionnée : elle disparaît avant que l'entrée gardée le prenne", async () => {
    const keep = await objectiveIdFor(label("Céphalée de tension"))
    const merged = await objectiveIdFor(label("Céphalées de tension"))
    const q = await newQuestion(merged)

    expect(
      await mergeObjectives({
        keepId: keep,
        mergeIds: [merged],
        label: label("Céphalées de tension"),
      }),
    ).toEqual({ success: true, moved: 1 })

    expect(await entry(merged)).toBeUndefined()
    expect(await entry(keep)).toMatchObject({
      label: label("Céphalées de tension"),
      normalizedKey: objectiveKey(label("Céphalées de tension")),
    })
    expect((await rowsOf([q]))[0]?.objectiveId).toBe(keep)
  })

  it("refuse un libellé final qui double un objectif resté hors de la fusion", async () => {
    const a = await objectiveIdFor(label("Anémie ferriprive"))
    const b = await objectiveIdFor(label("Anémie par carence martiale"))
    const outsider = await objectiveIdFor(label("Anémie"))
    expect(
      await mergeObjectives({
        keepId: a,
        mergeIds: [b],
        label: label("anémie!"),
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

  it("deux fusions simultanées sur la même entrée : une issue sérialisée, aucune question perdue", async () => {
    const k = await objectiveIdFor(label("Vertige"))
    const x = await objectiveIdFor(label("Vertiges"))
    const y = await objectiveIdFor(label("Vertige rotatoire"))
    const ids = [
      await newQuestion(k),
      await newQuestion(x),
      await newQuestion(x),
      await newQuestion(y),
    ]

    const [xIntoK, yIntoX] = await Promise.all([
      mergeObjectives({ keepId: k, mergeIds: [x], label: label("Vertige") }),
      mergeObjectives({ keepId: x, mergeIds: [y], label: label("Vertiges") }),
    ])

    // X→K ne trouve jamais X absent : il réussit toujours. Y→X réussit s'il
    // passe le premier, sinon il voit X supprimé et refuse — jamais d'erreur
    // serveur, que produirait la clé étrangère sans les verrous.
    expect(xIntoK).toEqual({ success: true, moved: expect.any(Number) })
    const objectiveOf = new Map(
      (await rowsOf(ids)).map((r) => [r.id, r.objectiveId]),
    )
    const objectives = ids.map((id) => objectiveOf.get(id))
    const yFirst = { yIntoX: { success: true }, objectives: [k, k, k, k] }
    const xFirst = {
      yIntoX: {
        success: false,
        error: expect.stringMatching(/modifié entre-temps/),
      },
      objectives: [k, k, k, y],
    }
    expect({ yIntoX, objectives }).toMatchObject(
      yIntoX.success ? yFirst : xFirst,
    )
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
