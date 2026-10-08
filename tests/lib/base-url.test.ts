import { beforeEach, describe, expect, it, vi } from "vitest"
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

// Neutralise des variables Vercel déjà présentes dans le processus.
beforeEach(() => {
  envMock.current = {}
  for (const k of VERCEL_KEYS) vi.stubEnv(k, undefined)
})

describe("getBaseUrl", () => {
  it("uses BETTER_AUTH_URL when set, without trailing slash", () => {
    envMock.current.BETTER_AUTH_URL = "https://nomaqbanq.ca/"
    expect(getBaseUrl()).toBe("https://nomaqbanq.ca")
  })

  it("derives the production domain on Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "nomaqbanq.ca")
    expect(getBaseUrl()).toBe("https://nomaqbanq.ca")
  })

  it("prefers the stable branch URL on Vercel preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("VERCEL_BRANCH_URL", "nomaqbank-git-feat-team.vercel.app")
    vi.stubEnv("VERCEL_URL", "nomaqbank-abc123-team.vercel.app")
    expect(getBaseUrl()).toBe("https://nomaqbank-git-feat-team.vercel.app")
  })

  it("falls back to the deployment URL when no branch URL", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("VERCEL_URL", "nomaqbank-abc123-team.vercel.app")
    expect(getBaseUrl()).toBe("https://nomaqbank-abc123-team.vercel.app")
  })

  it("falls back to localhost off Vercel", () => {
    expect(getBaseUrl()).toBe("http://localhost:3000")
  })

  it("lets an explicit BETTER_AUTH_URL override the Vercel env", () => {
    envMock.current.BETTER_AUTH_URL = "http://localhost:3000"
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "nomaqbanq.ca")
    expect(getBaseUrl()).toBe("http://localhost:3000")
  })
})
