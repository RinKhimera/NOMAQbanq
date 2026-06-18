import { beforeEach, describe, expect, it, vi } from "vitest"

const { sesCtor } = vi.hoisted(() => ({ sesCtor: vi.fn() }))
const { envMock } = vi.hoisted(() => ({
  envMock: { current: {} as Record<string, string | undefined> },
}))

vi.mock("@aws-sdk/client-sesv2", () => ({ SESv2Client: sesCtor }))
vi.mock("@/lib/env/server", () => ({
  get env() {
    return envMock.current
  },
}))

beforeEach(() => {
  sesCtor.mockClear()
  vi.resetModules()
})

describe("getSesClient", () => {
  it("throws when credentials are missing", async () => {
    envMock.current = { EMAIL_FROM: "x@y.z" }
    const { getSesClient } = await import("@/email/client")
    expect(() => getSesClient()).toThrow(/SES_ACCESS_KEY_ID/)
  })

  it("creates a client with region and explicit credentials", async () => {
    envMock.current = {
      SES_REGION: "us-east-2",
      SES_ACCESS_KEY_ID: "AKIA_TEST",
      SES_SECRET_ACCESS_KEY: "secret_test",
    }
    const { getSesClient } = await import("@/email/client")
    getSesClient()
    expect(sesCtor).toHaveBeenCalledWith({
      region: "us-east-2",
      credentials: { accessKeyId: "AKIA_TEST", secretAccessKey: "secret_test" },
    })
  })

  it("reuses the same instance (singleton)", async () => {
    envMock.current = { SES_ACCESS_KEY_ID: "a", SES_SECRET_ACCESS_KEY: "b" }
    const { getSesClient } = await import("@/email/client")
    expect(getSesClient()).toBe(getSesClient())
    expect(sesCtor).toHaveBeenCalledTimes(1)
  })
})
