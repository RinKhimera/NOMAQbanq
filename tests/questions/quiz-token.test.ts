import { afterEach, describe, expect, it, vi } from "vitest"
import { signQuizToken, verifyQuizToken } from "@/features/questions/quiz-token"

vi.mock("@/lib/env/server", () => ({
  env: { BETTER_AUTH_SECRET: "test-secret-please-change-000000000000" },
}))

afterEach(() => {
  vi.useRealTimers()
})

describe("signQuizToken / verifyQuizToken", () => {
  it("aller-retour : les ids signés sont vérifiables, insensibles à l'ordre", () => {
    const token = signQuizToken(["q-b", "q-a"])
    expect(verifyQuizToken(token)).toEqual(new Set(["q-a", "q-b"]))
  })

  it("accepte un lot vide", () => {
    expect(verifyQuizToken(signQuizToken([]))).toEqual(new Set())
  })

  it("refuse un jeton expiré (> 1 h)", () => {
    vi.useFakeTimers()
    const token = signQuizToken(["q-a"])
    vi.advanceTimersByTime(61 * 60 * 1000)
    expect(verifyQuizToken(token)).toBeNull()
  })

  it("accepte un jeton encore frais (59 min)", () => {
    vi.useFakeTimers()
    const token = signQuizToken(["q-a"])
    vi.advanceTimersByTime(59 * 60 * 1000)
    expect(verifyQuizToken(token)).toEqual(new Set(["q-a"]))
  })

  it("refuse un payload altéré (ids substitués)", () => {
    const token = signQuizToken(["q-a"])
    const [, sig] = token.split(".")
    const forged = Buffer.from(
      JSON.stringify({ v: 1, ids: ["q-volee"], exp: Date.now() + 60_000 }),
    ).toString("base64url")
    expect(verifyQuizToken(`${forged}.${sig}`)).toBeNull()
  })

  it("refuse une signature altérée", () => {
    const token = signQuizToken(["q-a"])
    const flipped = token.endsWith("A")
      ? `${token.slice(0, -1)}B`
      : `${token.slice(0, -1)}A`
    expect(verifyQuizToken(flipped)).toBeNull()
  })

  it("refuse les chaînes malformées", () => {
    for (const bad of ["", "abc", "a.b.c", "%%%.###", "e30."]) {
      expect(verifyQuizToken(bad)).toBeNull()
    }
  })

  it("refuse plus de 10 ids (borne du produit)", () => {
    const token = signQuizToken(Array.from({ length: 11 }, (_, i) => `q-${i}`))
    expect(verifyQuizToken(token)).toBeNull()
  })
})
