import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getAppZoneHour,
  getAppZoneYear,
  shiftCalendarDay,
  startOfAppZoneDay,
  startOfAppZoneMonth,
  startOfNextAppZoneDay,
  toAppZoneCalendarDay,
} from "@/lib/app-zone"
import {
  formatCompactDateTime,
  formatCurrency,
  formatDateTime,
  formatDeadline,
  formatExpiration,
  formatFullDateTime,
  formatLongDateTime,
  formatMediumDate,
  formatPaddedMediumDate,
  formatShortDate,
  formatTimeOnly,
  formatTimeRemaining,
  formatWeekdayLongDate,
  toCalendarDay,
} from "@/lib/format"

// Ces suites tournent sous TZ=UTC (vitest.config.ts) et assertent des valeurs
// heure de Toronto : un formateur qui retomberait sur le fuseau du runtime
// rendrait de l'UTC et échouerait ici. C'est le filet contre les mismatchs
// d'hydratation (SSR en UTC vs navigateur en heure locale).

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
    const timestamp = new Date("2025-12-20T12:00:00Z").getTime()
    const result = formatExpiration(timestamp)

    expect(result).toContain("20")
    expect(result).toContain("décembre")
    expect(result).toContain("2025")
  })

  it("rend la veille pour un instant UTC déjà passé minuit à Toronto", () => {
    // Minuit UTC le 25 = 19:00 le 24 à Toronto (EST). C'est ce décalage de
    // jour, invisible en UTC, qui cassait l'hydratation.
    const timestamp = new Date("2025-12-25T00:00:00Z").getTime()
    expect(formatExpiration(timestamp)).toBe("24 décembre 2025")
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
    expect(result).toContain("10:30")
  })

  it("utilise le format 24h", () => {
    const timestamp = new Date("2024-03-16T02:45:00Z").getTime()
    const result = formatDateTime(timestamp)

    // Vérifie que c'est bien en format 24h
    expect(result).toContain("22:45")
  })
})

describe("formatMediumDate", () => {
  it("formate en « d MMM yyyy » français", () => {
    const timestamp = new Date("2024-03-15T12:00:00Z").getTime()
    expect(formatMediumDate(timestamp)).toBe("15 mars 2024")
  })

  it("accepte une Date et abrège les mois longs", () => {
    expect(formatMediumDate(new Date("2024-07-03T12:00:00Z"))).toBe(
      "3 juil. 2024",
    )
  })
})

describe("formatLongDateTime", () => {
  it("formate en « d MMMM yyyy à HH:mm »", () => {
    const timestamp = new Date("2024-03-15T14:05:00Z").getTime()
    expect(formatLongDateTime(timestamp)).toBe("15 mars 2024 à 10:05")
  })
})

describe("formatFullDateTime", () => {
  it("formate la variante PPP avec l'heure", () => {
    const timestamp = new Date("2024-03-15T14:05:00Z").getTime()
    const result = formatFullDateTime(timestamp)
    expect(result).toContain("15 mars 2024")
    expect(result).toContain("à 10:05")
  })
})

describe("formatDeadline", () => {
  it("suffixe le fuseau pour lever l'ambiguïté hors Québec", () => {
    const timestamp = new Date("2024-03-15T14:05:00Z").getTime()
    expect(formatDeadline(timestamp)).toBe(
      "15 mars 2024 à 10:05 (heure de l'Est)",
    )
  })
})

describe("formatCompactDateTime", () => {
  it("formate en date + heure compactes", () => {
    const timestamp = new Date("2024-03-15T14:05:00Z").getTime()
    const result = formatCompactDateTime(timestamp)
    expect(result).toContain("15/03/2024")
    expect(result).toContain("10:05")
  })
})

describe("formatPaddedMediumDate", () => {
  it("préfixe le jour d'un zéro", () => {
    expect(formatPaddedMediumDate(new Date("2024-07-03T12:00:00Z"))).toBe(
      "03 juil. 2024",
    )
  })
})

describe("formatWeekdayLongDate", () => {
  it("inclut le jour de la semaine en français", () => {
    expect(formatWeekdayLongDate(new Date("2024-03-15T12:00:00Z"))).toBe(
      "vendredi 15 mars 2024",
    )
  })
})

