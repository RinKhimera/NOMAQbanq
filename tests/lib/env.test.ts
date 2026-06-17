import { describe, expect, it } from "vitest"

import { loadServerEnv, stripEmpty } from "@/lib/env/schema"

const valid = {
  DATABASE_URL: "postgresql://u:p@host/db",
  DATABASE_URL_UNPOOLED: "postgresql://u:p@host/db",
  BETTER_AUTH_SECRET: "a-secret-value",
  BETTER_AUTH_URL: "http://localhost:3000",
}

describe("stripEmpty", () => {
  it("turns empty strings into undefined", () => {
    expect(stripEmpty({ A: "", B: "x" })).toEqual({ A: undefined, B: "x" })
  })
})

describe("loadServerEnv", () => {
  it("parses a valid environment", () => {
    expect(loadServerEnv(valid).DATABASE_URL).toBe(valid.DATABASE_URL)
  })

  it("throws when a required var is missing", () => {
    expect(() =>
      loadServerEnv({
        DATABASE_URL: valid.DATABASE_URL,
        DATABASE_URL_UNPOOLED: valid.DATABASE_URL_UNPOOLED,
        BETTER_AUTH_URL: valid.BETTER_AUTH_URL,
      }),
    ).toThrow(/BETTER_AUTH_SECRET/)
  })

  it("treats an empty string as missing", () => {
    expect(() => loadServerEnv({ ...valid, BETTER_AUTH_URL: "" })).toThrow(
      /BETTER_AUTH_URL/,
    )
  })
})
