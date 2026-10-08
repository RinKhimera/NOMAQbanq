import { describe, expect, it } from "vitest"
import { cn, getInitials } from "@/lib/utils"

describe("cn", () => {
  it("fusionne les classes et laisse la dernière classe Tailwind en conflit l'emporter", () => {
    expect(
      cn("px-4 py-2", false && "hidden", undefined, { "font-bold": true }, [
        "px-6",
      ]),
    ).toBe("py-2 font-bold px-6")
  })
})

describe("getInitials", () => {
  it.each([
    ["John Doe", "JD"],
    ["John", "J"],
    ["John Michael Doe", "JM"],
    ["jOhN dOe", "JD"],
    ["  John    Doe  ", "JD"],
    ["Élise Beaumont", "ÉB"],
    ["Jean-Pierre Dupont", "JD"],
    ["O'Connor Smith", "OS"],
    ["李 明", "李明"],
    ["محمد علي", "مع"],
    ["123 Test", "1T"],
    ["😀 Test", "😀T"],
    // Une majuscule qui s'écrit en deux lettres (ß → SS) garde sa minuscule :
    // l'avatar n'a la place que de deux caractères.
    ["ßara ﬀion", "ßﬀ"],
  ])("%j → %j", (fullName, initials) => {
    expect(getInitials(fullName)).toBe(initials)
  })

  it.each([[""], ["   "], [null], [undefined]])("%j → ?", (fullName) => {
    expect(getInitials(fullName)).toBe("?")
  })
})
