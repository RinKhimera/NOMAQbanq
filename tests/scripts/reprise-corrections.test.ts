import { describe, expect, it } from "vitest"
import type { FormatIssue } from "@/features/questions/normalization"
import {
  type RepairOutcome,
  countByAction,
  formatReport,
} from "@/scripts/reprise-corrections"

const meta = {
  apply: false,
  host: "ep-test.neon.tech",
  date: new Date(0),
  baseUrl: "https://nomaqbanq.ca",
}

const gap: FormatIssue = {
  code: "numbering-gap",
  field: "references",
  index: 1,
  message: "La numérotation de ce champ est interrompue ou répétée.",
}
const lowercase: FormatIssue = {
  code: "lowercase-start",
  field: "explanation",
  message: "L'explication commence par une minuscule.",
}

const split: RepairOutcome = {
  id: "q-split",
  action: "write",
  before: {
    explanation: "Texte.",
    references: ["1.\nSource A.\n2.\nSource B."],
  },
  after: { explanation: "Texte.", references: ["Source A.", "Source B."] },
  issues: [],
}
const flagged: RepairOutcome = {
  id: "q-lower",
  action: "write",
  before: { explanation: "a maladie.\n[1]", references: ["Source A. "] },
  after: { explanation: "a maladie. [1]", references: ["Source A."] },
  issues: [lowercase],
}
const held: RepairOutcome = {
  id: "q-gap",
  action: "review",
  before: { explanation: "Texte.", references: ["Source A.", "1.\nX\n3.\nY"] },
  issues: [gap],
}
const clean: RepairOutcome = {
  id: "q-clean",
  action: "skip",
  before: { explanation: "Texte.", references: null },
  issues: [],
}

const link = (id: string) =>
  `[${id}](https://nomaqbanq.ca/admin/questions/${id}/modifier)`

describe("formatReport", () => {
  it("compte chaque catégorie et nomme la base ciblée", () => {
    const report = formatReport([split, flagged, held, clean], meta)

    expect(report).toContain("passage à blanc")
    expect(report).toContain("`ep-test.neon.tech`")
    expect(report).toContain("| À mettre en forme | 2 |")
    expect(report).toContain("| Déjà propres (sautées) | 1 |")
    expect(report).toContain("| À vérifier, rien écrit | 1 |")
    expect(report).toContain("| **Total** | 4 |")
    expect(report).toContain("dont 1 à écrire quand même")
    expect(report).not.toContain("Modifiées depuis la lecture")
  })

  it("montre un découpage avant/après, une source par ligne numérotée", () => {
    const report = formatReport([split, flagged], meta)

    expect(report).toContain("### q-split")
    expect(report).toContain("Avant : 1 référence(s)")
    expect(report).toContain("1. Source A.\n2. Source B.")
  })

  it("montre aussi une explication remise en forme", () => {
    const report = formatReport([split, flagged], meta)
    const section = report.split(
      "## Échantillons avant / après : explications",
    )[1]

    expect(section).toContain("### q-lower")
    expect(section).toContain("a maladie. [1]")
    expect(section).not.toContain("### q-split")
  })

  it("liste les questions à vérifier avec motif, position et lien d'édition absolu", () => {
    const report = formatReport([split, flagged, held, clean], meta)

    expect(report).toContain(
      `| ${link("q-gap")} | rien écrit | Référence 2 : ${gap.message} |`,
    )
    expect(report).toContain(
      `| ${link("q-lower")} | à écrire | ${lowercase.message} |`,
    )
    expect(report).not.toContain("[q-split]")
    expect(report).not.toContain("[q-clean]")
    expect(report.indexOf("[q-gap]")).toBeLessThan(report.indexOf("[q-lower]"))
  })

  it("à l'application, une question modifiée entre-temps est comptée et à relancer", () => {
    const conflict: RepairOutcome = {
      ...split,
      id: "q-race",
      action: "conflict",
    }
    const report = formatReport([split, conflict], { ...meta, apply: true })

    expect(report).toContain("# Reprise des corrections — application")
    expect(report).toContain("| Mises en forme | 1 |")
    expect(report).toContain("| Modifiées depuis la lecture (sautées) | 1 |")
    expect(report).toContain(
      `| ${link("q-race")} | modifiée depuis la lecture | Relancer la reprise pour cette question. |`,
    )
  })

  it("rien à vérifier : le dit plutôt qu'un tableau vide", () => {
    expect(formatReport([clean], meta)).toMatch(
      /## Mise en forme à vérifier\n\nAucune\.\n$/,
    )
  })

  it("les échantillons couvrent toute la liste, pas seulement les premiers ids", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...split,
      id: `q-${String(i).padStart(2, "0")}`,
    }))
    const report = formatReport(many, meta)

    expect(report).toContain("### q-00")
    expect(report).toContain("### q-16")
    expect(report).not.toContain("### q-01")
  })
})

describe("countByAction", () => {
  it("compte chaque action, zéro compris", () => {
    expect(countByAction([split, flagged, held])).toEqual({
      write: 2,
      skip: 0,
      review: 1,
      conflict: 0,
    })
  })
})
