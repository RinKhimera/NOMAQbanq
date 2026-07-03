import { describe, expect, it, vi } from "vitest"
import {
  assertSafeStoragePath,
  finalPathFromTmp,
  generateAvatarPath,
  generateQuestionImagePath,
  generateQuestionImageTmpPath,
  getExtensionFromMimeType,
  validateImageFile,
} from "@/lib/storage"

vi.mock("server-only", () => ({}))
// Évite de charger le SDK AWS dans ce test unitaire des helpers purs.
vi.mock("@/lib/aws", () => ({ deleteFromS3: vi.fn() }))
// `lib/storage` importe `env` (validé au chargement) ; on fournit un env factice
// pour ne pas exiger DATABASE_URL & co dans ce test unitaire frontend.
vi.mock("@/lib/env/server", () => ({
  env: {
    S3_REGION: "us-east-2",
    AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
    S3_BUCKET: "nomaq-media",
  },
}))

describe("path helpers", () => {
  it("génère un chemin d'image question préfixé", () => {
    expect(generateQuestionImagePath("q1", 2, ".PNG")).toMatch(
      /^questions\/q1\/\d+-2\.png$/,
    )
  })
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
  it("refuse un fichier trop volumineux", () => {
    expect(validateImageFile("image/png", 6 * 1024 * 1024)).toContain(
      "volumineux",
    )
  })
})
