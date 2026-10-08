import { asc, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import {
  addExamQuestions,
  deleteExam,
  finalizePreparedExam,
  previewExamCompletion,
  removeExamQuestions,
  saveExam,
} from "@/features/exams/actions"
import {
  getAdminExam,
  getEligibleSubscriberCount,
  getExamAudience,
  getExamFigures,
  getExamLeaderboard,
  getExamsOverview,
  getParticipantExamResults,
} from "@/features/exams/dal"
import {
  drawFromBank,
  getBankSupply,
  getDomainPlan,
  getExamBank,
  getExamSelection,
  getLastUses,
} from "@/features/questions/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedAnswers } from "../helpers/seed-answers"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const DOMAIN = "COMPO"
// Postérieurs aux examens datés d'aujourd'hui que créent certains tests : ce
// sont eux qui font les questions récentes (les trois derniers examens
// finalisés, par date d'ouverture), quel que soit l'ordre des tests.
const at = (days: number) => new Date(Date.UTC(2099, 0, 1) + days * DAY)

const ADMIN_ID = createId()
const STUDENTS = Array.from({ length: 4 }, () => createId())
const DELETED_ID = createId()
const BANNED_ID = createId()

// Anciennes (c), récentes (r), clés à vérifier (v).
const c = Array.from({ length: 5 }, () => createId())
const r = Array.from({ length: 3 }, () => createId())
const v = Array.from({ length: 2 }, () => createId())
// Banque d'un examen à jeu complet, hors du domaine du fichier.
const filler = Array.from({ length: 12 }, () => createId())

const asAdmin = () =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id: ADMIN_ID, role: "admin" } } as never)

const mkQuestion = (id: string, label: string, domain = DOMAIN) => ({
  id,
  question: `Compositeur ${label}`,
  correctAnswer: "A",
  options: ["A", "B", "C", "D"],
  objectiveId: TEST_OBJECTIVE_ID,
  domain,
})

/** Examen finalisé daté, inséré sans l'action (fixture de dernière utilisation). */
const mkExam = async (
  title: string,
  startDays: number | null,
  questionIds: string[],
  extra: Partial<typeof exams.$inferInsert> = {},
) => {
  const id = createId()
  await db.insert(exams).values({
    id,
    title,
    startDate: startDays === null ? null : at(startDays),
    endDate: startDays === null ? null : at(startDays + 4),
    completionTime: startDays === null ? null : questionIds.length * 83,
    finalizedAt: startDays === null ? null : new Date(),
    targetQuestionCount: Math.max(10, questionIds.length),
    createdBy: ADMIN_ID,
    ...extra,
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

const ids = {} as Record<
  "e1" | "e2Inactive" | "e3" | "e4" | "prep" | "full",
  string
>

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "Compo admin",
      email: "compo-adm@test.invalid",
      role: "admin",
    },
    ...STUDENTS.map((id, i) => ({
      id,
      name: `Compo étudiant ${i}`,
      email: `compo-stu-${i}@test.invalid`,
    })),
    {
      id: DELETED_ID,
      name: "Compo supprimé",
      email: "compo-del@test.invalid",
      deletedAt: new Date(),
    },
    {
      id: BANNED_ID,
      name: "Compo suspendu",
      email: "compo-ban@test.invalid",
      banned: true,
    },
  ])
  await db
    .insert(questions)
    .values([
      ...c.map((id, i) => mkQuestion(id, `ancienne ${i}`)),
      ...r.map((id, i) => mkQuestion(id, `récente ${i}`)),
      ...v.map((id, i) => mkQuestion(id, `clé à vérifier ${i}`)),
      ...filler.map((id, i) => mkQuestion(id, `jeu ${i}`, "FILL")),
    ])
  // Clé suspecte : B (6) plus choisie que la clé A (4), sur 10 réponses.
  for (const q of v)
    await seedAnswers(q, [...Array(4).fill("A"), ...Array(6).fill("B")])

  // Les trois derniers examens finalisés portent r0, r1 (désactivé), r2 ; le
  // quatrième porte c4 ; un examen en préparation plus récent porte c3.
  ids.e1 = await mkExam("E1", 30, [r[0]])
  ids.e2Inactive = await mkExam("E2", 20, [r[1]], { isActive: false })
  ids.e3 = await mkExam("E3", 10, [r[2]])
  ids.e4 = await mkExam("E4", 0, [c[4]])
  ids.prep = await mkExam("Préparation", null, [c[3]], { startDate: at(60) })
  // Examen clos à jeu complet, pour les chiffres et le classement.
  ids.full = await mkExam("Complet", -400, filler.slice(0, 10), {
    audienceType: "restricted",
  })
})

