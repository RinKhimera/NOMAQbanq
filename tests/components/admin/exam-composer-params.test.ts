import { describe, expect, it } from "vitest"
import {
  DEFAULT_COMPOSER,
  cleared,
  parseComposer,
  serializeComposer,
  toBankFilters,
  withChange,
} from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-params"
import { composerReturnHref } from "@/constants/exam-routes"

const parse = (query: string) => parseComposer(new URLSearchParams(query))

describe("état d'URL du compositeur", () => {
  it("une URL nue donne la banque par défaut : tri par dernière utilisation, retour au formulaire", () => {
    expect(parse("")).toEqual(DEFAULT_COMPOSER)
    expect(serializeComposer(DEFAULT_COMPOSER).toString()).toBe(
      "retour=formulaire",
    )
  })

  it("aller-retour de tous les paramètres", () => {
    const query =
      "q=asthme&domaine=Cardiologie&depuis=5&tri=reussite&page=3&retour=fiche"
    const state = parse(query)
    expect(state).toEqual({
      q: "asthme",
      domain: "Cardiologie",
      notUsedSince: 5,
      sort: "successRate",
      page: 3,
      back: "fiche",
    })
    expect(serializeComposer(state).toString()).toBe(query)
  })

  it("valeurs invalides ramenées aux défauts, K plafonné à 20", () => {
    expect(parse("depuis=0&page=-2&tri=inconnu&retour=ailleurs")).toEqual(
      DEFAULT_COMPOSER,
    )
    expect(parse("depuis=99").notUsedSince).toBe(20)
  })

  it("un changement de filtre ramène en page 1 ; effacer garde le tri et le retour", () => {
    const s = parse("q=x&depuis=3&tri=domaine&page=4&retour=fiche")
    expect(withChange(s, { domain: "ORL" })).toMatchObject({
      domain: "ORL",
      page: 1,
      q: "x",
    })
    expect(cleared(s)).toEqual({
      ...DEFAULT_COMPOSER,
      sort: "domain",
      back: "fiche",
    })
  })

  it("filtres lus par la banque : vides absents", () => {
    expect(toBankFilters(DEFAULT_COMPOSER)).toEqual({
      search: undefined,
      domain: undefined,
      notUsedInLast: undefined,
      sortBy: "lastUse",
      page: 1,
    })
    expect(toBankFilters(parse("q=a&domaine=ORL&depuis=3&page=2"))).toEqual({
      search: "a",
      domain: "ORL",
      notUsedInLast: 3,
      sortBy: "lastUse",
      page: 2,
    })
  })

  it("« Terminé » ramène à la fiche ou au formulaire", () => {
    expect(composerReturnHref("e1", "fiche")).toBe("/admin/examens/e1")
    expect(composerReturnHref("e1", "formulaire")).toBe(
      "/admin/examens/modifier/e1",
    )
  })
})
