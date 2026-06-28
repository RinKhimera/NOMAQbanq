import { describe, expect, it } from "vitest"
import { groupEnv, keysOnlyIn, parseRawLines } from "@/scripts/sync-env"

describe("parseRawLines", () => {
  it("ignore commentaires et lignes vides, garde la ligne brute", () => {
    const map = parseRawLines("# c\n\nDATABASE_URL=postgres://a&b=c")
    expect(map.size).toBe(1)
    expect(map.get("DATABASE_URL")).toBe("DATABASE_URL=postgres://a&b=c")
  })
})

describe("groupEnv", () => {
  it("regroupe par section, préserve la valeur brute, respecte l'ordre", () => {
    const flat = [
      'EMAIL_FROM="NOMAQbanq <noreply@nomaqbanq.ca>"',
      "DATABASE_URL=postgres://a&b=c",
      "BETTER_AUTH_SECRET=xyz",
    ].join("\n")
    const out = groupEnv(flat)
    expect(out).toContain("# === Base de données — Neon")
    expect(out).toContain("DATABASE_URL=postgres://a&b=c")
    expect(out).toContain('EMAIL_FROM="NOMAQbanq <noreply@nomaqbanq.ca>"')
    expect(out.indexOf("DATABASE_URL")).toBeLessThan(
      out.indexOf("BETTER_AUTH_SECRET"),
    )
    expect(out.indexOf("BETTER_AUTH_SECRET")).toBeLessThan(
      out.indexOf("EMAIL_FROM"),
    )
  })

  it("met les clés inconnues en « Non classé »", () => {
    const out = groupEnv("FOO_UNKNOWN=1\nDATABASE_URL=x")
    expect(out).toContain("# === Non classé")
    expect(out).toContain("FOO_UNKNOWN=1")
  })
})

describe("keysOnlyIn", () => {
  it("retourne les clés de a absentes de b, triées", () => {
    expect(keysOnlyIn(["B", "A", "C"], new Set(["A"]))).toEqual(["B", "C"])
  })
})
