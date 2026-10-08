import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionExplanations,
  questions,
  user,
} from "@/db/schema"
import {
  getQuestionExams,
  getQuestionList,
  getQuestionNeighbors,
  getQuestionTabCounts,
  getQuestionsForExport,
} from "@/features/questions/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { objectiveIdFor } from "../helpers/objective"
import { seedAnswers } from "../helpers/seed-answers"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DOMAIN = "Domaine liste"
const DAY = 24 * 60 * 60 * 1000
const at = (days: number) => new Date(Date.UTC(2026, 0, 1) + days * DAY)

const ids = {
  old: createId(), // références vides, la plus ancienne
  mid: createId(), // références remplies, clé suspecte (12 réponses)
  recent: createId(), // sans ligne d'explication, 3 réponses
  newest: createId(), // références remplies, choix « Pénicilline G »
}
const creatorId = createId()

const mkQuestion = async (
  id: string,
  label: string,
  days: number,
  options = ["A", "B", "C", "D"],
  objective = "Toux",
) =>
  db.insert(questions).values({
    id,
    question: `Énoncé ${label}`,
    correctAnswer: options[0],
    options,
    objectiveId: await objectiveIdFor(objective),
    domain: DOMAIN,
    createdAt: at(days),
    updatedAt: at(days + 100 - days * 2),
  })

const mkExam = async (
  title: string,
  startDays: number,
  questionIds: string[],
) => {
  const id = createId()
  await db.insert(exams).values({
    id,
    title,
    startDate: at(startDays),
    endDate: at(startDays + 4),
    completionTime: 3600,
    createdBy: creatorId,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  if (questionIds.length)
    await db.insert(examQuestions).values(
      questionIds.map((questionId, position) => ({
        examId: id,
        questionId,
        position,
      })),
    )
  return id
}

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)

  await mkQuestion(ids.old, "ancienne", 1)
  await mkQuestion(ids.mid, "milieu", 2, ["A", "B", "C", "D"], "Dyspnée")
  await mkQuestion(ids.recent, "récente", 3)
  await mkQuestion(ids.newest, "nouvelle", 4, [
    "Amoxicilline",
    "Pénicilline G",
    "Céfazoline",
    "Vancomycine",
  ])
  await db.insert(questionExplanations).values([
    { questionId: ids.old, explanation: "E", references: [] },
    { questionId: ids.mid, explanation: "E", references: ["R1"] },
    { questionId: ids.newest, explanation: "E", references: ["R1", "R2"] },
  ])

  // Clé suspecte : B (7) plus choisie que la clé A (5), sur 12 réponses.
  await seedAnswers(ids.mid, [...Array(5).fill("A"), ...Array(7).fill("B")])
  await seedAnswers(ids.recent, ["A", "A", "B"])
  await db.insert(user).values({
    id: creatorId,
    name: "Créateur",
    email: "createur@test.invalid",
    role: "admin",
  })
})

const listIds = async (filters: Parameters<typeof getQuestionList>[0]) =>
  (await getQuestionList({ domain: DOMAIN, limit: 20, ...filters })).items.map(
    (q) => q.id,
  )

describe("liste des questions : filtres et compteurs", () => {
  it("« Sans références » : tableau vide ou explication absente", async () => {
    expect(await listIds({ noReferences: true })).toEqual([ids.recent, ids.old])
  })

  it("l'export reprend le filtre « Sans références »", async () => {
    const rows = await getQuestionsForExport({
      domain: DOMAIN,
      noReferences: true,
    })
    expect(rows.map((r) => r.id).sort()).toEqual([ids.old, ids.recent].sort())
  })

  it("compteurs des onglets, en un passage, sur les filtres en cours", async () => {
    expect(await getQuestionTabCounts({ domain: DOMAIN })).toEqual({
      all: 4,
      toVerify: 1,
      noReferences: 2,
    })
    expect(
      await getQuestionTabCounts({
        domain: DOMAIN,
        objective: await objectiveIdFor("Dyspnée"),
      }),
    ).toEqual({ all: 1, toVerify: 1, noReferences: 0 })
  })

  it("le total de la page est le compteur de l'onglet courant", async () => {
    const page = await getQuestionList({ domain: DOMAIN, toVerify: true })
    expect(page.total).toBe(1)
    expect(page.items.map((q) => q.id)).toEqual([ids.mid])
    expect(page.items[0]).toMatchObject({ keyToVerify: true, answerCount: 12 })
    expect(page.counts.all).toBe(4)
  })

  it("recherche sur le texte d'un choix de réponse", async () => {
    expect(await listIds({ search: "pénicilline" })).toEqual([ids.newest])
  })

  it("jumeau : une recherche ne chevauche pas deux choix", async () => {
    expect(await listIds({ search: 'Amoxicilline", "' })).toEqual([])
    expect(await listIds({ search: "line G" })).toEqual([ids.newest])
  })

  it("recherche par identifiant exact, pas par fragment", async () => {
    expect(await listIds({ search: ids.mid })).toEqual([ids.mid])
    expect(await listIds({ search: ids.mid.slice(0, 8) })).toEqual([])
  })

  it("filtre par objectif", async () => {
    expect(
      await listIds({ objective: await objectiveIdFor("Dyspnée") }),
    ).toEqual([ids.mid])
  })
})

