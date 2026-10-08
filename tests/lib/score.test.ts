import { describe, expect, it } from "vitest"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import {
  PASS_THRESHOLD,
  classify,
  computeScorePercent,
  isPassing,
  scoreTone,
  summarize,
} from "@/lib/score"

describe("computeScorePercent", () => {
  it("0 question → 0", () => {
    expect(computeScorePercent(0, 0)).toBe(0)
  })

  it("cas nominaux", () => {
    expect(computeScorePercent(2, 4)).toBe(50)
    expect(computeScorePercent(1, 3)).toBe(33)
    expect(computeScorePercent(23, 40)).toBe(58) // 57.5 exact — Math.round float donnait 57
    expect(computeScorePercent(40, 40)).toBe(100)
  })

  it("half-up exact pour tout total ≤ 500 (parité avec round() SQL numeric)", () => {
    // Un `expect` par couple coûterait ≈ 125 000 assertions : on collecte les
    // écarts et on n'en vérifie que la liste.
    const mismatches: string[] = []
    for (let total = 1; total <= 500; total++) {
      for (let correct = 0; correct <= total; correct++) {
        const hundred = correct * 100
        const remainder = hundred % total
        const base = (hundred - remainder) / total
        const expected = 2 * remainder >= total ? base + 1 : base
        const actual = computeScorePercent(correct, total)
        if (actual !== expected)
          mismatches.push(
            `${correct}/${total} → ${actual}, attendu ${expected}`,
          )
      }
    }
    expect(mismatches).toEqual([])
  })
})

// Résumé d'une tentative côté lecture : une réponse dont la clé est retenue
// n'est ni juste ni fausse (`CONTEXT.md`, « Correction différée »).
const q = (id: string, extra: Partial<QuizQuestion> = {}): QuizQuestion =>
  ({
    _id: id,
    question: `Q ${id}`,
    options: ["A", "B"],
    domain: "D",
    objectifCMC: "O",
    images: [],
    ...extra,
  }) as QuizQuestion

describe("classify", () => {
  const open = q("q1")
  const withheld = q("q2", { keyWithheld: true })

  it("clé absente ou sélection vide → non répondue", () => {
    expect(classify(open, undefined)).toBe("unanswered")
    expect(classify(open, { selected: "" })).toBe("unanswered")
  })

  it("répondue, clé révélée → juste ou fausse selon isCorrect", () => {
    expect(classify(open, { selected: "A", isCorrect: true })).toBe("correct")
    expect(classify(open, { selected: "A", isCorrect: false })).toBe(
      "incorrect",
    )
  })

  it("répondue sans verdict (isCorrect absent) → fausse, jamais juste par défaut", () => {
    expect(classify(open, { selected: "A" })).toBe("incorrect")
  })

  it("répondue, clé retenue → différée, quel que soit isCorrect", () => {
    expect(classify(withheld, { selected: "A", isCorrect: true })).toBe(
      "withheld",
    )
  })

  it("non répondue, clé retenue → non répondue (rien à différer)", () => {
    expect(classify(withheld, undefined)).toBe("unanswered")
  })
})

describe("summarize", () => {
  const questions = [
    q("q1"),
    q("q2"),
    q("q3"),
    q("q4", { keyWithheld: true }),
    q("q5", { keyWithheld: true }),
  ]
  const answers: AnswersMap = {
    q1: { selected: "A", isCorrect: true },
    q2: { selected: "B", isCorrect: false },
    q4: { selected: "A", isCorrect: true },
  }

  it("compte chaque question dans une seule catégorie", () => {
    expect(summarize(questions, answers)).toEqual({
      correct: 1,
      incorrect: 1,
      unanswered: 2,
      withheld: 1,
      scoreWithheld: true,
    })
  })

  it("le score n'est retenu que si une réponse est différée", () => {
    expect(summarize(questions, { q1: answers.q1 }).scoreWithheld).toBe(false)
    expect(
      summarize(questions, { ...answers, q4: { selected: "" } }).scoreWithheld,
    ).toBe(false)
  })

  it("aucune question → tout à zéro, score lisible", () => {
    expect(summarize([], {})).toEqual({
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      withheld: 0,
      scoreWithheld: false,
    })
  })
})

describe("échelle des scores", () => {
  it("≥ 80 réussite nette, ≥ 60 réussite juste, en dessous échec", () => {
    expect(scoreTone(100)).toBe("success")
    expect(scoreTone(80)).toBe("success")
    expect(scoreTone(79)).toBe("warning")
    expect(scoreTone(60)).toBe("warning")
    expect(scoreTone(59)).toBe("danger")
    expect(scoreTone(0)).toBe("danger")
  })

  it("le seuil de réussite est 60 %", () => {
    expect(PASS_THRESHOLD).toBe(60)
    expect(isPassing(60)).toBe(true)
    expect(isPassing(59)).toBe(false)
  })
})
