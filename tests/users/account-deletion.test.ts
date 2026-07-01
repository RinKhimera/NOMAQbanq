import { describe, expect, it } from "vitest"
import {
  DELETION_GRACE_MS,
  isGraceExpired,
} from "@/features/users/lib/account-deletion"

describe("isGraceExpired", () => {
  const now = Date.UTC(2026, 5, 30)

  it("false si pas de suppression programmée", () => {
    expect(isGraceExpired(null, now)).toBe(false)
    expect(isGraceExpired(undefined, now)).toBe(false)
  })

  it("false dans la fenêtre de grâce", () => {
    const d = new Date(now - (DELETION_GRACE_MS - 1000))
    expect(isGraceExpired(d, now)).toBe(false)
  })

  it("true une fois la grâce dépassée", () => {
    const d = new Date(now - (DELETION_GRACE_MS + 1000))
    expect(isGraceExpired(d, now)).toBe(true)
  })
})
