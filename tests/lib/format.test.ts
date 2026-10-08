import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getAppZoneYear,
  shiftCalendarDay,
  startOfAppZoneDay,
  startOfAppZoneMonth,
  startOfNextAppZoneDay,
  toAppZoneCalendarDay,
} from "@/lib/app-zone"
import {
  formatCountdown,
  formatCurrency,
  formatDateTime,
  formatDayMonth,
  formatDeadline,
  formatExpiration,
  formatFileTimestamp,
  formatFullDateTime,
  formatIsoDay,
  formatMediumDate,
  formatMonthYear,
  formatPercent,
  formatPresentmentAmount,
  formatShortDate,
  formatShortDuration,
  formatTimeOnly,
  formatTimeRemaining,
  formatWeekdayDayMonth,
  formatWeekdayLongDate,
} from "@/lib/format"

// Ces suites tournent sous TZ=UTC (vitest.config.ts) et assertent des valeurs
// heure de Toronto : un formateur qui retomberait sur le fuseau du runtime
// rendrait de l'UTC et échouerait ici. C'est le filet contre les mismatchs
// d'hydratation (SSR en UTC vs navigateur en heure locale).

describe("formatPercent", () => {
  const normalizeSpaces = (str: string) => str.replace(/[  ]/g, " ")

  it("rend un pourcentage fr-CA, espace insécable avant le signe", () => {
    expect(normalizeSpaces(formatPercent(85))).toBe("85 %")
    expect(normalizeSpaces(formatPercent(0))).toBe("0 %")
  })

  it("arrondit à l'entier par défaut, ou au nombre de décimales demandé", () => {
    expect(normalizeSpaces(formatPercent(57.5))).toBe("58 %")
    expect(normalizeSpaces(formatPercent(12.34, { digits: 1 }))).toBe("12,3 %")
  })

  it("préfixe le signe d'une tendance quand on le demande", () => {
    expect(normalizeSpaces(formatPercent(12, { signed: true }))).toBe("+12 %")
    expect(
      normalizeSpaces(formatPercent(-3.2, { signed: true, digits: 1 })),
    ).toBe("-3,2 %")
    expect(normalizeSpaces(formatPercent(0, { signed: true }))).toBe("+0 %")
  })
})

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

    it("affiche les centimes sur deux chiffres", () => {
      expect(normalizeSpaces(formatCurrency(5050))).toBe("50,50 $")
      expect(normalizeSpaces(formatCurrency(9999))).toBe("99,99 $")
      expect(normalizeSpaces(formatCurrency(101))).toBe("1,01 $")
    })

    it("gère les montants à zéro", () => {
      expect(normalizeSpaces(formatCurrency(0))).toBe("0 $")
    })

    it("sépare les milliers", () => {
      expect(normalizeSpaces(formatCurrency(100000000))).toBe("1 000 000 $")
    })

    it("gère explicitement la devise CAD", () => {
      expect(normalizeSpaces(formatCurrency(5000, "CAD"))).toBe("50 $")
    })

    it("arrondit au dollar quand le montant est un total (whole)", () => {
      expect(
        normalizeSpaces(formatCurrency(5050, "CAD", { whole: true })),
      ).toBe("51 $")
      expect(
        normalizeSpaces(formatCurrency(5050, "XAF", { whole: true })),
      ).toBe("51 XAF")
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

    it("sépare les milliers", () => {
      expect(normalizeSpaces(formatCurrency(100000000, "XAF"))).toBe(
        "1 000 000 XAF",
      )
    })

    it("gère les montants à zéro", () => {
      expect(normalizeSpaces(formatCurrency(0, "XAF"))).toBe("0 XAF")
    })
  })
})

