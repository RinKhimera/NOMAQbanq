import { describe, expect, it } from "vitest"
import { userFormSchema } from "@/schemas/user"

describe("User Schema", () => {
  describe("userFormSchema", () => {
    const validUser = {
      name: "John Doe",
      username: "johndoe",
    }

    describe("valid data", () => {
      it("should validate a complete valid user", () => {
        const result = userFormSchema.safeParse(validUser)
        expect(result.success).toBe(true)
      })

      it("should validate with optional bio", () => {
        const userWithBio = {
          ...validUser,
          bio: "This is my bio",
        }
        const result = userFormSchema.safeParse(userWithBio)
        expect(result.success).toBe(true)
      })

      it("should validate username with underscores", () => {
        const userWithUnderscore = {
          ...validUser,
          username: "john_doe_123",
        }
        const result = userFormSchema.safeParse(userWithUnderscore)
        expect(result.success).toBe(true)
      })

      it("should validate username with numbers", () => {
        const userWithNumbers = {
          ...validUser,
          username: "john123",
        }
        const result = userFormSchema.safeParse(userWithNumbers)
        expect(result.success).toBe(true)
      })
    })

    describe("name validation", () => {
      it("should reject name with less than 2 characters", () => {
        const invalid = { ...validUser, name: "J" }
        const result = userFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("2 caractères")
        }
      })

      it("should accept name with exactly 2 characters", () => {
        const valid = { ...validUser, name: "Jo" }
        const result = userFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should reject name with more than 50 characters", () => {
        const invalid = { ...validUser, name: "A".repeat(51) }
        const result = userFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("50 caractères")
        }
      })

      it("should accept name with exactly 50 characters", () => {
        const valid = { ...validUser, name: "A".repeat(50) }
        const result = userFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should trim whitespace from name", () => {
        const userWithSpaces = { ...validUser, name: "  John Doe  " }
        const result = userFormSchema.safeParse(userWithSpaces)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.name).toBe("John Doe")
        }
      })
    })

    describe("username validation", () => {
      it("should reject username with less than 3 characters", () => {
        const invalid = { ...validUser, username: "jo" }
        const result = userFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("3 caractères")
        }
      })

      it("should accept username with exactly 3 characters", () => {
        const valid = { ...validUser, username: "joe" }
        const result = userFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should reject username with more than 20 characters", () => {
        const invalid = { ...validUser, username: "a".repeat(21) }
        const result = userFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("20 caractères")
        }
      })

      it("should accept username with exactly 20 characters", () => {
        const valid = { ...validUser, username: "a".repeat(20) }
        const result = userFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should transform username to lowercase", () => {
        const userUppercase = { ...validUser, username: "JohnDoe" }
        const result = userFormSchema.safeParse(userUppercase)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.username).toBe("johndoe")
        }
      })

      it("should reject username with special characters", () => {
        const invalidChars = ["john-doe", "john.doe", "john@doe", "john doe"]
        for (const username of invalidChars) {
          const result = userFormSchema.safeParse({ ...validUser, username })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toContain(
              "Caractères autorisés",
            )
          }
        }
      })

      it("should accept username with only numbers", () => {
        const valid = { ...validUser, username: "123456" }
        const result = userFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should accept username with only underscores and letters", () => {
        const valid = { ...validUser, username: "john_doe" }
        const result = userFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should trim whitespace from username before validation", () => {
        const userWithSpaces = { ...validUser, username: "  johndoe  " }
        const result = userFormSchema.safeParse(userWithSpaces)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.username).toBe("johndoe")
        }
      })
    })

    describe("bio validation", () => {
      it("should accept empty bio", () => {
        const userNoBio = { ...validUser, bio: undefined }
        const result = userFormSchema.safeParse(userNoBio)
        expect(result.success).toBe(true)
      })

      it("should accept empty string bio (transformed to empty after trim)", () => {
        const userEmptyBio = { ...validUser, bio: "" }
        const result = userFormSchema.safeParse(userEmptyBio)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.bio).toBe("")
        }
      })

      it("should transform whitespace-only bio to empty string", () => {
        const userWhitespaceBio = { ...validUser, bio: "   " }
        const result = userFormSchema.safeParse(userWhitespaceBio)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.bio).toBe("")
        }
      })

      it("should reject bio with more than 200 characters", () => {
        const invalid = { ...validUser, bio: "A".repeat(201) }
        const result = userFormSchema.safeParse(invalid)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("200 caractères")
        }
      })

      it("should accept bio with exactly 200 characters", () => {
        const valid = { ...validUser, bio: "A".repeat(200) }
        const result = userFormSchema.safeParse(valid)
        expect(result.success).toBe(true)
      })

      it("should trim whitespace from bio", () => {
        const userWithSpaces = { ...validUser, bio: "  My bio  " }
        const result = userFormSchema.safeParse(userWithSpaces)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.bio).toBe("My bio")
        }
      })

      it("should keep valid bio after trimming", () => {
        const userWithBio = { ...validUser, bio: "This is a valid bio" }
        const result = userFormSchema.safeParse(userWithBio)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.bio).toBe("This is a valid bio")
        }
      })
    })

    describe("edge cases", () => {
      it("should handle French accented names", () => {
        const frenchUser = { ...validUser, name: "Éléonore Beaumont" }
        const result = userFormSchema.safeParse(frenchUser)
        expect(result.success).toBe(true)
      })

      it("should reject emoji in username", () => {
        const emojiUser = { ...validUser, username: "john😀doe" }
        const result = userFormSchema.safeParse(emojiUser)
        expect(result.success).toBe(false)
      })

      it("should accept emoji in name and bio", () => {
        const emojiUser = {
          ...validUser,
          name: "John 😀 Doe",
          bio: "I love coding! 💻",
        }
        const result = userFormSchema.safeParse(emojiUser)
        expect(result.success).toBe(true)
      })
    })
  })
})
