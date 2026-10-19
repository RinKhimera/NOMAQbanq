import { describe, expect, it } from "vitest"
import {
  analyticsBeforeSend,
  speedInsightsBeforeSend,
} from "@/lib/vercel-insights"

const ORIGIN = "https://nomaqbanq.ca"
const pageview = (path: string) => ({
  type: "pageview" as const,
  url: `${ORIGIN}${path}`,
})

const SERIES_IN_PROGRESS = "/tableau-de-bord/entrainement/sess_1"
const MOCK_EXAM_IN_PROGRESS = "/tableau-de-bord/examen-blanc/exam_1/evaluation"

describe("analyticsBeforeSend", () => {
  it.each([
    "/",
    "/domaines/cardiologie",
    "/evaluation/quiz",
    "/tableau-de-bord/entrainement",
    "/tableau-de-bord/entrainement/sess_1/resultats",
    "/tableau-de-bord/examen-blanc",
    "/tableau-de-bord/examen-blanc/exam_1/resultats",
  ])("garde %s", (path) => {
    expect(analyticsBeforeSend(pageview(path))).toEqual(pageview(path))
  })

  it.each([SERIES_IN_PROGRESS, MOCK_EXAM_IN_PROGRESS])(
    "abandonne la passation %s",
    (path) => {
      expect(analyticsBeforeSend(pageview(path))).toBeNull()
    },
  )
})

describe("speedInsightsBeforeSend", () => {
  it.each([SERIES_IN_PROGRESS, MOCK_EXAM_IN_PROGRESS])(
    "mesure la passation %s",
    (path) => {
      expect(speedInsightsBeforeSend(pageview(path))).toEqual(pageview(path))
    },
  )
})

describe("filtres communs", () => {
  it.each([
    ["Web Analytics", analyticsBeforeSend],
    ["Speed Insights", speedInsightsBeforeSend],
  ])("%s : un jeton d'URL ne part pas", (_, beforeSend) => {
    expect(
      beforeSend(pageview("/reinitialiser-mot-de-passe?token=secret")),
    ).toEqual(pageview("/reinitialiser-mot-de-passe"))
  })

  it.each([
    ["Web Analytics", analyticsBeforeSend],
    ["Speed Insights", speedInsightsBeforeSend],
  ])("%s : chaîne de requête et fragment retirés ensemble", (_, beforeSend) => {
    expect(beforeSend(pageview("/tarifs?session_id=cs_123#combo"))).toEqual(
      pageview("/tarifs"),
    )
  })

  it.each([
    ["Web Analytics", analyticsBeforeSend],
    ["Speed Insights", speedInsightsBeforeSend],
  ])("%s : la zone admin n'est pas mesurée", (_, beforeSend) => {
    expect(beforeSend(pageview("/admin"))).toBeNull()
    expect(beforeSend(pageview("/admin/questions/abc"))).toBeNull()
    expect(beforeSend(pageview("/admin?onglet=x"))).toBeNull()
  })

  it.each([
    ["Web Analytics", analyticsBeforeSend],
    ["Speed Insights", speedInsightsBeforeSend],
  ])(
    "%s : une page qui commence par « admin » sans en être reste mesurée",
    (_, beforeSend) => {
      expect(beforeSend(pageview("/administration-eacmc"))).toEqual(
        pageview("/administration-eacmc"),
      )
    },
  )
})
