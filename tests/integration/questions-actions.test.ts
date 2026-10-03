import { eq, inArray } from "drizzle-orm"
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
import {
  TEST_OBJECTIVE_ID,
  TEST_OBJECTIVE_LABEL,
  objectiveIdFor,
} from "../helpers/objective"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
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
const created: string[] = []

const base = {
  question: `Q ${suffix}`,
  options: ["A", "B", "C", "D"],
  correctAnswer: "A",
  explanation: "Exp",
  references: ["R1"],
  objectiveId: TEST_OBJECTIVE_ID,
  domain: "Autres" as const,
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
  it("crée la question + son explication, rattachée à son objectif", async () => {
    const id = await makeOne()
    const q = await getQuestionById(id)
    expect(q?.explanation).toBe("Exp")
    expect(q?.references).toEqual(["R1"])
    expect(q).toMatchObject({
      objectiveId: TEST_OBJECTIVE_ID,
      objectifCMC: TEST_OBJECTIVE_LABEL,
      objectiveNeedsFix: false,
    })
    // Copie lue par la version précédente (build, rollback).
    const [row] = await db
      .select({ objectifCmc: questions.objectifCmc })
      .from(questions)
      .where(eq(questions.id, id))
    expect(row?.objectifCmc).toBe(TEST_OBJECTIVE_LABEL)
  })

  it("refuse un objectif hors du référentiel ou à corriger", async () => {
    const toFix = await objectiveIdFor(`- ${suffix}`, { needsFix: true })
    for (const objectiveId of ["inconnu", toFix]) {
      expect(await createQuestion({ ...base, objectiveId })).toEqual({
        success: false,
        error: "Choisissez un objectif du référentiel.",
      })
    }
    const id = await makeOne()
    expect(await updateQuestion({ ...base, id, objectiveId: toFix })).toEqual({
      success: false,
      error: "Choisissez un objectif du référentiel.",
    })
  })

  it("refuse une bonne réponse hors des options", async () => {
    const res = await createQuestion({
      ...base,
      options: ["A", "B"],
      correctAnswer: "Z",
    })
    expect(res.success).toBe(false)
  })

  it("refuse deux options identiques, casse et espaces de bord ignorés", async () => {
    const question = `Doublon ${suffix}`
    const res = await createQuestion({
      ...base,
      question,
      options: ["A", "B", " b ", "C"],
    })
    expect(res).toMatchObject({ success: false })
    const page = await getQuestionsWithFilters({ search: question, limit: 10 })
    expect(page.items).toHaveLength(0)
  })

  it("refuse un domaine hors de la liste officielle", async () => {
    const res = await createQuestion({ ...base, domain: "Gastroentérologie" })
    expect(res.success).toBe(false)
    const page = await getQuestionsWithFilters({ search: suffix, limit: 100 })
    expect(page.items.map((q) => q.domain)).not.toContain("Gastroentérologie")
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

  it("garde le texte exact des options et de la clé : enregistrer ne reformule rien", async () => {
    const id = await makeOne()
    await db
      .update(questions)
      .set({ options: ["A ", "B	", "C", "D"], correctAnswer: "A " })
      .where(eq(questions.id, id))
    const res = await updateQuestion({
      ...base,
      id,
      options: ["A ", "B	", "C", "D"],
      correctAnswer: "A ",
      explanation: "Explication seule modifiée",
    })
    expect(res.success).toBe(true)
    const q = await getQuestionById(id)
    expect(q?.options).toEqual(["A ", "B	", "C", "D"])
    expect(q?.correctAnswer).toBe("A ")
  })

  it("refuse une option faite d'espaces", async () => {
    const id = await makeOne()
    const res = await updateQuestion({
      ...base,
      id,
      options: ["A", "B", "C", "  "],
    })
    expect(res.success).toBe(false)
  })

  it("refuse d'enregistrer des options en double", async () => {
    const id = await makeOne()
    const res = await updateQuestion({
      ...base,
      id,
      options: ["A", "B", "C", "a"],
    })
    expect(res.success).toBe(false)
    expect((await getQuestionById(id))?.options).toEqual(["A", "B", "C", "D"])
  })

  it("refuse de déplacer une question vers un domaine hors liste", async () => {
    const id = await makeOne()
    const res = await updateQuestion({ ...base, id, domain: "Cardio" })
    expect(res.success).toBe(false)
    expect((await getQuestionById(id))?.domain).toBe("Autres")
  })
})

describe("normalisation de la correction à l'enregistrement", () => {
  const BLOCK =
    "1.\nSource A.\nLancet. 2020.\n\n\n\n2.\nSource B.\nBMJ. 2021.   \n"

  it("applique la partie sûre sans jamais découper une référence", async () => {
    const res = await createQuestion({
      ...base,
      explanation:
        "Premier   point.\n[1]\n\n\n\nSecond point, la glycémie[2].\nMedical Council of Canada | Le Conseil médical du Canada | 29\nFin.",
      references: [BLOCK, "  Source C.  "],
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    created.push(res.id)

    const q = await getQuestionById(res.id)
    expect(q?.explanation).toBe(
      "Premier point. [1]\n\nSecond point, la glycémie [2].\nFin.",
    )
    expect(q?.references).toEqual([
      "1.\nSource A.\nLancet. 2020.\n\n2.\nSource B.\nBMJ. 2021.",
      "Source C.",
    ])
  })

  it("réenregistrer ce qui a été enregistré ne change plus rien", async () => {
    const nnbsp = "\u202f"
    const nbsp = "\u00a0"
    const dirty = {
      explanation: `  Paragraphe${nnbsp}:  un   point.\n[1]\n\n\n\nSuite${nbsp}!\tfin[2].  `,
      references: [
        `  Source A${nnbsp}: Lancet. 2020.  `,
        "Source B.\n\n\n\nBMJ. 2021.",
      ],
    }
    const id = await makeOne()
    await updateQuestion({ ...base, ...dirty, id })
    const first = await getQuestionById(id)
    expect(first?.explanation).not.toBe(dirty.explanation)
    expect(first?.explanation).toContain(`Paragraphe${nnbsp}:`)
    expect(first?.explanation).toContain(`Suite${nbsp}!`)

    const res = await updateQuestion({
      ...base,
      id,
      explanation: first!.explanation,
      references: first!.references ?? [],
    })
    expect(res.success).toBe(true)
    const second = await getQuestionById(id)
    expect(second?.explanation).toBe(first?.explanation)
    expect(second?.references).toEqual(first?.references)
  })

  it("refuse une explication ou une référence vides une fois mises en forme", async () => {
    const onlySpaces = await createQuestion({
      ...base,
      explanation: "\u202f \n\u00a0",
    })
    expect(onlySpaces).toEqual({
      success: false,
      error: "L'explication est requise",
    })
    const emptyReference = await createQuestion({
      ...base,
      references: [
        "Medical Council of Canada | Le Conseil médical du Canada | 29",
      ],
    })
    expect(emptyReference).toEqual({
      success: false,
      error: expect.stringMatching(/^Une référence est vide/),
    })
  })

  it("refuse une référence de plus de 2 000 caractères", async () => {
    const res = await createQuestion({
      ...base,
      references: ["x".repeat(2001)],
    })
    expect(res).toEqual({
      success: false,
      error: expect.stringMatching(/référence.*2 000 caractères/),
    })
  })

  it("refuse une explication au-delà du plafond", async () => {
    const res = await createQuestion({
      ...base,
      explanation: "x".repeat(20_001),
    })
    expect(res).toEqual({
      success: false,
      error: expect.stringMatching(/explication.*20 000 caractères/),
    })
  })
})

describe("deleteQuestion", () => {
  // La question créée ici n'est jamais référencée (examens/entraînements) →
  // l'hybride part en HARD delete. Le chemin SOFT (référencée) est couvert par
  // tests/integration/delete-question.test.ts.
  it("hard delete d'une question jamais référencée", async () => {
    const id = await makeOne()
    const res = await deleteQuestion(id)
    expect(res).toEqual({ success: true, mode: "hard" })

    expect(await getQuestionById(id)).toBeNull()
    const page = await getQuestionsWithFilters({ search: suffix, limit: 100 })
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