/** Examen en préparation, visé 10, composé des questions données. */
const prepared = async (questionIds: string[] = []) => {
  asAdmin()
  const res = await saveExam({
    title: "Composé",
    targetQuestionCount: 10,
    startDate: null,
    endDate: null,
    enablePause: false,
    audienceType: "subscribers",
    audienceUserIds: [],
    questionIds,
  })
  if (!res.success) throw new Error(res.error)
  return res.examId
}

const setOf = async (examId: string) =>
  (
    await db
      .select({ id: examQuestions.questionId })
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.position))
  ).map((q) => q.id)

describe("dernière utilisation", () => {
  it("l'examen le plus récent qui contient la question, désactivé compris, en préparation exclu", async () => {
    asAdmin()
    const uses = await getLastUses([r[1], c[3], c[4], c[0]])
    expect(uses.get(r[1])).toMatchObject({
      examId: ids.e2Inactive,
      recent: true,
    })
    // Seulement dans un examen en préparation : jamais utilisée.
    expect(uses.has(c[3])).toBe(false)
    // Quatrième examen le plus récent : utilisée, pas récente.
    expect(uses.get(c[4])).toMatchObject({ examId: ids.e4, recent: false })
    expect(uses.has(c[0])).toBe(false)
  })

  it("l'examen composé ne compte pas pour ses propres questions, même finalisé", async () => {
    asAdmin()
    const selection = await getExamSelection(ids.e1)
    expect(selection.find((q) => q.id === r[0])?.lastUse).toBeNull()
    // Sans lui, les trois derniers examens sont E2, E3 et E4 : c4 devient récente.
    expect((await getLastUses([c[4]], ids.e1)).get(c[4])?.recent).toBe(true)
    // Le plan suit la même fenêtre : r1, r2 et c4 sont les récentes disponibles.
    const plan = (await getDomainPlan(ids.e1)).find((p) => p.domain === DOMAIN)
    expect(plan?.recent).toBe(3)
  })

  it("le jeu d'une source de réouverture garde sa propre dernière utilisation", async () => {
    asAdmin()
    const [own] = await getExamSelection(ids.e1, { countSelf: true })
    expect(own?.lastUse).toMatchObject({ examId: ids.e1, recent: true })
  })

  it("filtre « pas utilisée depuis K examens » de la banque", async () => {
    const examId = await prepared()
    const bank = async (k: number) =>
      (
        await getExamBank(examId, {
          domain: DOMAIN,
          notUsedInLast: k,
          sortBy: "lastUse",
          page: 1,
        })
      ).items.map((q) => q.id)

    const three = await bank(3)
    expect(three).toEqual(expect.arrayContaining([c[4], c[3], c[0]]))
    expect(three).not.toEqual(expect.arrayContaining([r[0]]))
    expect(three.some((id) => r.includes(id))).toBe(false)
    expect(await bank(4)).not.toContain(c[4])
  })

  it("banque triée par dernière utilisation, jamais utilisées d'abord, hors du jeu", async () => {
    const examId = await prepared([c[0]])
    const { items, total } = await getExamBank(examId, {
      domain: DOMAIN,
      sortBy: "lastUse",
      page: 1,
    })
    const order = items.map((q) => q.id)
    expect(order).not.toContain(c[0])
    expect(total).toBe(c.length + r.length + v.length - 1)
    expect(order).toHaveLength(total)
    // c4 (dans E4) après toutes les jamais utilisées, r2 (E3) avant r0 (E1).
    expect(order.indexOf(c[4])).toBeGreaterThan(order.indexOf(c[1]))
    expect(order.indexOf(r[2])).toBeLessThan(order.indexOf(r[0]))
    expect(items.find((q) => q.id === r[0])?.lastUse).toMatchObject({
      examId: ids.e1,
      recent: true,
    })
    expect(items.find((q) => q.id === v[0])?.keyToVerify).toBe(true)
  })

  it("sélection et plan par domaine", async () => {
    const examId = await prepared([c[0], r[0]])
    const selection = await getExamSelection(examId)
    expect(selection.map((q) => q.id)).toEqual([c[0], r[0]])
    expect(selection[1].lastUse?.recent).toBe(true)

    const plan = (await getDomainPlan(examId)).find((p) => p.domain === DOMAIN)
    expect(plan).toEqual({
      domain: DOMAIN,
      chosen: 2,
      available: c.length + r.length + v.length - 2,
      recent: r.length - 1,
    })
  })
})

