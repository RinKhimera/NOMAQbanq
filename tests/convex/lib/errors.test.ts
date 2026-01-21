import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"
import { Errors, type ErrorCode } from "@/convex/lib/errors"

describe("Errors", () => {
  describe("unauthenticated", () => {
    it("returns a ConvexError with UNAUTHENTICATED code", () => {
      const error = Errors.unauthenticated()

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "UNAUTHENTICATED",
        message: "Non authentifié",
      })
    })
  })

  describe("unauthorized", () => {
    it("returns a ConvexError with default message", () => {
      const error = Errors.unauthorized()

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "UNAUTHORIZED",
        message: "Accès non autorisé",
      })
    })

    it("returns a ConvexError with custom message", () => {
      const error = Errors.unauthorized("Message personnalisé")

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "UNAUTHORIZED",
        message: "Message personnalisé",
      })
    })
  })

  describe("notFound", () => {
    it("returns a ConvexError with entity name in message", () => {
      const error = Errors.notFound("Question")

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "NOT_FOUND",
        message: "Question non trouvé",
      })
    })

    it("works with different entity names", () => {
      const error = Errors.notFound("Utilisateur")

      expect(error.data).toEqual({
        code: "NOT_FOUND",
        message: "Utilisateur non trouvé",
      })
    })
  })

  describe("accessExpired", () => {
    it("returns generic message when no accessType provided", () => {
      const error = Errors.accessExpired()

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "ACCESS_EXPIRED",
        message: "Votre accès a expiré",
      })
    })

    it("returns exam-specific message when accessType is exam", () => {
      const error = Errors.accessExpired("exam")

      expect(error.data).toEqual({
        code: "ACCESS_EXPIRED",
        message: "Votre accès aux examens a expiré",
      })
    })

    it("returns training-specific message when accessType is training", () => {
      const error = Errors.accessExpired("training")

      expect(error.data).toEqual({
        code: "ACCESS_EXPIRED",
        message: "Votre accès à l'entraînement a expiré",
      })
    })
  })

  describe("invalidInput", () => {
    it("returns a ConvexError with the provided message", () => {
      const error = Errors.invalidInput("Email invalide")

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "INVALID_INPUT",
        message: "Email invalide",
      })
    })
  })

  describe("rateLimited", () => {
    it("returns a ConvexError with retry time in message", () => {
      const error = Errors.rateLimited(5)

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "RATE_LIMITED",
        message: "Limite atteinte. Réessayez dans 5 minute(s).",
      })
    })

    it("works with different retry times", () => {
      const error = Errors.rateLimited(1)

      expect(error.data).toEqual({
        code: "RATE_LIMITED",
        message: "Limite atteinte. Réessayez dans 1 minute(s).",
      })
    })
  })

  describe("alreadyExists", () => {
    it("returns a ConvexError with entity name in message", () => {
      const error = Errors.alreadyExists("Utilisateur")

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "ALREADY_EXISTS",
        message: "Utilisateur existe déjà",
      })
    })
  })

  describe("invalidState", () => {
    it("returns a ConvexError with the provided message", () => {
      const error = Errors.invalidState("État invalide pour cette opération")

      expect(error).toBeInstanceOf(ConvexError)
      expect(error.data).toEqual({
        code: "INVALID_STATE",
        message: "État invalide pour cette opération",
      })
    })
  })

  describe("ErrorCode type", () => {
    it("has all expected error codes", () => {
      const expectedCodes: ErrorCode[] = [
        "UNAUTHENTICATED",
        "UNAUTHORIZED",
        "NOT_FOUND",
        "ACCESS_EXPIRED",
        "INVALID_INPUT",
        "RATE_LIMITED",
        "ALREADY_EXISTS",
        "INVALID_STATE",
      ]

      // Verify each error factory produces the expected code
      expect(Errors.unauthenticated().data.code).toBe(expectedCodes[0])
      expect(Errors.unauthorized().data.code).toBe(expectedCodes[1])
      expect(Errors.notFound("x").data.code).toBe(expectedCodes[2])
      expect(Errors.accessExpired().data.code).toBe(expectedCodes[3])
      expect(Errors.invalidInput("x").data.code).toBe(expectedCodes[4])
      expect(Errors.rateLimited(1).data.code).toBe(expectedCodes[5])
      expect(Errors.alreadyExists("x").data.code).toBe(expectedCodes[6])
      expect(Errors.invalidState("x").data.code).toBe(expectedCodes[7])
    })
  })
})
