import { describe, expect, it } from "vitest"
import { userFormSchema } from "@/schemas/user"

describe("userFormSchema", () => {
  const validUser = { name: "John Doe", username: "johndoe" }
  const ALLOWED_CHARS = "Caractères autorisés: lettres, chiffres, underscore"

  it("rogne les champs et met le nom d'utilisateur en minuscules", () => {
    const result = userFormSchema.safeParse({
      name: "  Éléonore 😀 Beaumont  ",
      username: "  John_Doe_123  ",
      bio: "  J'adore coder 💻  ",
    })
    expect(result.data).toEqual({
      name: "Éléonore 😀 Beaumont",
      username: "john_doe_123",
      bio: "J'adore coder 💻",
    })
  })

  it.each([
    [undefined, undefined],
    ["", ""],
    ["   ", ""],
  ])("biographie facultative : %j → %j", (bio, expected) => {
    const result = userFormSchema.safeParse({ ...validUser, bio })
    expect(result.success).toBe(true)
    expect(result.data?.bio).toBe(expected)
  })

  it("accepte chaque champ à ses bornes", () => {
    expect(
      userFormSchema.safeParse({ name: "Jo", username: "123" }).success,
    ).toBe(true)
    expect(
      userFormSchema.safeParse({
        name: "A".repeat(50),
        username: "a".repeat(20),
        bio: "A".repeat(200),
      }).success,
    ).toBe(true)
  })

  it.each([
    ["name", "J", "Le nom doit contenir au moins 2 caractères"],
    ["name", "A".repeat(51), "Le nom ne peut pas dépasser 50 caractères"],
    [
      "username",
      "jo",
      "Le nom d'utilisateur doit contenir au moins 3 caractères",
    ],
    [
      "username",
      "a".repeat(21),
      "Le nom d'utilisateur ne peut pas dépasser 20 caractères",
    ],
    ["username", "john-doe", ALLOWED_CHARS],
    ["username", "john doe", ALLOWED_CHARS],
    ["username", "john😀doe", ALLOWED_CHARS],
    [
      "bio",
      "A".repeat(201),
      "La biographie ne peut pas dépasser 200 caractères",
    ],
  ])("refuse %s = %j", (field, value, message) => {
    const result = userFormSchema.safeParse({ ...validUser, [field]: value })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      message,
    ])
  })
})
