import { describe, expect, it } from "vitest"
import { SCORE_TONE_TEXT, scoreSoftClass, scoreTextClass } from "@/lib/score"
import { TONE_COLOR, TONE_SOFT, TONE_TEXT, type Tone } from "@/lib/tone"

const TONES: Tone[] = [
  "success",
  "warning",
  "danger",
  "info",
  "accent",
  "admin",
  "neutral",
]

// Verrou d'architecture, pas un test de composant : il ne vérifie aucun rendu,
// seulement que la table des tonalités nomme des jetons. Un test de composant
// ne cite jamais une classe CSS (règle de #235).
// Une classe utilitaire de couleur est « sémantique » si elle nomme un jeton
// de DESIGN.md (`success`, `ink`, `line`…), jamais une teinte de palette brute
// (`emerald-600`, `gray-400`) : c'est ce qui la fait suivre le thème sombre et
// tout changement de charte sans réécriture.
const SEMANTIC_CLASS =
  /^(text|bg|border|fill|stroke)-(success|danger|warning|accent|admin|objective|ink|surface|line)(-[a-z0-9-]+)?$/
const RAW_PALETTE =
  /(emerald|amber|red|blue|purple|orange|gray|slate|rose|green)-\d/

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean)

describe("lib/tone — correspondance tonalité → jetons", () => {
  it("couvre chaque tonalité dans les trois tables", () => {
    for (const tone of TONES) {
      expect(TONE_TEXT[tone]).toBeTruthy()
      expect(TONE_SOFT[tone]).toBeTruthy()
      expect(TONE_COLOR[tone]).toBeTruthy()
    }
  })

  it("n'emploie que des classes sémantiques, jamais la palette brute", () => {
    for (const table of [TONE_TEXT, TONE_SOFT]) {
      for (const value of Object.values(table)) {
        for (const cls of classesOf(value)) {
          expect(cls).toMatch(SEMANTIC_CLASS)
          expect(cls).not.toMatch(RAW_PALETTE)
        }
      }
    }
  })

  it("donne aux SVG et graphiques une variable CSS, pas une couleur figée", () => {
    for (const value of Object.values(TONE_COLOR)) {
      expect(value).toMatch(/^var\(--[a-z0-9-]+\)$/)
    }
  })
})

describe("lib/score — couleur d'un score tirée des tonalités", () => {
  it("le texte d'un score reprend la table des tonalités", () => {
    expect(SCORE_TONE_TEXT.success).toBe(TONE_TEXT.success)
    expect(SCORE_TONE_TEXT.warning).toBe(TONE_TEXT.warning)
    expect(SCORE_TONE_TEXT.danger).toBe(TONE_TEXT.danger)
    expect(scoreTextClass(85)).toBe(TONE_TEXT.success)
    expect(scoreTextClass(42)).toBe(TONE_TEXT.danger)
  })

  it("un score retenu est neutre, sans classe de palette brute", () => {
    for (const value of [scoreTextClass(null), scoreSoftClass(null)]) {
      for (const cls of classesOf(value)) {
        expect(cls).toMatch(SEMANTIC_CLASS)
      }
    }
    expect(scoreSoftClass(null)).not.toBe(scoreSoftClass(100))
    expect(scoreSoftClass(60)).toBe(TONE_SOFT.warning)
  })
})
