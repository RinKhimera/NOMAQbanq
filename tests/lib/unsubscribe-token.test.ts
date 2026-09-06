import { describe, expect, it, vi } from "vitest"
import {
  createOneClickUnsubscribeUrl,
  createUnsubscribeToken,
  createUnsubscribeUrl,
  verifyUnsubscribeToken,
} from "@/lib/unsubscribe-token"

vi.mock("@/lib/env/server", () => ({
  env: { BETTER_AUTH_SECRET: "s".repeat(32) },
}))

describe("jeton de désabonnement", () => {
  it("aller-retour", () => {
    const token = createUnsubscribeToken("user_123")
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(verifyUnsubscribeToken(token)).toBe("user_123")
  })

  it("URL absolue avec le jeton en paramètre", () => {
    const url = createUnsubscribeUrl("https://nomaqbanq.ca", "user_123")
    expect(url.startsWith("https://nomaqbanq.ca/desabonnement?token=")).toBe(
      true,
    )
    expect(verifyUnsubscribeToken(new URL(url).searchParams.get("token"))).toBe(
      "user_123",
    )
  })

  it.each([
    [
      "signature altérée",
      () => createUnsubscribeToken("user_123").slice(0, -2) + "zz",
    ],
    [
      "identifiant altéré",
      () => {
        const [, sig] = createUnsubscribeToken("user_123").split(".")
        return `${Buffer.from("user_456").toString("base64url")}.${sig}`
      },
    ],
    ["sans point", () => "abc"],
    ["vide", () => ""],
    ["null", () => null],
  ])("%s → null", (_label, make) => {
    expect(verifyUnsubscribeToken(make())).toBeNull()
  })
})

describe("URL en un clic", () => {
  it("pointe sur la route API avec le même jeton", () => {
    const url = createOneClickUnsubscribeUrl("https://nomaqbanq.ca", "user_123")
    expect(
      url.startsWith("https://nomaqbanq.ca/api/desabonnement?token="),
    ).toBe(true)
    expect(verifyUnsubscribeToken(new URL(url).searchParams.get("token"))).toBe(
      "user_123",
    )
  })
})
