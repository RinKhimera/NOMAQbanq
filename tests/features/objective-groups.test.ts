import { describe, expect, it } from "vitest"
import {
  type ObjectiveEntryView,
  objectivesBoard,
} from "@/features/objectives/groups"

const entry = (
  id: string,
  label: string,
  over: Partial<ObjectiveEntryView> = {},
): ObjectiveEntryView => ({
  id,
  label,
  needsFix: false,
  reviewedAt: null,
  questionCount: 1,
  domains: ["Cardiologie"],
  ...over,
})

describe("objectivesBoard", () => {
  it("regroupe les variantes de même clé, la plus utilisée d'abord", () => {
    const board = objectivesBoard([
      entry("a", "Douleur abdominale aigue", { questionCount: 61 }),
      entry("b", "Douleur abdominale aiguë", {
        questionCount: 13,
        domains: ["Chirurgie"],
      }),
      entry("c", "Toux"),
    ])
    expect(board.pending.map((g) => g.entries.map((e) => e.id))).toEqual([
      ["a", "b"],
      ["c"],
    ])
    expect(board.pending[0]).toMatchObject({
      questionCount: 74,
      domains: ["Cardiologie", "Chirurgie"],
    })
  })

  it("un groupe est traité quand toutes ses entrées sont revues ; la progression compte les groupes", () => {
    const board = objectivesBoard([
      entry("a", "Dyspnée", { reviewedAt: 1 }),
      entry("b", "dyspnee", { reviewedAt: null }),
      entry("c", "Toux", { reviewedAt: 1 }),
      entry("d", "Fièvre"),
    ])
    expect(board.pending.map((g) => g.key)).toEqual(["dyspnee", "fievre"])
    expect(board.progress).toEqual({ done: 1, total: 3 })
    expect(board.reviewed.map((e) => e.id)).toEqual(["a", "c"])
  })

  it("met les valeurs invalides à part, avec leur problème, tant qu'une question active les utilise", () => {
    const board = objectivesBoard([
      entry("a", "-", { needsFix: true, questionCount: 21 }),
      entry("b", "?", { needsFix: true, questionCount: 0 }),
      entry("c", "Toux"),
    ])
    expect(board.invalid).toEqual([
      expect.objectContaining({
        id: "a",
        problems: ["Moins de 3 caractères", "Aucune lettre"],
      }),
    ])
    expect(board.progress.total).toBe(1)
  })
})