describe("formatPresentmentAmount", () => {
  // Toute espace Unicode (insecable, fine) est normalisee : Intl varie selon la
  // version d'ICU, et ce n'est pas ce qu'on teste ici.
  const flat = (s: string) => s.replace(/\s/g, " ")

  // Le piege : `formatCurrency` divise toujours par 100. Le XAF n'a pas de
  // sous-unite — 228 000 FCFA s'afficheraient en « 2 280 ».
  it("devise zéro-décimal : l'unité mineure EST l'unité", () => {
    const out = flat(formatPresentmentAmount(2280000, "xaf"))
    expect(out).toContain("2 280 000")
    expect(out).not.toContain("22 800")
  })

  it("devise à deux décimales : division par 100", () => {
    expect(flat(formatPresentmentAmount(5000, "cad"))).toContain("50")
  })

  it("code de devise inconnu d'Intl → repli lisible, pas d'exception", () => {
    expect(formatPresentmentAmount(1234, "zz")).toBe("1234 ZZ")
  })
})

describe("formatExpiration", () => {
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

  it.each([
    ["2024-03-16T12:00:00Z", "dans 1 jour"],
    ["2024-03-14T12:00:00Z", "il y a 1 jour"],
    ["2024-03-15T12:30:00Z", "dans 30 minutes"],
  ])("%s → %s", (iso, expected) => {
    expect(formatTimeRemaining(new Date(iso).getTime())).toBe(expected)
  })
})

describe("formatShortDuration", () => {
  it("heures et minutes sur deux chiffres, ou minutes seules", () => {
    expect(formatShortDuration(4 * 3_600_000 + 5 * 60_000)).toBe("4 h 05")
    expect(formatShortDuration(42 * 60_000)).toBe("42 min")
    expect(formatShortDuration(-5_000)).toBe("0 min")
  })
})

describe("formatCountdown", () => {
  it("jours, heures ou minutes selon l'échéance, jamais négatif", () => {
    expect(formatCountdown(2 * 86_400_000 + 3 * 3_600_000)).toBe("2 j 3 h")
    expect(formatCountdown(4 * 3_600_000 + 5 * 60_000)).toBe("4 h 05")
    expect(formatCountdown(12 * 60_000 + 7_000)).toBe("12 min 07 s")
    expect(formatCountdown(-1)).toBe("0 min 00 s")
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

describe("formatWeekdayLongDate", () => {
  it("inclut le jour de la semaine en français", () => {
    expect(formatWeekdayLongDate(new Date("2024-03-15T12:00:00Z"))).toBe(
      "vendredi 15 mars 2024",
    )
  })
})

describe("formatDayMonth", () => {
  it("jour et mois abrégé, dans la journée de l'Est", () => {
    // 1 h UTC le 28 = 21 h le 27 à Toronto.
    expect(formatDayMonth(Date.parse("2026-09-28T01:00:00Z"))).toBe("27 sept.")
  })
})

describe("formatMonthYear", () => {
  it("mois et année, dans le fuseau de l'Est", () => {
    // 1er avril 2 h UTC = 31 mars 22 h à Toronto.
    expect(formatMonthYear(Date.parse("2026-04-01T02:00:00Z"))).toBe(
      "mars 2026",
    )
  })
})

describe("formatWeekdayDayMonth", () => {
  it("jour de la semaine, quantième et mois, sans l'année", () => {
    expect(formatWeekdayDayMonth(Date.parse("2026-09-27T15:00:00Z"))).toBe(
      "dimanche 27 septembre",
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

describe("formatIsoDay", () => {
  it("formate un jour ISO en libellé court ou long", () => {
    expect(formatIsoDay("2026-07-03")).toBe("3 juil.")
    expect(formatIsoDay("2026-07-03", "weekday")).toBe(
      "vendredi 3 juillet 2026",
    )
  })

  it("rend l'entrée telle quelle quand elle n'est pas un jour ISO", () => {
    expect(formatIsoDay("pas une date")).toBe("pas une date")
  })
})

describe("formatFileTimestamp", () => {
  it("horodatage sans caractère interdit dans un nom de fichier", () => {
    expect(formatFileTimestamp(new Date(2026, 8, 27, 9, 5))).toBe(
      "27-09-2026_09-05",
    )
  })
})
