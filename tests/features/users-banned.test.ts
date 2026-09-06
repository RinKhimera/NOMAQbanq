import { describe, expect, it } from "vitest"
import { isBannedUser } from "@/features/users/lib/banned"

describe("isBannedUser", () => {
  it("vrai uniquement pour banned === true", () => {
    expect(isBannedUser({ banned: true })).toBe(true)
    expect(isBannedUser({ banned: false })).toBe(false)
    expect(isBannedUser({ banned: null })).toBe(false)
    expect(isBannedUser({})).toBe(false)
  })
})
