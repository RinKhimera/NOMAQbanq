import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROGRESSION_LIST,
  FROM_LIST_PARAM,
  cleared,
  parseProgressionList,
  progressionListHref,
  serializeProgressionList,
  studentProgressHref,
  toProgressFilters,
} from "@/app/(admin)/admin/progression/_components/progression-params"
import { adminProgressionHref } from "@/lib/admin-links"
import { pageOfPosition } from "@/lib/admin-progression"

describe("état d'URL du tableau de progression", () => {
  it("un tableau par défaut n'écrit aucun paramètre", () => {
    expect(progressionListHref(DEFAULT_PROGRESSION_LIST)).toBe(
      "/admin/progression",
    )
  })

  it("relit ce qu'il écrit : recherche, accès, actifs, période, tri, page", () => {
    const state = {
      q: "awa",
      access: "expired",
      activeOnly: true,
      period: "7",
      sort: "score",
      order: "asc",
      page: 3,
    } as const
    const params = serializeProgressionList(state)

    expect(params.toString()).toBe(
      "q=awa&acces=expire&actifs=1&periode=7&tri=score&ordre=asc&page=3",
    )
    expect(parseProgressionList(params)).toEqual(state)
  })

  it("ignore une valeur inconnue au profit du défaut", () => {
    expect(
      parseProgressionList(
        new URLSearchParams("acces=tous&periode=90&tri=nom&page=-2"),
      ),
    ).toEqual(DEFAULT_PROGRESSION_LIST)
  })

  it("le lien d'un étudiant porte le tableau et le marqueur de liste ; celui de la fiche, non", () => {
    expect(
      studentProgressHref("u1", { ...DEFAULT_PROGRESSION_LIST, period: "7" }),
    ).toBe(`/admin/progression/u1?periode=7&${FROM_LIST_PARAM}=1`)
    expect(adminProgressionHref("u1")).toBe("/admin/progression/u1")
  })

  it("« Effacer » garde la période et le tri", () => {
    const state = {
      ...DEFAULT_PROGRESSION_LIST,
      q: "x",
      access: "none",
      activeOnly: true,
      period: "tout",
      sort: "days",
      page: 4,
    } as const
    expect(cleared(state)).toEqual({
      ...DEFAULT_PROGRESSION_LIST,
      period: "tout",
      sort: "days",
    })
  })

  it("donne à la DAL des filtres sans valeur par défaut", () => {
    expect(toProgressFilters(DEFAULT_PROGRESSION_LIST)).toEqual({
      search: undefined,
      access: undefined,
      activeOnly: undefined,
      period: "30",
      sortBy: "lastActivity",
      sortOrder: "desc",
    })
  })

  it("situe une position sur sa page de 20", () => {
    expect([1, 20, 21, 40, 41].map(pageOfPosition)).toEqual([1, 1, 2, 2, 3])
  })
})
