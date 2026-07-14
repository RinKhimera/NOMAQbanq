import { beforeEach, describe, expect, it, vi } from "vitest"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    limitFn: vi.fn<() => Promise<unknown[]>>(async () => []),
    updateWhere: vi.fn<() => Promise<unknown>>(async () => undefined),
    setPassword: vi.fn<() => Promise<unknown>>(async () => undefined),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: mocks.limitFn }) }),
    }),
    update: () => ({ set: () => ({ where: mocks.updateWhere }) }),
  },
}))
vi.mock("@/db/schema", () => ({ user: {}, session: {} }))
vi.mock("@/features/users/dal", () => ({}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { setPassword: mocks.setPassword } },
}))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "u1", role: "user" } })),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/aws", () => ({ createPresignedUpload: vi.fn() }))
vi.mock("@/lib/cdn", () => ({
  cdnUrl: (p: string) => p,
  avatarStoragePathFromImageValue: () => null,
}))
vi.mock("@/lib/storage", () => ({
  generateAvatarPath: vi.fn(),
  getExtensionFromMimeType: vi.fn(),
  isStorageConfigured: () => false,
  tryDeleteFromStorage: vi.fn(),
  validateImageFile: vi.fn(),
}))
vi.mock("@/lib/upload-rate-limit", () => ({ consumeUploadRateLimit: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

import { setAccountPassword, updateProfile } from "@/features/users/actions"

const VALID = { name: "Sam", username: "sam_p", bio: "" }

beforeEach(() => {
  mocks.captureServerError.mockClear()
  mocks.limitFn.mockResolvedValue([])
})

describe("updateProfile — catch fallback", () => {
  it("23505 enveloppé (course post pré-check) → « déjà pris », PAS de capture Sentry", async () => {
    mocks.updateWhere.mockRejectedValueOnce(
      Object.assign(new Error("query failed"), { cause: { code: "23505" } }),
    )
    const res = await updateProfile(VALID)
    expect(res).toEqual({
      success: false,
      error: "Ce nom d'utilisateur est déjà pris !",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → message neutre + captureServerError(tag, err, userId)", async () => {
    const boom = new Error("connexion perdue")
    mocks.updateWhere.mockRejectedValueOnce(boom)
    const res = await updateProfile(VALID)
    expect(res).toEqual({ success: false, error: "Erreur serveur. Réessayez." })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[updateProfile]",
      boom,
      { userId: "u1" },
    )
  })
})

describe("setAccountPassword — catch filtré APIError", () => {
  it("APIError Better Auth (métier) → message, PAS de capture", async () => {
    const { APIError } = await import("better-auth/api")
    mocks.setPassword.mockRejectedValueOnce(
      new APIError("BAD_REQUEST", { message: "password already set" }),
    )
    const res = await setAccountPassword({ newPassword: "motdepasse123" })
    expect(res).toEqual({
      success: false,
      error: "Impossible de définir le mot de passe.",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → même message + capture", async () => {
    const boom = new Error("Better Auth down")
    mocks.setPassword.mockRejectedValueOnce(boom)
    const res = await setAccountPassword({ newPassword: "motdepasse123" })
    expect(res).toEqual({
      success: false,
      error: "Impossible de définir le mot de passe.",
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[setAccountPassword]",
      boom,
      { userId: "u1" },
    )
  })
})
