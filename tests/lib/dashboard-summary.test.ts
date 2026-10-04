import { describe, expect, it } from "vitest"
import {
  dashboardSummary,
  isNewcomer,
  weakestDomain,
} from "@/lib/dashboard-summary"

const domain = (name: string, mastery: number | null, answered = 10) => ({
  domain: name,
  mastery,
  answered,
})

describe("weakestDomain", () => {
  it("le domaine significatif le moins maîtrisé", () => {
    expect(
      weakestDomain([
        domain("Cardiologie", 72),
        domain("Pédiatrie", 48),
        domain("Psychiatrie", 90),
      ]),
    ).toBe("Pédiatrie")
  })

  it("ignore un domaine peu pratiqué ou jamais pratiqué", () => {
    expect(
      weakestDomain([
        domain("Cardiologie", 72),
        domain("Pédiatrie", 0, 2),
        domain("Néphrologie", null, 0),
      ]),
    ).toBe("Cardiologie")
  })

  it("aucun sans domaine significatif", () => {
    expect(weakestDomain([domain("Pédiatrie", 30, 4)])).toBeNull()
  })
})

describe("dashboardSummary", () => {
  it("progression et domaine faible", () => {
    expect(
      dashboardSummary({ period: "30", trend: 4, weakest: "Pédiatrie" }),
    ).toBe(
      "Votre score moyen a progressé de 4 points sur 30 jours. Pédiatrie reste votre domaine le plus faible.",
    )
  })

  it("recul, au singulier", () => {
    expect(dashboardSummary({ period: "7", trend: -1, weakest: null })).toBe(
      "Votre score moyen a reculé de 1 point sur 7 jours.",
    )
  })

  it("score stable", () => {
    expect(dashboardSummary({ period: "7", trend: 0, weakest: null })).toBe(
      "Votre score moyen est stable sur 7 jours.",
    )
  })

  it("sans tendance (« Tout », ou une période vide) : le domaine seul", () => {
    expect(
      dashboardSummary({ period: "tout", trend: null, weakest: "Pédiatrie" }),
    ).toBe("Pédiatrie reste votre domaine le plus faible.")
  })

  it("rien à dire : une phrase d'accueil neutre", () => {
    expect(dashboardSummary({ period: "30", trend: null, weakest: null })).toBe(
      "Suivez ici vos scores, vos séries et votre maîtrise par domaine.",
    )
  })
})

describe("isNewcomer", () => {
  const fresh = {
    isAdmin: false,
    hasAccess: false,
    hasHistory: false,
    hasExamInProgress: false,
    hasLapsedAccess: false,
  }

  it("aucun accès, aucun historique, rien en cours : nouvel inscrit", () => {
    expect(isNewcomer(fresh)).toBe(true)
  })

  it("un examen commencé (audience restreinte, sans abonnement) garde le tableau complet", () => {
    expect(isNewcomer({ ...fresh, hasExamInProgress: true })).toBe(false)
  })

  it("un accès expiré, même jamais utilisé, garde le tableau complet (alerte Réactiver)", () => {
    expect(isNewcomer({ ...fresh, hasLapsedAccess: true })).toBe(false)
  })

  it("admin, accès actif ou historique : jamais nouvel inscrit", () => {
    expect(isNewcomer({ ...fresh, isAdmin: true })).toBe(false)
    expect(isNewcomer({ ...fresh, hasAccess: true })).toBe(false)
    expect(isNewcomer({ ...fresh, hasHistory: true })).toBe(false)
  })
})
