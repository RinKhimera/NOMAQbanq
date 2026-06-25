import { describe, expect, it } from "vitest"

import { mapAuthError } from "@/lib/auth-errors"

describe("mapAuthError", () => {
  it("classe EMAIL_NOT_VERIFIED", () => {
    expect(mapAuthError({ code: "EMAIL_NOT_VERIFIED" }).kind).toBe(
      "email_not_verified",
    )
  })

  it("classe INVALID_EMAIL_OR_PASSWORD", () => {
    expect(mapAuthError({ code: "INVALID_EMAIL_OR_PASSWORD" }).kind).toBe(
      "invalid_credentials",
    )
  })

  it("classe le 429 en message de rate-limit", () => {
    const r = mapAuthError({ status: 429 })
    expect(r.kind).toBe("generic")
    expect(r.message).toContain("Trop de tentatives")
  })

  it("classe USER_ALREADY_EXISTS en générique", () => {
    expect(
      mapAuthError({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }).kind,
    ).toBe("generic")
  })

  it("retombe sur générique pour inconnu / null", () => {
    expect(mapAuthError({ code: "WHATEVER" }).kind).toBe("generic")
    expect(mapAuthError(null).kind).toBe("generic")
    expect(mapAuthError(undefined).message).toBeTruthy()
  })
})
