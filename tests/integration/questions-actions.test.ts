import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/db"
import { questionExplanations, questionImages, questions } from "@/db/schema"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// Évite tout appel réseau S3 ; `setQuestionImages` doit déléguer la suppression
// CDN des chemins retirés à `tryDeleteFromStorage`.
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(),
  deleteFromS3: vi.fn(),
}))
vi.mock("@/lib/storage", () => ({
  tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
}))

import {
  createQuestion,
  deleteQuestion,
  setQuestionImages,
  updateQuestion,
} from "@/features/questions/actions"
import {
  getQuestionById,
  getQuestionsWithFilters,
} from "@/features/questions/dal"
import { requireRole } from "@/lib/auth-guards"
import { tryDeleteFromStorage } from "@/lib/storage"

const suffix = createId().slice(0, 8)
const DOMAIN = `ADOM-${suffix}`
const created: string[] = []

const base = {
  question: `Q ${suffix}`,
  options: ["A", "B", "C", "D"],
  correctAnswer: "A",
  explanation: "Exp",
  references: ["R1"],
  objectifCMC: "obj test",
  domain: DOMAIN,
}

const makeOne = async () => {
  const res = await createQuestion({ ...base })
  if (!res.success) throw new Error("seed create failed")
  created.push(res.id)
  return res.id
}

beforeAll(() => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)
})

afterAll(async () => {
  if (created.length === 0) return
  await db
    .delete(questionImages)
    .where(inArray(questionImages.questionId, created))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, created))
  await db.delete(questions).where(inArray(questions.id, created))
})

describe("createQuestion", () => {
  it("crée la question + son explication ; normalise l'objectif CMC", async () => {
    const id = await makeOne()
    const q = await getQuestionById(id)
    expect(q?.explanation).toBe("Exp")
    expect(q?.references).toEqual(["R1"])
    expect(q?.objectifCMC).toBe("Obj test") // normalizeObjectifCMC : majuscule initiale
  })

  it("refuse une bonne réponse hors des options", async () => {
    const res = await createQuestion({
      ...base,
      options: ["A", "B"],
      correctAnswer: "Z",
    })
    expect(res.success).toBe(false)
  })
})

describe("updateQuestion", () => {
  it("met à jour les champs + upsert de l'explication", async () => {
    const id = await makeOne()
    const res = await updateQuestion({
      ...base,
      id,
      explanation: "Nouvelle explication",
      correctAnswer: "B",
    })
    expect(res.success).toBe(true)
    const q = await getQuestionById(id)
    expect(q?.explanation).toBe("Nouvelle explication")
    expect(q?.correctAnswer).toBe("B")
  })
})

describe("deleteQuestion (soft)", () => {
  it("masque la question des reads mais conserve la ligne", async () => {
    const id = await makeOne()
    const res = await deleteQuestion(id)
    expect(res.success).toBe(true)

    expect(await getQuestionById(id)).toBeNull()
    const page = await getQuestionsWithFilters({ domain: DOMAIN, limit: 100 })
    expect(page.items.map((q) => q.id)).not.toContain(id)
  })
})

describe("setQuestionImages", () => {
  it("remplace l'ensemble des images (positions)", async () => {
    const id = await makeOne()

    const r1 = await setQuestionImages({
      questionId: id,
      images: [
        { storagePath: "a.jpg", order: 0 },
        { storagePath: "b.jpg", order: 1 },
      ],
    })
    expect(r1.success).toBe(true)
    let q = await getQuestionById(id)
    expect(q?.images.map((i) => i.storagePath)).toEqual(["a.jpg", "b.jpg"])

    // Remplacement par un seul fichier → l'ancien "a.jpg" disparaît.
    vi.mocked(tryDeleteFromStorage).mockClear()
    const r2 = await setQuestionImages({
      questionId: id,
      images: [{ storagePath: "b.jpg", order: 0 }],
    })
    expect(r2.success).toBe(true)
    q = await getQuestionById(id)
    expect(q?.images.map((i) => i.storagePath)).toEqual(["b.jpg"])
    // Le chemin retiré ("a.jpg") est supprimé du CDN ; "b.jpg" (conservé) non.
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith("a.jpg")
    expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalledWith("b.jpg")
  })
})