describe("formatTimeOnly", () => {
  it("formate uniquement l'heure en HH:mm", () => {
    const timestamp = new Date("2024-03-15T14:30:00Z").getTime()
    const result = formatTimeOnly(timestamp)

    expect(result).toBe("10:30")
  })

  it("gère minuit", () => {
    const timestamp = new Date("2024-03-15T04:00:00Z").getTime()
    const result = formatTimeOnly(timestamp)

    expect(result).toBe("00:00")
  })

  it("gère midi", () => {
    const timestamp = new Date("2024-03-15T16:00:00Z").getTime()
    const result = formatTimeOnly(timestamp)

    expect(result).toBe("12:00")
  })
})

describe("getAppZoneHour", () => {
  it("rend l'heure de Toronto, pas celle du runtime", () => {
    // Horodatage exact de l'event NOMAQBANQ-5 du 2026-07-28 : 03:03 UTC, soit
    // 23:03 à Toronto. Le serveur lisait 3 (« Bonjour ») et le client 23
    // (« Bonsoir ») → texte divergent, hydratation cassée.
    expect(getAppZoneHour(new Date("2026-07-28T03:03:05Z"))).toBe(23)
  })

  it("reste du bon côté des seuils de salutation", () => {
    // 16:00 UTC = 12:00 à Toronto : « Bon après-midi » des deux côtés.
    expect(getAppZoneHour(new Date("2026-07-15T16:00:00Z"))).toBe(12)
    // 15:59 UTC = 11:59 : encore « Bonjour ».
    expect(getAppZoneHour(new Date("2026-07-15T15:59:00Z"))).toBe(11)
  })
})

describe("getAppZoneYear", () => {
  it("rend l'année de Toronto le soir du 31 décembre", () => {
    // Déjà 2027 en UTC, encore 2026 à Toronto (21:00 le 31/12).
    expect(getAppZoneYear(new Date("2027-01-01T02:00:00Z"))).toBe(2026)
  })
})

describe("invariant de fuseau", () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTz
  })

  // Le mismatch d'hydratation vient de deux runtimes aux fuseaux différents qui
  // rendent le même instant : on simule ici les deux côtés dans un seul process.
  it("rend la même chaîne quel que soit le fuseau du runtime", () => {
    const instant = new Date("2026-07-27T02:30:00Z").getTime()

    const rendus = [
      "UTC",
      "America/Toronto",
      "Asia/Tokyo",
      "Pacific/Kiritimati",
    ]
      .map((tz) => {
        process.env.TZ = tz
        return formatFullDateTime(instant)
      })
      .filter((v, _i, all) => v === all[0])

    expect(rendus).toHaveLength(4)
    expect(rendus[0]).toContain("26 juillet 2026")
    expect(rendus[0]).toContain("à 22:30")
  })

  it("applique l'heure avancée de l'Est en été comme en hiver", () => {
    // -5 h en janvier (EST), -4 h en juillet (EDT).
    expect(formatTimeOnly(new Date("2026-01-15T17:00:00Z").getTime())).toBe(
      "12:00",
    )
    expect(formatTimeOnly(new Date("2026-07-15T16:00:00Z").getTime())).toBe(
      "12:00",
    )
  })
})