describe("question supprimée dans le jeu", () => {
  it("la sélection la signale, la banque ne la propose plus", async () => {
    const gone = createId()
    // Hors du domaine du fichier : elle n'entre dans aucun compte par domaine.
    await db.insert(questions).values(mkQuestion(gone, "supprimée", "GONE"))
    const examId = await prepared([c[0], gone])
    await db
      .update(questions)
      .set({ deletedAt: new Date() })
      .where(eq(questions.id, gone))
    const selection = await getExamSelection(examId)
    expect(Object.fromEntries(selection.map((q) => [q.id, q.deleted]))).toEqual(
      { [c[0]]: false, [gone]: true },
    )
    expect((await getAdminExam(examId))?.exam).toMatchObject({
      questionCount: 2,
      deletedQuestionCount: 1,
    })
    const item = (await getExamsOverview()).find((e) => e.id === examId)
    expect(item?.deletedQuestionCount).toBe(1)
  })
})

describe("complétion", () => {
  it("offre du domaine : anciennes et récentes tirables, clés à vérifier exclues", async () => {
    const examId = await prepared([c[0]])
    const supply = (await getBankSupply(examId)).find(
      (s) => s.domain === DOMAIN,
    )
    expect(supply).toEqual({
      domain: DOMAIN,
      available: c.length + r.length + v.length - 1,
      clean: c.length - 1,
      recent: r.length,
    })
  })

  it("tire les anciennes demandées puis les récentes en repli, jamais une clé à vérifier", async () => {
    const examId = await prepared([c[0]])
    const drawn = await drawFromBank(examId, [
      { domain: DOMAIN, clean: 10, fallback: 2 },
    ])
    const old = drawn.filter((q) => !q.recent).map((q) => q.id)
    const recent = drawn.filter((q) => q.recent).map((q) => q.id)
    // Plus d'anciennes demandées que disponibles : toutes, et rien d'autre.
    expect(old.sort()).toEqual(c.slice(1).sort())
    expect(recent).toHaveLength(2)
    expect(recent.every((id) => r.includes(id))).toBe(true)
    expect(drawn.some((q) => v.includes(q.id))).toBe(false)
  })

  it("l'aperçu propose exactement les places restantes, hors du jeu et sans clé à vérifier", async () => {
    const examId = await prepared([c[0], c[1]])
    asAdmin()
    const preview = await previewExamCompletion({ examId })
    if (!preview.success) throw new Error(preview.error)
    expect(preview.questionIds).toHaveLength(8)
    expect(new Set(preview.questionIds).size).toBe(8)
    expect(preview.questionIds).not.toContain(c[0])
    expect(preview.questionIds.some((id) => v.includes(id))).toBe(false)
    expect(preview.lines.reduce((n, l) => n + l.count, 0)).toBe(8)

    const applied = await addExamQuestions({
      examId,
      questionIds: preview.questionIds,
    })
    expect(applied).toEqual({ success: true, count: 10, finalized: false })
  })
})

