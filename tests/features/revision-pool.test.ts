import { describe, expect, it } from "vitest"
import {
  EMPTY_REVISION_COUNTS,
  type RevisionCounts,
  revisionPoolSize,
} from "@/features/training/revision-pool"

// 12 ratées, 300 non vues, 9 marquées dont 4 aussi ratées et 2 aussi non vues.
const counts: RevisionCounts = {
  failed: 12,
  unseen: 300,
  bookmarked: 9,
  bookmarkedFailed: 4,
  bookmarkedUnseen: 2,
}

describe("revisionPoolSize", () => {
  it("un seul critère : son compteur", () => {
    expect(revisionPoolSize(counts, ["failed"])).toBe(12)
    expect(revisionPoolSize(counts, ["unseen"])).toBe(300)
    expect(revisionPoolSize(counts, ["bookmarked"])).toBe(9)
  })

  it("ratées et non vues sont disjointes : leur union est la somme", () => {
    expect(revisionPoolSize(counts, ["failed", "unseen"])).toBe(312)
  })

  it("marquées recoupe les deux autres : les doublons sortent une fois", () => {
    expect(revisionPoolSize(counts, ["failed", "bookmarked"])).toBe(17)
    expect(revisionPoolSize(counts, ["unseen", "bookmarked"])).toBe(307)
    expect(revisionPoolSize(counts, ["failed", "unseen", "bookmarked"])).toBe(
      315,
    )
  })

  it("l'ordre des critères ne change rien", () => {
    expect(revisionPoolSize(counts, ["bookmarked", "failed"])).toBe(
      revisionPoolSize(counts, ["failed", "bookmarked"]),
    )
  })

  it("aucun critère : 0, et des compteurs vides restent à 0", () => {
    expect(revisionPoolSize(counts, [])).toBe(0)
    expect(revisionPoolSize(EMPTY_REVISION_COUNTS, ["failed", "unseen"])).toBe(
      0,
    )
  })
})
