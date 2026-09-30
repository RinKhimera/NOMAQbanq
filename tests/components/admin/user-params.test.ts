import { describe, expect, it } from "vitest"
import {
  DEFAULT_USER_LIST,
  parseUserList,
  serializeUserList,
  toUsersFilters,
  withChange,
} from "@/app/(admin)/admin/utilisateurs/_components/user-params"

// 27 septembre 2026, 11 h 02, heure de l'Est.
const NOW = Date.UTC(2026, 8, 27, 15, 2)

describe("état de la liste dans l'URL", () => {
  it("aller-retour URL ↔ état", () => {
    const state = {
      ...DEFAULT_USER_LIST,
      q: "nadia",
      role: "user" as const,
      suspended: true,
      segment: "expiring" as const,
      sort: "lastLogin" as const,
      order: "asc" as const,
      page: 3,
    }
    const url = serializeUserList(state)
    expect(url.toString()).toBe(
      "q=nadia&role=etudiants&suspendus=1&segment=bientot&tri=connexion&ordre=asc&page=3",
    )
    expect(parseUserList(url)).toEqual(state)
  })

  it("état par défaut : URL vide ; valeurs inconnues ignorées", () => {
    expect(serializeUserList(DEFAULT_USER_LIST).toString()).toBe("")
    expect(
      parseUserList(new URLSearchParams("segment=xyz&page=-2&du=hier")),
    ).toEqual(DEFAULT_USER_LIST)
  })

  it("changer recherche, segment ou filtre ramène en page 1", () => {
    const page4 = { ...DEFAULT_USER_LIST, page: 4 }
    expect(withChange(page4, { segment: "never" }).page).toBe(1)
    expect(withChange(page4, { q: "x" }).page).toBe(1)
    expect(withChange(page4, { suspended: true }).page).toBe(1)
  })
})

describe("toUsersFilters", () => {
  it("périodes en journées de l'Est", () => {
    const at = (period: "month" | "30" | "90") =>
      toUsersFilters({ ...DEFAULT_USER_LIST, period }, NOW).dateFrom
    expect(at("month")).toBe("2026-09-01")
    expect(at("30")).toBe("2026-08-28")
    expect(at("90")).toBe("2026-06-29")
  })

  it("dates au choix, bornes incluses", () => {
    const f = toUsersFilters(
      {
        ...DEFAULT_USER_LIST,
        period: "custom",
        from: "2026-07-01",
        to: "2026-07-03",
      },
      NOW,
    )
    expect(f).toMatchObject({ dateFrom: "2026-07-01", dateTo: "2026-07-03" })
  })

  it("« Tous » n'envoie ni rôle ni suspendus", () => {
    expect(toUsersFilters(DEFAULT_USER_LIST, NOW)).toEqual({
      search: undefined,
      role: undefined,
      segment: "all",
      suspended: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  })
})