describe("ajout et retrait", () => {
  it("ajoute à la suite, ignore les doublons, retire", async () => {
    const examId = await prepared([c[0]])
    asAdmin()
    expect(
      await addExamQuestions({ examId, questionIds: [c[1], c[0], c[1]] }),
    ).toMatchObject({ success: true, count: 2 })
    expect(await setOf(examId)).toEqual([c[0], c[1]])

    expect(
      await removeExamQuestions({ examId, questionIds: [c[0]] }),
    ).toMatchObject({ success: true, count: 1 })
    expect(await setOf(examId)).toEqual([c[1]])
  })

  it("refuse de dépasser le visé", async () => {
    const examId = await prepared(filler.slice(0, 10))
    asAdmin()
    const res = await addExamQuestions({ examId, questionIds: [c[0]] })
    expect(res).toMatchObject({
      success: false,
      fieldErrors: { questionIds: expect.stringContaining("10") },
    })
    expect(await setOf(examId)).toHaveLength(10)
  })

  it("un retrait reste permis sur un jeu plus grand que le visé (visé hérité à 0)", async () => {
    const examId = await prepared([c[0], c[1]])
    await db
      .update(exams)
      .set({ targetQuestionCount: 0 })
      .where(eq(exams.id, examId))
    asAdmin()
    expect(
      await removeExamQuestions({ examId, questionIds: [c[0]] }),
    ).toMatchObject({ success: true, count: 1 })
    expect(
      await addExamQuestions({ examId, questionIds: [c[2]] }),
    ).toMatchObject({ success: false })
  })

  it("un examen finalisé sans participation repasse en préparation", async () => {
    asAdmin()
    const examId = await prepared(filler.slice(0, 10))
    await saveExam({
      id: examId,
      title: "Composé",
      targetQuestionCount: 10,
      startDate: Date.now() - DAY,
      endDate: Date.now() + 7 * DAY,
      enablePause: false,
      audienceType: "subscribers",
      audienceUserIds: [],
    })
    expect(await finalizePreparedExam({ examId })).toEqual({ success: true })

    const res = await removeExamQuestions({ examId, questionIds: [filler[0]] })
    expect(res).toEqual({ success: true, count: 9, finalized: false })
    const [row] = await db
      .select({ finalizedAt: exams.finalizedAt })
      .from(exams)
      .where(eq(exams.id, examId))
    expect(row.finalizedAt).toBeNull()
  })

  it("refuse sur un examen figé par une participation", async () => {
    const examId = await prepared(filler.slice(0, 10))
    await db.insert(examParticipations).values({
      examId,
      userId: STUDENTS[0],
      status: "in_progress",
      startedAt: new Date(),
    })
    asAdmin()
    for (const res of [
      await addExamQuestions({ examId, questionIds: [c[0]] }),
      await removeExamQuestions({ examId, questionIds: [filler[0]] }),
    ]) {
      expect(res).toMatchObject({
        success: false,
        error: expect.stringContaining("participations"),
      })
    }
    expect(await setOf(examId)).toHaveLength(10)
  })
})

describe("suppression d'un examen", () => {
  it("refuse si des participations sont apparues depuis l'affichage", async () => {
    const examId = await prepared(filler.slice(0, 10))
    await db.insert(examParticipations).values({
      examId,
      userId: STUDENTS[0],
      status: "in_progress",
      startedAt: new Date(),
    })
    asAdmin()
    expect(
      await deleteExam({ examId, expectedParticipations: 0 }),
    ).toMatchObject({
      success: false,
      error: expect.stringContaining("rechargez"),
    })
    expect(
      await db.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)),
    ).toHaveLength(1)

    expect(await deleteExam({ examId, expectedParticipations: 1 })).toEqual({
      success: true,
    })
    expect(
      await db.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)),
    ).toHaveLength(0)
  })
})

