import { describe, expect, it } from "vitest"
import { parsePeriod, periodWindow } from "@/lib/dashboard-period"

describe("parsePeriod", () => {
  it("reconnaît les trois périodes de l'URL", () => {
    expect(parsePeriod("7")).toBe("7")
    expect(parsePeriod("30")).toBe("30")
    expect(parsePeriod("tout")).toBe("tout")
  })

  it("retombe sur 30 jours quand le paramètre est absent ou inconnu", () => {
    expect(parsePeriod(undefined)).toBe("30")
    expect(parsePeriod("90")).toBe("30")
    expect(parsePeriod(["7", "tout"])).toBe("30")
  })
})

describe("periodWindow", () => {
  // 11 h, heure avancée de l'Est.
  const monday = Date.parse("2026-09-28T15:00:00Z")

  it("ouvre 7 jours civils de l'Est, aujourd'hui compris, et la semaine d'avant", () => {
    expect(periodWindow("7", monday)).toEqual({
      from: new Date("2026-09-22T04:00:00Z"),
      previousFrom: new Date("2026-09-15T04:00:00Z"),
    })
  })

  it("ouvre 30 jours civils et les 30 précédents", () => {
    expect(periodWindow("30", monday)).toEqual({
      from: new Date("2026-08-30T04:00:00Z"),
      previousFrom: new Date("2026-07-31T04:00:00Z"),
    })
  })

  it("compte la journée de l'Est, pas celle d'UTC, en soirée", () => {
    // 22 h le 28 à Toronto, déjà le 29 en UTC.
    const evening = Date.parse("2026-09-29T02:00:00Z")
    expect(periodWindow("7", evening).from).toEqual(
      new Date("2026-09-22T04:00:00Z"),
    )
  })

  it("pose chaque borne sur minuit local de part et d'autre du changement d'heure", () => {
    // 10 h, heure normale ; la borne tombe encore en heure avancée.
    const november = Date.parse("2026-11-03T15:00:00Z")
    expect(periodWindow("7", november)).toEqual({
      from: new Date("2026-10-28T04:00:00Z"),
      previousFrom: new Date("2026-10-21T04:00:00Z"),
    })
  })

  it("n'a ni borne ni période précédente sur « Tout »", () => {
    expect(periodWindow("tout", monday)).toEqual({
      from: null,
      previousFrom: null,
    })
  })
})
