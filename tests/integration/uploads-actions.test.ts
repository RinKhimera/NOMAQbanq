import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/db"
import {
  questionExplanations,
  questionImages,
  questions,
  uploadRateLimits,
  user,
} from "@/db/schema"
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
// Mock PARTIEL : garde les helpers purs (validation, génération de chemins,
// dérivation d'URL) RÉELS ; neutralise uniquement les I/O réseau Bunny.
vi.mock("@/lib/bunny", async (orig) => {
  const actual = await orig<typeof import("@/lib/bunny")>()
  return {
    ...actual,
    isBunnyConfigured: () => true,
    uploadToBunny: vi.fn(
      async (_data: ArrayBuffer | Uint8Array, storagePath: string) => ({
        success: true as const,
        url: `https://cdn.test.invalid/${storagePath}`,
        storagePath,
      }),
    ),
    tryDeleteFromBunny: vi.fn().mockResolvedValue(undefined),
  }
})

import { uploadQuestionImage } from "@/features/questions/actions"
import { uploadAvatar } from "@/features/users/actions"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { uploadToBunny } from "@/lib/bunny"

const jpeg = (name = "img.jpg") =>
  new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/jpeg" })

const userId = createId()
const adminId = createId()
const createdQuestions: string[] = []

const seedQuestion = async () => {
  const id = createId()
  await db.insert(questions).values({
    id,
    question: "Q upload",
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectifCmc: "Obj",
    domain: "UPLOAD_DOM",
  })
  createdQuestions.push(id)
  return id
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: userId, name: "Up User", email: `up-${userId}@test.invalid` },
    {
      id: adminId,
      name: "Up Admin",
      email: `upa-${adminId}@test.invalid`,
      role: "admin",
    },
  ])
})

afterAll(async () => {
  if (createdQuestions.length > 0) {
    await db
      .delete(questionImages)
      .where(inArray(questionImages.questionId, createdQuestions))
    await db
      .delete(questionExplanations)
      .where(inArray(questionExplanations.questionId, createdQuestions))
    await db.delete(questions).where(inArray(questions.id, createdQuestions))
  }
  await db
    .delete(uploadRateLimits)
    .where(inArray(uploadRateLimits.userId, [userId, adminId]))
  await db.delete(user).where(inArray(user.id, [userId, adminId]))
})

describe("uploadAvatar", () => {
  beforeAll(() => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: userId, role: "user" },
    } as never)
  })

  it("téléverse et met à jour user.image (chemin avatar dérivé serveur)", async () => {
    const fd = new FormData()
    fd.append("file", jpeg())
    const res = await uploadAvatar(fd)
    expect(res.success).toBe(true)
    if (res.success) expect(res.url).toContain(`avatars/${userId}/`)

    const [row] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    expect(row?.image).toContain(`avatars/${userId}/`)
  })

  it("refuse un type non-image avant tout upload", async () => {
    const fd = new FormData()
    fd.append(
      "file",
      new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" }),
    )
    const res = await uploadAvatar(fd)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("Format")
  })

  it("refuse un fichier manquant", async () => {
    const res = await uploadAvatar(new FormData())
    expect(res.success).toBe(false)
  })
})

describe("uploadQuestionImage", () => {
  beforeAll(() => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: adminId, role: "admin" },
    } as never)
  })

  it("téléverse vers un chemin lié au questionId existant", async () => {
    const qid = await seedQuestion()
    const fd = new FormData()
    fd.append("file", jpeg())
    fd.append("questionId", qid)
    fd.append("imageIndex", "0")

    const res = await uploadQuestionImage(fd)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.storagePath.startsWith(`questions/${qid}/`)).toBe(true)
    }
    expect(vi.mocked(uploadToBunny)).toHaveBeenCalled()
  })

  it("rejette un questionId malformé (anti path-traversal) sans toucher Bunny", async () => {
    vi.mocked(uploadToBunny).mockClear()
    const fd = new FormData()
    fd.append("file", jpeg())
    fd.append("questionId", "../../etc/passwd")

    const res = await uploadQuestionImage(fd)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("invalide")
    expect(vi.mocked(uploadToBunny)).not.toHaveBeenCalled()
  })

  it("rejette un questionId bien formé mais inexistant", async () => {
    const fd = new FormData()
    fd.append("file", jpeg())
    fd.append("questionId", createId())

    const res = await uploadQuestionImage(fd)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("introuvable")
  })
})