describe("chiffres d'un examen et classement", () => {
  beforeAll(async () => {
    const done = (userId: string, score: number, status = "completed") => ({
      examId: ids.full,
      userId,
      score,
      status: status as "completed" | "auto_submitted" | "in_progress",
      startedAt: at(-400),
      completedAt: status === "in_progress" ? null : at(-399),
    })
    await db
      .insert(examParticipations)
      .values([
        done(STUDENTS[0], 70),
        done(STUDENTS[1], 51, "auto_submitted"),
        done(STUDENTS[2], 0, "in_progress"),
        done(ADMIN_ID, 100),
        done(DELETED_ID, 95),
      ])
    await db.insert(examAudience).values([
      { examId: ids.full, userId: STUDENTS[0] },
      { examId: ids.full, userId: STUDENTS[1] },
      { examId: ids.full, userId: DELETED_ID },
    ])
  })

  it("la liste d'un examen restreint se lit sans les comptes supprimés", async () => {
    asAdmin()
    const audience = (await getExamAudience(ids.full)).map((u) => u.id)
    expect(audience.sort()).toEqual([STUDENTS[0], STUDENTS[1]].sort())
  })

  it("comptés sur la population du classement : ni admin ni compte supprimé", async () => {
    asAdmin()
    expect(await getExamFigures(ids.full)).toEqual({
      started: 3,
      submitted: 2,
      autoSubmitted: 1,
      inProgress: 1,
      // (70 + 51) / 2 = 60,5 : au plancher.
      average: 60,
      best: 70,
      passed: 1,
      // Liste restreinte, compte supprimé exclu.
      eligible: 2,
      // Admin et compte supprimé compris.
      participations: 5,
      locked: true,
    })
    const item = (await getExamsOverview()).find((e) => e.id === ids.full)
    expect(item?.figures.submitted).toBe(2)
    expect(item?.questionCount).toBe(10)
  })

  it("jumeau : sans participation soumise, ni moyenne ni meilleur score (jamais 0)", async () => {
    asAdmin()
    expect(await getExamFigures(ids.e1)).toMatchObject({
      locked: false,
      submitted: 0,
      average: null,
      best: null,
      passed: 0,
    })
  })

  it("figé par la seule participation d'un admin, hors des chiffres", async () => {
    await db.insert(examParticipations).values({
      examId: ids.e3,
      userId: ADMIN_ID,
      status: "in_progress",
      startedAt: new Date(),
    })
    asAdmin()
    expect(await getExamFigures(ids.e3)).toMatchObject({
      started: 0,
      participations: 1,
      locked: true,
    })
  })

  it("éligibles d'un examen aux abonnés : accès actif, hors comptes supprimés ou suspendus", async () => {
    asAdmin()
    const expires = new Date(Date.now() + 30 * DAY)
    for (const userId of [STUDENTS[3], DELETED_ID, BANNED_ID])
      await seedAccess(userId, "exam", expires)
    // Seul STUDENTS[3] : les deux autres sont supprimé et suspendu.
    expect(await getEligibleSubscriberCount()).toBe(1)
    expect((await getExamFigures(ids.e1))?.eligible).toBe(1)
  })

  it("le classement et la copie disent si la soumission était automatique", async () => {
    asAdmin()
    const board = await getExamLeaderboard(ids.full)
    expect(
      Object.fromEntries(board.map((e) => [e.user?.id, e.status])),
    ).toMatchObject({
      [STUDENTS[0]]: "completed",
      [STUDENTS[1]]: "auto_submitted",
    })
    const copy = await getParticipantExamResults(ids.full, STUDENTS[1])
    expect(copy && "participant" in copy && copy.participant.status).toBe(
      "auto_submitted",
    )
  })
})
