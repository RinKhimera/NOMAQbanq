import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  getOptimizedImageUrl,
  getThumbnailUrl,
  getQuestionImageUrl,
  getAvatarUrl,
  generateQuestionImagePath,
  generateAvatarPath,
  getExtensionFromMimeType,
  validateImageFile,
  uploadToBunny,
  deleteFromBunny,
} from "@/convex/lib/bunny"

describe("bunny utilities", () => {
  describe("getOptimizedImageUrl", () => {
    const baseUrl = "https://example.b-cdn.net/image.jpg"

    it("returns base URL when no params provided", () => {
      const result = getOptimizedImageUrl(baseUrl, {})
      expect(result).toBe(baseUrl)
    })

    it("adds width parameter", () => {
      const result = getOptimizedImageUrl(baseUrl, { width: 800 })
      expect(result).toBe(`${baseUrl}?width=800`)
    })

    it("adds height parameter", () => {
      const result = getOptimizedImageUrl(baseUrl, { height: 600 })
      expect(result).toBe(`${baseUrl}?height=600`)
    })

    it("adds quality parameter", () => {
      const result = getOptimizedImageUrl(baseUrl, { quality: 85 })
      expect(result).toBe(`${baseUrl}?quality=85`)
    })

    it("adds crop parameter", () => {
      const result = getOptimizedImageUrl(baseUrl, { crop: "fit" })
      expect(result).toBe(`${baseUrl}?crop=fit`)
    })

    it("combines multiple parameters", () => {
      const result = getOptimizedImageUrl(baseUrl, {
        width: 200,
        height: 200,
        quality: 80,
        crop: "fit",
      })
      expect(result).toContain("width=200")
      expect(result).toContain("height=200")
      expect(result).toContain("quality=80")
      expect(result).toContain("crop=fit")
    })

    it("handles all crop types", () => {
      expect(getOptimizedImageUrl(baseUrl, { crop: "fit" })).toContain(
        "crop=fit",
      )
      expect(getOptimizedImageUrl(baseUrl, { crop: "fill" })).toContain(
        "crop=fill",
      )
      expect(getOptimizedImageUrl(baseUrl, { crop: "scale" })).toContain(
        "crop=scale",
      )
    })
  })

  describe("getThumbnailUrl", () => {
    const baseUrl = "https://example.b-cdn.net/image.jpg"

    it("returns URL with default 200px size", () => {
      const result = getThumbnailUrl(baseUrl)
      expect(result).toContain("width=200")
      expect(result).toContain("height=200")
      expect(result).toContain("crop=fit")
      expect(result).toContain("quality=80")
    })

    it("allows custom size", () => {
      const result = getThumbnailUrl(baseUrl, 100)
      expect(result).toContain("width=100")
      expect(result).toContain("height=100")
    })
  })

  describe("getQuestionImageUrl", () => {
    const baseUrl = "https://example.b-cdn.net/image.jpg"

    it("returns URL with 800px width and 85 quality", () => {
      const result = getQuestionImageUrl(baseUrl)
      expect(result).toContain("width=800")
      expect(result).toContain("quality=85")
    })
  })

  describe("getAvatarUrl", () => {
    const baseUrl = "https://example.b-cdn.net/avatar.jpg"

    it("returns URL with default 128px size", () => {
      const result = getAvatarUrl(baseUrl)
      expect(result).toContain("width=128")
      expect(result).toContain("height=128")
      expect(result).toContain("crop=fit")
      expect(result).toContain("quality=85")
    })

    it("allows custom size", () => {
      const result = getAvatarUrl(baseUrl, 64)
      expect(result).toContain("width=64")
      expect(result).toContain("height=64")
    })
  })

  describe("generateQuestionImagePath", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("generates correct path format", () => {
      const result = generateQuestionImagePath("q123", 0, "jpg")
      expect(result).toBe("questions/q123/1705320000000-0.jpg")
    })

    it("handles extension with leading dot", () => {
      const result = generateQuestionImagePath("q123", 1, ".png")
      expect(result).toBe("questions/q123/1705320000000-1.png")
    })

    it("converts extension to lowercase", () => {
      const result = generateQuestionImagePath("q123", 0, "JPG")
      expect(result).toBe("questions/q123/1705320000000-0.jpg")
    })

    it("handles different indices", () => {
      const result = generateQuestionImagePath("q123", 5, "webp")
      expect(result).toBe("questions/q123/1705320000000-5.webp")
    })
  })

  describe("generateAvatarPath", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("generates correct path format", () => {
      const result = generateAvatarPath("user123", "jpg")
      expect(result).toBe("avatars/user123/1705320000000.jpg")
    })

    it("handles extension with leading dot", () => {
      const result = generateAvatarPath("user123", ".png")
      expect(result).toBe("avatars/user123/1705320000000.png")
    })

    it("converts extension to lowercase", () => {
      const result = generateAvatarPath("user123", "PNG")
      expect(result).toBe("avatars/user123/1705320000000.png")
    })
  })

  describe("getExtensionFromMimeType", () => {
    it("returns jpg for image/jpeg", () => {
      expect(getExtensionFromMimeType("image/jpeg")).toBe("jpg")
    })

    it("returns png for image/png", () => {
      expect(getExtensionFromMimeType("image/png")).toBe("png")
    })

    it("returns webp for image/webp", () => {
      expect(getExtensionFromMimeType("image/webp")).toBe("webp")
    })

    it("returns jpg fallback for image/gif (not in ALLOWED_MIME_TYPES)", () => {
      expect(getExtensionFromMimeType("image/gif")).toBe("jpg")
    })

    it("returns jpg as default for unknown MIME types", () => {
      expect(getExtensionFromMimeType("image/bmp")).toBe("jpg")
      expect(getExtensionFromMimeType("unknown")).toBe("jpg")
    })
  })

  describe("validateImageFile", () => {
    it("returns null for valid JPEG file", () => {
      const result = validateImageFile("image/jpeg", 1024 * 1024) // 1MB
      expect(result).toBeNull()
    })

    it("returns null for valid PNG file", () => {
      const result = validateImageFile("image/png", 2 * 1024 * 1024) // 2MB
      expect(result).toBeNull()
    })

    it("returns null for valid WebP file", () => {
      const result = validateImageFile("image/webp", 1024) // 1KB
      expect(result).toBeNull()
    })

    it("returns error for unsupported MIME type", () => {
      const result = validateImageFile("image/gif", 1024)
      expect(result).toBe("Format non supporté. Utilisez JPG, PNG ou WebP.")
    })

    it("returns error for non-image MIME type", () => {
      const result = validateImageFile("application/pdf", 1024)
      expect(result).toBe("Format non supporté. Utilisez JPG, PNG ou WebP.")
    })

    it("returns error for file exceeding 5MB", () => {
      const result = validateImageFile("image/jpeg", 6 * 1024 * 1024) // 6MB
      expect(result).toBe("Fichier trop volumineux. Maximum 5MB.")
    })

    it("returns null for file exactly at 5MB limit", () => {
      const result = validateImageFile("image/jpeg", 5 * 1024 * 1024) // exactly 5MB
      expect(result).toBeNull()
    })

    it("checks MIME type before size", () => {
      // Both invalid: unsupported type AND too large
      // Should return MIME type error first
      const result = validateImageFile("image/gif", 10 * 1024 * 1024)
      expect(result).toBe("Format non supporté. Utilisez JPG, PNG ou WebP.")
    })
  })

  describe("uploadToBunny", () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Set up mock environment variables
      process.env = {
        ...originalEnv,
        BUNNY_STORAGE_ZONE_NAME: "test-zone",
        BUNNY_STORAGE_API_KEY: "test-api-key",
        BUNNY_CDN_HOSTNAME: "test.b-cdn.net",
      }
      // Suppress expected console.error messages during error tests
      vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
      process.env = originalEnv
      vi.restoreAllMocks()
    })

    it("throws when BUNNY_STORAGE_ZONE_NAME is missing", async () => {
      delete process.env.BUNNY_STORAGE_ZONE_NAME

      const fileData = new Uint8Array([1, 2, 3])
      await expect(uploadToBunny(fileData, "test/path.jpg")).rejects.toThrow(
        "Configuration Bunny manquante",
      )
    })

    it("throws when BUNNY_STORAGE_API_KEY is missing", async () => {
      delete process.env.BUNNY_STORAGE_API_KEY

      const fileData = new Uint8Array([1, 2, 3])
      await expect(uploadToBunny(fileData, "test/path.jpg")).rejects.toThrow(
        "Configuration Bunny manquante",
      )
    })

    it("throws when BUNNY_CDN_HOSTNAME is missing", async () => {
      delete process.env.BUNNY_CDN_HOSTNAME

      const fileData = new Uint8Array([1, 2, 3])
      await expect(uploadToBunny(fileData, "test/path.jpg")).rejects.toThrow(
        "Configuration Bunny manquante",
      )
    })

    it("returns success with CDN URL on successful upload", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal("fetch", mockFetch)

      const fileData = new Uint8Array([1, 2, 3])
      const result = await uploadToBunny(fileData, "questions/q1/image.jpg")

      expect(result).toEqual({
        success: true,
        url: "https://test.b-cdn.net/questions/q1/image.jpg",
        storagePath: "questions/q1/image.jpg",
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://storage.bunnycdn.com/test-zone/questions/q1/image.jpg",
        expect.objectContaining({
          method: "PUT",
          headers: {
            AccessKey: "test-api-key",
            "Content-Type": "application/octet-stream",
          },
        }),
      )
    })

    it("handles ArrayBuffer input", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal("fetch", mockFetch)

      const arrayBuffer = new ArrayBuffer(8)
      const result = await uploadToBunny(arrayBuffer, "test/path.jpg")

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalled()
    })

    it("returns auth error on 401 status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      })
      vi.stubGlobal("fetch", mockFetch)

      const fileData = new Uint8Array([1, 2, 3])
      const result = await uploadToBunny(fileData, "test/path.jpg")

      expect(result).toEqual({
        success: false,
        error: "Authentification Bunny échouée. Vérifiez l'API key.",
      })
    })

    it("returns generic error on other non-OK status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      })
      vi.stubGlobal("fetch", mockFetch)

      const fileData = new Uint8Array([1, 2, 3])
      const result = await uploadToBunny(fileData, "test/path.jpg")

      expect(result).toEqual({
        success: false,
        error: "Échec de l'upload: 500",
      })
    })

    it("returns network error on fetch failure with Error instance", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new Error("Network connection failed"))
      vi.stubGlobal("fetch", mockFetch)

      const fileData = new Uint8Array([1, 2, 3])
      const result = await uploadToBunny(fileData, "test/path.jpg")

      expect(result).toEqual({
        success: false,
        error: "Network connection failed",
      })
    })

    it("returns generic network error on non-Error thrown", async () => {
      const mockFetch = vi.fn().mockRejectedValue("string error")
      vi.stubGlobal("fetch", mockFetch)

      const fileData = new Uint8Array([1, 2, 3])
      const result = await uploadToBunny(fileData, "test/path.jpg")

      expect(result).toEqual({
        success: false,
        error: "Erreur réseau",
      })
    })
  })

  describe("deleteFromBunny", () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        BUNNY_STORAGE_ZONE_NAME: "test-zone",
        BUNNY_STORAGE_API_KEY: "test-api-key",
        BUNNY_CDN_HOSTNAME: "test.b-cdn.net",
      }
      // Suppress expected console.error messages during error tests
      vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
      process.env = originalEnv
      vi.restoreAllMocks()
    })

    it("returns true on successful delete (200)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await deleteFromBunny("questions/q1/image.jpg")

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        "https://storage.bunnycdn.com/test-zone/questions/q1/image.jpg",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            AccessKey: "test-api-key",
          },
        }),
      )
    })

    it("returns true on 404 (file already deleted)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await deleteFromBunny("questions/q1/nonexistent.jpg")

      expect(result).toBe(true)
    })

    it("returns false on other error status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await deleteFromBunny("questions/q1/image.jpg")

      expect(result).toBe(false)
    })

    it("returns false on 403 forbidden", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await deleteFromBunny("questions/q1/image.jpg")

      expect(result).toBe(false)
    })

    it("returns false on network error", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new Error("Network connection failed"))
      vi.stubGlobal("fetch", mockFetch)

      const result = await deleteFromBunny("questions/q1/image.jpg")

      expect(result).toBe(false)
    })

    it("throws when configuration is missing", async () => {
      delete process.env.BUNNY_STORAGE_ZONE_NAME

      await expect(
        deleteFromBunny("questions/q1/image.jpg"),
      ).rejects.toThrow("Configuration Bunny manquante")
    })
  })
})
