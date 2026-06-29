import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { questionExplanations, questionImages, questions } from "@/db/schema"
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
import { copyInS3 } from "@/lib/aws"
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
// Évite tout appel réseau S3 ; `setQuestionImages` doit copier `tmp/`→`questions/`
// via `copyInS3` et déléguer la suppression des chemins retirés/tmp à
// `tryDeleteFromStorage`.
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(),
  deleteFromS3: vi.fn(),
  copyInS3: vi.fn().mockResolvedValue(undefined),
}))
// Mock PARTIEL : on neutralise seulement `tryDeleteFromStorage` (best-effort) ;
// les helpers purs (`finalPathFromTmp`, `assertSafeStoragePath`) restent RÉELS.
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>()
  return {
    ...actual,
    tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
  }
})

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
    // Chemins réalistes : une image conservée porte toujours le préfixe de SA
    // question ET de son `kind` (`questions/{id}/statement/…`) — la garde de
    // préfixe le requiert depuis la namespacing par kind (défaut statement).
    const a = `questions/${id}/statement/a.jpg`
    const b = `questions/${id}/statement/b.jpg`

    const r1 = await setQuestionImages({
      questionId: id,
      images: [
        { storagePath: a, order: 0 },
        { storagePath: b, order: 1 },
      ],
    })
    expect(r1.success).toBe(true)
    let q = await getQuestionById(id)
    expect(q?.images.map((i) => i.storagePath)).toEqual([a, b])

    // Remplacement par un seul fichier → l'ancien a.jpg disparaît.
    vi.mocked(tryDeleteFromStorage).mockClear()
    const r2 = await setQuestionImages({
      questionId: id,
      images: [{ storagePath: b, order: 0 }],
    })
    expect(r2.success).toBe(true)
    q = await getQuestionById(id)
    expect(q?.images.map((i) => i.storagePath)).toEqual([b])
    // Le chemin retiré (a) est supprimé du CDN ; b (conservé) non.
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith(a)
    expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalledWith(b)
  })

  it("copie tmp/ → questions/ au save, persiste le chemin FINAL, nettoie le tmp", async () => {
    const id = await makeOne()
    vi.mocked(copyInS3).mockClear()
    vi.mocked(tryDeleteFromStorage).mockClear()

    const tmpPath = `tmp/questions/${id}/statement/1700000000000-0.jpg`
    const finalPath = `questions/${id}/statement/1700000000000-0.jpg`

    const res = await setQuestionImages({
      questionId: id,
      images: [{ storagePath: tmpPath, order: 0 }],
    })
    expect(res.success).toBe(true)

    // L'objet est copié du tampon vers son chemin final.
    expect(vi.mocked(copyInS3)).toHaveBeenCalledWith(tmpPath, finalPath)

    // C'est le chemin FINAL (et non le tmp/) qui est persisté.
    const q = await getQuestionById(id)
    expect(q?.images.map((i) => i.storagePath)).toEqual([finalPath])

    // La source tmp/ est nettoyée best-effort après commit (la Lifecycle reste
    // le filet de sécurité).
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith(tmpPath)
  })

  it("ne copie PAS une image déjà finale (préfixe questions/)", async () => {
    const id = await makeOne()
    vi.mocked(copyInS3).mockClear()

    const res = await setQuestionImages({
      questionId: id,
      images: [
        { storagePath: `questions/${id}/statement/already.jpg`, order: 0 },
      ],
    })
    expect(res.success).toBe(true)
    expect(vi.mocked(copyInS3)).not.toHaveBeenCalled()
    const q = await getQuestionById(id)
    expect(q?.images.map((i) => i.storagePath)).toEqual([
      `questions/${id}/statement/already.jpg`,
    ])
  })

  it("rejette un storagePath final hors du préfixe de la question (F2)", async () => {
    const id = await makeOne()
    const other = await makeOne()
    vi.mocked(copyInS3).mockClear()
    vi.mocked(tryDeleteFromStorage).mockClear()

    // Chemin étranger BIEN FORMÉ : appartient à une AUTRE question. Sans garde, il
    // serait stocké puis supprimé du CDN à l'édition suivante (suppression croisée).
    const res = await setQuestionImages({
      questionId: id,
      images: [{ storagePath: `questions/${other}/statement/x.jpg`, order: 0 }],
    })
    expect(res.success).toBe(false)
    // Aucune I/O S3 ne doit avoir lieu (ni copie, ni suppression).
    expect(vi.mocked(copyInS3)).not.toHaveBeenCalled()
    expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalled()
    // La question reste sans image (rien n'a été persisté).
    const q = await getQuestionById(id)
    expect(q?.images).toEqual([])
  })

  it("copie OK mais écriture DB en échec → nettoie les finaux copiés, pas d'orphelin (F4)", async () => {
    // Question inexistante : la transaction lève `Q_NOT_FOUND` APRÈS la copie
    // tmp/ → final. Le final déjà copié DOIT alors être supprimé (sinon orphelin
    // dans `questions/`). C'est le cœur de la garantie anti-orphelin sur l'échec DB.
    const ghost = createId()
    vi.mocked(copyInS3).mockClear()
    vi.mocked(tryDeleteFromStorage).mockClear()

    const tmpPath = `tmp/questions/${ghost}/statement/1700000000000-0.jpg`
    const finalPath = `questions/${ghost}/statement/1700000000000-0.jpg`

    const res = await setQuestionImages({
      questionId: ghost,
      images: [{ storagePath: tmpPath, order: 0 }],
    })
    expect(res.success).toBe(false)
    // La copie a bien eu lieu (avant l'écriture DB)…
    expect(vi.mocked(copyInS3)).toHaveBeenCalledWith(tmpPath, finalPath)
    // …puis le final copié est nettoyé, l'écriture DB ayant échoué.
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith(finalPath)
  })

  it("rejette un storagePath malformé (path traversal) sans aucune I/O S3 (F4)", async () => {
    const id = await makeOne()
    vi.mocked(copyInS3).mockClear()
    vi.mocked(tryDeleteFromStorage).mockClear()

    const res = await setQuestionImages({
      questionId: id,
      images: [{ storagePath: `questions/${id}/../../etc/passwd`, order: 0 }],
    })
    expect(res.success).toBe(false)
    expect(vi.mocked(copyInS3)).not.toHaveBeenCalled()
    expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalled()
  })
})
