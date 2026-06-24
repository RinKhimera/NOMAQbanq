import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
// Évite de charger le SDK AWS dans ce test unitaire des helpers purs.
vi.mock("@/lib/aws", () => ({ deleteFromS3: vi.fn() }))
// `lib/storage` importe `env` (validé au chargement) ; on fournit un env factice
// pour ne pas exiger DATABASE_URL & co dans ce test unitaire frontend.
vi.mock("@/lib/env/server", () => ({
  env: {
    AWS_REGION: "us-east-2",
    AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
    S3_BUCKET: "nomaq-media",
  },
}))

import {
  assertSafeStoragePath,
  avatarStoragePathFromUrl,
  generateAvatarPath,
  generateQuestionImagePath,
  getExtensionFromMimeType,
  validateImageFile,
} from "@/lib/storage"

describe("path helpers", () => {
  it("génère un chemin d'image question préfixé", () => {
    expect(generateQuestionImagePath("q1", 2, ".PNG")).toMatch(
      /^questions\/q1\/\d+-2\.png$/,
    )
  })
  it("génère un chemin d'avatar préfixé", () => {
    expect(generateAvatarPath("u1", "jpg")).toMatch(/^avatars\/u1\/\d+\.jpg$/)
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

describe("avatarStoragePathFromUrl", () => {
  it("renvoie le chemin pour notre CDN + préfixe avatars/", () => {
    expect(
      avatarStoragePathFromUrl("https://cdn.nomaqbanq.ca/avatars/u1/9.jpg"),
    ).toBe("avatars/u1/9.jpg")
  })
  it("renvoie null pour un hôte externe", () => {
    expect(
      avatarStoragePathFromUrl("https://lh3.googleusercontent.com/a/x"),
    ).toBeNull()
  })
  it("renvoie null hors préfixe avatars/", () => {
    expect(
      avatarStoragePathFromUrl("https://cdn.nomaqbanq.ca/questions/q/1.jpg"),
    ).toBeNull()
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