describe("liste des questions : tris", () => {
  it("par nombre de réponses, le plus grand d'abord ; sans réponse en dernier", async () => {
    const order = await listIds({ sortBy: "answerCount", sortOrder: "desc" })
    expect(order.slice(0, 2)).toEqual([ids.mid, ids.recent])
  })

  it("par nombre de réponses croissant", async () => {
    const order = await listIds({ sortBy: "answerCount", sortOrder: "asc" })
    expect(order.slice(-2)).toEqual([ids.recent, ids.mid])
  })

  it("par modification, indépendante de la création", async () => {
    // updatedAt décroît quand createdAt croît (seed) : l'ordre s'inverse.
    expect(await listIds({ sortBy: "updatedAt", sortOrder: "desc" })).toEqual([
      ids.old,
      ids.mid,
      ids.recent,
      ids.newest,
    ])
    expect(await listIds({})).toEqual([
      ids.newest,
      ids.recent,
      ids.mid,
      ids.old,
    ])
  })
})

describe("voisins précédent / suivant", () => {
  it("position et voisines dans la liste filtrée et triée", async () => {
    expect(await getQuestionNeighbors(ids.recent, { domain: DOMAIN })).toEqual({
      position: 2,
      total: 4,
      previousId: ids.newest,
      nextId: ids.mid,
    })
  })

  it("aux bords, pas de voisine", async () => {
    expect(
      await getQuestionNeighbors(ids.newest, { domain: DOMAIN }),
    ).toMatchObject({ position: 1, previousId: null, nextId: ids.recent })
  })

  it("suit le filtre de l'onglet et un tri par statistiques", async () => {
    expect(
      await getQuestionNeighbors(ids.old, {
        domain: DOMAIN,
        noReferences: true,
        sortBy: "answerCount",
      }),
    ).toEqual({
      position: 2,
      total: 2,
      previousId: ids.recent,
      nextId: null,
    })
  })

  it("une question hors de la liste filtrée n'a pas de place", async () => {
    expect(
      await getQuestionNeighbors(ids.mid, {
        domain: DOMAIN,
        noReferences: true,
      }),
    ).toBeNull()
  })
})

describe("examens d'une question et dernière utilisation", () => {
  let recentExams: string[] = []

  beforeAll(async () => {
    recentExams = [
      await mkExam("Récent 1", 10, [ids.mid]),
      await mkExam("Récent 2", 20, [ids.mid, ids.newest]),
      await mkExam("Récent 3", 30, []),
    ]
    await mkExam("Ancien", 0, [ids.old])
  })

  it("titre, fenêtre et activation, du plus récent au plus ancien", async () => {
    const used = await getQuestionExams(ids.mid)
    expect(used.map((e) => e.id)).toEqual([recentExams[1], recentExams[0]])
    expect(used[0]).toMatchObject({
      title: "Récent 2",
      isActive: true,
      startDate: at(20).getTime(),
      endDate: at(24).getTime(),
    })
  })

  it("« pas utilisée depuis N examens » écarte les questions des N derniers", async () => {
    // Le plus récent (« Récent 3 ») ne contient rien.
    expect(await listIds({ notUsedInLast: 1 })).toHaveLength(4)
    expect((await listIds({ notUsedInLast: 2 })).sort()).toEqual(
      [ids.old, ids.recent].sort(),
    )
    expect((await listIds({ notUsedInLast: 3 })).sort()).toEqual(
      [ids.old, ids.recent].sort(),
    )
  })
})
