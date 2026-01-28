import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  saveAnswersToStorage,
  loadAnswersFromStorage,
  clearAnswersFromStorage,
} from "@/lib/exam-storage"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    _getStore: () => store,
  }
})()

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
})

describe("exam-storage", () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-03-15T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("saveAnswersToStorage", () => {
    it("sauvegarde les réponses dans localStorage", () => {
      const examId = "exam_123"
      const answers = { q1: "A", q2: "B", q3: "C" }

      saveAnswersToStorage(examId, answers)

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
      const key = `exam_answers_${examId}`
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        key,
        expect.any(String),
      )

      // Vérifie le contenu sauvegardé
      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[0][1] as string,
      )
      expect(savedData.answers).toEqual(answers)
      expect(savedData.savedAt).toBe(Date.now())
    })

    it("gère les réponses vides", () => {
      saveAnswersToStorage("exam_456", {})

      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[0][1] as string,
      )
      expect(savedData.answers).toEqual({})
    })

    it("écrase les anciennes réponses", () => {
      const examId = "exam_789"

      saveAnswersToStorage(examId, { q1: "A" })
      saveAnswersToStorage(examId, { q1: "B", q2: "C" })

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2)
    })

    it("gère les erreurs localStorage silencieusement", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("Quota exceeded")
      })

      // Ne doit pas lever d'exception
      expect(() => saveAnswersToStorage("exam_err", { q1: "A" })).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        "Échec de sauvegarde des réponses dans localStorage:",
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe("loadAnswersFromStorage", () => {
    it("charge les réponses sauvegardées", () => {
      const examId = "exam_load"
      const answers = { q1: "A", q2: "B" }

      // Simuler des données sauvegardées
      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify({
          answers,
          savedAt: Date.now(),
        }),
      )

      const result = loadAnswersFromStorage(examId)

      expect(result).toEqual(answers)
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        `exam_answers_${examId}`,
      )
    })

    it("retourne null si aucune donnée", () => {
      localStorageMock.getItem.mockReturnValueOnce(null)

      const result = loadAnswersFromStorage("exam_empty")

      expect(result).toBeNull()
    })

    it("retourne null et supprime si données expirées (>24h)", () => {
      const examId = "exam_expired"
      const expiredTime = Date.now() - 25 * 60 * 60 * 1000 // 25 heures

      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify({
          answers: { q1: "A" },
          savedAt: expiredTime,
        }),
      )

      const result = loadAnswersFromStorage(examId)

      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        `exam_answers_${examId}`,
      )
    })

    it("charge les données non expirées (<24h)", () => {
      const examId = "exam_valid"
      const recentTime = Date.now() - 23 * 60 * 60 * 1000 // 23 heures
      const answers = { q1: "A", q2: "B" }

      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify({
          answers,
          savedAt: recentTime,
        }),
      )

      const result = loadAnswersFromStorage(examId)

      expect(result).toEqual(answers)
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
    })

    it("gère les erreurs de parsing JSON", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValueOnce("invalid json {{{")

      const result = loadAnswersFromStorage("exam_invalid")

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it("gère les erreurs localStorage silencieusement", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error("Storage access denied")
      })

      const result = loadAnswersFromStorage("exam_error")

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe("clearAnswersFromStorage", () => {
    it("supprime les réponses du localStorage", () => {
      const examId = "exam_clear"

      clearAnswersFromStorage(examId)

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        `exam_answers_${examId}`,
      )
    })

    it("gère les erreurs silencieusement", () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error("Storage error")
      })

      // Ne doit pas lever d'exception
      expect(() => clearAnswersFromStorage("exam_error")).not.toThrow()
    })
  })

  describe("Intégration complète", () => {
    it("cycle complet: save -> load -> clear", () => {
      const examId = "exam_integration"
      const answers = { q1: "A", q2: "B", q3: "C" }

      // Reset mock pour simulation réelle
      let storedValue: string | null = null
      localStorageMock.setItem.mockImplementation(
        (_key: string, value: string) => {
          storedValue = value
        },
      )
      localStorageMock.getItem.mockImplementation(() => storedValue)
      localStorageMock.removeItem.mockImplementation(() => {
        storedValue = null
      })

      // Save
      saveAnswersToStorage(examId, answers)
      expect(storedValue).not.toBeNull()

      // Load
      const loaded = loadAnswersFromStorage(examId)
      expect(loaded).toEqual(answers)

      // Clear
      clearAnswersFromStorage(examId)

      // Verify cleared
      localStorageMock.getItem.mockImplementation(() => null)
      const afterClear = loadAnswersFromStorage(examId)
      expect(afterClear).toBeNull()
    })
  })
})
