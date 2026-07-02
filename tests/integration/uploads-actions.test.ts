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
import { createQuestionImageUpload } from "@/features/questions/actions"
import {
  confirmAvatarUpload,
  createAvatarUpload,
} from "@/features/users/actions"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { createPresignedUpload } from "@/lib/aws"
import { cdnUrl } from "@/lib/cdn"
import { createId } from "@/lib/ids"
import { tryDeleteFromStorage } from "@/lib/storage"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// Neutralise les I/O réseau S3 ; force la config présente. Les helpers purs de
// `@/lib/storage` (validation, génération de chemins, dérivation d'URL) restent
// RÉELS (mock partiel).
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(
    async (storagePath: string, contentType: string) => ({
      url: "https://s3.test.invalid/bucket",
      fields: { key: storagePath, "Content-Type": contentType },
    }),
  ),
  deleteFromS3: vi.fn().mockResolvedValue(true),
  copyInS3: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>()
  return {
    ...actual,
    isStorageConfigured: () => true,
    tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
  }
})

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

describe("createAvatarUpload + confirmAvatarUpload", () => {
  beforeAll(() => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: userId, role: "user" },
    } as never)
  })

  it("renvoie un presigned POST sur un chemin avatar dérivé serveur", async () => {
    const res = await createAvatarUpload({
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.storagePath).toMatch(new RegExp(`^avatars/${userId}/`))
      expect(res.fields["Content-Type"]).toBe("image/jpeg")
      expect(vi.mocked(createPresignedUpload)).toHaveBeenCalledWith(
        res.storagePath,
        "image/jpeg",
      )
    }
  })

  it("confirme et met à jour user.image (cdnUrl du chemin)", async () => {
    const created = await createAvatarUpload({
      contentType: "image/jpeg",
      size: 1000,
    })
    if (!created.success) throw new Error("setup")
    const res = await confirmAvatarUpload({ storagePath: created.storagePath })
    expect(res.success).toBe(true)

    const [row] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    // Via cdnUrl (pas de host hardcodé) : NEXT_PUBLIC_CDN_HOSTNAME varie par env
    // (CloudFront dev vs cdn.nomaqbanq.ca prod) et est hérité du .env.local.
    expect(row?.image).toBe(cdnUrl(created.storagePath))
  })

  it("refuse de confirmer le chemin d'un autre utilisateur", async () => {
    const res = await confirmAvatarUpload({
      storagePath: `avatars/${adminId}/123.jpg`,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("invalide")
  })

  it("supprime l'ancien avatar legacy (clé brute) au remplacement", async () => {
    const oldKey = `avatars/${userId}/111.jpg`
    await db.update(user).set({ image: oldKey }).where(eq(user.id, userId))
    vi.mocked(tryDeleteFromStorage).mockClear()

    const res = await confirmAvatarUpload({
      storagePath: `avatars/${userId}/222.jpg`,
    })
    expect(res.success).toBe(true)
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith(oldKey)
  })

  it("supprime l'ancien avatar de son préfixe quel que soit le host de l'URL", async () => {
    const oldKey = `avatars/${userId}/333.jpg`
    await db
      .update(user)
      .set({ image: `https://ancien-cdn.test.invalid/${oldKey}` })
      .where(eq(user.id, userId))
    vi.mocked(tryDeleteFromStorage).mockClear()

    const res = await confirmAvatarUpload({
      storagePath: `avatars/${userId}/444.jpg`,
    })
    expect(res.success).toBe(true)
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith(oldKey)
  })

  it("ne supprime JAMAIS un objet hors de son préfixe (user.image forgé)", async () => {
    // `user.image` est posable librement via l'endpoint Better Auth /update-user :
    // une valeur forgée `avatars/<tiers>/…` ne doit pas armer la suppression.
    await db
      .update(user)
      .set({ image: `avatars/${adminId}/555.jpg` })
      .where(eq(user.id, userId))
    vi.mocked(tryDeleteFromStorage).mockClear()

    const res = await confirmAvatarUpload({
      storagePath: `avatars/${userId}/666.jpg`,
    })
    expect(res.success).toBe(true)
    expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalled()
  })

  it("refuse un type non-image avant tout presign", async () => {
    const res = await createAvatarUpload({
      contentType: "application/pdf",
      size: 10,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("Format")
  })
})

describe("createQuestionImageUpload", () => {
  beforeAll(() => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: adminId, role: "admin" },
    } as never)
  })

  it("presign vers le TAMPON tmp/ lié au questionId existant (anti-orphelins)", async () => {
    const qid = await seedQuestion()
    const res = await createQuestionImageUpload({
      questionId: qid,
      imageIndex: 0,
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(true)
    if (res.success) {
      // L'upload vise `tmp/…` (copié vers `questions/…` au save), jamais
      // directement le vrai dossier.
      expect(res.storagePath.startsWith(`tmp/questions/${qid}/`)).toBe(true)
    }
    expect(vi.mocked(createPresignedUpload)).toHaveBeenCalled()
  })

  it("rejette un questionId malformé sans presign (anti path-traversal)", async () => {
    vi.mocked(createPresignedUpload).mockClear()
    const res = await createQuestionImageUpload({
      questionId: "../../etc/passwd",
      imageIndex: 0,
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("invalide")
    expect(vi.mocked(createPresignedUpload)).not.toHaveBeenCalled()
  })

  it("rejette un questionId bien formé mais inexistant", async () => {
    const res = await createQuestionImageUpload({
      questionId: createId(),
      imageIndex: 0,
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("introuvable")
  })
})
