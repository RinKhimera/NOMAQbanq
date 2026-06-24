import { describe, expect, it } from "vitest"

import { loadServerEnv, stripEmpty } from "@/lib/env/schema"

const valid = {
  DATABASE_URL: "postgresql://u:p@host/db",
  DATABASE_URL_UNPOOLED: "postgresql://u:p@host/db",
  BETTER_AUTH_SECRET: "a-secret-value-of-at-least-32-characters",
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
    expect(() => loadServerEnv({ ...valid, DATABASE_URL: "" })).toThrow(
      /DATABASE_URL/,
    )
  })

  it("allows BETTER_AUTH_URL to be omitted (derived at runtime)", () => {
    expect(
      loadServerEnv({
        DATABASE_URL: valid.DATABASE_URL,
        DATABASE_URL_UNPOOLED: valid.DATABASE_URL_UNPOOLED,
        BETTER_AUTH_SECRET: valid.BETTER_AUTH_SECRET,
      }).BETTER_AUTH_URL,
    ).toBeUndefined()
  })

  it("rejects a malformed BETTER_AUTH_URL", () => {
    expect(() =>
      loadServerEnv({ ...valid, BETTER_AUTH_URL: "not-a-url" }),
    ).toThrow(/BETTER_AUTH_URL/)
  })

  it("rejects a BETTER_AUTH_SECRET shorter than 32 chars", () => {
    expect(() =>
      loadServerEnv({ ...valid, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow(/BETTER_AUTH_SECRET/)
  })

  it("accepte une config AWS S3 complète", () => {
    expect(
      loadServerEnv({
        ...valid,
        AWS_REGION: "us-east-2",
        AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
        S3_BUCKET: "nomaq-media",
      }).S3_BUCKET,
    ).toBe("nomaq-media")
  })

  it("rejette une config AWS S3 partielle (role sans bucket)", () => {
    expect(() =>
      loadServerEnv({ ...valid, AWS_ROLE_ARN: "arn:aws:iam::1:role/x" }),
    ).toThrow(/AWS S3 incompl/)
  })
})