describe("bornes de journée civile (filtres de date)", () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTz
  })

  it("ancre le début de journée sur Toronto, heure d'été comprise", () => {
    // 00:00 à Toronto = 04:00 UTC en EDT, 05:00 UTC en EST.
    expect(startOfAppZoneDay("2026-07-03").toISOString()).toBe(
      "2026-07-03T04:00:00.000Z",
    )
    expect(startOfAppZoneDay("2026-01-15").toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    )
  })

  it("borne haute = minuit du lendemain (exclusive), pas 23:59", () => {
    expect(startOfNextAppZoneDay("2026-07-03").toISOString()).toBe(
      "2026-07-04T04:00:00.000Z",
    )
    // Bascule de mois et d'année.
    expect(startOfNextAppZoneDay("2026-01-31").toISOString()).toBe(
      "2026-02-01T05:00:00.000Z",
    )
    expect(startOfNextAppZoneDay("2026-12-31").toISOString()).toBe(
      "2027-01-01T05:00:00.000Z",
    )
  })

  it("couvre la journée entière, y compris son dernier instant", () => {
    // Un compte créé à 23:30 le 3 juillet (heure de l'Est) s'affiche « 3 juil. »
    // dans la liste : une plage « 3 → 3 juillet » doit le retenir.
    const tardif = new Date("2026-07-04T03:30:00Z")
    expect(tardif >= startOfAppZoneDay("2026-07-03")).toBe(true)
    expect(tardif < startOfNextAppZoneDay("2026-07-03")).toBe(true)

    // Le premier instant du 4 juillet, lui, tombe hors de la plage.
    expect(
      new Date("2026-07-04T04:00:00Z") < startOfNextAppZoneDay("2026-07-03"),
    ).toBe(false)
  })

  it("suit les journées courtes et longues des changements d'heure", () => {
    const span = (day: string) =>
      (startOfNextAppZoneDay(day).getTime() -
        startOfAppZoneDay(day).getTime()) /
      3_600_000
    expect(span("2026-03-08")).toBe(23) // passage à l'heure avancée
    expect(span("2026-11-01")).toBe(25) // retour à l'heure normale
    expect(span("2026-07-03")).toBe(24)
  })

  it("refuse ce qui n'est pas une journée civile", () => {
    expect(() => startOfAppZoneDay("03/07/2026")).toThrow(/YYYY-MM-DD/)
    expect(() => startOfNextAppZoneDay("2026-07-03T00:00:00Z")).toThrow(
      /YYYY-MM-DD/,
    )
  })

  it("refuse une date hors calendrier plutôt que de la faire déborder", () => {
    // Sans contrôle, ces trois-là filtreraient sur une autre date, sans bruit :
    // 14 février 2027, 2 mars 2026, et 1926 (les années 0-99 sont décalées).
    expect(() => startOfAppZoneDay("2026-13-45")).toThrow(/YYYY-MM-DD/)
    expect(() => startOfAppZoneDay("2026-02-30")).toThrow(/YYYY-MM-DD/)
    expect(() => startOfNextAppZoneDay("0026-07-03")).toThrow(/YYYY-MM-DD/)
    // Le 29 février d'une année bissextile reste valide.
    expect(startOfAppZoneDay("2028-02-29").toISOString()).toBe(
      "2028-02-29T05:00:00.000Z",
    )
  })

  it("lit la journée du calendrier dans le fuseau du navigateur", () => {
    // Le date picker rend minuit LOCAL du jour cliqué : c'est cette case-là que
    // l'admin a désignée, quel que soit le fuseau depuis lequel il filtre.
    const jours = ["UTC", "America/Toronto", "Asia/Tokyo"].map((tz) => {
      process.env.TZ = tz
      return toCalendarDay(new Date(2026, 6, 3))
    })
    expect(jours).toEqual(["2026-07-03", "2026-07-03", "2026-07-03"])
  })
})

describe("mois civils et décalages de jours (agrégats admin)", () => {
  it("rend la journée de l'Est d'un instant, pas celle d'UTC", () => {
    // 01:00 UTC le 4 juillet = 21:00 le 3 juillet à Toronto : l'encaissement
    // appartient au 3, comme la date affichée dans la table des transactions.
    expect(toAppZoneCalendarDay(new Date("2026-07-04T01:00:00Z"))).toBe(
      "2026-07-03",
    )
  })

  it("enchaîne les journées sans en sauter au changement d'heure", () => {
    // Le 8 mars ne dure que 23 h à Toronto : une suite construite en
    // millisecondes y produirait un doublon.
    const jours = Array.from({ length: 5 }, (_, i) =>
      shiftCalendarDay("2026-03-10", -i),
    )
    expect(jours).toEqual([
      "2026-03-10",
      "2026-03-09",
      "2026-03-08",
      "2026-03-07",
      "2026-03-06",
    ])
  })

  it("décale une journée civile par-dessus mois et années", () => {
    expect(shiftCalendarDay("2026-03-01", -1)).toBe("2026-02-28")
    expect(shiftCalendarDay("2026-01-01", -1)).toBe("2025-12-31")
    expect(shiftCalendarDay("2026-12-31", 1)).toBe("2027-01-01")
    expect(shiftCalendarDay("2026-07-03", 0)).toBe("2026-07-03")
  })

  it("ancre le 1er du mois sur l'Est, décalage de mois compris", () => {
    expect(
      startOfAppZoneMonth(new Date("2026-08-15T12:00:00Z")).toISOString(),
    ).toBe("2026-08-01T04:00:00.000Z")
    // Janvier moins un mois → décembre de l'année précédente, en heure normale.
    expect(
      startOfAppZoneMonth(new Date("2026-01-15T12:00:00Z"), -1).toISOString(),
    ).toBe("2025-12-01T05:00:00.000Z")
  })

  it("reste sur le mois de l'Est le soir du dernier jour", () => {
    // 01:00 UTC le 1er août = 21:00 le 31 juillet à Toronto : le compteur
    // « ce mois » doit encore couvrir juillet.
    expect(
      startOfAppZoneMonth(new Date("2026-08-01T01:00:00Z")).toISOString(),
    ).toBe("2026-07-01T04:00:00.000Z")
  })
})
