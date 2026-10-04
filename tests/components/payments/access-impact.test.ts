import { describe, expect, it } from "vitest"
import { impactLines } from "@/components/shared/payments/access-impact"
import type { AccessImpact } from "@/features/payments/dal"

const DAY = 24 * 60 * 60 * 1000
// 15 juin 2026, midi à Toronto : l'instant où l'aperçu a été chargé.
const NOW = Date.UTC(2026, 5, 15, 16)

const impact = (o: Partial<AccessImpact>): AccessImpact => ({
  accessType: "exam",
  willAffectAccess: true,
  currentAccessExpiresAt: NOW + 30 * DAY,
  restoredExpiresAt: null,
  ...o,
})

describe("impactLines", () => {
  it("ne garde que les accès couverts par la transaction", () => {
    const lines = impactLines(
      [impact({ accessType: "exam" }), impact({ accessType: "training" })],
      ["training"],
      NOW,
    )
    expect(lines.map((l) => l.accessType)).toEqual(["training"])
  })

  it("accès retiré quand aucune autre transaction ne le couvre", () => {
    expect(impactLines([impact({})], ["exam"], NOW)).toEqual([
      {
        accessType: "exam",
        affected: true,
        current: NOW + 30 * DAY,
        after: null,
      },
    ])
  })

  it("accès ramené à l'échéance précédente encore future", () => {
    const [line] = impactLines(
      [impact({ restoredExpiresAt: NOW + 5 * DAY })],
      ["exam"],
      NOW,
    )
    expect(line).toMatchObject({ affected: true, after: NOW + 5 * DAY })
  })

  it("une échéance restaurée déjà passée vaut un retrait", () => {
    const [line] = impactLines(
      [impact({ restoredExpiresAt: NOW - DAY })],
      ["exam"],
      NOW,
    )
    expect(line.after).toBeNull()
  })

  it("un accès déjà expiré n'est pas affecté : l'utilisateur ne perd rien", () => {
    const [line] = impactLines(
      [impact({ currentAccessExpiresAt: NOW - DAY })],
      ["exam"],
      NOW,
    )
    expect(line).toMatchObject({ affected: false, current: NOW - DAY })
  })

  it("non affecté quand d'autres transactions couvrent autant", () => {
    const [line] = impactLines(
      [impact({ willAffectAccess: false })],
      ["exam"],
      NOW,
    )
    expect(line.affected).toBe(false)
  })
})
