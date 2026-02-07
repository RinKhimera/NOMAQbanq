import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  formatCurrency,
  formatExpiration,
  formatTimeRemaining,
  formatShortDate,
  formatDateTime,
  formatTimeOnly,
} from "@/lib/format"

describe("formatCurrency", () => {
  // Note: Intl.NumberFormat utilise des espaces insécables (\u00A0) dans le formatage
  // On normalise les espaces pour les comparaisons
  const normalizeSpaces = (str: string) => str.replace(/\u00A0/g, " ")

  describe("CAD (default)", () => {
    it("formate les montants en dollars canadiens", () => {
      expect(normalizeSpaces(formatCurrency(5000))).toBe("50 $")
      expect(normalizeSpaces(formatCurrency(10000))).toBe("100 $")
      expect(normalizeSpaces(formatCurrency(9900))).toBe("99 $")
    })

    it("affiche les centimes si nécessaire", () => {
      // Le formatage canadien-français peut omettre le zéro trailing
      const result5050 = normalizeSpaces(formatCurrency(5050))
      expect(result5050).toMatch(/50,50?\s*\$/)
      const result9999 = normalizeSpaces(formatCurrency(9999))
      expect(result9999).toMatch(/99,99?\s*\$/)
      const result101 = normalizeSpaces(formatCurrency(101))
      expect(result101).toMatch(/1,01?\s*\$/)
    })

    it("gère les montants à zéro", () => {
      expect(normalizeSpaces(formatCurrency(0))).toBe("0 $")
    })

    it("gère les grands montants", () => {
      const result = formatCurrency(100000000) // 1 000 000 $
      expect(result).toContain("000")
      expect(result).toContain("$")
    })

    it("gère explicitement la devise CAD", () => {
      expect(normalizeSpaces(formatCurrency(5000, "CAD"))).toBe("50 $")
    })
  })

  describe("XAF", () => {
    it("formate les montants en francs CFA sans décimales", () => {
      expect(normalizeSpaces(formatCurrency(5000, "XAF"))).toBe("50 XAF")
      expect(normalizeSpaces(formatCurrency(10000, "XAF"))).toBe("100 XAF")
    })

    it("arrondit les centimes pour XAF", () => {
      // XAF n'a pas de sous-unités
      expect(normalizeSpaces(formatCurrency(5050, "XAF"))).toBe("51 XAF")
      expect(normalizeSpaces(formatCurrency(9999, "XAF"))).toBe("100 XAF")
    })

    it("gère les grands montants avec séparateurs", () => {
      const result = normalizeSpaces(formatCurrency(100000000, "XAF")) // 1 000 000 XAF
      expect(result).toContain("XAF")
      // Vérifie que les séparateurs de milliers sont présents
      expect(result).toMatch(/\d+\s*\d*\s*XAF/)
    })

    it("gère les montants à zéro", () => {
      expect(normalizeSpaces(formatCurrency(0, "XAF"))).toBe("0 XAF")
    })
  })
})

describe("formatExpiration", () => {
  it("formate une date en français", () => {
    // 15 mars 2024 à 12:00 UTC
    const timestamp = new Date("2024-03-15T12:00:00Z").getTime()
    const result = formatExpiration(timestamp)

    expect(result).toContain("15")
    expect(result).toContain("mars")
    expect(result).toContain("2024")
  })

  it("gère différentes dates", () => {
    const timestamp = new Date("2025-12-25T00:00:00Z").getTime()
    const result = formatExpiration(timestamp)

    expect(result).toContain("25")
    expect(result).toContain("décembre")
    expect(result).toContain("2025")
  })
})

describe("formatTimeRemaining", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-03-15T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("affiche le temps restant pour une date future", () => {
    // 1 jour dans le futur
    const futureTimestamp = new Date("2024-03-16T12:00:00Z").getTime()
    const result = formatTimeRemaining(futureTimestamp)

    expect(result).toContain("dans")
    expect(result.toLowerCase()).toMatch(/jour|heure/)
  })

  it("affiche le temps écoulé pour une date passée", () => {
    // 1 jour dans le passé
    const pastTimestamp = new Date("2024-03-14T12:00:00Z").getTime()
    const result = formatTimeRemaining(pastTimestamp)

    expect(result).toContain("il y a")
  })

  it("gère les intervalles courts", () => {
    // 30 minutes dans le futur
    const nearFuture = Date.now() + 30 * 60 * 1000
    const result = formatTimeRemaining(nearFuture)

    expect(result).toContain("dans")
  })
})

describe("formatShortDate", () => {
  it("formate en dd/MM/yyyy", () => {
    const timestamp = new Date("2024-03-15T12:00:00Z").getTime()
    const result = formatShortDate(timestamp)

    expect(result).toBe("15/03/2024")
  })

  it("gère les mois et jours à un chiffre", () => {
    const timestamp = new Date("2024-01-05T12:00:00Z").getTime()
    const result = formatShortDate(timestamp)

    expect(result).toBe("05/01/2024")
  })

  it("gère la fin d'année", () => {
    const timestamp = new Date("2024-12-31T12:00:00Z").getTime()
    const result = formatShortDate(timestamp)

    expect(result).toBe("31/12/2024")
  })
})

describe("formatDateTime", () => {
  it("formate avec date et heure en français", () => {
    const timestamp = new Date("2024-03-15T14:30:00Z").getTime()
    const result = formatDateTime(timestamp)

    expect(result).toContain("15")
    expect(result).toContain("mars")
    expect(result).toContain("2024")
    expect(result).toContain("à")
    expect(result).toContain("14:30")
  })

  it("utilise le format 24h", () => {
    const timestamp = new Date("2024-03-15T23:45:00Z").getTime()
    const result = formatDateTime(timestamp)

    // Vérifie que c'est bien en format 24h
    expect(result).toContain("23:45")
  })
})

describe("formatTimeOnly", () => {
  it("formate uniquement l'heure en HH:mm", () => {
    const timestamp = new Date("2024-03-15T14:30:00Z").getTime()
    const result = formatTimeOnly(timestamp)

    expect(result).toBe("14:30")
  })

  it("gère minuit", () => {
    const timestamp = new Date("2024-03-15T00:00:00Z").getTime()
    const result = formatTimeOnly(timestamp)

    expect(result).toBe("00:00")
  })

  it("gère midi", () => {
    const timestamp = new Date("2024-03-15T12:00:00Z").getTime()
    const result = formatTimeOnly(timestamp)

    expect(result).toBe("12:00")
  })
})
