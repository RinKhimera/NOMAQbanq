import { beforeEach, describe, expect, it, vi } from "vitest"

const { sesCtor, oidcProvider } = vi.hoisted(() => ({
  sesCtor: vi.fn(),
  oidcProvider: vi.fn(() => "OIDC_PROVIDER"),
}))
const { envMock } = vi.hoisted(() => ({
  envMock: { current: {} as Record<string, string | undefined> },
}))

vi.mock("@aws-sdk/client-sesv2", () => ({ SESv2Client: sesCtor }))
vi.mock("@vercel/oidc-aws-credentials-provider", () => ({
  awsCredentialsProvider: oidcProvider,
}))
vi.mock("@/lib/env/server", () => ({
  get env() {
    return envMock.current
  },
}))

beforeEach(() => {
  sesCtor.mockClear()
  oidcProvider.mockClear()
  vi.resetModules()
})

describe("getSesClient", () => {
  it("uses Vercel OIDC credentials when AWS_ROLE_ARN is set", async () => {
    envMock.current = {
      SES_REGION: "us-east-2",
      AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/ses-sender",
    }
    const { getSesClient } = await import("@/email/client")
    getSesClient()
    expect(oidcProvider).toHaveBeenCalledWith({
      roleArn: "arn:aws:iam::123456789012:role/ses-sender",
    })
    expect(sesCtor).toHaveBeenCalledWith({
      region: "us-east-2",
      credentials: "OIDC_PROVIDER",
    })
  })

  it("falls back to static credentials when no role ARN is set", async () => {
    envMock.current = {
      SES_REGION: "us-east-2",
      SES_ACCESS_KEY_ID: "AKIA_TEST",
      SES_SECRET_ACCESS_KEY: "secret_test",
    }
    const { getSesClient } = await import("@/email/client")
    getSesClient()
    expect(oidcProvider).not.toHaveBeenCalled()
    expect(sesCtor).toHaveBeenCalledWith({
      region: "us-east-2",
      credentials: { accessKeyId: "AKIA_TEST", secretAccessKey: "secret_test" },
    })
  })

  it("throws when neither a role ARN nor static credentials are present", async () => {
    envMock.current = { EMAIL_FROM: "x@y.z" }
    const { getSesClient } = await import("@/email/client")
    expect(() => getSesClient()).toThrow(/AWS_ROLE_ARN/)
  })

  it("reuses the same instance (singleton)", async () => {
    envMock.current = { SES_ACCESS_KEY_ID: "a", SES_SECRET_ACCESS_KEY: "b" }
    const { getSesClient } = await import("@/email/client")
    expect(getSesClient()).toBe(getSesClient())
    expect(sesCtor).toHaveBeenCalledTimes(1)
  })
})
