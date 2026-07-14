import { describe, expect, it } from "vitest"
import { getPgErrorCode, isPgUniqueViolation } from "@/lib/db-errors"

describe("getPgErrorCode", () => {
  it("lit le code au premier niveau", () => {
    expect(getPgErrorCode({ code: "23505" })).toBe("23505")
  })

  it("remonte la chaîne cause (forme DrizzleQueryError → DatabaseError pg)", () => {
    const err = Object.assign(new Error("query failed"), {
      cause: Object.assign(new Error("db"), { cause: { code: "23001" } }),
    })
    expect(getPgErrorCode(err)).toBe("23001")
  })

  it("renvoie undefined sans code dans la chaîne", () => {
    expect(getPgErrorCode(new Error("boom"))).toBeUndefined()
    expect(getPgErrorCode(null)).toBeUndefined()
    expect(getPgErrorCode("string")).toBeUndefined()
  })

  it("ignore un code non-string", () => {
    expect(getPgErrorCode({ code: 23505 })).toBeUndefined()
  })

  it("borne le parcours à 5 niveaux (pas de boucle infinie sur cycle)", () => {
    const cyclic: { cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(getPgErrorCode(cyclic)).toBeUndefined()

    let deep: unknown = { code: "23505" }
    for (let i = 0; i < 6; i++) deep = { cause: deep }
    expect(getPgErrorCode(deep)).toBeUndefined()
  })
})

describe("isPgUniqueViolation", () => {
  it("détecte 23505 enveloppé", () => {
    expect(isPgUniqueViolation({ cause: { code: "23505" } })).toBe(true)
    expect(isPgUniqueViolation({ cause: { code: "23503" } })).toBe(false)
  })
})
