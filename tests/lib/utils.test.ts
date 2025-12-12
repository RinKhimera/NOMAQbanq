import { describe, expect, it } from "vitest"
import { cn, getInitials } from "@/lib/utils"

describe("Utils", () => {
  describe("cn (className merge utility)", () => {
    it("should merge simple class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar")
    })

    it("should handle conditional classes", () => {
      expect(cn("base", true && "active", false && "hidden")).toBe(
        "base active",
      )
    })

    it("should handle undefined and null values", () => {
      expect(cn("base", undefined, null, "end")).toBe("base end")
    })

    it("should merge Tailwind classes correctly", () => {
      const result = cn("px-4 py-2", "px-6")
      expect(result).toContain("px-6")
      expect(result).toContain("py-2")
      expect(result).not.toContain("px-4")
    })

    it("should handle object syntax", () => {
      expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe(
        "text-red-500",
      )
    })

    it("should handle array syntax", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar")
    })

    it("should handle empty input", () => {
      expect(cn()).toBe("")
    })

    it("should override conflicting Tailwind classes", () => {
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500")
    })
  })

  describe("getInitials", () => {
    describe("valid full names", () => {
      it("should return initials for two-word name", () => {
        expect(getInitials("John Doe")).toBe("JD")
      })

      it("should return initials for single word name", () => {
        expect(getInitials("John")).toBe("J")
      })

      it("should return only first two initials for long names", () => {
        expect(getInitials("John Michael Doe")).toBe("JM")
      })

      it("should handle lowercase names", () => {
        expect(getInitials("john doe")).toBe("JD")
      })

      it("should handle mixed case names", () => {
        expect(getInitials("jOhN dOe")).toBe("JD")
      })
    })

    describe("edge cases with whitespace", () => {
      it("should handle leading/trailing spaces", () => {
        expect(getInitials("  John Doe  ")).toBe("JD")
      })

      it("should handle multiple spaces between words", () => {
        expect(getInitials("John    Doe")).toBe("JD")
      })

      it("should return ? for empty string", () => {
        expect(getInitials("")).toBe("?")
      })

      it("should return ? for whitespace only", () => {
        expect(getInitials("   ")).toBe("?")
      })
    })

    describe("null and undefined inputs", () => {
      it("should return ? for null", () => {
        expect(getInitials(null)).toBe("?")
      })

      it("should return ? for undefined", () => {
        expect(getInitials(undefined)).toBe("?")
      })
    })

    describe("special characters", () => {
      it("should handle names with accents", () => {
        expect(getInitials("Élise Beaumont")).toBe("ÉB")
      })

      it("should handle names with hyphens", () => {
        expect(getInitials("Jean-Pierre Dupont")).toBe("JD")
      })

      it("should handle names with apostrophes", () => {
        expect(getInitials("O'Connor Smith")).toBe("OS")
      })
    })

    describe("Unicode and international names", () => {
      it("should handle Chinese characters", () => {
        expect(getInitials("李 明")).toBe("李明")
      })

      it("should handle Arabic names", () => {
        expect(getInitials("محمد علي")).toBe("مع")
      })

      it("should handle emoji (edge case)", () => {
        const result = getInitials("😀 Test")
        expect(result.length).toBeLessThanOrEqual(2)
      })
    })

    describe("numbers in names", () => {
      it("should handle names starting with numbers", () => {
        expect(getInitials("123 Test")).toBe("1T")
      })
    })
  })
})
