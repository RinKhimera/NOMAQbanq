import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getBaseUrl } from "@/lib/base-url"

const { envMock } = vi.hoisted(() => ({
  envMock: { current: {} as Record<string, string | undefined> },
}))

vi.mock("@/lib/env/server", () => ({
  get env() {
    return envMock.current
  },
}))

const VERCEL_KEYS = [
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_URL",
] as const

beforeEach(() => {
  envMock.current = {}
  for (const k of VERCEL_KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of VERCEL_KEYS) delete process.env[k]
})

describe("getBaseUrl", () => {
  it("uses BETTER_AUTH_URL when set, without trailing slash", () => {
    envMock.current.BETTER_AUTH_URL = "https://nomaqbanq.ca/"
    expect(getBaseUrl()).toBe("https://nomaqbanq.ca")
  })

  it("derives the production domain on Vercel production", () => {
    process.env.VERCEL_ENV = "production"
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "nomaqbanq.ca"
    expect(getBaseUrl()).toBe("https://nomaqbanq.ca")
  })

  it("prefers the stable branch URL on Vercel preview", () => {
    process.env.VERCEL_ENV = "preview"
    process.env.VERCEL_BRANCH_URL = "nomaqbank-git-feat-team.vercel.app"
    process.env.VERCEL_URL = "nomaqbank-abc123-team.vercel.app"
    expect(getBaseUrl()).toBe("https://nomaqbank-git-feat-team.vercel.app")
  })

  it("falls back to the deployment URL when no branch URL", () => {
    process.env.VERCEL_ENV = "preview"
    process.env.VERCEL_URL = "nomaqbank-abc123-team.vercel.app"
    expect(getBaseUrl()).toBe("https://nomaqbank-abc123-team.vercel.app")
  })

  it("falls back to localhost off Vercel", () => {
    expect(getBaseUrl()).toBe("http://localhost:3000")
  })

  it("lets an explicit BETTER_AUTH_URL override the Vercel env", () => {
    envMock.current.BETTER_AUTH_URL = "http://localhost:3000"
    process.env.VERCEL_ENV = "production"
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "nomaqbanq.ca"
    expect(getBaseUrl()).toBe("http://localhost:3000")
  })
})
