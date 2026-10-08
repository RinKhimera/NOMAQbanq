import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteFromS3 } from "@/lib/aws"
import {
  assertSafeStoragePath,
  finalPathFromTmp,
  generateAvatarPath,
  generateQuestionImageTmpPath,
  getExtensionFromMimeType,
  isStorageConfigured,
  tryDeleteFromStorage,
  validateImageFile,
} from "@/lib/storage"

// `env` est validé une fois au chargement de `lib/env/server` : `vi.stubEnv` ne
// l'atteindrait plus. Le faux est un objet mutable, remis à zéro avant chaque test.
const { env } = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
}))

vi.mock("@/lib/aws", () => ({ deleteFromS3: vi.fn() }))
vi.mock("@/lib/env/server", () => ({ env }))

const OIDC = {
  S3_REGION: "us-east-2",
  S3_BUCKET: "nomaq-media",
  AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
}
const STATIC_KEYS = {
  S3_REGION: "us-east-2",
  S3_BUCKET: "nomaq-media",
  AWS_ACCESS_KEY_ID: "AKIA-test",
  AWS_SECRET_ACCESS_KEY: "secret-test",
}

const setEnv = (values: Record<string, string>) => {
  for (const key of Object.keys(env)) delete env[key]
  Object.assign(env, values)
}

beforeEach(() => setEnv(OIDC))

describe("isStorageConfigured", () => {
  it("vrai avec un rôle OIDC, sans clés statiques", () => {
    expect(isStorageConfigured()).toBe(true)
  })

  it("vrai avec les deux clés statiques, sans rôle", () => {
    setEnv(STATIC_KEYS)
    expect(isStorageConfigured()).toBe(true)
  })

  it.each([
    [
      "une clé statique sans son secret",
      { ...STATIC_KEYS, AWS_SECRET_ACCESS_KEY: "" },
    ],
    ["un secret sans sa clé", { ...STATIC_KEYS, AWS_ACCESS_KEY_ID: "" }],
    ["un rôle sans bucket", { ...OIDC, S3_BUCKET: "" }],
    ["un rôle sans région", { ...OIDC, S3_REGION: "" }],
    ["aucune variable", {}],
  ])("faux avec %s", (_, values) => {
    setEnv(values)
    expect(isStorageConfigured()).toBe(false)
  })
})

describe("tryDeleteFromStorage", () => {
  it("S3 non configuré : aucun appel S3, aucune erreur journalisée", async () => {
    setEnv({})
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    await tryDeleteFromStorage("avatars/u1/1.jpg")
    expect(deleteFromS3).not.toHaveBeenCalled()
    expect(logged).not.toHaveBeenCalled()
  })

  it("S3 configuré : supprime le chemin", async () => {
    await tryDeleteFromStorage("avatars/u1/1.jpg")
    expect(deleteFromS3).toHaveBeenCalledWith("avatars/u1/1.jpg")
  })

  it("chemin non sûr : journalisé, aucun appel S3, ne lève pas", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(tryDeleteFromStorage("../secrets")).resolves.toBeUndefined()
    expect(deleteFromS3).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalledWith(
      "S3 delete (best-effort) error:",
      expect.objectContaining({ message: "storagePath invalide: ../secrets" }),
    )
  })

  it("échec S3 : journalisé, ne lève pas", async () => {
    const failure = new Error("réseau")
    vi.mocked(deleteFromS3).mockRejectedValueOnce(failure)
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(
      tryDeleteFromStorage("avatars/u1/1.jpg"),
    ).resolves.toBeUndefined()
    expect(logged).toHaveBeenCalledWith(
      "S3 delete (best-effort) error:",
      failure,
    )
  })
})

describe("path helpers", () => {
  it("génère un chemin d'avatar préfixé", () => {
    expect(generateAvatarPath("u1", "jpg")).toMatch(/^avatars\/u1\/\d+\.jpg$/)
  })
  it("génère un chemin TAMPON tmp/ pour image question (namespacé par kind)", () => {
    expect(generateQuestionImageTmpPath("q1", "statement", 2, ".PNG")).toMatch(
      /^tmp\/questions\/q1\/statement\/\d+-2\.png$/,
    )
    expect(generateQuestionImageTmpPath("q1", "explanation", 0, "jpg")).toMatch(
      /^tmp\/questions\/q1\/explanation\/\d+-0\.jpg$/,
    )
  })
  it("dérive le chemin final en retirant le préfixe tmp/", () => {
    expect(finalPathFromTmp("tmp/questions/q1/123-0.png")).toBe(
      "questions/q1/123-0.png",
    )
  })
  it("finalPathFromTmp est idempotent sur un chemin déjà final", () => {
    expect(finalPathFromTmp("questions/q1/123-0.png")).toBe(
      "questions/q1/123-0.png",
    )
  })
  it("le chemin tampon reste sûr (assertSafeStoragePath)", () => {
    expect(() =>
      assertSafeStoragePath(
        generateQuestionImageTmpPath("q1", "statement", 0, "jpg"),
      ),
    ).not.toThrow()
  })
  it("mappe le MIME vers l'extension", () => {
    expect(getExtensionFromMimeType("image/webp")).toBe("webp")
    expect(getExtensionFromMimeType("application/pdf")).toBe("jpg")
  })
})

describe("assertSafeStoragePath", () => {
  it("rejette le path traversal", () => {
    expect(() => assertSafeStoragePath("../x")).toThrow()
    expect(() => assertSafeStoragePath("/abs")).toThrow()
    expect(() => assertSafeStoragePath("a//b")).toThrow()
  })
  it("rejette une espace ou un caractère de contrôle", () => {
    expect(() => assertSafeStoragePath("avatars/u1/a b.jpg")).toThrow()
    expect(() => assertSafeStoragePath("avatars/u1/a\nb.jpg")).toThrow()
  })
  it("accepte un chemin légitime", () => {
    expect(() => assertSafeStoragePath("avatars/u1/123.jpg")).not.toThrow()
  })
})

describe("validateImageFile", () => {
  it("accepte un JPEG valide", () => {
    expect(validateImageFile("image/jpeg", 1000)).toBeNull()
  })
  it("refuse un type non supporté", () => {
    expect(validateImageFile("application/pdf", 1000)).toContain("Format")
  })
  it("refuse un fichier vide", () => {
    expect(validateImageFile("image/png", 0)).toBe("Fichier vide.")
  })
  it("refuse un fichier trop volumineux", () => {
    expect(validateImageFile("image/png", 6 * 1024 * 1024)).toContain(
      "volumineux",
    )
  })
})
