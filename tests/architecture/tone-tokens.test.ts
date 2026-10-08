import { describe, expect, it } from "vitest"
import { SCORE_TONE_TEXT, scoreTextClass } from "@/lib/score"
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
// ne cite jamais une classe CSS.
// Une classe utilitaire de couleur est « sémantique » si elle nomme un jeton
// de DESIGN.md (`success`, `ink`, `line`…), jamais une teinte de palette brute
// (`emerald-600`, `gray-400`) : c'est ce qui la fait suivre le thème sombre et
// tout changement de charte sans réécriture. La palette brute elle-même est
// traquée dans `lib/` par `forbidden-styles.test.ts`.
const SEMANTIC_CLASS =
  /^(text|bg|border|fill|stroke)-(success|danger|warning|accent|admin|objective|ink|surface|line)(-[a-z0-9-]+)?$/

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean)

describe("lib/tone — correspondance tonalité → jetons", () => {
  it("couvre chaque tonalité dans les trois tables", () => {
    for (const tone of TONES) {
      expect(TONE_TEXT[tone]).toBeTruthy()
      expect(TONE_SOFT[tone]).toBeTruthy()
      expect(TONE_COLOR[tone]).toBeTruthy()
    }
  })

  it("n'emploie que des classes sémantiques", () => {
    const classes = [TONE_TEXT, TONE_SOFT].flatMap((table) =>
      Object.values(table).flatMap(classesOf),
    )
    expect(classes.filter((cls) => !SEMANTIC_CLASS.test(cls))).toEqual([])
  })

  it("donne aux SVG et graphiques une variable CSS, pas une couleur figée", () => {
    for (const value of Object.values(TONE_COLOR)) {
      expect(value).toMatch(/^var\(--[a-z0-9-]+\)$/)
    }
  })
})

describe("lib/score — couleur d'un score tirée des tonalités", () => {
  it("le texte d'un score reprend la table des tonalités", () => {
    expect(SCORE_TONE_TEXT).toEqual({
      success: TONE_TEXT.success,
      warning: TONE_TEXT.warning,
      danger: TONE_TEXT.danger,
    })
    expect(scoreTextClass(85)).toBe(TONE_TEXT.success)
    expect(scoreTextClass(42)).toBe(TONE_TEXT.danger)
  })

  it("un score retenu est neutre : classe sémantique, d'aucune tranche", () => {
    expect(scoreTextClass(null)).toMatch(SEMANTIC_CLASS)
    expect(Object.values(SCORE_TONE_TEXT)).not.toContain(scoreTextClass(null))
  })
})
