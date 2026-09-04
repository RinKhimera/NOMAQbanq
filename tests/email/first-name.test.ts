import { describe, expect, it } from "vitest"
import { firstNameOf } from "@/email/first-name"

describe("firstNameOf", () => {
  it.each([
    ["Samuel Pokam", "Samuel"],
    ["  Marie-Ève   Tremblay ", "Marie-Ève"],
    ["Jean", "Jean"],
    ["   ", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("%j → %j", (input, expected) => {
    expect(firstNameOf(input)).toBe(expected)
  })
})
