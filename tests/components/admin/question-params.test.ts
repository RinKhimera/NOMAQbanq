import { describe, expect, it } from "vitest"
import {
  DEFAULT_QUESTION_LIST,
  pageOfPosition,
  panelFilterCount,
  parseQuestionList,
  questionHref,
  serializeQuestionList,
  toQuestionFilters,
  withChange,
} from "@/app/(admin)/admin/questions/_components/question-params"

const parse = (query: string) => parseQuestionList(new URLSearchParams(query))

describe("état d'URL de la liste des questions", () => {
  it("une URL nue donne la liste par défaut, et la liste par défaut une URL nue", () => {
    expect(parse("")).toEqual(DEFAULT_QUESTION_LIST)
    expect(serializeQuestionList(DEFAULT_QUESTION_LIST).toString()).toBe("")
  })

  it("aller-retour complet", () => {
    const state = {
      ...DEFAULT_QUESTION_LIST,
      q: "dyspnée",
      tab: "toVerify" as const,
      domain: "Cardiologie",
      objective: "Douleur thoracique",
      images: "with" as const,
      notUsedSince: 3,
      exam: "e1",
      sort: "answerCount" as const,
      order: "asc" as const,
      page: 4,
    }
    expect(parseQuestionList(serializeQuestionList(state))).toEqual(state)
  })

  it("un objectif sans domaine est ignoré", () => {
    expect(parse("objectif=Toux").objective).toBe("")
  })

  it("valeurs forgées : retombent sur le défaut, « depuis » plafonné à 20", () => {
    const s = parse("onglet=x&images=y&tri=z&page=-2&depuis=99")
    expect(s.tab).toBe("all")
    expect(s.images).toBe("all")
    expect(s.sort).toBe("createdAt")
    expect(s.page).toBe(1)
    expect(s.notUsedSince).toBe(20)
  })

  it("un tri activé sans sens prend son sens premier : les moins réussies d'abord", () => {
    expect(parse("tri=reussite").order).toBe("asc")
    expect(parse("tri=reponses").order).toBe("desc")
  })

  it("changer de domaine vide l'objectif et ramène en page 1", () => {
    const s = { ...DEFAULT_QUESTION_LIST, domain: "A", objective: "O", page: 3 }
    expect(withChange(s, { domain: "B" })).toMatchObject({
      domain: "B",
      objective: "",
      page: 1,
    })
    expect(withChange(s, { images: "with" })).toMatchObject({
      objective: "O",
      page: 1,
    })
  })

  it("l'onglet devient un filtre de la DAL, 20 lignes par page", () => {
    expect(
      toQuestionFilters({ ...DEFAULT_QUESTION_LIST, tab: "noReferences" }),
    ).toMatchObject({ noReferences: true, toVerify: undefined, limit: 20 })
    expect(
      toQuestionFilters({ ...DEFAULT_QUESTION_LIST, tab: "toVerify" }),
    ).toMatchObject({ toVerify: true, noReferences: undefined })
  })

  it("compte les filtres du panneau, pas la recherche ni le domaine", () => {
    expect(
      panelFilterCount({
        ...DEFAULT_QUESTION_LIST,
        q: "x",
        domain: "A",
        objective: "O",
        notUsedSince: 3,
      }),
    ).toBe(2)
  })

  it("le détail porte la liste d'où l'on vient", () => {
    expect(
      questionHref("q1", { ...DEFAULT_QUESTION_LIST, q: "toux", page: 2 }),
    ).toBe("/admin/questions/q1?q=toux&page=2")
    expect(questionHref("q1", DEFAULT_QUESTION_LIST)).toBe(
      "/admin/questions/q1",
    )
  })

  it("page d'une position (1-based)", () => {
    expect(pageOfPosition(1)).toBe(1)
    expect(pageOfPosition(20)).toBe(1)
    expect(pageOfPosition(21)).toBe(2)
  })
})
