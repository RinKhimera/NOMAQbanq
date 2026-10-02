import { describe, expect, it } from "vitest"
import {
  changedLabel,
  composerLead,
  counterOf,
  fullDomainPlan,
  groupSelection,
  isRecent,
  lastUseAgo,
  lastUseLabel,
  matchesQuery,
  rangeLabel,
  selectionAlerts,
} from "@/app/(admin)/admin/examens/[id]/questions/_components/composer-model"
import { MEDICAL_DOMAINS } from "@/constants"
import type { BankQuestion, LastUse } from "@/features/questions/dal"

// Midi à Toronto : loin de minuit dans les deux fuseaux.
const NOW = Date.UTC(2026, 9, 1, 16)
const DAY = 86_400_000

const use = (over: Partial<LastUse> = {}): LastUse => ({
  examId: "other",
  title: "EB-25",
  startDate: NOW - 14 * DAY,
  recent: true,
  ...over,
})

const q = (over: Partial<BankQuestion> = {}): BankQuestion => ({
  id: "q1",
  question: "Un patient présente une douleur thoracique.",
  domain: "Cardiologie",
  objectifCMC: "Douleur thoracique",
  options: ["Infarctus", "Péricardite"],
  createdAt: NOW,
  updatedAt: NOW,
  imageCount: 0,
  usageCount: 0,
  answerCount: 0,
  successRate: null,
  keyToVerify: false,
  lastUse: null,
  deleted: false,
  ...over,
})

describe("dernière utilisation", () => {
  it("relatif en journées : passé, aujourd'hui, à venir", () => {
    expect(lastUseAgo(NOW - 3 * DAY, NOW)).toBe("il y a 3 j")
    expect(lastUseAgo(NOW - 14 * DAY, NOW)).toBe("il y a 2 sem.")
    expect(lastUseAgo(NOW - 90 * DAY, NOW)).toBe("il y a 3 mois")
    expect(lastUseAgo(NOW - 800 * DAY, NOW)).toBe("il y a 2 ans")
    expect(lastUseAgo(NOW, NOW)).toBe("aujourd'hui")
    expect(lastUseAgo(NOW + 9 * DAY, NOW)).toBe("dans 9 j")
    expect(lastUseLabel(use(), NOW)).toBe("EB-25 · il y a 2 sem.")
  })

  it("récente : la dernière utilisation est l'un des derniers examens", () => {
    expect(isRecent(q({ lastUse: use() }))).toBe(true)
    expect(isRecent(q({ lastUse: use({ recent: false }) }))).toBe(false)
    expect(isRecent(q())).toBe(false)
  })
})

describe("compteur du jeu", () => {
  it("incomplet, complet, en trop, figé", () => {
    expect(counterOf({ count: 140, target: 230, frozen: false })).toEqual({
      need: 90,
      over: 0,
      tone: "accent",
      message: "Il reste 90 questions à choisir.",
    })
    expect(counterOf({ count: 230, target: 230, frozen: false })).toMatchObject(
      {
        need: 0,
        tone: "success",
        message: "Le jeu est complet : finalisez l'examen.",
      },
    )
    expect(counterOf({ count: 233, target: 230, frozen: false })).toMatchObject(
      { over: 3, tone: "danger", message: "Retirez 3 questions." },
    )
    expect(counterOf({ count: 229, target: 230, frozen: false }).message).toBe(
      "Il reste 1 question à choisir.",
    )
    expect(counterOf({ count: 10, target: 230, frozen: true }).message).toBe(
      "Jeu de questions figé depuis la première participation.",
    )
  })

  it("sous-titre selon la phase, « figé » prime", () => {
    expect(composerLead("EB-27", "preparation", false)).toBe(
      "EB-27 · en préparation",
    )
    expect(composerLead("EB-27", "upcoming", false)).toBe("EB-27 · à venir")
    expect(composerLead("EB-27", "active", true)).toBe(
      "EB-27 · jeu de questions figé",
    )
  })
})

describe("sélection", () => {
  it("recherche sans accents ni casse sur énoncé, choix, objectif, identifiant exact", () => {
    expect(matchesQuery(q(), "THORACIQUE")).toBe(true)
    expect(matchesQuery(q(), "pericardite")).toBe(true)
    expect(matchesQuery(q(), "q1")).toBe(true)
    expect(matchesQuery(q(), "zz")).toBe(false)
    expect(matchesQuery(q(), "  ")).toBe(true)
  })

  it("groupée dans l'ordre des domaines, groupes vides omis, filtre local", () => {
    const items = [
      q({ id: "a", domain: "Pédiatrie" }),
      q({ id: "b", domain: "Cardiologie" }),
      q({
        id: "c",
        domain: "Pédiatrie",
        question: "Fièvre",
        objectifCMC: "x",
        options: [],
      }),
    ]
    expect(
      groupSelection(items, "").map((g) => [g.domain, g.rows.map((r) => r.id)]),
    ).toEqual([
      ["Cardiologie", ["b"]],
      ["Pédiatrie", ["a", "c"]],
    ])
    expect(groupSelection(items, "fievre").map((g) => g.domain)).toEqual([
      "Pédiatrie",
    ])
  })

  it("alertes : récentes hors examen composé, clés à vérifier", () => {
    expect(
      selectionAlerts([
        q({ lastUse: use() }),
        q({ lastUse: use({ recent: false }), keyToVerify: true }),
      ]),
    ).toEqual({ recent: 1, toVerify: 1, deleted: 0 })
  })
})

describe("plan par domaine", () => {
  it("les 22 domaines, absents à 0, un domaine hors liste en fin", () => {
    const plan = fullDomainPlan([
      { domain: "Cardiologie", chosen: 12, available: 80, recent: 4 },
      { domain: "Zoologie", chosen: 0, available: 1, recent: 0 },
    ])
    expect(plan).toHaveLength(MEDICAL_DOMAINS.length + 1)
    expect(plan.find((r) => r.domain === "Cardiologie")?.chosen).toBe(12)
    expect(plan.find((r) => r.domain === "ORL")).toEqual({
      domain: "ORL",
      chosen: 0,
      available: 0,
      recent: 0,
    })
    expect(plan.at(-1)?.domain).toBe("Zoologie")
    expect(plan[0].domain).toBe(MEDICAL_DOMAINS[0])
  })
})

describe("libellés", () => {
  it("plage de la page et toasts", () => {
    expect(rangeLabel(2, 20, 153)).toBe("21–40 sur 153")
    expect(rangeLabel(8, 20, 153)).toBe("141–153 sur 153")
    expect(changedLabel(1, "ajoutée")).toBe("1 question ajoutée")
    expect(changedLabel(12, "retirée")).toBe("12 questions retirées")
  })
})
