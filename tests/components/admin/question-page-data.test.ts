import { describe, expect, it } from "vitest"
import { freezeOf } from "@/app/(admin)/admin/questions/_components/question-page-data"
import type { QuestionExamUse } from "@/features/questions/dal"

const NOW = Date.UTC(2026, 9, 13, 12)
const DAY = 86_400_000

const exam = (
  title: string,
  start: number | null,
  end: number | null,
  finalized = true,
): QuestionExamUse => ({
  id: title,
  title,
  startDate: start === null ? null : NOW + start,
  endDate: end === null ? null : NOW + end,
  finalizedAt: finalized ? NOW - 10 * DAY : null,
  isActive: true,
})

describe("question figée : examens d'une question", () => {
  it("l'examen en cours qui ferme le plus tard la fige, sans avertissement", () => {
    expect(
      freezeOf(
        [
          exam("Tôt", -DAY, 2 * DAY),
          exam("Tard", -DAY, 5 * DAY),
          exam("À venir", 3 * DAY, 9 * DAY),
        ],
        NOW,
      ),
    ).toEqual({
      frozenBy: { title: "Tard", endDate: NOW + 5 * DAY },
      upcoming: null,
    })
  })

  it("sans examen en cours, l'examen à venir qui ouvre le plus tôt avertit", () => {
    expect(
      freezeOf(
        [
          exam("Plus tard", 6 * DAY, 9 * DAY),
          exam("Bientôt", 2 * DAY, 9 * DAY),
        ],
        NOW,
      ),
    ).toEqual({
      frozenBy: null,
      upcoming: { title: "Bientôt", startDate: NOW + 2 * DAY },
    })
  })

  it("l'ouverture fige dès son instant, la fermeture libère dès le sien", () => {
    expect(freezeOf([exam("Ouvre", 0, DAY)], NOW).frozenBy).not.toBeNull()
    expect(freezeOf([exam("Ferme", -DAY, 0)], NOW)).toEqual({
      frozenBy: null,
      upcoming: null,
    })
  })

  it("jumeau : un examen en préparation, même daté, ne fige ni n'avertit", () => {
    expect(
      freezeOf(
        [
          exam("Prép.", -DAY, DAY, false),
          exam("Prép. future", DAY, 2 * DAY, false),
        ],
        NOW,
      ),
    ).toEqual({ frozenBy: null, upcoming: null })
  })
})
